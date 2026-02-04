'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface CumulativePlanChartProps {
  data?: {
    days: string[]
    cumulativeDemand: number[]
    cumulativeCommitted: number[]
  }
  isLoading?: boolean
  height?: number
}

export function CumulativePlanChart({ data, isLoading, height = 300 }: CumulativePlanChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!data || data.days.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Transform data for Recharts
  const chartData = data.days.map((day, index) => ({
    day,
    demand: data.cumulativeDemand[index],
    committed: data.cumulativeCommitted[index],
    gap: data.cumulativeDemand[index] - data.cumulativeCommitted[index],
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCommitted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickLine={{ stroke: 'hsl(var(--border))' }}
          label={{ value: 'Cumulative Trucks', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
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
                <p className="font-semibold mb-2">{data.day}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Cumulative Demand:</span>
                    <span className="font-medium">{data.demand}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Cumulative Committed:</span>
                    <span className="font-medium">{data.committed}</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-1 border-t">
                    <span className="text-muted-foreground">Cumulative Gap:</span>
                    <span className="font-medium">{data.gap}</span>
                  </div>
                </div>
              </div>
            )
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          iconType="line"
          formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
        />
        <Area
          type="monotone"
          dataKey="demand"
          stroke="hsl(221, 83%, 53%)"
          strokeWidth={2}
          fill="url(#colorDemand)"
          name="Cumulative Demand"
        />
        <Area
          type="monotone"
          dataKey="committed"
          stroke="hsl(142, 76%, 36%)"
          strokeWidth={2}
          fill="url(#colorCommitted)"
          name="Cumulative Committed"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
