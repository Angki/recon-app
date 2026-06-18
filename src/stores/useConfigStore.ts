import { create } from 'zustand';

export interface DependencyStatus {
  name: string;
  isInstalled: boolean;
  requiresManual: boolean;
}

interface ConfigState {
  // Dependencies
  dependencies: DependencyStatus[];
  showDependencyModal: boolean;
  isInstallingDependencies: boolean;
  dependencyLogs: string[];

  // Updates
  isUpdating: boolean;
  updateLogs: string[];
  showUpdateModal: boolean;

  // Actions
  setDependencies: (deps: DependencyStatus[]) => void;
  setShowDependencyModal: (show: boolean) => void;
  setIsInstallingDependencies: (isInstalling: boolean) => void;
  setDependencyLogs: (logs: string[] | ((prev: string[]) => string[])) => void;
  
  setIsUpdating: (isUpdating: boolean) => void;
  setUpdateLogs: (logs: string[] | ((prev: string[]) => string[])) => void;
  setShowUpdateModal: (show: boolean) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  dependencies: [],
  showDependencyModal: false,
  isInstallingDependencies: false,
  dependencyLogs: [],
  
  isUpdating: false,
  updateLogs: [],
  showUpdateModal: false,

  setDependencies: (deps) => set({ dependencies: deps }),
  setShowDependencyModal: (show) => set({ showDependencyModal: show }),
  setIsInstallingDependencies: (isInstalling) => set({ isInstallingDependencies: isInstalling }),
  setDependencyLogs: (updater) => set((state) => ({
    dependencyLogs: typeof updater === 'function' ? updater(state.dependencyLogs) : updater
  })),

  setIsUpdating: (isUpdating) => set({ isUpdating }),
  setUpdateLogs: (updater) => set((state) => ({
    updateLogs: typeof updater === 'function' ? updater(state.updateLogs) : updater
  })),
  setShowUpdateModal: (show) => set({ showUpdateModal: show }),
}));
