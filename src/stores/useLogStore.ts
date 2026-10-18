import { create } from 'zustand';

export const MAX_SCANNER_LOG_LINES = 1000;
export const MAX_RAW_LOG_CHARS = 500_000;

interface LogState {
  rawLogs: string;
  scannerLogs: Record<string, string[]>;
  aiResponse: string;
  isAnalyzing: boolean;
  aiProgressMsg: string;
  totalLinesReceived: number;
  isRingBufferTruncated: boolean;

  // Actions
  appendRawLogs: (log: string) => void;
  appendScannerLog: (scanner: string, log: string) => void;
  clearRawLogs: () => void;
  clearScannerLogs: () => void;
  setAiResponse: (response: string) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAiProgressMsg: (msg: string) => void;
}

export const useLogStore = create<LogState>((set) => ({
  rawLogs: '',
  scannerLogs: {},
  aiResponse: '',
  isAnalyzing: false,
  aiProgressMsg: 'Analyzing logs with AI... This might take a minute depending on the log size.',
  totalLinesReceived: 0,
  isRingBufferTruncated: false,

  appendRawLogs: (log) => set((state) => {
    let next = state.rawLogs + log;
    let truncated = state.isRingBufferTruncated;
    if (next.length > MAX_RAW_LOG_CHARS) {
      truncated = true;
      const keepChars = MAX_RAW_LOG_CHARS - 20_000;
      const trimmedPrefix = '[... older raw log lines trimmed for UI memory efficiency. Complete logs are saved in scan run directory ...]\n';
      next = trimmedPrefix + next.slice(next.length - keepChars);
    }
    return { rawLogs: next, isRingBufferTruncated: truncated };
  }),

  appendScannerLog: (scanner, log) => set((state) => {
    const prev = state.scannerLogs[scanner] || [];
    let nextList: string[];
    if (prev.length >= MAX_SCANNER_LOG_LINES) {
      nextList = [...prev.slice(prev.length - (MAX_SCANNER_LOG_LINES - 1)), log];
    } else {
      nextList = [...prev, log];
    }
    return {
      totalLinesReceived: state.totalLinesReceived + 1,
      scannerLogs: {
        ...state.scannerLogs,
        [scanner]: nextList
      }
    };
  }),

  clearRawLogs: () => set({ rawLogs: '', scannerLogs: {}, totalLinesReceived: 0, isRingBufferTruncated: false }),
  clearScannerLogs: () => set({ scannerLogs: {} }),
  setAiResponse: (response) => set({ aiResponse: response }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAiProgressMsg: (msg) => set({ aiProgressMsg: msg }),
}));

