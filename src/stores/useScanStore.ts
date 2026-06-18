import { create } from 'zustand';
import type { Vulnerability } from '../types/vulnerability';

export type ScannerType = 'nuclei' | 'wapiti' | 'subfinder' | 'httpx' | 'nmap' | 'zap' | 'katana' | 'ffuf' | 'alterx' | 'dnsx' | 'naabu' | 'tlsx' | 'appscan' | 'netsparker' | 'acunetix' | 'pdiscovery' | 'wpscan';
export type ScannerStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';

interface FindingsCount {
  info: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

const allTools = ['nuclei', 'wapiti', 'wpscan', 'subfinder', 'alterx', 'dnsx', 'naabu', 'tlsx', 'httpx', 'nmap', 'zap', 'katana', 'ffuf', 'appscan', 'netsparker', 'acunetix'];

interface ScanState {
  targetUrl: string;
  scanId: string | null;
  activeTab: ScannerType | 'findings' | 'ai';
  isWordpressScan: boolean;
  selectedTools: string[];
  status: string;
  scannerStatus: Record<ScannerType, ScannerStatus>;
  allFindings: Vulnerability[];
  nucleiFindings: FindingsCount;
  wapitiVulns: number;
  wapitiPages: number;

  // Actions
  setTargetUrl: (url: string) => void;
  setScanId: (id: string | null) => void;
  setActiveTab: (tab: ScannerType | 'findings' | 'ai') => void;
  setIsWordpressScan: (isWp: boolean) => void;
  setSelectedTools: (tools: string[] | ((prev: string[]) => string[])) => void;
  setStatus: (status: string) => void;
  setScannerStatus: (status: Record<ScannerType, ScannerStatus> | ((prev: Record<ScannerType, ScannerStatus>) => Record<ScannerType, ScannerStatus>)) => void;
  setAllFindings: (findings: Vulnerability[] | ((prev: Vulnerability[]) => Vulnerability[])) => void;
  setNucleiFindings: (count: FindingsCount) => void;
  setWapitiVulns: (count: number) => void;
  setWapitiPages: (count: number) => void;
  resetScanState: () => void;
}

const initialScannerStatus: Record<ScannerType, ScannerStatus> = {
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
  appscan: 'IDLE',
  netsparker: 'IDLE',
  acunetix: 'IDLE',
  wpscan: 'IDLE',
  pdiscovery: 'IDLE',
};

export const useScanStore = create<ScanState>((set) => ({
  targetUrl: 'https://makassarkota.go.id',
  scanId: null,
  activeTab: 'nuclei',
  isWordpressScan: false,
  selectedTools: allTools,
  status: 'IDLE',
  scannerStatus: initialScannerStatus,
  allFindings: [],
  nucleiFindings: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
  wapitiVulns: 0,
  wapitiPages: 0,

  setTargetUrl: (url) => set({ targetUrl: url }),
  setScanId: (id) => set({ scanId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsWordpressScan: (isWp) => set({ isWordpressScan: isWp }),
  setSelectedTools: (updater) => set((state) => ({
    selectedTools: typeof updater === 'function' ? updater(state.selectedTools) : updater
  })),
  setStatus: (status) => set({ status }),
  setScannerStatus: (updater) => set((state) => ({
    scannerStatus: typeof updater === 'function' ? updater(state.scannerStatus) : updater
  })),
  setAllFindings: (updater) => set((state) => ({
    allFindings: typeof updater === 'function' ? updater(state.allFindings) : updater
  })),
  setNucleiFindings: (count) => set({ nucleiFindings: count }),
  setWapitiVulns: (count) => set({ wapitiVulns: count }),
  setWapitiPages: (count) => set({ wapitiPages: count }),
  resetScanState: () => set({
    scanId: null,
    status: 'IDLE',
    scannerStatus: initialScannerStatus,
    allFindings: [],
    nucleiFindings: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
    wapitiVulns: 0,
    wapitiPages: 0,
  }),
}));
