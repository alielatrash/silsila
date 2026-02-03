import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { orgScopedWhere } from '@/lib/org-scoped'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const planningWeekId = searchParams.get('planningWeekId')

    if (!planningWeekId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'planningWeekId is required' } },
        { status: 400 }
      )
    }

    // Get all supply commitments for the week (with org scoping)
    const commitments = await prisma.supplyCommitment.findMany({
      where: orgScopedWhere(session, { planningWeekId }),
      include: {
        party: { select: { id: true, name: true } },
      },
      orderBy: [
        { party: { name: 'asc' } },
        { routeKey: 'asc' },
      ],
    })

    // Get demand forecasts to get customer information
    const demandForecasts = await prisma.demandForecast.findMany({
      where: orgScopedWhere(session, { planningWeekId }),
      select: {
        routeKey: true,
        party: { select: { id: true, name: true } },
        day1Qty: true,
        day2Qty: true,
        day3Qty: true,
        day4Qty: true,
        day5Qty: true,
        day6Qty: true,
        day7Qty: true,
        totalQty: true,
      },
      orderBy: [
        { party: { name: 'asc' } },
      ],
    })

    // Group by supplier
    const supplierMap = new Map<string, {
      partyId: string
      partyName: string
      routes: Array<{
        routeKey: string
        plan: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
      }>
      totals: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
    }>()

    for (const commitment of commitments) {
      const key = commitment.partyId

      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          partyId: commitment.party.id,
          partyName: commitment.party.name,
          routes: [],
          totals: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
        })
      }

      const supplier = supplierMap.get(key)!

      // Check if route already exists for this supplier
      const existingRoute = supplier.routes.find(r => r.routeKey === commitment.routeKey)

      if (existingRoute) {
        // Aggregate commitments for the same route (multiple truck types)
        existingRoute.plan.day1 += commitment.day1Committed
        existingRoute.plan.day2 += commitment.day2Committed
        existingRoute.plan.day3 += commitment.day3Committed
        existingRoute.plan.day4 += commitment.day4Committed
        existingRoute.plan.day5 += commitment.day5Committed
        existingRoute.plan.day6 += commitment.day6Committed
        existingRoute.plan.day7 += commitment.day7Committed
        existingRoute.plan.total += commitment.totalCommitted
      } else {
        // Create new route entry
        const routePlan = {
          day1: commitment.day1Committed,
          day2: commitment.day2Committed,
          day3: commitment.day3Committed,
          day4: commitment.day4Committed,
          day5: commitment.day5Committed,
          day6: commitment.day6Committed,
          day7: commitment.day7Committed,
          total: commitment.totalCommitted,
        }

        supplier.routes.push({
          routeKey: commitment.routeKey,
          plan: routePlan,
        })
      }

      // Aggregate totals
      supplier.totals.day1 += commitment.day1Committed
      supplier.totals.day2 += commitment.day2Committed
      supplier.totals.day3 += commitment.day3Committed
      supplier.totals.day4 += commitment.day4Committed
      supplier.totals.day5 += commitment.day5Committed
      supplier.totals.day6 += commitment.day6Committed
      supplier.totals.day7 += commitment.day7Committed
      supplier.totals.total += commitment.totalCommitted
    }

    // Convert to array and sort by party name
    const dispatchData = Array.from(supplierMap.values()).sort((a, b) =>
      a.partyName.localeCompare(b.partyName)
    )

    // Calculate grand totals
    const grandTotals = {
      day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0,
    }
    for (const supplier of dispatchData) {
      grandTotals.day1 += supplier.totals.day1
      grandTotals.day2 += supplier.totals.day2
      grandTotals.day3 += supplier.totals.day3
      grandTotals.day4 += supplier.totals.day4
      grandTotals.day5 += supplier.totals.day5
      grandTotals.day6 += supplier.totals.day6
      grandTotals.day7 += supplier.totals.day7
      grandTotals.total += supplier.totals.total
    }

    // Map field names to match frontend expectations
    const suppliers = dispatchData.map(supplier => ({
      supplierId: supplier.partyId,
      supplierName: supplier.partyName,
      routes: supplier.routes,
      totals: supplier.totals,
    }))

    // Group by customer with supplier breakdown per route
    const customerMap = new Map<string, {
      customerId: string
      customerName: string
      routes: Array<{
        routeKey: string
        demand: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
        suppliers: Array<{
          supplierId: string
          supplierName: string
          plan: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
        }>
      }>
      totals: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
    }>()

    for (const forecast of demandForecasts) {
      const key = forecast.party.id

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customerId: forecast.party.id,
          customerName: forecast.party.name,
          routes: [],
          totals: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
        })
      }

      const customer = customerMap.get(key)!

      // Check if route already exists for this customer
      const existingRoute = customer.routes.find(r => r.routeKey === forecast.routeKey)

      if (existingRoute) {
        // Aggregate demand for the same route (multiple truck types)
        existingRoute.demand.day1 += forecast.day1Qty
        existingRoute.demand.day2 += forecast.day2Qty
        existingRoute.demand.day3 += forecast.day3Qty
        existingRoute.demand.day4 += forecast.day4Qty
        existingRoute.demand.day5 += forecast.day5Qty
        existingRoute.demand.day6 += forecast.day6Qty
        existingRoute.demand.day7 += forecast.day7Qty
        existingRoute.demand.total += forecast.totalQty
      } else {
        // Create new route entry
        const routeDemand = {
          day1: forecast.day1Qty,
          day2: forecast.day2Qty,
          day3: forecast.day3Qty,
          day4: forecast.day4Qty,
          day5: forecast.day5Qty,
          day6: forecast.day6Qty,
          day7: forecast.day7Qty,
          total: forecast.totalQty,
        }

        // Find suppliers serving this route and aggregate by supplier
        const routeSupplierMap = new Map<string, {
          supplierId: string
          supplierName: string
          plan: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
        }>()

        commitments
          .filter(c => c.routeKey === forecast.routeKey)
          .forEach(c => {
            const supplierId = c.party.id

            if (!routeSupplierMap.has(supplierId)) {
              routeSupplierMap.set(supplierId, {
                supplierId: c.party.id,
                supplierName: c.party.name,
                plan: {
                  day1: c.day1Committed,
                  day2: c.day2Committed,
                  day3: c.day3Committed,
                  day4: c.day4Committed,
                  day5: c.day5Committed,
                  day6: c.day6Committed,
                  day7: c.day7Committed,
                  total: c.totalCommitted,
                },
              })
            } else {
              // Aggregate if supplier already exists (multiple truck types)
              const existingSupplier = routeSupplierMap.get(supplierId)!
              existingSupplier.plan.day1 += c.day1Committed
              existingSupplier.plan.day2 += c.day2Committed
              existingSupplier.plan.day3 += c.day3Committed
              existingSupplier.plan.day4 += c.day4Committed
              existingSupplier.plan.day5 += c.day5Committed
              existingSupplier.plan.day6 += c.day6Committed
              existingSupplier.plan.day7 += c.day7Committed
              existingSupplier.plan.total += c.totalCommitted
            }
          })

        const routeSuppliers = Array.from(routeSupplierMap.values())

        customer.routes.push({
          routeKey: forecast.routeKey,
          demand: routeDemand,
          suppliers: routeSuppliers,
        })
      }

      // Aggregate totals
      customer.totals.day1 += forecast.day1Qty
      customer.totals.day2 += forecast.day2Qty
      customer.totals.day3 += forecast.day3Qty
      customer.totals.day4 += forecast.day4Qty
      customer.totals.day5 += forecast.day5Qty
      customer.totals.day6 += forecast.day6Qty
      customer.totals.day7 += forecast.day7Qty
      customer.totals.total += forecast.totalQty
    }

    const customers = Array.from(customerMap.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    )

    return NextResponse.json({
      success: true,
      data: {
        suppliers,
        customers,
        grandTotals,
      },
    })
  } catch (error) {
    console.error('Get dispatch data error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
