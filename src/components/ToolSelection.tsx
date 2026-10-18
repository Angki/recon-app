import { useState, useMemo } from 'react';
import { 
  Layers, Shield, Globe, Terminal, Zap, Building2, ChevronRight, 
  KeyRound, SlidersHorizontal, Sparkles
} from 'lucide-react';

interface ToolSelectionProps {
  allTools: string[];
  selectedTools: string[];
  setSelectedTools: (tools: string[] | ((prev: string[]) => string[])) => void;
  status: string;
}

interface ToolCategory {
  id: string;
  name: string;
  icon: typeof Shield;
  color: string;
  tools: string[];
  description: string;
}

interface ScanProfilePreset {
  id: string;
  name: string;
  shortDesc: string;
  icon: string;
  tools: string[];
  badgeColor: string;
}

const TOOL_CATEGORIES: ToolCategory[] = [
  { id:'active', name:'Active Testing', icon:Shield, color:'text-orange-400', tools:['sqlmap','nikto','commix'], description:'SQL injection, command injection and server checks; configure scope and runtime below.' },
  {
    id: 'dast',
    name: 'DAST & Web Vulnerabilities',
    icon: Shield,
    color: 'text-amber-400',
    description: 'Dynamic analysis, XSS, CORS, CRLF injection, CMS audit, OWASP ZAP',
    tools: ['nuclei', 'wapiti', 'dalfox', 'corsy', 'cmseek', 'crlfsuite', 'zap']
  },
  {
    id: 'recon',
    name: 'Recon & Surface Discovery',
    icon: Globe,
    color: 'text-cyan-400',
    description: 'Subdomains, crawling, URL archive, DNS enumeration, WAF detection, TLS audit',
    tools: ['subfinder', 'httpx', 'katana', 'dnsx', 'alterx', 'tlsx', 'gau', 'whatweb', 'wafw00f', 'sslyze', 'wpscan']
  },
  {
    id: 'fuzz',
    name: 'API & Parameter Fuzzing',
    icon: Zap,
    color: 'text-purple-400',
    description: 'Directory brute-forcing, hidden HTTP parameter discovery, OpenAPI/Schemathesis fuzzing',
    tools: ['ffuf', 'arjun', 'schemathesis']
  },
  {
    id: 'secops',
    name: 'Secrets & Code Audits',
    icon: KeyRound,
    color: 'text-rose-400',
    description: 'Credential leakage in Git, SAST pattern matching, CVE vulnerability checks',
    tools: ['gitleaks', 'semgrep', 'trivy']
  },
  {
    id: 'network',
    name: 'Network & Port Audits',
    icon: Terminal,
    color: 'text-emerald-400',
    description: 'High-speed SYN port scanning, network service enumeration',
    tools: ['naabu', 'nmap']
  },
  {
    id: 'enterprise',
    name: 'Commercial Engines (Licensed)',
    icon: Building2,
    color: 'text-amber-500',
    description: 'Requires commercial software or runner installed locally',
    tools: ['appscan', 'netsparker', 'acunetix']
  }
];

const SCAN_PROFILES: ScanProfilePreset[] = [
  {
    id: 'quick-audit',
    name: 'Quick Audit',
    shortDesc: 'Rapid Web & Nuclei CVE Assessment',
    icon: '⚡',
    tools: ['httpx', 'nuclei', 'wafw00f'],
    badgeColor: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
  },
  {
    id: 'passive-recon',
    name: 'Passive Recon',
    shortDesc: 'Zero-touch OSINT Asset Discovery',
    icon: '🌐',
    tools: ['subfinder', 'gau', 'dnsx', 'tlsx'],
    badgeColor: 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10'
  },
  {
    id: 'full-dast',
    name: 'Full DAST',
    shortDesc: 'Deep Web Application Vulnerability Suite',
    icon: '🛡️',
    tools: ['httpx', 'katana', 'nuclei', 'wapiti', 'arjun', 'dalfox', 'zap', 'corsy', 'crlfsuite'],
    badgeColor: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
  },
  {
    id: 'api-fuzz',
    name: 'API Fuzzing',
    shortDesc: 'Contract Fuzzing & Parameter Discovery',
    icon: '🔌',
    tools: ['schemathesis', 'arjun', 'ffuf', 'zap'],
    badgeColor: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
  },
  {
    id: 'secrets-supplychain',
    name: 'Code & Secrets',
    shortDesc: 'Gitleaks, Semgrep SAST & Trivy Supply Chain',
    icon: '🔐',
    tools: ['gitleaks', 'semgrep', 'trivy'],
    badgeColor: 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
  },
  {
    id: 'network-infra',
    name: 'Network Infra',
    shortDesc: 'Port Enumeration & TLS Analysis',
    icon: '📡',
    tools: ['naabu', 'nmap', 'tlsx', 'sslyze'],
    badgeColor: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
  }
];

