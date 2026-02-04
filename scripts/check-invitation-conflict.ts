import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkConflict() {
  const email = 'pierre@trella.app'

  console.log(`🔍 Checking conflict for: ${email}`)
  console.log('')

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      organizationMemberships: {
        include: {
          organization: true,
        },
      },
    },
  })

  if (existingUser) {
    console.log('✅ User exists:')
    console.log('   ID:', existingUser.id)
    console.log('   Name:', existingUser.firstName, existingUser.lastName)
    console.log('   Email:', existingUser.email)
    console.log('   Organizations:')
    existingUser.organizationMemberships.forEach(membership => {
      console.log(`   - ${membership.organization.name} (${membership.role})`)
    })
    console.log('')
  } else {
    console.log('❌ User does NOT exist')
    console.log('')
  }

  // Check for pending invitations
  const pendingInvitations = await prisma.invitation.findMany({
    where: {
      email,
      acceptedAt: null,
    },
  })

  // Get organization names separately
  const orgsMap = new Map()
  for (const inv of pendingInvitations) {
    if (!orgsMap.has(inv.organizationId)) {
      const org = await prisma.organization.findUnique({
        where: { id: inv.organizationId },
        select: { name: true },
      })
      orgsMap.set(inv.organizationId, org?.name || 'Unknown')
    }
  }

  if (pendingInvitations.length > 0) {
    console.log(`📧 Found ${pendingInvitations.length} pending invitation(s):`)
    pendingInvitations.forEach((inv, i) => {
      console.log(`   ${i + 1}. Organization: ${orgsMap.get(inv.organizationId)}`)
      console.log(`      Role: ${inv.functionalRole}`)
      console.log(`      Created: ${inv.createdAt}`)
      console.log(`      Expires: ${inv.expiresAt}`)
      console.log(`      Token: ${inv.token.substring(0, 8)}...`)

      // Check if expired
      if (inv.expiresAt < new Date()) {
        console.log(`      ⚠️  EXPIRED`)
      }
      console.log('')
    })

    console.log('💡 Solution: Delete expired/duplicate invitations:')
    console.log(`   DELETE FROM "Invitation" WHERE email = '${email}' AND "acceptedAt" IS NULL;`)
  } else {
    console.log('✅ No pending invitations found')
  }

  await prisma.$disconnect()
}

checkConflict()
