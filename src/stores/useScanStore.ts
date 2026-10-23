import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vulnerability } from '../types/vulnerability';
import type { TestingDraft } from '../types/workflow';

export type ScannerType = 
  | 'sqlmap' | 'nikto' | 'commix' | 'sstimap' | 'jwt_tool' | 'interactsh'
  | 'nuclei' | 'wapiti' | 'subfinder' | 'httpx' | 'nmap' | 'zap' | 'katana' | 'ffuf' 
  | 'alterx' | 'dnsx' | 'naabu' | 'tlsx' | 'appscan' | 'netsparker' | 'acunetix' 
  | 'pdiscovery' | 'wpscan' | 'dalfox' | 'wafw00f' | 'whatweb' | 'arjun' | 'corsy' 
  | 'cmseek' | 'gau' | 'crlfsuite' | 'gitleaks' | 'semgrep' | 'trivy' | 'syft' | 'sslyze' | 'schemathesis'
  | 'posture';
export type ScannerStatus =
  | 'IDLE' | 'RUNNING' | 'QUEUED'
  | 'COMPLETED' | 'DEGRADED' | 'PARTIAL'
  | 'SKIPPED' | 'FAILED' | 'STOPPED';
export type ExecutionMode = 'pipeline' | 'concurrent';
export type WorkspaceTab = 'config' | 'live' | 'findings' | 'ai';

interface FindingsCount {
  info: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export const allTools = [
  'sqlmap', 'nikto', 'commix', 'sstimap', 'jwt_tool', 'interactsh',
  'nuclei', 'wapiti', 'wpscan', 'subfinder', 'alterx', 'dnsx', 'naabu', 'tlsx', 
  'httpx', 'nmap', 'zap', 'katana', 'ffuf', 'dalfox', 'wafw00f', 'whatweb', 
  'arjun', 'corsy', 'cmseek', 'gau', 'crlfsuite', 'gitleaks', 'semgrep', 'trivy', 'syft',
  'sslyze', 'schemathesis', 'appscan', 'netsparker', 'acunetix'
];
export const defaultSelectedTools = ['httpx', 'nuclei'];

export interface DashboardViewSettings {
  mode: 'focus' | 'standard' | 'full';
  showToolSelection: boolean;
  showTelemetry: boolean;
  showSummaryCards: boolean;
}

export const defaultDashboardView: DashboardViewSettings = {
  mode: 'standard',
  showToolSelection: true,
  showTelemetry: true,
  showSummaryCards: true,
};

interface ScanState {
  testingDraft: TestingDraft | null;
  setTestingDraft: (draft: TestingDraft | null) => void;
  targetUrl: string;
  scanId: string | null;
  activeTab: ScannerType | 'findings' | 'ai';
  workspaceTab: WorkspaceTab;
  isWordpressScan: boolean;
  selectedTools: string[];
  status: string;
  executionMode: ExecutionMode;
  scannerStatus: Record<ScannerType, ScannerStatus>;
  scannerReasons: Record<string, string>;
  allFindings: Vulnerability[];
  nucleiFindings: FindingsCount;
  wapitiVulns: number;
  wapitiPages: number;
  dashboardView: DashboardViewSettings;

