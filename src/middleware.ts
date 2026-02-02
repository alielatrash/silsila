import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware: Minimal routing logic
 *
 * Note: Organization suspension checking has been moved to server components
 * because middleware runs on Edge Runtime which doesn't support Prisma.
 *
 * Suspension is now enforced in:
 * - src/app/(dashboard)/layout.tsx (checks org status on every dashboard page load)
 * - All API route handlers (check org status before processing requests)
 */

export async function middleware(request: NextRequest) {
  // This middleware is currently minimal
  // All auth and suspension checks happen in layouts and API routes
  return NextResponse.next()
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
