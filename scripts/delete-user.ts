/**
 * Safe User Deletion Script
 *
 * Usage: npx tsx scripts/delete-user.ts <email>
 * Example: npx tsx scripts/delete-user.ts user@example.com
 */

import { prisma } from '../src/lib/prisma'

async function deleteUser(email: string) {
  console.log(`\n🔍 Looking for user: ${email}`)

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizationMemberships: {
        include: { organization: true },
      },
      _count: {
        select: {
          sessions: true,
          demandForecasts: true,
          supplyCommitments: true,
          auditLogs: true,
        },
      },
    },
  })

  if (!user) {
    console.error(`❌ User not found: ${email}`)
    process.exit(1)
  }

  console.log(`\n📋 User Details:`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Name: ${user.firstName} ${user.lastName}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Organizations: ${user.organizationMemberships.length}`)
  console.log(`   Sessions: ${user._count.sessions}`)
  console.log(`   Demand Forecasts: ${user._count.demandForecasts}`)
  console.log(`   Supply Commitments: ${user._count.supplyCommitments}`)
  console.log(`   Audit Logs: ${user._count.auditLogs}`)

  console.log(`\n🗑️  Deleting user and all related data...`)

  // Delete ActivityEvents that reference this user (no foreign key, so manual delete)
  const deletedActivity = await prisma.activityEvent.deleteMany({
    where: { actorUserId: user.id },
  })
  console.log(`   ✅ Deleted ${deletedActivity.count} activity events`)

  // Delete AdminAuditLogs (if user was a platform admin)
  const deletedAuditLogs = await prisma.adminAuditLog.deleteMany({
    where: { adminUserId: user.id },
  })
  console.log(`   ✅ Deleted ${deletedAuditLogs.count} admin audit logs`)

  // Delete PlatformAdmin record (if exists)
  const deletedPlatformAdmin = await prisma.platformAdmin.deleteMany({
    where: { userId: user.id },
  })
  if (deletedPlatformAdmin.count > 0) {
    console.log(`   ✅ Removed platform admin access`)
  }

  // Now delete the user (cascades will handle the rest)
  await prisma.user.delete({
    where: { id: user.id },
  })

  console.log(`\n✅ User deleted successfully!`)
  console.log(`   The following were automatically deleted (cascade):`)
  console.log(`   - All sessions`)
  console.log(`   - All OTP codes`)
  console.log(`   - All audit logs`)
  console.log(`   - All notifications`)
  console.log(`   - All password reset tokens`)
  console.log(`   - All demand forecasts`)
  console.log(`   - All supply commitments`)
  console.log(`   - All organization memberships`)
  console.log(`   - All managed clients`)
}

// Get email from command line args
const email = process.argv[2]

if (!email) {
  console.error('❌ Please provide an email address')
  console.log('Usage: npx tsx scripts/delete-user.ts <email>')
  process.exit(1)
}

deleteUser(email)
  .catch((error) => {
    console.error('❌ Error deleting user:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
