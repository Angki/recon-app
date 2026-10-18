const https = require('https');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

const targetUrl = process.argv[2];
const jsonFile = process.argv[3];
const xmlFile = process.argv[4];
let apiUrl = process.argv[5] || 'https://127.0.0.1:13443';
let apiKey = process.env.ACUNETIX_API_KEY || (process.argv[6] && process.argv[6] !== 'undefined' ? process.argv[6] : '');
const profileId = process.argv[7] || process.env.ACUNETIX_PROFILE_ID || '';
const acunetixEmail = process.env.ACUNETIX_EMAIL || '';
const acunetixPassword = process.env.ACUNETIX_PASSWORD || '';

if (!targetUrl || !jsonFile || !xmlFile) {
  console.error('[ERROR] Missing target URL or output files.');
  process.exit(1);
}

if (!apiKey && (!acunetixEmail || !acunetixPassword)) {
  console.error('[ERROR] Acunetix credentials missing: either ACUNETIX_API_KEY or ACUNETIX_EMAIL + ACUNETIX_PASSWORD must be provided.');
  process.exit(1);
}

// Remove trailing slash
if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

// TLS verification: active by default; insecure override requires explicit audit flag
const allowInsecure = process.env.ACUNETIX_INSECURE_TLS === 'true' || process.env.ACUNETIX_ALLOW_INSECURE === '1';
const agent = new https.Agent({ rejectUnauthorized: !allowInsecure });

const request = (method, endpoint, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${apiUrl}${endpoint}`);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (apiKey) {
      headers['X-Auth'] = apiKey;
      headers['Cookie'] = `ui_session=${apiKey}`;
    }
    const options = {
      method,
      headers,
      agent
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ data: data ? JSON.parse(data) : null, headers: res.headers });
          } catch (e) {
            resolve({ data, headers: res.headers });
          }
        } else {
          reject(new Error(`API responded with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Docker daemon is running by executing `docker info`.
 * Returns true if Docker is responsive.
 */
function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to start Docker Desktop on Windows.
 * Looks for Docker Desktop in common install locations.
 */
function launchDockerDesktop() {
  const paths = [
    'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    `${process.env.LOCALAPPDATA}\\Docker\\Docker Desktop.exe`,
    `${process.env.ProgramFiles}\\Docker\\Docker\\Docker Desktop.exe`,
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log(`[Docker] Launching Docker Desktop from: ${p}`);
      // Spawn detached so it doesn't block our process
      const child = spawn(p, [], { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    }
  }
  return false;
}

/**
 * Find the Acunetix container ID dynamically.
 * Searches all containers (including stopped) for ones with "acunetix" in the image name.
 * Falls back to a known container ID prefix.
 */
function findAcunetixContainer() {
  try {
    // Search by image name first (most reliable)
    const byImage = execSync('docker ps -a --filter "ancestor=acunetix" --format "{{.ID}}"', { stdio: 'pipe', timeout: 10000 }).toString().trim();
    if (byImage) return byImage.split('\n')[0].trim();
  } catch {}

  try {
    // Broader search: look for any container with "acunetix" in its name or image
    const all = execSync('docker ps -a --format "{{.ID}} {{.Image}} {{.Names}}"', { stdio: 'pipe', timeout: 10000 }).toString().trim();
    const lines = all.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('acunetix') || line.toLowerCase().includes('awvs')) {
        return line.split(' ')[0].trim();
      }
    }
  } catch {}

  // No local container found
  return null;
}

/**
 * Ensure Docker Desktop is running and the Acunetix container is started.
 * Will auto-launch Docker Desktop if needed, then start the container.
 */
