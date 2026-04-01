import { NextResponse } from 'next/server';
import { getAuthUrl, testSheetsConnection } from '@/lib/google-sheets';

export async function GET() {
  const sheetsConnected = await testSheetsConnection();
  const authUrl = getAuthUrl();
  const groqConnected = !!process.env.GROQ_API_KEY;

  const uptimeSeconds = Math.floor(process.uptime());
  const uptimeStr = uptimeSeconds < 60
    ? `${uptimeSeconds}s`
    : uptimeSeconds < 3600
      ? `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`
      : `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;

  return NextResponse.json({
    googleSheets: { connected: sheetsConnected, authUrl },
    groqAI: { connected: groqConnected },
    server: {
      port: process.env.PORT || 5000,
      env: process.env.NODE_ENV || 'development',
      uptime: uptimeStr,
    },
  });
}
