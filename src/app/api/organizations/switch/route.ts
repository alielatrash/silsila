import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { getPlatformAdmin } from '@/lib/platform-admin'
import { z } from 'zod'

// Validation schema for switching organization
const switchOrgSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
})

// POST /api/organizations/switch - Switch current organization
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = switchOrgSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { organizationId } = validationResult.data

    // Check if user is a platform admin
    const platformAdmin = await getPlatformAdmin(session.user.id)

    // Verify user is a member of the target organization OR is a platform admin
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    })

    // If not a member and not a platform admin, deny access
    if (!membership && !platformAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_MEMBER',
            message: 'You are not a member of this organization',
          },
        },
        { status: 403 }
      )
    }

    // If platform admin but not a member, fetch the organization directly
    let targetOrg = membership?.organization
    let userRole = membership?.role || 'ADMIN' // Default to ADMIN for platform admins
    let userFunctionalRole = membership?.functionalRole || 'ADMIN'

    if (!membership && platformAdmin) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          status: true,
        },
      })

      if (!org) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ORG_NOT_FOUND',
              message: 'Organization not found',
            },
          },
          { status: 404 }
        )
      }

      targetOrg = org
      // Platform admins get ADMIN role when accessing organizations
      userRole = 'ADMIN'
      userFunctionalRole = 'ADMIN'
    }

    if (!targetOrg?.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ORG_INACTIVE',
            message: 'This organization is not active',
          },
        },
        { status: 400 }
      )
    }

    // Update user's current organization
    await prisma.user.update({
      where: { id: session.user.id },
      data: { currentOrgId: organizationId },
    })

    // Audit log
    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.ORGANIZATION_SWITCHED,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: {
        fromOrg: session.user.currentOrgId,
        toOrg: organizationId,
        orgName: targetOrg.name,
        isPlatformAdminAccess: !!platformAdmin && !membership,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `Switched to ${targetOrg.name}${platformAdmin && !membership ? ' (Platform Admin Access)' : ''}`,
        organization: {
          id: targetOrg.id,
          name: targetOrg.name,
          slug: targetOrg.slug,
          role: userRole,
          functionalRole: userFunctionalRole,
        },
      },
    })
  } catch (error) {
    console.error('Switch organization error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
