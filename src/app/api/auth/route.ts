import { NextResponse } from 'next/server';
import { getAuthUrl, isAuthenticated } from '@/lib/google-sheets';

// GET /api/auth — Check auth status or get auth URL
export async function GET() {
  if (isAuthenticated()) {
    return NextResponse.json({ authenticated: true });
  }
  
  const url = getAuthUrl();
  return NextResponse.json({ authenticated: false, authUrl: url });
}
