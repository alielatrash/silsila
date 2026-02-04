import * as fs from 'fs'
import * as path from 'path'

// Load .env file
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

console.log('🔍 Testing invitation flow configuration...')
console.log('')

const requiredVars = {
  'DATABASE_URL': process.env.DATABASE_URL,
  'RESEND_API_KEY': process.env.RESEND_API_KEY,
  'EMAIL_FROM': process.env.EMAIL_FROM,
  'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL,
}

let allGood = true

for (const [key, value] of Object.entries(requiredVars)) {
  if (!value) {
    console.log(`❌ ${key}: NOT SET`)
    allGood = false
  } else if (key === 'RESEND_API_KEY') {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`)
  } else if (key === 'DATABASE_URL') {
    console.log(`✅ ${key}: ${value.replace(/:[^:@]+@/, ':****@').substring(0, 80)}...`)
  } else {
    console.log(`✅ ${key}: ${value}`)
  }
}

console.log('')

if (!allGood) {
  console.log('⚠️  Missing environment variables!')
  console.log('')
  console.log('Make sure to set these in Vercel:')
  console.log('1. Go to Vercel Dashboard → Settings → Environment Variables')
  console.log('2. Add any missing variables')
  console.log('3. Redeploy')
} else {
  console.log('✅ All required environment variables are set!')
  console.log('')
  console.log('The invitation URL will be:')
  console.log(`${process.env.NEXT_PUBLIC_APP_URL}/invite/[token]`)
}
