import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platform-admin'

/**
 * GET /api/superadmin/stats
 *
 * Get platform-wide statistics for the dashboard
 * Platform admin only
 */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin()

    const { searchParams } = request.nextUrl
    const days = parseInt(searchParams.get('days') || '30')

    // Date range for time-based queries
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Total counts
    const [
      totalOrgs,
      activeOrgs,
      suspendedOrgs,
      totalUsers,
      activeUsers,
      totalDemand,
      totalSupply,
      totalActivity,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.demandForecast.count(),
      prisma.supplyCommitment.count(),
      prisma.activityEvent.count({ where: { createdAt: { gte: startDate } } }),
    ])

    // Recent signups (last 30 days)
    const recentOrgs = await prisma.organization.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        subscriptionTier: true,
        status: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Recent users (last 30 days)
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        isActive: true,
        organizationMemberships: {
          include: {
            organization: {
              select: { name: true, slug: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Subscription tier distribution
    const tierDistribution = await prisma.organization.groupBy({
      by: ['subscriptionTier'],
      _count: { subscriptionTier: true },
    })

    // Subscription status distribution
    const statusDistribution = await prisma.organization.groupBy({
      by: ['subscriptionStatus'],
      _count: { subscriptionStatus: true },
    })

    // Growth trend (orgs created per day for last 30 days)
    const growthTrend = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "Organization"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `

    // Activity trend (events per day for last 30 days)
    const activityTrend = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "ActivityEvent"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `

    // Most active organizations (by activity event count)
    const mostActiveOrgs = await prisma.$queryRaw<
      Array<{ organizationId: string; name: string; count: bigint }>
    >`
      SELECT o.id as "organizationId", o.name, COUNT(a.id) as count
      FROM "Organization" o
      LEFT JOIN "ActivityEvent" a ON a."organizationId" = o.id
      WHERE a."createdAt" >= ${startDate}
      GROUP BY o.id, o.name
      ORDER BY count DESC
      LIMIT 10
    `

    // Convert BigInt to Number for JSON serialization
    const serializeCount = (arr: any[]) =>
      arr.map(item => ({
        ...item,
        count: Number(item.count),
      }))

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalOrgs,
          activeOrgs,
          suspendedOrgs,
          totalUsers,
          activeUsers,
          totalDemand,
          totalSupply,
          totalActivity,
        },
        recentOrgs,
        recentUsers,
        tierDistribution,
        statusDistribution,
        growthTrend: serializeCount(growthTrend),
        activityTrend: serializeCount(activityTrend),
        mostActiveOrgs: serializeCount(mostActiveOrgs),
        period: {
          days,
          startDate,
          endDate: new Date(),
        },
      },
    })
  } catch (error: any) {
    console.error('Superadmin stats error:', error)

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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' },
      },
      { status: 500 }
    )
  }
}
