import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, ShieldAlert, Cpu, Network, Database, Wrench, Globe, TerminalSquare, Key, Sparkles } from 'lucide-react';

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
    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-slate-500" />}
      {label}
    </label>
    <input 
      type="text" 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-mono text-sm transition-all placeholder:text-slate-600 shadow-inner"
    />
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
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
    <div className="flex flex-col h-full max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
              <SettingsIcon className="w-5 h-5 text-blue-400" />
            </div>
            Configuration
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Manage executable paths, AI integrations, and tool behavior.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg transition-all font-medium disabled:opacity-50 shadow-lg shadow-blue-900/20"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Scanners */}
        <div className="lg:col-span-8 space-y-8">
          
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50"></div>
            <h2 className="text-lg font-semibold text-slate-200 mb-5 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Core Vulnerability Scanners
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InputField label="Nuclei Binary" value={nucleiPath} onChange={setNucleiPath} placeholder="nuclei" icon={TerminalSquare} hint="System path or relative" />
              <InputField label="Nuclei Templates" value={nucleiTemplatesPath} onChange={setNucleiTemplatesPath} placeholder="~/nuclei-templates" icon={Database} hint="Optional custom directory" />
              <InputField label="Wapiti Binary" value={wapitiPath} onChange={setWapitiPath} placeholder="wapiti" icon={TerminalSquare} />
              <InputField label="OWASP ZAP" value={zapPath} onChange={setZapPath} placeholder="zap.bat" icon={TerminalSquare} />
              <InputField label="WPScan API Token" value={wpscanApiToken} onChange={setWpscanApiToken} placeholder="API Token (Optional)" icon={Key} hint="Optional API Token for vulnerability data" />
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
            <h2 className="text-lg font-semibold text-slate-200 mb-5 flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-400" />
              ProjectDiscovery & Network Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InputField label="Subfinder" value={subfinderPath} onChange={setSubfinderPath} placeholder="subfinder" icon={Globe} />
              <InputField label="Httpx" value={httpxPath} onChange={setHttpxPath} placeholder="httpx" icon={Globe} />
              <InputField label="Katana" value={katanaPath} onChange={setKatanaPath} placeholder="katana" icon={Globe} />
              <InputField label="Nmap" value={nmapPath} onChange={setNmapPath} placeholder="nmap" icon={Cpu} />
              <InputField label="Naabu" value={naabuPath} onChange={setNaabuPath} placeholder="naabu" icon={Network} />
              <InputField label="DNSx" value={dnsxPath} onChange={setDnsxPath} placeholder="dnsx" icon={Globe} />
              <InputField label="TLSx" value={tlsxPath} onChange={setTlsxPath} placeholder="tlsx" icon={Key} />
              <InputField label="Alterx" value={alterxPath} onChange={setAlterxPath} placeholder="alterx" icon={Wrench} />
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
            <h2 className="text-lg font-semibold text-slate-200 mb-5 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Fuzzing & Wordlists
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <InputField label="FFUF Binary" value={ffufPath} onChange={setFfufPath} placeholder="ffuf" icon={TerminalSquare} />
              <InputField 
                label="Global Wordlist Path" 
                value={wordlistPath} 
                onChange={setWordlistPath} 
                placeholder="/usr/share/wordlists/dirb/common.txt" 
                icon={Database} 
                hint="Used as default for FFUF and other fuzzers" 
              />
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50"></div>
            <h2 className="text-lg font-semibold text-slate-200 mb-5 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Commercial Scanners
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <InputField label="HCL AppScan (AppScanCMD.exe)" value={appscanPath} onChange={setAppscanPath} placeholder="C:\...\AppScanCMD.exe" icon={TerminalSquare} />
              <InputField label="Invicti Netsparker (Netsparker.exe)" value={netsparkerPath} onChange={setNetsparkerPath} placeholder="C:\...\Netsparker.exe" icon={TerminalSquare} />
              <div className="border-t border-slate-700/50 pt-4 mt-2">
                <InputField label="Acunetix Docker API URL" value={acunetixUrl} onChange={setAcunetixUrl} placeholder="https://127.0.0.1:13443" icon={Globe} hint="Default Docker mapping is 13443" />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <InputField label="Acunetix Email" value={acunetixEmail} onChange={setAcunetixEmail} placeholder="admin@admin.com" icon={Globe} hint="Used for auto-login if API Key is empty" />
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Key className="w-4 h-4 text-slate-500" />
                      Acunetix Password
                    </label>
                    <input 
                      type="password" 
                      value={acunetixPassword}
                      onChange={(e) => setAcunetixPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-mono text-sm transition-all placeholder:text-slate-600 shadow-inner"
                    />
                    <p className="text-xs text-slate-500">Stored encrypted. Used for auto-login.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <InputField label="Acunetix API Key" value={acunetixApiKey} onChange={setAcunetixApiKey} placeholder="1986ad8c0a5b3df4d7028d5f3c06e936" icon={Key} hint="Generate this from the Administrator Profile in Acunetix UI (optional if Email/Password provided)" />
                </div>
                <div className="mt-4 flex flex-col space-y-1.5">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-500" />
                    Scan Profile
                  </label>
                  <select
                    value={acunetixProfileId}
                    onChange={(e) => setAcunetixProfileId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-mono text-sm transition-all shadow-inner"
                  >
                    <option value="11111111-1111-1111-1111-111111111111">Full Scan</option>
                    <option value="11111111-1111-1111-1111-111111111112">High Risk Vulnerabilities</option>
                    <option value="11111111-1111-1111-1111-111111111113">SQL Injection Vulnerabilities</option>
                    <option value="11111111-1111-1111-1111-111111111114">Weak Passwords</option>
                    <option value="11111111-1111-1111-1111-111111111115">Cross-site Scripting Vulnerabilities</option>
                    <option value="11111111-1111-1111-1111-111111111117">Crawl Only</option>
                    <option value="11111111-1111-1111-1111-111111111116">Malware Scan</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: AI & Misc */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-gradient-to-b from-slate-800 to-slate-800/50 p-6 rounded-xl border border-indigo-500/30 shadow-xl shadow-indigo-900/10">
            <h2 className="text-lg font-semibold text-indigo-300 mb-5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              AI Assistant
            </h2>
            <div className="space-y-5">
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Provider</label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono text-sm shadow-inner"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-slate-300">API Key / Model</label>
                <input 
                  type={aiProvider === 'ollama' ? 'text' : 'password'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={aiProvider === 'ollama' ? 'minimax-m3:cloud' : 'sk-...'}
                  className="bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono text-sm shadow-inner"
                />
                {aiProvider === 'ollama' ? (
                  <div className="text-xs text-slate-400 space-y-1 mt-2 bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <p>Format: <code className="text-indigo-300 bg-indigo-900/30 px-1 rounded">URL,model</code> or just <code className="text-indigo-300 bg-indigo-900/30 px-1 rounded">model</code></p>
                    <p>Examples:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                      <li><code>minimax-m3:cloud</code> (defaults to localhost:11434, fast)</li>
                      <li><code>qwen3:14b</code> (higher quality, slower)</li>
                      <li><code>http://10.0.0.5:11434,llama3</code></li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Enter your API key securely. It is stored locally.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
