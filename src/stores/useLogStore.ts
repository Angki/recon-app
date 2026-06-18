import { create } from 'zustand';

interface LogState {
  rawLogs: string;
  aiResponse: string;
  isAnalyzing: boolean;
  aiProgressMsg: string;

  // Actions
  appendRawLogs: (log: string) => void;
  clearRawLogs: () => void;
  setAiResponse: (response: string) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAiProgressMsg: (msg: string) => void;
}

export const useLogStore = create<LogState>((set) => ({
  rawLogs: '',
  aiResponse: '',
  isAnalyzing: false,
  aiProgressMsg: 'Analyzing logs with AI... This might take a minute depending on the log size.',

  appendRawLogs: (log) => set((state) => ({ rawLogs: state.rawLogs + log })),
  clearRawLogs: () => set({ rawLogs: '' }),
  setAiResponse: (response) => set({ aiResponse: response }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAiProgressMsg: (msg) => set({ aiProgressMsg: msg }),
}));
