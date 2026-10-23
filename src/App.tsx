import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, History, Settings as SettingsIcon, Cpu, Layers, ShieldAlert, Radio } from 'lucide-react';
import { useScanStore, type ScannerType } from './stores/useScanStore';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';
import Endpoints from './pages/Endpoints';
import { CommandHeader } from './components/CommandHeader';
import { ToolsHubModal } from './components/ToolsHubModal';
import { ToastViewport } from './components/ui/ToastViewport';
import './App.css';

function App() {
  const location = useLocation();
  const [showToolsHub, setShowToolsHub] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const workspaceTab = useScanStore((state) => state.workspaceTab);
  const setWorkspaceTab = useScanStore((state) => state.setWorkspaceTab);

  useEffect(() => {
    window.api?.getAppVersion?.().then((v) => {
      if (v) setAppVersion(v);
    }).catch(() => {});
  }, []);

  const isWorkspace = location.pathname === '/';
  const isConfigView = isWorkspace && workspaceTab === 'config';
  const isLiveView = isWorkspace && workspaceTab === 'live';
  const isFindingsView = isWorkspace && workspaceTab === 'findings';

  const getStepClass = (isActive: boolean, activeClass = 'bg-[var(--accent-primary)] text-white shadow-md shadow-[var(--accent-glow)] font-semibold') => (
    `flex items-center space-x-3 px-3 py-2 rounded-xl transition-all duration-200 text-xs font-medium ${
      isActive
        ? activeClass
        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
    }`
  );

  const getPageClass = (isActive: boolean) => (
    `flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
      isActive
        ? 'bg-[var(--accent-primary)] text-white shadow-md shadow-[var(--accent-glow)] font-semibold'
        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
    }`
  );

  const openLiveWorkspace = () => {
    const state = useScanStore.getState();
    setWorkspaceTab('live');
    if (state.activeTab === 'findings' || state.activeTab === 'ai') {
      state.setActiveTab((state.selectedTools[0] as ScannerType) || 'sqlmap');
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-sans select-none transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-card)] flex flex-col p-4 shrink-0 transition-colors duration-200">
        <div className="flex items-center space-x-3 mb-8 px-2 py-1">
          <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--border-glow)]">
            <Shield className="w-6 h-6 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-[var(--text-primary)] to-[var(--accent-primary)] bg-clip-text text-transparent">
              SecOps Recon
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Cyber Command v{appVersion}
            </span>
          </div>
        </div>

        <div className="px-2 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            Assessment Workflow
          </span>
        </div>

        <nav className="flex-1 space-y-1" aria-label="Assessment Pipeline Navigation">
          <Link
            to="/"
            onClick={() => setWorkspaceTab('config')}
            className={getStepClass(isConfigView)}
            aria-current={isConfigView ? 'step' : undefined}
            aria-label="1. Target and Engagement Scope"
          >
            <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex flex-col">
              <span>1. Target & Scope</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Engagements & input</span>
            </div>
          </Link>

          <Link
            to="/endpoints"
            className={getStepClass(location.pathname === '/endpoints')}
            aria-current={location.pathname === '/endpoints' ? 'step' : undefined}
            aria-label="2. Requests and Authentication Workspace"
          >
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="flex flex-col">
              <span>2. Requests & Auth</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Parameters & auth tokens</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setShowToolsHub(true)}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl transition-all duration-200 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] cursor-pointer text-left"
            aria-label="3. Engines and Preflight Healthchecks"
            aria-haspopup="dialog"
            aria-expanded={showToolsHub}
          >
            <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span>3. Engines & Preflight</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Catalog & environment</span>
            </div>
          </button>

          <Link
            to="/"
            onClick={openLiveWorkspace}
            className={getStepClass(isLiveView)}
            aria-current={isLiveView ? 'step' : undefined}
            aria-label="4. Run and Live Telemetry"
          >
            <Radio className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span>4. Run & Telemetry</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Live console & execution</span>
            </div>
          </Link>

          <Link
            to="/"
            onClick={() => {
              setWorkspaceTab('findings');
              useScanStore.getState().setActiveTab('findings');
            }}
            className={getStepClass(isFindingsView, 'bg-rose-600/90 text-white shadow-md shadow-rose-900/40 font-semibold')}
            aria-current={isFindingsView ? 'step' : undefined}
            aria-label="5. Findings and Verified Evidence"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex flex-col">
              <span>5. Findings & Evidence</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Triage & verification</span>
            </div>
          </Link>

          <Link
            to="/history"
            className={getStepClass(location.pathname === '/history')}
            aria-current={location.pathname === '/history' ? 'step' : undefined}
            aria-label="6. Retests, Baselines, and Compliance Reports"
          >
            <History className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="flex flex-col">
              <span>6. Retest & Reports</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Baselines & exports</span>
            </div>
          </Link>
        </nav>

        <div className="pt-3 border-t border-[var(--border-card)] space-y-1">
          <Link
            to="/settings"
            className={getPageClass(location.pathname === '/settings')}
            aria-current={location.pathname === '/settings' ? 'page' : undefined}
            aria-label="System Settings"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </div>

        <div className="mt-auto px-2 py-3 border-t border-[var(--border-card)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
            <span>Status: Operational</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Title bar drag region for Electron window */}
        <div
          className="h-4 w-full bg-[var(--bg-surface)] drag-region shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />

        {/* Top Header */}
        <CommandHeader onOpenToolsHub={() => setShowToolsHub(true)} />

        {/* Content View */}
        <main className="flex-1 overflow-hidden p-3 md:p-4 flex flex-col min-h-0 relative">
          <div className={location.pathname === '/' ? 'h-full flex flex-col min-h-0' : 'hidden'}>
            <Dashboard onOpenToolsHub={() => setShowToolsHub(true)} />
          </div>

          <div className={location.pathname !== '/' ? 'h-full overflow-y-auto' : 'hidden'}>
            <Routes>
              <Route path="/" element={<div />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/endpoints" element={<Endpoints />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Tools Hub Modal */}
      {showToolsHub && (
        <ToolsHubModal isOpen={showToolsHub} onClose={() => setShowToolsHub(false)} />
      )}

      <ToastViewport />
    </div>
  );
}

export default App;
