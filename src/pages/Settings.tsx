import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Save, ShieldAlert, Cpu, Network, Database, 
  Wrench, Globe, TerminalSquare, Key, Sparkles 
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
  const [aiApiKey, setAiApiKey] = useState('');
  const [wpscanApiToken, setWpscanApiToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [showToolsHub, setShowToolsHub] = useState(false);

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
        if (settings.aiApiKey) setAiApiKey(settings.aiApiKey);
        if (settings.wpscanApiToken !== undefined) setWpscanApiToken(settings.wpscanApiToken);
      });
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
        aiProvider, aiApiKey, wpscanApiToken
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
        </div>

        {/* Right Column: AI Integration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="theme-card p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Executive Analysis
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] text-xs font-medium focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                >
                  <option value="ollama">Ollama (Local / Privacy First)</option>
                  <option value="openai">OpenAI (Cloud GPT-4o)</option>
                  <option value="gemini">Google Gemini (Cloud)</option>
                  <option value="anthropic">Anthropic Claude (Cloud)</option>
                </select>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Ollama runs locally on your machine with zero external cloud telemetry.
                </p>
              </div>

              {aiProvider !== 'ollama' && (
                <InputField 
                  label="API Key" 
                  value={aiApiKey} 
                  onChange={setAiApiKey} 
                  placeholder="sk-..." 
                  icon={Key} 
                  hint="Stored locally in secure settings" 
                />
              )}
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
