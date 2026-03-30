# DentFlow — Gestão Odontológica

A dental clinic management system built with Next.js that integrates with Google Sheets for patient data (prontuários), financial data, appointments, and inventory.

## Architecture

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Custom CSS (globals.css)
- **Data Source**: Google Sheets via Google Sheets API v4
- **Auth**: Google OAuth2 (via googleapis library)
- **Charts**: Recharts
- **Icons**: Lucide React

## Project Structure

```
src/
  app/           # Next.js App Router pages
    api/         # API routes (auth, sheets, backup)
    assistente/  # AI assistant page
    atendimentos/ # Appointments page
    dfc/         # Cash flow page
    dre/         # P&L page
    estoque/     # Inventory page
    financeiro/  # Financials page
    pacientes/   # Patients page
    receita/     # Revenue page
    retornos/    # Returns page
  components/    # Shared components (Sidebar, AIChat)
  lib/           # Utilities (google-config, google-sheets, data)
  scripts/       # Backup cron script
```

## Environment Variables (Secrets)

All Google credentials must be stored as Replit secrets:

| Secret | Description |
|--------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client Secret |
| `GOOGLE_SPREADSHEET_ID` | Target Google Spreadsheet ID (set as env var, not secret) |
| `GOOGLE_REDIRECT_URI` | OAuth2 redirect URI (auto-set if not provided) |

## Running

The app runs on port 5000 via `npm run dev` (dev) or `npm run start` (production).

## Google OAuth Setup

1. Go to Google Cloud Console
2. Enable Sheets API and Drive API
3. Create OAuth2 credentials
4. Add the Replit dev domain as an authorized redirect URI:
   `https://<your-replit-domain>/api/auth/callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Replit secrets

## Security Notes

- Google credentials are loaded from environment variables, never hardcoded
- OAuth tokens are stored in `google-token.json` (gitignored)
- Patient data (PII) is accessed via Google Sheets API only — not stored locally
