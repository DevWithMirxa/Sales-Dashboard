import { NextResponse } from 'next/server';

const DEMO_TOKEN = 'demo-token';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const bypassLogin = process.env.NEXT_PUBLIC_BYPASS_LOGIN === 'true'
  const isDemoToken = token === DEMO_TOKEN;

  const { pathname } = request.nextUrl;
  
  // Public paths that don't require protection
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.includes(pathname);

  if (bypassLogin) {
    // In bypass mode, allow all app routes through without requiring the backend token.
    return NextResponse.next()
  }

  // Accept either a real token or a demo token
  const hasValidToken = token && (isDemoToken || token.length > 0);

  // If there's no valid token, redirect to login unless it's a public path
  if (!hasValidToken && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If there's a token and trying to access login/signup, redirect to dashboard or forms
  if (hasValidToken && isPublicPath) {
    // We don't know the role here easily, so we redirect to / 
    // and let the client-side auth context handle further redirection if needed
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
