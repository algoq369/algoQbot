import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Routes qui nécessitent l'authentification
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/governance',
  '/academy',
]

// Routes publiques (accessibles sans auth)
const publicRoutes = [
  '/',
  '/chat',
  '/kids',
  '/book',
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Vérifier si la route actuelle est protégée
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  )

  // Si c'est une route publique, laisser passer
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Pour les routes protégées, vérifier le token
  const token = request.cookies.get('token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '')

  // Si pas de token, rediriger vers login
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token présent, laisser passer
  return NextResponse.next()
}

// Configuration : Matcher pour toutes les routes sauf les assets statiques
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
}
