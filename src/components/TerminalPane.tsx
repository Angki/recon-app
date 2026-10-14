import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal as TerminalIcon, Search, Copy, Check, Trash2 } from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';
import type { AppTheme } from '../stores/useThemeStore';
import type { ScannerType } from '../stores/useScanStore';
import 'xterm/css/xterm.css';

interface TerminalPaneProps {
  logs?: string[];
  title?: string;
  scanner?: ScannerType;
  scanId?: string | null;
  status?: string;
  isVisible?: boolean;
}

const getXtermTheme = (theme: AppTheme) => {
  switch (theme) {
    case 'obsidian':
      return {
        background: '#030406',
        foreground: '#00f0ff',
        cursor: '#00f0ff',
        selectionBackground: 'rgba(0, 240, 255, 0.3)',
        black: '#030406',
        red: '#ff5370',
        green: '#00ffaa',
        yellow: '#ffcb6b',
        blue: '#00f0ff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#ffffff',
      };
    case 'light':
      return {
        background: '#1e293b',
        foreground: '#f8fafc',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.35)',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#ffffff',
      };
    case 'glass':
      return {
        background: '#060a13',
        foreground: '#f1f5f9',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#060a13',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#38bdf8',
        magenta: '#a78bfa',
        cyan: '#22d3ee',
        white: '#ffffff',
      };
    case 'dark':
    default:
      return {
        background: '#070c17',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        selectionBackground: 'rgba(56, 139, 253, 0.3)',
        black: '#070c17',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#ffffff',
      };
  }
};

