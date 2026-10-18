import fs from 'node:fs';
import path from 'node:path';
import {
  type ScanTarget,
  type TargetType,
  type WebUrlTarget,
  type LocalSourceTarget,
  type ContainerImageTarget,
  type ApiSpecTarget,
  TOOL_TARGET_CAPABILITIES
} from './types';

export class TargetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TargetValidationError';
  }
}

/**
 * Resolves a raw target string or ScanTarget object into a strongly-typed ScanTarget.
 */
export function resolveTarget(input: string | ScanTarget): ScanTarget {
  if (typeof input === 'object' && input !== null && 'type' in input) {
    validateTargetObject(input);
    return input;
  }

  if (typeof input !== 'string') {
    throw new TargetValidationError('Target must be a non-empty string or a valid ScanTarget object');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new TargetValidationError('Target cannot be blank');
  }

  // 1. Container Image format prefix (docker:nginx:latest or image:alpine:3.18)
  if (trimmed.startsWith('docker:') || trimmed.startsWith('image:')) {
    const imageRef = trimmed.replace(/^(docker|image):/, '').trim();
    if (!imageRef) {
      throw new TargetValidationError('Container image reference cannot be empty');
    }
    return {
      type: 'container_image',
      imageReference: imageRef
    } as ContainerImageTarget;
  }

  // 2. HTTP / HTTPS Web URL or API Specification URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new TargetValidationError(`Unsupported protocol: ${parsed.protocol}`);
      }
      if (parsed.username || parsed.password) {
        throw new TargetValidationError('Target URL cannot contain embedded basic authentication credentials');
      }

      // Check if URL points directly to an OpenAPI or Swagger spec file
      const pathname = parsed.pathname.toLowerCase();
      if (
        pathname.endsWith('/openapi.json') ||
        pathname.endsWith('/openapi.yaml') ||
        pathname.endsWith('/swagger.json') ||
        pathname.endsWith('/swagger.yaml')
      ) {
        return {
          type: 'api_spec',
          specLocation: parsed.href,
          format: pathname.includes('swagger') ? 'swagger_v2' : 'openapi_v3'
        } as ApiSpecTarget;
      }

      return {
        type: 'web_url',
        url: parsed.href
      } as WebUrlTarget;
    } catch (err: unknown) {
      if (err instanceof TargetValidationError) throw err;
      throw new TargetValidationError(`Malformed Web URL: ${trimmed}`);
    }
  }

  // 3. Local Source Repository or Directory
  if (path.isAbsolute(trimmed) || trimmed.startsWith('.') || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    const resolvedPath = path.resolve(trimmed);
    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        return {
          type: 'local_source',
          path: resolvedPath
        } as LocalSourceTarget;
      } else if (stat.isFile() && /\.(json|yaml|yml)$/i.test(resolvedPath)) {
        return {
          type: 'api_spec',
          specLocation: resolvedPath,
          format: 'openapi_v3'
        } as ApiSpecTarget;
      }
    }
  }

  // Fallback: If looks like a domain name without scheme (e.g. "example.com" or "api.corp.local/path")
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(trimmed)) {
    const url = `https://${trimmed}`;
    new URL(url); // validate
    return {
      type: 'web_url',
      url
    } as WebUrlTarget;
  }

  throw new TargetValidationError(
    `Unrecognized target format: "${trimmed}". Provide a valid HTTP(S) URL, local directory path, or container image reference.`
  );
}

function validateTargetObject(target: ScanTarget) {
  switch (target.type) {
    case 'web_url': {
      const parsed = new URL(target.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new TargetValidationError('Web URL must use HTTP or HTTPS');
      }
      break;
    }
    case 'api_spec': {
      if (!target.specLocation || typeof target.specLocation !== 'string') {
        throw new TargetValidationError('API spec target requires a valid specLocation');
      }
      break;
    }
    case 'local_source': {
      if (!target.path || typeof target.path !== 'string') {
        throw new TargetValidationError('Local source target requires a valid directory path');
      }
      break;
    }
    case 'container_image': {
      if (!target.imageReference || typeof target.imageReference !== 'string') {
        throw new TargetValidationError('Container image target requires a valid imageReference');
      }
      break;
    }
    default:
      throw new TargetValidationError(`Unsupported target type: ${(target as any).type}`);
  }
}

/**
 * Validates requested tools against the target type.
 * Enforces rule: "URL ditolak untuk tool source-only."
 */
export function validateToolsForTarget(
  target: ScanTarget,
  requestedTools: string[]
): { valid: boolean; rejectedTools: { tool: string; reason: string }[] } {
  const rejectedTools: { tool: string; reason: string }[] = [];

  for (const tool of requestedTools) {
    const capabilities = TOOL_TARGET_CAPABILITIES[tool];
    if (!capabilities) {
      continue; // Tool not in capability map, handled by catalog
    }

    if (!capabilities.includes(target.type)) {
      if (target.type === 'web_url' && capabilities.includes('local_source') && !capabilities.includes('web_url')) {
        rejectedTools.push({
          tool,
          reason: `Tool '${tool}' requires a local source repository or directory target ('local_source'), and cannot run against web URL: ${target.url}. Use DAST engines (Nuclei, Wapiti, ZAP) for web application testing.`
        });
      } else {
        rejectedTools.push({
          tool,
          reason: `Tool '${tool}' does not support target type '${target.type}'. Supported types: [${capabilities.join(', ')}].`
        });
      }
    }
  }

  return {
    valid: rejectedTools.length === 0,
    rejectedTools
  };
}
