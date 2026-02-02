import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platform-admin'

/**
 * GET /api/superadmin/audit
 *
 * List all admin audit log entries
 * Platform admin only
 */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const adminUserId = searchParams.get('adminUserId') || ''
    const actionType = searchParams.get('actionType') || ''
    const targetType = searchParams.get('targetType') || ''
    const targetId = searchParams.get('targetId') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {}

    if (adminUserId) {
      where.adminUserId = adminUserId
    }

    if (actionType) {
      where.actionType = actionType
    }

    if (targetType) {
      where.targetType = targetType
    }

    if (targetId) {
      where.targetId = targetId
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
    const total = await prisma.adminAuditLog.count({ where })

    // Get paginated audit logs
    const logs = await prisma.adminAuditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    })

    // Get action type distribution
    const actionTypeStats = await prisma.adminAuditLog.groupBy({
      by: ['actionType'],
      _count: { actionType: true },
      orderBy: { _count: { actionType: 'desc' } },
      take: 10,
    })

    // Get admin activity stats
    const adminStats = await prisma.adminAuditLog.groupBy({
      by: ['adminUserId', 'adminEmail'],
      _count: { adminUserId: true },
      orderBy: { _count: { adminUserId: 'desc' } },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      data: {
        logs,
        actionTypeStats,
        adminStats,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error: any) {
    console.error('Superadmin audit list error:', error)

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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' },
      },
      { status: 500 }
    )
  }
}
