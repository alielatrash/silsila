'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { RouteMetrics } from '@/lib/intelligence-metrics'

interface TopGapContributorsChartProps {
  data?: RouteMetrics[]
  isLoading?: boolean
  height?: number
}

export function TopGapContributorsChart({
  data,
  isLoading,
  height = 350,
}: TopGapContributorsChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Show top 10 routes
  const topRoutes = data.slice(0, 10)

  // Color gradient based on gap size
  const getColor = (gap: number, maxGap: number) => {
    const intensity = gap / maxGap
    if (intensity > 0.7) return 'hsl(0, 84%, 60%)' // Red for high gap
    if (intensity > 0.4) return 'hsl(25, 95%, 53%)' // Orange for medium gap
    return 'hsl(48, 96%, 53%)' // Yellow for lower gap
  }

  const maxGap = Math.max(...topRoutes.map((r) => r.gap))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={topRoutes}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 150, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickLine={{ stroke: 'hsl(var(--border))' }}
          label={{ value: 'Gap (Trucks)', position: 'insideBottom', offset: -5, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          type="category"
          dataKey="route"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickLine={{ stroke: 'hsl(var(--border))' }}
          width={140}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
          }}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null
            const data = payload[0].payload as RouteMetrics
            return (
              <div className="rounded-lg border bg-popover p-3 shadow-md">
                <p className="font-semibold mb-2">{data.route}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Demand:</span>
                    <span className="font-medium">{data.demand}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Committed:</span>
                    <span className="font-medium">{data.committed}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Gap:</span>
                    <span className="font-medium">{data.gap}</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-1 border-t">
                    <span className="text-muted-foreground">Coverage:</span>
                    <span className="font-medium">{data.coverage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )
          }}
        />
        <Bar dataKey="gap" radius={[0, 4, 4, 0]}>
          {topRoutes.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.gap, maxGap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
