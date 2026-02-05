'use client'

import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { useDeleteSupplyCommitment } from '@/hooks/use-supply'
import { WEEK_DAYS } from '@/types'
import { formatCitym } from '@/lib/citym'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SupplyTarget {
  routeKey: string
  forecastCount: number
  target: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
  committed: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
  gap: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; total: number }
  gapPercent: number
  capacityPercent: number
  truckTypes?: Array<{ id: string; name: string }>
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
    day1Committed: number
    day2Committed: number
    day3Committed: number
    day4Committed: number
    day5Committed: number
    day6Committed: number
    day7Committed: number
    totalCommitted: number
  }>
}

interface SupplyTableEnhancedProps {
  data: SupplyTarget[] | undefined
  isLoading: boolean
  onAddCommitment: (routeKey: string) => void
  onEditCommitment?: (routeKey: string, supplierId: string, supplierName: string) => void
  planningWeekId?: string
  weekStart?: Date | string
}

function getDayLabel(weekStart: string | Date | undefined, dayIndex: number): string {
  if (!weekStart) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]

  const date = new Date(weekStart)
  date.setDate(date.getDate() + dayIndex)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthDay = `${date.getDate()}-${date.toLocaleString('default', { month: 'short' })}`
  return `${dayNames[date.getDay()]}\n${monthDay}`
}

function getCellColor(dayTarget: number, dayCommitted: number): string {
  if (dayTarget === 0) return ''

  const capacityPercent = (dayCommitted / dayTarget) * 100

  if (capacityPercent >= 100) return 'bg-green-50 border-green-200'
  if (capacityPercent >= 80) return 'bg-amber-50 border-amber-200'
  if (capacityPercent >= 50) return 'bg-orange-50 border-orange-200'
  return 'bg-red-50 border-red-200'
}

function getTextColor(dayTarget: number, dayCommitted: number): string {
  if (dayTarget === 0) return 'text-gray-400'

  const capacityPercent = (dayCommitted / dayTarget) * 100

  if (capacityPercent >= 100) return 'text-green-700'
  if (capacityPercent >= 80) return 'text-amber-700'
  if (capacityPercent >= 50) return 'text-orange-700'
  return 'text-red-700'
}

// Group routes by city (first part before ->)
function groupByCity(data: SupplyTarget[]): Record<string, SupplyTarget[]> {
  return data.reduce((acc, target) => {
    const city = target.routeKey.split('->')[0] || 'Unknown'
    if (!acc[city]) acc[city] = []
    acc[city].push(target)
    return acc
  }, {} as Record<string, SupplyTarget[]>)
}

