import { google } from 'googleapis';
import { GOOGLE_CONFIG, PRONTUARIO_COLUMNS } from './google-config';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');

// Create OAuth2 client
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CONFIG.clientId,
    GOOGLE_CONFIG.clientSecret,
    GOOGLE_CONFIG.redirectUri
  );
}

// Get auth URL for initial login
export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_CONFIG.scopes,
  });
}

// Exchange code for tokens
export async function exchangeCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

// Get authenticated client (uses saved token)
export function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client();

  if (!fs.existsSync(TOKEN_PATH)) {
    return null; // Not authenticated yet
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(tokens);

  // Auto-refresh token
  oauth2Client.on('tokens', (newTokens) => {
    const currentTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    const merged = { ...currentTokens, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  return oauth2Client;
}

// Check if authenticated
export function isAuthenticated() {
  return fs.existsSync(TOKEN_PATH);
}

// ========== SHEETS OPERATIONS ==========

// Read all prontuário data from Google Sheets
export async function readProntuario(): Promise<Record<string, string>[]> {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
    range: 'Prontuário',
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row, index) => {
    const record: Record<string, string> = { _rowIndex: String(index + 2) }; // 1-indexed + header
    headers.forEach((header: string, i: number) => {
      record[header] = row[i] || '';
    });
    return record;
  });
}

// Read a specific sheet
export async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
    range: sheetName,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row, idx) => {
    const record: Record<string, string> = { _rowIndex: String(idx + 2) };
    headers.forEach((header: string, i: number) => {
      record[header] = row[i] || '';
    });
    return record;
  });
}

// Update a specific cell in Google Sheets
export async function updateCell(sheetName: string, rowIndex: number, colIndex: number, value: string) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const sheets = google.sheets({ version: 'v4', auth });
  const colLetter = getColumnLetter(colIndex);
  const range = `${sheetName}!${colLetter}${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

// Update an entire row in Google Sheets  
export async function updateRow(sheetName: string, rowIndex: number, values: string[]) {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${sheetName}!A${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Get all sheet names
export async function getSheetNames(): Promise<string[]> {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.get({
    spreadsheetId: GOOGLE_CONFIG.spreadsheetId,
  });

  return response.data.sheets?.map(s => s.properties?.title || '') || [];
}

// ========== BACKUP ==========

export async function createBackup() {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not authenticated');

  const sheetNames = await getSheetNames();
  const backup: Record<string, Record<string, string>[]> = {};

  for (const name of sheetNames) {
    try {
      backup[name] = await readSheet(name);
    } catch (e) {
      console.error(`Error backing up sheet ${name}:`, e);
    }
  }

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

  return filePath;
}

// ========== HELPERS ==========

function getColumnLetter(colIndex: number): string {
  let letter = '';
  while (colIndex >= 0) {
    letter = String.fromCharCode((colIndex % 26) + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
}
