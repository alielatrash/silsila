#!/usr/bin/env tsx
/**
 * Check all active sessions in the database
 * Look for potential session issues that could cause data leaks
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=' .repeat(80))
  console.log('SESSION ANALYSIS')
  console.log('=' .repeat(80))
  console.log()

  // Get all active sessions (not expired)
  const sessions = await prisma.session.findMany({
    where: {
      expiresAt: {
        gte: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          currentOrgId: true,
          organizationMemberships: {
            include: {
              organization: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`📋 Found ${sessions.length} active sessions (not expired)`)
  console.log()

  if (sessions.length === 0) {
    console.log('⚠️  No active sessions found. User may need to log in again.')
    console.log()
  }

  for (const session of sessions) {
    console.log('-'.repeat(80))
    console.log(`Session ID: ${session.id}`)
    console.log(`User: ${session.user.email}`)
    console.log(`User ID: ${session.userId}`)
    console.log(`Token: ${session.token.substring(0, 20)}...`)
    console.log(`Created: ${session.createdAt.toISOString()}`)
    console.log(`Expires: ${session.expiresAt.toISOString()}`)
    console.log(`Last Active: ${session.lastActiveAt.toISOString()}`)
    console.log(`User Agent: ${session.userAgent || 'N/A'}`)
    console.log(`IP Address: ${session.ipAddress || 'N/A'}`)
    console.log()

    console.log(`User's currentOrgId: ${session.user.currentOrgId}`)
    console.log(`User's Organization Memberships:`)

    for (const membership of session.user.organizationMemberships) {
      const isCurrent = membership.organizationId === session.user.currentOrgId
      console.log(`  ${isCurrent ? '→' : ' '} ${membership.organization.name} (ID: ${membership.organizationId})`)
    }

    // Check for session issues
    if (!session.user.currentOrgId) {
      console.log()
      console.log('⚠️  WARNING: User has no currentOrgId set!')
    } else if (!session.user.organizationMemberships.some(m => m.organizationId === session.user.currentOrgId)) {
      console.log()
      console.log('🚨 CRITICAL BUG: currentOrgId does not match any organization membership!')
      console.log(`   currentOrgId: ${session.user.currentOrgId}`)
      console.log(`   Valid org IDs: ${session.user.organizationMemberships.map(m => m.organizationId).join(', ')}`)
    }

    console.log()
  }

  console.log('=' .repeat(80))
  console.log()

  // Check for expired sessions for ali@teamtakt.app
  const aliExpiredSessions = await prisma.session.findMany({
    where: {
      user: { email: 'ali@teamtakt.app' },
      expiresAt: {
        lt: new Date(),
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (aliExpiredSessions.length > 0) {
    console.log('🕐 Recent expired sessions for ali@teamtakt.app:')
    for (const session of aliExpiredSessions) {
      console.log(`  - Session ${session.id} created ${session.createdAt.toISOString()}, expired ${session.expiresAt.toISOString()}`)
    }
    console.log()
  }

  // Summary
  console.log('=' .repeat(80))
  console.log('SUMMARY:')
  console.log('=' .repeat(80))

  const aliActiveSessions = sessions.filter(s => s.user.email === 'ali@teamtakt.app')
  const aliTrellaActiveSessions = sessions.filter(s => s.user.email === 'ali@trella.app')

  console.log(`Active sessions for ali@teamtakt.app: ${aliActiveSessions.length}`)
  console.log(`Active sessions for ali@trella.app: ${aliTrellaActiveSessions.length}`)
  console.log()

  if (aliActiveSessions.length > 0) {
    const session = aliActiveSessions[0]
    console.log('ali@teamtakt.app session details:')
    console.log(`  currentOrgId: ${session.user.currentOrgId}`)
    console.log(`  Token (first 20 chars): ${session.token.substring(0, 20)}`)

    const org = await prisma.organization.findUnique({
      where: { id: session.user.currentOrgId! },
      select: { name: true },
    })

    console.log(`  Current Organization: ${org?.name || 'UNKNOWN'}`)

    if (org?.name === 'Trella') {
      console.log()
      console.log('🚨 CRITICAL BUG FOUND: ali@teamtakt.app has currentOrgId set to Trella!')
      console.log('   This is the root cause of the data leak.')
    }
  }

  console.log()
  console.log('=' .repeat(80))
  console.log('✅ SESSION ANALYSIS COMPLETE')
  console.log('=' .repeat(80))
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
