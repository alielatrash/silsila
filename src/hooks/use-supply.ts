'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface SupplyTarget {
  routeKey: string
  forecastCount: number
  target: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; week1: number; week2: number; week3: number; week4: number; total: number }
  committed: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; week1: number; week2: number; week3: number; week4: number; total: number }
  gap: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; week1: number; week2: number; week3: number; week4: number; total: number }
  gapPercent: number
  clients: Array<{
    client: { id: string; name: string; code: string | null }
    day1: number
    day2: number
    day3: number
    day4: number
    day5: number
    day6: number
    day7: number
    total: number
  }>
  commitments: Array<{
    id: string
    party: { id: string; name: string; code: string | null }
    day1: number
    day2: number
    day3: number
    day4: number
    day5: number
    day6: number
    day7: number
    total: number
  }>
}

// Supply Targets (aggregated demand by CITYm)
export function useSupplyTargets(planningWeekId?: string) {
  return useQuery({
    queryKey: ['supplyTargets', planningWeekId],
    queryFn: async (): Promise<{ success: boolean; data: SupplyTarget[] }> => {
      const response = await fetch(`/api/supply/targets?planningWeekId=${planningWeekId}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch supply targets')
      return response.json()
    },
    enabled: !!planningWeekId,
  })
}

interface CreateSupplyCommitmentInput {
  planningWeekId: string
  supplierId: string
  routeKey: string
  truckTypeId?: string
  day1Committed?: number
  day2Committed?: number
  day3Committed?: number
  day4Committed?: number
  day5Committed?: number
  day6Committed?: number
  day7Committed?: number
}

export function useCreateSupplyCommitment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateSupplyCommitmentInput) => {
      const response = await fetch('/api/supply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplyTargets', variables.planningWeekId] })
    },
  })
}

interface UpdateSupplyCommitmentInput {
  id: string
  day1Committed?: number
  day2Committed?: number
  day3Committed?: number
  day4Committed?: number
  day5Committed?: number
  day6Committed?: number
  day7Committed?: number
}

export function useUpdateSupplyCommitment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSupplyCommitmentInput) => {
      const response = await fetch(`/api/supply/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    // Optimistic update: update cache immediately before API call
    onMutate: async ({ id, ...updates }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['supplyTargets'] })

      // Snapshot the previous value for rollback
      const previousTargets = queryClient.getQueryData(['supplyTargets'])

      // Optimistically update the cache
      queryClient.setQueriesData({ queryKey: ['supplyTargets'] }, (old: any) => {
        if (!old?.data) return old

        return {
          ...old,
          data: old.data.map((target: any) => {
            // Find the commitment that was updated
            const updatedCommitments = target.commitments.map((c: any) => {
              if (c.id !== id) return c

              // Apply the updates to this commitment
              const updated = { ...c }
              Object.keys(updates).forEach((key) => {
                // Map API field names (e.g., day1Committed) to display field names (e.g., day1)
                const displayKey = key.replace('Committed', '')
                updated[displayKey] = updates[key as keyof typeof updates]
              })

              // Recalculate total
              updated.total = updated.day1 + updated.day2 + updated.day3 + updated.day4 + updated.day5 + updated.day6 + updated.day7

              return updated
            })

            // Recalculate committed totals for this route
            const committed = {
              day1: 0,
              day2: 0,
              day3: 0,
              day4: 0,
              day5: 0,
              day6: 0,
              day7: 0,
              total: 0,
            }

            updatedCommitments.forEach((c: any) => {
              committed.day1 += c.day1
              committed.day2 += c.day2
              committed.day3 += c.day3
              committed.day4 += c.day4
              committed.day5 += c.day5
              committed.day6 += c.day6
              committed.day7 += c.day7
              committed.total += c.total
            })

            // Recalculate gap
            const gap = {
              day1: target.target.day1 - committed.day1,
              day2: target.target.day2 - committed.day2,
              day3: target.target.day3 - committed.day3,
              day4: target.target.day4 - committed.day4,
              day5: target.target.day5 - committed.day5,
              day6: target.target.day6 - committed.day6,
              day7: target.target.day7 - committed.day7,
              total: target.target.total - committed.total,
            }

            const gapPercent = target.target.total > 0
              ? Math.round((gap.total / target.target.total) * 100)
              : 0

            return {
              ...target,
              commitments: updatedCommitments,
              committed,
              gap,
              gapPercent,
            }
          }),
        }
      })

      // Return context with snapshot for rollback
      return { previousTargets }
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousTargets) {
        queryClient.setQueryData(['supplyTargets'], context.previousTargets)
      }
    },
    // Refetch to ensure consistency after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['supplyTargets'] })
    },
  })
}

