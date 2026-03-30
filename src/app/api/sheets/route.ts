import { NextRequest, NextResponse } from 'next/server';
import { readProntuario, readSheet, updateCell, isAuthenticated } from '@/lib/google-sheets';

// GET /api/sheets?sheet=Prontuário — Read data from sheets
export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Not authenticated', authenticated: false }, { status: 401 });
  }

  const sheetName = request.nextUrl.searchParams.get('sheet') || 'Prontuário';

  try {
    const data = sheetName === 'Prontuário' ? await readProntuario() : await readSheet(sheetName);
    return NextResponse.json({ data, count: data.length, sheet: sheetName });
  } catch (error: any) {
    console.error('Sheets read error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/sheets — Update a cell
export async function PUT(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sheet, row, col, value } = body;

    if (!sheet || !row || col === undefined || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields: sheet, row, col, value' }, { status: 400 });
    }

    await updateCell(sheet, row, col, value);
    return NextResponse.json({ success: true, updated: { sheet, row, col, value } });
  } catch (error: any) {
    console.error('Sheets update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
