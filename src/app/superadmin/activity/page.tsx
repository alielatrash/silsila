'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity } from 'lucide-react'

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)

  useEffect(() => {
    fetchActivity()
  }, [page])

  async function fetchActivity() {
    setLoading(true)
    try {
      const response = await fetch(`/api/superadmin/activity?page=${page}&pageSize=50`)
      const data = await response.json()

      if (data.success) {
        setEvents(data.data.events)
        setPagination(data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
        <p className="mt-2 text-sm text-gray-600">
          Platform-wide activity events from all organizations
        </p>
      </div>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {pagination ? `${pagination.total} Events` : 'Activity Events'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No activity events found</div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-4 p-4 rounded-lg border">
                  <Activity className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{event.eventType}</Badge>
                      {event.entityType && (
                        <Badge variant="outline">{event.entityType}</Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">{event.actorEmail}</span>
                      {event.organization && (
                        <span> in <span className="font-medium">{event.organization.name}</span></span>
                      )}
                    </div>
                    {event.metadata && (
                      <pre className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(event.createdAt).toLocaleString()}
                      {event.ipAddress && <span className="ml-3">IP: {event.ipAddress}</span>}
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
