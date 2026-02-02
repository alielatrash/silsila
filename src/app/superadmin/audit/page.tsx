'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)

  useEffect(() => {
    fetchAuditLogs()
  }, [page])

  async function fetchAuditLogs() {
    setLoading(true)
    try {
      const response = await fetch(`/api/superadmin/audit?page=${page}&pageSize=50`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Audit Log</h1>
        <p className="mt-2 text-sm text-gray-600">
          All platform admin actions with before/after states
        </p>
      </div>

      {/* Audit Log List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {pagination ? `${pagination.total} Audit Entries` : 'Audit Log'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No audit logs found</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border">
                  <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{log.actionType}</Badge>
                      <Badge variant="outline">{log.targetType}</Badge>
                      {log.targetName && (
                        <span className="text-sm text-gray-600">→ {log.targetName}</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      By <span className="font-medium">{log.adminEmail}</span>
                      {log.reason && (
                        <span className="ml-2">• {log.reason}</span>
                      )}
                    </div>
                    {(log.beforeState || log.afterState) && (
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        {log.beforeState && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Before</p>
                            <pre className="text-xs text-gray-600 bg-red-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.beforeState, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.afterState && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">After</p>
                            <pre className="text-xs text-gray-600 bg-green-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.afterState, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                      {log.ipAddress && <span className="ml-3">IP: {log.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
