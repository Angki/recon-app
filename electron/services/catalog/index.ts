import { TOOL_MANIFESTS } from './manifests';
import type { ToolManifest, ToolCategory, TargetType } from './types';

export class ToolCatalogService {
  private manifests: Map<string, ToolManifest> = new Map();

  constructor() {
    for (const [id, manifest] of Object.entries(TOOL_MANIFESTS)) {
      this.manifests.set(id.toLowerCase(), manifest);
    }
  }

  getAll(): ToolManifest[] {
    return Array.from(this.manifests.values());
  }

  get(id: string): ToolManifest | undefined {
    return this.manifests.get(id.toLowerCase());
  }

  getManifest(id: string): ToolManifest | undefined {
    return this.get(id);
  }

  has(id: string): boolean {
    return this.manifests.has(id.toLowerCase());
  }

  getByCategory(category: ToolCategory): ToolManifest[] {
    return this.getAll().filter(m => m.category === category);
  }

  /** Tools checked by default in UI & new scans: commercial tools excluded */
  getDefaultSelectedTools(): string[] {
    return this.getAll()
      .filter(m => !m.isCommercial && !m.requiresManual && !m.requiresExplicitSelection)
      .map(m => m.id);
  }

  validateTarget(toolId: string, targetType: TargetType): boolean {
    const manifest = this.get(toolId);
    if (!manifest) return false;
    return manifest.acceptedTargetTypes.includes(targetType);
  }

  getExecutableName(toolId: string): string {
    const manifest = this.get(toolId);
    if (!manifest) return `${toolId}.exe`;
    return manifest.installStrategy.exeName;
  }

  getTimeout(toolId: string): number {
    const manifest = this.get(toolId);
    return manifest ? manifest.defaultTimeoutMs : 30 * 60 * 1000;
  }

  getExitCodeSemantic(toolId: string, exitCode: number | null): 'clean' | 'findings_found' | 'failure' | 'interrupted' {
    if (exitCode === null) return 'interrupted';
    const manifest = this.get(toolId);
    if (!manifest) return exitCode === 0 ? 'clean' : 'failure';

    const { successCodes, findingsFoundCodes, failureCodes } = manifest.exitCodeSemantics;

    if (findingsFoundCodes && findingsFoundCodes.includes(exitCode)) {
      return 'findings_found';
    }
    if (successCodes.includes(exitCode)) {
      return 'clean';
    }
    if (failureCodes && failureCodes.includes(exitCode)) {
      return 'failure';
    }
    return exitCode === 0 ? 'clean' : 'failure';
  }
}

export const toolCatalog = new ToolCatalogService();
export * from './types';
export * from './manifests';
