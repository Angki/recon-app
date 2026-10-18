export interface EndpointRecord {
  id: number;
  scanId: string;
  url: string;
  method: string;
  parameters: string[];
  sources: string[];
  inScope: boolean;
}
export interface WorkflowRef {
  kind: 'endpoint' | 'retest';
  sourceScanId: string;
  endpointId?: number;
  findingId?: number;
}
export interface TestingDraft {
  target: string;
  tool: 'sqlmap' | 'nikto' | 'commix';
  parameters: string[];
  scopeOrigin: string;
  workflow: WorkflowRef;
}
export interface WorkflowRun {
  scanId: string;
  target: string;
  status: string;
  startTime: string;
  kind: string;
  verdict: 'running' | 'inconclusive' | 'observed' | 'not-observed' | 'completed';
}
