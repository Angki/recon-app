const { app } = require('electron');
const Database = require('better-sqlite3');
const os = require('os');
const path = require('path');

app.whenReady().then(() => {
  const dbPath = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'recon_app.sqlite');
  try {
    const db = new Database(dbPath);
    const scan = db.prepare('SELECT * FROM scans ORDER BY startTime DESC LIMIT 1').get();
    if (scan) {
      const findings = db.prepare('SELECT * FROM findings WHERE scanId=?').all(scan.scanId);
      console.log('---SCAN_START---');
      console.log(JSON.stringify({ scan, findings }, null, 2));
      console.log('---SCAN_END---');
    } else {
      console.log('---SCAN_START---');
      console.log('No scans found');
      console.log('---SCAN_END---');
    }
  } catch (err) {
    console.error(err);
  }
  app.quit();
});
