import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Check if organization is suspended
  if (session.user.currentOrgId) {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.currentOrgId },
      select: {
        status: true,
        suspendedReason: true,
      },
    })

    if (org?.status === 'SUSPENDED') {
      const reason = encodeURIComponent(org.suspendedReason || 'Your organization has been suspended')
      redirect(`/suspended?reason=${reason}`)
    }
  }

  return <AppShell user={session.user}>{children}</AppShell>
}
