import NextAuth from 'next-auth';

import authConfig from '@/auth.config';
import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
} from '@/routes';

const { auth } = NextAuth(authConfig);

export default auth((req, ctx) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);
  
  // Добавляем проверку для маршрутов с /api/librespeed и /api/fastcom
  const isLibreSpeedRoute = nextUrl.pathname.startsWith('/api/librespeed');
  const isFastComRoute = nextUrl.pathname.startsWith('/api/fastcom') || 
                          nextUrl.pathname.startsWith('/api/fasttoken') || 
                          nextUrl.pathname.startsWith('/api/fasturls') ||
                          nextUrl.pathname.startsWith('/api/fastcom-check');

  if (isApiAuthRoute) {
    return;
  }
  
  // Пропускаем все запросы к LibreSpeed API и Fast.com API
  if (isLibreSpeedRoute || isFastComRoute) {
    console.log('Middleware: разрешен доступ без авторизации к:', nextUrl.pathname);
    return;
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }
    return;
  }

  if (!isLoggedIn && !isPublicRoute) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) {
      callbackUrl += nextUrl.search;
    }

    const encodedCallbackUrl = encodeURIComponent(callbackUrl);

    return Response.redirect(
      new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    );
  }

  return;
});

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)', 
    '/', 
    // Обновляем matcher, чтобы исключить маршруты librespeed и fastcom
    '/(api|trpc)((?!/librespeed)(?!/fastcom)(?!/fasttoken)(?!/fasturls)(?!/fastcom-check).*)',
  ],
};
