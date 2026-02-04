import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteInvitation() {
  const email = 'pierre@trella.app'

  console.log(`🗑️  Deleting pending invitation for: ${email}`)
  console.log('')

  const result = await prisma.invitation.deleteMany({
    where: {
      email,
      acceptedAt: null,
    },
  })

  console.log(`✅ Deleted ${result.count} invitation(s)`)
  console.log('')
  console.log('You can now send a new invitation!')

  await prisma.$disconnect()
}

deleteInvitation()
