import test from 'node:test';
import assert from 'node:assert/strict';
import { toolCatalog } from '../electron/services/catalog';
import { ScanStateMachine } from '../electron/services/runner/stateMachine';
import { SCAN_PROFILES } from '../electron/services/pipeline/profiles';

test('Gate Phase 1: Unified Tool Catalog Integrity', async (t) => {
  await t.test('contains all managed and commercial tools', () => {
    const all = toolCatalog.getAll();
    assert.ok(all.length >= 20, `Expected at least 20 tools, got ${all.length}`);

    const expectedTools = [
      'nuclei', 'subfinder', 'httpx', 'naabu', 'katana',
      'dnsx', 'alterx', 'tlsx', 'ffuf', 'wapiti',
      'wafw00f', 'whatweb', 'arjun', 'corsy', 'cmseek',
      'gau', 'crlfsuite', 'nmap', 'zap', 'wpscan',
      'appscan', 'netsparker', 'acunetix'
    ];

    for (const toolId of expectedTools) {
      assert.ok(toolCatalog.has(toolId), `Tool ${toolId} must exist in ToolCatalog`);
      const manifest = toolCatalog.get(toolId)!;
      assert.equal(manifest.id, toolId);
      assert.ok(manifest.displayName.length > 0);
      assert.ok(manifest.capabilities.length > 0);
      assert.ok(manifest.acceptedTargetTypes.length > 0);
    }
  });

  await t.test('commercial tools are unchecked by default', () => {
    const defaultTools = toolCatalog.getDefaultSelectedTools();
    assert.ok(!defaultTools.includes('appscan'), 'appscan must NOT be in default selected tools');
    assert.ok(!defaultTools.includes('netsparker'), 'netsparker must NOT be in default selected tools');
    assert.ok(!defaultTools.includes('acunetix'), 'acunetix must NOT be in default selected tools');
    
    // Core open-source tools must be included
    assert.ok(defaultTools.includes('nuclei'));
    assert.ok(defaultTools.includes('subfinder'));
    assert.ok(defaultTools.includes('httpx'));
  });

  await t.test('WhatWeb upstream provenance is corrected (not python pip homonym)', () => {
    const whatweb = toolCatalog.get('whatweb')!;
    assert.equal(whatweb.runtime, 'ruby', 'WhatWeb runtime must be ruby/git-clone');
    assert.notEqual(whatweb.installStrategy.type, 'pip', 'WhatWeb must NOT use pip install');
    assert.match(whatweb.sourceUrl, /urbanadventurer\/WhatWeb/i);
  });

  await t.test('validates target types accurately per tool capability', () => {
    assert.equal(toolCatalog.validateTarget('subfinder', 'domain'), true);
    assert.equal(toolCatalog.validateTarget('subfinder', 'cidr'), false);

    assert.equal(toolCatalog.validateTarget('nmap', 'ip'), true);
    assert.equal(toolCatalog.validateTarget('nmap', 'cidr'), true);

    assert.equal(toolCatalog.validateTarget('nuclei', 'url'), true);
  });

  await t.test('interprets exit code semantics correctly', () => {
    assert.equal(toolCatalog.getExitCodeSemantic('nuclei', 0), 'clean');
    assert.equal(toolCatalog.getExitCodeSemantic('nuclei', 1), 'failure');
    assert.equal(toolCatalog.getExitCodeSemantic('nuclei', null), 'interrupted');

    // Wapiti exit 1 means vulnerabilities found, which is a success/findings state
    assert.equal(toolCatalog.getExitCodeSemantic('wapiti', 0), 'clean');
    assert.equal(toolCatalog.getExitCodeSemantic('wapiti', 1), 'clean');
  });
});

