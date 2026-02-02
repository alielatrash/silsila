import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platform-admin'

/**
 * GET /api/superadmin/organizations
 *
 * List all organizations with pagination, search, and filters
 * Platform admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Verify platform admin access
    await requirePlatformAdmin()

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || '' // 'ACTIVE' | 'SUSPENDED'
    const tier = searchParams.get('tier') || '' // 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
    const subscriptionStatus = searchParams.get('subscriptionStatus') || ''

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (tier) {
      where.subscriptionTier = tier
    }

    if (subscriptionStatus) {
      where.subscriptionStatus = subscriptionStatus
    }

    // Get total count
    const total = await prisma.organization.count({ where })

    // Get paginated organizations
    const organizations = await prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        country: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        status: true,
        trialEndsAt: true,
        suspendedAt: true,
        suspendedReason: true,
        createdAt: true,
        updatedAt: true,
        stripeCustomerId: true,
        currentBillingCycle: true,
        subscriptionCurrentPeriodEnd: true,
        priceOverride: true,
        seatLimit: true,
        _count: {
          select: {
            members: true,
            demandForecasts: true,
            supplyCommitments: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    })

    // Get last activity for each org
    const orgIds = organizations.map(o => o.id)
    const lastActivities = await prisma.activityEvent.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: orgIds } },
      _max: { createdAt: true },
    })

    const lastActivityMap = new Map(
      lastActivities.map(a => [a.organizationId, a._max.createdAt])
    )

    // Combine data
    const enrichedOrgs = organizations.map(org => ({
      ...org,
      memberCount: org._count.members,
      demandForecastCount: org._count.demandForecasts,
      supplyCommitmentCount: org._count.supplyCommitments,
      lastActivityAt: lastActivityMap.get(org.id) || null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        organizations: enrichedOrgs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error: any) {
    console.error('Superadmin organizations list error:', error)

    if (error.message.includes('UNAUTHORIZED') || error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Platform admin access required',
          },
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch organizations',
        },
      },
      { status: 500 }
    )
  }
}
