'use client'

import { useQuery } from '@tanstack/react-query'
import type { Insight, RouteMetrics, SupplierContribution } from '@/lib/intelligence-metrics'

export interface IntelligenceFilters {
  plannerIds?: string[]
  clientIds?: string[]
  categoryIds?: string[]
  truckTypeIds?: string[]
  routeKeys?: string[]
}

interface IntelligenceData {
  demandVsCommitted: {
    days: string[]
    demand: number[]
    committed: number[]
    gap: number[]
  }
  capacityUtilization: {
    days: string[]
    utilization: number[]
    threshold: number
  }
  gapHeatmap: {
    routes: string[]
    days: string[]
    data: Array<{ route: string; day: string; gap: number; gapPercent: number }>
  }
  topGapContributors: RouteMetrics[]
  cumulativePlanVsCommit: {
    days: string[]
    cumulativeDemand: number[]
    cumulativeCommitted: number[]
  }
  supplyMix: {
    suppliers: SupplierContribution[]
    trend: {
      days: string[]
      topSupplierShare: number[]
    }
  }
  vendorContribution: {
    days: string[]
    demand: number[]
    suppliers: Array<{
      name: string
      data: number[]
    }>
  }
  coverageByLeadTime: {
    buckets: Array<{
      label: string
      demand: number
      committed: number
      coverage: number
    }>
  }
  insights: Insight[]
  summary: {
    totalDemand: number
    totalCommitted: number
    totalGap: number
    gapPercent: number
    avgCoverage: number
    routesAtRisk: number
  }
}

interface IntelligenceResponse {
  success: boolean
  data: IntelligenceData
}

/**
 * Hook to fetch aggregated intelligence data for all charts
 */
export function useIntelligenceData(
  planningWeekId?: string,
  filters?: IntelligenceFilters
) {
  return useQuery({
    queryKey: ['intelligence', planningWeekId, filters],
    queryFn: async (): Promise<IntelligenceResponse> => {
      const params = new URLSearchParams()
      if (planningWeekId) params.append('planningWeekId', planningWeekId)

      // Add filters
      if (filters?.plannerIds && filters.plannerIds.length > 0) {
        filters.plannerIds.forEach((id) => params.append('plannerIds', id))
      }
      if (filters?.clientIds && filters.clientIds.length > 0) {
        filters.clientIds.forEach((id) => params.append('clientIds', id))
      }
      if (filters?.categoryIds && filters.categoryIds.length > 0) {
        filters.categoryIds.forEach((id) => params.append('categoryIds', id))
      }
      if (filters?.truckTypeIds && filters.truckTypeIds.length > 0) {
        filters.truckTypeIds.forEach((id) => params.append('truckTypeIds', id))
      }
      if (filters?.routeKeys && filters.routeKeys.length > 0) {
        filters.routeKeys.forEach((key) => params.append('routeKeys', key))
      }

      const response = await fetch(`/api/intelligence?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to fetch intelligence data')

      return response.json()
    },
    enabled: !!planningWeekId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch unique routes for the route filter
 */
export function useRoutes(planningWeekId?: string) {
  return useQuery({
    queryKey: ['routes', planningWeekId],
    queryFn: async (): Promise<{ success: boolean; data: Array<{ value: string; label: string }> }> => {
      const response = await fetch(
        `/api/demand?planningWeekId=${planningWeekId}&page=1&pageSize=1000`,
        {
          credentials: 'include',
        }
      )

      if (!response.ok) throw new Error('Failed to fetch routes')

      const result = await response.json()

      // Extract unique routes from demand forecasts
      const uniqueRoutes = new Set<string>()
      if (result.data) {
        result.data.forEach((forecast: any) => {
          if (forecast.routeKey) {
            uniqueRoutes.add(forecast.routeKey)
          }
        })
      }

      // Convert to options format
      const routes = Array.from(uniqueRoutes)
        .sort()
        .map((routeKey) => ({
          value: routeKey,
          label: routeKey,
        }))

      return { success: true, data: routes }
    },
    enabled: !!planningWeekId,
    staleTime: 10 * 60 * 1000, // 10 minutes (routes don't change often)
  })
}

export type { IntelligenceData, IntelligenceResponse }
