import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platform-admin'

/**
 * GET /api/superadmin/activity
 *
 * List all activity events across all organizations
 * Platform admin only
 */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const orgId = searchParams.get('orgId') || ''
    const userId = searchParams.get('userId') || ''
    const eventType = searchParams.get('eventType') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {}

    if (orgId) {
      where.organizationId = orgId
    }

    if (userId) {
      where.actorUserId = userId
    }

    if (eventType) {
      where.eventType = eventType
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Get total count
    const total = await prisma.activityEvent.count({ where })

    // Get paginated activity events
    const events = await prisma.activityEvent.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    })

    // Get event type distribution
    const eventTypeStats = await prisma.activityEvent.groupBy({
      by: ['eventType'],
      _count: { eventType: true },
      orderBy: { _count: { eventType: 'desc' } },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      data: {
        events,
        eventTypeStats,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error: any) {
    console.error('Superadmin activity list error:', error)

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Platform admin access required' },
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity events' },
      },
      { status: 500 }
    )
  }
}
