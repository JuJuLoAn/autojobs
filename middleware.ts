import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== '/api/jobs') return NextResponse.next();
  if (request.nextUrl.searchParams.get('__raw') === '1') return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/api/profile-jobs';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/api/jobs'],
};
