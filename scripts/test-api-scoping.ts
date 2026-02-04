#!/usr/bin/env tsx
/**
 * Test API organization scoping
 * Simulates what happens when ali@teamtakt.app makes requests to supply targets
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=' .repeat(80))
  console.log('TEST: API Organization Scoping')
  console.log('=' .repeat(80))
  console.log()

  // Get ali@teamtakt.app user
  const aliUser = await prisma.user.findUnique({
    where: { email: 'ali@teamtakt.app' },
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
  })

  if (!aliUser) {
    console.log('❌ ali@teamtakt.app not found!')
    return
  }

  console.log('👤 User: ali@teamtakt.app')
  console.log(`   ID: ${aliUser.id}`)
  console.log(`   currentOrgId: ${aliUser.currentOrgId}`)
  console.log()

  // Simulate getSession() behavior
  console.log('🔐 Simulating getSession() for ali@teamtakt.app:')
  const currentOrgId = aliUser.currentOrgId
  const currentMembership = aliUser.organizationMemberships.find(m => m.organizationId === currentOrgId)

  if (!currentMembership) {
    console.log('❌ No membership found for currentOrgId!')
    return
  }

  console.log(`   Current Org: ${currentMembership.organization.name}`)
  console.log(`   Current Org ID: ${currentOrgId}`)
  console.log()

  // Simulate what the supply targets API would do
  console.log('📡 Simulating GET /api/supply/targets with organization scoping:')
  console.log(`   Using organizationId: ${currentOrgId}`)
  console.log()

  // Test 1: Get planning weeks for this org
  console.log('Test 1: Planning Weeks')
  const planningWeeks = await prisma.planningWeek.findMany({
    where: { organizationId: currentOrgId },
    select: { id: true, weekNumber: true, year: true },
    orderBy: { weekStart: 'desc' },
    take: 5,
  })

  console.log(`   Found ${planningWeeks.length} planning weeks for ${currentMembership.organization.name}`)
  if (planningWeeks.length > 0) {
    console.log(`   Latest week: Week ${planningWeeks[0].weekNumber}, ${planningWeeks[0].year}`)

    // Test 2: Get demand forecasts with org scoping
    const planningWeekId = planningWeeks[0].id
    console.log()
    console.log(`Test 2: Demand Forecasts for planning week ${planningWeekId}`)

    const demandForecasts = await prisma.demandForecast.findMany({
      where: {
        organizationId: currentOrgId,
        planningWeekId: planningWeekId,
      },
      select: {
        id: true,
        routeKey: true,
        party: { select: { name: true } },
        totalQty: true,
      },
      take: 5,
    })

    console.log(`   Found ${demandForecasts.length} demand forecasts`)
    if (demandForecasts.length > 0) {
      for (const forecast of demandForecasts) {
        console.log(`     - ${forecast.routeKey} (Party: ${forecast.party.name}, Qty: ${forecast.totalQty})`)
      }
    }

    // Test 3: Get supply commitments with org scoping
    console.log()
    console.log(`Test 3: Supply Commitments for planning week ${planningWeekId}`)

    const supplyCommitments = await prisma.supplyCommitment.findMany({
      where: {
        organizationId: currentOrgId,
        planningWeekId: planningWeekId,
      },
      select: {
        id: true,
        routeKey: true,
        party: { select: { name: true } },
        totalCommitted: true,
      },
      take: 5,
    })

    console.log(`   Found ${supplyCommitments.length} supply commitments`)
    if (supplyCommitments.length > 0) {
      for (const commitment of supplyCommitments) {
        console.log(`     - ${commitment.routeKey} (Party: ${commitment.party.name}, Committed: ${commitment.totalCommitted})`)
      }
    }
  }

  console.log()
  console.log('=' .repeat(80))

  // Now test what would happen if we query WITHOUT org scoping (bug scenario)
  console.log()
  console.log('🚨 TEST: What if we query WITHOUT organization scoping?')
  console.log('=' .repeat(80))
  console.log()

  // Query all parties without org scoping
  console.log('Query: All parties (no org scoping)')
  const allParties = await prisma.party.findMany({
    select: {
      name: true,
      partyRole: true,
      organization: { select: { name: true } },
    },
    take: 10,
  })

  console.log(`Found ${allParties.length} parties:`)
  for (const party of allParties) {
    console.log(`  - ${party.name} (${party.partyRole}) - Org: ${party.organization.name}`)
  }

  console.log()
  console.log('💡 Key Finding:')
  console.log('   If the API endpoint is NOT using orgScopedWhere() properly,')
  console.log('   ali@teamtakt.app could see data from ALL organizations!')
  console.log()

  // Test if there's any data in TeamTakt org
  console.log('=' .repeat(80))
  console.log('📊 Data Count Comparison:')
  console.log('=' .repeat(80))
  console.log()

  const teamtaktOrg = await prisma.organization.findFirst({
    where: { slug: 'teamtakt' },
  })

  const trellaOrg = await prisma.organization.findFirst({
    where: { slug: 'trella' },
  })

  if (teamtaktOrg && trellaOrg) {
    const [teamtaktData, trellaData] = await Promise.all([
      prisma.$transaction([
        prisma.party.count({ where: { organizationId: teamtaktOrg.id } }),
        prisma.location.count({ where: { organizationId: teamtaktOrg.id } }),
        prisma.demandForecast.count({ where: { organizationId: teamtaktOrg.id } }),
        prisma.supplyCommitment.count({ where: { organizationId: teamtaktOrg.id } }),
      ]),
      prisma.$transaction([
        prisma.party.count({ where: { organizationId: trellaOrg.id } }),
        prisma.location.count({ where: { organizationId: trellaOrg.id } }),
        prisma.demandForecast.count({ where: { organizationId: trellaOrg.id } }),
        prisma.supplyCommitment.count({ where: { organizationId: trellaOrg.id } }),
      ]),
    ])

    console.log('TeamTakt Organization:')
    console.log(`  Parties: ${teamtaktData[0]}`)
    console.log(`  Locations: ${teamtaktData[1]}`)
    console.log(`  Demand Forecasts: ${teamtaktData[2]}`)
    console.log(`  Supply Commitments: ${teamtaktData[3]}`)
    console.log()

    console.log('Trella Organization:')
    console.log(`  Parties: ${trellaData[0]}`)
    console.log(`  Locations: ${trellaData[1]}`)
    console.log(`  Demand Forecasts: ${trellaData[2]}`)
    console.log(`  Supply Commitments: ${trellaData[3]}`)
    console.log()

    if (teamtaktData[0] === 0 && trellaData[0] > 0) {
      console.log('⚠️  FINDING: TeamTakt has NO data, but Trella has lots of data!')
      console.log('   If ali@teamtakt.app is seeing Trella suppliers, there are two possibilities:')
      console.log('   1. The user\'s session has the wrong currentOrgId (Session Bug)')
      console.log('   2. The API is not using org scoping properly (API Bug)')
      console.log('   3. There\'s a caching issue on the frontend')
    }
  }

  console.log()
  console.log('=' .repeat(80))
  console.log('✅ TEST COMPLETE')
  console.log('=' .repeat(80))
}

main()
  .catch((error) => {
    console.error('Error running test:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
