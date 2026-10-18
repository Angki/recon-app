import crypto from 'node:crypto';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface ParameterLocation {
  name: string;
  location: 'query' | 'body' | 'header' | 'cookie';
  sampleValue: string;
}

export interface RequestDefinition {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  contentType?: string;
  body?: string;
  authProfileId?: string;
  testParameters: string[];
  provenance?: {
    source: 'raw_http' | 'har' | 'openapi' | 'manual' | 'discovery';
    originalEndpointId?: number;
    importedAt: string;
  };
}

export class RequestWorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestWorkspaceError';
  }
}

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB safety boundary
const MAX_URL_LENGTH = 8192;

export class RequestWorkspace {
  /**
   * Imports and validates a raw RFC 7230/9112 HTTP request string.
   */
  static importRawHttp(rawText: string, defaultHost?: string): RequestDefinition {
    if (typeof rawText !== 'string' || !rawText.trim()) {
      throw new RequestWorkspaceError('Raw HTTP content cannot be empty');
    }
    if (Buffer.byteLength(rawText, 'utf8') > MAX_IMPORT_SIZE_BYTES) {
      throw new RequestWorkspaceError(`Raw HTTP input exceeds maximum allowed size of 10MB`);
    }

    // Normalize newlines
    const normalized = rawText.replace(/\r\n/g, '\n');
    const splitIndex = normalized.indexOf('\n\n');
    const headerBlock = splitIndex !== -1 ? normalized.slice(0, splitIndex) : normalized;
    const bodyBlock = splitIndex !== -1 ? normalized.slice(splitIndex + 2) : '';

    const lines = headerBlock.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      throw new RequestWorkspaceError('Invalid HTTP request: empty request line');
    }

    // Request line: METHOD PATH HTTP/X.X
    const requestLine = lines[0].trim();
    const lineParts = requestLine.split(/\s+/);
    if (lineParts.length < 2) {
      throw new RequestWorkspaceError(`Invalid request line: "${requestLine}"`);
    }

