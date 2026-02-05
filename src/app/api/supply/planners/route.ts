import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { orgScopedWhere } from '@/lib/org-scoped'

// Get unique supply planners (users who created supply commitments) for a planning week
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Planning week ID is required' } },
        { status: 400 }
      )
    }

    // Get unique supply planners from commitments for this planning week
    const commitments = await prisma.supplyCommitment.findMany({
      where: orgScopedWhere(session, { planningWeekId }),
      select: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      distinct: ['createdById'],
    })

    // Extract unique users
    const planners = commitments
      .map((c) => c.createdBy)
      .filter((user, index, self) => self.findIndex((u) => u.id === user.id) === index)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))

    return NextResponse.json({
      success: true,
      data: planners,
    })
  } catch (error) {
    console.error('Get supply planners error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
