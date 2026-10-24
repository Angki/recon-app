import test from 'node:test';
import assert from 'node:assert/strict';
import { dockerService } from '../electron/services/platform/dockerService';

test('DockerService resolves Docker Desktop executable or handles missing gracefully', () => {
  const desktopExe = dockerService.findDockerDesktopExecutable();
  if (process.platform === 'win32') {
    // If installed, it should be a string ending in Docker Desktop.exe
    if (desktopExe) {
      assert.match(desktopExe, /Docker Desktop\.exe$/i);
    }
  } else {
    assert.equal(desktopExe, null);
  }
});

test('DockerService checks daemon status and returns boolean', async () => {
  const isRunning = await dockerService.isDockerRunning();
  assert.equal(typeof isRunning, 'boolean');
});

test('DockerService getStatus returns complete structure', async () => {
  const status = await dockerService.getStatus();
  assert.equal(typeof status.installed, 'boolean');
  assert.equal(typeof status.running, 'boolean');
  if (status.running) {
    assert.ok(status.version, 'Expected version to be present when Docker is running');
  }
});
