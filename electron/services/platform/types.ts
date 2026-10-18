import type { ToolCategory, ToolCapability, TargetType, OutputType, RuntimeRequirement } from '../catalog/types';

export type ToolStatus =
  | 'not_installed'
  | 'installed'
  | 'runtime_missing'
  | 'unsupported_version'
  | 'healthcheck_failed'
  | 'ready';

export interface PreflightSmokeResult {
  passed: boolean;
  status: ToolStatus;
  version?: string;
  durationMs: number;
  details: string;
  error?: string;
}

export interface ToolPlatformReceipt {
  toolId: string;
  version: string;
  installedAt: string;
  sha256?: string;
  sourceUrl: string;
  installType: string;
  binaryPath: string;
  rollbackBinaryPath?: string;
}

export interface DetailedToolManifest {
  id: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  capabilities: ToolCapability[];
  acceptedTargetTypes: TargetType[];
  outputTypes: OutputType[];
  runtime: RuntimeRequirement;
  executable: string;
  supportedOs: ('win32' | 'linux' | 'darwin')[];
  pinnedVersion?: string;
  license?: string;
  checksumSha256?: string;
  versionFlag: string;
  defaultTimeoutMs: number;
  sourceUrl: string;
  isCommercial?: boolean;
  requiresManual?: boolean;
}
