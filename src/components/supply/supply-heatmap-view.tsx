'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
  truckTypes: Array<{ id: string; name: string }>
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

interface SupplyHeatmapViewProps {
  data?: SupplyTarget[]
  isLoading?: boolean
  onAddCommitment: (routeKey: string) => void
  onEditCommitment: (routeKey: string, supplierId: string, supplierName: string) => void
  planningWeekId: string
  weekStart?: string
}

// Helper to get heatmap color based on capacity percentage
function getHeatmapColor(dayTarget: number, dayCommitted: number): string {
  if (dayTarget === 0) return 'bg-gray-50 text-gray-400'

  const capacityPercent = (dayCommitted / dayTarget) * 100

  if (capacityPercent >= 100) return 'bg-green-100 text-green-900 border-green-300'
  if (capacityPercent >= 80) return 'bg-amber-100 text-amber-900 border-amber-300'
  if (capacityPercent >= 50) return 'bg-orange-100 text-orange-900 border-orange-300'
  return 'bg-red-100 text-red-900 border-red-300'
}

// Helper to get intensity for heatmap (darker = worse gap)
function getHeatmapIntensity(dayTarget: number, dayCommitted: number): string {
  if (dayTarget === 0) return 'bg-gray-100'

  const capacityPercent = (dayCommitted / dayTarget) * 100

  if (capacityPercent >= 100) return 'bg-green-500'
  if (capacityPercent >= 80) return 'bg-amber-400'
  if (capacityPercent >= 50) return 'bg-orange-500'
  return 'bg-red-600'
}

// Helper to get day label from date
function getDayLabel(weekStart: string | undefined, dayIndex: number): string {
  if (!weekStart) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]

  const date = new Date(weekStart)
  date.setDate(date.getDate() + dayIndex)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`
  return `${dayNames[date.getDay()]} ${monthDay}`
}

// Group routes by city (first part of routeKey before hyphen)
function groupByCity(data: SupplyTarget[]): Record<string, SupplyTarget[]> {
  return data.reduce((acc, target) => {
    const city = target.routeKey.split('-')[0] || 'Unknown'
    if (!acc[city]) acc[city] = []
    acc[city].push(target)
    return acc
  }, {} as Record<string, SupplyTarget[]>)
}

export function SupplyHeatmapView({
  data,
  isLoading,
  onAddCommitment,
  onEditCommitment,
  planningWeekId,
  weekStart,
}: SupplyHeatmapViewProps) {
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
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

  const groupedData = groupByCity(data)
  const cities = Object.keys(groupedData).sort()

  const toggleCity = (city: string) => {
    const newExpanded = new Set(expandedCities)
    if (newExpanded.has(city)) {
      newExpanded.delete(city)
    } else {
      newExpanded.add(city)
    }
    setExpandedCities(newExpanded)
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Legend */}
        <div className="flex items-center gap-6 p-4 rounded-lg border bg-muted/30">
          <span className="text-sm font-medium">Capacity Legend:</span>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-green-500 border"></div>
              <span className="text-sm">100%+</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-amber-400 border"></div>
              <span className="text-sm">80-99%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-orange-500 border"></div>
              <span className="text-sm">50-79%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-red-600 border"></div>
              <span className="text-sm">&lt;50%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gray-100 border"></div>
              <span className="text-sm">No demand</span>
            </div>
          </div>
        </div>

        {cities.map((city) => {
          const cityRoutes = groupedData[city]

          return (
            <div key={city} className="space-y-2">
              {/* City Header */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <h3 className="font-semibold text-lg">{city}</h3>
                <span className="text-sm text-muted-foreground">
                  {cityRoutes.length} route{cityRoutes.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Heatmap Table */}
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Route</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 0)}</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 1)}</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 2)}</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 3)}</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 4)}</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 5)}</TableHead>
                      <TableHead className="text-center">{getDayLabel(weekStart, 6)}</TableHead>
                      <TableHead className="text-center font-semibold">Total</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cityRoutes.map((target) => {
                      const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const

                      return (
                        <TableRow key={target.routeKey} className="hover:bg-muted/30">
                          <TableCell className="font-medium">
                            <div>
                              <div>{target.routeKey}</div>
                              {target.truckTypes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {target.truckTypes.map((tt) => (
                                    <Badge key={tt.id} variant="outline" className="text-xs py-0">
                                      {tt.name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Daily Heatmap Cells */}
                          {days.map((day, idx) => {
                            const dayTarget = target.target[day]
                            const dayCommitted = target.committed[day]
                            const dayGap = target.gap[day]
                            const capacityPercent = dayTarget > 0 ? Math.round((dayCommitted / dayTarget) * 100) : 0

                            return (
                              <TableCell key={day} className="p-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`flex flex-col items-center justify-center p-2 rounded border ${getHeatmapColor(dayTarget, dayCommitted)} min-h-[60px] cursor-help`}
                                    >
                                      <div className="text-sm font-semibold">
                                        {dayCommitted}/{dayTarget}
                                      </div>
                                      {dayTarget > 0 && (
                                        <div className="text-xs mt-1">
                                          {capacityPercent}%
                                        </div>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <div className="font-semibold">{getDayLabel(weekStart, idx)}</div>
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

                          {/* Total Column */}
                          <TableCell className="p-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex flex-col items-center justify-center p-2 rounded border font-semibold ${getHeatmapColor(target.target.total, target.committed.total)} min-h-[60px] cursor-help`}
                                >
                                  <div className="text-sm">
                                    {target.committed.total}/{target.target.total}
                                  </div>
                                  <div className="text-xs mt-1">
                                    {target.capacityPercent}%
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <div className="font-semibold">Weekly Total</div>
                                  <div>Target: {target.target.total}</div>
                                  <div>Committed: {target.committed.total}</div>
                                  <div>Gap: {target.gap.total > 0 ? `+${target.gap.total}` : target.gap.total}</div>
                                  <div>Capacity: {target.capacityPercent}%</div>
                                  {target.commitments.length > 0 && (
                                    <>
                                      <div className="border-t pt-1 mt-2 font-semibold">Suppliers:</div>
                                      {target.commitments.map((c) => (
                                        <div key={c.id}>
                                          {c.party.name}: {c.totalCommitted}
                                        </div>
                                      ))}
                                    </>
                                  )}
                                  {target.clients.length > 0 && (
                                    <>
                                      <div className="border-t pt-1 mt-2 font-semibold">Clients:</div>
                                      {target.clients.map((cl) => (
                                        <div key={cl.client.id}>
                                          {cl.client.name}: {cl.total}
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onAddCommitment(target.routeKey)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
