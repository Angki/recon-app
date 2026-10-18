export type ToolCategory = 'recon' | 'dast' | 'fuzz' | 'network' | 'tls' | 'secrets' | 'sast' | 'sca';

export type RuntimeRequirement = 
  | 'native' 
  | 'python-pip' 
  | 'python-script' 
  | 'ruby' 
  | 'docker' 
  | 'remote-api' 
  | 'system-manual' 
  | 'built-in';

export type ExecutionMode = 'cli' | 'docker' | 'api' | 'script';

export type TargetType = 'url' | 'domain' | 'ip' | 'cidr' | 'directory' | 'repo';

export type OutputType = 'json' | 'jsonl' | 'xml' | 'html' | 'text';

export type ToolCapability = 
  | 'passive' 
  | 'active' 
  | 'fuzzing' 
  | 'port-scan' 
  | 'crawling' 
  | 'fingerprinting' 
  | 'vuln-scan'
  | 'secrets'
  | 'sast'
  | 'sca'
  | 'tls-audit'
  | 'api-fuzz';

export type InstallStrategy =
  | { type: 'github-release'; repo: string; assetPrefix: string; assetSuffix: string; exeName: string }
  | { type: 'pip'; package: string; exeName: string }
  | { type: 'git-clone'; gitRepo: string; entryScript: string; wrapperName: string; exeName: string }
  | { type: 'system-manual'; guideUrl: string; defaultPaths: string[]; exeName: string }
  | { type: 'docker'; image: string; exeName: string }
  | { type: 'built-in'; script: string; exeName: string };

export interface ExitCodeSemantic {
  successCodes: number[];
  findingsFoundCodes?: number[];
  failureCodes?: number[];
}

export interface ToolManifest {
  id: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  capabilities: ToolCapability[];
  acceptedTargetTypes: TargetType[];
  outputTypes: OutputType[];
  runtime: RuntimeRequirement;
  executionMode: ExecutionMode;
  supportedOs: ('win32' | 'linux' | 'darwin')[];
  versionFlag: string;
  installStrategy: InstallStrategy;
  exitCodeSemantics: ExitCodeSemantic;
  defaultTimeoutMs: number;
  sourceUrl: string;
  isCommercial?: boolean;
  requiresManual?: boolean;
  requiresExplicitSelection?: boolean;
}
