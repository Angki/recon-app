import type Database from 'better-sqlite3';
import { logger } from '../logger';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  // Appended below in version order; existing migrations are never rewritten.
  {
    version: 1,
    name: '001_initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scans (
          scanId TEXT PRIMARY KEY,
          target TEXT NOT NULL,
          status TEXT NOT NULL,
          startTime TEXT NOT NULL,
          endTime TEXT,
          config TEXT
        );

        CREATE TABLE IF NOT EXISTS scan_status (
          scanId TEXT NOT NULL,
          scanner TEXT NOT NULL,
          status TEXT NOT NULL,
          PRIMARY KEY (scanId, scanner),
          FOREIGN KEY (scanId) REFERENCES scans(scanId) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS findings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scanId TEXT NOT NULL,
          scanner TEXT NOT NULL,
          type TEXT,
          name TEXT,
          severity TEXT,
          url TEXT,
          description TEXT,
          rawJson TEXT,
          FOREIGN KEY (scanId) REFERENCES scans(scanId) ON DELETE CASCADE
        );
      `);
    }
  },
  {
    version: 2,
    name: '002_query_indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_findings_scan_severity ON findings(scanId, severity);
        CREATE INDEX IF NOT EXISTS idx_findings_scan_scanner ON findings(scanId, scanner);
        CREATE INDEX IF NOT EXISTS idx_scans_status_time ON scans(status, startTime);
      `);
    }
  },
  {
    version: 3,
    name: '003_enterprise_domains',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          scope TEXT
        );

        CREATE TABLE IF NOT EXISTS engagements (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          name TEXT NOT NULL,
          profile TEXT,
          scanWindow TEXT,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS targets (
          id TEXT PRIMARY KEY,
          engagementId TEXT,
          targetUrl TEXT NOT NULL,
          targetType TEXT NOT NULL,
          inScope INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scanId TEXT NOT NULL,
          toolName TEXT NOT NULL,
          assetType TEXT NOT NULL,
          value TEXT NOT NULL,
          metadata TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (scanId) REFERENCES scans(scanId) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS triage_decisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fingerprint TEXT NOT NULL,
          status TEXT NOT NULL,
          reason TEXT,
          actor TEXT,
          timestamp TEXT NOT NULL,
          expiresAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_obs_scan_tool ON observations(scanId, toolName);
        CREATE INDEX IF NOT EXISTS idx_triage_fingerprint ON triage_decisions(fingerprint);
      `);
    }
  },
  {
    version: 4,
    name: '004_finding_fingerprints',
    up: (db) => {
      // Check if column already exists
      const tableInfo = db.pragma('table_info(findings)') as { name: string }[];
      const hasFingerprint = tableInfo.some(col => col.name === 'fingerprint');
      if (!hasFingerprint) {
        db.exec('ALTER TABLE findings ADD COLUMN fingerprint TEXT;');
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings(fingerprint);');
    }
  },
  {
    version: 5,
    name: '005_endpoint_inventory',
    up: db => {
      db.exec(`CREATE TABLE IF NOT EXISTS endpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scanId TEXT NOT NULL,
        url TEXT NOT NULL,
        method TEXT NOT NULL,
        parameters TEXT NOT NULL,
        sources TEXT NOT NULL,
        inScope INTEGER NOT NULL,
        UNIQUE(scanId, method, url),
        FOREIGN KEY(scanId) REFERENCES scans(scanId) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_endpoints_scan ON endpoints(scanId, id);`);
    }
  }
];

export class MigrationManager {
  static runMigrations(db: Database.Database): { appliedCount: number; currentVersion: number } {
    // 1. Ensure migrations ledger exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        appliedAt TEXT NOT NULL
      );
    `);

    // 2. Query applied migrations
    const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
    const appliedSet = new Set(appliedRows.map(r => r.version));

    let appliedCount = 0;
    const pendingMigrations = MIGRATIONS.filter(m => !appliedSet.has(m.version));

    const checkApplied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');

    for (const migration of pendingMigrations) {
      // Re-check if already applied (handles multi-process or concurrent test execution)
      const alreadyApplied = checkApplied.get(migration.version);
      if (alreadyApplied) continue;

      logger.info(`Applying migration v${migration.version}: ${migration.name}...`);
      
      const applyTx = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
      });

      try {
        applyTx();
        appliedCount++;
      } catch (err: unknown) {
        // If another process already applied it concurrently, safely continue
        const error = err as { code?: string };
        if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          continue;
        }
        throw err;
      }
    }

    const latestRow = db.prepare('SELECT MAX(version) as currentVersion FROM schema_migrations').get() as { currentVersion: number | null };
    const currentVersion = latestRow?.currentVersion || 0;

    if (appliedCount > 0) {
      logger.info(`Migrations finished. Applied ${appliedCount} migration(s). Current DB version: v${currentVersion}`);
    }

    return { appliedCount, currentVersion };
  }
}
