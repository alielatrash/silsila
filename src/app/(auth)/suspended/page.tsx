import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function SuspendedContent({ searchParams }: { searchParams: { reason?: string } }) {
  const reason = searchParams.reason || 'Your organization has been suspended. Please contact support for more information.'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Organization Suspended</CardTitle>
          <CardDescription>
            Your organization's access has been temporarily suspended
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact our support team:
            </p>
            <Button asChild className="w-full">
              <a href="mailto:support@teamtakt.app">
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
          </div>

          <div className="text-center">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Return to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const params = await searchParams

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuspendedContent searchParams={params} />
    </Suspense>
  )
}
