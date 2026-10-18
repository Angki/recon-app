export interface InputProvenance {
  sourceScanId?: string;
  endpointId?: number;
  discoveredByTools?: string[];
  requestMethod: string;
  requestUrl: string;
  parameterTested?: string;
  scannerEngine: string;
  timestamp: string;
}

export class ProvenanceTracker {
  /**
   * Attaches immutable provenance metadata to a finding's evidence object.
   */
  static attachFindingProvenance(
    finding: Record<string, unknown>,
    provenance: InputProvenance
  ): Record<string, unknown> {
    const existingEvidence = (finding.evidence && typeof finding.evidence === 'object')
      ? (finding.evidence as Record<string, unknown>)
      : {};

    return {
      ...finding,
      evidence: {
        ...existingEvidence,
        provenance: {
          sourceScanId: provenance.sourceScanId,
          endpointId: provenance.endpointId,
          discoveredByTools: provenance.discoveredByTools || [],
          requestMethod: provenance.requestMethod,
          requestUrl: provenance.requestUrl,
          parameterTested: provenance.parameterTested,
          scannerEngine: provenance.scannerEngine,
          timestamp: provenance.timestamp
        }
      }
    };
  }

  /**
   * Traces the provenance of a finding back to its source request and discovery tools.
   */
  static traceFindingProvenance(finding: Record<string, unknown>): InputProvenance | null {
    if (!finding.evidence || typeof finding.evidence !== 'object') return null;
    const evidence = finding.evidence as Record<string, unknown>;
    if (!evidence.provenance || typeof evidence.provenance !== 'object') return null;

    const prov = evidence.provenance as Record<string, unknown>;
    return {
      sourceScanId: prov.sourceScanId ? String(prov.sourceScanId) : undefined,
      endpointId: typeof prov.endpointId === 'number' ? prov.endpointId : undefined,
      discoveredByTools: Array.isArray(prov.discoveredByTools) ? prov.discoveredByTools.map(String) : [],
      requestMethod: String(prov.requestMethod || 'GET'),
      requestUrl: String(prov.requestUrl || finding.url || ''),
      parameterTested: prov.parameterTested ? String(prov.parameterTested) : undefined,
      scannerEngine: String(prov.scannerEngine || finding.scanner || 'unknown'),
      timestamp: String(prov.timestamp || finding.timestamp || new Date().toISOString())
    };
  }
}
