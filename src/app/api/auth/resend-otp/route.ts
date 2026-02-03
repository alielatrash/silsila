import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOTP } from '@/lib/otp'
import { sendOTPEmail } from '@/lib/email'

interface ResendOTPRequest {
  userId: string
  email: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ResendOTPRequest
    const { userId, email } = body

    // Validate input
    if (!userId || !email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID and email are required',
          },
        },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()

    // Check if user exists and email matches
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.email !== normalizedEmail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found or email does not match',
          },
        },
        { status: 404 }
      )
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_VERIFIED',
            message: 'Email is already verified',
          },
        },
        { status: 400 }
      )
    }

    // Generate new OTP and send email
    console.log('[RESEND-OTP] Generating new OTP for user:', userId, normalizedEmail)
    const otpCode = await createOTP(userId, 'EMAIL_VERIFICATION')
    console.log('[RESEND-OTP] OTP generated successfully:', otpCode.substring(0, 2) + '****')

    console.log('[RESEND-OTP] Attempting to send OTP email to:', normalizedEmail)
    console.log('[RESEND-OTP] RESEND_API_KEY available:', !!process.env.RESEND_API_KEY)
    console.log('[RESEND-OTP] EMAIL_FROM:', process.env.EMAIL_FROM)

    try {
      const emailResult = await sendOTPEmail({
        to: normalizedEmail,
        firstName: user.firstName,
        otp: otpCode,
        purpose: 'verification',
      })
      console.log('[RESEND-OTP] OTP email sent successfully:', emailResult)
    } catch (emailError) {
      console.error('[RESEND-OTP] Failed to send OTP email:', emailError)
      throw emailError // Re-throw to return error to user
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Verification code sent successfully',
      },
    })
  } catch (error) {
    console.error('Resend OTP error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}
