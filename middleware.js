import { NextResponse } from "next/server";

const DEMO_TOKEN = "demo-token";

export function middleware(request) {
  const token = request.cookies.get("token")?.value;
  const bypassLogin = process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";
  const isDemoToken = token === DEMO_TOKEN;

  const { pathname } = request.nextUrl;

  // Paths reachable without being logged in. /reset-password is dynamic
  // ('/reset-password/<token>'), so it needs a startsWith check rather than
  // an exact match - an .includes() on the array alone would never match it.
  const publicPaths = ["/login", "/signup", "/forgot-password"];
  const isPublicPath =
    publicPaths.includes(pathname) || pathname.startsWith("/reset-password/");

  // Only /login and /signup should bounce an already-authenticated visitor
  // back to the app. Forgot/reset-password deliberately stay reachable even
  // with a valid session token - e.g. someone resetting a stale session, or
  // opening the emailed reset link in a second tab while still logged in
  // elsewhere - so they're excluded from this list on purpose.
  const authRedirectPaths = ["/login", "/signup"];
  const isAuthRedirectPath = authRedirectPaths.includes(pathname);

  if (bypassLogin) {
    // In bypass mode, allow all app routes through without requiring the backend token.
    return NextResponse.next();
  }

  // Accept either a real token or a demo token
  const hasValidToken = token && (isDemoToken || token.length > 0);

  // If there's no valid token, redirect to login unless it's a public path
  if (!hasValidToken && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If there's a token and trying to access login/signup, redirect to dashboard or forms
  if (hasValidToken && isAuthRedirectPath) {
    // We don't know the role here easily, so we redirect to /
    // and let the client-side auth context handle further redirection if needed
    return NextResponse.redirect(new URL("/", request.url));
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
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
