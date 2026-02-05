'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
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

interface SupplyCompactViewProps {
  data?: SupplyTarget[]
  isLoading?: boolean
  onAddCommitment: (routeKey: string) => void
  onEditCommitment: (routeKey: string, supplierId: string, supplierName: string) => void
  planningWeekId: string
  weekStart?: string
}

// Helper to get color based on gap percentage
function getGapColor(gapPercent: number, capacityPercent: number): string {
  if (capacityPercent >= 100) return 'text-green-600'
  if (capacityPercent >= 80) return 'text-amber-600'
  return 'text-red-600'
}

function getGapBgColor(gapPercent: number, capacityPercent: number): string {
  if (capacityPercent >= 100) return 'bg-green-50 border-green-200'
  if (capacityPercent >= 80) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

// Helper to get day label from date
function getDayLabel(weekStart: string | undefined, dayIndex: number): string {
  if (!weekStart) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]

  const date = new Date(weekStart)
  date.setDate(date.getDate() + dayIndex)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return dayNames[date.getDay()]
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

export function SupplyCompactView({
  data,
  isLoading,
  onAddCommitment,
  onEditCommitment,
  planningWeekId,
  weekStart,
}: SupplyCompactViewProps) {
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set())
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())

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

  const groupedData = groupByCity(data)
  const cities = Object.keys(groupedData).sort()

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

  return (
    <div className="space-y-6">
      {cities.map((city) => {
        const cityRoutes = groupedData[city]
        const isCityExpanded = expandedCities.has(city)

        // Calculate city totals
        const cityTotals = cityRoutes.reduce(
          (acc, route) => ({
            target: acc.target + route.target.total,
            committed: acc.committed + route.committed.total,
            gap: acc.gap + route.gap.total,
          }),
          { target: 0, committed: 0, gap: 0 }
        )
        const cityCapacityPercent = cityTotals.target > 0
          ? Math.round((cityTotals.committed / cityTotals.target) * 100)
          : 0

        return (
          <div key={city} className="space-y-2">
            {/* City Header */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer ${getGapBgColor(0, cityCapacityPercent)}`}
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
                  <div className={`text-2xl font-bold ${getGapColor(0, cityCapacityPercent)}`}>
                    {cityTotals.committed}/{cityTotals.target}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {cityCapacityPercent}% capacity
                  </div>
                </div>
              </div>
            </div>

            {/* City Routes Table */}
            {isCityExpanded && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Truck Types</TableHead>
                      <TableHead className="text-right">Committed/Target</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cityRoutes.map((target) => {
                      const isExpanded = expandedRoutes.has(target.routeKey)
                      const colorClass = getGapColor(target.gapPercent, target.capacityPercent)

                      return (
                        <>
                          {/* Main Row */}
                          <TableRow key={target.routeKey} className="hover:bg-muted/50">
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
                              {target.routeKey}
                              {target.clients.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {target.clients.length} client{target.clients.length !== 1 ? 's' : ''}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {target.truckTypes.map((tt) => (
                                  <Badge key={tt.id} variant="secondary" className="text-xs">
                                    {tt.name}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`text-lg font-semibold ${colorClass}`}>
                                {target.committed.total}/{target.target.total}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={target.capacityPercent >= 100 ? 'default' : target.capacityPercent >= 80 ? 'secondary' : 'destructive'}
                              >
                                {target.capacityPercent}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${colorClass}`}>
                                {target.gap.total > 0 ? `+${target.gap.total}` : target.gap.total}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAddCommitment(target.routeKey)}
                              >
                                <Plus className="h-4 w-4" />
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 p-6">
                                <div className="grid grid-cols-2 gap-6">
                                  {/* Daily Breakdown */}
                                  <div>
                                    <h4 className="font-semibold mb-3">Daily Breakdown</h4>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Day</TableHead>
                                          <TableHead className="text-right">Target</TableHead>
                                          <TableHead className="text-right">Committed</TableHead>
                                          <TableHead className="text-right">Gap</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const).map((day, idx) => {
                                          const dayTarget = target.target[day]
                                          const dayCommitted = target.committed[day]
                                          const dayGap = target.gap[day]
                                          if (dayTarget === 0 && dayCommitted === 0) return null

                                          return (
                                            <TableRow key={day}>
                                              <TableCell className="font-medium">
                                                {getDayLabel(weekStart, idx)}
                                              </TableCell>
                                              <TableCell className="text-right">{dayTarget}</TableCell>
                                              <TableCell className="text-right">{dayCommitted}</TableCell>
                                              <TableCell className="text-right">
                                                <span className={dayGap > 0 ? 'text-red-600' : dayGap < 0 ? 'text-amber-600' : ''}>
                                                  {dayGap > 0 ? `+${dayGap}` : dayGap}
                                                </span>
                                              </TableCell>
                                            </TableRow>
                                          )
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {/* Client & Supplier Breakdown */}
                                  <div className="space-y-4">
                                    {/* Clients */}
                                    {target.clients.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-3">Clients ({target.clients.length})</h4>
                                        <div className="space-y-2">
                                          {target.clients.map((client) => (
                                            <div key={client.client.id} className="flex justify-between items-center p-2 rounded bg-background border">
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
                                        <h4 className="font-semibold mb-3">Suppliers ({target.commitments.length})</h4>
                                        <div className="space-y-2">
                                          {target.commitments.map((commitment) => (
                                            <div
                                              key={commitment.id}
                                              className="flex justify-between items-center p-2 rounded bg-background border cursor-pointer hover:bg-muted/50"
                                              onClick={() => onEditCommitment(target.routeKey, commitment.party.id, commitment.party.name)}
                                            >
                                              <span className="text-sm font-medium">{commitment.party.name}</span>
                                              <span className="text-sm text-muted-foreground">{commitment.totalCommitted} units</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
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
  )
}
