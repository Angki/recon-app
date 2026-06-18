import { useState, useEffect, useRef } from 'react';
import { RefreshCw, X, ShieldAlert, Loader2 } from 'lucide-react';
import TerminalPane from '../components/TerminalPane';
import VulnerabilityTable from '../components/VulnerabilityTable';
import ScannerControls from '../components/ScannerControls';
import ToolSelection from '../components/ToolSelection';
import FindingsSummary from '../components/FindingsSummary';
import type { Vulnerability } from '../types/vulnerability';

interface FindingsCount {
  info: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export default function Dashboard() {
  const [targetUrl, setTargetUrl] = useState('https://makassarkota.go.id');
  const [scanId, setScanId] = useState<string | null>(null);
  type ScannerType = 'nuclei' | 'wapiti' | 'subfinder' | 'httpx' | 'nmap' | 'zap' | 'katana' | 'ffuf' | 'alterx' | 'dnsx' | 'naabu' | 'tlsx' | 'appscan' | 'netsparker' | 'acunetix' | 'pdiscovery' | 'wpscan';
  type ScannerStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  const tabs: (ScannerType | 'findings' | 'ai')[] = ['findings', 'ai', 'nuclei', 'wapiti', 'wpscan', 'pdiscovery', 'nmap', 'zap', 'ffuf', 'appscan', 'netsparker', 'acunetix'];
  const [activeTab, setActiveTab] = useState<ScannerType | 'findings' | 'ai'>('nuclei');
  const [isWordpressScan, setIsWordpressScan] = useState(false);
  
  const allTools = ['nuclei', 'wapiti', 'wpscan', 'subfinder', 'alterx', 'dnsx', 'naabu', 'tlsx', 'httpx', 'nmap', 'zap', 'katana', 'ffuf', 'appscan', 'netsparker', 'acunetix'];
  const [selectedTools, setSelectedTools] = useState<string[]>(allTools);

  // Statuses
  const [status, setStatus] = useState('IDLE');
  const [scannerStatus, setScannerStatus] = useState<Record<ScannerType, string>>({
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
  });

  const [nucleiFindings, setNucleiFindings] = useState<FindingsCount>({ info: 0, low: 0, medium: 0, high: 0, critical: 0 });
  const [wapitiVulns, setWapitiVulns] = useState(0);
  const [wapitiPages, setWapitiPages] = useState(0);

  // Updater states
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Unified Findings
  const [allFindings, setAllFindings] = useState<Vulnerability[]>([]);

  // Raw logs for AI copy
  const rawLogsRef = useRef<string>('');

  // AI State
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiProgressMsg, setAiProgressMsg] = useState<string>('Analyzing logs with AI... This might take a minute depending on the log size.');

  // Use refs to track scanner statuses without re-subscribing the listener
  const statusRef = useRef(scannerStatus);
  statusRef.current = scannerStatus;

  // Scan output and stats listeners
  useEffect(() => {
    if (!scanId || !window.api) return;

    const handleOutput = (_event: any, data: { scanId: string; scanner: string; type: string; message: string }) => {
      if (data.scanId !== scanId) return;
      rawLogsRef.current += `[${data.scanner.toUpperCase()}] ${data.message}\n`;
    };

    const handleStats = (_event: any, data: { scanId: string; stats: any }) => {
      if (data.scanId !== scanId) return;
      setNucleiFindings(data.stats.nuclei);
      setWapitiVulns(data.stats.wapiti.vulns);
      setWapitiPages(data.stats.wapiti.pages);
    };

    const removeOutputListener = window.api.onScanOutput(handleOutput);
    const removeStatsListener = window.api.onScanStats(handleStats);
    const removeAiProgress = window.api.onAiProgress((_e, msg) => setAiProgressMsg(msg));
    
    return () => {
      removeOutputListener();
      removeStatsListener();
      removeAiProgress();
    };
  }, [scanId]);

