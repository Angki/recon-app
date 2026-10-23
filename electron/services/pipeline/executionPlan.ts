import { HOST_SOURCE_SCANNERS } from '../hostInventory';

export interface ExecutionPlan {
  parallel: string[];
  staged: string[];
}

/**
 * Discovery engines feed a shared host inventory, so they keep dependency order even in
 * concurrent mode; unrelated engines still start together.
 */
export function planExecution(
  tools: string[],
  mode: 'pipeline' | 'concurrent',
  priority: Record<string, number>
): ExecutionPlan {
  const byPriority = (a: string, b: string) => (priority[a] ?? 99) - (priority[b] ?? 99);
  if (mode === 'pipeline') {
    return { parallel: [], staged: [...tools].sort(byPriority) };
  }
  return {
    parallel: tools.filter(tool => !HOST_SOURCE_SCANNERS.has(tool)),
    staged: tools.filter(tool => HOST_SOURCE_SCANNERS.has(tool)).sort(byPriority)
  };
}
