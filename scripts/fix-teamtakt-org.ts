/**
 * Fix TeamTakt Organization
 * Creates TeamTakt org and moves ali@teamtakt.app user there
 */

import { prisma } from '../src/lib/prisma'

async function fixTeamTaktOrg() {
  console.log('🔧 Fixing TeamTakt organization...\n')

  // 1. Check if TeamTakt org already exists
  let teamTaktOrg = await prisma.organization.findFirst({
    where: { slug: 'teamtakt' },
  })

  if (teamTaktOrg) {
    console.log(`✅ TeamTakt organization already exists: ${teamTaktOrg.id}`)
  } else {
    // Create TeamTakt organization
    teamTaktOrg = await prisma.organization.create({
      data: {
        name: 'TeamTakt',
        slug: 'teamtakt',
        country: 'SA',
        subscriptionTier: 'ENTERPRISE', // Give platform admins enterprise tier
        subscriptionStatus: 'ACTIVE',
        status: 'ACTIVE',
      },
    })
    console.log(`✅ Created TeamTakt organization: ${teamTaktOrg.id}`)

    // Create organization domain
    await prisma.organizationDomain.create({
      data: {
        organizationId: teamTaktOrg.id,
        domain: 'teamtakt.app',
        isVerified: true,
        isPrimary: true,
      },
    })
    console.log(`✅ Registered teamtakt.app domain`)

    // Create organization settings
    await prisma.organizationSettings.create({
      data: {
        organizationId: teamTaktOrg.id,
      },
    })
    console.log(`✅ Created organization settings`)
  }

  // 2. Find ali@teamtakt.app user
  const user = await prisma.user.findUnique({
    where: { email: 'ali@teamtakt.app' },
    include: {
      organizationMemberships: true,
    },
  })

  if (!user) {
    console.log('❌ User ali@teamtakt.app not found')
    return
  }

  console.log(`\n📋 User: ${user.firstName} ${user.lastName}`)
  console.log(`   Current Org ID: ${user.currentOrgId}`)

  // 3. Check if user is already member of TeamTakt
  const existingMembership = user.organizationMemberships.find(
    m => m.organizationId === teamTaktOrg.id
  )

  if (existingMembership) {
    console.log(`✅ User is already a member of TeamTakt`)
  } else {
    // Add user to TeamTakt org as OWNER
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: teamTaktOrg.id,
        role: 'OWNER',
        functionalRole: 'ADMIN',
      },
    })
    console.log(`✅ Added user to TeamTakt as OWNER`)
  }

  // 4. Update user's currentOrgId
  await prisma.user.update({
    where: { id: user.id },
    data: { currentOrgId: teamTaktOrg.id },
  })
  console.log(`✅ Updated user's currentOrgId to TeamTakt`)

  console.log(`\n✅ Done! User ali@teamtakt.app is now in TeamTakt organization`)
  console.log(`   Please log out and log back in to see the change.`)
}

fixTeamTaktOrg()
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