async function ensureDockerAndContainer() {
  const isLocal = apiUrl.includes('127.0.0.1') || apiUrl.includes('localhost');
  if (!isLocal) {
    console.log('[Remote] Target Acunetix API is a remote endpoint. Skipping local Docker daemon lifecycle management.');
    return;
  }

  console.log('[Docker] Checking Docker daemon status...');

  if (!isDockerRunning()) {
    console.log('[Docker] Docker is NOT running. Attempting to start Docker Desktop...');

    const launched = launchDockerDesktop();
    if (!launched) {
      console.log('[Docker] Docker Desktop executable not found. Assuming Acunetix is running natively or managed externally.');
      return;
    }

    // Wait for Docker daemon to become responsive (up to 60 seconds)
    const maxWait = 60;
    let waited = 0;
    while (!isDockerRunning() && waited < maxWait) {
      const remaining = maxWait - waited;
      process.stdout.write(`\r[Docker] Waiting for Docker daemon to start... (${remaining}s remaining)`);
      await sleep(5000);
      waited += 5;
    }
    console.log(''); // newline after \r

    if (!isDockerRunning()) {
      console.log(`[Docker] Docker daemon did not start within ${maxWait} seconds. Proceeding to direct API attempt...`);
      return;
    }

    console.log('[Docker] Docker daemon is now running!');
  } else {
    console.log('[Docker] Docker daemon is already running.');
  }

  // Now check the Acunetix container
  const containerId = findAcunetixContainer();
  if (!containerId) {
    console.log('[Docker] No local Acunetix container found. Proceeding with direct API connection.');
    return;
  }
  console.log(`[Docker] Found Acunetix container: ${containerId}`);

  try {
    const status = execSync(`docker inspect -f "{{.State.Running}}" ${containerId}`, { stdio: 'pipe', timeout: 10000 }).toString().trim();

    if (status === 'true') {
      console.log('[Docker] Acunetix container is already running.');
    } else {
      console.log('[Docker] Acunetix container is stopped. Starting it...');
      execSync(`docker start ${containerId}`, { stdio: 'pipe', timeout: 30000 });
      console.log('[Docker] Acunetix container started. Waiting for API to become responsive...');

      // Wait for the Acunetix API to respond (up to 90 seconds)
      let apiReady = false;
      for (let i = 0; i < 18; i++) {
        await sleep(5000);
        try {
          await request('GET', '/api/v1/info');
          apiReady = true;
          break;
        } catch {
          process.stdout.write(`\r[Docker] Waiting for Acunetix API... (${(i + 1) * 5}s)`);
        }
      }
      console.log(''); // newline

      if (!apiReady) {
        throw new Error('Acunetix API did not become responsive within 90 seconds after container start.');
      }

      console.log('[Docker] Acunetix API is ready!');
    }
  } catch (err) {
    if (err.message && err.message.includes('No such object')) {
      throw new Error(`Acunetix container "${containerId}" not found. Please ensure the Acunetix Docker image is installed.`);
    }
    throw err;
  }
}

