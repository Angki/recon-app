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
      console.log(`Evaluating Target: ${scan.target}`);
      console.log(`Scan Status: ${scan.status}`);
      console.log(`Start Time: ${scan.startTime}`);
      
      const counts = db.prepare('SELECT severity, count(*) as c FROM findings WHERE scanId=? GROUP BY severity').all(scan.scanId);
      console.log('\n--- FINDINGS SUMMARY ---');
      counts.forEach(row => console.log(`${row.severity}: ${row.c}`));
      
      const critical = db.prepare('SELECT * FROM findings WHERE scanId=? AND (severity=\'critical\' OR severity=\'high\' OR severity=\'medium\')').all(scan.scanId);
      console.log(`\n--- CRITICAL/HIGH/MEDIUM FINDINGS (${critical.length}) ---`);
      
      // Deduplicate findings by name to keep output clean
      const unique = {};
      critical.forEach(f => {
        if (!unique[f.name]) unique[f.name] = { count: 0, severity: f.severity, urls: [], type: f.type };
        unique[f.name].count++;
        if (unique[f.name].urls.length < 5) unique[f.name].urls.push(f.url);
      });
      
      for (const [name, data] of Object.entries(unique)) {
        console.log(`[${data.severity.toUpperCase()}] ${name} (Found ${data.count} times)`);
        console.log(`    Scanner: ${data.type}`);
        console.log(`    Sample URLs:`);
        data.urls.forEach(url => console.log(`      - ${url}`));
      }
      
    } else {
      console.log('No scans found in database.');
    }
  } catch (err) {
    console.error('Error reading DB:', err);
  }
  app.quit();
});
