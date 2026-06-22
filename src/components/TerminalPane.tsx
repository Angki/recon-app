import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal as TerminalIcon, Search, Trash2, Copy, Check } from 'lucide-react';
import 'xterm/css/xterm.css';

interface TerminalPaneProps {
  title: string;
  scanner: 'nuclei' | 'wapiti' | 'subfinder' | 'httpx' | 'nmap' | 'zap' | 'katana' | 'ffuf' | 'alterx' | 'dnsx' | 'naabu' | 'tlsx' | 'appscan' | 'netsparker' | 'acunetix' | 'pdiscovery' | 'wpscan';
  scanId: string | null;
  status: string;
  isVisible?: boolean;
}

export default function TerminalPane({ title, scanner, scanId, status, isVisible = true }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);
  const [copied, setCopied] = useState(false);

  const toggleAutoScroll = () => {
    setAutoScroll(prev => {
      autoScrollRef.current = !prev;
      return !prev;
    });
  };

  // Resize when tab becomes visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current && terminalRef.current && xtermRef.current?.element) {
      let frameId: number;
      const attemptFit = () => {
        try {
          const el = xtermRef.current?.element;
          if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            const dims = fitAddonRef.current?.proposeDimensions();
            if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
              fitAddonRef.current?.fit();
              return; // Success
            }
          }
          // Retry next frame if not ready
          frameId = requestAnimationFrame(attemptFit);
        } catch {
          frameId = requestAnimationFrame(attemptFit);
        }
      };
      
      frameId = requestAnimationFrame(attemptFit);
      return () => cancelAnimationFrame(frameId);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0d1117', // darker polished background
        foreground: '#e6edf3', // softer white
        cursor: '#58a6ff', // nice blue cursor
        selectionBackground: 'rgba(56, 139, 253, 0.3)',
      },
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
    
    // Initial fit needs a small delay to ensure container is sized
    const initialFitTimeout = setTimeout(() => {
      try {
        if (term.element && term.element.clientWidth > 0 && term.element.clientHeight > 0) {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
            fitAddon.fit();
          }
        }
      } catch {
        // dimensions might not be ready
      }
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const handleResize = () => {
      try {
        if (term.element && term.element.clientWidth > 0 && term.element.clientHeight > 0) {
          const dims = fitAddon.proposeDimensions();
          if (dims && dims.cols && dims.rows && !isNaN(dims.cols) && !isNaN(dims.rows)) {
            fitAddon.fit();
          }
        }
      } catch {
        // dimensions might not be ready
      }
    };

    // Use ResizeObserver instead of window resize for better scoping
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
        // ignore dispose errors
      }
    };
  }, []);

  // Add buffer for when terminal is hidden
  const writeBuffer = useRef<string>('');

  useEffect(() => {
    if (!scanId || !window.api) return;

    // Clear terminal on new scan
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
            
            // If terminal has 0 width (display: none), buffer the output to prevent xterm crash
            if (!xtermRef.current.element || xtermRef.current.element.clientWidth === 0) {
              writeBuffer.current += msg;
              return;
            }

            // Flush buffer if we have any
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

  // Flush buffer when terminal becomes visible again
  useEffect(() => {
    if (isVisible && writeBuffer.current && xtermRef.current && xtermRef.current.element && xtermRef.current.element.clientWidth > 0) {
      try {
        xtermRef.current.write(writeBuffer.current);
        writeBuffer.current = '';
        if (autoScrollRef.current) {
          xtermRef.current.scrollToBottom();
        }
      } catch { /* ignore */ }
    }
  }, [isVisible]);

  const handleSearch = () => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findNext(searchTerm);
    }
  };

  const clearTerminal = () => {
    xtermRef.current?.clear();
  };

  const handleCopy = () => {
    if (xtermRef.current) {
      xtermRef.current.selectAll();
      const text = xtermRef.current.getSelection();
      navigator.clipboard.writeText(text);
      xtermRef.current.clearSelection();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'RUNNING': return 'text-amber-500';
      case 'COMPLETED': return 'text-emerald-500';
      case 'FAILED': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold tracking-wider text-slate-200 uppercase">{title}</h2>
          <span className={`text-[10px] uppercase font-bold ml-4 px-2 py-0.5 rounded-full bg-slate-900/50 border border-slate-700/50 ${getStatusColor()}`}>
            {status || 'IDLE'}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-900/80 rounded-md px-2.5 py-1.5 border border-slate-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search..."
              className="bg-transparent border-none text-xs text-slate-200 outline-none w-24 md:w-32 placeholder-slate-500"
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
            className={`text-xs px-2.5 py-1.5 rounded-md transition-all duration-200 font-medium ${autoScroll ? 'bg-blue-600/90 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
          >
            Auto-scroll
          </button>
          <div className="flex bg-slate-800 rounded-md border border-slate-700/50 overflow-hidden">
            <button onClick={handleCopy} className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title="Copy Console Output">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <div className="w-[1px] bg-slate-700/50"></div>
            <button onClick={clearTerminal} className="p-1.5 hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors" title="Clear Console">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 p-3 relative overflow-hidden bg-[#0d1117]" ref={terminalRef}></div>
    </div>
  );
}
