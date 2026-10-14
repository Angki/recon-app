import { useEffect } from 'react';
import { RefreshCw, X, ShieldAlert, Loader2 } from 'lucide-react';
import TerminalPane from '../components/TerminalPane';
import VulnerabilityTable from '../components/VulnerabilityTable';
import ScannerControls from '../components/ScannerControls';
import ToolSelection from '../components/ToolSelection';
import FindingsSummary from '../components/FindingsSummary';
import type { Vulnerability } from '../types/vulnerability';
import { useScanStore } from '../stores/useScanStore';
import type { ScannerType, ScannerStatus } from '../stores/useScanStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useLogStore } from '../stores/useLogStore';

export default function Dashboard({ onOpenToolsHub }: { onOpenToolsHub?: () => void } = {}) {
  const {
    targetUrl, setTargetUrl,
    scanId, setScanId,
    activeTab, setActiveTab,
    isWordpressScan, setIsWordpressScan,
    selectedTools, setSelectedTools,
    status, setStatus,
    scannerStatus, setScannerStatus,
    allFindings, setAllFindings,
    nucleiFindings, setNucleiFindings,
    wapitiVulns, setWapitiVulns,
    wapitiPages, setWapitiPages,
  } = useScanStore();

  const {
    dependencies, setDependencies,
    showDependencyModal, setShowDependencyModal,
    isInstallingDependencies, setIsInstallingDependencies,
    dependencyLogs, setDependencyLogs,
    isUpdating, setIsUpdating,
    updateLogs, setUpdateLogs,
    showUpdateModal, setShowUpdateModal,
  } = useConfigStore();

  const {
    appendRawLogs, clearRawLogs,
    aiResponse, setAiResponse,
    isAnalyzing, setIsAnalyzing,
    aiProgressMsg, setAiProgressMsg,
  } = useLogStore();

  const allToolsArray = ['nuclei', 'wapiti', 'wpscan', 'subfinder', 'alterx', 'dnsx', 'naabu', 'tlsx', 'httpx', 'nmap', 'zap', 'katana', 'ffuf', 'appscan', 'netsparker', 'acunetix'];
  const tabs = ['findings', 'ai', 'nuclei', 'wapiti', 'wpscan', 'pdiscovery', 'nmap', 'zap', 'ffuf', 'appscan', 'netsparker', 'acunetix'];

  // Scan output and stats listeners
  useEffect(() => {
    if (!scanId || !window.api) return;

    const handleOutput = (_event: unknown, data: { scanId: string; scanner: string; type: string; message: string }) => {
      if (data.scanId !== scanId) return;
      useLogStore.getState().appendRawLogs(`[${data.scanner.toUpperCase()}] ${data.message}\n`);
    };

    const handleStats = (_event: unknown, data: { scanId: string; stats: { nuclei: Record<string, number>, wapiti: { vulns: number, pages: number } } }) => {
      if (data.scanId !== scanId) return;
      useScanStore.getState().setNucleiFindings(data.stats.nuclei as any);
      useScanStore.getState().setWapitiVulns(data.stats.wapiti.vulns);
      useScanStore.getState().setWapitiPages(data.stats.wapiti.pages);
    };

    const removeOutputListener = window.api.onScanOutput(handleOutput);
    const removeStatsListener = window.api.onScanStats(handleStats);
    const removeAiProgress = window.api.onAiProgress((_e, msg) => useLogStore.getState().setAiProgressMsg(msg));
    
    return () => {
      removeOutputListener();
      removeStatsListener();
      removeAiProgress();
    };
  }, [scanId]);

  // Scan status listener
  useEffect(() => {
    if (!scanId || !window.api) return;

    const handleStatus = (_event: unknown, data: { scanId: string; scanner: string; status: string }) => {
      if (data.scanId !== scanId) return;
      const scanner = data.scanner as ScannerType;

      useScanStore.getState().setScannerStatus(prev => {
        const next = { ...prev, [scanner]: data.status };
        // Aggregate pdiscovery status
        const pdTools = ['subfinder', 'httpx', 'alterx', 'dnsx', 'naabu', 'tlsx', 'katana'];
        if (pdTools.includes(scanner)) {
          const pdStatuses = pdTools.map(t => next[t as ScannerType] || 'IDLE');
          if (pdStatuses.some(s => s === 'FAILED')) next.pdiscovery = 'FAILED';
          else if (pdStatuses.some(s => s === 'RUNNING')) next.pdiscovery = 'RUNNING';
          else if (pdStatuses.every(s => ['COMPLETED', 'IDLE', 'STOPPED'].includes(s))) next.pdiscovery = 'COMPLETED';
        }
        
        // Check if all requested tools are done
        const terminal = ['COMPLETED', 'FAILED', 'STOPPED', 'IDLE'];
        const allDone = Object.values(next).every(s => terminal.includes(s as string));
        const anyFailed = Object.values(next).some(s => s === 'FAILED');

        const currentStatus = useScanStore.getState().status;
        if (allDone && currentStatus !== 'IDLE') {
          useScanStore.getState().setStatus(anyFailed ? 'FAILED' : 'COMPLETED');
        }

        return next;
      });
    };

    const handleFindings = (_event: unknown, data: { scanId: string; scanner: string; findings: Vulnerability[] }) => {
      if (data.scanId !== scanId) return;
      useScanStore.getState().setAllFindings(prev => [...prev, ...data.findings]);
    };

    const removeStatusListener = window.api.onScanStatus(handleStatus);
    const removeFindingsListener = window.api.onScanFindings(handleFindings);

    return () => {
      removeStatusListener();
      removeFindingsListener();
    };
  }, [scanId]);

  // Updater listeners
  useEffect(() => {
    if (!window.api) return;

    const handleUpdateOutput = (_event: unknown, msg: string) => {
      useConfigStore.getState().setUpdateLogs(prev => [...prev, msg]);
    };

    const handleUpdateStatus = (_event: unknown, newStatus: string) => {
      if (newStatus === 'DONE' || newStatus === 'ERROR') {
        useConfigStore.getState().setIsUpdating(false);
      }
    };

    const removeOutput = window.api.onUpdateOutput(handleUpdateOutput);
    const removeStatus = window.api.onUpdateStatus(handleUpdateStatus);

    return () => {
      removeOutput();
      removeStatus();
    };
  }, []);

  // Dependency checkers
  useEffect(() => {
    if (!window.api) return;
    
    // Initial check
    window.api.checkDependencies().then(deps => {
      useConfigStore.getState().setDependencies(deps);
      const missing = deps.filter(d => !d.isInstalled);
      if (missing.length > 0) {
        useConfigStore.getState().setShowDependencyModal(true);
      }
    });

    // Listen to progress
    const removeInstallProgress = window.api.onInstallProgress((_e, msg) => {
      useConfigStore.getState().setDependencyLogs(prev => [...prev, msg]);
    });

    return () => {
      removeInstallProgress();
    };
  }, []);

  const handleInstallDependencies = async () => {
    setIsInstallingDependencies(true);
    setDependencyLogs([]);
    try {
      await window.api.installDependencies();
      // Re-check
      const deps = await window.api.checkDependencies();
      setDependencies(deps);
      // Wait for 1.5s to show completion before possibly allowing close
      setTimeout(() => {
        setIsInstallingDependencies(false);
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDependencyLogs(prev => [...prev, `Error: ${errorMessage}`]);
      setIsInstallingDependencies(false);
    }
  };

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
    clearRawLogs();
    appendRawLogs(`Scan started against ${finalUrl} at ${new Date().toISOString()}\n\n`);

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
        setScanId(res.scanId || null);
        setStatus('RUNNING');
      } else {
        alert('Failed to start scan: ' + res.error);
        setStatus('FAILED');
        setScannerStatus({
          nuclei: 'IDLE', wapiti: 'IDLE', subfinder: 'IDLE', alterx: 'IDLE', dnsx: 'IDLE', naabu: 'IDLE',
          tlsx: 'IDLE', httpx: 'IDLE', nmap: 'IDLE', zap: 'IDLE', katana: 'IDLE', ffuf: 'IDLE',
          appscan: 'IDLE', netsparker: 'IDLE', acunetix: 'IDLE', wpscan: 'IDLE', pdiscovery: 'IDLE',
        });
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert('Error: ' + errorMessage);
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
    const logs = useLogStore.getState().rawLogs;
    if (!logs) {
      alert('No logs available yet.');
      return;
    }
    const contextText = `# SecOps Recon Scan Logs\n\nTarget: ${targetUrl}\nStatus: ${status}\n\n## Terminal Output\n\`\`\`\n${logs}\n\`\`\`\n`;
    navigator.clipboard.writeText(contextText);
    alert('Full scan logs copied! You can now paste this to your AI agent.');
  };

  const handleAnalyzeAI = async () => {
    const logs = useLogStore.getState().rawLogs;
    if (!logs) {
      alert('No logs available to analyze.');
      return;
    }
    setActiveTab('ai');
    setIsAnalyzing(true);
    setAiResponse('');
    setAiProgressMsg('Analyzing logs with AI... This might take a minute depending on the log size.');

    try {
      const prompt = `You are a cybersecurity expert. Analyze these automated scan logs for ${targetUrl}. Summarize the vulnerabilities, state the most critical risks, and suggest remediation steps. Provide a clear, actionable executive summary.`;
      const response = await window.api.analyzeLogs(logs, prompt);
      setAiResponse(response);
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Is Ollama running?')) {
        msg = `Could not connect to Ollama. Please ensure the Ollama app is running locally, or change the AI Provider in Settings.\n\nTechnical details: ${(err as Error).message}`;
      } else {
        msg = `Error during AI Analysis:\n\n${(err as Error).message}\n\nPlease check your configuration in Settings.`;
      }
      setAiResponse(`[ERROR]\n${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateTools = async () => {
    if (onOpenToolsHub) {
      onOpenToolsHub();
      return;
    }
    setIsUpdating(true);
    setUpdateLogs([]);
    setShowUpdateModal(true);
    try {
      await window.api.updateTools();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setUpdateLogs(prev => [...prev, `Error: ${errorMessage}`]);
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
        allTools={allToolsArray} selectedTools={selectedTools}
        setSelectedTools={setSelectedTools} status={status}
      />

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'findings' | 'ai' | ScannerType)}
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
          <VulnerabilityTable scanId={scanId} refreshTrigger={allFindings.length} />
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

      {/* Dependency Tools Modal */}
      {showDependencyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <span>Missing Dependencies</span>
              </h2>
              {(!isInstallingDependencies) && (
                <button
                  onClick={() => setShowDependencyModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 bg-slate-900 overflow-y-auto">
              <p className="text-slate-300 mb-4">
                Some security tools required for the scan are missing.
              </p>

              {/* Automatic Tools */}
              {dependencies.filter(d => !d.isInstalled && !d.requiresManual).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">Can be installed automatically</h3>
                  <div className="flex flex-wrap gap-2">
                    {dependencies.filter(d => !d.isInstalled && !d.requiresManual).map(d => (
                      <span key={d.name} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-sm">
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Tools */}
              {dependencies.filter(d => !d.isInstalled && d.requiresManual).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">Requires manual installation</h3>
                  <div className="flex flex-wrap gap-2">
                    {dependencies.filter(d => !d.isInstalled && d.requiresManual).map(d => (
                      <span key={d.name} className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-sm">
                        {d.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Tools like Nmap (requires Npcap), ZAP (requires Java), and Wapiti (requires Python) must be installed manually.
                  </p>
                </div>
              )}

              {/* Installation Logs */}
              {dependencyLogs.length > 0 && (
                <div className="mt-4 bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 h-32 overflow-y-auto border border-slate-800 space-y-1">
                  {dependencyLogs.map((log, idx) => (
                    <div key={idx} className="break-words">{log}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end space-x-3">
              <button
                onClick={() => setShowDependencyModal(false)}
                disabled={isInstallingDependencies}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Skip for now
              </button>
              
              {dependencies.some(d => !d.isInstalled && !d.requiresManual) && (
                <button
                  onClick={handleInstallDependencies}
                  disabled={isInstallingDependencies}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                  {isInstallingDependencies ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Installing...</span>
                    </>
                  ) : (
                    <span>Install Automatic Tools</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
