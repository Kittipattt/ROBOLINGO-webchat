import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLinePost = request.method === 'POST' && request.headers.has('x-line-signature');

  // If LINE webhook request is sent to root "/" or has trailing slash, rewrite to /api/line/webhook
  if (isLinePost && pathname === '/') {
    return NextResponse.rewrite(new URL('/api/line/webhook', request.url));
  }

  // Handle common webhook path variations
  if (pathname === '/webhook' || pathname === '/api/webhook' || pathname === '/api/line/webhook/') {
    return NextResponse.rewrite(new URL('/api/line/webhook', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/webhook', '/api/webhook', '/api/line/webhook/'],
};
