'use client'

import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Check, X, Send, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { format, addWeeks } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUpdateSupplyCommitment, useDeleteSupplyCommitment } from '@/hooks/use-supply'
import { usePlanningWeeks } from '@/hooks/use-demand'
import { WEEK_DAYS } from '@/types'
import { formatCitym } from '@/lib/citym'
import { cn } from '@/lib/utils'

const MONTH_WEEKS = [
  { key: 'week1', label: 'Week 1' },
  { key: 'week2', label: 'Week 2' },
  { key: 'week3', label: 'Week 3' },
  { key: 'week4', label: 'Week 4' },
]

interface SupplyTarget {
  routeKey: string
  forecastCount: number
  target: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; week1: number; week2: number; week3: number; week4: number; total: number }
  committed: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; week1: number; week2: number; week3: number; week4: number; total: number }
  gap: { day1: number; day2: number; day3: number; day4: number; day5: number; day6: number; day7: number; week1: number; week2: number; week3: number; week4: number; total: number }
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

interface SupplyTableProps {
  data: SupplyTarget[] | undefined
  isLoading: boolean
  onAddCommitment: (routeKey: string) => void
  onEditCommitment?: (routeKey: string, supplierId: string, supplierName: string) => void
  planningWeekId?: string
  weekStart?: Date | string
  collapsedCities?: Set<string>
  onToggleCity?: (cityName: string) => void
}

