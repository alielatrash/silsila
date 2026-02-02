/**
 * Check User Organization Membership
 *
 * Usage: npx tsx scripts/check-user-org.ts <email>
 */

import { prisma } from '../src/lib/prisma'

async function checkUserOrg(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizationMemberships: {
        include: {
          organization: true,
        },
      },
    },
  })

  if (!user) {
    console.error(`❌ User not found: ${email}`)
    process.exit(1)
  }

  console.log(`\n📋 User: ${user.firstName} ${user.lastName} (${user.email})`)
  console.log(`   User ID: ${user.id}`)
  console.log(`   Current Org ID: ${user.currentOrgId}`)
  console.log(`\n🏢 Organization Memberships:`)

  for (const membership of user.organizationMemberships) {
    const isCurrent = membership.organizationId === user.currentOrgId
    console.log(
      `   ${isCurrent ? '✓' : ' '} ${membership.organization.name} (${membership.organization.id})`
    )
    console.log(`     Role: ${membership.role} | Functional Role: ${membership.functionalRole}`)
    console.log(`     Status: ${membership.organization.status}`)
  }

  if (user.currentOrgId) {
    const currentOrg = await prisma.organization.findUnique({
      where: { id: user.currentOrgId },
    })

    if (!currentOrg) {
      console.log(`\n⚠️  WARNING: User's currentOrgId points to non-existent org!`)
    } else {
      console.log(`\n✅ Current org is valid: ${currentOrg.name}`)
    }
  } else {
    console.log(`\n⚠️  WARNING: User has no currentOrgId set!`)
  }
}

const email = process.argv[2]

if (!email) {
  console.error('Usage: npx tsx scripts/check-user-org.ts <email>')
  process.exit(1)
}

checkUserOrg(email)
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