  // Actions
  setTargetUrl: (url: string) => void;
  setScanId: (id: string | null) => void;
  setActiveTab: (tab: ScannerType | 'findings' | 'ai') => void;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  setIsWordpressScan: (isWp: boolean) => void;
  setSelectedTools: (tools: string[] | ((prev: string[]) => string[])) => void;
  setStatus: (status: string) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setScannerStatus: (status: Record<ScannerType, ScannerStatus> | ((prev: Record<ScannerType, ScannerStatus>) => Record<ScannerType, ScannerStatus>)) => void;
  setScannerReason: (scanner: string, reason: string | undefined) => void;
  setAllFindings: (findings: Vulnerability[] | ((prev: Vulnerability[]) => Vulnerability[])) => void;
  setNucleiFindings: (count: FindingsCount) => void;
  setWapitiVulns: (count: number) => void;
  setWapitiPages: (count: number) => void;
  setDashboardView: (updater: Partial<DashboardViewSettings> | ((prev: DashboardViewSettings) => DashboardViewSettings)) => void;
  resetScanState: () => void;
}

export const initialScannerStatus: Record<ScannerType, ScannerStatus> = {
  sqlmap: 'IDLE',
  nikto: 'IDLE',
  commix: 'IDLE',
  sstimap: 'IDLE',
  jwt_tool: 'IDLE',
  interactsh: 'IDLE',
  nuclei: 'IDLE',
  wapiti: 'IDLE',
  subfinder: 'IDLE',
  alterx: 'IDLE',
  dnsx: 'IDLE',
  naabu: 'IDLE',
  tlsx: 'IDLE',
  httpx: 'IDLE',
  nmap: 'IDLE',
  zap: 'IDLE',
  katana: 'IDLE',
  ffuf: 'IDLE',
  dalfox: 'IDLE',
  wafw00f: 'IDLE',
  whatweb: 'IDLE',
  arjun: 'IDLE',
  corsy: 'IDLE',
  cmseek: 'IDLE',
  gau: 'IDLE',
  crlfsuite: 'IDLE',
  appscan: 'IDLE',
  netsparker: 'IDLE',
  acunetix: 'IDLE',
  wpscan: 'IDLE',
  pdiscovery: 'IDLE',
  gitleaks: 'IDLE',
  semgrep: 'IDLE',
  trivy: 'IDLE',
  syft: 'IDLE',
  sslyze: 'IDLE',
  schemathesis: 'IDLE',
  posture: 'IDLE',
};

export const useScanStore = create<ScanState>()(
  persist(
    (set) => ({
      testingDraft: null,
      setTestingDraft: draft => set({testingDraft:draft}),
      targetUrl: '',
      scanId: null,
      activeTab: 'nuclei',
      workspaceTab: 'config',
      isWordpressScan: false,
      selectedTools: defaultSelectedTools,
      status: 'IDLE',
      executionMode: 'pipeline',
      scannerStatus: initialScannerStatus,
      scannerReasons: {},
      allFindings: [],
      nucleiFindings: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
      wapitiVulns: 0,
      wapitiPages: 0,
      dashboardView: defaultDashboardView,

      setTargetUrl: (url) => set({ targetUrl: url }),
      setScanId: (id) => set({ scanId: id }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
      setIsWordpressScan: (isWp) => set({ isWordpressScan: isWp }),
      setSelectedTools: (updater) => set((state) => ({
        selectedTools: typeof updater === 'function' ? updater(state.selectedTools) : updater
      })),
      setStatus: (status) => set({ status }),
      setExecutionMode: (mode) => set({ executionMode: mode }),
      setScannerStatus: (updater) => set((state) => ({
        scannerStatus: typeof updater === 'function' ? updater(state.scannerStatus) : updater
      })),
      setScannerReason: (scanner, reason) => set((state) => {
        const next = { ...state.scannerReasons };
        if (reason) next[scanner] = reason;
        else delete next[scanner];
        return { scannerReasons: next };
      }),
      setAllFindings: (updater) => set((state) => ({
        allFindings: typeof updater === 'function' ? updater(state.allFindings) : updater
      })),
      setNucleiFindings: (count) => set({ nucleiFindings: count }),
      setWapitiVulns: (count) => set({ wapitiVulns: count }),
      setWapitiPages: (count) => set({ wapitiPages: count }),
      setDashboardView: (updater) => set((state) => ({
        dashboardView: typeof updater === 'function' ? updater(state.dashboardView) : { ...state.dashboardView, ...updater }
      })),
      resetScanState: () => {
        try {
          localStorage.removeItem('secops-active-scan');
        } catch { /* ignore */ }
        set({
          testingDraft: null,
          scanId: null,
          status: 'IDLE',
          scannerStatus: initialScannerStatus,
          scannerReasons: {},
          allFindings: [],
          nucleiFindings: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
          wapitiVulns: 0,
          wapitiPages: 0,
        });
      },
    }),
    {
      name: 'secops-active-scan',
      partialize: (state) => ({
        targetUrl: state.targetUrl,
        scanId: state.scanId,
        activeTab: state.activeTab,
        selectedTools: state.selectedTools,
        status: state.status,
        executionMode: state.executionMode,
        scannerStatus: state.scannerStatus,
        scannerReasons: state.scannerReasons,
        allFindings: state.allFindings,
        nucleiFindings: state.nucleiFindings,
        wapitiVulns: state.wapitiVulns,
        wapitiPages: state.wapitiPages,
        dashboardView: state.dashboardView,
      }),
    }
  )
);
