'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { WeekSelector } from '@/components/demand/week-selector'
import { IntelligenceFiltersComponent } from '@/components/intelligence/intelligence-filters'
import { IntelligenceInsights } from '@/components/intelligence/intelligence-insights'
import { ChartCard } from '@/components/intelligence/chart-card'
import { DemandVsCommittedChart } from '@/components/intelligence/charts/demand-vs-committed-chart'
import { CapacityUtilizationChart } from '@/components/intelligence/charts/capacity-utilization-chart'
import { GapHeatmapChart } from '@/components/intelligence/charts/gap-heatmap-chart'
import { TopGapContributorsChart } from '@/components/intelligence/charts/top-gap-contributors-chart'
import { CumulativePlanChart } from '@/components/intelligence/charts/cumulative-plan-chart'
import { SupplyMixChart } from '@/components/intelligence/charts/supply-mix-chart'
import { VendorContributionChart } from '@/components/intelligence/charts/vendor-contribution-chart'
import { CoverageByLeadTimeChart } from '@/components/intelligence/charts/coverage-by-leadtime-chart'
import { usePlanningWeeks } from '@/hooks/use-demand'
import { useIntelligenceData, type IntelligenceFilters } from '@/hooks/use-intelligence'

export default function IntelligencePage() {
  const [selectedWeekId, setSelectedWeekId] = useState<string>()
  const [filters, setFilters] = useState<IntelligenceFilters>({
    plannerIds: [],
    supplyPlannerIds: [],
    clientIds: [],
    categoryIds: [],
    truckTypeIds: [],
    routeKeys: [],
  })

  const { data: weeksData } = usePlanningWeeks()
  const { data: intelligenceData, isLoading } = useIntelligenceData(selectedWeekId, filters)

  // Auto-select week: first try localStorage, then fall back to current week
  useEffect(() => {
    if (weeksData?.data?.length && !selectedWeekId) {
      const savedWeekId = localStorage.getItem('selectedPlanningWeekId')
      // Check if saved week exists in available weeks
      const savedWeekExists = savedWeekId && weeksData.data.some(w => w.id === savedWeekId)
      setSelectedWeekId(savedWeekExists ? savedWeekId : weeksData.data[0].id)
    }
  }, [weeksData, selectedWeekId])

  const handleWeekChange = (weekId: string | undefined) => {
    setSelectedWeekId(weekId)
    // Save to localStorage for persistence across pages
    if (weekId) {
      localStorage.setItem('selectedPlanningWeekId', weekId)
    }
    // Reset filters when week changes
    setFilters({
      plannerIds: [],
      supplyPlannerIds: [],
      clientIds: [],
      categoryIds: [],
      truckTypeIds: [],
      routeKeys: [],
    })
  }

  return (
    <div>
      <PageHeader
        title="Intelligence"
        description="Supply and demand analytics and insights"
      >
        <WeekSelector value={selectedWeekId} onValueChange={handleWeekChange} />
      </PageHeader>

      {/* Filters */}
      {selectedWeekId && (
        <div className="pt-0 pb-6">
          <IntelligenceFiltersComponent
            planningWeekId={selectedWeekId}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      )}

      {selectedWeekId && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Demand</p>
              <p className="text-2xl font-bold text-blue-600">
                {intelligenceData?.data?.summary?.totalDemand ?? 0}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Committed</p>
              <p className="text-2xl font-bold text-green-600">
                {intelligenceData?.data?.summary?.totalCommitted ?? 0}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Gap</p>
              <p className="text-2xl font-bold text-red-600">
                {intelligenceData?.data?.summary?.totalGap ?? 0}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Avg Coverage</p>
              <p className="text-2xl font-bold">
                {intelligenceData?.data?.summary?.avgCoverage?.toFixed(1) ?? 0}%
              </p>
            </div>
          </div>

          {/* Insights Section */}
          <IntelligenceInsights
            insights={intelligenceData?.data?.insights}
            className="mb-6"
          />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Demand vs Committed vs Gap (Full Width) */}
            <ChartCard
              title="Demand vs Committed vs Gap"
              description="Daily comparison of demand, commitments, and gaps"
              className="lg:col-span-2"
            >
              <DemandVsCommittedChart
                data={intelligenceData?.data?.demandVsCommitted}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 2: Capacity Utilization */}
            <ChartCard
              title="Coverage by Day"
              description="Daily coverage percentage with target thresholds"
            >
              <CapacityUtilizationChart
                data={intelligenceData?.data?.capacityUtilization}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 3: Gap Heatmap */}
            <ChartCard
              title="Gap Heatmap"
              description="Route-level gaps across the week"
            >
              <GapHeatmapChart
                data={intelligenceData?.data?.gapHeatmap}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 4: Top Gap Contributors (Full Width) */}
            <ChartCard
              title="Top Gap Contributors"
              description="Routes with the highest unmet demand"
              className="lg:col-span-2"
            >
              <TopGapContributorsChart
                data={intelligenceData?.data?.topGapContributors}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 5: Cumulative Plan */}
            <ChartCard
              title="Cumulative Plan vs Commit"
              description="S-curve showing cumulative demand and commitments"
            >
              <CumulativePlanChart
                data={intelligenceData?.data?.cumulativePlanVsCommit}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 6: Supply Mix */}
            <ChartCard
              title="Supply Mix & Concentration"
              description="Supplier contribution and concentration risk"
            >
              <SupplyMixChart
                data={intelligenceData?.data?.supplyMix}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 7: Vendor Contribution (Full Width) */}
            <ChartCard
              title="Vendor Contribution by Day"
              description="Daily supplier commitments vs total demand"
              className="lg:col-span-2"
            >
              <VendorContributionChart
                data={intelligenceData?.data?.vendorContribution}
                isLoading={isLoading}
              />
            </ChartCard>

            {/* Chart 8: Coverage by Lead Time (Full Width) */}
            <ChartCard
              title="Coverage by Lead Time"
              description="Coverage analysis by planning horizon"
              className="lg:col-span-2"
            >
              <CoverageByLeadTimeChart
                data={intelligenceData?.data?.coverageByLeadTime}
                isLoading={isLoading}
              />
            </ChartCard>
          </div>
        </>
      )}

      {!selectedWeekId && (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Select a planning week to view intelligence data</p>
        </div>
      )}
    </div>
  )
}
