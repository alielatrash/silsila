'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Building2,
  Activity,
  Shield,
  Ban,
  CheckCircle,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

export default function UserDetailPage({ params }: { params: { userId: string } }) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [disableReason, setDisableReason] = useState('')

  useEffect(() => {
    fetchUser()
  }, [params.userId])

  async function fetchUser() {
    setLoading(true)
    try {
      const response = await fetch(`/api/superadmin/users/${params.userId}`)
      const data = await response.json()

      if (data.success) {
        setUser(data.data.user)
        setRecentActivity(data.data.recentActivity || [])
      } else {
        toast.error(data.error.message || 'Failed to fetch user')
      }
    } catch (error) {
      toast.error('Failed to fetch user')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableUser() {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/users/${params.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          reason: disableReason,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('User disabled successfully')
        fetchUser()
        setDisableReason('')
      } else {
        toast.error(data.error.message || 'Failed to disable user')
      }
    } catch (error) {
      toast.error('Failed to disable user')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEnableUser() {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/users/${params.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('User enabled successfully')
        fetchUser()
      } else {
        toast.error(data.error.message || 'Failed to enable user')
      }
    } catch (error) {
      toast.error('Failed to enable user')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteUser() {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/users/${params.userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deleteReason,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('User deleted successfully')
        router.push('/superadmin/users')
      } else {
        toast.error(data.error.message || 'Failed to delete user')
      }
    } catch (error) {
      toast.error('Failed to delete user')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-gray-500 mb-4">User not found</div>
        <Link href="/superadmin/users">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/superadmin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.isActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={actionLoading}>
                  <Ban className="mr-2 h-4 w-4" />
                  Disable User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disable User</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will prevent the user from logging in and invalidate all their sessions.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <label className="text-sm font-medium mb-2 block">
                    Reason (optional)
                  </label>
                  <Textarea
                    placeholder="Enter reason for disabling this user..."
                    value={disableReason}
                    onChange={(e) => setDisableReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisableUser}>
                    Disable User
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" onClick={handleEnableUser} disabled={actionLoading}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Enable User
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={actionLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the user account,
                  all their organization memberships, sessions, and related data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <label className="text-sm font-medium mb-2 block">
                  Reason (optional)
                </label>
                <Textarea
                  placeholder="Enter reason for deleting this user..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteUser}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2">
        <Badge variant={user.isActive ? 'default' : 'destructive'}>
          {user.isActive ? 'Active' : 'Disabled'}
        </Badge>
        <Badge variant="secondary">{user.role}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="text-sm text-gray-900 flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-gray-400" />
                {user.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Mobile Number</label>
              <p className="text-sm text-gray-900 mt-1">
                {user.mobileNumber || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Role</label>
              <p className="text-sm text-gray-900 flex items-center gap-2 mt-1">
                <Shield className="h-4 w-4 text-gray-400" />
                {user.role}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Joined</label>
              <p className="text-sm text-gray-900 flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-400" />
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Activity</label>
              <p className="text-sm text-gray-900 mt-1">
                {user.lastActivityAt
                  ? new Date(user.lastActivityAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Demand Forecasts</label>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {user._count.demandForecasts}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Supply Commitments</label>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {user._count.supplyCommitments}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Audit Logs</label>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {user._count.auditLogs}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Active Sessions</label>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {user.sessions?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Memberships */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Memberships
          </CardTitle>
          <CardDescription>
            Organizations this user belongs to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.organizationMemberships.length === 0 ? (
            <p className="text-sm text-gray-500">No organization memberships</p>
          ) : (
            <div className="space-y-2">
              {user.organizationMemberships.map((membership: any) => (
                <Link
                  key={membership.id}
                  href={`/superadmin/organizations/${membership.organization.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {membership.organization.name}
                        </p>
                        <Badge variant={membership.organization.status === 'ACTIVE' ? 'default' : 'destructive'}>
                          {membership.organization.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {membership.role} • {membership.organization.subscriptionTier}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest actions performed by this user
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.slice(0, 20).map((activity: any) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  <Activity className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.eventType}
                    </p>
                    {activity.organization && (
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.organization.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
