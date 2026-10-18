import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, History, Settings as SettingsIcon, Cpu, Layers } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';
import Endpoints from './pages/Endpoints';
import { CommandHeader } from './components/CommandHeader';
import { ToolsHubModal } from './components/ToolsHubModal';
import './App.css';

function App() {
  const location = useLocation();
  const [showToolsHub, setShowToolsHub] = useState(false);

  const getNavClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
      isActive
        ? 'bg-[var(--accent-primary)] text-white shadow-md shadow-[var(--accent-glow)] font-semibold'
        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
    }`;
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
              Cyber Command v1.1
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <Link to="/" className={getNavClass('/')}>
            <Layers className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <button
            onClick={() => setShowToolsHub(true)}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] cursor-pointer text-left"
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Engines & Tools</span>
          </button>
          <Link to="/history" className={getNavClass('/history')}>
            <History className="w-4 h-4" />
            <span>Scan History</span>
          </Link>
          <Link to="/endpoints" className={getNavClass('/endpoints')}><Layers className="w-4 h-4"/><span>Endpoint Inventory</span></Link>
          <Link to="/settings" className={getNavClass('/settings')}>
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="mt-auto px-2 py-3 border-t border-[var(--border-card)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
            <span>Status: Operational</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
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
    </div>
  );
}

export default App;
