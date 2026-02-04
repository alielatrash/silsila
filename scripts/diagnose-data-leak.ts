#!/usr/bin/env tsx
/**
 * CRITICAL SECURITY DIAGNOSTIC SCRIPT
 * Investigating data leak where ali@teamtakt.app sees "Trella" organization data
 *
 * This script will:
 * 1. List all organizations in the database
 * 2. List all users and their organization memberships
 * 3. Show which organization ali@teamtakt.app belongs to
 * 4. Show which organization owns "Trella" data
 * 5. Check if there's a mismatch in currentOrgId vs actual memberships
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=' .repeat(80))
  console.log('CRITICAL SECURITY DIAGNOSTIC: Data Leak Investigation')
  console.log('=' .repeat(80))
  console.log()

  // 1. List all organizations
  console.log('📋 ORGANIZATIONS IN DATABASE:')
  console.log('-'.repeat(80))
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
          parties: true,
          locations: true,
          demandForecasts: true,
          supplyCommitments: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  for (const org of organizations) {
    console.log(`\nOrganization ID: ${org.id}`)
    console.log(`  Name: ${org.name}`)
    console.log(`  Slug: ${org.slug}`)
    console.log(`  Status: ${org.status} (${org.isActive ? 'Active' : 'Inactive'})`)
    console.log(`  Members: ${org._count.members}`)
    console.log(`  Parties: ${org._count.parties}`)
    console.log(`  Locations: ${org._count.locations}`)
    console.log(`  Demand Forecasts: ${org._count.demandForecasts}`)
    console.log(`  Supply Commitments: ${org._count.supplyCommitments}`)
    console.log(`  Created: ${org.createdAt.toISOString()}`)
  }

  console.log()
  console.log('=' .repeat(80))

  // 2. List all users and their memberships
  console.log('\n👥 USERS AND ORGANIZATION MEMBERSHIPS:')
  console.log('-'.repeat(80))
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      currentOrgId: true,
      role: true,
      isActive: true,
      emailVerified: true,
      organizationMemberships: {
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { email: 'asc' },
  })

  for (const user of users) {
    console.log(`\nUser: ${user.email}`)
    console.log(`  ID: ${user.id}`)
    console.log(`  Name: ${user.firstName} ${user.lastName}`)
    console.log(`  Role: ${user.role}`)
    console.log(`  Active: ${user.isActive}`)
    console.log(`  Email Verified: ${user.emailVerified}`)
    console.log(`  currentOrgId: ${user.currentOrgId || 'NULL'}`)
    console.log(`  Organization Memberships (${user.organizationMemberships.length}):`)

    if (user.organizationMemberships.length === 0) {
      console.log(`    ⚠️  WARNING: User has NO organization memberships!`)
    }

    for (const membership of user.organizationMemberships) {
      const isCurrent = membership.organizationId === user.currentOrgId
      console.log(`    ${isCurrent ? '→' : ' '} ${membership.organization.name} (${membership.organization.slug})`)
      console.log(`      Org ID: ${membership.organizationId}`)
      console.log(`      Org Role: ${membership.role}`)
      console.log(`      Functional Role: ${membership.functionalRole}`)
      console.log(`      Joined: ${membership.joinedAt.toISOString()}`)

      if (!isCurrent && user.currentOrgId) {
        console.log(`      ⚠️  WARNING: User's currentOrgId (${user.currentOrgId}) doesn't match this membership!`)
      }
    }

    // Check if currentOrgId matches any membership
    if (user.currentOrgId && !user.organizationMemberships.some(m => m.organizationId === user.currentOrgId)) {
      console.log(`  🚨 CRITICAL: currentOrgId "${user.currentOrgId}" does NOT match any membership!`)
    }
  }

  console.log()
  console.log('=' .repeat(80))

  // 3. Special focus on ali@teamtakt.app
  console.log('\n🔍 DETAILED CHECK: ali@teamtakt.app')
  console.log('-'.repeat(80))
  const aliUser = users.find(u => u.email === 'ali@teamtakt.app')

  if (!aliUser) {
    console.log('⚠️  User ali@teamtakt.app NOT FOUND in database!')
  } else {
    console.log(`User ID: ${aliUser.id}`)
    console.log(`currentOrgId: ${aliUser.currentOrgId}`)
    console.log(`Organization Memberships:`)

    for (const membership of aliUser.organizationMemberships) {
      console.log(`  - ${membership.organization.name} (ID: ${membership.organizationId})`)
    }

    if (aliUser.currentOrgId) {
      const currentOrg = organizations.find(o => o.id === aliUser.currentOrgId)
      console.log(`\nCurrent Organization: ${currentOrg?.name || 'NOT FOUND'}`)
      console.log(`Current Organization ID: ${aliUser.currentOrgId}`)
    } else {
      console.log(`\n⚠️  No currentOrgId set!`)
    }
  }

  console.log()
  console.log('=' .repeat(80))

  // 4. Check where "Trella" data exists
  console.log('\n🔍 CHECKING "TRELLA" DATA:')
  console.log('-'.repeat(80))

  // Find Trella organization
  const trellaOrg = organizations.find(o => o.name.toLowerCase().includes('trella'))
  if (trellaOrg) {
    console.log(`Found Trella Organization:`)
    console.log(`  ID: ${trellaOrg.id}`)
    console.log(`  Name: ${trellaOrg.name}`)
    console.log(`  Slug: ${trellaOrg.slug}`)

    // Check Trella parties (clients/suppliers)
    const trellaParties = await prisma.party.findMany({
      where: { organizationId: trellaOrg.id },
      select: { id: true, name: true, partyRole: true },
      take: 10,
    })

    console.log(`\nTrella Parties (first 10):`)
    for (const party of trellaParties) {
      console.log(`  - ${party.name} (${party.partyRole})`)
    }

    // Check if ali@teamtakt.app has access to Trella org
    if (aliUser) {
      const aliHasTrellaAccess = aliUser.organizationMemberships.some(
        m => m.organizationId === trellaOrg.id
      )
      console.log(`\nDoes ali@teamtakt.app have Trella membership? ${aliHasTrellaAccess ? 'YES' : 'NO'}`)

      if (!aliHasTrellaAccess && aliUser.currentOrgId === trellaOrg.id) {
        console.log(`🚨 CRITICAL BUG: ali@teamtakt.app has currentOrgId set to Trella but NO membership!`)
      }
    }
  } else {
    console.log('No organization with "Trella" in name found.')

    // Search in parties instead
    console.log('\nSearching for "Trella" in parties...')
    const trellaParties = await prisma.party.findMany({
      where: {
        name: {
          contains: 'Trella',
          mode: 'insensitive',
        },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
      take: 10,
    })

    if (trellaParties.length > 0) {
      console.log(`Found ${trellaParties.length} parties with "Trella" in name:`)
      for (const party of trellaParties) {
        console.log(`  - ${party.name} (${party.partyRole})`)
        console.log(`    Belongs to org: ${party.organization.name} (ID: ${party.organizationId})`)
      }
    } else {
      console.log('No parties with "Trella" in name found.')
    }
  }

  console.log()
  console.log('=' .repeat(80))

  // 5. Check for data in each organization
  console.log('\n📊 DATA DISTRIBUTION ACROSS ORGANIZATIONS:')
  console.log('-'.repeat(80))

  for (const org of organizations) {
    console.log(`\n${org.name} (${org.slug}):`)

    // Sample some parties
    const parties = await prisma.party.findMany({
      where: { organizationId: org.id },
      select: { name: true, partyRole: true },
      take: 5,
    })

    if (parties.length > 0) {
      console.log(`  Sample Parties (${org._count.parties} total):`)
      for (const party of parties) {
        console.log(`    - ${party.name} (${party.partyRole})`)
      }
    } else {
      console.log(`  No parties found`)
    }

    // Sample some locations
    const locations = await prisma.location.findMany({
      where: { organizationId: org.id },
      select: { name: true },
      take: 5,
    })

    if (locations.length > 0) {
      console.log(`  Sample Locations (${org._count.locations} total):`)
      for (const location of locations) {
        console.log(`    - ${location.name}`)
      }
    } else {
      console.log(`  No locations found`)
    }
  }

  console.log()
  console.log('=' .repeat(80))
  console.log('\n✅ DIAGNOSTIC COMPLETE')
  console.log('=' .repeat(80))
}

main()
  .catch((error) => {
    console.error('Error running diagnostic:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