export function useDeleteSupplyCommitment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/supply/${id}`, { method: 'DELETE', credentials: 'include' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    // Optimistic update: remove commitment from cache immediately
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['supplyTargets'] })

      // Snapshot the previous value for rollback
      const previousTargets = queryClient.getQueryData(['supplyTargets'])

      // Optimistically update the cache
      queryClient.setQueriesData({ queryKey: ['supplyTargets'] }, (old: any) => {
        if (!old?.data) return old

        return {
          ...old,
          data: old.data.map((target: any) => {
            // Remove the deleted commitment
            const updatedCommitments = target.commitments.filter((c: any) => c.id !== id)

            // Recalculate committed totals for this route
            const committed = {
              day1: 0,
              day2: 0,
              day3: 0,
              day4: 0,
              day5: 0,
              day6: 0,
              day7: 0,
              total: 0,
            }

            updatedCommitments.forEach((c: any) => {
              committed.day1 += c.day1
              committed.day2 += c.day2
              committed.day3 += c.day3
              committed.day4 += c.day4
              committed.day5 += c.day5
              committed.day6 += c.day6
              committed.day7 += c.day7
              committed.total += c.total
            })

            // Recalculate gap
            const gap = {
              day1: target.target.day1 - committed.day1,
              day2: target.target.day2 - committed.day2,
              day3: target.target.day3 - committed.day3,
              day4: target.target.day4 - committed.day4,
              day5: target.target.day5 - committed.day5,
              day6: target.target.day6 - committed.day6,
              day7: target.target.day7 - committed.day7,
              total: target.target.total - committed.total,
            }

            const gapPercent = target.target.total > 0
              ? Math.round((gap.total / target.target.total) * 100)
              : 0

            return {
              ...target,
              commitments: updatedCommitments,
              committed,
              gap,
              gapPercent,
            }
          }),
        }
      })

      // Return context with snapshot for rollback
      return { previousTargets }
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousTargets) {
        queryClient.setQueryData(['supplyTargets'], context.previousTargets)
      }
    },
    // Refetch to ensure consistency after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['supplyTargets'] })
    },
  })
}

// Dispatch Sheet types
interface DispatchRoute {
  routeKey: string
  plan: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
}

interface DispatchSupplier {
  supplierId: string
  supplierName: string
  supplierCode: string | null
  routes: DispatchRoute[]
  totals: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
}

interface DispatchCustomerRoute {
  routeKey: string
  demand: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
  suppliers: Array<{
    supplierId: string
    supplierName: string
    plan: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
  }>
}

interface DispatchCustomer {
  customerId: string
  customerName: string
  routes: DispatchCustomerRoute[]
  totals: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
}

interface DispatchData {
  suppliers: DispatchSupplier[]
  customers: DispatchCustomer[]
  grandTotals: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
}

export function useDispatchSheet(planningWeekId?: string) {
  return useQuery({
    queryKey: ['dispatchSheet', planningWeekId],
    queryFn: async (): Promise<{ success: boolean; data: DispatchData }> => {
      const response = await fetch(`/api/supply/dispatch?planningWeekId=${planningWeekId}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch dispatch data')
      return response.json()
    },
    enabled: !!planningWeekId,
  })
}

export type { DispatchSupplier, DispatchRoute, DispatchCustomer, DispatchCustomerRoute, DispatchData }
