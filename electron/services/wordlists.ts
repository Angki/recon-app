import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Bundled fallback content discovery list. FFUF previously defaulted to a
 * machine-specific path that rarely existed and silently produced zero work.
 */
const DEFAULT_CONTENT_PATHS = [
  'admin', 'administrator', 'login', 'logout', 'register', 'signup', 'signin',
  'dashboard', 'api', 'api/v1', 'api/v2', 'graphql', 'swagger', 'swagger-ui',
  'swagger.json', 'openapi.json', 'api-docs', 'docs', 'redoc', 'health',
  'healthz', 'status', 'metrics', 'debug', 'test', 'dev', 'staging', 'backup',
  'backups', 'config', '.env', '.git/HEAD', '.git/config', 'phpinfo.php',
  'info.php', 'server-status', 'robots.txt', 'sitemap.xml', '.well-known/security.txt',
  'uploads', 'upload', 'files', 'images', 'assets', 'static', 'media', 'css', 'js',
  'includes', 'inc', 'src', 'lib', 'vendor', 'node_modules', 'wp-admin',
  'wp-login.php', 'wp-config.php', 'wp-content', 'wp-includes', 'xmlrpc.php',
  'cgi-bin', 'phpmyadmin', 'pma', 'mysql', 'database', 'db', 'sql', 'shell',
  'cmd', 'console', 'actuator', 'actuator/health', 'actuator/env', 'jolokia',
  'adminer', 'admin/login', 'user', 'users', 'account', 'profile', 'settings',
  'password', 'reset', 'forgot-password', 'auth', 'oauth', 'token', 'keys',
  'private', 'secret', 'secrets', 'internal', 'tmp', 'temp', 'cache', 'logs',
  'log', 'error', 'errors', 'trace', 'monitor', 'monitoring', 'jenkins',
  'gitlab', 'grafana', 'kibana', 'portainer', 'phpinfo', 'test.php', 'info',
  'version', 'README.md', 'CHANGELOG.md', 'composer.json', 'package.json',
  'package-lock.json', 'yarn.lock', 'Dockerfile', 'docker-compose.yml', 'Makefile',
  '.htaccess', '.htpasswd', 'web.config', 'crossdomain.xml',
  'clientaccesspolicy.xml', 'favicon.ico', '404', '403', '500', 'maintenance',
  'coming-soon', 'beta', 'demo', 'examples', 'sample', 'storage', 'data',
  'export', 'import', 'download', 'downloads', 'report', 'reports', 'invoice',
  'invoices', 'payment', 'payments', 'checkout', 'cart', 'orders', 'products',
  'catalog', 'search', 'feed', 'rss', 'atom', 'newsletter', 'subscribe',
  'contact', 'about', 'team', 'careers', 'blog', 'news', 'press', 'faq',
  'help', 'support'
];

const MIN_WORDLIST_ENTRIES = 8;
const MAX_WORDLIST_BYTES = 20 * 1024 * 1024;

function usableEntryCount(filePath: string): number {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return 0;
    const stats = fs.statSync(filePath);
    if (stats.size === 0 || stats.size > MAX_WORDLIST_BYTES) return 0;

    const buffer = fs.readFileSync(filePath);
    if (buffer.length >= 2) {
      const hasUtf16Bom = (buffer[0] === 0xFF && buffer[1] === 0xFE) || (buffer[0] === 0xFE && buffer[1] === 0xFF);
      if (hasUtf16Bom) return 0;
    }
    // NUL bytes indicate UTF-16/UTF-32 or a binary file, which FFUF cannot consume as UTF-8 paths.
    if (buffer.includes(0)) return 0;

    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (text.includes('\uFFFD')) return 0;

    return text.split(/\r?\n/).filter(line => {
      const entry = line.trim();
      return entry.length > 0 && !entry.startsWith('#');
    }).length;
  } catch {
    return 0;
  }
}

function isUsableWordlist(filePath: string): boolean {
  return usableEntryCount(filePath) >= MIN_WORDLIST_ENTRIES;
}

export function resolveWordlist(configuredPath?: string): string | null {
  const configured = (configuredPath || '').trim();
  if (configured) {
    const resolved = path.resolve(process.cwd(), configured);
    if (isUsableWordlist(resolved)) return resolved;
  }

  const dir = path.join(os.homedir(), 'Documents', 'SecOpsScans', 'wordlists');
  const file = path.join(dir, 'common.txt');
  if (isUsableWordlist(file)) return file;

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, `${DEFAULT_CONTENT_PATHS.join('\n')}\n`, 'utf8');
    if (isUsableWordlist(file)) return file;
  } catch {
    // Fall through to the caller, which reports an actionable engine failure.
  }
  return null;
}
