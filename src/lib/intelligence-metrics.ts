// Intelligence Metrics Calculation Utilities

export interface Insight {
  type: 'warning' | 'success' | 'info' | 'critical'
  title: string
  description: string
}

export interface SupplierContribution {
  supplierId: string
  supplierName: string
  contribution: number
  percentage: number
}

export interface DailyMetrics {
  days: string[]
  demand: number[]
  committed: number[]
  gap: number[]
  coverage: number[]
}

export interface RouteMetrics {
  route: string
  demand: number
  committed: number
  gap: number
  coverage: number
}

/**
 * Calculate coverage percentage
 * @param demand - Total demand
 * @param committed - Total committed
 * @returns Coverage percentage (0-100+)
 */
export function calculateCoverage(demand: number, committed: number): number {
  if (demand === 0) return 0
  return Math.round((committed / demand) * 100 * 10) / 10 // Round to 1 decimal
}

/**
 * Calculate gap (unmet demand)
 * @param demand - Total demand
 * @param committed - Total committed
 * @returns Gap in trucks (always >= 0)
 */
export function calculateGap(demand: number, committed: number): number {
  return Math.max(demand - committed, 0)
}

/**
 * Calculate gap percentage
 * @param demand - Total demand
 * @param committed - Total committed
 * @returns Gap percentage (0-100)
 */
export function calculateGapPercent(demand: number, committed: number): number {
  if (demand === 0) return 0
  const gap = calculateGap(demand, committed)
  return Math.round((gap / demand) * 100 * 10) / 10 // Round to 1 decimal
}

/**
 * Compute cumulative sum of an array
 * @param values - Array of numbers
 * @returns Array of cumulative sums
 */
export function computeCumulative(values: number[]): number[] {
  const cumulative: number[] = []
  let sum = 0
  for (const value of values) {
    sum += value
    cumulative.push(sum)
  }
  return cumulative
}

/**
 * Group suppliers by their contribution
 * @param commitments - Array of commitments with supplier info
 * @returns Array of supplier contributions sorted by contribution descending
 */
export function groupSuppliersByContribution(
  commitments: Array<{
    party: { id: string; name: string }
    totalCommitted: number
  }>
): SupplierContribution[] {
  const supplierMap = new Map<string, { name: string; contribution: number }>()

  // Aggregate by supplier
  for (const commitment of commitments) {
    const supplierId = commitment.party.id
    const existing = supplierMap.get(supplierId)
    if (existing) {
      existing.contribution += commitment.totalCommitted
    } else {
      supplierMap.set(supplierId, {
        name: commitment.party.name,
        contribution: commitment.totalCommitted,
      })
    }
  }

  // Calculate total for percentages
  const totalContribution = Array.from(supplierMap.values()).reduce(
    (sum, s) => sum + s.contribution,
    0
  )

  // Convert to array and add percentages
  const suppliers: SupplierContribution[] = Array.from(supplierMap.entries())
    .map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.name,
      contribution: data.contribution,
      percentage:
        totalContribution > 0
          ? Math.round((data.contribution / totalContribution) * 100 * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.contribution - a.contribution) // Sort by contribution descending

  return suppliers
}

/**
 * Calculate Herfindahl-Hirschman Index for supplier concentration
 * @param suppliers - Array of supplier contributions with percentages
 * @returns HHI value (0-10000, higher = more concentrated)
 */
export function calculateConcentrationIndex(suppliers: SupplierContribution[]): number {
  // HHI = sum of squared market shares (as percentages)
  const hhi = suppliers.reduce((sum, supplier) => {
    return sum + supplier.percentage ** 2
  }, 0)
  return Math.round(hhi)
}

/**
 * Generate insights based on intelligence data
 */