  // Scan status listener — stable reference, uses refs for status
  useEffect(() => {
    if (!scanId || !window.api) return;

    const handleStatus = (_event: any, data: { scanId: string; scanner: string; status: string }) => {
      if (data.scanId !== scanId) return;
      const scanner = data.scanner as ScannerType;

      setScannerStatus(prev => {
        const next = { ...prev, [scanner]: data.status };
        // Aggregate pdiscovery status
        const pdTools = ['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'];
        if (pdTools.includes(scanner)) {
          const pdStatuses = pdTools.map(t => next[t as ScannerType] || 'IDLE');
          if (pdStatuses.some(s => s === 'FAILED')) next.pdiscovery = 'FAILED';
          else if (pdStatuses.some(s => s === 'RUNNING')) next.pdiscovery = 'RUNNING';
          else if (pdStatuses.every(s => ['COMPLETED', 'IDLE', 'STOPPED'].includes(s))) next.pdiscovery = 'COMPLETED';
        }
        statusRef.current = next; // Update ref immediately to be used globally below
        return next;
      });

      // Check if all requested tools are done
      // For simplicity, we assume we're running all 5 by default or those requested.
      // If any is FAILED, we might fail overall, or just when all are terminal.
      const terminal = ['COMPLETED', 'FAILED', 'STOPPED', 'IDLE']; // IDLE if not requested

      const allDone = Object.values(statusRef.current).every(s => terminal.includes(s));
      const anyFailed = Object.values(statusRef.current).some(s => s === 'FAILED');

      // Only transition to COMPLETED if previously RUNNING or similar
      if (allDone && status !== 'IDLE') {
        setStatus(anyFailed ? 'FAILED' : 'COMPLETED');
      }
    };

    const handleFindings = (_event: any, data: { scanId: string; scanner: string; findings: Vulnerability[] }) => {
      if (data.scanId !== scanId) return;
      setAllFindings(prev => [...prev, ...data.findings]);

      // We can also auto-switch to findings tab if criticals are found, but let's keep it manual
    };

    const removeStatusListener = window.api.onScanStatus(handleStatus);
    const removeFindingsListener = window.api.onScanFindings(handleFindings);

    return () => {
      removeStatusListener();
      removeFindingsListener();
    };
  }, [scanId, status]);

  // Updater listeners
  useEffect(() => {
    if (!window.api) return;

    const handleUpdateOutput = (_event: any, msg: string) => {
      setUpdateLogs(prev => [...prev, msg]);
    };

    const handleUpdateStatus = (_event: any, newStatus: string) => {
      if (newStatus === 'DONE' || newStatus === 'ERROR') {
        setIsUpdating(false);
      }
    };

    const removeOutput = window.api.onUpdateOutput(handleUpdateOutput);
    const removeStatus = window.api.onUpdateStatus(handleUpdateStatus);

    return () => {
      removeOutput();
      removeStatus();
    };
  }, []);

