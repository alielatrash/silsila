import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyOTP } from '@/lib/otp'
import { createSession, setSessionCookie } from '@/lib/auth'
import { createAuditLog, AuditAction } from '@/lib/audit'

interface VerifyOTPRequest {
  userId: string
  code: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as VerifyOTPRequest
    const { userId, code } = body

    // Validate input
    if (!userId || !code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID and verification code are required',
          },
        },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
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

    // Verify OTP
    const verificationResult = await verifyOTP(userId, code, 'EMAIL_VERIFICATION')

    if (!verificationResult.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_OTP',
            message: verificationResult.error || 'Invalid or expired verification code',
          },
        },
        { status: 400 }
      )
    }

    // Update user's email verification status
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    // Create session and set cookie
    const userAgent = request.headers.get('user-agent') || undefined
    const token = await createSession(userId, userAgent)
    await setSessionCookie(token)

    // Get organization name for response
    const organizationName = user.memberships[0]?.organization?.name || 'Unknown'

    // Audit log
    await createAuditLog({
      userId,
      action: AuditAction.USER_LOGIN,
      entityType: 'User',
      entityId: userId,
      metadata: {
        email: user.email,
        emailVerified: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.currentOrgId,
          organizationName,
        },
      },
    })
  } catch (error) {
    console.error('OTP verification error:', error)
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
