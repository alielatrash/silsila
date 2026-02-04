#!/usr/bin/env tsx
/**
 * Sync Production Database Schema
 *
 * This script uses `prisma db push` to sync the schema to production
 * without running migrations. This is more reliable for databases that
 * may be sleeping (like Neon free tier).
 *
 * Usage:
 *   npx tsx scripts/sync-production-db.ts
 *
 * Or with production DATABASE_URL:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/sync-production-db.ts
 */

import { execSync } from 'child_process'
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
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

console.log('🔄 Syncing production database schema...')
console.log('')

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set')
  console.log('Set it in your shell or .env file')
  process.exit(1)
}

// Extract hostname to verify it's production
const dbUrl = process.env.DATABASE_URL
const isProduction = !dbUrl.includes('localhost')

if (isProduction) {
  console.log('⚠️  WARNING: This will modify your PRODUCTION database')
  console.log('')
  console.log('Database:', dbUrl.replace(/:[^:@]+@/, ':****@'))
  console.log('')
}

try {
  // Use db push instead of migrate deploy
  // db push is better for sleeping databases as it doesn't need advisory locks
  console.log('Running: prisma db push --accept-data-loss...')
  console.log('')

  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
  })

  console.log('')
  console.log('✅ Database schema synced successfully!')
  console.log('')
  console.log('You can now:')
  console.log('1. Try inviting users again')
  console.log('2. Check that all features work correctly')

} catch (error) {
  console.error('')
  console.error('❌ Failed to sync database')
  console.error('')
  console.error('Common issues:')
  console.error('1. Database is sleeping - go to Neon console and wake it up')
  console.error('2. Wrong DATABASE_URL - verify the connection string')
  console.error('3. Network issues - check your internet connection')
  console.error('')
  process.exit(1)
}
