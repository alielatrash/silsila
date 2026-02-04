#!/usr/bin/env tsx
/**
 * Quick verification: Who is currently logged in and what org are they viewing?
 * Run this to quickly check if there's a session/org mismatch
 */

import { PrismaClient } from '@prisma/client'
import readline from 'readline'

const prisma = new PrismaClient()

async function main() {
  console.log('=' .repeat(80))
  console.log('SESSION TOKEN VERIFIER')
  console.log('=' .repeat(80))
  console.log()
  console.log('This tool helps verify which user/org a session token belongs to.')
  console.log('You can get the session token from:')
  console.log('  1. Browser DevTools → Application → Cookies → takt_session')
  console.log('  2. Or check the database for recent active sessions')
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve))
  }

  const mode = await question('Enter session token or press Enter to list active sessions: ')

  if (!mode.trim()) {
    // List all active sessions
    console.log()
    console.log('📋 Active Sessions:')
    console.log('-'.repeat(80))

    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: { gte: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            currentOrgId: true,
            organizationMemberships: {
              include: {
                organization: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { lastActiveAt: 'desc' },
      take: 10,
    })

    if (sessions.length === 0) {
      console.log('No active sessions found.')
    } else {
      for (const session of sessions) {
        const currentOrg = session.user.organizationMemberships.find(
          (m) => m.organizationId === session.user.currentOrgId
        )

        console.log()
        console.log(`User: ${session.user.email} (${session.user.firstName} ${session.user.lastName})`)
        console.log(`  Session Token: ${session.token}`)
        console.log(`  Current Org: ${currentOrg?.organization.name || 'NONE'}`)
        console.log(`  Last Active: ${session.lastActiveAt.toISOString()}`)
        console.log(`  Expires: ${session.expiresAt.toISOString()}`)
      }
    }
  } else {
    // Look up specific session
    const token = mode.trim()

    console.log()
    console.log('🔍 Looking up session token...')
    console.log('-'.repeat(80))

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            currentOrgId: true,
            organizationMemberships: {
              include: {
                organization: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    })

    if (!session) {
      console.log('❌ Session not found or expired.')
    } else {
      const currentOrg = session.user.organizationMemberships.find(
        (m) => m.organizationId === session.user.currentOrgId
      )

      console.log()
      console.log(`✅ Session Found`)
      console.log()
      console.log(`User: ${session.user.email}`)
      console.log(`Name: ${session.user.firstName} ${session.user.lastName}`)
      console.log(`User ID: ${session.user.id}`)
      console.log()
      console.log(`Current Organization: ${currentOrg?.organization.name || 'NONE'}`)
      console.log(`Current Org ID: ${session.user.currentOrgId || 'NONE'}`)
      console.log(`Current Org Slug: ${currentOrg?.organization.slug || 'NONE'}`)
      console.log()
      console.log(`Session Created: ${session.createdAt.toISOString()}`)
      console.log(`Last Active: ${session.lastActiveAt.toISOString()}`)
      console.log(`Expires: ${session.expiresAt.toISOString()}`)
      console.log(`Is Expired: ${session.expiresAt < new Date() ? 'YES ❌' : 'NO ✅'}`)
      console.log()

      console.log(`Organization Memberships:`)
      for (const membership of session.user.organizationMemberships) {
        const isCurrent = membership.organizationId === session.user.currentOrgId
        console.log(
          `  ${isCurrent ? '→' : ' '} ${membership.organization.name} (${membership.organization.slug})`
        )
        console.log(`    Role: ${membership.role} / ${membership.functionalRole}`)
      }

      // Check for issues
      console.log()
      console.log('🔒 Security Checks:')
      if (!session.user.currentOrgId) {
        console.log('  ⚠️  WARNING: User has no currentOrgId set')
      } else if (!currentOrg) {
        console.log('  🚨 CRITICAL: currentOrgId does not match any membership!')
        console.log(
          `     currentOrgId: ${session.user.currentOrgId} is not in [${session.user.organizationMemberships.map((m) => m.organizationId).join(', ')}]`
        )
      } else if (session.expiresAt < new Date()) {
        console.log('  ⚠️  WARNING: Session is expired')
      } else {
        console.log('  ✅ All checks passed')
      }

      // Data count
      console.log()
      console.log('📊 Data visible to this session:')
      if (session.user.currentOrgId) {
        const [parties, locations, forecasts, commitments] = await Promise.all([
          prisma.party.count({ where: { organizationId: session.user.currentOrgId } }),
          prisma.location.count({ where: { organizationId: session.user.currentOrgId } }),
          prisma.demandForecast.count({ where: { organizationId: session.user.currentOrgId } }),
          prisma.supplyCommitment.count({ where: { organizationId: session.user.currentOrgId } }),
        ])

        console.log(`  Parties: ${parties}`)
        console.log(`  Locations: ${locations}`)
        console.log(`  Demand Forecasts: ${forecasts}`)
        console.log(`  Supply Commitments: ${commitments}`)

        if (parties === 0 && locations === 0 && forecasts === 0 && commitments === 0) {
          console.log()
          console.log('  💡 This organization has no data yet.')
        }
      }
    }
  }

  rl.close()
  console.log()
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
