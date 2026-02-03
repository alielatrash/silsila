import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// Load .env file manually
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["'](.*)["']$/, '$1')
      process.env[key] = value
    }
  })
}

const prisma = new PrismaClient()

async function bootstrapSuperadmin() {
  try {
    console.log('🔍 Checking PLATFORM_SUPERADMINS environment variable...')

    const superadminsEnv = process.env.PLATFORM_SUPERADMINS
    if (!superadminsEnv) {
      console.error('❌ PLATFORM_SUPERADMINS not found in environment variables')
      console.log('Set it in .env file like: PLATFORM_SUPERADMINS="ali@teamtakt.app"')
      process.exit(1)
    }

    console.log('✅ PLATFORM_SUPERADMINS found:', superadminsEnv)

    const superadminEmails = superadminsEnv.split(',').map(e => e.trim().toLowerCase())
    console.log(`📧 Superadmin emails: ${superadminEmails.join(', ')}`)
    console.log('')

    for (const email of superadminEmails) {
      console.log(`\n🔍 Processing ${email}...`)

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        console.log(`⚠️  User ${email} not found in database. They need to register first.`)
        continue
      }

      console.log(`✅ User found: ${user.firstName} ${user.lastName} (${user.id})`)

      // Check if already in PlatformAdmin table
      const existingAdmin = await prisma.platformAdmin.findUnique({
        where: { userId: user.id },
      })

      if (existingAdmin) {
        if (existingAdmin.revokedAt) {
          console.log(`⚠️  User is in PlatformAdmin table but REVOKED. Un-revoking...`)
          await prisma.platformAdmin.update({
            where: { userId: user.id },
            data: {
              revokedAt: null,
              revokedBy: null,
            },
          })
          console.log('✅ Platform admin access restored')
        } else {
          console.log('✅ User already has platform admin access')
        }
      } else {
        console.log('➕ Adding user to PlatformAdmin table...')
        await prisma.platformAdmin.create({
          data: {
            userId: user.id,
            email: user.email.toLowerCase(),
            role: 'SUPER_ADMIN',
            createdBy: null, // Bootstrap - no creator
            revokedAt: null,
            revokedBy: null,
          },
        })
        console.log('✅ User granted platform admin access')
      }
    }

    console.log('\n✅ Superadmin bootstrap complete!')
    console.log(`\n🔐 Platform admins can now log in and will be redirected to /superadmin`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

bootstrapSuperadmin()
