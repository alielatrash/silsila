import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
}

export function ChartCard({ title, description, className, children }: ChartCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <CardHeader className="px-0 pt-0 pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0 pb-0">{children}</CardContent>
    </Card>
  )
}