    const rawMethod = lineParts[0].toUpperCase();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(rawMethod)) {
      throw new RequestWorkspaceError(`Unsupported HTTP method: ${rawMethod}`);
    }
    const method = rawMethod as HttpMethod;
    const rawPath = lineParts[1];

    const headers: Record<string, string> = {};
    const cookies: Record<string, string> = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      headers[key] = val;

      if (key === 'cookie') {
        const cookiePairs = val.split(';');
        for (const pair of cookiePairs) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx !== -1) {
            cookies[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
          }
        }
      }
    }

    // Determine host and full URL
    const host = headers['host'] || defaultHost;
    if (!host) {
      throw new RequestWorkspaceError('Host header is required in raw HTTP request or defaultHost must be provided');
    }

    const isHttps = headers['x-forwarded-proto'] === 'https' || host.includes(':443') || host.includes(':8443');
    const scheme = headers['x-forwarded-proto'] || (isHttps ? 'https' : 'http');
    const fullUrl = /^https?:\/\//i.test(rawPath)
      ? rawPath
      : `${scheme}://${host}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;

    if (fullUrl.length > MAX_URL_LENGTH) {
      throw new RequestWorkspaceError(`Constructed URL exceeds ${MAX_URL_LENGTH} characters`);
    }

    const parsedUrl = new URL(fullUrl);
    const query: Record<string, string> = {};
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      query[k] = v;
    }

    // Extract content-type
    const contentType = headers['content-type']?.split(';')[0].trim().toLowerCase();

    // Extract testable parameters
    const testParameters = new Set<string>(Object.keys(query));
    if (bodyBlock) {
      if (contentType === 'application/x-www-form-urlencoded') {
        const bodyParams = new URLSearchParams(bodyBlock);
        for (const k of bodyParams.keys()) {
          testParameters.add(k);
        }
      } else if (contentType === 'application/json') {
        try {
          const parsedJson = JSON.parse(bodyBlock);
          if (typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson)) {
            for (const k of Object.keys(parsedJson)) {
              testParameters.add(k);
            }
          }
        } catch {
          // Non-JSON body
        }
      }
    }

    return {
      id: crypto.randomUUID(),
      name: `${method} ${parsedUrl.pathname}`,
      method,
      url: fullUrl,
      query,
      headers,
      cookies,
      contentType,
      body: bodyBlock.length > 0 ? bodyBlock : undefined,
      testParameters: Array.from(testParameters),
      provenance: {
        source: 'raw_http',
        importedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Imports HTTP entries from an HTTP Archive (HAR) JSON string.
   */
  static importHar(harContent: string, maxEntries = 200): RequestDefinition[] {
    if (Buffer.byteLength(harContent, 'utf8') > MAX_IMPORT_SIZE_BYTES) {
      throw new RequestWorkspaceError('HAR input exceeds maximum allowed size of 10MB');
    }

    let harData: any;
    try {
      harData = JSON.parse(harContent);
    } catch {
      throw new RequestWorkspaceError('Invalid HAR format: malformed JSON');
    }

    if (!harData?.log?.entries || !Array.isArray(harData.log.entries)) {
      throw new RequestWorkspaceError('Invalid HAR format: missing log.entries array');
    }

    const requests: RequestDefinition[] = [];
    const entries = harData.log.entries.slice(0, maxEntries);

    for (const entry of entries) {
      try {
        const req = entry.request;
        if (!req || !req.method || !req.url) continue;

        const rawMethod = req.method.toUpperCase();
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(rawMethod)) continue;

        const parsedUrl = new URL(req.url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) continue;

        const headers: Record<string, string> = {};
        if (Array.isArray(req.headers)) {
          for (const h of req.headers) {
            if (h.name && h.value) headers[h.name.toLowerCase()] = String(h.value);
          }
        }

        const cookies: Record<string, string> = {};
        if (Array.isArray(req.cookies)) {
          for (const c of req.cookies) {
            if (c.name && c.value) cookies[c.name] = String(c.value);
          }
        }

        const query: Record<string, string> = {};
        for (const [k, v] of parsedUrl.searchParams.entries()) {
          query[k] = v;
        }

        const postData = req.postData;
        const contentType = postData?.mimeType?.split(';')[0]?.toLowerCase();
        const body = postData?.text;

        const testParameters = new Set<string>(Object.keys(query));
        if (postData?.params && Array.isArray(postData.params)) {
          for (const p of postData.params) {
            if (p.name) testParameters.add(p.name);
          }
        } else if (contentType === 'application/json' && body) {
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              for (const k of Object.keys(parsed)) testParameters.add(k);
            }
          } catch { /* ignore */ }
        }

        requests.push({
          id: crypto.randomUUID(),
          name: `${rawMethod} ${parsedUrl.pathname}`,
          method: rawMethod as HttpMethod,
          url: parsedUrl.href,
          query,
          headers,
          cookies,
          contentType,
          body,
          testParameters: Array.from(testParameters),
          provenance: {
            source: 'har',
            importedAt: new Date().toISOString()
          }
        });
      } catch {
        // Skip malformed entries
      }
    }

    return requests;
  }

  /**
   * Imports request templates from an OpenAPI / Swagger specification JSON.
   */
  static importOpenApi(specContent: string, defaultBaseUrl = 'https://api.target.local'): RequestDefinition[] {
    if (Buffer.byteLength(specContent, 'utf8') > MAX_IMPORT_SIZE_BYTES) {
      throw new RequestWorkspaceError('OpenAPI spec exceeds maximum allowed size of 10MB');
    }

    let spec: any;
    try {
      spec = JSON.parse(specContent);
    } catch {
      throw new RequestWorkspaceError('OpenAPI spec must be valid JSON');
    }

    if (!spec?.paths || typeof spec.paths !== 'object') {
      throw new RequestWorkspaceError('OpenAPI spec missing valid "paths" object');
    }

    const requests: RequestDefinition[] = [];
    const serverUrl = spec.servers?.[0]?.url || defaultBaseUrl;
    const baseUrl = serverUrl.startsWith('/') ? `${defaultBaseUrl}${serverUrl}` : serverUrl;

    for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const verbs: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      for (const verb of verbs) {
        const op = (pathItem as any)[verb.toLowerCase()];
        if (!op) continue;

        const query: Record<string, string> = {};
        const headers: Record<string, string> = {};
        const testParameters = new Set<string>();

        // Query & Header parameters
        const params = [...(op.parameters || []), ...((pathItem as any).parameters || [])];
        for (const p of params) {
          if (!p || !p.name) continue;
          if (p.in === 'query') {
            const val = p.example ? String(p.example) : (p.schema?.default ? String(p.schema.default) : 'test');
            query[p.name] = val;
            testParameters.add(p.name);
          } else if (p.in === 'header') {
            headers[p.name.toLowerCase()] = p.example ? String(p.example) : 'test';
          }
        }

        // Body schema parameters
        let body: string | undefined;
        let contentType: string | undefined;
        const requestBody = op.requestBody;
        if (requestBody?.content) {
          if (requestBody.content['application/json']) {
            contentType = 'application/json';
            const schema = requestBody.content['application/json'].schema;
            const sampleJson: Record<string, unknown> = {};
            if (schema?.properties) {
              for (const [propName, propDef] of Object.entries<any>(schema.properties)) {
                sampleJson[propName] = propDef.example || (propDef.type === 'number' ? 1 : 'test');
                testParameters.add(propName);
              }
            }
            body = JSON.stringify(sampleJson);
          } else if (requestBody.content['application/x-www-form-urlencoded']) {
            contentType = 'application/x-www-form-urlencoded';
            const schema = requestBody.content['application/x-www-form-urlencoded'].schema;
            const formParams = new URLSearchParams();
            if (schema?.properties) {
              for (const propName of Object.keys(schema.properties)) {
                formParams.set(propName, 'test');
                testParameters.add(propName);
              }
            }
            body = formParams.toString();
          }
        }

        const queryStr = Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : '';
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const cleanPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
        const fullUrl = `${cleanBase}${cleanPath}${queryStr}`;

        requests.push({
          id: crypto.randomUUID(),
          name: op.summary || `${verb} ${pathStr}`,
          method: verb,
          url: fullUrl,
          query,
          headers,
          cookies: {},
          contentType,
          body,
          testParameters: Array.from(testParameters),
          provenance: {
            source: 'openapi',
            importedAt: new Date().toISOString()
          }
        });
      }
    }

    return requests;
  }

  /**
   * Inspects all parameters and their physical locations in the request.
   */
  static inspectParameters(req: RequestDefinition): ParameterLocation[] {
    const locations: ParameterLocation[] = [];

    // Query parameters
    for (const [k, v] of Object.entries(req.query || {})) {
      locations.push({ name: k, location: 'query', sampleValue: v });
    }

    // Body parameters
    if (req.body) {
      if (req.contentType === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams(req.body);
        for (const [k, v] of params.entries()) {
          locations.push({ name: k, location: 'body', sampleValue: v });
        }
      } else if (req.contentType === 'application/json') {
        try {
          const parsed = JSON.parse(req.body);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            for (const [k, v] of Object.entries(parsed)) {
              locations.push({ name: k, location: 'body', sampleValue: String(v) });
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Header parameters (excluding standard transport headers)
    const ignoredHeaders = new Set(['host', 'content-length', 'connection', 'accept', 'user-agent']);
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (!ignoredHeaders.has(k)) {
        locations.push({ name: k, location: 'header', sampleValue: v });
      }
    }

    // Cookies
    for (const [k, v] of Object.entries(req.cookies || {})) {
      locations.push({ name: k, location: 'cookie', sampleValue: v });
    }

    return locations;
  }

  /**
   * Builds tool-specific CLI arguments for active testing engines.
   */
  static buildToolArguments(tool: string, req: RequestDefinition, authHeader?: string): string[] {
    const args: string[] = [];

    switch (tool) {
      case 'sqlmap': {
        args.push('-u', req.url, '--batch');
        if (req.method === 'POST' && req.body) {
          args.push(`--data=${req.body}`);
          args.push(`--method=${req.method}`);
        }
        if (req.testParameters.length > 0) {
          args.push('-p', req.testParameters.join(','));
        }
        const cookies = Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookies) args.push(`--cookie=${cookies}`);
        if (authHeader) args.push(`--headers=Authorization: ${authHeader}`);
        break;
      }
      case 'commix': {
        args.push('--url', req.url, '--batch');
        if (req.method === 'POST' && req.body) {
          args.push(`--data=${req.body}`);
        }
        if (req.testParameters.length > 0) {
          args.push('-p', req.testParameters[0]);
        }
        const cookies = Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookies) args.push(`--cookie=${cookies}`);
        if (authHeader) args.push(`--headers=Authorization: ${authHeader}`);
        break;
      }
      case 'dalfox': {
        args.push('url', req.url, '--silence');
        if (req.method === 'POST' && req.body) {
          args.push('--data', req.body);
        }
        if (req.testParameters.length > 0) {
          args.push('-p', req.testParameters.join(','));
        }
        const cookies = Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookies) args.push('--cookie', cookies);
        if (authHeader) args.push('--header', `Authorization: ${authHeader}`);
        break;
      }
      case 'nikto': {
        const parsed = new URL(req.url);
        args.push('-h', parsed.origin);
        if (authHeader) args.push('-id', authHeader);
        break;
      }
      case 'nuclei': {
        args.push('-u', req.url);
        if (authHeader) args.push('-H', `Authorization: ${authHeader}`);
        break;
      }
      default:
        args.push(req.url);
    }

    return args;
  }

  /**
   * Generates a safe command preview with secrets strictly redacted.
   */
  static buildSafePreview(tool: string, req: RequestDefinition, authHeader?: string): string[] {
    const rawArgs = this.buildToolArguments(tool, req, authHeader);
    return rawArgs.map(arg => {
      // Redact Authorization headers and secrets
      if (/Authorization:\s*/i.test(arg)) {
        return arg.replace(/Authorization:\s*.+/i, 'Authorization: [AUTH_REDACTED]');
      }
      if (/--cookie=.+/i.test(arg)) {
        return arg.replace(/--cookie=.+/i, '--cookie=[COOKIES_REDACTED]');
      }
      if (/-id\s+.+/i.test(arg)) {
        return '-id [AUTH_REDACTED]';
      }
      return arg;
    });
  }
}
