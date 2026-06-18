import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, History, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';
import './App.css';

function App() {
  const location = useLocation();

  const getNavClass = (path: string) => {
    return `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
      location.pathname === path 
        ? 'bg-blue-600 text-white' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center space-x-3 mb-8 px-2">
          <Shield className="w-8 h-8 text-emerald-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent tracking-wide">
            SecOps Recon
          </h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <Link to="/" className={getNavClass('/')}>
            <Shield className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/history" className={getNavClass('/history')}>
            <History className="w-5 h-5" />
            <span>History</span>
          </Link>
          <Link to="/settings" className={getNavClass('/settings')}>
            <SettingsIcon className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </nav>
        
        <div className="mt-auto px-2 py-4">
          <div className="text-xs text-slate-500">v1.0.0 • Enterprise Edition</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Title bar drag area */}
        <div className="h-8 w-full drag-region" style={{ WebkitAppRegion: 'drag' } as any}></div>
        <div className="flex-1 overflow-auto p-6 relative">
          {/* We keep Dashboard always mounted to preserve its state and xterm.js DOM instances. 
              We just hide it using CSS when we are not on the root path. */}
          <div className={location.pathname === '/' ? 'block h-full' : 'hidden h-full'}>
            <Dashboard />
          </div>
          
          <Routes>
            <Route path="/" element={<div />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
