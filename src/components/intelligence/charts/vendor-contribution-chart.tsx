'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface VendorContributionChartProps {
  data?: {
    days: string[]
    demand: number[]
    suppliers: Array<{
      name: string
      data: number[]
    }>
  }
  isLoading?: boolean
  height?: number
}

const COLORS = [
  'hsl(221, 83%, 53%)', // Blue
  'hsl(142, 76%, 36%)', // Green
  'hsl(48, 96%, 53%)', // Yellow
  'hsl(25, 95%, 53%)', // Orange
  'hsl(262, 83%, 58%)', // Purple
  'hsl(173, 80%, 40%)', // Teal
]

export function VendorContributionChart({
  data,
  isLoading,
  height = 350,
}: VendorContributionChartProps) {
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
  const chartData = data.days.map((day, index) => {
    const dataPoint: any = { day, demand: data.demand[index] }
    data.suppliers.forEach((supplier) => {
      dataPoint[supplier.name] = supplier.data[index]
    })
    return dataPoint
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
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
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          iconType="rect"
          formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
        />

        {/* Stacked bars for each supplier */}
        {data.suppliers.map((supplier, index) => (
          <Bar
            key={supplier.name}
            dataKey={supplier.name}
            stackId="suppliers"
            fill={COLORS[index % COLORS.length]}
            radius={index === data.suppliers.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}

        {/* Line for total demand */}
        <Line
          dataKey="demand"
          stroke="hsl(0, 0%, 20%)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: 'hsl(0, 0%, 20%)', r: 4 }}
          name="Target Demand"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
