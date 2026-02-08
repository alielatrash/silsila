'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewOrganizationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    country: 'SA',
    subscriptionTier: 'STARTER',
  })

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validation
    if (!formData.name.trim()) {
      toast.error('Organization name is required')
      return
    }
    if (!formData.slug.trim()) {
      toast.error('Organization slug is required')
      return
    }
    if (!formData.domain.trim()) {
      toast.error('Email domain is required')
      return
    }

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/
    if (!domainRegex.test(formData.domain)) {
      toast.error('Invalid domain format (e.g., mepco.com)')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/superadmin/organizations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Organization created successfully')
        router.push(`/superadmin/organizations/${data.data.organization.id}`)
      } else {
        toast.error(data.error?.message || 'Failed to create organization')
      }
    } catch (error) {
      toast.error('Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/superadmin/organizations"
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Organizations
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Create Organization</h1>
        <p className="mt-2 text-sm text-gray-600">
          Set up a new organization with email domain verification
        </p>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Configure the organization settings and email domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., MEPCO"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={loading}
                required
              />
              <p className="text-xs text-gray-500">
                The display name of the organization
              </p>
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug (URL-friendly identifier) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                placeholder="e.g., mepco"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                disabled={loading}
                required
              />
              <p className="text-xs text-gray-500">
                Used in URLs and must be unique
              </p>
            </div>

            {/* Email Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain">
                Email Domain <span className="text-red-500">*</span>
              </Label>
              <Input
                id="domain"
                type="text"
                placeholder="e.g., mepco.com (without @)"
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value.toLowerCase().trim() })
                }
                disabled={loading}
                required
              />
              <p className="text-xs text-gray-500">
                Only users with this email domain can join this organization (e.g., @mepco.com)
              </p>
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={formData.country}
                onValueChange={(value) => setFormData({ ...formData, country: value })}
                disabled={loading}
              >
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SA">Saudi Arabia (SA)</SelectItem>
                  <SelectItem value="AE">United Arab Emirates (AE)</SelectItem>
                  <SelectItem value="EG">Egypt (EG)</SelectItem>
                  <SelectItem value="PK">Pakistan (PK)</SelectItem>
                  <SelectItem value="US">United States (US)</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subscription Tier */}
            <div className="space-y-2">
              <Label htmlFor="tier">Subscription Tier</Label>
              <Select
                value={formData.subscriptionTier}
                onValueChange={(value) => setFormData({ ...formData, subscriptionTier: value })}
                disabled={loading}
              >
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Creating...' : 'Create Organization'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
