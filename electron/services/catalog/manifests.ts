import type { ToolManifest } from './types';

export const TOOL_MANIFESTS: Record<string, ToolManifest> = {
  commix: {
    id:'commix', displayName:'Commix — Command Injection Validation', category:'dast',requiresExplicitSelection:true,
    description:'Selected GET-parameter command injection validation with structured evidence. Install the pinned official runtime from Tools Hub.',
    capabilities:['active','vuln-scan'], acceptedTargetTypes:['url'], outputTypes:['json'],
    runtime:'python-script', executionMode:'script', supportedOs:['win32','linux','darwin'], versionFlag:'--version',
    installStrategy:{type:'git-clone',gitRepo:'https://github.com/commixproject/commix.git',entryScript:'commix.py',wrapperName:'commix.cmd',exeName:'commix.py'},
    exitCodeSemantics:{successCodes:[0]}, defaultTimeoutMs:10*60*1000, sourceUrl:'https://github.com/commixproject/commix',
  },
  sqlmap: {
    id:'sqlmap', displayName:'SQLmap — SQLi Validation', category:'dast',
    description:'Explicit GET-parameter SQL injection validation. Configure Python and upstream sqlmap.py in Active Testing.',
    capabilities:['active','vuln-scan'], acceptedTargetTypes:['url'], outputTypes:['text'],
    runtime:'python-script', executionMode:'script', supportedOs:['win32','linux','darwin'], versionFlag:'--version',
    installStrategy:{type:'system-manual',guideUrl:'https://github.com/sqlmapproject/sqlmap',defaultPaths:[],exeName:'sqlmap.py'},
    exitCodeSemantics:{successCodes:[0]}, defaultTimeoutMs:10*60*1000, sourceUrl:'https://github.com/sqlmapproject/sqlmap',requiresManual:true,
  },
  nikto: {
    id:'nikto', displayName:'Nikto — Web Server Checks', category:'dast',
    description:'Selected web server checks. Configure the pinned official Docker image or Perl/upstream nikto.pl in Active Testing.',
    capabilities:['active','vuln-scan'], acceptedTargetTypes:['url'], outputTypes:['json'],
    runtime:'system-manual', executionMode:'script', supportedOs:['win32','linux','darwin'], versionFlag:'-Version',
    installStrategy:{type:'system-manual',guideUrl:'https://github.com/sullo/nikto',defaultPaths:[],exeName:'nikto.pl'},
    exitCodeSemantics:{successCodes:[0]}, defaultTimeoutMs:10*60*1000, sourceUrl:'https://github.com/sullo/nikto',requiresManual:true,
  },
  nuclei: {
    id: 'nuclei',
    displayName: 'Nuclei Engine',
    category: 'dast',
    description: 'Fast and customizable vulnerability scanner based on simple YAML DSL.',
    capabilities: ['active', 'vuln-scan', 'fingerprinting'],
    acceptedTargetTypes: ['url', 'domain', 'ip'],
    outputTypes: ['jsonl', 'json'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/nuclei',
      assetPrefix: 'nuclei_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'nuclei.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 30 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/nuclei'
  },

  subfinder: {
    id: 'subfinder',
    displayName: 'Subfinder',
    category: 'recon',
    description: 'Fast passive subdomain enumeration tool that discovers valid subdomains using passive online sources.',
    capabilities: ['passive'],
    acceptedTargetTypes: ['domain'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/subfinder',
      assetPrefix: 'subfinder_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'subfinder.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/subfinder'
  },

  httpx: {
    id: 'httpx',
    displayName: 'HTTPX',
    category: 'recon',
    description: 'Fast and multi-purpose HTTP toolkit for running multiple probes.',
    capabilities: ['active', 'fingerprinting'],
    acceptedTargetTypes: ['domain', 'url', 'ip'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/httpx',
      assetPrefix: 'httpx_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'httpx.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/httpx'
  },

  naabu: {
    id: 'naabu',
    displayName: 'Naabu Port Scanner',
    category: 'recon',
    description: 'Fast and reliable port scanner focused on simplicity and speed.',
    capabilities: ['port-scan', 'active'],
    acceptedTargetTypes: ['domain', 'ip'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/naabu',
      assetPrefix: 'naabu_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'naabu.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 20 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/naabu'
  },

  katana: {
    id: 'katana',
    displayName: 'Katana Spider',
    category: 'recon',
    description: 'Next-generation crawling and spidering framework.',
    capabilities: ['crawling', 'active'],
    acceptedTargetTypes: ['url', 'domain'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/katana',
      assetPrefix: 'katana_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'katana.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 25 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/katana'
  },

  dnsx: {
    id: 'dnsx',
    displayName: 'DNSX Resolver',
    category: 'recon',
    description: 'Fast and multi-purpose DNS toolkit allow running multiple DNS queries.',
    capabilities: ['passive', 'active'],
    acceptedTargetTypes: ['domain'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/dnsx',
      assetPrefix: 'dnsx_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'dnsx.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/dnsx'
  },

  alterx: {
    id: 'alterx',
    displayName: 'Alterx Permutation',
    category: 'recon',
    description: 'Fast and customizable subdomain wordlist generator using DSL patterns.',
    capabilities: ['passive'],
    acceptedTargetTypes: ['domain'],
    outputTypes: ['text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/alterx',
      assetPrefix: 'alterx_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'alterx.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 10 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/alterx'
  },

  tlsx: {
    id: 'tlsx',
    displayName: 'TLSX SSL/TLS Grabber',
    category: 'recon',
    description: 'Fast and configurable TLS grabber and analyzer.',
    capabilities: ['passive', 'fingerprinting'],
    acceptedTargetTypes: ['domain', 'ip', 'url'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/tlsx',
      assetPrefix: 'tlsx_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'tlsx.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/tlsx'
  },

  ffuf: {
    id: 'ffuf',
    displayName: 'FFUF Web Fuzzer',
    category: 'fuzz',
    description: 'Fast web fuzzer written in Go for discovering endpoints, directories, and parameters.',
    capabilities: ['fuzzing', 'active'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-V',
    installStrategy: {
      type: 'github-release',
      repo: 'ffuf/ffuf',
      assetPrefix: 'ffuf_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'ffuf.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 30 * 60 * 1000,
    sourceUrl: 'https://github.com/ffuf/ffuf'
  },

  dalfox: {
    id: 'dalfox',
    displayName: 'Dalfox XSS Scanner',
    category: 'dast',
    description: 'Finder of parameter analysis and XSS scanner.',
    capabilities: ['active', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['jsonl', 'text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: 'version',
    installStrategy: {
      type: 'github-release',
      repo: 'hahwul/dalfox',
      assetPrefix: 'dalfox_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'dalfox.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 25 * 60 * 1000,
    sourceUrl: 'https://github.com/hahwul/dalfox'
  },

  gau: {
    id: 'gau',
    displayName: 'GAU (GetAllUrls)',
    category: 'recon',
    description: 'Fetch known URLs from AlienVault Open Threat Exchange, Wayback Machine, and Common Crawl.',
    capabilities: ['passive'],
    acceptedTargetTypes: ['domain'],
    outputTypes: ['text'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'github-release',
      repo: 'lc/gau',
      assetPrefix: 'gau_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'gau.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/lc/gau'
  },

  wapiti: {
    id: 'wapiti',
    displayName: 'Wapiti DAST',
    category: 'dast',
    description: 'The Web-application vulnerability scanner (Python).',
    capabilities: ['active', 'vuln-scan', 'crawling'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json', 'html'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'pip',
      package: 'wapiti3',
      exeName: 'wapiti.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1, 2] }, // Wapiti exit 0=clean, 1=non-fatal warnings, 2=vulns found
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://wapiti.sourceforge.io'
  },

  wafw00f: {
    id: 'wafw00f',
    displayName: 'Wafw00f WAF Detector',
    category: 'recon',
    description: 'Identifies and fingerprints Web Application Firewall (WAF) products.',
    capabilities: ['passive', 'fingerprinting'],
    acceptedTargetTypes: ['url', 'domain'],
    outputTypes: ['json', 'text'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'pip',
      package: 'wafw00f',
      exeName: 'wafw00f.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 10 * 60 * 1000,
    sourceUrl: 'https://github.com/EnableSecurity/wafw00f'
  },

  arjun: {
    id: 'arjun',
    displayName: 'Arjun Parameter Discovery',
    category: 'fuzz',
    description: 'HTTP parameter discovery suite for finding hidden parameters.',
    capabilities: ['active', 'fuzzing'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json', 'text'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-h',
    installStrategy: {
      type: 'pip',
      package: 'arjun',
      exeName: 'arjun.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 20 * 60 * 1000,
    sourceUrl: 'https://github.com/s0md3v/Arjun'
  },

  crlfsuite: {
    id: 'crlfsuite',
    displayName: 'CRLFsuite Header Splitting',
    category: 'dast',
    description: 'Fast and automated CRLF injection scanner.',
    capabilities: ['active', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['text'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-h',
    installStrategy: {
      type: 'pip',
      package: 'crlfsuite',
      exeName: 'crlfsuite.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/Nefcore/CRLFsuite'
  },

  corsy: {
    id: 'corsy',
    displayName: 'Corsy CORS Misconfig',
    category: 'dast',
    description: 'CORS Misconfiguration Scanner.',
    capabilities: ['active', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json', 'text'],
    runtime: 'python-script',
    executionMode: 'script',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-h',
    installStrategy: {
      type: 'git-clone',
      gitRepo: 'https://github.com/s0md3v/Corsy.git',
      entryScript: 'corsy.py',
      wrapperName: 'corsy.cmd',
      exeName: 'corsy.cmd'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/s0md3v/Corsy'
  },

  cmseek: {
    id: 'cmseek',
    displayName: 'CMSeeK CMS Scanner',
    category: 'dast',
    description: 'Content Management System (CMS) detection and exploitation suite.',
    capabilities: ['fingerprinting', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json', 'text'],
    runtime: 'python-script',
    executionMode: 'script',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'git-clone',
      gitRepo: 'https://github.com/Tuhinshubhra/CMSeeK.git',
      entryScript: 'cmseek.py',
      wrapperName: 'cmseek.cmd',
      exeName: 'cmseek.cmd'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 20 * 60 * 1000,
    sourceUrl: 'https://github.com/Tuhinshubhra/CMSeeK'
  },

  whatweb: {
    id: 'whatweb',
    displayName: 'WhatWeb Tech Fingerprint',
    category: 'recon',
    description: 'Next generation web scanner that identifies technologies including content management systems (CMS), blogging platforms, JavaScript libraries, and web servers.',
    capabilities: ['fingerprinting', 'passive', 'active'],
    acceptedTargetTypes: ['url', 'domain'],
    outputTypes: ['json', 'text'],
    runtime: 'ruby',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'git-clone',
      gitRepo: 'https://github.com/urbanadventurer/WhatWeb.git',
      entryScript: 'whatweb',
      wrapperName: 'whatweb.cmd',
      exeName: 'whatweb.cmd'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/urbanadventurer/WhatWeb'
  },

  nmap: {
    id: 'nmap',
    displayName: 'Nmap Network Scanner',
    category: 'network',
    description: 'Network exploration tool and security / port scanner.',
    capabilities: ['port-scan', 'fingerprinting', 'active'],
    acceptedTargetTypes: ['domain', 'ip', 'cidr'],
    outputTypes: ['xml', 'text'],
    runtime: 'system-manual',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-V',
    installStrategy: {
      type: 'system-manual',
      guideUrl: 'https://nmap.org/download.html',
      defaultPaths: [
        'C:\\Program Files (x86)\\Nmap\\nmap.exe',
        'C:\\Program Files\\Nmap\\nmap.exe'
      ],
      exeName: 'nmap.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 30 * 60 * 1000,
    sourceUrl: 'https://nmap.org',
    requiresManual: true
  },

  zap: {
    id: 'zap',
    displayName: 'OWASP ZAP',
    category: 'dast',
    description: 'Open-source web application security scanner for finding vulnerabilities.',
    capabilities: ['active', 'crawling', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json', 'xml', 'html'],
    runtime: 'system-manual',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    installStrategy: {
      type: 'system-manual',
      guideUrl: 'https://www.zaproxy.org/download/',
      defaultPaths: [
        'C:\\Program Files\\OWASP\\Zed Attack Proxy\\zap.bat',
        'C:\\Program Files (x86)\\OWASP\\Zed Attack Proxy\\zap.bat'
      ],
      exeName: 'zap.bat'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 45 * 60 * 1000,
    sourceUrl: 'https://www.zaproxy.org',
    requiresManual: true
  },

  wpscan: {
    id: 'wpscan',
    displayName: 'WPScan WordPress Scanner',
    category: 'dast',
    description: 'Black box WordPress vulnerability scanner via Docker.',
    capabilities: ['fingerprinting', 'vuln-scan', 'active'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json'],
    runtime: 'docker',
    executionMode: 'docker',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'docker',
      image: 'wpscanteam/wpscan:latest',
      exeName: 'docker'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 25 * 60 * 1000,
    sourceUrl: 'https://github.com/wpscanteam/wpscan'
  },

  // Enterprise Commercial Scanners (Unchecked by default)
  appscan: {
    id: 'appscan',
    displayName: 'HCL AppScan Standard',
    category: 'dast',
    description: 'Enterprise DAST engine CLI runner for HCL AppScan Standard installations.',
    capabilities: ['active', 'crawling', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['xml', 'html'],
    runtime: 'system-manual',
    executionMode: 'cli',
    supportedOs: ['win32'],
    versionFlag: '/?',
    installStrategy: {
      type: 'system-manual',
      guideUrl: 'https://www.hcl-software.com/appscan',
      defaultPaths: [
        'C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe',
        'C:\\Program Files\\HCL\\AppScan Standard\\AppScanCMD.exe'
      ],
      exeName: 'AppScanCMD.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 60 * 60 * 1000,
    sourceUrl: 'https://www.hcl-software.com/appscan',
    isCommercial: true,
    requiresManual: true
  },

  netsparker: {
    id: 'netsparker',
    displayName: 'Invicti (Netsparker)',
    category: 'dast',
    description: 'Enterprise automated web vulnerability scanner CLI runner.',
    capabilities: ['active', 'crawling', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['xml', 'html'],
    runtime: 'system-manual',
    executionMode: 'cli',
    supportedOs: ['win32'],
    versionFlag: '/?',
    installStrategy: {
      type: 'system-manual',
      guideUrl: 'https://www.invicti.com',
      defaultPaths: [
        'C:\\Program Files (x86)\\Invicti Professional Edition\\Netsparker.exe',
        'C:\\Program Files\\Invicti Professional Edition\\Netsparker.exe'
      ],
      exeName: 'Netsparker.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 60 * 60 * 1000,
    sourceUrl: 'https://www.invicti.com',
    isCommercial: true,
    requiresManual: true
  },

  acunetix: {
    id: 'acunetix',
    displayName: 'Acunetix API Runner',
    category: 'dast',
    description: 'Enterprise REST API connector for remote Invicti/Acunetix scanner instances.',
    capabilities: ['active', 'crawling', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json'],
    runtime: 'remote-api',
    executionMode: 'api',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'built-in',
      script: 'electron/scripts/acunetix_runner.js',
      exeName: 'node'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 60 * 60 * 1000,
    sourceUrl: 'https://www.acunetix.com',
    isCommercial: true,
    requiresManual: false
  },

  sslyze: {
    id: 'sslyze',
    displayName: 'SSLyze',
    category: 'tls',
    description: 'Fast and powerful SSL/TLS scanning library and CLI analyzing server configurations, certificates, and cipher suites.',
    capabilities: ['active', 'tls-audit'],
    acceptedTargetTypes: ['domain', 'url', 'ip'],
    outputTypes: ['json'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'pip',
      package: 'sslyze',
      exeName: 'sslyze.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1, 2] },
    defaultTimeoutMs: 10 * 60 * 1000,
    sourceUrl: 'https://github.com/nabla-c0d3/sslyze'
  },

  gitleaks: {
    id: 'gitleaks',
    displayName: 'Gitleaks',
    category: 'secrets',
    description: 'Audit Git repositories and filesystems for hardcoded secrets, API tokens, and private keys.',
    capabilities: ['passive', 'secrets'],
    acceptedTargetTypes: ['directory', 'repo', 'url'],
    outputTypes: ['json'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: 'version',
    installStrategy: {
      type: 'github-release',
      repo: 'gitleaks/gitleaks',
      assetPrefix: 'gitleaks_',
      assetSuffix: '_windows_x64.zip',
      exeName: 'gitleaks.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/gitleaks/gitleaks'
  },

  semgrep: {
    id: 'semgrep',
    displayName: 'Semgrep',
    category: 'sast',
    description: 'Fast, lightweight static analysis engine for finding bugs and enforcing code standards across multi-language codebases.',
    capabilities: ['passive', 'sast'],
    acceptedTargetTypes: ['directory', 'repo'],
    outputTypes: ['json'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'pip',
      package: 'semgrep',
      exeName: 'semgrep.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1] },
    defaultTimeoutMs: 20 * 60 * 1000,
    sourceUrl: 'https://github.com/semgrep/semgrep'
  },

  trivy: {
    id: 'trivy',
    displayName: 'Trivy',
    category: 'sca',
    description: 'Comprehensive security scanner for container images, filesystems, and Git repositories discovering vulnerabilities and IaC misconfigurations.',
    capabilities: ['passive', 'sca', 'vuln-scan'],
    acceptedTargetTypes: ['directory', 'repo'],
    outputTypes: ['json'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'github-release',
      repo: 'aquasecurity/trivy',
      assetPrefix: 'trivy_',
      assetSuffix: '_windows-64bit.zip',
      exeName: 'trivy.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1] },
    defaultTimeoutMs: 20 * 60 * 1000,
    sourceUrl: 'https://github.com/aquasecurity/trivy'
  },

  schemathesis: {
    id: 'schemathesis',
    displayName: 'Schemathesis API Fuzzer',
    category: 'fuzz',
    description: 'Specification-based property testing tool for OpenAPI and GraphQL APIs, generating negative and positive test cases.',
    capabilities: ['active', 'fuzzing', 'api-fuzz'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['json'],
    runtime: 'python-pip',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    installStrategy: {
      type: 'pip',
      package: 'schemathesis',
      exeName: 'st.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1, 2] },
    defaultTimeoutMs: 25 * 60 * 1000,
    sourceUrl: 'https://github.com/schemathesis/schemathesis'
  },

  sstimap: {
    id: 'sstimap',
    displayName: 'SSTImap — SSTI Detection',
    category: 'dast',
    requiresExplicitSelection: true,
    description: 'Targeted SSTI detection and engine identification for request parameters. Safe, non-destructive mathematical verification on local lab.',
    capabilities: ['active', 'vuln-scan'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['text'],
    runtime: 'python-script',
    executionMode: 'script',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '--version',
    pinnedVersion: '1.2.2',
    minVersion: '1.2.0',
    installStrategy: {
      type: 'git-clone',
      gitRepo: 'https://github.com/vladko312/SSTImap.git',
      entryScript: 'sstimap.py',
      wrapperName: 'sstimap.cmd',
      exeName: 'sstimap.py'
    },
    exitCodeSemantics: { successCodes: [0, 1] },
    defaultTimeoutMs: 10 * 60 * 1000,
    sourceUrl: 'https://github.com/vladko312/SSTImap'
  },

  jwt_tool: {
    id: 'jwt_tool',
    displayName: 'jwt_tool — JWT Security Analysis',
    category: 'dast',
    requiresExplicitSelection: true,
    description: 'JSON Web Token analysis workspace. Offline token claim/algorithm inspection and controlled server validation with strict token secret redaction.',
    capabilities: ['active', 'vuln-scan', 'fingerprinting'],
    acceptedTargetTypes: ['url'],
    outputTypes: ['text'],
    runtime: 'python-script',
    executionMode: 'script',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-h',
    pinnedVersion: '2.2.8',
    minVersion: '2.2.0',
    installStrategy: {
      type: 'git-clone',
      gitRepo: 'https://github.com/ticarpi/jwt_tool.git',
      entryScript: 'jwt_tool.py',
      wrapperName: 'jwt_tool.cmd',
      exeName: 'jwt_tool.py'
    },
    exitCodeSemantics: { successCodes: [0, 1] },
    defaultTimeoutMs: 10 * 60 * 1000,
    sourceUrl: 'https://github.com/ticarpi/jwt_tool'
  },

  syft: {
    id: 'syft',
    displayName: 'Syft — SBOM Generator',
    category: 'sast',
    description: 'CLI tool for generating a Software Bill of Materials (SBOM) from container images and filesystems with package purls and license provenance.',
    capabilities: ['passive', 'fingerprinting', 'sca'],
    acceptedTargetTypes: ['directory', 'repo'],
    outputTypes: ['json'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: 'version',
    pinnedVersion: '1.20.0',
    minVersion: '1.0.0',
    installStrategy: {
      type: 'github-release',
      repo: 'anchore/syft',
      assetPrefix: 'syft_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'syft.exe'
    },
    exitCodeSemantics: { successCodes: [0] },
    defaultTimeoutMs: 15 * 60 * 1000,
    sourceUrl: 'https://github.com/anchore/syft'
  },

  interactsh: {
    id: 'interactsh',
    displayName: 'Interactsh Client — OOB Interaction Gathering',
    category: 'dast',
    requiresExplicitSelection: true,
    description: 'Out-of-band interaction client for blind vulnerability correlation. Configurable self-hosted server with strict session isolation and IP redaction.',
    capabilities: ['active'],
    acceptedTargetTypes: ['url', 'domain'],
    outputTypes: ['jsonl', 'json'],
    runtime: 'native',
    executionMode: 'cli',
    supportedOs: ['win32', 'linux', 'darwin'],
    versionFlag: '-version',
    pinnedVersion: '1.2.2',
    minVersion: '1.1.0',
    installStrategy: {
      type: 'github-release',
      repo: 'projectdiscovery/interactsh',
      assetPrefix: 'interactsh-client_',
      assetSuffix: '_windows_amd64.zip',
      exeName: 'interactsh-client.exe'
    },
    exitCodeSemantics: { successCodes: [0, 1] },
    defaultTimeoutMs: 60 * 1000,
    sourceUrl: 'https://github.com/projectdiscovery/interactsh'
  }
};
