'use client'

import { Fragment } from 'react'

interface GapHeatmapChartProps {
  data?: {
    routes: string[]
    days: string[]
    data: Array<{ route: string; day: string; gap: number; gapPercent: number }>
  }
  isLoading?: boolean
  height?: number
}

export function GapHeatmapChart({ data, isLoading, height = 400 }: GapHeatmapChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!data || data.routes.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Get color based on gap percentage
  const getColor = (gapPercent: number) => {
    if (gapPercent === 0) return 'bg-green-100 border-green-200'
    if (gapPercent < 10) return 'bg-green-50 border-green-100'
    if (gapPercent < 20) return 'bg-yellow-50 border-yellow-200'
    if (gapPercent < 30) return 'bg-orange-100 border-orange-200'
    if (gapPercent < 50) return 'bg-red-100 border-red-200'
    return 'bg-red-200 border-red-300'
  }

  const getTextColor = (gapPercent: number) => {
    if (gapPercent === 0) return 'text-green-700'
    if (gapPercent < 10) return 'text-green-600'
    if (gapPercent < 20) return 'text-yellow-700'
    if (gapPercent < 30) return 'text-orange-700'
    if (gapPercent < 50) return 'text-red-600'
    return 'text-red-800'
  }

  // Show top 10 routes only for readability
  const topRoutes = data.routes.slice(0, 10)

  return (
    <div className="overflow-auto" style={{ maxHeight: height }}>
      <div className="inline-block min-w-full">
        <div className="grid gap-1" style={{ gridTemplateColumns: `150px repeat(${data.days.length}, 80px)` }}>
          {/* Header row */}
          <div className="font-semibold text-sm p-2 bg-muted sticky left-0 z-10">Route</div>
          {data.days.map((day) => (
            <div key={day} className="font-semibold text-sm p-2 text-center bg-muted">
              {day}
            </div>
          ))}

          {/* Data rows */}
          {topRoutes.map((route) => (
            <Fragment key={route}>
              <div className="text-sm p-2 bg-background sticky left-0 z-10 font-medium truncate" title={route}>
                {route}
              </div>
              {data.days.map((day) => {
                const cell = data.data.find((d) => d.route === route && d.day === day)
                const gap = cell?.gap || 0
                const gapPercent = cell?.gapPercent || 0

                return (
                  <div
                    key={`${route}-${day}`}
                    className={`text-sm p-2 text-center border ${getColor(gapPercent)} ${getTextColor(gapPercent)} flex flex-col items-center justify-center`}
                    title={`${route} - ${day}\nGap: ${gap} trucks (${gapPercent.toFixed(1)}%)`}
                  >
                    <div className="font-semibold">{gap}</div>
                    {gap > 0 && <div className="text-xs">{gapPercent.toFixed(0)}%</div>}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {data.routes.length > 10 && (
        <div className="text-sm text-muted-foreground mt-2 text-center">
          Showing top 10 of {data.routes.length} routes
        </div>
      )}
    </div>
  )
}
