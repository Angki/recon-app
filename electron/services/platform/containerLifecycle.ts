import { exec } from 'node:child_process';
import { logger } from '../logger';

export class ContainerLifecycleManager {
  // Maps scanId -> Set of container IDs or names
  private activeContainers = new Map<string, Set<string>>();

  registerContainer(scanId: string, containerNameOrId: string) {
    if (!this.activeContainers.has(scanId)) {
      this.activeContainers.set(scanId, new Set());
    }
    this.activeContainers.get(scanId)!.add(containerNameOrId);
    logger.info(`Registered container '${containerNameOrId}' for scan '${scanId}'`, 'ContainerLifecycle');
  }

  unregisterContainer(scanId: string, containerNameOrId: string) {
    const set = this.activeContainers.get(scanId);
    if (set) {
      set.delete(containerNameOrId);
      if (set.size === 0) {
        this.activeContainers.delete(scanId);
      }
    }
  }

  getContainersForScan(scanId: string): string[] {
    const set = this.activeContainers.get(scanId);
    return set ? Array.from(set) : [];
  }

  /**
   * Forces deletion of all active containers for a scan to ensure cancel does not leave orphan processes.
   */
  async cleanupContainers(scanId: string): Promise<string[]> {
    const containers = this.getContainersForScan(scanId);
    if (containers.length === 0) return [];

    const cleaned: string[] = [];

    for (const containerId of containers) {
      await new Promise<void>((resolve) => {
        exec(`docker rm -f ${containerId}`, { timeout: 10000 }, (err) => {
          if (err) {
            logger.warn(`Failed to docker rm -f ${containerId}: ${err.message}`, 'ContainerLifecycle');
          } else {
            logger.info(`Cleaned up container '${containerId}'`, 'ContainerLifecycle');
            cleaned.push(containerId);
          }
          resolve();
        });
      });
    }

    this.activeContainers.delete(scanId);
    return cleaned;
  }

  async cleanupAll(): Promise<void> {
    const scanIds = Array.from(this.activeContainers.keys());
    for (const scanId of scanIds) {
      await this.cleanupContainers(scanId);
    }
  }
}

export const containerLifecycle = new ContainerLifecycleManager();
