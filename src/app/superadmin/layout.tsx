import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isPlatformAdmin } from '@/lib/platform-admin'
import Link from 'next/link'
import { Activity, BarChart3, Building2, FileText, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

const navigation = [
  { name: 'Dashboard', href: '/superadmin', icon: BarChart3 },
  { name: 'Organizations', href: '/superadmin/organizations', icon: Building2 },
  { name: 'Users', href: '/superadmin/users', icon: Users },
  { name: 'Activity', href: '/superadmin/activity', icon: Activity },
  { name: 'Audit Log', href: '/superadmin/audit', icon: FileText },
]

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Check if user is platform admin
  const isAdmin = await isPlatformAdmin()
  if (!isAdmin) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-gray-200 px-6">
            <h1 className="text-xl font-bold text-gray-900">Platform Admin</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
                {session.user.firstName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.user.firstName} {session.user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">Platform Admin</p>
              </div>
            </div>
            <Link
              href="/"
              className="mt-3 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to App
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
