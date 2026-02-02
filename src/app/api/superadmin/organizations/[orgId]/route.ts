import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin, createAdminAuditLog } from '@/lib/platform-admin'
import { z } from 'zod'

/**
 * GET /api/superadmin/organizations/[orgId]
 *
 * Get detailed information about a single organization
 * Platform admin only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { orgId } = await params

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        settings: true,
        domains: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                lastActivityAt: true,
                createdAt: true,
                isActive: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: {
          select: {
            demandForecasts: true,
            supplyCommitments: true,
            parties: true,
            locations: true,
            resourceTypes: true,
            subscriptionEvents: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        },
        { status: 404 }
      )
    }

    // Get recent activity
    const recentActivity = await prisma.activityEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Get subscription events
    const subscriptionEvents = await prisma.subscriptionEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: {
        organization,
        recentActivity,
        subscriptionEvents,
      },
    })
  } catch (error: any) {
    console.error('Superadmin organization detail error:', error)

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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organization' },
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/organizations/[orgId]
 *
 * Update organization (suspend, unsuspend, change plan, etc.)
 * Platform admin only
 */

const updateOrgSchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'change_plan', 'update_pricing']),
  reason: z.string().optional(),
  // For suspend
  suspendedReason: z.string().optional(),
  // For change_plan
  subscriptionTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  // For update_pricing
  priceOverride: z.number().int().nullable().optional(),
  seatLimit: z.number().int().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { session, platformAdmin } = await requirePlatformAdmin()
    const { orgId } = await params
    const body = await request.json()

    const validated = updateOrgSchema.parse(body)

    // Fetch current org state
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    })

    if (!org) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        },
        { status: 404 }
      )
    }

    let updatedOrg
    let auditAction = ''
    let auditAfterState: any = {}

    switch (validated.action) {
      case 'suspend':
        if (org.status === 'SUSPENDED') {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'ALREADY_SUSPENDED', message: 'Organization is already suspended' },
            },
            { status: 400 }
          )
        }

        updatedOrg = await prisma.organization.update({
          where: { id: orgId },
          data: {
            status: 'SUSPENDED',
            suspendedAt: new Date(),
            suspendedReason: validated.suspendedReason || 'Suspended by platform admin',
            suspendedBy: session.user.id,
          },
        })

        auditAction = 'org.suspend'
        auditAfterState = {
          status: 'SUSPENDED',
          suspendedAt: updatedOrg.suspendedAt,
          suspendedReason: updatedOrg.suspendedReason,
        }
        break

      case 'unsuspend':
        if (org.status !== 'SUSPENDED') {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'NOT_SUSPENDED', message: 'Organization is not suspended' },
            },
            { status: 400 }
          )
        }

        updatedOrg = await prisma.organization.update({
          where: { id: orgId },
          data: {
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedReason: null,
            suspendedBy: null,
          },
        })

        auditAction = 'org.unsuspend'
        auditAfterState = { status: 'ACTIVE' }
        break

      case 'change_plan':
        if (!validated.subscriptionTier) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'MISSING_TIER', message: 'subscriptionTier is required' },
            },
            { status: 400 }
          )
        }

        updatedOrg = await prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionTier: validated.subscriptionTier,
          },
        })

        auditAction = 'org.change_plan'
        auditAfterState = { subscriptionTier: validated.subscriptionTier }
        break

      case 'update_pricing':
        updatedOrg = await prisma.organization.update({
          where: { id: orgId },
          data: {
            priceOverride: validated.priceOverride,
            seatLimit: validated.seatLimit,
          },
        })

        auditAction = 'org.update_pricing'
        auditAfterState = {
          priceOverride: validated.priceOverride,
          seatLimit: validated.seatLimit,
        }
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
      targetType: 'organization',
      targetId: orgId,
      targetName: org.name,
      beforeState: {
        status: org.status,
        subscriptionTier: org.subscriptionTier,
        priceOverride: org.priceOverride,
        seatLimit: org.seatLimit,
      },
      afterState: auditAfterState,
      reason: validated.reason,
    })

    return NextResponse.json({
      success: true,
      data: { organization: updatedOrg },
    })
  } catch (error: any) {
    console.error('Superadmin organization update error:', error)

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
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update organization' },
      },
      { status: 500 }
    )
  }
}
