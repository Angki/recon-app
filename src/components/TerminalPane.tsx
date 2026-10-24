import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal as TerminalIcon, Search, Copy, Check, Trash2 } from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';
import type { AppTheme } from '../stores/useThemeStore';
import type { ScannerType } from '../stores/useScanStore';
import { useLogStore } from '../stores/useLogStore';
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
  const [hasBeenVisible, setHasBeenVisible] = useState(isVisible || false);

  const currentTheme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (isVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [isVisible, hasBeenVisible]);

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
          if (el && el.clientWidth > 0 && el.clientHeight > 0 && core?._renderService?._renderer?.value?.dimensions) {
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

  // Initialize xterm lazily when component becomes visible
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

    // Guard against unhandled dimensions crash in xterm Viewport and RenderService
    try {
      const core = (term as any)._core;

      // 1. Monkey-patch RenderService.prototype.dimensions to guarantee safe fallback
      if (core?._renderService) {
        const renderProto = Object.getPrototypeOf(core._renderService);
        if (renderProto && !(renderProto as any).__safeDimensionsPatched) {
          (renderProto as any).__safeDimensionsPatched = true;
          const origDesc = Object.getOwnPropertyDescriptor(renderProto, 'dimensions');
          if (origDesc?.get) {
            const origGet = origDesc.get;
            Object.defineProperty(renderProto, 'dimensions', {
              get() {
                try {
                  if (this._renderer?.value?.dimensions) {
                    return origGet.call(this);
                  }
                } catch {
                  // Fallback to safe mock metrics
                }
                return {
                  device: { cell: { height: 16, width: 9 }, char: { height: 16, width: 9 } },
                  css: { cell: { height: 16, width: 9 }, canvas: { height: 100, width: 100 } }
                };
              },
              configurable: true,
              enumerable: true
            });
          }
        }
      }

      // 2. Monkey-patch Viewport._innerRefresh to safely check dimensions readiness
      if (core?.viewport) {
        const vp = core.viewport;
        const origRefresh = vp._innerRefresh?.bind(vp);
        if (origRefresh) {
          vp._innerRefresh = () => {
            try {
              if (core._renderService?._renderer?.value?.dimensions) {
                origRefresh();
              }
            } catch {
              // Silently suppress unhandled dimensions access during resize/unmount
            }
          };
        }
      }
    } catch {
      // ignore
    }

    // Replay stored logs immediately
    if (logs && logs.length > 0) {
      term.write(logs.join(''));
      processedLogsCount.current = logs.length;
    } else if (scanner) {
      const stored = useLogStore.getState().scannerLogs[scanner];
      if (stored && stored.length > 0) {
        term.write(stored.join(''));
      }
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const safeFit = () => {
      try {
        if (!term.element) return;
        const width = term.element.clientWidth;
        const height = term.element.clientHeight;
        if (width <= 0 || height <= 0) return;
        const core = (term as any)._core;
        if (!core?._renderService?._renderer?.value?.dimensions?.css?.cell?.height) return;
        const dims = fitAddon.proposeDimensions();
        if (dims && dims.cols > 0 && dims.rows > 0 && !isNaN(dims.cols) && !isNaN(dims.rows)) {
          fitAddon.fit();
        }
      } catch {
        // Safe no-op
      }
    };

    const initialFitTimeout = setTimeout(safeFit, 100);

    let resizeObserver: ResizeObserver | null = null;
    if (terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        safeFit();
      });
      resizeObserver.observe(terminalRef.current);
    } else {
      window.addEventListener('resize', safeFit);
    }

    const currentTerminalRef = terminalRef.current;

    return () => {
      clearTimeout(initialFitTimeout);
      if (resizeObserver && currentTerminalRef) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', safeFit);
      }

      // Neutralize viewport refresh before disposing to prevent post-unmount rAF execution
      try {
        const core = (term as any)._core;
        if (core?.viewport) {
          if (core.viewport._refreshAnimationFrame) {
            const win = core._coreBrowserService?.window || window;
            win.cancelAnimationFrame(core.viewport._refreshAnimationFrame);
            core.viewport._refreshAnimationFrame = null;
          }
          core.viewport._innerRefresh = () => {};
        }
      } catch {
        // ignore
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

    // Replay previously buffered scanner logs so switching tabs never presents an empty terminal
    const store = useLogStore.getState();
    const isPdiscovery = scanner === 'pdiscovery';
    const initialLogs: string[] = isPdiscovery
      ? ['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'].flatMap(s => 
          (store.scannerLogs[s] || []).map(line => `\x1b[36m[${s}]\x1b[0m ${line}`)
        )
      : (store.scannerLogs[scanner] || []);

    if (initialLogs.length > 0) {
      const historyText = initialLogs.join('');
      if (!xtermRef.current || !xtermRef.current.element || xtermRef.current.element.clientWidth === 0) {
        writeBuffer.current += historyText;
      } else {
        xtermRef.current.write(historyText);
        if (autoScrollRef.current) {
          xtermRef.current.scrollToBottom();
        }
      }
    }

    const removeListener = window.api.onScanOutput((_event, data) => {
      if (data.scanId === scanId) {
        const shouldWrite = scanner === 'pdiscovery' 
          ? ['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'].includes(data.scanner)
          : data.scanner === scanner;

        if (shouldWrite) {
          try {
            const prefix = scanner === 'pdiscovery' ? `\x1b[36m[${data.scanner}]\x1b[0m ` : '';
            const msg = prefix + data.message;
            
            if (!xtermRef.current || !xtermRef.current.element || xtermRef.current.element.clientWidth === 0) {
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
              aria-label="Search console logs"
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
            aria-pressed={autoScroll}
            className={`text-xs px-2.5 py-1 rounded-lg transition-all font-medium cursor-pointer ${
              autoScroll 
                ? 'bg-[var(--accent-primary)] text-white shadow-sm' 
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-card)]'
            }`}
          >
            Auto-scroll
          </button>
          <div className="flex bg-[var(--bg-card)] rounded-lg border border-[var(--border-card)] overflow-hidden">
            <button onClick={handleCopy} className="p-1.5 hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer" title="Copy Console Output" aria-label="Copy console output">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
            <div className="w-[1px] bg-[var(--border-card)]"></div>
            <button onClick={clearTerminal} className="p-1.5 hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer" title="Clear Console" aria-label="Clear console output">
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 p-3 relative overflow-hidden bg-[var(--term-bg)]" ref={terminalRef}></div>
    </div>
  );
}
