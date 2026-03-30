import { NextResponse } from 'next/server';
import { createBackup, isAuthenticated } from '@/lib/google-sheets';

// POST /api/backup — Create a backup
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const filePath = await createBackup();
    return NextResponse.json({ success: true, path: filePath, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
