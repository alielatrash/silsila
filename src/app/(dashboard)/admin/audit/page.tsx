'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatAuditMessage, getActionCategory, getActionIcon } from '@/lib/audit-formatter'

interface AuditLogEntry {
  id: string
  userId: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    email: string
    firstName: string | null
    lastName: string | null
  }
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-500',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-500',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-500',
  auth: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-500',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-500',
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [mounted, setMounted] = useState(false)
  const limit = 20

  // Prevent hydration mismatch by only rendering Select after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', page, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (actionFilter && actionFilter !== 'ALL') params.set('action', actionFilter)

      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch audit log')
      return json.data as { entries: AuditLogEntry[]; total: number; pages: number }
    },
  })

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Track all system activities and changes"
      >
        {mounted && (
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="LOGOUT">Logout</SelectItem>
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead>Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                </TableRow>
              ))
            ) : data?.entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No audit entries found
                </TableCell>
              </TableRow>
            ) : (
              data?.entries.map((entry) => {
                const userName = entry.user.firstName || entry.user.lastName
                  ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim()
                  : 'User'
                const category = getActionCategory(entry.action)
                const icon = getActionIcon(entry.action)
                const message = formatAuditMessage(entry, userName)

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                      {new Date(entry.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {entry.user.firstName || entry.user.lastName
                            ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim()
                            : entry.user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{icon}</span>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{userName}</span>{' '}
                            <span className="text-foreground">{message}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={actionColors[category]}>
                              {category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {entry.action}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