export function SupplyTableEnhanced({
  data,
  isLoading,
  onAddCommitment,
  onEditCommitment,
  planningWeekId,
  weekStart,
}: SupplyTableEnhancedProps) {
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set())
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const deleteMutation = useDeleteSupplyCommitment()

  const groupedData = useMemo(() => {
    if (!data) return []
    const groups = groupByCity(data)
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const toggleRoute = (routeKey: string) => {
    const newExpanded = new Set(expandedRoutes)
    if (newExpanded.has(routeKey)) {
      newExpanded.delete(routeKey)
    } else {
      newExpanded.add(routeKey)
    }
    setExpandedRoutes(newExpanded)
  }

  const toggleCity = (city: string) => {
    const newExpanded = new Set(expandedCities)
    if (newExpanded.has(city)) {
      newExpanded.delete(city)
    } else {
      newExpanded.add(city)
    }
    setExpandedCities(newExpanded)
  }

  const handleDeleteCommitment = async (id: string, supplierName: string) => {
    if (!confirm(`Delete commitment from ${supplierName}?`)) return
    try {
      await deleteMutation.mutateAsync({ id, deleteAll: false })
      toast.success('Commitment deleted')
    } catch (error) {
      toast.error('Failed to delete commitment')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No supply targets found for this week</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Overall Summary */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Total Forecast
            </h3>
            <div className="flex gap-8">
              {WEEK_DAYS.map((day, idx) => {
                const key = `day${idx + 1}` as 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7'
                const total = data.reduce((sum, t) => sum + t.target[key], 0)
                if (total === 0) return null
                return (
                  <div key={day.key} className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">{day.label}</div>
                    <div className="text-lg font-bold text-blue-600">{total}</div>
                  </div>
                )
              })}
              <div className="text-center pl-4 border-l">
                <div className="text-xs text-muted-foreground mb-1">Total</div>
                <div className="text-xl font-bold text-blue-600">
                  {data.reduce((sum, t) => sum + t.target.total, 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {groupedData.map(([city, cityRoutes]) => {
          const isCityExpanded = expandedCities.has(city)

          // Calculate city totals
          const cityTotals = cityRoutes.reduce(
            (acc, route) => ({
              target: acc.target + route.target.total,
              committed: acc.committed + route.committed.total,
            }),
            { target: 0, committed: 0 }
          )
          const cityCapacityPercent = cityTotals.target > 0
            ? Math.round((cityTotals.committed / cityTotals.target) * 100)
            : 0

          return (
            <div key={city} className="space-y-2">
              {/* City Header */}
              <div
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors',
                  cityCapacityPercent >= 100 ? 'bg-green-50 border-green-200 hover:bg-green-100' :
                  cityCapacityPercent >= 80 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' :
                  'bg-red-50 border-red-200 hover:bg-red-100'
                )}
                onClick={() => toggleCity(city)}
              >
                <div className="flex items-center gap-3">
                  {isCityExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{city}</h3>
                    <p className="text-sm text-muted-foreground">
                      {cityRoutes.length} route{cityRoutes.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className={cn(
                      'text-2xl font-bold',
                      cityCapacityPercent >= 100 ? 'text-green-700' :
                      cityCapacityPercent >= 80 ? 'text-amber-700' :
                      'text-red-700'
                    )}>
                      {cityTotals.committed}/{cityTotals.target}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {cityCapacityPercent}% capacity
                    </div>
                  </div>
                  <div className="w-32">
                    <Progress value={Math.min(cityCapacityPercent, 100)} className="h-2" />
                  </div>
                </div>
              </div>

              {/* City Routes */}
              {isCityExpanded && (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="w-[200px]">Route</TableHead>
                        <TableHead className="w-[150px]">Truck Types</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 0).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 1).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 2).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 3).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 4).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 5).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center">{getDayLabel(weekStart, 6).replace('\n', ' ')}</TableHead>
                        <TableHead className="text-center font-semibold">Total</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cityRoutes.map((target) => {
                        const isExpanded = expandedRoutes.has(target.routeKey)
                        const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const

                        return (
                          <>
                            {/* Main Route Row */}
                            <TableRow key={target.routeKey} className="hover:bg-muted/30">
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => toggleRoute(target.routeKey)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCitym(target.routeKey)}
                                {target.clients.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {target.clients.length} client{target.clients.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {target.truckTypes && target.truckTypes.length > 0 ? (
                                    target.truckTypes.map((tt) => (
                                      <Badge key={tt.id} variant="secondary" className="text-xs">
                                        {tt.name}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Daily Cells with Committed/Target */}
                              {days.map((day, idx) => {
                                const dayTarget = target.target[day]
                                const dayCommitted = target.committed[day]
                                const dayGap = target.gap[day]

                                if (dayTarget === 0 && dayCommitted === 0) {
                                  return (
                                    <TableCell key={day} className="text-center">
                                      <span className="text-gray-300">—</span>
                                    </TableCell>
                                  )
                                }

                                const capacityPercent = dayTarget > 0 ? Math.round((dayCommitted / dayTarget) * 100) : 0

                                return (
                                  <TableCell key={day} className="p-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={cn(
                                            'flex flex-col items-center justify-center p-2 rounded border min-h-[50px] cursor-help',
                                            getCellColor(dayTarget, dayCommitted)
                                          )}
                                        >
                                          <div className={cn('text-sm font-semibold', getTextColor(dayTarget, dayCommitted))}>
                                            {dayCommitted}/{dayTarget}
                                          </div>
                                          {dayTarget > 0 && (
                                            <div className="w-full mt-1">
                                              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                  className={cn(
                                                    'h-full',
                                                    capacityPercent >= 100 ? 'bg-green-500' :
                                                    capacityPercent >= 80 ? 'bg-amber-500' :
                                                    capacityPercent >= 50 ? 'bg-orange-500' :
                                                    'bg-red-500'
                                                  )}
                                                  style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="space-y-1">
                                          <div className="font-semibold">{getDayLabel(weekStart, idx).replace('\n', ' ')}</div>
                                          <div>Target: {dayTarget}</div>
                                          <div>Committed: {dayCommitted}</div>
                                          <div>Gap: {dayGap > 0 ? `+${dayGap}` : dayGap}</div>
                                          {dayTarget > 0 && <div>Capacity: {capacityPercent}%</div>}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                )
                              })}

                              {/* Total Cell */}
                              <TableCell className="p-1">
                                <div
                                  className={cn(
                                    'flex flex-col items-center justify-center p-2 rounded border min-h-[50px] font-semibold',
                                    getCellColor(target.target.total, target.committed.total)
                                  )}
                                >
                                  <div className={cn('text-base', getTextColor(target.target.total, target.committed.total))}>
                                    {target.committed.total}/{target.target.total}
                                  </div>
                                  <div className="w-full mt-1">
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={cn(
                                          'h-full',
                                          target.capacityPercent >= 100 ? 'bg-green-500' :
                                          target.capacityPercent >= 80 ? 'bg-amber-500' :
                                          target.capacityPercent >= 50 ? 'bg-orange-500' :
                                          'bg-red-500'
                                        )}
                                        style={{ width: `${Math.min(target.capacityPercent, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Status Badge */}
                              <TableCell className="text-center">
                                <Badge
                                  variant={target.capacityPercent >= 100 ? 'default' : 'destructive'}
                                  className={cn(
                                    'font-semibold',
                                    target.capacityPercent >= 100 ? 'bg-green-600' : 'bg-red-600'
                                  )}
                                >
                                  {target.capacityPercent >= 100 ? 'FILLED' : 'AT RISK'}
                                </Badge>
                                <div className={cn(
                                  'text-xs font-medium mt-1',
                                  target.capacityPercent >= 100 ? 'text-green-600' : 'text-red-600'
                                )}>
                                  {target.capacityPercent >= 100 ? '+' : ''}{target.capacityPercent - 100}%
                                </div>
                              </TableCell>

                              {/* Actions */}
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => onAddCommitment(target.routeKey)}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={13} className="bg-muted/20 p-6">
                                  <div className="grid grid-cols-2 gap-6">
                                    {/* Clients */}
                                    {target.clients.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-3 text-sm">
                                          Clients ({target.clients.length})
                                        </h4>
                                        <div className="space-y-2">
                                          {target.clients.map((client) => (
                                            <div
                                              key={client.client.id}
                                              className="flex justify-between items-center p-3 rounded bg-background border"
                                            >
                                              <span className="text-sm font-medium">{client.client.name}</span>
                                              <span className="text-sm text-muted-foreground">{client.total} units</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Suppliers */}
                                    {target.commitments.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-3 text-sm">
                                          Suppliers ({target.commitments.length})
                                        </h4>
                                        <div className="space-y-2">
                                          {target.commitments.map((commitment) => (
                                            <div
                                              key={commitment.id}
                                              className="flex justify-between items-center p-3 rounded bg-background border group hover:border-primary/50"
                                            >
                                              <div className="flex-1">
                                                <span className="text-sm font-medium">{commitment.party.name}</span>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  {commitment.totalCommitted} units committed
                                                </div>
                                              </div>
                                              <div className="flex gap-1">
                                                {onEditCommitment && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEditCommitment(target.routeKey, commitment.party.id, commitment.party.name)}
                                                  >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleDeleteCommitment(commitment.id, commitment.party.name)}
                                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
