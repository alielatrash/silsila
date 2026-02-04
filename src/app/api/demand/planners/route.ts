import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { orgScopedWhere } from '@/lib/org-scoped'

// GET: Fetch unique demand planners for a planning week
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const planningWeekId = searchParams.get('planningWeekId')

    if (!planningWeekId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'planningWeekId is required' } },
        { status: 400 }
      )
    }

    // Get unique created by IDs from demand forecasts for this planning week
    const forecasts = await prisma.demandForecast.findMany({
      where: orgScopedWhere(session, { planningWeekId }),
      select: { createdById: true },
      distinct: ['createdById'],
    })

    const createdByIds = forecasts.map(f => f.createdById)

    if (createdByIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Fetch user details for these IDs
    const users = await prisma.user.findMany({
      where: { id: { in: createdByIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: users,
    })
  } catch (error) {
    console.error('Fetch demand planners error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch demand planners' } },
      { status: 500 }
    )
  }
}
