import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validationResult = forgotPasswordSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email address',
          },
        },
        { status: 400 }
      )
    }

    const { email } = validationResult.data

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour from now

    // Save token to database
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    })

    // Send password reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`

    console.log('[FORGOT-PASSWORD] Attempting to send password reset email to:', user.email)
    console.log('[FORGOT-PASSWORD] RESEND_API_KEY available:', !!process.env.RESEND_API_KEY)
    console.log('[FORGOT-PASSWORD] Reset URL:', resetUrl)

    try {
      const { sendPasswordResetEmail } = await import('@/lib/email')
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetUrl,
      })
      console.log('[FORGOT-PASSWORD] Password reset email sent successfully:', emailResult)
    } catch (emailError) {
      console.error('[FORGOT-PASSWORD] Failed to send password reset email:', emailError)
      // Don't fail the request if email fails - token is still valid
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
