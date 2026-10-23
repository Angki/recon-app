import { Suspense, lazy, useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  RefreshCw, X, ShieldAlert, Loader2, Sparkles, Terminal, 
  CheckCircle2, AlertCircle, Timer, Radio, Cpu, Maximize2, Minimize2,
  ChevronDown, ChevronUp, Send, Bot, Copy, Check, MessageSquare,
  Shield, Workflow, FileText, Download, Search, Wrench, ExternalLink
} from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import VulnerabilityTable from '../components/VulnerabilityTable';
import ScannerControls from '../components/ScannerControls';
import ToolSelection from '../components/ToolSelection';
import ActiveTestingPanel, { type ActivePlan } from '../components/ActiveTestingPanel';
import FindingsSummary from '../components/FindingsSummary';
import { ExportReportModal } from '../components/ExportReportModal';
import { Modal } from '../components/ui/Modal';
import type { Vulnerability } from '../types/vulnerability';
import { useScanStore, allTools, initialScannerStatus } from '../stores/useScanStore';
import { toast } from '../stores/useToastStore';
import type { ScannerType, ScannerStatus } from '../stores/useScanStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useLogStore } from '../stores/useLogStore';
import type { EndpointRecord } from '../types/workflow';

const TerminalPane = lazy(() => import('../components/TerminalPane'));

const ENGINE_TERMINAL_STATUSES = ['COMPLETED', 'DEGRADED', 'PARTIAL', 'SKIPPED', 'FAILED', 'STOPPED'];

/** Restore persisted per-engine outcomes (including built-in posture) into the live store. */
function applyPersistedEngineStatuses(scan: Record<string, unknown>) {
  const engineStatuses = scan.engineStatuses;
  const store = useScanStore.getState();
  store.setScannerStatus(previous => {
    const next = { ...previous };
    for (const tool of allTools) {
      const saved = scan[`${tool}Status`];
      if (typeof saved === 'string' && ENGINE_TERMINAL_STATUSES.includes(saved) && next[tool as ScannerType] !== 'STOPPED') {
        next[tool as ScannerType] = saved as ScannerStatus;
      }
    }
    if (engineStatuses && typeof engineStatuses === 'object') {
      for (const [engine, detail] of Object.entries(engineStatuses as Record<string, unknown>)) {
        if (!detail || typeof detail !== 'object') continue;
        const saved = (detail as { status?: unknown }).status;
        if (typeof saved === 'string' && ENGINE_TERMINAL_STATUSES.includes(saved)) {
          next[engine as ScannerType] = saved as ScannerStatus;
        }
      }
    }
    return next;
  });
  if (engineStatuses && typeof engineStatuses === 'object') {
    for (const [engine, detail] of Object.entries(engineStatuses as Record<string, unknown>)) {
      if (detail && typeof detail === 'object') {
        const reason = (detail as { reason?: unknown }).reason;
        if (typeof reason === 'string' && reason) store.setScannerReason(engine, reason);
      }
    }
  }
}

function ConsolePaneFallback() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)] text-[var(--text-muted)]"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      <span className="ml-2 text-xs font-mono">Memuat console engine...</span>
    </div>
  );
}

