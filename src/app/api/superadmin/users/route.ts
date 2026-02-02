import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platform-admin'

/**
 * GET /api/superadmin/users
 *
 * List all users across all organizations with pagination and search
 * Platform admin only
 */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const orgId = searchParams.get('orgId') || ''
    const role = searchParams.get('role') || ''
    const isActive = searchParams.get('isActive')

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role) {
      where.role = role
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    // Filter by org if specified
    if (orgId) {
      where.organizationMemberships = {
        some: { organizationId: orgId },
      }
    }

    // Get total count
    const total = await prisma.user.count({ where })

    // Get paginated users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastActivityAt: true,
        createdAt: true,
        organizationMemberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            sessions: true,
            demandForecasts: true,
            supplyCommitments: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with last login data
    const userIds = users.map(u => u.id)
    const lastLogins = await prisma.session.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { lastActiveAt: true },
    })

    const lastLoginMap = new Map(
      lastLogins.map(l => [l.userId, l._max.lastActiveAt])
    )

    const enrichedUsers = users.map(user => ({
      ...user,
      lastLogin: lastLoginMap.get(user.id) || null,
      organizations: user.organizationMemberships.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        status: m.organization.status,
        role: m.role,
        functionalRole: m.functionalRole,
        joinedAt: m.joinedAt,
      })),
      sessionCount: user._count.sessions,
      demandForecastCount: user._count.demandForecasts,
      supplyCommitmentCount: user._count.supplyCommitments,
    }))

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error: any) {
    console.error('Superadmin users list error:', error)

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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users' },
      },
      { status: 500 }
    )
  }
}