export function SupplyTable({ data, isLoading, onAddCommitment, onEditCommitment, planningWeekId, weekStart, collapsedCities: externalCollapsedCities, onToggleCity: externalToggleCity }: SupplyTableProps) {
  const { data: planningWeeksData } = usePlanningWeeks()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; day: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; commitmentId: string; supplierName: string; routeKey: string } | null>(null)
  const updateMutation = useUpdateSupplyCommitment()
  const deleteMutation = useDeleteSupplyCommitment()

  const planningCycle = planningWeeksData?.meta?.planningCycle || 'WEEKLY'
  const isMonthlyPlanning = planningCycle === 'MONTHLY'

  // Track collapsed city groups (use external state if provided, otherwise internal)
  const [internalCollapsedCities, setInternalCollapsedCities] = useState<Set<string>>(new Set())
  const collapsedCities = externalCollapsedCities || internalCollapsedCities

  const toggleCity = (cityName: string) => {
    if (externalToggleCity) {
      externalToggleCity(cityName)
    } else {
      const newCollapsed = new Set(collapsedCities)
      if (newCollapsed.has(cityName)) {
        newCollapsed.delete(cityName)
      } else {
        newCollapsed.add(cityName)
      }
      setInternalCollapsedCities(newCollapsed)
    }
  }

  // Group data by origin city
  const groupedData = useMemo(() => {
    if (!data) return []

    const groups = data.reduce((acc, target) => {
      // Extract origin city from routeKey (format: "CITY1->CITY2")
      const originCity = target.routeKey.split('->')[0] || 'Unknown'

      if (!acc[originCity]) {
        acc[originCity] = []
      }
      acc[originCity].push(target)
      return acc
    }, {} as Record<string, SupplyTarget[]>)

    // Convert to array and sort by city name
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  // Calculate totals for each day across all routes
  const overallDailyTotals = useMemo(() => {
    if (!data) {
      return {
        target: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
        committed: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
        gap: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
      }
    }

    const totals = {
      target: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
      committed: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
      gap: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
    }

    data.forEach((target) => {
      WEEK_DAYS.forEach((_, index) => {
        const key = `day${index + 1}` as 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7'
        totals.target[key] += target.target[key]
        totals.committed[key] += target.committed[key]
        totals.gap[key] += target.gap[key]
      })
      totals.target.total += target.target.total
      totals.committed.total += target.committed.total
      totals.gap.total += target.gap.total
    })

    return totals
  }, [data])

  // Calculate week date ranges for monthly planning
  const weekDateRanges = useMemo(() => {
    if (!isMonthlyPlanning || !planningWeeksData?.data || !planningWeekId) return []

    const selectedWeek = planningWeeksData.data.find(w => w.id === planningWeekId)
    if (!selectedWeek) return []

    const monthStart = new Date(selectedWeek.weekStart)

    return MONTH_WEEKS.map((_, index) => {
      const weekStartDate = addWeeks(monthStart, index)
      const weekEndDate = addWeeks(weekStartDate, 1)
      weekEndDate.setDate(weekEndDate.getDate() - 1)

      return {
        start: format(weekStartDate, 'd'),
        end: format(weekEndDate, 'd')
      }
    })
  }, [isMonthlyPlanning, planningWeeksData, planningWeekId])

  // Calculate dates for each day of the week
  const dayDates = useMemo(() => {
    if (!weekStart) return []

    const startDate = new Date(weekStart)
    return WEEK_DAYS.map((_, index) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + index)
      return format(date, 'dd-MMM')
    })
  }, [weekStart])

  const toggleRow = (routeKey: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(routeKey)) {
      newExpanded.delete(routeKey)
    } else {
      newExpanded.add(routeKey)
    }
    setExpandedRows(newExpanded)
  }

  const handleCellClick = (id: string, day: string, currentValue: number) => {
    setEditingCell({ id, day })
    setEditValue(currentValue.toString())
  }

  const handleSaveEdit = async (id: string, day: string) => {
    const newValue = parseInt(editValue) || 0
    setEditingCell(null)

    try {
      await updateMutation.mutateAsync({
        id,
        [day]: newValue,
      })
      toast.success('Commitment updated')
    } catch (error) {
      toast.error('Failed to update commitment')
    }
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string, day: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit(id, day)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleDeleteCommitment = (id: string, supplierName: string, routeKey: string) => {
    setDeleteDialog({ open: true, commitmentId: id, supplierName, routeKey })
  }

  const handleConfirmDelete = async (deleteAll: boolean) => {
    if (!deleteDialog) return

    try {
      await deleteMutation.mutateAsync({ id: deleteDialog.commitmentId, deleteAll })
      if (deleteAll) {
        toast.success('Commitment deleted for all weeks')
      } else {
        toast.success('Commitment deleted')
      }
    } catch (error) {
      toast.error('Failed to delete commitment')
    } finally {
      setDeleteDialog(null)
    }
  }

  const handleSendToSupplier = (supplierName: string) => {
    toast.warning('🚀 Pro Feature', {
      description: `Send supply plans directly to suppliers with Pro Plan!`,
      duration: 4000,
      action: {
        label: 'Upgrade Now',
        onClick: () => {
          // TODO: Open contact sales modal or redirect to pricing page
          console.log('Upgrade clicked')
        },
      },
    })
  }

  const getGapBadgeVariant = (gap: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (gap > 0) return 'destructive' // Undersupply
    if (gap < 0) return 'secondary' // Oversupply
    return 'outline' // Balanced
  }

  if (isLoading) {
    const columnCount = isMonthlyPlanning ? 4 : 7
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-56 font-semibold">Route</TableHead>
              <TableHead className="w-32 font-semibold">Truck Type</TableHead>
              <TableHead className="w-24 font-semibold">Plan</TableHead>
              {isMonthlyPlanning ? (
                MONTH_WEEKS.map((week) => (
                  <TableHead key={week.key} className="text-center w-20 font-semibold">{week.label}</TableHead>
                ))
              ) : (
                WEEK_DAYS.map((day, index) => (
                  <TableHead key={day.key} className="text-center w-16 font-semibold">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{day.label}</span>
                      {dayDates[index] && (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {dayDates[index]}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))
              )}
              <TableHead className="text-center font-semibold w-20">Total</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 + columnCount }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No demand forecasts for this week yet.</p>
        <p className="text-sm text-muted-foreground mt-1">Add demand forecasts first to see supply targets.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead className="sticky left-0 bg-card w-56 font-semibold">Route</TableHead>
            <TableHead className="w-32 font-semibold">Truck Type</TableHead>
            <TableHead className="w-20 font-semibold text-center">Status</TableHead>
            <TableHead className="w-16 font-semibold text-center">Gap</TableHead>
            <TableHead className="w-24 font-semibold">Plan</TableHead>
            {isMonthlyPlanning ? (
              MONTH_WEEKS.map((week, index) => (
                <TableHead key={week.key} className="text-center w-20 font-semibold">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{week.label}</span>
                    {weekDateRanges[index] && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        days {weekDateRanges[index].start}-{weekDateRanges[index].end}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))
            ) : (
              WEEK_DAYS.map((day, index) => (
                <TableHead key={day.key} className="text-center w-16 font-semibold">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{day.label}</span>
                    {dayDates[index] && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {dayDates[index]}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))
            )}
            <TableHead className="text-center font-semibold w-20">Total</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Total Forecast Row */}
          <TableRow className="bg-slate-100 border-b-2 border-slate-200 font-bold">
            <TableCell></TableCell>
            <TableCell className="sticky left-0 bg-slate-100 text-sm uppercase tracking-wide text-slate-700">
              Total Forecast
            </TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target</TableCell>
            {WEEK_DAYS.map((day, index) => {
              const key = `day${index + 1}` as 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7'
              return (
                <TableCell key={day.key} className="text-center font-bold text-blue-600">
                  {overallDailyTotals.target[key]}
                </TableCell>
              )
            })}
            <TableCell className="text-center font-bold text-blue-600">{overallDailyTotals.target.total}</TableCell>
            <TableCell></TableCell>
          </TableRow>

          {groupedData.flatMap(([originCity, cityTargets]) => {
            // Calculate totals for this city group
            const cityTotals = {
              target: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
              committed: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
              gap: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, total: 0 },
            }

            cityTargets.forEach((target) => {
              WEEK_DAYS.forEach((_, index) => {
                const key = `day${index + 1}` as 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7'
                cityTotals.target[key] += target.target[key]
                cityTotals.committed[key] += target.committed[key]
                cityTotals.gap[key] += target.gap[key]
              })
              cityTotals.target.total += target.target.total
              cityTotals.committed.total += target.committed.total
              cityTotals.gap.total += target.gap.total
            })

            const cityRows: React.ReactElement[] = []

            const isCityCollapsed = collapsedCities.has(originCity)

            // Add city header row with daily totals
            cityRows.push(
              <TableRow key={`city-header-${originCity}`} className="bg-slate-50/80 border-t-2 border-slate-200 hover:bg-slate-100/80 cursor-pointer" onClick={() => toggleCity(originCity)}>
                <TableCell className="py-1.5 px-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-slate-200/50 text-slate-600"
                  >
                    {isCityCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="sticky left-0 bg-slate-50/80 py-1.5 px-4">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {originCity}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-2">
                    ({cityTargets.length} route{cityTargets.length !== 1 ? 's' : ''})
                  </span>
                </TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                {WEEK_DAYS.map((day, index) => {
                  const key = `day${index + 1}` as 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7'
                  const value = cityTotals.target[key]
                  return (
                    <TableCell key={day.key} className={cn(
                      "text-center text-[10px] font-semibold py-1.5",
                      value === 0 ? "text-slate-300" : "text-slate-600"
                    )}>
                      {value === 0 ? '—' : value}
                    </TableCell>
                  )
                })}
                <TableCell className="text-center text-xs font-semibold text-slate-700 py-1.5">
                  {cityTotals.target.total}
                </TableCell>
                <TableCell className="py-1.5"></TableCell>
              </TableRow>
            )

            // Skip rendering routes if city is collapsed
            if (isCityCollapsed) {
              return cityRows
            }

            // Add routes for this city
            cityTargets.forEach((target, targetIndex) => {
            const isExpanded = expandedRows.has(target.routeKey)
            const baseRowIndex = targetIndex * 3

            const rows: React.ReactElement[] = []

            // Target Row
            rows.push(
              <TableRow key={`${target.routeKey}-target`} className="border-t-2 border-border/60 hover:bg-muted/20">
                <TableCell className="py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-muted text-muted-foreground"
                    onClick={() => toggleRow(target.routeKey)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="sticky left-0 bg-white font-medium w-56 max-w-[200px] truncate py-2">
                  {formatCitym(target.routeKey)}
                </TableCell>
                <TableCell className="w-32 py-2">
                  <div className="flex flex-wrap gap-1">
                    {target.truckTypes && target.truckTypes.length > 0 ? (
                      target.truckTypes.map(tt => (
                        <Badge key={tt.id} variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                          {tt.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <Badge
                    variant={target.capacityPercent >= 100 ? "default" : "destructive"}
                    className={cn(
                      "text-[10px] px-2 py-0.5 font-medium",
                      target.capacityPercent >= 100 ? "bg-green-600" : "bg-red-600"
                    )}
                  >
                    {target.capacityPercent >= 100 ? "FILLED" : "AT RISK"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center py-2">
                  <span className={cn(
                    "text-xs font-semibold",
                    target.capacityPercent >= 100 ? "text-green-600" : "text-red-600"
                  )}>
                    {target.capacityPercent >= 100 ? '+' : ''}{target.capacityPercent - 100}%
                  </span>
                </TableCell>
                <TableCell className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 py-2">Target</TableCell>
                {WEEK_DAYS.map((day, index) => {
                  const key = `day${index + 1}` as keyof typeof target.target
                  const value = target.target[key]
                  return (
                    <TableCell key={day.key} className={cn(
                      "text-center py-2",
                      value === 0 ? "text-muted-foreground/30" : "text-foreground font-medium"
                    )}>
                      {value === 0 ? '—' : value}
                    </TableCell>
                  )
                })}
                <TableCell className="text-center font-semibold text-blue-600 py-2">
                  {target.target.total}
                </TableCell>
                <TableCell className="py-2"></TableCell>
              </TableRow>
            )

            // Committed Row
            rows.push(
              <TableRow key={`${target.routeKey}-committed`} className="hover:bg-muted/20 border-b border-border/30">
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="sticky left-0 bg-white py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 py-1.5">Committed</TableCell>
                {WEEK_DAYS.map((day, index) => {
                  const key = `day${index + 1}` as keyof typeof target.committed
                  const value = target.committed[key]
                  return (
                    <TableCell key={day.key} className={cn(
                      "text-center py-1.5",
                      value === 0 ? "text-muted-foreground/30" : "text-green-700 font-medium"
                    )}>
                      {value === 0 ? '—' : value}
                    </TableCell>
                  )
                })}
                <TableCell className="text-center font-semibold text-green-700 py-1.5">
                  {target.committed.total}
                </TableCell>
                <TableCell className="py-1.5">
                  <Button
                    size="sm"
                    className="h-6 gap-1 text-[11px] px-2"
                    onClick={() => onAddCommitment(target.routeKey)}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </TableCell>
              </TableRow>
            )

            // Gap Row
            rows.push(
              <TableRow key={`${target.routeKey}-gap`} className={cn(
                "hover:bg-muted/20",
                // Add border if not expanded
                !isExpanded && "border-b-2 border-border/40"
              )}>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="sticky left-0 bg-white py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="py-1.5"></TableCell>
                <TableCell className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 py-1.5">Gap</TableCell>
                {WEEK_DAYS.map((day, index) => {
                  const key = `day${index + 1}` as keyof typeof target.gap
                  const value = target.gap[key]
                  // Invert display: negative gap (oversupply) shows as positive green, positive gap (undersupply) shows as red
                  const displayValue = -value
                  return (
                    <TableCell
                      key={day.key}
                      className={cn(
                        'text-center py-1.5 text-xs',
                        displayValue > 0 && 'text-green-600 font-medium',
                        displayValue < 0 && 'text-red-600 font-medium',
                        displayValue === 0 && 'text-muted-foreground/30'
                      )}
                    >
                      {displayValue === 0 ? '—' : (displayValue > 0 ? '+' : '')}{displayValue === 0 ? '' : displayValue}
                    </TableCell>
                  )
                })}
                <TableCell
                  className={cn(
                    'text-center py-1.5 text-sm font-semibold',
                    -target.gap.total > 0 && 'text-green-600',
                    -target.gap.total < 0 && 'text-red-600',
                    target.gap.total === 0 && 'text-muted-foreground'
                  )}
                >
                  {-target.gap.total > 0 ? '+' : ''}{-target.gap.total}
                </TableCell>
                <TableCell className="py-1.5"></TableCell>
              </TableRow>
            )

            // Client Breakdown Rows (expandable)
            if (isExpanded && target.clients?.length > 0) {
              // Client header row
              rows.push(
                <TableRow key={`${target.routeKey}-clients-header`} className="bg-blue-50/30 border-t border-blue-200/30">
                  <TableCell className="py-1"></TableCell>
                  <TableCell colSpan={12} className="py-1 px-2">
                    <div className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">
                      Target Breakdown by Client
                    </div>
                  </TableCell>
                </TableRow>
              )

              // Client data rows
              target.clients.forEach((clientData, idx) => {
                const isLastClient = idx === target.clients.length - 1
                const shouldShowBorder = isLastClient && !target.commitments?.length

                rows.push(
                  <TableRow key={`${target.routeKey}-client-${idx}`} className={cn(
                    "bg-blue-50/10 hover:bg-blue-50/20 border-b border-border/20",
                    shouldShowBorder && "border-b-2 border-border/40"
                  )}>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="sticky left-0 bg-blue-50/10 pl-8 text-xs py-1">
                      {clientData.client.name}
                    </TableCell>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="py-1"></TableCell>
                    {WEEK_DAYS.map((day, index) => {
                      const dayKey = `day${index + 1}` as keyof typeof clientData
                      const value = clientData[dayKey] as number
                      return (
                        <TableCell key={day.key} className={cn(
                          "text-center text-xs py-1",
                          value === 0 && "text-muted-foreground/30"
                        )}>
                          {value === 0 ? '—' : value}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center text-xs font-medium text-blue-600 py-1">
                      {clientData.total}
                    </TableCell>
                    <TableCell className="py-1"></TableCell>
                  </TableRow>
                )
              })
            }

            // Supplier Commitment Rows (expandable)
            if (isExpanded && target.commitments?.length > 0) {
              // Commitments header row
              rows.push(
                <TableRow key={`${target.routeKey}-commitments-header`} className="bg-green-50/30 border-t border-green-200/30">
                  <TableCell className="py-1"></TableCell>
                  <TableCell colSpan={12} className="py-1 px-2">
                    <div className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
                      Supplier Commitments
                    </div>
                  </TableCell>
                </TableRow>
              )

              // Commitment data rows
              target.commitments.forEach((commitment, idx) => {
                rows.push(
                  <TableRow
                    key={commitment.id}
                    className={cn(
                      "bg-green-50/10 hover:bg-green-50/20 border-b border-border/20",
                      // Add clear separator to last commitment row
                      idx === target.commitments.length - 1 && "border-b-2 border-border/40"
                    )}
                  >
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="sticky left-0 bg-green-50/10 pl-8 text-xs py-1">
                      {commitment.party.name}
                    </TableCell>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="py-1"></TableCell>
                    <TableCell className="py-1"></TableCell>
                    {WEEK_DAYS.map((day, index) => {
                      const dayKey = `day${index + 1}Committed` as keyof typeof commitment
                      const value = commitment[dayKey] as number
                      const isEditing = editingCell?.id === commitment.id && editingCell?.day === dayKey

                      return (
                        <TableCell key={day.key} className="text-center p-0.5">
                          {isEditing ? (
                            <div className="flex items-center gap-0.5 justify-center">
                              <Input
                                type="number"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, commitment.id, dayKey)}
                                className="h-6 w-12 text-center text-xs border-primary/50 focus:border-primary"
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleSaveEdit(commitment.id, dayKey)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCellClick(commitment.id, dayKey, value)}
                              className={cn(
                                "w-full h-6 hover:bg-green-100 rounded px-1 transition-colors text-xs",
                                value === 0 ? "text-muted-foreground/30" : "font-medium hover:text-green-700"
                              )}
                            >
                              {value === 0 ? '—' : value}
                            </button>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center text-xs font-medium text-green-600 py-1">{commitment.totalCommitted}</TableCell>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-0.5">
                        {onEditCommitment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => onEditCommitment(target.routeKey, commitment.party.id, commitment.party.name)}
                            title="Edit commitment"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCommitment(commitment.id, commitment.party.name, target.routeKey)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            }

            cityRows.push(...rows)
          })

          // Add city totals row
          cityRows.push(
            <TableRow key={`city-total-${originCity}-target`} className="bg-slate-100/60 hover:bg-slate-100/80 border-t border-slate-200">
              <TableCell className="py-1"></TableCell>
              <TableCell className="sticky left-0 bg-slate-100/60 text-[11px] uppercase text-slate-700 font-bold py-1">
                {originCity} Total
              </TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 py-1">Target</TableCell>
              {WEEK_DAYS.map((day, index) => {
                const key = `day${index + 1}` as keyof typeof cityTotals.target
                const value = cityTotals.target[key]
                return (
                  <TableCell key={day.key} className={cn(
                    "text-center text-xs font-semibold py-1",
                    value === 0 ? "text-slate-300" : "text-blue-600"
                  )}>
                    {value === 0 ? '—' : value}
                  </TableCell>
                )
              })}
              <TableCell className="text-center font-semibold text-sm text-blue-600 py-1">{cityTotals.target.total}</TableCell>
              <TableCell className="py-1"></TableCell>
            </TableRow>,
            <TableRow key={`city-total-${originCity}-committed`} className="bg-slate-100/60 hover:bg-slate-100/80 border-b border-slate-200/50">
              <TableCell className="py-1"></TableCell>
              <TableCell className="sticky left-0 bg-slate-100/60 py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 py-1">Committed</TableCell>
              {WEEK_DAYS.map((day, index) => {
                const key = `day${index + 1}` as keyof typeof cityTotals.committed
                const value = cityTotals.committed[key]
                return (
                  <TableCell key={day.key} className={cn(
                    "text-center text-xs font-semibold py-1",
                    value === 0 ? "text-slate-300" : "text-green-700"
                  )}>
                    {value === 0 ? '—' : value}
                  </TableCell>
                )
              })}
              <TableCell className="text-center font-semibold text-sm text-green-700 py-1">{cityTotals.committed.total}</TableCell>
              <TableCell className="py-1"></TableCell>
            </TableRow>,
            <TableRow key={`city-total-${originCity}-gap`} className="bg-slate-100/60 hover:bg-slate-100/80 border-b-2 border-slate-300">
              <TableCell className="py-1"></TableCell>
              <TableCell className="sticky left-0 bg-slate-100/60 py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="py-1"></TableCell>
              <TableCell className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 py-1">Gap</TableCell>
              {WEEK_DAYS.map((day, index) => {
                const key = `day${index + 1}` as keyof typeof cityTotals.gap
                const value = cityTotals.gap[key]
                const displayValue = -value
                return (
                  <TableCell
                    key={day.key}
                    className={cn(
                      'text-center text-xs font-semibold py-1',
                      displayValue > 0 && 'text-green-600',
                      displayValue < 0 && 'text-red-600',
                      displayValue === 0 && 'text-slate-300'
                    )}
                  >
                    {displayValue === 0 ? '—' : (displayValue > 0 ? '+' : '')}{displayValue === 0 ? '' : displayValue}
                  </TableCell>
                )
              })}
              <TableCell
                className={cn(
                  'text-center font-semibold text-sm py-1',
                  -cityTotals.gap.total > 0 && 'text-green-600',
                  -cityTotals.gap.total < 0 && 'text-red-600',
                  cityTotals.gap.total === 0 && 'text-slate-400'
                )}
              >
                {-cityTotals.gap.total > 0 ? '+' : ''}{-cityTotals.gap.total}
              </TableCell>
              <TableCell className="py-1"></TableCell>
            </TableRow>
          )

          return cityRows
        })}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog?.open || false} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supply Commitment</DialogTitle>
            <DialogDescription>
              Delete commitment from <strong>{deleteDialog?.supplierName}</strong> for route <strong>{deleteDialog?.routeKey}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Would you like to delete this commitment for the current week only, or for all weeks in this planning cycle?
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleConfirmDelete(false)}>
              Delete Current Week Only
            </Button>
            <Button variant="destructive" onClick={() => handleConfirmDelete(true)}>
              Delete All Weeks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
