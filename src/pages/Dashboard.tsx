import { useEffect } from 'react';
import { RefreshCw, X, ShieldAlert, Loader2, Sparkles, Terminal } from 'lucide-react';
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
      <div className="flex space-x-2 border-b border-[var(--border-card)] overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map(tab => {
          const isActive = activeTab === tab;
          const isRunning = tab !== 'findings' && tab !== 'ai' && scannerStatus[tab as ScannerType] === 'RUNNING';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'findings' | 'ai' | ScannerType)}
              className={`px-4 py-2 font-medium text-xs tracking-wider uppercase transition-all duration-200 border-b-2 whitespace-nowrap flex items-center space-x-2 rounded-t-lg ${
                isActive
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 font-bold shadow-[0_2px_12px_var(--accent-glow)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/50'
              }`}
            >
              {tab === 'findings' && <ShieldAlert className="w-4 h-4 text-red-400" />}
              {tab === 'ai' && <Sparkles className="w-4 h-4 text-purple-400" />}
              {tab !== 'findings' && tab !== 'ai' && <Terminal className="w-3.5 h-3.5 opacity-70" />}
              <span>{tab}</span>
              {isRunning && (
                <span className="relative flex h-2 w-2 ml-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
              {tab === 'findings' && allFindings.length > 0 && (
                <span className="ml-1.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {allFindings.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scanners Tab View */}
      <div className="flex-1 min-h-0 relative">
        <div className={`absolute inset-0 ${activeTab === 'findings' ? 'block z-10' : 'hidden'}`}>
          <VulnerabilityTable scanId={scanId} refreshTrigger={allFindings.length} />
        </div>
        <div className={`absolute inset-0 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 overflow-y-auto ${activeTab === 'ai' ? 'block z-10' : 'hidden'}`}>
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-[var(--border-card)]">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                  AI Security Analyst Engine
                </h2>
                <p className="text-xs text-[var(--text-muted)]">Automated correlation, threat intelligence analysis, and guided remediation matrix</p>
              </div>
            </div>

            {isAnalyzing ? (
              <div className="flex items-center space-x-3 text-purple-400 p-8 bg-[var(--bg-surface)] rounded-2xl border border-purple-500/30 shadow-lg">
                <Loader2 className="w-6 h-6 animate-spin shrink-0 text-purple-400" />
                <span className="animate-pulse text-sm font-medium">{aiProgressMsg}</span>
              </div>
            ) : aiResponse ? (
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap bg-[var(--bg-surface)] p-6 rounded-2xl text-[var(--text-secondary)] font-mono text-xs border border-[var(--border-card)] shadow-inner leading-relaxed">
                  {aiResponse}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-surface)]/50 border border-dashed border-[var(--border-card)]">
                <Sparkles className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">Ready for Intelligence Analysis</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                  Run a multi-tool scan and click <span className="text-[var(--accent-primary)] font-semibold">"AI Analyst"</span> in the command bar to synthesize findings into actionable triage reports.
                </p>
              </div>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[var(--border-card)] flex items-center justify-between bg-[var(--bg-surface)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center space-x-2">
                <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
                <span>Security Tools Update Pipeline</span>
              </h2>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-card)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-[var(--bg-surface)]/80 flex-1 overflow-y-auto font-mono text-xs space-y-1 scrollbar-thin">
              {updateLogs.length === 0 && <div className="text-[var(--text-muted)]">Initializing update orchestration...</div>}
              {updateLogs.map((log, idx) => (
               <div key={idx} className="text-[var(--text-secondary)] break-words leading-relaxed">{log}</div>
              ))}
            </div>

            <div className="p-4 border-t border-[var(--border-card)] bg-[var(--bg-surface)] flex justify-end">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-5 py-2 bg-[var(--bg-card)] hover:bg-[var(--border-card)] text-[var(--text-primary)] border border-[var(--border-card)] text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                {isUpdating ? 'Background Task' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Tools Modal */}
      {showDependencyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[var(--border-card)] flex items-center justify-between bg-[var(--bg-surface)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Security Engine Dependencies</span>
              </h2>
              {(!isInstallingDependencies) && (
                <button
                  onClick={() => setShowDependencyModal(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-card)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-6 bg-[var(--bg-card)] overflow-y-auto space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Some security tools required for the active scan pipeline are missing from your environment.
              </p>

              {/* Automatic Tools */}
              {dependencies.filter(d => !d.isInstalled && !d.requiresManual).length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-card)]">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Can Be Installed Automatically</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {dependencies.filter(d => !d.isInstalled && !d.requiresManual).map(d => (
                      <span key={d.name} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-mono font-medium">
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Tools */}
              {dependencies.filter(d => !d.isInstalled && d.requiresManual).length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-card)]">
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Requires Manual Installation</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {dependencies.filter(d => !d.isInstalled && d.requiresManual).map(d => (
                      <span key={d.name} className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-mono font-medium">
                        {d.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-2.5 leading-relaxed">
                    Heavy scanners such as Nmap (requires Npcap driver), ZAP (requires Java runtime), and Wapiti (requires Python pip) should be installed via their official installers or system package managers.
                  </p>
                </div>
              )}

              {/* Installation Logs */}
              {dependencyLogs.length > 0 && (
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl font-mono text-xs text-[var(--text-secondary)] h-32 overflow-y-auto border border-[var(--border-card)] space-y-1 scrollbar-thin">
                  {dependencyLogs.map((log, idx) => (
                    <div key={idx} className="break-words leading-relaxed">{log}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-card)] bg-[var(--bg-surface)] flex justify-end space-x-3">
              <button
                onClick={() => setShowDependencyModal(false)}
                disabled={isInstallingDependencies}
                className="px-5 py-2 bg-[var(--bg-card)] hover:bg-[var(--border-card)] disabled:opacity-50 text-[var(--text-primary)] border border-[var(--border-card)] rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                Skip for now
              </button>
              
              {dependencies.some(d => !d.isInstalled && !d.requiresManual) && (
                <button
                  onClick={handleInstallDependencies}
                  disabled={isInstallingDependencies}
                  className="flex items-center space-x-2 px-5 py-2 bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
                >
                  {isInstallingDependencies ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Installing Tools...</span>
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
