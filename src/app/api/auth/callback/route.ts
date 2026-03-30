import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/google-sheets';

// GET /api/auth/callback?code=xxx — Handle OAuth2 callback
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    await exchangeCode(code);
    // Redirect to dashboard after successful auth
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
