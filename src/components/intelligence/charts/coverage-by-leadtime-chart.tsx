'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Progress } from '@/components/ui/progress'

interface CoverageByLeadTimeChartProps {
  data?: {
    buckets: Array<{
      label: string
      demand: number
      committed: number
      coverage: number
    }>
  }
  isLoading?: boolean
  height?: number
}

export function CoverageByLeadTimeChart({
  data,
  isLoading,
  height = 300,
}: CoverageByLeadTimeChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!data || data.buckets.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Get coverage color
  const getCoverageColor = (coverage: number) => {
    if (coverage >= 95) return 'text-green-600'
    if (coverage >= 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressColor = (coverage: number) => {
    if (coverage >= 95) return 'bg-green-600'
    if (coverage >= 80) return 'bg-yellow-600'
    return 'bg-red-600'
  }

  return (
    <div className="flex flex-col gap-6" style={{ height }}>
      {/* Option: KPI Tiles */}
      <div className="grid grid-cols-3 gap-4">
        {data.buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{bucket.label}</h4>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold">{bucket.demand}</span>
                <span className="text-sm text-muted-foreground">trucks needed</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Committed:</span>
                <span className="font-semibold">{bucket.committed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gap:</span>
                <span className="font-semibold">{bucket.demand - bucket.committed}</span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-muted-foreground">Coverage</span>
                  <span className={`text-lg font-bold ${getCoverageColor(bucket.coverage)}`}>
                    {bucket.coverage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(bucket.coverage)} transition-all`}
                    style={{ width: `${Math.min(bucket.coverage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Option: Grouped Bar Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            label={{ value: 'Trucks', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
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
              const data = payload[0].payload
              return (
                <div className="rounded-lg border bg-popover p-3 shadow-md">
                  <p className="font-semibold mb-2">{data.label}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Demand:</span>
                      <span className="font-medium">{data.demand}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Committed:</span>
                      <span className="font-medium">{data.committed}</span>
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
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="rect"
            formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
          />
          <Bar dataKey="demand" fill="hsl(221, 83%, 53%)" name="Demand" radius={[4, 4, 0, 0]} />
          <Bar dataKey="committed" fill="hsl(142, 76%, 36%)" name="Committed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
