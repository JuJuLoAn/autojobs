import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.get('__raw') === '1') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/api/profile-jobs';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: '/api/jobs',
};
