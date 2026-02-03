import { prisma } from './prisma'
import { getSession } from './auth'
import type { Session } from '@/types'
import { headers } from 'next/headers'

/**
 * Platform Admin Authorization Utilities
 *
 * These helpers manage access to the platform superadmin dashboard,
 * which operates across ALL organizations.
 *
 * Security: Only users in the PlatformAdmin table can access superadmin routes.
 */

// Environment-based superadmin allowlist (fallback)
// Format: PLATFORM_SUPERADMINS="admin@teamtakt.app,ceo@teamtakt.app"
const ALLOWLISTED_EMAILS = process.env.PLATFORM_SUPERADMINS?.split(',').map(e => e.trim().toLowerCase()) || []

/**
 * Check if a user is a platform admin (server-side only)
 *
 * Checks both:
 * 1. PlatformAdmin table (primary source of truth)
 * 2. Environment allowlist (fallback for bootstrapping)
 *
 * @returns Platform admin record if user is admin, null otherwise
 */
export async function getPlatformAdmin(userId: string) {
  // Check database first
  const platformAdmin = await prisma.platformAdmin.findFirst({
    where: {
      userId,
      revokedAt: null,
    },
  })

  if (platformAdmin) {
    return platformAdmin
  }

  // Fallback: Check environment allowlist
  if (ALLOWLISTED_EMAILS.length > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (user && ALLOWLISTED_EMAILS.includes(user.email.toLowerCase())) {
      // User is allowlisted but not in DB - this is a bootstrap scenario
      // Return a synthetic admin record (not saved to DB)
      return {
        id: 'allowlist',
        userId: userId,
        email: user.email,
        role: 'ADMIN' as const,
        createdAt: new Date(),
        createdBy: null,
        revokedAt: null,
        revokedBy: null,
      }
    }
  }

  return null
}

/**
 * Verify current session user is a platform admin
 * Throws error if not authorized
 *
 * Use this in API routes to protect superadmin endpoints
 */
export async function requirePlatformAdmin(): Promise<{
  session: Session
  platformAdmin: Awaited<ReturnType<typeof getPlatformAdmin>>
}> {
  const session = await getSession()

  if (!session) {
    throw new Error('UNAUTHORIZED: Not authenticated')
  }

  const platformAdmin = await getPlatformAdmin(session.user.id)

  if (!platformAdmin) {
    throw new Error('FORBIDDEN: Platform admin access required')
  }

  return { session, platformAdmin }
}

/**
 * Check if current user is platform admin (non-throwing version)
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  const platformAdmin = await getPlatformAdmin(session.user.id)
  return !!platformAdmin
}

/**
 * Get request metadata for audit logging
 */
export async function getRequestMetadata() {
  const headersList = await headers()

  return {
    ipAddress: headersList.get('x-forwarded-for') ||
               headersList.get('x-real-ip') ||
               'unknown',
    userAgent: headersList.get('user-agent') || 'unknown',
  }
}

/**
 * Create an admin audit log entry
 * Call this for every platform admin action
 */
export async function createAdminAuditLog({
  adminUserId,
  adminEmail,
  actionType,
  targetType,
  targetId,
  targetName,
  beforeState,
  afterState,
  reason,
}: {
  adminUserId: string
  adminEmail: string
  actionType: string
  targetType: string
  targetId: string
  targetName?: string
  beforeState?: any
  afterState?: any
  reason?: string
}) {
  const metadata = await getRequestMetadata()

  return prisma.adminAuditLog.create({
    data: {
      adminUserId,
      adminEmail,
      actionType,
      targetType,
      targetId,
      targetName: targetName || null,
      beforeState: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
      afterState: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
      reason: reason || null,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
  })
}

/**
 * Grant platform admin access to a user
 * Must be called by an existing admin
 */
export async function grantPlatformAdmin({
  userId,
  email,
  grantedBy,
  role = 'ADMIN',
}: {
  userId: string
  email: string
  grantedBy: string
  role?: 'ADMIN' | 'SUPER_ADMIN'
}) {
  const admin = await prisma.platformAdmin.upsert({
    where: { userId },
    create: {
      userId,
      email: email.toLowerCase(),
      role,
      createdBy: grantedBy,
      revokedAt: null,
      revokedBy: null,
    },
    update: {
      email: email.toLowerCase(),
      role,
      revokedAt: null, // Un-revoke if previously revoked
      revokedBy: null,
    },
  })

  await createAdminAuditLog({
    adminUserId: grantedBy,
    adminEmail: (await prisma.user.findUnique({ where: { id: grantedBy } }))?.email || 'system',
    actionType: 'platform_admin.grant',
    targetType: 'user',
    targetId: userId,
    targetName: email,
    afterState: { role, userId, email },
    reason: `Granted ${role} access`,
  })

  return admin
}

/**
 * Revoke platform admin access
 */
export async function revokePlatformAdmin({
  userId,
  revokedBy,
  reason,
}: {
  userId: string
  revokedBy: string
  reason?: string
}) {
  const admin = await prisma.platformAdmin.findUnique({ where: { userId } })

  if (!admin) {
    throw new Error('User is not a platform admin')
  }

  const updated = await prisma.platformAdmin.update({
    where: { userId },
    data: {
      revokedAt: new Date(),
      revokedBy,
    },
  })

  await createAdminAuditLog({
    adminUserId: revokedBy,
    adminEmail: (await prisma.user.findUnique({ where: { id: revokedBy } }))?.email || 'system',
    actionType: 'platform_admin.revoke',
    targetType: 'user',
    targetId: userId,
    targetName: admin.email,
    beforeState: { role: admin.role },
    reason,
  })

  return updated
}
