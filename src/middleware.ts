import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from './lib/prisma'

/**
 * Middleware: Organization Suspension Enforcement
 *
 * This middleware:
 * 1. Checks if the user's organization is suspended
 * 2. Blocks access to all app routes if suspended
 * 3. Allows access to superadmin routes only for platform admins
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes (auth, landing, etc.)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static')
  ) {
    return NextResponse.next()
  }

  // For superadmin routes, we'll handle auth in the route handlers
  // (more complex logic needed to check PlatformAdmin table)
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    return NextResponse.next()
  }

  // For dashboard routes, check organization suspension
  // We need to get the session token from cookies
  const sessionToken = request.cookies.get('takt_session')?.value

  if (!sessionToken) {
    // Not logged in, let the layout redirect to login
    return NextResponse.next()
  }

  try {
    // Fetch session and check org status
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            currentOrgId: true,
          },
        },
      },
    })

    if (!session || !session.user.currentOrgId) {
      return NextResponse.next()
    }

    // Check if organization is suspended
    const org = await prisma.organization.findUnique({
      where: { id: session.user.currentOrgId },
      select: {
        status: true,
        suspendedReason: true,
      },
    })

    if (org?.status === 'SUSPENDED') {
      // Redirect to suspended page
      const url = request.nextUrl.clone()
      url.pathname = '/suspended'
      url.searchParams.set('reason', org.suspendedReason || 'Your organization has been suspended')
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow request through (fail open for now)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