async function run() {
  try {
    // Pre-flight: ensure Docker Desktop and Acunetix container are running
    await ensureDockerAndContainer();

    if (!apiKey) {
      console.log(`[Acunetix] No API key provided, attempting auto-login with ${acunetixEmail}...`);
      try {
        const hashedPassword = crypto.createHash('sha256').update(acunetixPassword).digest('hex');
        const loginRes = await request('POST', '/api/v1/me/login', {
          email: acunetixEmail,
          password: hashedPassword,
          remember_me: false
        });
        apiKey = loginRes.headers['x-auth'];
        if (!apiKey) throw new Error("No X-Auth header returned");
        console.log(`[Acunetix] Auto-login successful. Extracted ephemeral session token.`);
      } catch (loginErr) {
        throw new Error(`Auto-login failed: ${loginErr.message}`);
      }
    }

    console.log(`[Acunetix] Checking connection to ${apiUrl}...`);
    // Ping to verify
    await request('GET', '/api/v1/info');

    console.log(`[Acunetix] Adding target ${targetUrl}...`);
    const targetData = await request('POST', '/api/v1/targets', {
      address: targetUrl,
      description: 'Recon App Automated Scan',
      type: 'default',
      criticality: 10
    });
    
    const targetId = targetData.data.target_id;
    if (!targetId) throw new Error('Failed to create target');
    console.log(`[Acunetix] Target added (ID: ${targetId})`);

    // We assume default profile id for "Full Scan" (11111111-1111-1111-1111-111111111111)
    console.log(`[Acunetix] Starting scan with profile ${profileId}...`);
    const scanData = await request('POST', '/api/v1/scans', {
      profile_id: profileId,
      target_id: targetId,
      schedule: {
        disable: false,
        start_date: null,
        time_sensitive: false
      }
    });

    const scanId = scanData.data.scan_id;
    console.log(`[Acunetix] Scan started (Scan ID: ${scanId})`);

    let resultId = null;
    let completed = false;
    while (!completed) {
      await sleep(10000); // Poll every 10 seconds
      const statusData = await request('GET', `/api/v1/scans/${scanId}`);
      const status = statusData.data.current_session.status;
      const severity = statusData.data.current_session.severity_counts || {};
      resultId = statusData.data.current_session.scan_session_id;
      
      console.log(`[Acunetix] Status: ${status} | High: ${severity.high||0}, Med: ${severity.medium||0}, Low: ${severity.low||0}`);
      
      if (status === 'completed' || status === 'aborted' || status === 'failed') {
        completed = true;
      }
    }

    console.log(`[Acunetix] Fetching vulnerabilities...`);
    try {
      if (resultId) {
        let allVulns = [];
        let cursor = 0;
        let limit = 100;
        let fetchedAll = false;
        
        while (!fetchedAll) {
          const vulnsData = await request('GET', `/api/v1/scans/${scanId}/results/${resultId}/vulnerabilities?c=${cursor}`);
          if (vulnsData.data && vulnsData.data.vulnerabilities && vulnsData.data.vulnerabilities.length > 0) {
            allVulns = allVulns.concat(vulnsData.data.vulnerabilities);
            cursor += vulnsData.data.vulnerabilities.length;
          } else {
            fetchedAll = true;
          }
        }
        fs.writeFileSync(jsonFile, JSON.stringify(allVulns, null, 2));
      } else {
        fs.writeFileSync(jsonFile, "[]");
      }
    } catch(err) {
      console.warn(`[Acunetix] WARNING: Failed to fetch vulnerabilities JSON: ${err.message}`);
      fs.writeFileSync(jsonFile, "[]");
    }

    console.log(`[Acunetix] Generating XML report...`);
    // Comprehensive XML Report Template usually has ID 11111111-1111-1111-1111-111111111115
    const reportDataXML = await request('POST', '/api/v1/reports', {
      template_id: "11111111-1111-1111-1111-111111111115",
      source: {
        list_type: "scans",
        id_list: [scanId]
      }
    });
    
    console.log(`[Acunetix] Generating PDF comprehensive report...`);
    // Comprehensive PDF Report Template usually has ID 11111111-1111-1111-1111-111111111111
    const reportDataPDF = await request('POST', '/api/v1/reports', {
      template_id: "11111111-1111-1111-1111-111111111111",
      source: {
        list_type: "scans",
        id_list: [scanId]
      }
    });

    const reportIdXML = reportDataXML.data.report_id;
    const reportIdPDF = reportDataPDF.data.report_id;
    console.log(`[Acunetix] Report generation queued (XML ID: ${reportIdXML}, PDF ID: ${reportIdPDF})`);

    // Poll for XML report
    let xmlReportUrl = null;
    while (!xmlReportUrl) {
      await sleep(5000);
      const repStatus = await request('GET', `/api/v1/reports/${reportIdXML}`);
      if (repStatus.data.status === 'completed') {
        xmlReportUrl = repStatus.data.download.find(d => d.endsWith('.xml')) || repStatus.data.download[1] || repStatus.data.download[0];
      } else if (repStatus.data.status === 'failed') {
        throw new Error('XML Report generation failed');
      }
    }

    // Poll for PDF report
    let pdfReportUrl = null;
    while (!pdfReportUrl) {
      await sleep(5000);
      const repStatus = await request('GET', `/api/v1/reports/${reportIdPDF}`);
      if (repStatus.data.status === 'completed') {
        pdfReportUrl = repStatus.data.download.find(d => d.endsWith('.pdf')) || repStatus.data.download[1] || repStatus.data.download[0];
      } else if (repStatus.data.status === 'failed') {
        console.warn('[Acunetix] WARNING: PDF Report generation failed, continuing without PDF.');
        break;
      }
    }

    console.log(`[Acunetix] Downloading reports...`);
    // Download the XML report
    const downloadXML = new Promise((resolve, reject) => {
      const xmlUrl = new URL(`${apiUrl}${xmlReportUrl}`);
      const fileXML = fs.createWriteStream(xmlFile);
      https.get(xmlUrl, { agent, headers: { 'X-Auth': apiKey } }, (res) => {
        res.pipe(fileXML);
        fileXML.on('finish', () => { fileXML.close(resolve); });
      }).on('error', reject);
    });

    // Download the PDF report
    const downloadPDF = new Promise((resolve, reject) => {
      if (!pdfReportUrl) return resolve();
      const pdfFile = xmlFile.replace('.xml', '.pdf');
      const pdfUrl = new URL(`${apiUrl}${pdfReportUrl}`);
      const filePDF = fs.createWriteStream(pdfFile);
      https.get(pdfUrl, { agent, headers: { 'X-Auth': apiKey } }, (res) => {
        res.pipe(filePDF);
        filePDF.on('finish', () => { filePDF.close(resolve); });
      }).on('error', reject);
    });

    await Promise.all([downloadXML, downloadPDF]);

    console.log(`[Acunetix] Reports saved successfully.`);
    console.log(`[Acunetix] Process complete.`);
    process.exit(0);

  } catch (error) {
    console.error(`[ERROR] Acunetix Runner: ${error.message}`);
    process.exit(1);
  }
}

run();
