import { prisma } from '../src/lib/prisma'

async function verifySuperadmin() {
  const email = 'ali@teamtakt.app'

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizationMemberships: {
        include: { organization: true }
      }
    }
  })

  if (!user) {
    console.error('User not found:', email)
    process.exit(1)
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    }
  })

  console.log('✅ Email verified for:', email)
  console.log('User ID:', user.id)
  console.log('Role:', user.role)
  console.log('Organization:', user.organizationMemberships[0]?.organization?.name || 'None')
  console.log('\n🎉 You can now log in at https://teamtakt.app/login')
}

verifySuperadmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