export default function TerminalPane({
  logs,
  title = 'LIVE SCAN CONSOLE',
  scanner,
  scanId,
  status = 'IDLE',
  isVisible = true,
}: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const processedLogsCount = useRef(0);
  const writeBuffer = useRef<string>('');
  const autoScrollRef = useRef(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const currentTheme = useThemeStore((state) => state.theme);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // Synchronize terminal theme dynamically
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getXtermTheme(currentTheme);
    }
  }, [currentTheme]);

  // Fit terminal when visibility changes
  useEffect(() => {
    if (isVisible && fitAddonRef.current && terminalRef.current && xtermRef.current?.element) {
      let frameId: number;
      let retries = 0;
      const attemptFit = () => {
        if (retries > 10) return;
        retries++;
        try {
          const el = xtermRef.current?.element;
          const core = (xtermRef.current as any)?._core;
          if (el && el.clientWidth > 0 && el.clientHeight > 0 && core && core._renderService) {
            const dims = fitAddonRef.current?.proposeDimensions();
            if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
              fitAddonRef.current?.fit();
              return;
            }
          }
          frameId = requestAnimationFrame(attemptFit);
        } catch {
          frameId = requestAnimationFrame(attemptFit);
        }
      };
      
      frameId = requestAnimationFrame(attemptFit);
      return () => cancelAnimationFrame(frameId);
    }
  }, [isVisible]);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: getXtermTheme(currentTheme),
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 12,
      disableStdin: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.open(terminalRef.current);
    
    const initialFitTimeout = setTimeout(() => {
      try {
        const core = (term as any)._core;
        if (term.element && term.element.clientWidth > 0 && term.element.clientHeight > 0 && core && core._renderService) {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
            fitAddon.fit();
          }
        }
      } catch {
        // ignore
      }
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const handleResize = () => {
      try {
        const core = (term as any)._core;
        if (term.element && term.element.clientWidth > 0 && term.element.clientHeight > 0 && core && core._renderService) {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
            fitAddon.fit();
          }
        }
      } catch {
        // ignore
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(terminalRef.current);
    } else {
      window.addEventListener('resize', handleResize);
    }

    const currentTerminalRef = terminalRef.current;

    return () => {
      clearTimeout(initialFitTimeout);
      if (resizeObserver && currentTerminalRef) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', handleResize);
      }
      try {
        term.dispose();
      } catch {
        // ignore
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, []);

  // Listen for direct scan output if scanId and scanner are provided
  useEffect(() => {
    if (!scanId || !scanner || !window.api) return;

    xtermRef.current?.clear();
    writeBuffer.current = '';

    const removeListener = window.api.onScanOutput((_event, data) => {
      if (data.scanId === scanId && xtermRef.current) {
        const shouldWrite = scanner === 'pdiscovery' 
          ? ['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'].includes(data.scanner)
          : data.scanner === scanner;

        if (shouldWrite) {
          try {
            const prefix = scanner === 'pdiscovery' ? `\x1b[36m[${data.scanner}]\x1b[0m ` : '';
            const msg = prefix + data.message;
            
            if (!xtermRef.current.element || xtermRef.current.element.clientWidth === 0) {
              writeBuffer.current += msg;
              return;
            }

            if (writeBuffer.current) {
              xtermRef.current.write(writeBuffer.current);
              writeBuffer.current = '';
            }

            xtermRef.current.write(msg);
            
            if (autoScrollRef.current) {
              xtermRef.current.scrollToBottom();
            }
          } catch (e) {
            console.error(`[Xterm] Failed to write data:`, e);
          }
        }
      }
    });

    return () => removeListener();
  }, [scanId, scanner]);

  // Flush buffer when terminal becomes visible
  useEffect(() => {
    if (isVisible && writeBuffer.current && xtermRef.current && xtermRef.current.element && xtermRef.current.element.clientWidth > 0) {
      try {
        xtermRef.current.write(writeBuffer.current);
        writeBuffer.current = '';
        if (autoScrollRef.current) {
          xtermRef.current.scrollToBottom();
        }
      } catch {
        // ignore
      }
    }
  }, [isVisible]);

  // Handle explicit logs prop array if passed
  useEffect(() => {
    if (!logs) return;
    const term = xtermRef.current;
    if (!term) return;

    if (logs.length === 0) {
      term.clear();
      processedLogsCount.current = 0;
      return;
    }

    if (logs.length < processedLogsCount.current) {
      term.clear();
      processedLogsCount.current = 0;
    }

    const newLogs = logs.slice(processedLogsCount.current);
    if (newLogs.length > 0) {
      const chunk = newLogs.join('');
      term.write(chunk);
      processedLogsCount.current = logs.length;
      if (autoScroll) {
        term.scrollToBottom();
      }
    }
  }, [logs, autoScroll]);

  const handleSearch = useCallback(() => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findNext(searchTerm);
    }
  }, [searchTerm]);

  const clearTerminal = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      writeBuffer.current = '';
      if (logs) {
        processedLogsCount.current = logs.length;
      }
    }
  }, [logs]);

  const handleCopy = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.selectAll();
      const text = xtermRef.current.getSelection();
      navigator.clipboard.writeText(text);
      xtermRef.current.clearSelection();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const toggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
    if (!autoScroll && xtermRef.current) {
      xtermRef.current.scrollToBottom();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'RUNNING':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'COMPLETED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'FAILED':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-[var(--text-muted)] bg-black/10 border-[var(--border-card)]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--term-bg)] border border-[var(--border-card)] rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-card)]">
        <div className="flex items-center space-x-2.5">
          <TerminalIcon className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2 className="text-xs font-bold tracking-wider text-[var(--text-primary)] uppercase">{title}</h2>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusColor()}`}>
            {status || 'IDLE'}
          </span>
        </div>
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center bg-[var(--bg-card)] rounded-lg px-2.5 py-1 border border-[var(--border-card)] focus-within:border-[var(--accent-primary)] transition-all">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2" />
            <input 
              type="text" 
              placeholder="Search logs..."
              className="bg-transparent border-none text-xs text-[var(--text-primary)] outline-none w-24 md:w-32 placeholder-[var(--text-muted)]"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
          </div>
          <button 
            onClick={toggleAutoScroll}
            className={`text-xs px-2.5 py-1 rounded-lg transition-all font-medium cursor-pointer ${
              autoScroll 
                ? 'bg-[var(--accent-primary)] text-white shadow-sm' 
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)]'
            }`}
          >
            Auto-scroll
          </button>
          <div className="flex bg-[var(--bg-card)] rounded-lg border border-[var(--border-card)] overflow-hidden">
            <button onClick={handleCopy} className="p-1.5 hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer" title="Copy Console Output">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <div className="w-[1px] bg-[var(--border-card)]"></div>
            <button onClick={clearTerminal} className="p-1.5 hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer" title="Clear Console">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 p-3 relative overflow-hidden bg-[var(--term-bg)]" ref={terminalRef}></div>
    </div>
  );
}
