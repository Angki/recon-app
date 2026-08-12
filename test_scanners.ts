import { getAdapter } from './electron/services/scanners/registry';
import fs from 'fs';
import path from 'path';

async function testParsers() {
  const tools = ['subfinder', 'dnsx', 'httpx'];
  const testDir = path.join(process.cwd(), 'temp_test');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  // Create mock output files for each tool
  fs.writeFileSync(path.join(testDir, 'subfinder.json'), '{"host":"hackerone.com","source":"alienvault"}\n{"host":"api.hackerone.com","source":"crtsh"}');
  fs.writeFileSync(path.join(testDir, 'dnsx.json'), '{"host":"hackerone.com","a":["104.16.99.52"],"status_code":"NOERROR"}\n{"host":"api.hackerone.com","a":["104.16.100.52"],"status_code":"NOERROR"}');
  fs.writeFileSync(path.join(testDir, 'httpx.json'), '{"url":"https://hackerone.com","title":"HackerOne","webserver":"cloudflare","tech":["React", "Node.js"],"status_code":200}\n{"url":"http://api.hackerone.com","status_code":403,"webserver":"nginx"}');

  for (const tool of tools) {
    console.log(`\nTesting parser for: ${tool}`);
    const adapter = getAdapter(tool);
    if (!adapter || !adapter.parseFindings) {
      console.log(`No custom parser found for ${tool}`);
      continue;
    }

    const ctx = {
      targetUrl: 'hackerone.com',
      jsonFile: path.join(testDir, `${tool}.json`),
      scannerName: tool,
      settings: {}
    } as any;

    try {
      const findings = adapter.parseFindings(ctx);
      console.log(`Found ${findings.length} findings:`);
      console.log(JSON.stringify(findings, null, 2));
    } catch (e) {
      console.error(`Error parsing for ${tool}:`, e);
    }
  }

  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
}

testParsers().catch(console.error);