test('Gate Phase 1: State Machine Transitions & Aggregate Computations', async (t) => {
  await t.test('enforces legal transitions and rejects illegal backwards transitions', () => {
    assert.equal(ScanStateMachine.isValidTransition('QUEUED', 'VALIDATING'), true);
    assert.equal(ScanStateMachine.isValidTransition('VALIDATING', 'RUNNING'), true);
    assert.equal(ScanStateMachine.isValidTransition('RUNNING', 'COMPLETED'), true);
    assert.equal(ScanStateMachine.isValidTransition('RUNNING', 'STOPPED'), true);

    // Illegal backwards transitions from terminal states
    assert.equal(ScanStateMachine.isValidTransition('COMPLETED', 'RUNNING'), false);
    assert.equal(ScanStateMachine.isValidTransition('FAILED', 'RUNNING'), false);
    assert.equal(ScanStateMachine.isValidTransition('STOPPED', 'RUNNING'), false);
  });

  await t.test('identifies terminal states properly', () => {
    assert.equal(ScanStateMachine.isTerminal('COMPLETED'), true);
    assert.equal(ScanStateMachine.isTerminal('PARTIAL'), true);
    assert.equal(ScanStateMachine.isTerminal('FAILED'), true);
    assert.equal(ScanStateMachine.isTerminal('STOPPED'), true);
    assert.equal(ScanStateMachine.isTerminal('INTERRUPTED'), true);

    assert.equal(ScanStateMachine.isTerminal('RUNNING'), false);
    assert.equal(ScanStateMachine.isTerminal('QUEUED'), false);
    assert.equal(ScanStateMachine.isTerminal('VALIDATING'), false);
  });

  await t.test('computes aggregate state accurately', () => {
    // All succeeded
    const stateAllOk = ScanStateMachine.computeAggregateState('RUNNING', {
      nuclei: 'COMPLETED',
      subfinder: 'COMPLETED'
    }, ['nuclei', 'subfinder']);
    assert.equal(stateAllOk, 'COMPLETED');

    // Partial success (one passed, one failed)
    const statePartial = ScanStateMachine.computeAggregateState('RUNNING', {
      nuclei: 'COMPLETED',
      subfinder: 'FAILED'
    }, ['nuclei', 'subfinder']);
    assert.equal(statePartial, 'PARTIAL');

    // All failed
    const stateAllFail = ScanStateMachine.computeAggregateState('RUNNING', {
      nuclei: 'FAILED',
      subfinder: 'FAILED'
    }, ['nuclei', 'subfinder']);
    assert.equal(stateAllFail, 'FAILED');

    // One still running
    const stateRunning = ScanStateMachine.computeAggregateState('RUNNING', {
      nuclei: 'COMPLETED',
      subfinder: 'RUNNING'
    }, ['nuclei', 'subfinder']);
    assert.equal(stateRunning, 'RUNNING');

    // STOPPED scan remains STOPPED
    const stateStopped = ScanStateMachine.computeAggregateState('STOPPED', {
      nuclei: 'FAILED',
      subfinder: 'FAILED'
    }, ['nuclei', 'subfinder']);
    assert.equal(stateStopped, 'STOPPED');
  });

  await t.test('recovers dangling scans left behind by crashes', () => {
    const mockDb = {
      scans: [
        { scanId: 'crash-1', status: 'RUNNING' },
        { scanId: 'crash-2', status: 'VALIDATING' }
      ],
      updated: [] as { scanId: string; status: string; endTime?: string }[],
      getDanglingScans() {
        return this.scans;
      },
      updateScanStatus(scanId: string, status: string, endTime?: string) {
        this.updated.push({ scanId, status, endTime });
      }
    };

    const count = ScanStateMachine.recoverDanglingScans(mockDb);
    assert.equal(count, 2);
    assert.equal(mockDb.updated.length, 2);
    assert.equal(mockDb.updated[0].status, 'INTERRUPTED');
    assert.equal(mockDb.updated[1].status, 'INTERRUPTED');
    assert.ok(mockDb.updated[0].endTime);
  });
});

test('Gate Phase 1: Standardized Scan Profiles and Passive Isolation', async (t) => {
  await t.test('passive-discovery profile contains no active probing tools', () => {
    const passiveProfile = SCAN_PROFILES['passive-discovery'];
    assert.ok(passiveProfile);
    assert.equal(passiveProfile.isPassiveOnly, true);

    const activeProbingTools = ['nuclei', 'wapiti', 'nmap', 'dalfox', 'ffuf', 'arjun'];
    for (const activeTool of activeProbingTools) {
      assert.ok(
        !passiveProfile.tools.includes(activeTool),
        `Passive profile must NOT contain active tool ${activeTool}`
      );
    }
  });

  await t.test('all tools in profiles exist in toolCatalog', () => {
    for (const [profileId, profile] of Object.entries(SCAN_PROFILES)) {
      for (const tool of profile.tools) {
        assert.ok(
          toolCatalog.has(tool),
          `Tool '${tool}' in profile '${profileId}' must exist in toolCatalog`
        );
      }
    }
  });
});
