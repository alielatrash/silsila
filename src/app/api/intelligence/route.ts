import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { orgScopedWhere } from '@/lib/org-scoped'
import {
  calculateCoverage,
  calculateGap,
  computeCumulative,
  groupSuppliersByContribution,
  generateInsights,
  type RouteMetrics,
  type SupplierContribution,
} from '@/lib/intelligence-metrics'

// Get aggregated intelligence data for all charts
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Planning week ID is required' } },
        { status: 400 }
      )
    }

    // Get filter parameters
    const plannerIds = searchParams.getAll('plannerIds')
    const clientIds = searchParams.getAll('clientIds')
    const categoryIds = searchParams.getAll('categoryIds')
    const truckTypeIds = searchParams.getAll('truckTypeIds')
    const routeKeys = searchParams.getAll('routeKeys')

    // Build where clause for demand forecasts with filters
    const demandWhereClause = orgScopedWhere(session, {
      planningWeekId,
      ...(plannerIds.length > 0 && { createdById: { in: plannerIds } }),
      ...(clientIds.length > 0 && { partyId: { in: clientIds } }),
      ...(categoryIds.length > 0 && { demandCategoryId: { in: categoryIds } }),
      ...(truckTypeIds.length > 0 && {
        resourceTypes: {
          some: {
            resourceTypeId: { in: truckTypeIds },
          },
        },
      }),
      ...(routeKeys.length > 0 && { routeKey: { in: routeKeys } }),
    })

    // Build where clause for supply commitments (filter by route if specified)
    const commitmentWhereClause = orgScopedWhere(session, {
      planningWeekId,
      ...(routeKeys.length > 0 && { routeKey: { in: routeKeys } }),
    })

    // Run queries in parallel for better performance
    const [demandForecasts, supplyCommitments] = await Promise.all([
      // Get demand forecasts with relations
      prisma.demandForecast.findMany({
        where: demandWhereClause,
        select: {
          id: true,
          routeKey: true,
          partyId: true,
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
      }),
      // Get supply commitments with supplier info
      prisma.supplyCommitment.findMany({
        where: commitmentWhereClause,
        select: {
          id: true,
          routeKey: true,
          partyId: true,
          party: { select: { id: true, name: true } },
          day1Committed: true,
          day2Committed: true,
          day3Committed: true,
          day4Committed: true,
          day5Committed: true,
          day6Committed: true,
          day7Committed: true,
          totalCommitted: true,
        },
      }),
    ])

    // Aggregate demand by day (sum across all routes)
    const demandByDay = {
      day1: demandForecasts.reduce((sum, f) => sum + f.day1Qty, 0),
      day2: demandForecasts.reduce((sum, f) => sum + f.day2Qty, 0),
      day3: demandForecasts.reduce((sum, f) => sum + f.day3Qty, 0),
      day4: demandForecasts.reduce((sum, f) => sum + f.day4Qty, 0),
      day5: demandForecasts.reduce((sum, f) => sum + f.day5Qty, 0),
      day6: demandForecasts.reduce((sum, f) => sum + f.day6Qty, 0),
      day7: demandForecasts.reduce((sum, f) => sum + f.day7Qty, 0),
      total: demandForecasts.reduce((sum, f) => sum + f.totalQty, 0),
    }

    // Aggregate commitments by day
    const committedByDay = {
      day1: supplyCommitments.reduce((sum, c) => sum + c.day1Committed, 0),
      day2: supplyCommitments.reduce((sum, c) => sum + c.day2Committed, 0),
      day3: supplyCommitments.reduce((sum, c) => sum + c.day3Committed, 0),
      day4: supplyCommitments.reduce((sum, c) => sum + c.day4Committed, 0),
      day5: supplyCommitments.reduce((sum, c) => sum + c.day5Committed, 0),
      day6: supplyCommitments.reduce((sum, c) => sum + c.day6Committed, 0),
      day7: supplyCommitments.reduce((sum, c) => sum + c.day7Committed, 0),
      total: supplyCommitments.reduce((sum, c) => sum + c.totalCommitted, 0),
    }

    // Aggregate by routeKey for route-level analysis
    const demandByRoute = demandForecasts.reduce((acc, f) => {
      if (!acc[f.routeKey]) {
        acc[f.routeKey] = {
          day1: 0,
          day2: 0,
          day3: 0,
          day4: 0,
          day5: 0,
          day6: 0,
          day7: 0,
          total: 0,
        }
      }
      acc[f.routeKey].day1 += f.day1Qty
      acc[f.routeKey].day2 += f.day2Qty
      acc[f.routeKey].day3 += f.day3Qty
      acc[f.routeKey].day4 += f.day4Qty
      acc[f.routeKey].day5 += f.day5Qty
      acc[f.routeKey].day6 += f.day6Qty
      acc[f.routeKey].day7 += f.day7Qty
      acc[f.routeKey].total += f.totalQty
      return acc
    }, {} as Record<string, typeof demandByDay>)

    const committedByRoute = supplyCommitments.reduce((acc, c) => {
      if (!acc[c.routeKey]) {
        acc[c.routeKey] = {
          day1: 0,
          day2: 0,
          day3: 0,
          day4: 0,
          day5: 0,
          day6: 0,
          day7: 0,
          total: 0,
        }
      }
      acc[c.routeKey].day1 += c.day1Committed
      acc[c.routeKey].day2 += c.day2Committed
      acc[c.routeKey].day3 += c.day3Committed
      acc[c.routeKey].day4 += c.day4Committed
      acc[c.routeKey].day5 += c.day5Committed
      acc[c.routeKey].day6 += c.day6Committed
      acc[c.routeKey].day7 += c.day7Committed
      acc[c.routeKey].total += c.totalCommitted
      return acc
    }, {} as Record<string, typeof committedByDay>)

    // Aggregate commitments by supplier (for vendor analysis)
    const commitmentsBySupplier = supplyCommitments.reduce((acc, c) => {
      const supplierId = c.party.id
      if (!acc[supplierId]) {
        acc[supplierId] = {
          supplierName: c.party.name,
          day1: 0,
          day2: 0,
          day3: 0,
          day4: 0,
          day5: 0,
          day6: 0,
          day7: 0,
          total: 0,
        }
      }
      acc[supplierId].day1 += c.day1Committed
      acc[supplierId].day2 += c.day2Committed
      acc[supplierId].day3 += c.day3Committed
      acc[supplierId].day4 += c.day4Committed
      acc[supplierId].day5 += c.day5Committed
      acc[supplierId].day6 += c.day6Committed
      acc[supplierId].day7 += c.day7Committed
      acc[supplierId].total += c.totalCommitted
      return acc
    }, {} as Record<string, { supplierName: string } & typeof committedByDay>)

    // Day labels
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Chart 1: Demand vs Committed vs Gap by Day
    const demandVsCommitted = {
      days,
      demand: [
        demandByDay.day1,
        demandByDay.day2,
        demandByDay.day3,
        demandByDay.day4,
        demandByDay.day5,
        demandByDay.day6,
        demandByDay.day7,
      ],
      committed: [
        committedByDay.day1,
        committedByDay.day2,
        committedByDay.day3,
        committedByDay.day4,
        committedByDay.day5,
        committedByDay.day6,
        committedByDay.day7,
      ],
      gap: [
        calculateGap(demandByDay.day1, committedByDay.day1),
        calculateGap(demandByDay.day2, committedByDay.day2),
        calculateGap(demandByDay.day3, committedByDay.day3),
        calculateGap(demandByDay.day4, committedByDay.day4),
        calculateGap(demandByDay.day5, committedByDay.day5),
        calculateGap(demandByDay.day6, committedByDay.day6),
        calculateGap(demandByDay.day7, committedByDay.day7),
      ],
    }

    // Chart 2: Capacity Utilization by Day (using coverage % as utilization since cap doesn't exist)
    const capacityUtilization = {
      days,
      utilization: [
        calculateCoverage(demandByDay.day1, committedByDay.day1),
        calculateCoverage(demandByDay.day2, committedByDay.day2),
        calculateCoverage(demandByDay.day3, committedByDay.day3),
        calculateCoverage(demandByDay.day4, committedByDay.day4),
        calculateCoverage(demandByDay.day5, committedByDay.day5),
        calculateCoverage(demandByDay.day6, committedByDay.day6),
        calculateCoverage(demandByDay.day7, committedByDay.day7),
      ],
      threshold: 85, // Target coverage threshold
    }

    // Chart 3: Gap Heatmap (Route × Day)
    const routes = Object.keys(demandByRoute)
    const heatmapData: Array<{ route: string; day: string; gap: number; gapPercent: number }> = []

    for (const route of routes) {
      const demand = demandByRoute[route]
      const committed = committedByRoute[route] || {
        day1: 0,
        day2: 0,
        day3: 0,
        day4: 0,
        day5: 0,
        day6: 0,
        day7: 0,
        total: 0,
      }

      days.forEach((day, index) => {
        const dayKey = `day${index + 1}` as keyof typeof demand
        const demandVal = demand[dayKey]
        const committedVal = committed[dayKey]
        const gap = calculateGap(demandVal, committedVal)
        const gapPercent = demandVal > 0 ? (gap / demandVal) * 100 : 0

        heatmapData.push({
          route,
          day,
          gap,
          gapPercent: Math.round(gapPercent * 10) / 10,
        })
      })
    }

    const gapHeatmap = {
      routes,
      days,
      data: heatmapData,
    }

    // Chart 4: Top Gap Contributors
    const topGapContributors: RouteMetrics[] = routes
      .map((route) => {
        const demand = demandByRoute[route]
        const committed = committedByRoute[route] || {
          day1: 0,
          day2: 0,
          day3: 0,
          day4: 0,
          day5: 0,
          day6: 0,
          day7: 0,
          total: 0,
        }
        const gap = calculateGap(demand.total, committed.total)
        const coverage = calculateCoverage(demand.total, committed.total)

        return {
          route,
          demand: demand.total,
          committed: committed.total,
          gap,
          coverage,
        }
      })
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 15) // Top 15 routes

    // Chart 5: Cumulative Plan vs Commit (S-curve)
    const cumulativeDemand = computeCumulative(demandVsCommitted.demand)
    const cumulativeCommitted = computeCumulative(demandVsCommitted.committed)

    const cumulativePlanVsCommit = {
      days,
      cumulativeDemand,
      cumulativeCommitted,
    }

    // Chart 6: Supply Mix / Concentration Risk
    const suppliers = groupSuppliersByContribution(
      supplyCommitments.map((c) => ({
        party: c.party,
        totalCommitted: c.totalCommitted,
      }))
    )

    // Calculate top supplier share per day for trend
    const topSupplierShareByDay = days.map((_, index) => {
      const dayKey = `day${index + 1}` as keyof typeof committedByDay
      const dayTotal = committedByDay[dayKey]

      if (dayTotal === 0) return 0

      // Find max supplier contribution for this day
      const maxSupplierShare = Object.values(commitmentsBySupplier).reduce((max, supplier) => {
        const supplierDayCommit = supplier[dayKey]
        const share = (supplierDayCommit / dayTotal) * 100
        return Math.max(max, share)
      }, 0)

      return Math.round(maxSupplierShare * 10) / 10
    })

    const supplyMix = {
      suppliers: suppliers.slice(0, 10), // Top 10 suppliers
      trend: {
        days,
        topSupplierShare: topSupplierShareByDay,
      },
    }

    // Chart 7: Vendor Contribution vs Demand by Day
    const topSuppliers = suppliers.slice(0, 5) // Top 5 suppliers
    const otherSuppliersTotal = suppliers.slice(5).reduce((sum, s) => sum + s.contribution, 0)

    const vendorContribution = {
      days,
      demand: demandVsCommitted.demand,
      suppliers: [
        ...topSuppliers.map((supplier) => {
          const supplierData = Object.entries(commitmentsBySupplier).find(
            ([id]) => id === supplier.supplierId
          )
          const data = supplierData ? supplierData[1] : null

          return {
            name: supplier.supplierName,
            data: data
              ? [data.day1, data.day2, data.day3, data.day4, data.day5, data.day6, data.day7]
              : [0, 0, 0, 0, 0, 0, 0],
          }
        }),
        // Add "Others" if there are more than 5 suppliers
        ...(suppliers.length > 5
          ? [
              {
                name: 'Others',
                data: days.map((_, index) => {
                  const dayKey = `day${index + 1}` as keyof typeof committedByDay
                  const topSuppliersCommit = topSuppliers.reduce((sum, supplier) => {
                    const supplierData = Object.entries(commitmentsBySupplier).find(
                      ([id]) => id === supplier.supplierId
                    )
                    return sum + (supplierData ? supplierData[1][dayKey] : 0)
                  }, 0)
                  return committedByDay[dayKey] - topSuppliersCommit
                }),
              },
            ]
          : []),
      ],
    }

    // Chart 8: Coverage by Lead Time Buckets
    const coverageByLeadTime = {
      buckets: [
        {
          label: 'Days 1-2',
          demand: demandByDay.day1 + demandByDay.day2,
          committed: committedByDay.day1 + committedByDay.day2,
          coverage: calculateCoverage(
            demandByDay.day1 + demandByDay.day2,
            committedByDay.day1 + committedByDay.day2
          ),
        },
        {
          label: 'Days 3-5',
          demand: demandByDay.day3 + demandByDay.day4 + demandByDay.day5,
          committed: committedByDay.day3 + committedByDay.day4 + committedByDay.day5,
          coverage: calculateCoverage(
            demandByDay.day3 + demandByDay.day4 + demandByDay.day5,
            committedByDay.day3 + committedByDay.day4 + committedByDay.day5
          ),
        },
        {
          label: 'Days 6-7',
          demand: demandByDay.day6 + demandByDay.day7,
          committed: committedByDay.day6 + committedByDay.day7,
          coverage: calculateCoverage(
            demandByDay.day6 + demandByDay.day7,
            committedByDay.day6 + committedByDay.day7
          ),
        },
      ],
    }

    // Summary metrics
    const totalGap = calculateGap(demandByDay.total, committedByDay.total)
    const gapPercent = calculateCoverage(demandByDay.total, committedByDay.total)
    const avgCoverage =
      demandVsCommitted.demand.reduce((sum, demand, index) => {
        return sum + calculateCoverage(demand, demandVsCommitted.committed[index])
      }, 0) / 7
    const routesAtRisk = topGapContributors.filter((r) => r.coverage < 80).length

    const summary = {
      totalDemand: demandByDay.total,
      totalCommitted: committedByDay.total,
      totalGap,
      gapPercent: 100 - gapPercent,
      avgCoverage,
      routesAtRisk,
    }

    // Generate insights
    const insights = generateInsights({
      demandVsCommitted,
      topGapContributors,
      supplyMix,
      summary,
      cumulativePlanVsCommit,
    })

    return NextResponse.json({
      success: true,
      data: {
        demandVsCommitted,
        capacityUtilization,
        gapHeatmap,
        topGapContributors,
        cumulativePlanVsCommit,
        supplyMix,
        vendorContribution,
        coverageByLeadTime,
        insights,
        summary,
      },
    })
  } catch (error) {
    console.error('Get intelligence data error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    )
  }
}
