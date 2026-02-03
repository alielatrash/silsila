import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'ali@teamtakt.app'

  console.log(`\nChecking platform admin status for: ${email}`)
  console.log('='.repeat(60))

  // 1. Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      currentOrgId: true,
      isActive: true,
    }
  })

  if (!user) {
    console.log('❌ User NOT FOUND in database')
    console.log('   You need to create an account first')
    return
  }

  console.log('✓ User exists:')
  console.log(`  - ID: ${user.id}`)
  console.log(`  - Name: ${user.firstName} ${user.lastName}`)
  console.log(`  - Role: ${user.role}`)
  console.log(`  - Active: ${user.isActive}`)
  console.log(`  - Current Org: ${user.currentOrgId}`)

  // 2. Check PlatformAdmin table
  const platformAdmin = await prisma.platformAdmin.findUnique({
    where: { userId: user.id, revokedAt: null },
  })

  console.log('\n Platform Admin Table:')
  if (platformAdmin) {
    console.log(`✓ Found in PlatformAdmin table`)
    console.log(`  - Role: ${platformAdmin.role}`)
    console.log(`  - Created: ${platformAdmin.createdAt}`)
  } else {
    console.log('❌ NOT in PlatformAdmin table')
  }

  // 3. Check environment allowlist
  const allowlist = process.env.PLATFORM_SUPERADMINS?.split(',').map(e => e.trim().toLowerCase()) || []
  console.log('\n Environment Allowlist:')
  console.log(`  PLATFORM_SUPERADMINS="${process.env.PLATFORM_SUPERADMINS}"`)
  console.log(`  Parsed: ${JSON.stringify(allowlist)}`)
  console.log(`  ${allowlist.includes(email.toLowerCase()) ? '✓' : '❌'} ${email} ${allowlist.includes(email.toLowerCase()) ? 'IS' : 'is NOT'} in allowlist`)

  // 4. Final verdict
  console.log('\n' + '='.repeat(60))
  if (platformAdmin || allowlist.includes(email.toLowerCase())) {
    console.log('✅ User IS recognized as platform admin')
    console.log('   Redirect to /superadmin should work')
  } else {
    console.log('❌ User is NOT recognized as platform admin')
    console.log('   Solution: User exists but needs to be added to PlatformAdmin table')
    console.log('\n   Run this to add them:')
    console.log(`   npx tsx scripts/grant-platform-admin.ts ${user.id}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
