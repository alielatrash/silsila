import { AlertCircle, CheckCircle, Info, AlertTriangle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight } from '@/lib/intelligence-metrics'

interface IntelligenceInsightsProps {
  insights?: Insight[]
  className?: string
}

export function IntelligenceInsights({ insights, className }: IntelligenceInsightsProps) {
  if (!insights || insights.length === 0) return null

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      case 'critical':
        return <AlertCircle className="h-4 w-4" />
      case 'info':
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getStyles = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900'
    }
  }

  const getIconColor = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
      case 'info':
      default:
        return 'text-blue-600'
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold">Key Insights</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={cn(
              'relative rounded-lg border p-4 transition-all hover:shadow-md',
              getStyles(insight.type)
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5 flex-shrink-0', getIconColor(insight.type))}>
                {getIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold mb-1 leading-tight">{insight.title}</h4>
                <p className="text-xs leading-relaxed opacity-90">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
