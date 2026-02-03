import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/password'

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10')
const MAX_OTP_ATTEMPTS = 5

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Create and store an OTP code for a user
 */
export async function createOTP(
  userId: string,
  purpose: 'EMAIL_VERIFICATION' | 'LOGIN'
): Promise<string> {
  // Generate OTP
  const code = generateOTP()
  const codeHash = await hashPassword(code)

  // Calculate expiry time
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

  // Invalidate any existing unused OTPs for this purpose
  await prisma.oTPCode.updateMany({
    where: {
      userId,
      purpose,
      usedAt: null,
    },
    data: {
      usedAt: new Date(), // Mark as used to invalidate
    },
  })

  // Create new OTP
  await prisma.oTPCode.create({
    data: {
      userId,
      code: codeHash,
      purpose,
      expiresAt,
    },
  })

  return code // Return plain code to send via email
}

/**
 * Verify an OTP code
 */
export async function verifyOTP(
  userId: string,
  code: string,
  purpose: 'EMAIL_VERIFICATION' | 'LOGIN'
): Promise<{
  valid: boolean
  error?: string
}> {
  // Find the most recent unused OTP for this purpose
  const otpRecord = await prisma.oTPCode.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!otpRecord) {
    return {
      valid: false,
      error: 'No valid OTP found. Please request a new code.',
    }
  }

  // Check if OTP has expired
  if (new Date() > otpRecord.expiresAt) {
    return {
      valid: false,
      error: 'OTP has expired. Please request a new code.',
    }
  }

  // Check if max attempts exceeded
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    return {
      valid: false,
      error: 'Too many failed attempts. Please request a new code.',
    }
  }

  // Increment attempts
  await prisma.oTPCode.update({
    where: { id: otpRecord.id },
    data: {
      attempts: otpRecord.attempts + 1,
    },
  })

  // Verify the code
  const isValid = await verifyPassword(code, otpRecord.code)

  if (!isValid) {
    // Check if this was the last attempt
    if (otpRecord.attempts + 1 >= MAX_OTP_ATTEMPTS) {
      return {
        valid: false,
        error: 'Invalid code. Maximum attempts reached. Please request a new code.',
      }
    }

    return {
      valid: false,
      error: `Invalid code. ${MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1)} attempts remaining.`,
    }
  }

  // Mark OTP as used
  await prisma.oTPCode.update({
    where: { id: otpRecord.id },
    data: {
      usedAt: new Date(),
    },
  })

  return { valid: true }
}

/**
 * Check if a user has a valid unused OTP
 */
export async function hasValidOTP(
  userId: string,
  purpose: 'EMAIL_VERIFICATION' | 'LOGIN'
): Promise<boolean> {
  const otpRecord = await prisma.oTPCode.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  return !!otpRecord
}