const FormattedMarkdown = ({ content }: { content: string }) => {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)] font-sans">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const lang = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines.shift() : '';
          const code = lines.join('\n');
          return (
            <div key={pIdx} className="my-2 rounded-xl overflow-hidden border border-[var(--border-card)] bg-black/40">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-app)] border-b border-[var(--border-card)] text-[10px] font-mono text-[var(--text-muted)]">
                <span>{lang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <pre className="p-3 overflow-x-auto font-mono text-xs text-emerald-400">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={pIdx} className="space-y-2">
            {part.split('\n\n').map((block, bIdx) => {
              const trimmed = block.trim();
              if (!trimmed) return null;

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={bIdx} className="text-sm font-bold text-purple-300 mt-3 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {trimmed.slice(4)}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={bIdx} className="text-base font-bold text-[var(--text-primary)] border-b border-[var(--border-card)] pb-1 mt-4 mb-2">
                    {trimmed.slice(3)}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={bIdx} className="text-lg font-bold text-[var(--accent-primary)] mt-4 mb-2">
                    {trimmed.slice(2)}
                  </h2>
                );
              }
              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote key={bIdx} className="p-2.5 rounded-xl bg-purple-500/10 border-l-2 border-purple-400 text-purple-300 my-2">
                    {trimmed.slice(2)}
                  </blockquote>
                );
              }

              if (trimmed.includes('\n- ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const items = trimmed.split(/\n(?=[-*]\s|\d+\.\s)/);
                return (
                  <ul key={bIdx} className="space-y-1.5 my-1.5 pl-2">
                    {items.map((item, iIdx) => {
                      const cleanItem = item.replace(/^[-*]\s+|\d+\.\s+/, '');
                      return (
                        <li key={iIdx} className="flex items-start gap-2">
                          <span className="text-[var(--accent-primary)] mt-1">•</span>
                          <div>
                            {cleanItem.split(/(\*\*.*?\*\*)/).map((seg, sIdx) => {
                              if (seg.startsWith('**') && seg.endsWith('**')) {
                                return <strong key={sIdx} className="text-[var(--text-primary)] font-semibold">{seg.slice(2, -2)}</strong>;
                              }
                              return <span key={sIdx}>{seg}</span>;
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              return (
                <p key={bIdx} className="leading-relaxed">
                  {trimmed.split(/(\*\*.*?\*\*)/).map((seg, sIdx) => {
                    if (seg.startsWith('**') && seg.endsWith('**')) {
                      return <strong key={sIdx} className="text-[var(--text-primary)] font-semibold">{seg.slice(2, -2)}</strong>;
                    }
                    return <span key={sIdx}>{seg}</span>;
                  })}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default function Dashboard({ onOpenToolsHub }: { onOpenToolsHub?: () => void } = {}) {

  const {
    targetUrl, setTargetUrl,
    scanId, setScanId,
    activeTab, setActiveTab,
    workspaceTab, setWorkspaceTab,
    isWordpressScan, setIsWordpressScan,
    selectedTools, setSelectedTools,
    status, setStatus,
    scannerStatus, setScannerStatus,
    scannerReasons,
    allFindings, setAllFindings,
    nucleiFindings, setNucleiFindings,
    wapitiVulns, setWapitiVulns,
    wapitiPages, setWapitiPages,
    dashboardView, setDashboardView,
    executionMode, setExecutionMode,
    resetScanState,
    testingDraft, setTestingDraft,
  } = useScanStore();

  const {
    dependencies, setDependencies,
    showDependencyModal, setShowDependencyModal,
    isInstallingDependencies, setIsInstallingDependencies,
    dependencyLogs, setDependencyLogs,
    isUpdating, setIsUpdating,
    updateLogs, setUpdateLogs,
    showUpdateModal, setShowUpdateModal,
  } = useConfigStore();

  const {
    appendRawLogs, clearRawLogs,
    aiResponse, setAiResponse,
    isAnalyzing, setIsAnalyzing,
    aiProgressMsg, setAiProgressMsg,
  } = useLogStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [activePlan, setActivePlan] = useState<ActivePlan>({ scopeOrigin:'', parameters:[], timeoutMinutes:10, delaySeconds:1 });
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<EndpointRecord[]>([]);
  const [discoveredJwt, setDiscoveredJwt] = useState<string | null>(null);
  const [autoCascadeEnabled, setAutoCascadeEnabled] = useState<boolean>(true);
  const [selectedPreset, setSelectedPreset] = useState<'executive' | 'attack_path' | 'remediation' | 'verification'>('executive');
  const [savedAnalyses, setSavedAnalyses] = useState<Record<string, { analysisText: string; model?: string; createdAt?: string }>>({});
  const [activeAiModel, setActiveAiModel] = useState<string>('recon-analyst:latest');
  const [activeAiProvider, setActiveAiProvider] = useState<string>('ollama');
  const [activeAiBaseUrl, setActiveAiBaseUrl] = useState<string>('http://100.119.195.119:11434');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [isCopilotThinking, setIsCopilotThinking] = useState<boolean>(false);
  const [showCopilotDrawer, setShowCopilotDrawer] = useState<boolean>(true);

  const reloadSavedAnalyses = useCallback(async (targetScanId: string) => {
    if (!targetScanId || !window.api) return {};
    try {
      const records = await window.api.getAiAnalyses(targetScanId);
      if (Array.isArray(records)) {
        const mapped: Record<string, { analysisText: string; model?: string; createdAt?: string }> = {};
        for (const item of records) {
          const preset = String(item.preset || 'executive');
          if (!mapped[preset] && typeof item.analysisText === 'string') {
            mapped[preset] = {
              analysisText: item.analysisText,
              model: item.model ? String(item.model) : undefined,
              createdAt: item.createdAt ? String(item.createdAt) : undefined
            };
          }
        }
        setSavedAnalyses(mapped);
        return mapped;
      }
    } catch { /* ignore */ }
    return {};
  }, []);

  const [depFilter, setDepFilter] = useState<'all' | 'missing' | 'installed'>('all');
  const [depSearch, setDepSearch] = useState<string>('');
  const depLogsEndRef = useRef<HTMLDivElement>(null);

  const depStats = useMemo(() => {
    const total = dependencies.length;
    const installed = dependencies.filter(d => d.isInstalled).length;
    const missing = dependencies.filter(d => !d.isInstalled);
    const missingAuto = missing.filter(d => !d.requiresManual).length;
    const missingManual = missing.filter(d => d.requiresManual).length;
    const percent = total > 0 ? Math.round((installed / total) * 100) : 100;
    return { total, installed, missing: missing.length, missingAuto, missingManual, percent };
  }, [dependencies]);

  const filteredDependencies = useMemo(() => {
    return dependencies.filter(d => {
      const matchesFilter =
        depFilter === 'all'
          ? true
          : depFilter === 'installed'
          ? d.isInstalled
          : !d.isInstalled;
      const matchesSearch = depSearch.trim()
        ? d.name.toLowerCase().includes(depSearch.toLowerCase().trim())
        : true;
      return matchesFilter && matchesSearch;
    });
  }, [dependencies, depFilter, depSearch]);

  useEffect(() => {
    if (dependencyLogs.length > 0) {
      depLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dependencyLogs]);

  const isWebUrlTarget = useMemo(() => {
    const trimmed = (targetUrl || '').trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('docker:') || trimmed.startsWith('image:')) return false;
    if (/^[a-zA-Z]:\\/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
      return false;
    }
    return true;
  }, [targetUrl]);

  const incompatibleTools = useMemo(() => {
    if (!isWebUrlTarget) return [];
    const sourceOnly = ['gitleaks', 'semgrep', 'trivy', 'syft'];
    return selectedTools.filter(t => sourceOnly.includes(t));
  }, [isWebUrlTarget, selectedTools]);

  useEffect(() => {
    if (window.api?.getSettings) {
      window.api.getSettings().then(s => {
        if (s.aiModel) setActiveAiModel(s.aiModel);
        if (s.aiProvider) setActiveAiProvider(s.aiProvider);
        if (s.aiBaseUrl) setActiveAiBaseUrl(s.aiBaseUrl);
      });
    }
  }, []);

  useEffect(() => {
    if (!testingDraft) return;
    const target = new URL(testingDraft.target);
    if (testingDraft.workflow.kind === 'endpoint') {
      for (const parameter of testingDraft.parameters) if (!target.searchParams.has(parameter)) target.searchParams.set(parameter,'');
    }
    const href = target.href;
    const tool = testingDraft.tool;
    const plan: ActivePlan = { scopeOrigin: testingDraft.scopeOrigin, parameters: testingDraft.parameters, timeoutMinutes: 10, delaySeconds: 1 };
    queueMicrotask(() => {
      setTargetUrl(href);
      setSelectedTools([tool]);
      setActivePlan(plan);
    });
  }, [testingDraft, setTargetUrl, setSelectedTools]);
  const [consoleFilter, setConsoleFilter] = useState<'selected' | 'dast' | 'recon' | 'network' | 'secops' | 'all'>('selected');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const didInitWorkspace = useRef(false);
  const mainTab = workspaceTab;
  const setMainTab = setWorkspaceTab;

  useLayoutEffect(() => {
    if (didInitWorkspace.current) return;
    didInitWorkspace.current = true;
    if (workspaceTab !== 'config') return;
    if (status === 'RUNNING') {
      setWorkspaceTab('live');
    } else if (allFindings.length > 0) {
      setWorkspaceTab('findings');
    }
  }, [allFindings.length, setWorkspaceTab, status, workspaceTab]);

  const allToolsArray = allTools;
  const tabs = [
    'sqlmap', 'nikto', 'commix', 'sstimap', 'jwt_tool', 'interactsh',
    'findings', 'ai', 'nuclei', 'wapiti', 'wpscan', 'subfinder', 'pdiscovery', 
    'httpx', 'katana', 'dnsx', 'alterx', 'naabu', 'tlsx',
    'dalfox', 'wafw00f', 'whatweb', 'arjun', 'corsy', 'cmseek', 'gau', 'crlfsuite', 
    'nmap', 'zap', 'ffuf', 'gitleaks', 'semgrep', 'trivy', 'syft', 'sslyze', 'schemathesis',
    'appscan', 'netsparker', 'acunetix', 'posture'
  ];

  // Tool categories for console filtering
  const toolCategories = {
    dast: ['sqlmap', 'nikto', 'commix', 'sstimap', 'jwt_tool', 'interactsh', 'nuclei', 'wapiti', 'dalfox', 'corsy', 'cmseek', 'crlfsuite', 'zap', 'appscan', 'netsparker', 'acunetix', 'arjun'],
    recon: ['subfinder', 'httpx', 'katana', 'dnsx', 'alterx', 'tlsx', 'gau', 'whatweb', 'wafw00f', 'wpscan', 'pdiscovery', 'sslyze', 'arjun'],
    network: ['naabu', 'nmap', 'ffuf', 'arjun', 'schemathesis'],
    secops: ['gitleaks', 'semgrep', 'trivy', 'syft']
  };

  // Scan output and stats listeners
  useEffect(() => {
    if (!scanId || !window.api) return;

    const handleOutput = (_event: unknown, data: { scanId: string; scanner: string; type: string; message: string }) => {
      if (data.scanId !== scanId) return;
      useLogStore.getState().appendRawLogs(`[${data.scanner.toUpperCase()}] ${data.message}\n`);
      useLogStore.getState().appendScannerLog(data.scanner, data.message);
    };

    const handleStats = (_event: unknown, data: { scanId: string; stats: { nuclei: Record<string, number>, wapiti: { vulns: number, pages: number } } }) => {
      if (data.scanId !== scanId) return;
      const nStats = data.stats.nuclei || {};
      useScanStore.getState().setNucleiFindings({
        info: nStats.info || 0,
        low: nStats.low || 0,
        medium: nStats.medium || 0,
        high: nStats.high || 0,
        critical: nStats.critical || 0,
      });
      useScanStore.getState().setWapitiVulns(data.stats.wapiti.vulns);
      useScanStore.getState().setWapitiPages(data.stats.wapiti.pages);
    };

    const removeOutputListener = window.api.onScanOutput(handleOutput);
    const removeStatsListener = window.api.onScanStats(handleStats);
    const removeAiProgress = window.api.onAiProgress((_e, msg) => useLogStore.getState().setAiProgressMsg(msg));
    const removeEndpointsListener = window.api.onScanEndpointsDiscovered?.((_e, data) => {
      if (data.scanId !== scanId) return;
      if (data.endpoints && data.endpoints.length > 0) {
        setDiscoveredEndpoints(prev => {
          const existing = new Set(prev.map(p => p.url));
          const added = data.endpoints.filter(p => !existing.has(p.url));
          return [...prev, ...added];
        });
        if (autoCascadeEnabled) {
          const chosen = data.endpoints[0];
          if (chosen && chosen.parameters.length > 0) {
            const activeList = ['sqlmap', 'commix', 'sstimap', 'jwt_tool', 'nikto'];
            if (selectedTools.some(t => activeList.includes(t))) {
              setActivePlan(prev => ({
                ...prev,
                parameters: [...new Set([...prev.parameters, ...chosen.parameters])],
                scopeOrigin: new URL(chosen.url).origin
              }));
            }
          }
        }
      }
      if (data.jwtTokens && data.jwtTokens.length > 0) {
        setDiscoveredJwt(data.jwtTokens[0]);
      }
    });

    return () => {
      removeOutputListener();
      removeStatsListener();
      removeAiProgress();
      removeEndpointsListener?.();
    };
  }, [scanId, autoCascadeEnabled, selectedTools]);

  // Scan status listener
  useEffect(() => {
    if (!scanId || !window.api) return;

    const handleStatus = (_event: unknown, data: { scanId: string; scanner: string; status: string; reason?: string }) => {
      if (data.scanId !== scanId && data.scanId !== useScanStore.getState().scanId) return;
      const scanner = data.scanner as ScannerType;
      if (data.reason) useScanStore.getState().setScannerReason(data.scanner, data.reason);

      useScanStore.getState().setScannerStatus(prev => {
        const next = { ...prev, [scanner]: data.status as ScannerStatus };
        // Aggregate pdiscovery status
        const pdTools = ['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'];
        if (pdTools.includes(scanner)) {
          const pdStatuses = pdTools.map(t => next[t as ScannerType] || 'IDLE');
          if (pdStatuses.some(s => s === 'FAILED')) next.pdiscovery = 'FAILED';
          else if (pdStatuses.some(s => s === 'RUNNING' || s === 'QUEUED')) next.pdiscovery = 'RUNNING';
          else if (pdStatuses.every(s => ['COMPLETED', 'IDLE'].includes(s))) next.pdiscovery = 'COMPLETED';
          else if (pdStatuses.every(s => ['COMPLETED', 'IDLE', 'STOPPED', 'SKIPPED', 'DEGRADED', 'PARTIAL'].includes(s))) next.pdiscovery = 'PARTIAL';
        }
        
        // Check if all requested tools are done. Posture is supplemental and must
        // not override the aggregate state derived from explicitly selected engines.
        const terminal = ['COMPLETED', 'DEGRADED', 'PARTIAL', 'SKIPPED', 'FAILED', 'STOPPED', 'IDLE'];
        const trackedStatuses = Object.entries(next)
          .filter(([engine]) => engine !== 'posture')
          .map(([, engineStatus]) => engineStatus as string);
        const allDone = trackedStatuses.every(s => terminal.includes(s));
        const anyFailed = trackedStatuses.some(s => s === 'FAILED');
        const anyPartial = trackedStatuses.some(s => ['DEGRADED', 'PARTIAL', 'SKIPPED'].includes(s));

        const currentStatus = useScanStore.getState().status;
        if (allDone && !['IDLE', 'STOPPING', 'STOPPED'].includes(currentStatus)) {
          useScanStore.getState().setStatus(anyFailed ? 'FAILED' : anyPartial ? 'PARTIAL' : 'COMPLETED');
        }

        return next;
      });
    };

    const handleFindings = (_event: unknown, data: { scanId: string; scanner: string; findings: Vulnerability[] }) => {
      if (data.scanId !== scanId) return;
      useScanStore.getState().setAllFindings(prev => [...prev, ...data.findings]);
    };

    const removeStatusListener = window.api.onScanStatus(handleStatus);
    const removeFindingsListener = window.api.onScanFindings(handleFindings);

    return () => {
      removeStatusListener();
      removeFindingsListener();
    };
  }, [scanId]);

  // Rehydrate scan findings and state if restoring after reload / HMR
  useEffect(() => {
    if (!scanId || !window.api) return;
    window.api.getFindingsPaginated(scanId, { limit: 1000 }).then(res => {
      if (res && res.findings && res.findings.length > 0) {
        setAllFindings(res.findings);
      }
    }).catch(() => {});
    reloadSavedAnalyses(scanId).then((mapped) => {
      if (mapped[selectedPreset]?.analysisText && !useLogStore.getState().aiResponse) {
        useLogStore.getState().setAiResponse(mapped[selectedPreset].analysisText);
      } else if (!useLogStore.getState().aiResponse) {
        window.api.getLatestAiAnalysis(scanId).then((analysis) => {
          if (analysis && typeof analysis.analysisText === 'string') {
            useLogStore.getState().setAiResponse(analysis.analysisText);
          }
        }).catch(() => {});
      }
    }).catch(() => {});
    // A short-lived tool may finish before the scan-id-dependent IPC listeners mount.
    window.api.getHistory().then((history: Array<Record<string, unknown>>) => {
      if (useScanStore.getState().scanId !== scanId) return;
      const scan = history.find(item => item.scanId === scanId);
      if (!scan) return;
      applyPersistedEngineStatuses(scan);
      const terminal = [...ENGINE_TERMINAL_STATUSES, 'CANCELLED'];
      if (terminal.includes(String(scan.status)) && !['STOPPED','STOPPING'].includes(useScanStore.getState().status)) useScanStore.getState().setStatus(String(scan.status));
    }).catch(() => {});
  }, [scanId, setAllFindings, reloadSavedAnalyses, selectedPreset]);

  // Updater listeners
  useEffect(() => {
    if (!window.api) return;

    const handleUpdateOutput = (_event: unknown, msg: string) => {
      useConfigStore.getState().setUpdateLogs(prev => [...prev, msg]);
    };

    const handleUpdateStatus = (_event: unknown, newStatus: string) => {
      if (newStatus === 'DONE' || newStatus === 'ERROR') {
        useConfigStore.getState().setIsUpdating(false);
      }
    };

    const removeOutput = window.api.onUpdateOutput(handleUpdateOutput);
    const removeStatus = window.api.onUpdateStatus(handleUpdateStatus);

    return () => {
      removeOutput();
      removeStatus();
    };
  }, []);

  // Dependency checkers
  useEffect(() => {
    if (!window.api) return;
    
    // Initial check
    window.api.checkDependencies().then(deps => {
      useConfigStore.getState().setDependencies(deps);
      const missing = deps.filter(d => !d.isInstalled);
      if (missing.length > 0) {
        useConfigStore.getState().setShowDependencyModal(true);
      }
    });

    // Listen to progress
    const removeInstallProgress = window.api.onInstallProgress((_e, msg) => {
      useConfigStore.getState().setDependencyLogs(prev => [...prev, msg]);
    });

    return () => {
      removeInstallProgress();
    };
  }, []);

  const handleInstallDependencies = async () => {
    setIsInstallingDependencies(true);
    setDependencyLogs([]);
    try {
      await window.api.installDependencies();
      // Re-check
      const deps = await window.api.checkDependencies();
      setDependencies(deps);
      setTimeout(() => {
        setIsInstallingDependencies(false);
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDependencyLogs(prev => [...prev, `Error: ${errorMessage}`]);
      setIsInstallingDependencies(false);
    }
  };

  const validateUrl = (url: string) => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      if (/['";&|$<>]/.test(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  };

  const handleStartScan = async () => {
    if (['STARTING', 'RUNNING', 'STOPPING'].includes(useScanStore.getState().status)) return;
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
      setTargetUrl(finalUrl);
    }

    if (!validateUrl(finalUrl)) {
      toast.error('Please enter a valid URL.');
      return;
    }

    // Auto-filter tools incompatible with web URL targets
    const isWeb = /^https?:\/\//i.test(finalUrl);
    const sourceOnlyTools = ['gitleaks', 'semgrep', 'trivy', 'syft'];
    let toolsToRun = [...selectedTools];

    if (isWeb) {
      const incompatible = toolsToRun.filter(t => sourceOnlyTools.includes(t));
      if (incompatible.length > 0) {
        toolsToRun = toolsToRun.filter(t => !sourceOnlyTools.includes(t));
        setSelectedTools(toolsToRun);
        appendRawLogs(`[AUTO-FIX] Target is a web URL (${finalUrl}). Automatically excluded ${incompatible.length} source-code/container tools (${incompatible.join(', ')}). Proceeding with ${toolsToRun.length} web assessment engines.\n\n`);
      }
    }

    if (toolsToRun.length === 0) {
      toast.error('No compatible scanner selected for web target. Please select web assessment tools (e.g. Nuclei, Wapiti, ZAP).');
      return;
    }

    // Parse target origin & query parameters for active validation plans
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(finalUrl);
    } catch {
      toast.error('Please enter a valid URL.');
      return;
    }
    const targetOrigin = parsedUrl.origin;
    const targetParams: string[] = [];
    parsedUrl.searchParams.forEach((_, key) => {
      if (!targetParams.includes(key)) targetParams.push(key);
    });

    const paramTestingTools = ['sqlmap', 'commix', 'sstimap'];
    const selectedParamTools = toolsToRun.filter(t => paramTestingTools.includes(t));
    const effectiveParameters = activePlan.parameters.length > 0 ? activePlan.parameters : targetParams;
    const discoveryTools = ['katana', 'gau', 'ffuf', 'arjun', 'wapiti', 'nuclei'];
    const hasDiscoveryTools = toolsToRun.some(t => discoveryTools.includes(t));

    if (selectedParamTools.length > 0 && effectiveParameters.length === 0 && !hasDiscoveryTools && !autoCascadeEnabled) {
      toast.warning(
        `Target URL does not contain any query parameters (e.g. ?id=1). The selected parameter validation engine(s) (${selectedParamTools.join(', ')}) require a target URL with query parameters.\n\nPlease add query parameters to your target URL or uncheck these tools.`,
        'Parameter engines need a query string',
      );
      return;
    }

    const rawScope = activePlan.scopeOrigin.trim();
    let validatedScopeOrigin = targetOrigin;
    if (rawScope) {
      try {
        const parsedScope = new URL(rawScope);
        if (parsedScope.origin === targetOrigin) {
          validatedScopeOrigin = targetOrigin;
        }
      } catch {
        validatedScopeOrigin = targetOrigin;
      }
    }

    const effectiveActivePlan: ActivePlan = {
      ...activePlan,
      scopeOrigin: validatedScopeOrigin,
      parameters: effectiveParameters,
    };

    // Reset findings
    setNucleiFindings({ info: 0, low: 0, medium: 0, high: 0, critical: 0 });
    setWapitiVulns(0);
    setWapitiPages(0);
    setAllFindings([]);
    setDiscoveredEndpoints([]);
    setDiscoveredJwt(null);
    setScanStartTime(Date.now());
    setElapsedSeconds(0);
    setSeverityFilter('all');
    clearRawLogs();
    appendRawLogs(`Scan started against ${finalUrl} at ${new Date().toISOString()}\n\n`);

    setStatus('STARTING');
    setMainTab('live');
    if (['findings', 'ai'].includes(activeTab)) {
      setActiveTab((toolsToRun[0] as ScannerType) || 'subfinder');
    }
    const initialStatus: Record<ScannerType, ScannerStatus> = { ...initialScannerStatus };
    
    toolsToRun.forEach((tool, idx) => {
      // In pipeline mode, first tool begins RUNNING, remaining are queued
      initialStatus[tool as ScannerType] = (executionMode === 'pipeline' && idx > 0) ? 'QUEUED' : 'RUNNING';
      if (['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'].includes(tool)) {
        initialStatus.pdiscovery = 'RUNNING';
      }
    });
    
    setScannerStatus(initialStatus);

    try {
      const res = await window.api.startScan(finalUrl, {
        tools: toolsToRun,
        isWordpress: isWordpressScan,
        executionMode: executionMode,
        activeValidation: effectiveActivePlan,
        autoCascade: autoCascadeEnabled,
        ...(testingDraft ? {workflow:testingDraft.workflow} : {}),
      });
      if (res.success) {
        const activeId = res.scanId || null;
        setScanId(activeId);
        setStatus('RUNNING');
        if (activeId) {
          window.api.getHistory().then((history: Array<Record<string, unknown>>) => {
            if (useScanStore.getState().scanId !== activeId) return;
            const scan = history.find(item => item.scanId === activeId);
            if (!scan) return;
            applyPersistedEngineStatuses(scan);
          }).catch(() => {});
        }
      } else {
        toast.error(res.error ? `Failed to start scan: ${res.error}` : 'Failed to start scan.');
        setStatus('FAILED');
        setScannerStatus(initialScannerStatus);
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error(`Scan could not be started: ${errorMessage}`, 'Scan start failed');
      setStatus('FAILED');
    }
  };

  // Timer effect for live telemetry
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (status === 'RUNNING') {
      interval = setInterval(() => {
        if (scanStartTime) {
          setElapsedSeconds(Math.floor((Date.now() - scanStartTime) / 1000));
        } else {
          setElapsedSeconds(prev => prev + 1);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, scanStartTime]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const pipelineTelemetry = useMemo(() => {
    const reconTools = ['subfinder', 'gau', 'dnsx', 'httpx', 'katana', 'alterx', 'tlsx', 'whatweb', 'wafw00f', 'sslyze'];
    const networkTools = ['naabu', 'nmap'];
    const dastTools = ['sqlmap', 'nikto', 'commix', 'nuclei', 'wapiti', 'dalfox', 'corsy', 'cmseek', 'crlfsuite', 'zap'];
    const apiTools = ['ffuf', 'arjun', 'schemathesis', 'gitleaks', 'semgrep', 'trivy'];

    const getPhaseState = (toolList: string[]) => {
      const activeInPhase = toolList.filter(t => selectedTools.includes(t));
      if (activeInPhase.length === 0) return 'DISABLED';
      if (activeInPhase.some(t => ['RUNNING', 'QUEUED'].includes(scannerStatus[t as ScannerType]))) return 'RUNNING';
      if (activeInPhase.every(t => ['COMPLETED', 'DEGRADED', 'PARTIAL', 'SKIPPED', 'STOPPED', 'FAILED'].includes(scannerStatus[t as ScannerType]))) return 'COMPLETED';
      return 'PENDING';
    };

    const runningTools = selectedTools.filter(t => scannerStatus[t as ScannerType] === 'RUNNING');
    const completedTools = selectedTools.filter(t => scannerStatus[t as ScannerType] === 'COMPLETED');
    const failedTools = selectedTools.filter(t => scannerStatus[t as ScannerType] === 'FAILED');

    return {
      phases: [
        { id: 'p1', name: 'Recon & Surface', state: getPhaseState(reconTools) },
        { id: 'p2', name: 'Port & Network', state: getPhaseState(networkTools) },
        { id: 'p3', name: 'DAST & Probing', state: getPhaseState(dastTools) },
        { id: 'p4', name: 'API & Supply Chain', state: getPhaseState(apiTools) },
      ],
      runningCount: runningTools.length,
      completedCount: completedTools.length,
      failedCount: failedTools.length,
      runningTools
    };
  }, [selectedTools, scannerStatus]);

  const handleStopScan = async () => {
    if (!scanId) return;
    setStatus('STOPPING');
    const res = await window.api.stopScan(scanId);
    if (res.success) {
      setStatus('STOPPED');
      setScannerStatus(prev => {
        const next = { ...prev };
        for (const k in next) if (['RUNNING', 'QUEUED'].includes(next[k as ScannerType])) next[k as ScannerType] = 'STOPPED';
        return next;
      });
    }
  };

  const handleOpenFolder = () => {
    if (scanId) {
      window.api.openReportFolder(scanId);
    }
  };

  const handleCopyLogsForAI = () => {
    const logs = useLogStore.getState().rawLogs;
    if (!logs) {
      toast.info('No logs available yet. Start a scan to capture terminal output.');
      return;
    }
    const contextText = `# SecOps Recon Scan Logs\n\nTarget: ${targetUrl}\nStatus: ${status}\n\n## Terminal Output\n\`\`\`\n${logs}\n\`\`\`\n`;
    navigator.clipboard.writeText(contextText);
    toast.success('Full scan logs copied. You can paste them into your AI agent.');
  };

  const handleCopyAiReport = () => {
    if (!aiResponse) return;
    navigator.clipboard.writeText(aiResponse);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleSelectPreset = (preset: 'executive' | 'attack_path' | 'remediation' | 'verification') => {
    setSelectedPreset(preset);
    if (savedAnalyses[preset]?.analysisText) {
      setAiResponse(savedAnalyses[preset].analysisText);
    } else {
      setAiResponse('');
    }
  };

  const handleAnalyzeAI = async (presetOverride?: 'executive' | 'attack_path' | 'remediation' | 'verification') => {
    const preset = presetOverride || selectedPreset;
    if (presetOverride) setSelectedPreset(presetOverride);
    setActiveTab('ai');
    setMainTab('ai');
    setIsAnalyzing(true);
    setAiResponse('');
    setAiProgressMsg(`Synthesizing scan intelligence (${preset.toUpperCase()})...`);

    try {
      if (window.api?.analyzeScan && scanId) {
        const response = await window.api.analyzeScan(scanId, preset);
        setAiResponse(response);
        await reloadSavedAnalyses(scanId);
      } else {
        const logs = useLogStore.getState().rawLogs;
        const prompt = `You are a Principal Cyber Security Analyst. Analyze these scan logs for ${targetUrl}. Summarize the vulnerabilities, prioritize top critical risks, and suggest concrete remediation steps.`;
        const response = await window.api.analyzeLogs(logs || 'No logs', prompt);
        setAiResponse(response);
      }
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Is Ollama running?') || msg.includes('ECONNREFUSED')) {
        msg = `Could not connect to Ollama. Please ensure Ollama is running locally, or configure an alternative AI Provider in Settings.\n\nTechnical details: ${(err as Error).message}`;
      } else {
        msg = `Error during AI Analysis:\n\n${(err as Error).message}\n\nPlease check your configuration in Settings.`;
      }
      setAiResponse(`[ERROR]\n${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendCopilot = async (overrideMessage?: string) => {
    const query = (overrideMessage || copilotInput).trim();
    if (!query || isCopilotThinking) return;

    const newHistory = [...copilotMessages, { role: 'user' as const, content: query }];
    setCopilotMessages(newHistory);
    setCopilotInput('');
    setIsCopilotThinking(true);

    try {
      if (window.api?.chatCopilot && scanId) {
        const reply = await window.api.chatCopilot(scanId, copilotMessages, query);
        setCopilotMessages([...newHistory, { role: 'assistant', content: reply }]);
      } else {
        setCopilotMessages([...newHistory, { role: 'assistant', content: 'Scan context is unavailable. Start a scan or select a completed scan to chat with Copilot.' }]);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setCopilotMessages([...newHistory, { role: 'assistant', content: `[Copilot Error]: ${errorMsg}` }]);
    } finally {
      setIsCopilotThinking(false);
    }
  };


  const handleUpdateTools = async () => {
    if (onOpenToolsHub) {
      onOpenToolsHub();
      return;
    }
    setIsUpdating(true);
    setUpdateLogs([]);
    setShowUpdateModal(true);
    try {
      await window.api.updateTools();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setUpdateLogs(prev => [...prev, `Error: ${errorMessage}`]);
      setIsUpdating(false);
    }
  };

  // Determine consoles to show in the switcher bar
  const consoleTools = tabs.filter(t => t !== 'findings' && t !== 'ai').filter(tool => {
    if (consoleFilter === 'selected') {
      return selectedTools.includes(tool)
        || scannerStatus[tool as ScannerType] === 'RUNNING'
        || (tool === 'posture' && scannerStatus.posture !== 'IDLE');
    }
    if (consoleFilter === 'dast') return toolCategories.dast.includes(tool);
    if (consoleFilter === 'recon') return toolCategories.recon.includes(tool);
    if (consoleFilter === 'network') return toolCategories.network.includes(tool);
    if (consoleFilter === 'secops') return toolCategories.secops.includes(tool);
    return true; // 'all'
  });

  return (
    <div className="flex flex-col h-full space-y-2 overflow-hidden">
      {/* Header Controls */}
      <ScannerControls
        targetUrl={targetUrl} setTargetUrl={setTargetUrl}
        status={status} scanId={scanId}
        isWordpressScan={isWordpressScan} setIsWordpressScan={setIsWordpressScan}
        handleStartScan={handleStartScan} handleStopScan={handleStopScan}
        handleOpenFolder={handleOpenFolder} handleAnalyzeAI={handleAnalyzeAI}
        handleCopyLogsForAI={handleCopyLogsForAI} handleUpdateTools={handleUpdateTools}
        handleClearLiveView={() => {
          resetScanState();
          clearRawLogs();
          setScanStartTime(null);
          setElapsedSeconds(0);
          setSeverityFilter('all');
          setDiscoveredEndpoints([]);
          setDiscoveredJwt(null);
        }}
        onOpenExportReport={() => setShowExportModal(true)}
        isAnalyzing={isAnalyzing} isUpdating={isUpdating}
        dashboardView={dashboardView} setDashboardView={setDashboardView}
        executionMode={executionMode} setExecutionMode={setExecutionMode}
      />

      {/* Primary Cyber Command Workspace Tabs */}
      <div className="theme-card relative z-0 p-1.5 px-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm border border-[var(--border-card)] shrink-0">
        {/* Left: Phased Workspace Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Assessment workspace">
          <button
            type="button"
            role="tab"
            id="dashboard-tab-config"
            aria-selected={mainTab === 'config'}
            aria-controls="workspace-panel"
            onClick={() => setMainTab('config')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'config'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/30 font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-cyan-300" />
            <span>Target & Suite Setup</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-semibold">
              {selectedTools.length} Armed
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="dashboard-tab-live"
            aria-selected={mainTab === 'live'}
            aria-controls="workspace-panel"
            onClick={() => {
              setMainTab('live');
              if (['findings', 'ai'].includes(activeTab)) {
                setActiveTab((selectedTools[0] as ScannerType) || 'subfinder');
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'live'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30 font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-300" />
            <span>Live Console & Progress</span>
            {status === 'RUNNING' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            id="dashboard-tab-findings"
            aria-selected={mainTab === 'findings'}
            aria-controls="workspace-panel"
            onClick={() => {
              setMainTab('findings');
              setActiveTab('findings');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'findings'
                ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-md shadow-rose-900/30 font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
            <span>Findings & Vulns</span>
            {allFindings.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold shadow-sm tabular-nums">
                {allFindings.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            id="dashboard-tab-ai"
            aria-selected={mainTab === 'ai'}
            aria-controls="workspace-panel"
            onClick={() => {
              setMainTab('ai');
              setActiveTab('ai');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'ai'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/30 font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>AI Security Analyst</span>
          </button>
        </div>

        {/* Right: Quick actions & Focus toggle */}
        <div className="flex items-center gap-2">
          {mainTab === 'live' && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-0.5 rounded-lg border border-[var(--border-card)]">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider px-1.5 hidden sm:inline">Stream:</span>
              {(['selected', 'dast', 'recon', 'network', 'secops', 'all'] as const).map(filterKey => (
                <button
                  key={filterKey}
                  onClick={() => setConsoleFilter(filterKey)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    consoleFilter === filterKey
                      ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] font-bold border border-[var(--border-glow)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {filterKey === 'selected' ? 'Active' : filterKey === 'secops' ? 'Secrets/Code' : filterKey}
                </button>
              ))}
            </div>
          )}

          {mainTab === 'config' && (
            <button
              onClick={() => {
                setMainTab('live');
                if (['findings', 'ai'].includes(activeTab)) {
                  setActiveTab((selectedTools[0] as ScannerType) || 'subfinder');
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-[var(--text-primary)] border border-[var(--border-card)] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>View Live Console</span>
              <Terminal className="w-3 h-3 text-emerald-400" />
            </button>
          )}

          <button
            onClick={() => {
              const isFocus = dashboardView?.mode === 'focus';
              setDashboardView({
                mode: isFocus ? 'standard' : 'focus',
                showToolSelection: isFocus,
                showTelemetry: isFocus,
                showSummaryCards: isFocus,
              });
            }}
            title={dashboardView?.mode === 'focus' ? 'Kembali ke Tampilan Standar' : 'Fokus Hasil (Maksimalkan ruang kerja)'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
              dashboardView?.mode === 'focus'
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-sm'
                : 'bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:border-[var(--border-card)]'
            }`}
          >
            {dashboardView?.mode === 'focus' ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Normal</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Fokus</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace View Container */}
      {mainTab === 'config' ? (
        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-thin"
          role="tabpanel"
          id="workspace-panel"
          aria-labelledby={`dashboard-tab-${mainTab}`}
        >
          {testingDraft && (
            <div className="theme-card rounded-xl p-3 text-sm shrink-0 border border-[var(--border-card)]">
              <strong>{testingDraft.workflow.kind === 'retest' ? 'Linked retest' : 'Selected endpoint test'}</strong> · Source: {testingDraft.workflow.sourceScanId}
              <p className="text-xs mt-1">Review the URL and parameters, then use Start Scan. Fill sample values for newly discovered parameters. Nikto tests the whole origin.</p>
              <div className="flex gap-4 mt-2">
                <Link className="underline" to="/endpoints">View inventory and linked results</Link>
                <button disabled={['STARTING','RUNNING','STOPPING'].includes(status)} onClick={()=>setTestingDraft(null)} className="underline disabled:opacity-40">Detach draft</button>
              </div>
            </div>
          )}

          {selectedTools.some(tool => ['sqlmap', 'nikto', 'commix', 'sstimap', 'jwt_tool'].includes(tool)) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-orange-950/20 border border-orange-500/30 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${autoCascadeEnabled ? 'bg-orange-400 animate-pulse' : 'bg-zinc-500'}`} />
                  <span className="font-semibold text-orange-200">Dynamic Endpoint Cascading</span>
                  <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                    {autoCascadeEnabled
                      ? '⚡ Auto-chain aktif: URL & parameter crawler otomatis dialirkan ke active engine'
                      : 'Manual: Parameter hanya menggunakan konfigurasi statis'}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-orange-300 font-mono">
                  <input
                    type="checkbox"
                    checked={autoCascadeEnabled}
                    onChange={e => setAutoCascadeEnabled(e.target.checked)}
                    className="rounded border-orange-500/50 bg-black/40 text-orange-500 focus:ring-0"
                  />
                  Auto-Chain Live
                </label>
              </div>
              <ActiveTestingPanel
                target={targetUrl}
                tools={selectedTools}
                value={activePlan}
                onChange={setActivePlan}
                disabled={['STARTING', 'RUNNING', 'STOPPING'].includes(status)}
                discoveredEndpoints={discoveredEndpoints}
                onSelectEndpoint={(url, params) => {
                  try {
                    const parsed = new URL(url);
                    setTargetUrl(url);
                    setActivePlan(prev => ({
                      ...prev,
                      scopeOrigin: parsed.origin,
                      parameters: params
                    }));
                  } catch {
                    // keep URL
                  }
                }}
                discoveredJwt={discoveredJwt}
              />
            </div>
          )}

          {incompatibleTools.length > 0 && (
            <div className="theme-card p-2 px-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-300 shrink-0 animate-fade-in shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span>
                  Target adalah Web URL. Tool kode lokal / direktori <strong>({incompatibleTools.join(', ')})</strong> tidak dapat memindai website live dan otomatis dilewati saat pemindaian.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTools(prev => prev.filter(t => !incompatibleTools.includes(t)))}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-mono cursor-pointer shrink-0 ml-2 border border-amber-500/30 transition-all font-semibold"
              >
                Hapus Dari Pilihan
              </button>
            </div>
          )}

          <ToolSelection
            allTools={allToolsArray} selectedTools={selectedTools}
            setSelectedTools={setSelectedTools} status={status}
            targetUrl={targetUrl}
          />
        </div>
      ) : mainTab === 'live' ? (
        <div
          className="flex-1 flex flex-col min-h-0 space-y-2"
          role="tabpanel"
          id="workspace-panel"
          aria-labelledby={`dashboard-tab-${mainTab}`}
        >
          {/* Cyber Operations Telemetry HUD */}
          {dashboardView?.showTelemetry && (
            <div className="theme-card relative z-0 p-2 px-3.5 rounded-xl border border-[var(--border-card)] shadow-sm shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Left: Pipeline Phase Stepper */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1.5 mr-2 shrink-0">
                  <Radio className={`w-3.5 h-3.5 ${status === 'RUNNING' ? 'text-emerald-400 animate-pulse' : 'text-[var(--text-muted)]'}`} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Pipeline:
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {pipelineTelemetry.phases.map((phase, idx) => {
                    const isPhaseRunning = phase.state === 'RUNNING';
                    const isPhaseDone = phase.state === 'COMPLETED';
                    const isPhaseDisabled = phase.state === 'DISABLED';

                    return (
                      <div key={phase.id} className="flex items-center gap-1">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all border ${
                            isPhaseRunning
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)] font-bold'
                              : isPhaseDone
                                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--border-glow)]'
                                : isPhaseDisabled
                                  ? 'opacity-40 text-[var(--text-muted)] border-transparent'
                                  : 'text-[var(--text-muted)] border-[var(--border-card)] bg-black/20'
                          }`}
                        >
                          {isPhaseRunning ? (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          ) : isPhaseDone ? (
                            <CheckCircle2 className="w-3 h-3 text-[var(--accent-primary)]" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                          )}
                          <span>{phase.name}</span>
                        </div>
                        {idx < pipelineTelemetry.phases.length - 1 && (
                          <span className="text-[var(--text-muted)] text-[10px] opacity-40">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Telemetry Counter Chips */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-card)] text-[10px] font-mono">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-400 font-bold tabular-nums">{pipelineTelemetry.runningCount} Active</span>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="text-emerald-400 font-bold tabular-nums">{pipelineTelemetry.completedCount} Done</span>
                  {pipelineTelemetry.failedCount > 0 && (
                    <>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span className="text-rose-400 font-bold tabular-nums">{pipelineTelemetry.failedCount} Failed</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-card)] text-[10px] font-mono font-bold text-[var(--text-primary)]">
                  <Timer className={`w-3 h-3 ${status === 'RUNNING' ? 'text-amber-400 animate-spin' : 'text-[var(--text-muted)]'}`} />
                  <span className="tabular-nums">{formatDuration(elapsedSeconds)}</span>
                </div>

                {targetUrl && (
                  <div className="text-[10px] font-mono text-[var(--text-muted)] max-w-[180px] truncate hidden lg:inline" title={targetUrl}>
                    🎯 {targetUrl.replace(/^https?:\/\//, '')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-bar: Active Engine Console Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin px-0.5 shrink-0" role="tablist" aria-label="Active engine consoles">
            {consoleTools.map(tab => {
              const isActive = activeTab === tab;
              const scannerStat = scannerStatus[tab as ScannerType];
              const isRunning = scannerStat === 'RUNNING';
              const isFailed = scannerStat === 'FAILED';
              const isCompleted = scannerStat === 'COMPLETED';
              const isPartial = scannerStat === 'DEGRADED' || scannerStat === 'PARTIAL';
              const isSkipped = scannerStat === 'SKIPPED';

              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`console-tab-${tab}`}
                  aria-selected={isActive}
                  aria-controls="engine-console-panel"
                  onClick={() => setActiveTab(tab as ScannerType)}
                  title={scannerReasons[tab] || `${tab} engine console`}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] uppercase tracking-wider font-semibold transition-all flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--border-glow)] shadow-sm'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-card)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  {isRunning && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {isPartial && <AlertCircle className="w-3 h-3 text-amber-400" />}
                  {isFailed && <AlertCircle className="w-3 h-3 text-rose-400" />}
                  {isSkipped && <Terminal className="w-3 h-3 text-slate-400" />}
                  {!isRunning && !isCompleted && !isFailed && !isPartial && !isSkipped && <Terminal className="w-3 h-3 opacity-50" />}
                  <span>{tab}</span>
                </button>
              );
            })}
          </div>

          {/* Expansive Full-Height Terminal Pane */}
          <div
            className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-[var(--border-card)] bg-[var(--bg-card)] shadow-inner"
            role="tabpanel"
            id="engine-console-panel"
            aria-labelledby={`console-tab-${activeTab}`}
          >
            <ErrorBoundary key={activeTab} fallbackTitle={`${activeTab.toUpperCase()} Console Interrupted`}>
              <Suspense fallback={<ConsolePaneFallback />}>
                <TerminalPane
                  key={activeTab}
                  title={`${activeTab.toUpperCase()} Live Console`}
                  scanner={activeTab as ScannerType}
                  scanId={scanId}
                  status={scannerStatus[activeTab as ScannerType]}
                  isVisible={true}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      ) : mainTab === 'findings' ? (
        /* Findings Workspace View */
        <div
          className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-[var(--border-card)] bg-[var(--bg-card)] shadow-inner"
          role="tabpanel"
          id="workspace-panel"
          aria-labelledby={`dashboard-tab-${mainTab}`}
        >
          <div className="h-full w-full">
            <VulnerabilityTable 
              scanId={scanId} 
              refreshTrigger={allFindings.length} 
              onOpenExportReport={() => setShowExportModal(true)}
              externalSeverityFilter={severityFilter}
              onSeverityFilterChange={setSeverityFilter}
            />
          </div>
        </div>
      ) : (
        /* AI Security Analyst View */
        <div
          className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-[var(--border-card)] bg-[var(--bg-card)] shadow-inner"
          role="tabpanel"
          id="workspace-panel"
          aria-labelledby={`dashboard-tab-${mainTab}`}
        >
          <div className="h-full w-full p-6 overflow-y-auto space-y-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Hub Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-card)]">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                      AI Security Intelligence Suite
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Local LLM reasoning, threat path chaining, and guided technical remediation
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono px-3 py-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-card)] text-[var(--text-secondary)] flex items-center gap-1.5 shadow-inner">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                    <span>{activeAiModel}</span>
                    <span className="opacity-50">({activeAiProvider.toUpperCase()})</span>
                    <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      {activeAiBaseUrl.replace(/^https?:\/\//, '')}
                    </span>
                  </span>

                  {aiResponse && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAnalyzeAI(selectedPreset)}
                        disabled={isAnalyzing}
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-app)] hover:bg-purple-500/10 text-[var(--text-primary)] border border-[var(--border-card)] hover:border-purple-500/50 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                        title="Generate ulang analisa untuk preset ini"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        <span>Regenerate</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyAiReport}
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--accent-primary)]/10 text-[var(--text-primary)] border border-[var(--border-card)] hover:border-[var(--accent-primary)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        {copiedReport ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span>Copy Report</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Presets Selector Toolbar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: 'executive' as const, name: 'Executive Summary', icon: Shield, desc: 'Overall risk posture & impact' },
                  { id: 'attack_path' as const, name: 'Attack Paths', icon: Workflow, desc: 'Exploit chaining narrative' },
                  { id: 'remediation' as const, name: 'Remediation Playbook', icon: FileText, desc: 'Technical patches & headers' },
                  { id: 'verification' as const, name: 'Manual Verification', icon: CheckCircle2, desc: 'Safe PoC reproduction' }
                ].map(p => {
                  const Icon = p.icon;
                  const isSelected = selectedPreset === p.id;
                  const hasSaved = Boolean(savedAnalyses[p.id]?.analysisText);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p.id)}
                      disabled={isAnalyzing}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-50 relative overflow-hidden group ${
                        isSelected
                          ? 'bg-purple-600/15 border-purple-500/50 shadow-md shadow-purple-900/20'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-app)] border-[var(--border-card)] hover:border-[var(--border-glow)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-xs font-bold ${isSelected ? 'text-purple-300' : 'text-[var(--text-primary)]'}`}>
                            {p.name}
                          </span>
                        </div>
                        {hasSaved && (
                          <span className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Saved
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Analysis Output Section */}
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-surface)] rounded-2xl border border-purple-500/30 shadow-lg text-center space-y-3">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <Sparkles className="w-4 h-4 text-pink-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <span className="text-sm font-semibold text-purple-300 animate-pulse">{aiProgressMsg}</span>
                  <p className="text-xs text-[var(--text-muted)] max-w-md">
                    Local Ollama models run entirely on your hardware. If loading a 7B-9B model into VRAM for the first time, initial response may take 10-30 seconds.
                  </p>
                </div>
              ) : aiResponse ? (
                <div className="theme-card p-6 rounded-2xl border border-[var(--border-card)] shadow-lg">
                  {aiResponse.startsWith('[ERROR]') ? (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>AI Analysis Could Not Complete</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-rose-200/80">
                        {aiResponse.replace('[ERROR]\n', '')}
                      </pre>
                      <div className="pt-2 text-xs text-rose-300/80">
                        💡 Tip: Buka <strong className="text-white">Settings</strong> untuk memeriksa koneksi endpoint Ollama Anda (konfigurasi aktif: <code className="bg-black/30 px-1 py-0.5 rounded text-cyan-300 font-mono">{activeAiBaseUrl}</code>, model: <code className="bg-black/30 px-1 py-0.5 rounded text-purple-300 font-mono">{activeAiModel}</code>) dan klik &quot;Test Connection&quot;.
                      </div>
                    </div>
                  ) : (
                    <FormattedMarkdown content={aiResponse} />
                  )}
                </div>
              ) : (
                <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-surface)]/50 border border-dashed border-[var(--border-card)] space-y-3">
                  <Sparkles className="w-10 h-10 text-purple-400 mx-auto opacity-50" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">Ready for Security Intelligence Analysis</p>
                  <p className="text-xs text-[var(--text-muted)] max-w-lg mx-auto">
                    Synthesize scan findings into deep advisory intelligence for{' '}
                    <strong className="text-purple-400">
                      {selectedPreset === 'executive' ? 'Executive Summary' : selectedPreset === 'attack_path' ? 'Attack Paths' : selectedPreset === 'remediation' ? 'Remediation Playbook' : 'Manual Verification'}
                    </strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAnalyzeAI(selectedPreset)}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Generate {selectedPreset === 'executive' ? 'Executive Summary' : selectedPreset === 'attack_path' ? 'Attack Paths' : selectedPreset === 'remediation' ? 'Remediation Playbook' : 'Manual Verification'}
                    </span>
                  </button>
                </div>
              )}

              {/* Interactive Security Copilot Drawer */}
              <div className="theme-card rounded-2xl border border-[var(--border-card)] shadow-lg overflow-hidden">
                <div 
                  className="flex items-center justify-between p-4 bg-[var(--bg-surface)] border-b border-[var(--border-card)] cursor-pointer select-none"
                  onClick={() => setShowCopilotDrawer(!showCopilotDrawer)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--border-glow)]">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                        <span>Security Copilot Chat</span>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                          Live RAG Grounded
                        </span>
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Ask questions grounded directly in this target's findings, endpoints, and attack surface
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {copilotMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCopilotMessages([]); }}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        Clear Chat
                      </button>
                    )}
                    {showCopilotDrawer ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                </div>

                {showCopilotDrawer && (
                  <div className="p-4 space-y-4">
                    {/* Quick Suggestion Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] font-bold">Suggested:</span>
                      {[
                        '🧪 How do I safely verify the critical findings?',
                        '🔧 Write an Nginx/Apache configuration patch',
                        '📊 What is the business impact if an attacker exploits this?',
                        '🛡️ Recommend WAF and defensive header rules'
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendCopilot(chip)}
                          disabled={isCopilotThinking}
                          className="px-2.5 py-1 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--accent-primary)]/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)] hover:border-[var(--accent-primary)] text-[11px] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {/* Chat Messages Stream */}
                    <div className="space-y-3 max-h-96 overflow-y-auto p-2 scrollbar-thin">
                      {copilotMessages.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[var(--text-muted)]">
                          💬 No chat history yet. Ask a question or click a suggestion chip above.
                        </div>
                      ) : (
                        copilotMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {msg.role === 'assistant' && (
                              <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/30">
                                <Bot className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div
                              className={`p-3 rounded-2xl max-w-[85%] text-xs ${
                                msg.role === 'user'
                                  ? 'bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 text-[var(--text-primary)] rounded-tr-sm'
                                  : 'bg-[var(--bg-app)] border border-[var(--border-card)] text-[var(--text-secondary)] rounded-tl-sm'
                              }`}
                            >
                              {msg.role === 'assistant' ? (
                                <FormattedMarkdown content={msg.content} />
                              ) : (
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      {isCopilotThinking && (
                        <div className="flex gap-2.5 justify-start">
                          <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                            <Bot className="w-3.5 h-3.5 animate-pulse" />
                          </div>
                          <div className="p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-card)] text-xs text-purple-300 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Copilot is reasoning over scan findings...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Input Bar */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendCopilot();
                      }}
                      className="flex items-center gap-2 pt-2 border-t border-[var(--border-card)]"
                    >
                      <input
                        type="text"
                        value={copilotInput}
                        onChange={(e) => setCopilotInput(e.target.value)}
                        placeholder="Ask Copilot about vulnerability verification, exploit vectors, or patches..."
                        disabled={isCopilotThinking}
                        className="flex-1 bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-primary)] font-sans transition-all placeholder:[var(--text-muted)]"
                      />
                      <button
                        type="submit"
                        disabled={isCopilotThinking || !copilotInput.trim()}
                        className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[var(--accent-glow)]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Findings Summary Area */}
      <FindingsSummary 
        nucleiFindings={nucleiFindings} 
        wapitiVulns={wapitiVulns} 
        wapitiPages={wapitiPages} 
        allFindings={allFindings}
        scanStatus={status}
        selectedTools={selectedTools}
        scannerStatus={scannerStatus}
        scannerReasons={scannerReasons}
        activeSeverityFilter={severityFilter}
        compact={dashboardView?.mode === 'focus' || !dashboardView?.showSummaryCards}
        onFilterSeverity={(sev) => {
          setSeverityFilter(sev);
          setWorkspaceTab('findings');
          setActiveTab('findings');
        }}
      />

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        scanId={scanId}
        targetUrl={targetUrl}
      />

      {/* Update Tools Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        labelledBy="update-pipeline-title"
        panelClassName="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
            <div className="p-4 border-b border-[var(--border-card)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
              <h2 id="update-pipeline-title" className="text-sm font-bold text-[var(--text-primary)] flex items-center space-x-2">
                <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} aria-hidden="true" />
                <span>Security Tools Update Pipeline</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-card)]"
                aria-label="Close update pipeline dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div
              className="p-4 bg-[var(--bg-surface)]/80 flex-1 overflow-y-auto font-mono text-xs space-y-1 scrollbar-thin"
              role="log"
              aria-live="polite"
              aria-label="Security tools update output"
            >
              {updateLogs.length === 0 && <div className="text-[var(--text-muted)]">Initializing update orchestration...</div>}
              {updateLogs.map((log, idx) => (
               <div key={idx} className="text-[var(--text-secondary)] break-words leading-relaxed">{log}</div>
              ))}
            </div>

            <div className="p-4 border-t border-[var(--border-card)] bg-[var(--bg-surface)] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="px-5 py-2 bg-[var(--bg-card)] hover:bg-[var(--border-card)] text-[var(--text-primary)] border border-[var(--border-card)] text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                {isUpdating ? 'Background Task' : 'Close'}
              </button>
            </div>
      </Modal>

      {/* Dependency Tools Modal - Streamlined High-Density View */}
      <Modal
        isOpen={showDependencyModal}
        onClose={() => {
          if (!isInstallingDependencies) setShowDependencyModal(false);
        }}
        labelledBy="dependency-modal-title"
        describedBy="dependency-modal-description"
        closeOnBackdrop={!isInstallingDependencies}
        panelClassName="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
      >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[var(--border-card)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg border ${depStats.missingAuto > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="dependency-modal-title" className="text-sm font-bold text-[var(--text-primary)]">Security Engine Dependencies</h2>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                      depStats.missingAuto === 0 && depStats.missing === 0
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : depStats.missingAuto > 0
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    }`}>
                      {depStats.installed}/{depStats.total} Ready ({depStats.percent}%)
                    </span>
                  </div>
                  <p id="dependency-modal-description" className="text-[11px] text-[var(--text-muted)]">
                    Audit kesiapan tool scanner keamanan & auto-installer engine
                  </p>
                </div>
              </div>

              {!isInstallingDependencies && (
                <button
                  type="button"
                  onClick={() => setShowDependencyModal(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-card)]"
                  title="Tutup dialog"
                  aria-label="Close dependency dialog"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Progress Bar & Filter Toolbar */}
            <div className="px-5 py-2.5 bg-[var(--bg-surface)]/60 border-b border-[var(--border-card)]/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-card)]/80 text-xs">
                <button
                  type="button"
                  onClick={() => setDepFilter('all')}
                  aria-pressed={depFilter === 'all'}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                    depFilter === 'all'
                      ? 'bg-[var(--accent-primary)] text-white shadow-xs font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }`}
                >
                  <span>Semua</span>
                  <span className="text-[10px] font-mono opacity-80">({depStats.total})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDepFilter('missing')}
                  aria-pressed={depFilter === 'missing'}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                    depFilter === 'missing'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }`}
                >
                  <span>Perlu Aksi</span>
                  <span className={`text-[10px] font-mono px-1 rounded-full ${depStats.missing > 0 ? 'bg-amber-500/20 text-amber-300' : 'opacity-80'}`}>
                    ({depStats.missing})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDepFilter('installed')}
                  aria-pressed={depFilter === 'installed'}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                    depFilter === 'installed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }`}
                >
                  <span>Ready</span>
                  <span className="text-[10px] font-mono opacity-80">({depStats.installed})</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={depSearch}
                  onChange={(e) => setDepSearch(e.target.value)}
                  placeholder="Cari engine..."
                  aria-label="Search security engines"
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl pl-8 pr-7 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-[var(--accent-primary)] transition-colors"
                />
                {depSearch && (
                  <button
                    type="button"
                    onClick={() => setDepSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                    aria-label="Clear engine search"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Streamlined Dependencies Grid Body */}
            <div className="p-4 bg-[var(--bg-surface)]/40 flex-1 overflow-y-auto space-y-3 min-h-[220px]">
              {filteredDependencies.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center space-y-2">
                  <AlertCircle className="w-7 h-7 text-[var(--text-muted)]/50" />
                  <span>Tidak ada security engine yang cocok dengan filter</span>
                  {depSearch && (
                    <button
                      onClick={() => { setDepSearch(''); setDepFilter('all'); }}
                      className="text-[var(--accent-primary)] hover:underline text-[11px]"
                    >
                      Reset pencarian
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {filteredDependencies.map((dep, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)]/80 border border-[var(--border-card)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-card)] transition-all flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            dep.isInstalled
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                              : dep.requiresManual
                              ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]'
                              : 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.7)]'
                          }`}
                        />
                        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                          {dep.name}
                        </span>
                      </div>

                      {dep.isInstalled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Ready</span>
                        </span>
                      ) : dep.requiresManual ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/25 shrink-0" title="Manual install / Docker engine required">
                          <Wrench className="w-2.5 h-2.5" />
                          <span>Manual</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0" title="Bisa di-install otomatis via Go/Pip">
                          <Download className="w-2.5 h-2.5" />
                          <span>Auto</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Streaming Logs Box (Compact Cyber Terminal) */}
              {dependencyLogs.length > 0 && (
                <div
                  className="mt-3 p-3 bg-black/60 rounded-xl border border-[var(--border-card)] font-mono text-[11px] text-[var(--text-muted)] space-y-1 max-h-36 overflow-y-auto"
                  role="log"
                  aria-live="polite"
                  aria-label="Dependency installer output"
                >
                  <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400/90 pb-1 border-b border-white/10 flex items-center justify-between">
                    <span>Installer Execution Logs</span>
                    {isInstallingDependencies && <span className="animate-pulse text-amber-400">● Streaming...</span>}
                  </div>
                  {dependencyLogs.map((log, i) => (
                    <div key={i} className="leading-snug break-all">{log}</div>
                  ))}
                  <div ref={depLogsEndRef} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-[var(--border-card)] bg-[var(--bg-surface)] flex items-center justify-between gap-3 shrink-0">
              <div>
                {onOpenToolsHub ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDependencyModal(false);
                      onOpenToolsHub();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Buka Tools Hub Lengkap</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    {depStats.missingAuto} auto-installable / {depStats.missingManual} manual
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDependencyModal(false)}
                  disabled={isInstallingDependencies}
                  className="px-4 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--border-card)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl border border-[var(--border-card)] transition-all disabled:opacity-50"
                >
                  {isInstallingDependencies ? 'Jalankan di Background' : 'Tutup'}
                </button>
                <button
                  type="button"
                  onClick={handleInstallDependencies}
                  disabled={isInstallingDependencies || depStats.missingAuto === 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center space-x-2"
                >
                  {isInstallingDependencies ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      <span>Menginstall Engine...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {depStats.missingAuto > 0
                          ? `Install ${depStats.missingAuto} Engine Otomatis`
                          : 'Semua Engine Otomatis Siap'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
      </Modal>
    </div>
  );
}
