import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Save, ShieldAlert, Cpu, Network, Database, 
  Wrench, Globe, TerminalSquare, Key, Sparkles, RefreshCw, CheckCircle2, XCircle, Activity, Bot, Box
} from 'lucide-react';
import { ToolsHubModal } from '../components/ToolsHubModal';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  icon?: React.ElementType;
}

const InputField = ({ label, value, onChange, placeholder, hint, icon: Icon }: InputFieldProps) => (
  <div className="flex flex-col space-y-1.5">
    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
      {label}
    </label>
    <input 
      type="text" 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] font-mono text-xs transition-all placeholder:[var(--text-muted)] shadow-inner"
    />
    {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
  </div>
);

export default function SettingsPage() {
  const [nucleiPath, setNucleiPath] = useState('nuclei');
  const [nucleiTemplatesPath, setNucleiTemplatesPath] = useState('');
  const [wapitiPath, setWapitiPath] = useState('wapiti');
  const [subfinderPath, setSubfinderPath] = useState('subfinder');
  const [httpxPath, setHttpxPath] = useState('httpx');
  const [nmapPath, setNmapPath] = useState('nmap');
  const [zapPath, setZapPath] = useState('zap.bat');
  const [katanaPath, setKatanaPath] = useState('katana');
  const [ffufPath, setFfufPath] = useState('ffuf');
  const [naabuPath, setNaabuPath] = useState('naabu');
  const [dnsxPath, setDnsxPath] = useState('dnsx');
  const [tlsxPath, setTlsxPath] = useState('tlsx');
  const [alterxPath, setAlterxPath] = useState('alterx');
  const [appscanPath, setAppscanPath] = useState('C:\\Program Files (x86)\\HCL\\AppScan Standard\\AppScanCMD.exe');
  const [netsparkerPath, setNetsparkerPath] = useState('C:\\Program Files (x86)\\Invicti Professional Edition\\Netsparker.exe');
  const [acunetixUrl, setAcunetixUrl] = useState('https://127.0.0.1:13443');
  const [acunetixApiKey, setAcunetixApiKey] = useState('');
  const [acunetixEmail, setAcunetixEmail] = useState('admin@admin.com');
  const [acunetixPassword, setAcunetixPassword] = useState('');
  const [acunetixProfileId, setAcunetixProfileId] = useState('11111111-1111-1111-1111-111111111111');
  const [wordlistPath, setWordlistPath] = useState('');
  const [aiProvider, setAiProvider] = useState('ollama');
  const [aiBaseUrl, setAiBaseUrl] = useState('http://127.0.0.1:11434');
  const [aiModel, setAiModel] = useState('qwen2.5:7b');
  const [aiPolicy, setAiPolicy] = useState<'local-only' | 'hybrid' | 'cloud-allowed'>('local-only');
  const [aiUseStructuredFindings, setAiUseStructuredFindings] = useState(true);
  const [aiApiKey, setAiApiKey] = useState('');
  const [wpscanApiToken, setWpscanApiToken] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success?: boolean; message?: string; latencyMs?: number; modelCount?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showToolsHub, setShowToolsHub] = useState(false);
  const [dockerStatus, setDockerStatus] = useState<{ installed: boolean; running: boolean; version?: string; desktopExecutable?: string } | null>(null);
  const [startingDocker, setStartingDocker] = useState(false);

  const fetchOllamaModels = async (baseUrl?: string) => {
    if (!window.api?.getOllamaModels) return;
    setLoadingModels(true);
    try {
      const res = await window.api.getOllamaModels(baseUrl || aiBaseUrl);
      if (res.success && res.models && res.models.length > 0) {
        setAvailableModels(res.models);
      }
    } catch {
      // ignore
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    if (!window.api?.testAiConnection) return;
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await window.api.testAiConnection(aiProvider, aiBaseUrl);
      setConnectionStatus(res);
      if (res.success && aiProvider === 'ollama') {
        fetchOllamaModels(aiBaseUrl);
      }
    } catch (e: any) {
      setConnectionStatus({ success: false, message: e.message || 'Connection failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const checkDocker = async () => {
    if (!window.api?.getDockerStatus) return;
    try {
      const res = await window.api.getDockerStatus();
      setDockerStatus(res);
    } catch {
      // ignore
    }
  };

  const handleStartDocker = async () => {
    if (!window.api?.startDocker) return;
    setStartingDocker(true);
    try {
      await window.api.startDocker();
      await checkDocker();
    } finally {
      setStartingDocker(false);
    }
  };

  useEffect(() => {
    if (window.api) {
      window.api.getSettings().then(settings => {
        if (settings.nucleiPath) setNucleiPath(settings.nucleiPath);
        if (settings.nucleiTemplatesPath) setNucleiTemplatesPath(settings.nucleiTemplatesPath);
        if (settings.wapitiPath) setWapitiPath(settings.wapitiPath);
        if (settings.subfinderPath) setSubfinderPath(settings.subfinderPath);
        if (settings.httpxPath) setHttpxPath(settings.httpxPath);
        if (settings.nmapPath) setNmapPath(settings.nmapPath);
        if (settings.zapPath) setZapPath(settings.zapPath);
        if (settings.katanaPath) setKatanaPath(settings.katanaPath);
        if (settings.ffufPath) setFfufPath(settings.ffufPath);
        if (settings.naabuPath) setNaabuPath(settings.naabuPath);
        if (settings.dnsxPath) setDnsxPath(settings.dnsxPath);
        if (settings.tlsxPath) setTlsxPath(settings.tlsxPath);
        if (settings.alterxPath) setAlterxPath(settings.alterxPath);
        if (settings.appscanPath) setAppscanPath(settings.appscanPath);
        if (settings.netsparkerPath) setNetsparkerPath(settings.netsparkerPath);
        if (settings.acunetixUrl) setAcunetixUrl(settings.acunetixUrl);
        if (settings.acunetixApiKey) setAcunetixApiKey(settings.acunetixApiKey);
        if (settings.acunetixEmail) setAcunetixEmail(settings.acunetixEmail);
        if (settings.acunetixPassword) setAcunetixPassword(settings.acunetixPassword);
        if (settings.acunetixProfileId) setAcunetixProfileId(settings.acunetixProfileId);
        if (settings.wordlistPath) setWordlistPath(settings.wordlistPath);
        if (settings.aiProvider) setAiProvider(settings.aiProvider);
        if (settings.aiBaseUrl) setAiBaseUrl(settings.aiBaseUrl);
        if (settings.aiModel) setAiModel(settings.aiModel);
        if (settings.aiPolicy) setAiPolicy(settings.aiPolicy);
        if (settings.aiUseStructuredFindings !== undefined) setAiUseStructuredFindings(settings.aiUseStructuredFindings);
        if (settings.aiApiKey) setAiApiKey(settings.aiApiKey);
        if (settings.wpscanApiToken !== undefined) setWpscanApiToken(settings.wpscanApiToken);

        if (settings.aiProvider === 'ollama' || !settings.aiProvider) {
          fetchOllamaModels(settings.aiBaseUrl);
        }
      });
      checkDocker();
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    if (window.api) {
      await window.api.saveSettings({ 
        nucleiPath, nucleiTemplatesPath, wapitiPath, subfinderPath, 
        httpxPath, nmapPath, zapPath, katanaPath, ffufPath, 
        naabuPath, dnsxPath, tlsxPath, alterxPath, appscanPath, netsparkerPath,
        acunetixUrl, acunetixApiKey, acunetixEmail, acunetixPassword, acunetixProfileId, wordlistPath, 
        aiProvider, aiBaseUrl, aiModel, aiPolicy, aiUseStructuredFindings, aiApiKey, wpscanApiToken
      });
    }
    setTimeout(() => setSaving(false), 500);
  };


  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-card)] pb-4 sticky top-0 bg-[var(--bg-app)]/90 backdrop-blur-md z-10 pt-2">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <div className="bg-[var(--accent-primary)]/10 p-2 rounded-xl border border-[var(--border-glow)]">
              <SettingsIcon className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            Configuration & Engines
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-xs">Manage executable paths, AI integrations, and tool behavior.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2 rounded-xl transition-all font-semibold text-xs disabled:opacity-50 shadow-md shadow-[var(--accent-glow)] cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Engines Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[var(--accent-primary)]/10 to-transparent border border-[var(--border-glow)]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/20 border border-[var(--border-glow)]">
            <Cpu className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">Automated Security Engine Management</div>
            <div className="text-xs text-[var(--text-secondary)]">Want to 1-click update or auto-download Nuclei, Wapiti, Katana, HTTPX, or Subfinder?</div>
          </div>
        </div>
        <button
          onClick={() => setShowToolsHub(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] shadow-sm transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Open Engines & Tools Hub</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Core Vulnerability Scanners
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Nuclei Binary" value={nucleiPath} onChange={setNucleiPath} placeholder="nuclei" icon={TerminalSquare} hint="Defaults to auto-downloaded AppData/bin" />
              <InputField label="Nuclei Templates" value={nucleiTemplatesPath} onChange={setNucleiTemplatesPath} placeholder="~/nuclei-templates" icon={Database} hint="Auto-updated via -update-templates" />
              <InputField label="Wapiti Binary" value={wapitiPath} onChange={setWapitiPath} placeholder="wapiti" icon={TerminalSquare} hint="Upgraded via pip" />
              <InputField label="OWASP ZAP" value={zapPath} onChange={setZapPath} placeholder="zap.bat" icon={TerminalSquare} />
              <InputField label="WPScan API Token" value={wpscanApiToken} onChange={setWpscanApiToken} placeholder="API Token (Optional)" icon={Key} hint="Optional API Token for vulnerability database" />
            </div>
          </div>

          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent-primary)]"></div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Network className="w-4 h-4 text-[var(--accent-primary)]" />
              ProjectDiscovery & Recon Suite
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Subfinder" value={subfinderPath} onChange={setSubfinderPath} placeholder="subfinder" icon={Globe} />
              <InputField label="Httpx" value={httpxPath} onChange={setHttpxPath} placeholder="httpx" icon={Globe} />
              <InputField label="Katana" value={katanaPath} onChange={setKatanaPath} placeholder="katana" icon={Globe} />
              <InputField label="Naabu" value={naabuPath} onChange={setNaabuPath} placeholder="naabu" icon={Network} />
              <InputField label="DNSx" value={dnsxPath} onChange={setDnsxPath} placeholder="dnsx" icon={Globe} />
              <InputField label="TLSx" value={tlsxPath} onChange={setTlsxPath} placeholder="tlsx" icon={Key} />
              <InputField label="Alterx" value={alterxPath} onChange={setAlterxPath} placeholder="alterx" icon={Wrench} />
              <InputField label="Nmap" value={nmapPath} onChange={setNmapPath} placeholder="nmap" icon={Cpu} />
            </div>
          </div>

          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Fuzzing & Wordlists
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <InputField label="FFUF Binary" value={ffufPath} onChange={setFfufPath} placeholder="ffuf" icon={TerminalSquare} />
              <InputField 
                label="Global Wordlist Path" 
                value={wordlistPath} 
                onChange={setWordlistPath} 
                placeholder="C:\SecLists\Discovery\Web-Content\common.txt" 
                icon={Database} 
                hint="Used as default for FFUF directory enumeration" 
              />
            </div>
          </div>

          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Commercial Desktop Integrations
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <InputField label="HCL AppScan (AppScanCMD.exe)" value={appscanPath} onChange={setAppscanPath} placeholder="C:\...\AppScanCMD.exe" icon={TerminalSquare} />
              <InputField label="Invicti Netsparker (Netsparker.exe)" value={netsparkerPath} onChange={setNetsparkerPath} placeholder="C:\...\Netsparker.exe" icon={TerminalSquare} />
              <InputField label="Acunetix Docker API URL" value={acunetixUrl} onChange={setAcunetixUrl} placeholder="https://127.0.0.1:13443" icon={Globe} hint="Default Docker mapping is 13443" />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Acunetix Email" value={acunetixEmail} onChange={setAcunetixEmail} placeholder="admin@admin.com" icon={Globe} />
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Acunetix Password
                  </label>
                  <input 
                    type="password" 
                    value={acunetixPassword} 
                    onChange={(e) => setAcunetixPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Docker & Container Engine Orchestration */}
          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${dockerStatus?.running ? 'bg-emerald-500' : 'bg-sky-500'}`}></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-400" />
                Docker Desktop & Container Engines
              </h2>
              {dockerStatus ? (
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                  dockerStatus.running
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dockerStatus.running ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  {dockerStatus.running ? `Online (v${dockerStatus.version || 'Daemon'})` : 'Offline / Stopped'}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[var(--text-muted)]">Checking...</span>
              )}
            </div>

            <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
              Required for containerized engines (<span className="text-[var(--accent-primary)] font-mono font-medium">WPScan</span>, <span className="text-[var(--accent-primary)] font-mono font-medium">Nikto Docker</span>, <span className="text-[var(--accent-primary)] font-mono font-medium">Semgrep SAST</span>, <span className="text-[var(--accent-primary)] font-mono font-medium">OSV-Scanner</span>).
              ReconApp automatically detects and launches Docker Desktop in the background when a containerized scan begins.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-card)]">
              <div className="space-y-0.5">
                <div className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                  {dockerStatus?.desktopExecutable || 'Docker Desktop (Default Path)'}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {dockerStatus?.running ? 'Docker engine is active and ready for container execution.' : 'Engine offline. You can auto-start now or let scans start it automatically.'}
                </div>
              </div>

              {!dockerStatus?.running && (
                <button
                  type="button"
                  onClick={handleStartDocker}
                  disabled={startingDocker}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${startingDocker ? 'animate-spin' : ''}`} />
                  <span>{startingDocker ? 'Starting Docker...' : 'Start Docker Desktop'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Integration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                AI Security Suite
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                {aiProvider === 'ollama' ? 'Local Engine' : 'Cloud Provider'}
              </span>
            </div>

            <div className="space-y-4">
              {/* Security Policy */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Data Privacy Policy
                </label>
                <select
                  value={aiPolicy}
                  onChange={(e) => setAiPolicy(e.target.value as any)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] text-xs font-medium focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                >
                  <option value="local-only">🛡️ Local-Only (Air-Gapped 127.0.0.1 / Blocks Remote)</option>
                  <option value="hybrid">⚖️ Hybrid (Local & Tailnet Mesh Allowed, Cloud Optional)</option>
                  <option value="cloud-allowed">🌐 Cloud Allowed</option>
                </select>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {aiPolicy === 'local-only' 
                    ? 'Guarantees scan findings never leave localhost (127.0.0.1).'
                    : 'Permits advisory queries to local endpoints, private Tailscale mesh nodes, or cloud.'}
                </p>
              </div>

              {/* Provider */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  AI Provider Engine
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setAiProvider(p);
                    setConnectionStatus(null);
                    if (p === 'ollama') fetchOllamaModels();
                  }}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] text-xs font-medium focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                >
                  <option value="ollama">Ollama (Local / Tailnet Mesh / Privacy-First)</option>
                  <option value="openai" disabled={aiPolicy === 'local-only'}>OpenAI (Cloud GPT-4o)</option>
                  <option value="gemini" disabled={aiPolicy === 'local-only'}>Google Gemini (Cloud)</option>
                  <option value="anthropic" disabled={aiPolicy === 'local-only'}>Anthropic Claude (Cloud)</option>
                </select>
              </div>

              {aiProvider === 'ollama' && (
                <>
                  <div className="space-y-2">
                    <InputField 
                      label="Ollama Base URL" 
                      value={aiBaseUrl} 
                      onChange={(val) => { setAiBaseUrl(val); setConnectionStatus(null); }} 
                      placeholder="http://127.0.0.1:11434" 
                      icon={Globe} 
                      hint="Default is http://127.0.0.1:11434 or your Tailscale node"
                    />

                    {/* Quick Endpoint Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-medium">Quick Endpoints:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const url = 'http://127.0.0.1:11434';
                          setAiBaseUrl(url);
                          setConnectionStatus(null);
                          fetchOllamaModels(url);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer flex items-center gap-1 ${
                          aiBaseUrl.includes('127.0.0.1') || aiBaseUrl.includes('localhost')
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-400 font-semibold'
                            : 'bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-glow)]'
                        }`}
                      >
                        💻 Localhost
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = 'http://100.119.195.119:11434';
                          setAiBaseUrl(url);
                          setConnectionStatus(null);
                          if (aiPolicy === 'local-only') setAiPolicy('hybrid');
                          fetchOllamaModels(url);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer flex items-center gap-1 ${
                          aiBaseUrl.includes('100.119.195.119')
                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 font-semibold shadow-sm'
                            : 'bg-[var(--bg-app)] border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-purple-500/30'
                        }`}
                      >
                        ⚡ Tailscale (DESKTOP-KHEN4R1)
                      </button>
                    </div>
                  </div>

                  {/* Model Selector with Auto-Discovery */}
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        Active Model
                      </label>
                      <button
                        type="button"
                        onClick={() => fetchOllamaModels()}
                        disabled={loadingModels}
                        className="text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                        Refresh Models
                      </button>
                    </div>

                    {availableModels.length > 0 ? (
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                      >
                        {availableModels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        placeholder="qwen2.5:7b"
                        className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    )}
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {availableModels.length > 0 
                        ? `${availableModels.length} models detected in local Ollama daemon.`
                        : 'Installed models (e.g. qwen2.5:7b, sast-qwen) or click Refresh.'}
                    </p>
                  </div>
                </>
              )}

              {aiProvider !== 'ollama' && (
                <InputField 
                  label="API Key" 
                  value={aiApiKey} 
                  onChange={setAiApiKey} 
                  placeholder="sk-..." 
                  icon={Key} 
                  hint="Stored locally in encrypted app configuration" 
                />
              )}

              {/* RAG-Lite Structured Findings Toggle */}
              <div className="pt-2 border-t border-[var(--border-card)]">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aiUseStructuredFindings}
                    onChange={(e) => setAiUseStructuredFindings(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--border-card)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] bg-[var(--bg-app)]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Structured Findings Context (RAG-lite)
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                      Synthesizes high-fidelity SQLite findings and attack surface endpoints instead of raw terminal noise.
                    </span>
                  </div>
                </label>
              </div>

              {/* Connection Diagnostics Button & Pill */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--accent-primary)]/10 text-[var(--text-primary)] border border-[var(--border-card)] hover:border-[var(--accent-primary)] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${testingConnection ? 'animate-pulse' : ''}`} />
                  {testingConnection ? 'Testing Connection...' : `Test ${aiProvider.toUpperCase()} Connection`}
                </button>

                {connectionStatus && (
                  <div className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                    connectionStatus.success 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    {connectionStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <div className="truncate">
                      <span className="font-semibold">{connectionStatus.message}</span>
                      {connectionStatus.latencyMs !== undefined && connectionStatus.latencyMs > 0 && (
                        <span className="ml-1 opacity-75">({connectionStatus.latencyMs}ms)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {showToolsHub && (
        <ToolsHubModal isOpen={showToolsHub} onClose={() => setShowToolsHub(false)} />
      )}
    </div>
  );
}