  const validateUrl = (url: string) => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      // Basic injection prevention
      if (/['";&|$<>]/.test(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  };

  const handleStartScan = async () => {
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
      setTargetUrl(finalUrl);
    }

    if (!validateUrl(finalUrl)) {
      alert('Please enter a valid URL');
      return;
    }

    // Reset findings
    setNucleiFindings({ info: 0, low: 0, medium: 0, high: 0, critical: 0 });
    setWapitiVulns(0);
    setWapitiPages(0);
    setAllFindings([]);
    rawLogsRef.current = `Scan started against ${finalUrl} at ${new Date().toISOString()}\n\n`;

    setStatus('STARTING');
    const initialStatus: Record<ScannerType, ScannerStatus> = {
      nuclei: 'IDLE', wapiti: 'IDLE', subfinder: 'IDLE', alterx: 'IDLE', dnsx: 'IDLE', naabu: 'IDLE',
      tlsx: 'IDLE', httpx: 'IDLE', nmap: 'IDLE', zap: 'IDLE', katana: 'IDLE', ffuf: 'IDLE',
      appscan: 'IDLE', netsparker: 'IDLE', acunetix: 'IDLE', wpscan: 'IDLE', pdiscovery: 'IDLE'
    };
    
    selectedTools.forEach(tool => {
      initialStatus[tool as ScannerType] = 'RUNNING';
      if (['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'].includes(tool)) {
        initialStatus.pdiscovery = 'RUNNING';
      }
    });
    
    setScannerStatus(initialStatus);

    try {
      const res = await window.api.startScan(finalUrl, {
        tools: selectedTools,
        isWordpress: isWordpressScan
      });
      if (res.success) {
        setScanId(res.scanId);
        setStatus('RUNNING');
      } else {
        alert('Failed to start scan: ' + res.error);
        setStatus('FAILED');
        setScannerStatus({
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
        });
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
      setStatus('FAILED');
    }
  };

  const handleStopScan = async () => {
    if (!scanId) return;
    setStatus('STOPPING');
    const res = await window.api.stopScan(scanId);
    if (res.success) {
      setStatus('STOPPED');
      setScannerStatus(prev => {
        const next = { ...prev };
        for (const k in next) if (next[k as ScannerType] === 'RUNNING') next[k as ScannerType] = 'STOPPED';
        return next;
      });
    }
  };

  const handleOpenFolder = () => {
    if (scanId) {
      window.api.openReportFolder(scanId);
    }
  };

  const handleCopyLogsForAI = () => {
    if (!rawLogsRef.current) {
      alert('No logs available yet.');
      return;
    }
    const contextText = `# SecOps Recon Scan Logs\n\nTarget: ${targetUrl}\nStatus: ${status}\n\n## Terminal Output\n\`\`\`\n${rawLogsRef.current}\n\`\`\`\n`;
    navigator.clipboard.writeText(contextText);
    alert('Full scan logs copied! You can now paste this to your AI agent.');
  };

  const handleAnalyzeAI = async () => {
    if (!rawLogsRef.current) {
      alert('No logs available to analyze.');
      return;
    }
    setActiveTab('ai');
    setIsAnalyzing(true);
    setAiResponse('');
    setAiProgressMsg('Analyzing logs with AI... This might take a minute depending on the log size.');

    try {
      const prompt = `You are a cybersecurity expert. Analyze these automated scan logs for ${targetUrl}. Summarize the vulnerabilities, state the most critical risks, and suggest remediation steps. Provide a clear, actionable executive summary.`;
      const response = await window.api.analyzeLogs(rawLogsRef.current, prompt);
      setAiResponse(response);
    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('Is Ollama running?')) {
        msg = `Could not connect to Ollama. Please ensure the Ollama app is running locally, or change the AI Provider in Settings.\n\nTechnical details: ${err.message}`;
      } else {
        msg = `Error during AI Analysis:\n\n${err.message}\n\nPlease check your configuration in Settings.`;
      }
      setAiResponse(`[ERROR]\n${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateTools = async () => {
    setIsUpdating(true);
    setUpdateLogs([]);
    setShowUpdateModal(true);
    try {
      await window.api.updateTools();
    } catch (e: any) {
      setUpdateLogs(prev => [...prev, `Error: ${e.message}`]);
      setIsUpdating(false);
    }
  };


  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Controls */}
      <ScannerControls
        targetUrl={targetUrl} setTargetUrl={setTargetUrl}
        status={status} scanId={scanId}
        isWordpressScan={isWordpressScan} setIsWordpressScan={setIsWordpressScan}
        handleStartScan={handleStartScan} handleStopScan={handleStopScan}
        handleOpenFolder={handleOpenFolder} handleAnalyzeAI={handleAnalyzeAI}
        handleCopyLogsForAI={handleCopyLogsForAI} handleUpdateTools={handleUpdateTools}
        isAnalyzing={isAnalyzing} isUpdating={isUpdating}
      />

      {/* Tool Selection */}
      <ToolSelection
        allTools={allTools} selectedTools={selectedTools}
        setSelectedTools={setSelectedTools} status={status}
      />

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 capitalize whitespace-nowrap flex items-center space-x-2 ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {tab === 'findings' && <ShieldAlert className="w-4 h-4" />}
            <span>{tab}</span>
            {tab !== 'findings' && scannerStatus[tab as ScannerType] === 'RUNNING' && (
              <span className="ml-2 inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            )}
            {tab === 'findings' && allFindings.length > 0 && (
              <span className="ml-2 bg-red-500/20 text-red-500 text-xs px-1.5 py-0.5 rounded-full">
                {allFindings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Scanners Tab View */}
      <div className="flex-1 min-h-0 relative">
        <div className={`absolute inset-0 ${activeTab === 'findings' ? 'block z-10' : 'hidden'}`}>
          <VulnerabilityTable findings={allFindings} />
        </div>
        <div className={`absolute inset-0 bg-slate-900 p-6 overflow-y-auto ${activeTab === 'ai' ? 'block z-10' : 'hidden'}`}>
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold text-purple-400">AI Security Analyst</h2>
            {isAnalyzing ? (
              <div className="flex items-center space-x-3 text-purple-400 p-6 bg-slate-800/50 rounded-xl border border-purple-500/20">
                <Loader2 className="w-6 h-6 animate-spin shrink-0" />
                <span className="animate-pulse">{aiProgressMsg}</span>
              </div>
            ) : aiResponse ? (
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap bg-slate-800 p-6 rounded-xl text-slate-300 font-sans text-sm border border-slate-700 shadow-inner">{aiResponse}</pre>
              </div>
            ) : (
              <div className="text-slate-500">Run a scan and click "AI Analyst" to get an automated executive summary and remediation guide.</div>
            )}
          </div>
        </div>
        {tabs.filter(t => t !== 'findings' && t !== 'ai').map(tab => (
          <div key={tab} className={`absolute inset-0 transition-opacity duration-200 ${activeTab === tab ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}>
            <TerminalPane
              title={`${tab.charAt(0).toUpperCase() + tab.slice(1)} Console`}
              scanner={tab as ScannerType}
              scanId={scanId}
              status={scannerStatus[tab as ScannerType]}
              isVisible={activeTab === tab}
            />
          </div>
        ))}
      </div>

      {/* Findings Summary Area */}
      <FindingsSummary 
        nucleiFindings={nucleiFindings} 
        wapitiVulns={wapitiVulns} 
        wapitiPages={wapitiPages} 
      />

      {/* Update Tools Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center space-x-2">
                <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin text-blue-500' : 'text-slate-400'}`} />
                <span>Tools Update Progress</span>
              </h2>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex-1 overflow-y-auto font-mono text-sm space-y-1">
              {updateLogs.length === 0 && <div className="text-slate-500">Initializing update...</div>}
              {updateLogs.map((log, idx) => (
                <div key={idx} className="text-slate-300 break-words">{log}</div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {isUpdating ? 'Hide' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
