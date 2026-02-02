import { prisma } from './prisma'
import type { Session } from '@/types'
import { headers } from 'next/headers'

/**
 * Activity Event Logger
 *
 * Tracks key user actions across the platform for admin visibility.
 * These are separate from audit logs (which track data changes) -
 * activity events are for high-level user behavior tracking.
 */

export type ActivityEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.register'
  | 'user.invite_sent'
  | 'user.invite_accepted'
  | 'demand.create'
  | 'demand.update'
  | 'demand.delete'
  | 'demand.import'
  | 'supply.create'
  | 'supply.update'
  | 'supply.delete'
  | 'supply.import'
  | 'org.settings_update'
  | 'org.member_added'
  | 'org.member_removed'
  | 'subscription.upgrade'
  | 'subscription.downgrade'
  | 'subscription.cancel'

/**
 * Log an activity event
 *
 * This should be called after important user actions to create
 * an audit trail visible to platform admins.
 */
export async function logActivity({
  session,
  eventType,
  entityType,
  entityId,
  metadata,
}: {
  session: Session | { user: { id: string; email: string; currentOrgId: string } }
  eventType: ActivityEventType | string
  entityType?: string
  entityId?: string
  metadata?: Record<string, any>
}) {
  try {
    const headersList = await headers()

    await prisma.activityEvent.create({
      data: {
        organizationId: session.user.currentOrgId,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        eventType,
        entityType: entityType || null,
        entityId: entityId || null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        ipAddress: headersList.get('x-forwarded-for') ||
                   headersList.get('x-real-ip') ||
                   null,
        userAgent: headersList.get('user-agent') || null,
      },
    })
  } catch (error) {
    // Don't fail the main operation if activity logging fails
    console.error('Failed to log activity event:', error)
  }
}

/**
 * Update user's lastActivityAt timestamp
 * Call this periodically (e.g., on important page loads)
 */
export async function updateUserActivity(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActivityAt: new Date() },
    })
  } catch (error) {
    // Non-critical, don't throw
    console.error('Failed to update user activity:', error)
  }
}
