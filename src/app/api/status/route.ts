import { NextResponse } from 'next/server';
import { isAuthenticated, getAuthUrl } from '@/lib/google-sheets';

export async function GET() {
  const sheetsConnected = isAuthenticated();
  const authUrl = sheetsConnected ? null : getAuthUrl();
  const groqConnected = !!process.env.GROQ_API_KEY;

  return NextResponse.json({
    googleSheets: { connected: sheetsConnected, authUrl },
    groqAI: { connected: groqConnected },
  });
}
