import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin, createAdminAuditLog } from '@/lib/platform-admin'
import { z } from 'zod'

// Validation schema
const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  domain: z.string().min(1, 'Domain is required').regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, 'Invalid domain format'),
  country: z.string().optional(),
  subscriptionTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).default('STARTER'),
})

// POST /api/superadmin/organizations/create - Create new organization
export async function POST(request: Request) {
  try {
    const { session, platformAdmin } = await requirePlatformAdmin()

    const body = await request.json()
    const validationResult = createOrgSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { name, slug, domain, country, subscriptionTier } = validationResult.data

    // Check if slug already exists
    const existingSlug = await prisma.organization.findUnique({
      where: { slug },
    })

    if (existingSlug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SLUG_EXISTS',
            message: 'An organization with this slug already exists',
          },
        },
        { status: 400 }
      )
    }

    // Check if domain already exists
    const existingDomain = await prisma.organizationDomain.findUnique({
      where: { domain },
    })

    if (existingDomain) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DOMAIN_EXISTS',
            message: 'This email domain is already registered to another organization',
          },
        },
        { status: 400 }
      )
    }

    // Create organization with settings and domain in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          country: country || 'SA',
          subscriptionTier,
          subscriptionStatus: 'ACTIVE',
          status: 'ACTIVE',
          isActive: true,
        },
      })

      // Create organization settings with defaults
      await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
          // Use default labels from schema
        },
      })

      // Create organization domain
      const orgDomain = await tx.organizationDomain.create({
        data: {
          organizationId: organization.id,
          domain,
          isPrimary: true,
          isVerified: true, // Auto-verify for admin-created orgs
          verifiedAt: new Date(),
        },
      })

      return { organization, domain: orgDomain }
    })

    // Create audit log
    await createAdminAuditLog({
      adminUserId: session.user.id,
      adminEmail: session.user.email,
      actionType: 'organization.create',
      targetType: 'organization',
      targetId: result.organization.id,
      targetName: name,
      afterState: {
        name,
        slug,
        domain,
        country,
        subscriptionTier,
      },
      reason: 'Organization created by platform admin',
    })

    return NextResponse.json({
      success: true,
      data: {
        organization: result.organization,
        domain: result.domain,
        message: `Organization "${name}" created successfully with domain @${domain}`,
      },
    })
  } catch (error: any) {
    console.error('Create organization error:', error)

    if (error.message?.includes('UNAUTHORIZED') || error.message?.includes('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: error.message } },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    )
  }
}