export function generateInsights(data: {
  demandVsCommitted: {
    days: string[]
    demand: number[]
    committed: number[]
    gap: number[]
  }
  topGapContributors: RouteMetrics[]
  supplyMix: {
    suppliers: SupplierContribution[]
  }
  summary: {
    totalDemand: number
    totalCommitted: number
    totalGap: number
    gapPercent: number
    avgCoverage: number
    routesAtRisk: number
  }
  cumulativePlanVsCommit: {
    days: string[]
    cumulativeDemand: number[]
    cumulativeCommitted: number[]
  }
}): Insight[] {
  const insights: Insight[] = []

  // 1. Find worst coverage day
  if (data.demandVsCommitted.days.length > 0) {
    let worstDay = { day: '', coverage: 100, index: 0, gap: 0 }
    for (let i = 0; i < data.demandVsCommitted.days.length; i++) {
      const demand = data.demandVsCommitted.demand[i]
      const committed = data.demandVsCommitted.committed[i]
      const gap = data.demandVsCommitted.gap[i]
      const coverage = demand > 0 ? (committed / demand) * 100 : 100
      if (coverage < worstDay.coverage) {
        worstDay = { day: data.demandVsCommitted.days[i], coverage, index: i, gap }
      }
    }

    if (worstDay.coverage < 85) {
      insights.push({
        type: 'warning',
        title: `Low Coverage on ${worstDay.day}`,
        description: `${worstDay.day} has the lowest coverage at ${worstDay.coverage.toFixed(1)}% (gap: ${worstDay.gap} trucks). Consider increasing commitments.`,
      })
    }
  }

  // 2. Top gap contributor
  if (data.topGapContributors.length > 0) {
    const topGap = data.topGapContributors[0]
    if (topGap.gap > 0 && data.summary.totalGap > 0) {
      const gapShare = (topGap.gap / data.summary.totalGap) * 100
      insights.push({
        type: 'info',
        title: 'Top Gap Route',
        description: `${topGap.route} accounts for ${gapShare.toFixed(0)}% of total gap (${topGap.gap} trucks needed, ${topGap.coverage.toFixed(1)}% covered).`,
      })
    }
  }

  // 3. Supplier concentration risk
  if (data.supplyMix.suppliers.length > 0) {
    const topSupplierShare = data.supplyMix.suppliers[0].percentage
    if (topSupplierShare > 50) {
      insights.push({
        type: 'warning',
        title: 'High Supplier Concentration',
        description: `Top supplier (${data.supplyMix.suppliers[0].supplierName}) provides ${topSupplierShare.toFixed(0)}% of capacity. Consider diversifying for resilience.`,
      })
    }

    // Check top 3 concentration
    const top3Share = data.supplyMix.suppliers
      .slice(0, 3)
      .reduce((sum, s) => sum + s.percentage, 0)
    if (top3Share > 80 && data.supplyMix.suppliers.length > 3) {
      insights.push({
        type: 'info',
        title: 'Limited Supplier Diversity',
        description: `Top 3 suppliers control ${top3Share.toFixed(0)}% of capacity. Building relationships with additional suppliers could reduce risk.`,
      })
    }
  }

  // 4. Routes at risk
  if (data.summary.routesAtRisk > 0) {
    insights.push({
      type: data.summary.routesAtRisk > 5 ? 'critical' : 'warning',
      title: 'Routes Below Coverage Target',
      description: `${data.summary.routesAtRisk} route${data.summary.routesAtRisk > 1 ? 's have' : ' has'} coverage below 80%. Review top gap contributors for prioritization.`,
    })
  }

  // 5. Overall coverage status
  if (data.summary.avgCoverage >= 95) {
    insights.push({
      type: 'success',
      title: 'Excellent Coverage',
      description: `Average coverage is ${data.summary.avgCoverage.toFixed(1)}%, meeting target goals across most routes.`,
    })
  } else if (data.summary.avgCoverage < 80) {
    insights.push({
      type: 'critical',
      title: 'Coverage Below Target',
      description: `Average coverage is only ${data.summary.avgCoverage.toFixed(1)}%. Urgent action needed to secure additional capacity.`,
    })
  }

  // 6. Cumulative trend analysis (catching up vs falling behind)
  if (data.cumulativePlanVsCommit.days.length > 2) {
    const firstDayGap =
      data.cumulativePlanVsCommit.cumulativeDemand[0] -
      data.cumulativePlanVsCommit.cumulativeCommitted[0]
    const lastDayGap =
      data.cumulativePlanVsCommit.cumulativeDemand[
        data.cumulativePlanVsCommit.days.length - 1
      ] -
      data.cumulativePlanVsCommit.cumulativeCommitted[
        data.cumulativePlanVsCommit.days.length - 1
      ]

    if (lastDayGap > firstDayGap * 1.2) {
      // Gap widening by >20%
      insights.push({
        type: 'warning',
        title: 'Falling Behind on Commitments',
        description: `Cumulative gap is widening through the week. Focus on securing commitments for later days.`,
      })
    } else if (lastDayGap < firstDayGap * 0.8 && firstDayGap > 0) {
      // Gap narrowing by >20%
      insights.push({
        type: 'success',
        title: 'Catching Up on Coverage',
        description: `Cumulative gap is narrowing through the week, indicating improving coverage in later days.`,
      })
    }
  }

  // Return max 6 insights
  return insights.slice(0, 6)
}
