'use client'

import { useState, useEffect, use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Building2, Users, Activity, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function OrganizationDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const resolvedParams = use(params)
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [newTier, setNewTier] = useState('')

  useEffect(() => {
    fetchOrganization()
  }, [])

  async function fetchOrganization() {
    setLoading(true)
    try {
      const response = await fetch(`/api/superadmin/organizations/${resolvedParams.orgId}`)
      const data = await response.json()

      if (data.success) {
        setOrg(data.data.organization)
        setNewTier(data.data.organization.subscriptionTier)
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error)
      toast.error('Failed to load organization')
    } finally {
      setLoading(false)
    }
  }

  async function handleSuspend() {
    if (!suspendReason.trim()) {
      toast.error('Please provide a reason for suspension')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/organizations/${resolvedParams.orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend',
          suspendedReason: suspendReason,
          reason: `Suspended: ${suspendReason}`,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Organization suspended successfully')
        setShowSuspendDialog(false)
        setSuspendReason('')
        fetchOrganization()
      } else {
        toast.error(data.error?.message || 'Failed to suspend organization')
      }
    } catch (error) {
      toast.error('Failed to suspend organization')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnsuspend() {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/organizations/${resolvedParams.orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unsuspend',
          reason: 'Organization unsuspended by admin',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Organization unsuspended successfully')
        fetchOrganization()
      } else {
        toast.error(data.error?.message || 'Failed to unsuspend organization')
      }
    } catch (error) {
      toast.error('Failed to unsuspend organization')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangePlan() {
    if (!newTier) {
      toast.error('Please select a plan')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/organizations/${resolvedParams.orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_plan',
          subscriptionTier: newTier,
          reason: `Plan changed to ${newTier}`,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Plan changed successfully')
        setShowPlanDialog(false)
        fetchOrganization()
      } else {
        toast.error(data.error?.message || 'Failed to change plan')
      }
    } catch (error) {
      toast.error('Failed to change plan')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!org) {
    return <div className="text-center py-8">Organization not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/superadmin/organizations"
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to Organizations
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-3xl font-bold text-gray-900">{org.name}</h1>
            <Badge variant={org.status === 'ACTIVE' ? 'default' : 'destructive'}>
              {org.status}
            </Badge>
            <Badge variant="secondary">{org.subscriptionTier}</Badge>
          </div>
          <p className="mt-2 text-sm text-gray-600">/{org.slug}</p>
        </div>

        <div className="flex gap-2">
          {org.status === 'SUSPENDED' ? (
            <Button onClick={handleUnsuspend} disabled={actionLoading}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Unsuspend
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowSuspendDialog(true)}
              disabled={actionLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowPlanDialog(true)}>
            Change Plan
          </Button>
        </div>
      </div>

      {/* Suspension Warning */}
      {org.status === 'SUSPENDED' && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Organization Suspended</p>
                <p className="text-sm text-gray-600 mt-1">
                  {org.suspendedReason || 'No reason provided'}
                </p>
                {org.suspendedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Suspended on {new Date(org.suspendedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org.members?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Demand Forecasts</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org._count?.demandForecasts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Supply Commitments</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org._count?.supplyCommitments || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(org.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Country</dt>
              <dd className="mt-1 text-sm text-gray-900">{org.country || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Subscription Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{org.subscriptionStatus}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Billing Cycle</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {org.currentBillingCycle || 'N/A'}
              </dd>
            </div>
            {org.trialEndsAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Trial Ends</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(org.trialEndsAt).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({org.members?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {org.members?.map((member: any) => (
              <Link
                key={member.id}
                href={`/superadmin/users/${member.user.id}`}
                className="block p-3 rounded-lg border hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{member.user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{member.role}</Badge>
                    <Badge variant="outline">{member.functionalRole}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      {showSuspendDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Suspend Organization</CardTitle>
              <CardDescription>
                This will block all users in this organization from accessing the app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Reason for suspension</label>
                <Textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g., Payment failure, Terms violation, etc."
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSuspendDialog(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSuspend}
                  disabled={actionLoading || !suspendReason.trim()}
                >
                  {actionLoading ? 'Suspending...' : 'Suspend Organization'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Change Plan Dialog */}
      {showPlanDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Change Subscription Plan</CardTitle>
              <CardDescription>Update the organization's subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Plan</label>
                <Select value={newTier} onValueChange={setNewTier}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STARTER">Starter</SelectItem>
                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowPlanDialog(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleChangePlan} disabled={actionLoading || !newTier}>
                  {actionLoading ? 'Updating...' : 'Update Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
