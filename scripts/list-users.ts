import { prisma } from '../src/lib/prisma'

async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      emailVerified: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  console.log('Users in database:')
  console.table(users)
}

listUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
