import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIES = ['loka_at', 'loka_rt']

/**
 * Optimistic route protection only. The Express backend validates the session
 * and role for every protected API request, and RoleGate re-checks the role on
 * the client. This middleware prevents unauthenticated users from briefly
 * seeing a protected page shell.
 */
export function middleware(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some(
    (name) => Boolean(request.cookies.get(name)?.value)
  )

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/customer/:path*', '/provider/:path*', '/admin/:path*'],
}
