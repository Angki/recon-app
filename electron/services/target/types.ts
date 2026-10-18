/**
 * Typed Target Union for Recon App
 * Defines canonical target types and contracts for security assessment engines.
 */

export type TargetType = 'web_url' | 'api_spec' | 'local_source' | 'container_image';

export interface WebUrlTarget {
  type: 'web_url';
  url: string;
}

export interface ApiSpecTarget {
  type: 'api_spec';
  specLocation: string; // URL (http/https) or local file path
  format?: 'openapi_v3' | 'swagger_v2' | 'postman' | 'har';
  targetBaseUrl?: string; // Optional live API base URL
}

export interface LocalSourceTarget {
  type: 'local_source';
  path: string; // Absolute path to local repository or source folder
}

export interface ContainerImageTarget {
  type: 'container_image';
  imageReference: string; // e.g. "nginx:alpine", "myregistry.azurecr.io/app:1.0.0"
}

export type ScanTarget = WebUrlTarget | ApiSpecTarget | LocalSourceTarget | ContainerImageTarget;

/**
 * Standardized tool capability mapping defining which target types each tool supports.
 */
export const TOOL_TARGET_CAPABILITIES: Record<string, TargetType[]> = {
  // SAST & Secrets engines (require local source)
  semgrep: ['local_source'],
  gitleaks: ['local_source'],
  
  // SCA & Container engines (support local source and container images)
  trivy: ['local_source', 'container_image'],
  
  // API Specification Fuzzers
  schemathesis: ['api_spec', 'web_url'],
  
  // DAST & Active Web Assessment engines
  nuclei: ['web_url', 'api_spec'],
  wapiti: ['web_url', 'api_spec'],
  dalfox: ['web_url'],
  nikto: ['web_url'],
  sqlmap: ['web_url'],
  commix: ['web_url'],
  sstimap: ['web_url'],
  jwt_tool: ['web_url', 'api_spec'],
  syft: ['local_source', 'container_image'],
  interactsh: ['web_url'],
  zap: ['web_url', 'api_spec'],
  wpscan: ['web_url', 'container_image'],
  
  // Discovery & Reconnaissance engines
  katana: ['web_url'],
  gau: ['web_url'],
  arjun: ['web_url'],
  crlfsuite: ['web_url'],
  corsy: ['web_url'],
  subfinder: ['web_url'],
  alterx: ['web_url'],
  dnsx: ['web_url'],
  wafw00f: ['web_url'],
  whatweb: ['web_url'],
  cmseek: ['web_url'],
  naabu: ['web_url'],
  nmap: ['web_url'],
  tlsx: ['web_url'],
  sslyze: ['web_url'],
  testssl: ['web_url'],
  
  // Commercial DAST
  appscan: ['web_url'],
  netsparker: ['web_url'],
  acunetix: ['web_url']
};