export default function ToolSelection({
  allTools, selectedTools, setSelectedTools, status
}: ToolSelectionProps) {
  const isRunning = ['STARTING', 'RUNNING', 'STOPPING'].includes(status);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const commercialList = useMemo(() => ['appscan', 'netsparker', 'acunetix'], []);
  const ossTools = useMemo(() => allTools.filter(t => !commercialList.includes(t) && !['sqlmap', 'nikto', 'commix'].includes(t)), [allTools, commercialList]);

  const activeProfileId = useMemo(() => {
    for (const p of SCAN_PROFILES) {
      if (
        p.tools.length === selectedTools.length &&
        p.tools.every(t => selectedTools.includes(t))
      ) {
        return p.id;
      }
    }
    if (selectedTools.length === ossTools.length && ossTools.every(t => selectedTools.includes(t))) {
      return 'oss-full';
    }
    return 'custom';
  }, [selectedTools, ossTools]);

  const applyProfile = (tools: string[]) => {
    if (isRunning) return;
    setSelectedTools(tools);
  };

  const toggleCategory = (categoryTools: string[]) => {
    if (isRunning) return;
    const allSelected = categoryTools.every(t => selectedTools.includes(t));
    if (allSelected) {
      setSelectedTools(prev => prev.filter(t => !categoryTools.includes(t)));
    } else {
      setSelectedTools(prev => Array.from(new Set([...prev, ...categoryTools])));
    }
  };

  const filteredCategories = activeCategory === 'all'
    ? TOOL_CATEGORIES
    : TOOL_CATEGORIES.filter(c => c.id === activeCategory);

  return (
    <div className="theme-card relative z-10 p-2.5 px-3.5 rounded-2xl flex flex-col space-y-2 shadow-md border border-[var(--border-card)] shrink-0">
      {/* Top Header & Presets */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--border-glow)]">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Engines Suite
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--border-glow)] tabular-nums">
              {selectedTools.length} / {allTools.length} Active
            </span>
          </div>
        </div>

        {/* Action Buttons & Expand Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => applyProfile(ossTools)}
            disabled={isRunning}
            className={`px-2.5 py-1 min-h-[32px] rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer disabled:opacity-40 border ${
              activeProfileId === 'oss-full'
                ? 'bg-[var(--accent-primary)] text-white border-transparent shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-emerald-400 hover:bg-emerald-500/10 border-[var(--border-card)]'
            }`}
            title="General open source suite. Select Active Testing tools separately."
          >
            OSS Full ({ossTools.length})
          </button>
          
          <button
            type="button"
            onClick={() => applyProfile(selectedTools.length > 0 ? [] : ['httpx', 'nuclei'])}
            disabled={isRunning}
            className="px-2.5 py-1 min-h-[32px] rounded-lg text-[10px] font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 border border-[var(--border-card)] transition-all cursor-pointer disabled:opacity-40"
          >
            {selectedTools.length > 0 ? 'Clear All' : 'Reset Default'}
          </button>

          <div className="h-4 w-[1px] bg-[var(--border-card)] mx-0.5" />

          <button
            type="button"
            onClick={() => setIsExpanded(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1 min-h-[32px] rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm border ${
              isExpanded 
                ? 'bg-[var(--accent-primary)] text-white border-transparent' 
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--border-glow)] border-[var(--border-card)]'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{isExpanded ? 'Done' : 'Customize'}</span>
          </button>
        </div>
      </div>

      {/* Curated Pipeline Profiles Bar (One-click presets with skill intelligence) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] shrink-0 flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
          <span>Profiles:</span>
        </span>

        {SCAN_PROFILES.map(profile => {
          const isActive = activeProfileId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => applyProfile(profile.tools)}
              disabled={isRunning}
              title={`${profile.name}: ${profile.shortDesc} (${profile.tools.join(', ')})`}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-mono transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-white font-bold border-transparent shadow-sm'
                  : `bg-[var(--bg-card)] text-[var(--text-secondary)] ${profile.badgeColor}`
              } disabled:opacity-40`}
            >
              <span>{profile.icon}</span>
              <span className="font-semibold">{profile.name}</span>
              <span className="text-[9px] opacity-75 tabular-nums">({profile.tools.length})</span>
            </button>
          );
        })}
      </div>

      {/* When Collapsed: Sleek Single-Line Scrollable Active Engine Chips */}
      {!isExpanded && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
          {selectedTools.map(tool => {
            const isCommercial = commercialList.includes(tool);
            return (
              <span
                key={tool}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg uppercase tracking-wider font-semibold border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isCommercial 
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                    : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--border-glow)]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isCommercial ? 'bg-rose-400' : 'bg-[var(--accent-primary)]'}`} />
                <span>{tool}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* When Expanded: Category Navigation & Grouped Bento Cards */}
      {isExpanded && (
        <div className="space-y-2 pt-1 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-[var(--border-card)]/50">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
              }`}
            >
              All Categories
            </button>
            {TOOL_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-card)] shadow-sm font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`}
              >
                <cat.icon className={`w-3 h-3 ${cat.color}`} />
                <span>{cat.name.split(' ')[0]}</span>
                <span className="text-[10px] opacity-60 tabular-nums">
                  ({cat.tools.filter(t => selectedTools.includes(t)).length}/{cat.tools.length})
                </span>
              </button>
            ))}
          </div>

          {/* Grouped Tool Cards Grid with max height constraint */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
            {filteredCategories.map(cat => {
              const selectedInCat = cat.tools.filter(t => selectedTools.includes(t)).length;
              const allSelectedInCat = selectedInCat === cat.tools.length;

              return (
                <div key={cat.id} className="bg-[var(--bg-surface)]/60 rounded-xl p-2.5 border border-[var(--border-card)]">
                  {/* Category Header */}
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border-card)]/40">
                    <div className="flex items-center gap-2">
                      <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                      <span className="text-xs font-bold text-[var(--text-primary)]">{cat.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">- {cat.description}</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.tools)}
                      disabled={isRunning}
                      className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <span>{allSelectedInCat ? 'Deselect All' : 'Select All'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Tools Chips in this category */}
                  <div className="flex flex-wrap gap-1.5">
                    {cat.tools.map(tool => {
                      const isSelected = selectedTools.includes(tool);
                      const isCommercial = commercialList.includes(tool);

                      return (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => {
                            if (isRunning) return;
                            if (isSelected) {
                              setSelectedTools(prev => prev.filter(t => t !== tool));
                            } else {
                              setSelectedTools(prev => [...prev, tool]);
                            }
                          }}
                          disabled={isRunning}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono uppercase tracking-wider font-semibold transition-all border cursor-pointer min-h-[32px] ${
                            isSelected
                              ? isCommercial
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm'
                                : 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--border-glow)] shadow-sm'
                              : 'bg-black/20 text-[var(--text-muted)] border-[var(--border-card)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? (isCommercial ? 'bg-rose-400' : 'bg-[var(--accent-primary)]') : 'bg-[var(--text-muted)]'}`} />
                          <span>{tool}</span>
                          {isCommercial && <span className="text-[8px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 font-sans normal-case">Licensed</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
