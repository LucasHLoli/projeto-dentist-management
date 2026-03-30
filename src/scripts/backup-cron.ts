// Script to run daily backups at 1 AM
// Run via: npx tsx src/scripts/backup-cron.ts
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

console.log('Starting Backup Cron Job Service...');
console.log('Backups will run automatically every day at 01:00 AM');

// Function to trigger the Next.js API route
function runBackup() {
  console.log(`[${new Date().toISOString()}] Triggering scheduled backup...`);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/backup',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.success) {
          console.log(`✅ Backup successful! Saved to: ${result.path}`);
        } else {
          console.error('❌ Backup failed:', result.error);
        }
      } catch (e) {
        console.error('Failed to parse backup response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Failed to reach backup API (is Next.js server running on port 3000?):', error.message);
  });

  req.end();
}

// Check every minute if it's 1 AM
setInterval(() => {
  const now = new Date();
  // If it's 1:00 AM (and we are in the 0th minute)
  if (now.getHours() === 1 && now.getMinutes() === 0) {
    runBackup();
  }
}, 60 * 1000); // Check every minute

console.log('Cron service is active. Waiting for 01:00 AM...');
