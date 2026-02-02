import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin, createAdminAuditLog } from '@/lib/platform-admin'
import { z } from 'zod'

/**
 * GET /api/superadmin/users/[userId]
 *
 * Get detailed information about a single user
 * Platform admin only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizationMemberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                subscriptionTier: true,
              },
            },
          },
        },
        sessions: {
          orderBy: { lastActiveAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            demandForecasts: true,
            supplyCommitments: true,
            auditLogs: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        },
        { status: 404 }
      )
    }

    // Get recent activity across all orgs
    const recentActivity = await prisma.activityEvent.findMany({
      where: { actorUserId: userId },
      include: {
        organization: {
          select: { name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: {
        user,
        recentActivity,
      },
    })
  } catch (error: any) {
    console.error('Superadmin user detail error:', error)

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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' },
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/users/[userId]
 *
 * Update user (disable, enable, etc.)
 * Platform admin only
 */

const updateUserSchema = z.object({
  action: z.enum(['disable', 'enable']),
  reason: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { session } = await requirePlatformAdmin()
    const { userId } = await params
    const body = await request.json()

    const validated = updateUserSchema.parse(body)

    // Fetch current user state
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        },
        { status: 404 }
      )
    }

    let updatedUser
    let auditAction = ''

    switch (validated.action) {
      case 'disable':
        if (!user.isActive) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'ALREADY_DISABLED', message: 'User is already disabled' },
            },
            { status: 400 }
          )
        }

        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
        })

        // Invalidate all sessions
        await prisma.session.deleteMany({ where: { userId } })

        auditAction = 'user.disable'
        break

      case 'enable':
        if (user.isActive) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'ALREADY_ENABLED', message: 'User is already enabled' },
            },
            { status: 400 }
          )
        }

        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { isActive: true },
        })

        auditAction = 'user.enable'
        break

      default:
        return NextResponse.json(
          {
            success: false,
            error: { code: 'INVALID_ACTION', message: 'Invalid action' },
          },
          { status: 400 }
        )
    }

    // Create audit log
    await createAdminAuditLog({
      adminUserId: session.user.id,
      adminEmail: session.user.email,
      actionType: auditAction,
      targetType: 'user',
      targetId: userId,
      targetName: user.email,
      beforeState: { isActive: user.isActive },
      afterState: { isActive: updatedUser.isActive },
      reason: validated.reason,
    })

    return NextResponse.json({
      success: true,
      data: { user: updatedUser },
    })
  } catch (error: any) {
    console.error('Superadmin user update error:', error)

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Platform admin access required' },
        },
        { status: 403 }
      )
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/users/[userId]
 *
 * Permanently delete a user
 * Platform admin only
 */

const deleteUserSchema = z.object({
  reason: z.string().optional(),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { session } = await requirePlatformAdmin()
    const { userId } = await params
    const body = await request.json()

    const validated = deleteUserSchema.parse(body)

    // Fetch user before deletion
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        role: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        },
        { status: 404 }
      )
    }

    // Delete related records that don't have cascade delete
    // ActivityEvent, AdminAuditLog, and AuditLog don't cascade
    await prisma.activityEvent.deleteMany({
      where: { actorUserId: userId },
    })

    await prisma.adminAuditLog.deleteMany({
      where: { targetType: 'user', targetId: userId },
    })

    // Delete user's own audit logs
    await prisma.auditLog.deleteMany({
      where: { userId: userId },
    })

    // Create audit log BEFORE deleting the user
    await createAdminAuditLog({
      adminUserId: session.user.id,
      adminEmail: session.user.email,
      actionType: 'user.delete',
      targetType: 'user',
      targetId: userId,
      targetName: user.email,
      beforeState: { user },
      afterState: null,
      reason: validated.reason,
    })

    // Delete the user (cascade will handle sessions, memberships, audit logs, etc.)
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'User deleted successfully' },
    })
  } catch (error: any) {
    console.error('Superadmin user delete error:', error)

    if (error.message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Platform admin access required' },
        },
        { status: 403 }
      )
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' },
      },
      { status: 500 }
    )
  }
}
