export interface ScanProfile {
  id: string;
  name: string;
  description: string;
  isPassiveOnly: boolean;
  tools: string[];
}

export const SCAN_PROFILES: Record<string, ScanProfile> = {
  'passive-discovery': {
    id: 'passive-discovery',
    name: 'Passive Discovery',
    description: 'Discovers assets and URLs purely from passive third-party sources without active target probing.',
    isPassiveOnly: true,
    tools: ['subfinder', 'gau', 'dnsx', 'tlsx']
  },
  'safe-web-assessment': {
    id: 'safe-web-assessment',
    name: 'Safe Web Assessment',
    description: 'Lightweight web reconnaissance, technology fingerprinting, and non-destructive vulnerability checks.',
    isPassiveOnly: false,
    tools: ['httpx', 'katana', 'nuclei', 'wafw00f']
  },
  'authenticated-web': {
    id: 'authenticated-web',
    name: 'Authenticated Web & DAST',
    description: 'Deep web application security scan including crawling, parameter discovery, and vulnerability checks.',
    isPassiveOnly: false,
    tools: ['httpx', 'katana', 'nuclei', 'wapiti', 'arjun', 'dalfox']
  },
  'infrastructure-network': {
    id: 'infrastructure-network',
    name: 'Infrastructure & Network',
    description: 'Network port scanning, service identification, and TLS grabber.',
    isPassiveOnly: false,
    tools: ['naabu', 'nmap', 'tlsx']
  },
  'full-active-recon': {
    id: 'full-active-recon',
    name: 'Full Active Reconnaissance',
    description: 'End-to-end chained workflow: Subdomains -> Resolution -> Probing -> Spider -> Nuclei/Wapiti.',
    isPassiveOnly: false,
    tools: ['subfinder', 'dnsx', 'httpx', 'katana', 'nuclei', 'wapiti', 'ffuf']
  }
};
