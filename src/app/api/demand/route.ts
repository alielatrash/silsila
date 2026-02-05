import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, hasPermission } from '@/lib/auth'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { generateCitym } from '@/lib/citym'
import { createDemandForecastSchema } from '@/lib/validations/demand'
import { notifySupplyPlannersOfDemand } from '@/lib/notifications'
import { orgScopedWhere, orgScopedData } from '@/lib/org-scoped'

export async function GET(request: Request) {
  try {
    console.log('[GET /api/demand] Starting request...')
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const planningWeekId = searchParams.get('planningWeekId')
    const partyId = searchParams.get('clientId') // For backward compatibility, still accept clientId param
    const routeKey = searchParams.get('citym') || searchParams.get('routeKey') // Support both old and new names
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)

    // Get filter parameters
    const plannerIds = searchParams.getAll('plannerIds')
    const clientIds = searchParams.getAll('clientIds')
    const categoryIds = searchParams.getAll('categoryIds')
    const truckTypeIds = searchParams.getAll('truckTypeIds')
    const businessTypes = searchParams.getAll('businessTypes')

    console.log('[GET /api/demand] Query params:', { planningWeekId, partyId, routeKey, page, pageSize, plannerIds, clientIds, categoryIds, truckTypeIds, businessTypes })

    const where = orgScopedWhere(session, {
      ...(planningWeekId && { planningWeekId }),
      ...(partyId && { partyId }),
      ...(routeKey && { routeKey }),
      ...(plannerIds.length > 0 && { createdById: { in: plannerIds } }),
      ...(clientIds.length > 0 && { partyId: { in: clientIds } }),
      ...(categoryIds.length > 0 && { demandCategoryId: { in: categoryIds } }),
      ...(businessTypes.length > 0 && { businessType: { in: businessTypes } }),
      ...(truckTypeIds.length > 0 && {
        resourceTypes: {
          some: {
            resourceTypeId: { in: truckTypeIds }
          }
        }
      }),
    })

    console.log('[GET /api/demand] Where clause:', JSON.stringify(where, null, 2))

    // Fetch forecasts without includes first (much faster)
    console.log('[GET /api/demand] Fetching forecasts...')
    const [totalCount, forecasts] = await Promise.all([
      prisma.demandForecast.count({ where }),
      prisma.demandForecast.findMany({
        where,
        orderBy: [
          { partyId: 'asc' },
          { routeKey: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    console.log('[GET /api/demand] Found', forecasts.length, 'forecasts (total:', totalCount, ')')

    if (forecasts.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      })
    }

    // Collect unique IDs for batch fetching
    const forecastIds = forecasts.map(f => f.id)
    const partyIds = [...new Set(forecasts.map(f => f.partyId))]
    const pickupLocationIds = [...new Set(forecasts.map(f => f.pickupLocationId))]
    const dropoffLocationIds = [...new Set(forecasts.map(f => f.dropoffLocationId))]
    const demandCategoryIds = [...new Set(forecasts.map(f => f.demandCategoryId).filter((id): id is string => id !== null))]
    const planningWeekIds = [...new Set(forecasts.map(f => f.planningWeekId))]
    const createdByIds = [...new Set(forecasts.map(f => f.createdById))]

    console.log('[GET /api/demand] Batch fetching related data for', forecastIds.length, 'forecasts...')

    // Batch fetch all related data in parallel (with org scoping)
    const [parties, pickupLocations, dropoffLocations, demandCategories, planningWeeks, users, forecastResourceTypes] = await Promise.all([
      prisma.party.findMany({
        where: orgScopedWhere(session, { id: { in: partyIds } }),
        select: { id: true, name: true },
      }),
      prisma.location.findMany({
        where: orgScopedWhere(session, { id: { in: pickupLocationIds } }),
        select: { id: true, name: true, code: true, region: true },
      }),
      prisma.location.findMany({
        where: orgScopedWhere(session, { id: { in: dropoffLocationIds } }),
        select: { id: true, name: true, code: true, region: true },
      }),
      prisma.demandCategory.findMany({
        where: orgScopedWhere(session, { id: { in: demandCategoryIds } }),
        select: { id: true, name: true, code: true },
      }),
      prisma.planningWeek.findMany({
        where: orgScopedWhere(session, { id: { in: planningWeekIds } }),
        select: { id: true, weekStart: true, weekEnd: true, year: true, weekNumber: true },
      }),
      prisma.user.findMany({
        where: { id: { in: createdByIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      // Fetch resource types through junction table
      prisma.demandForecastResourceType.findMany({
        where: { demandForecastId: { in: forecastIds } },
        include: { resourceType: { select: { id: true, name: true } } },
      }),
    ])

    console.log('[GET /api/demand] Batch fetch complete. Results:', {
      parties: parties.length,
      pickupLocations: pickupLocations.length,
      dropoffLocations: dropoffLocations.length,
      demandCategories: demandCategories.length,
      planningWeeks: planningWeeks.length,
      users: users.length,
      forecastResourceTypes: forecastResourceTypes.length,
    })

    // Create lookup maps for O(1) access
    const partyMap = new Map(parties.map(p => [p.id, p]))
    const pickupLocationMap = new Map(pickupLocations.map(l => [l.id, l]))
    const dropoffLocationMap = new Map(dropoffLocations.map(l => [l.id, l]))
    const demandCategoryMap = new Map(demandCategories.map(c => [c.id, c]))
    const planningWeekMap = new Map(planningWeeks.map(w => [w.id, w]))
    const userMap = new Map(users.map(u => [u.id, u]))

    // Group resource types by forecast ID
    const resourceTypesByForecast = new Map<string, { id: string; name: string }[]>()
    for (const frt of forecastResourceTypes) {
      const existing = resourceTypesByForecast.get(frt.demandForecastId) || []
      existing.push(frt.resourceType)
      resourceTypesByForecast.set(frt.demandForecastId, existing)
    }

    console.log('[GET /api/demand] Transforming forecasts...')

    // Combine data in memory (use new field names but keep old names for backward compatibility)
    const forecastsWithRelations = forecasts.map(forecast => {
      const resourceTypes = resourceTypesByForecast.get(forecast.id) || []
      return {
        ...forecast,
        party: partyMap.get(forecast.partyId)!,
        client: partyMap.get(forecast.partyId)!, // Backward compatibility
        pickupLocation: pickupLocationMap.get(forecast.pickupLocationId)!,
        pickupCity: pickupLocationMap.get(forecast.pickupLocationId)!, // Backward compatibility
        dropoffLocation: dropoffLocationMap.get(forecast.dropoffLocationId)!,
        dropoffCity: dropoffLocationMap.get(forecast.dropoffLocationId)!, // Backward compatibility
        demandCategory: forecast.demandCategoryId ? demandCategoryMap.get(forecast.demandCategoryId) || null : null,
        resourceTypes, // Array of resource types
        resourceType: resourceTypes[0] || null, // Backward compatibility: first resource type
        truckType: resourceTypes[0] || null, // Backward compatibility
        planningWeek: planningWeekMap.get(forecast.planningWeekId)!,
        createdBy: userMap.get(forecast.createdById)!,
      }
    })

    const totalPages = Math.ceil(totalCount / pageSize)

    console.log('[GET /api/demand] Success! Returning', forecastsWithRelations.length, 'forecasts')

    return NextResponse.json({
      success: true,
      data: forecastsWithRelations,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('[GET /api/demand] Error occurred:', error)
    console.error('[GET /api/demand] Error details:', error instanceof Error ? error.message : String(error))
    console.error('[GET /api/demand] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Check permission
    if (!hasPermission(session.user.role, 'demand:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to create demand forecasts' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = createDemandForecastSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    console.log('[POST /api/demand] Received data:', JSON.stringify(data, null, 2))

    // Check organization settings for demand category configuration
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.currentOrgId },
      select: { demandCategoryEnabled: true, demandCategoryRequired: true },
    })

    console.log('[POST /api/demand] Organization settings:', settings)

    // If category is enabled and required, validate it's provided
    if (settings?.demandCategoryEnabled && settings?.demandCategoryRequired && !data.demandCategoryId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Category is required' } },
        { status: 400 }
      )
    }

    // Run all validation queries in parallel (with org scoping)
    const [planningWeek, pickupLocation, dropoffLocation, existing] = await Promise.all([
      prisma.planningWeek.findFirst({ where: orgScopedWhere(session, { id: data.planningWeekId }) }),
      prisma.location.findFirst({ where: orgScopedWhere(session, { id: data.pickupCityId }), select: { name: true } }),
      prisma.location.findFirst({ where: orgScopedWhere(session, { id: data.dropoffCityId }), select: { name: true } }),
      prisma.demandForecast.findFirst({
        where: orgScopedWhere(session, {
          planningWeekId: data.planningWeekId,
          partyId: data.clientId,
          pickupLocationId: data.pickupCityId,
          dropoffLocationId: data.dropoffCityId,
          demandCategoryId: data.demandCategoryId || null,
        }),
      }),
    ])

    if (!planningWeek) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Planning week not found' } },
        { status: 404 }
      )
    }

    if (planningWeek.isLocked) {
      return NextResponse.json(
        { success: false, error: { code: 'LOCKED', message: 'This planning week is locked and cannot be edited' } },
        { status: 400 }
      )
    }

    if (!pickupLocation || !dropoffLocation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Location not found' } },
        { status: 404 }
      )
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'A forecast for this route and party already exists' } },
        { status: 409 }
      )
    }

    const routeKey = generateCitym(pickupLocation.name, dropoffLocation.name)

    // Calculate total based on which fields are populated (weekly vs monthly planning)
    const dayTotal = (data.day1Loads || 0) + (data.day2Loads || 0) + (data.day3Loads || 0) +
                      (data.day4Loads || 0) + (data.day5Loads || 0) + (data.day6Loads || 0) + (data.day7Loads || 0)
    const weekTotal = (data.week1Loads || 0) + (data.week2Loads || 0) + (data.week3Loads || 0) +
                       (data.week4Loads || 0) + (data.week5Loads || 0)
    const totalQty = dayTotal > 0 ? dayTotal : weekTotal

    // Create forecast with multiple truck types using a transaction
    const forecast = await prisma.$transaction(async (tx) => {
      console.log('[Transaction] Creating demand forecast...')

      const forecastData = orgScopedData(session, {
        planningWeekId: data.planningWeekId,
        partyId: data.clientId,
        pickupLocationId: data.pickupCityId,
        dropoffLocationId: data.dropoffCityId,
        demandCategoryId: data.demandCategoryId || null,
        businessType: data.businessType || 'REGULAR',
        day1Qty: data.day1Loads || 0,
        day2Qty: data.day2Loads || 0,
        day3Qty: data.day3Loads || 0,
        day4Qty: data.day4Loads || 0,
        day5Qty: data.day5Loads || 0,
        day6Qty: data.day6Loads || 0,
        day7Qty: data.day7Loads || 0,
        week1Qty: data.week1Loads || 0,
        week2Qty: data.week2Loads || 0,
        week3Qty: data.week3Loads || 0,
        week4Qty: data.week4Loads || 0,
        week5Qty: data.week5Loads || 0,
        routeKey,
        totalQty,
        createdById: session.user.id,
      })

      console.log('[Transaction] Forecast data:', JSON.stringify(forecastData, null, 2))

      // Create the forecast
      const newForecast = await tx.demandForecast.create({
        data: forecastData,
      })

      console.log('[Transaction] Forecast created with ID:', newForecast.id)

      // Create junction table entries for all selected truck types
      if (data.truckTypeIds && data.truckTypeIds.length > 0) {
        console.log('[Transaction] Creating junction table entries for truck types:', data.truckTypeIds)
        await tx.demandForecastResourceType.createMany({
          data: data.truckTypeIds.map((resourceTypeId) => ({
            demandForecastId: newForecast.id,
            resourceTypeId,
          })),
        })
        console.log('[Transaction] Junction table entries created')
      }

      console.log('[Transaction] Fetching complete forecast with relations...')
      // Fetch the complete forecast with relations
      const result = await tx.demandForecast.findUnique({
        where: { id: newForecast.id },
        include: {
          party: { select: { id: true, name: true } },
          pickupLocation: { select: { id: true, name: true, code: true, region: true } },
          dropoffLocation: { select: { id: true, name: true, code: true, region: true } },
          demandCategory: { select: { id: true, name: true, code: true } },
          resourceTypes: { include: { resourceType: { select: { id: true, name: true } } } },
          planningWeek: { select: { id: true, weekStart: true, weekEnd: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      if (!result) throw new Error('Failed to fetch created forecast')
      console.log('[Transaction] Complete forecast fetched successfully')
      return result
    })

    console.log('[POST /api/demand] Transaction completed, transforming forecast...')

    // Transform resourceTypes to flatten the structure
    const transformedForecast = {
      ...forecast,
      resourceTypes: forecast.resourceTypes?.map((rt: any) => rt.resourceType) || [],
      resourceType: forecast.resourceTypes?.[0]?.resourceType || null, // Backward compatibility
    }

    console.log('[POST /api/demand] Forecast transformed successfully')

    // Create audit log asynchronously (don't block the response)
    createAuditLog({
      userId: session.user.id,
      action: AuditAction.DEMAND_CREATED,
      entityType: 'DemandForecast',
      entityId: forecast.id,
      metadata: {
        routeKey,
        totalQty,
        partyId: data.clientId,
        clientName: forecast.party?.name,
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => key.includes('Loads'))
        ),
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    // Notify supply planners of new demand forecast
    notifySupplyPlannersOfDemand(
      forecast.id,
      forecast.party?.name || 'Unknown',
      routeKey,
      `${session.user.firstName} ${session.user.lastName}`
    ).catch((err) => console.error('Failed to send notifications:', err))

    console.log('[POST /api/demand] Success! Returning forecast')
    return NextResponse.json({ success: true, data: transformedForecast }, { status: 201 })
  } catch (error) {
    console.error('Create demand forecast error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
