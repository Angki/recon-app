import { useEffect, useState } from 'react';

export interface ActivePlan {
  scopeOrigin: string;
  parameters: string[];
  timeoutMinutes: number;
  delaySeconds: number;
}
const runtimeFields = [
  ['activePythonPath', 'Python executable (absolute path)', 'sqlmap'],
  ['sqlmapScriptPath', 'sqlmap.py (official source checkout)', 'sqlmap'],
  ['commixScriptPath', 'commix.py (official source checkout)', 'commix'],
  ['sstimapScriptPath', 'sstimap.py (official source checkout)', 'sstimap'],
  ['jwtToolScriptPath', 'jwt_tool.py (official source checkout)', 'jwt_tool'],
  ['activePerlPath', 'Perl executable (absolute path)', 'nikto'],
  ['niktoScriptPath', 'nikto.pl (official program directory)', 'nikto'],
] as const;

import type { EndpointRecord } from '../types/workflow';

export default function ActiveTestingPanel({ target, tools, value, onChange, disabled, discoveredEndpoints, onSelectEndpoint, discoveredJwt }: {
  target:string; tools:string[]; value:ActivePlan; onChange:(value:ActivePlan) => void; disabled:boolean;
  discoveredEndpoints?: EndpointRecord[]; onSelectEndpoint?: (url: string, params: string[]) => void; discoveredJwt?: string | null;
}) {
  const [paths, setPaths] = useState<Record<string,string>>({});
  const niktoRuntime = paths.niktoRuntime === 'perl' ? 'perl' : 'docker';
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let mounted = true;
    window.api?.getSettings().then(settings => {
      if (mounted) setPaths({...Object.fromEntries(runtimeFields.map(([key]) => [key, String(settings[key] || '')])),niktoRuntime:String(settings.niktoRuntime || 'docker'),activeDockerPath:String(settings.activeDockerPath || ''),niktoDockerImage:String(settings.niktoDockerImage || '')});
    }).catch(() => { if (mounted) setMessage('Could not load runtime settings.'); });
    return () => { mounted = false; };
  }, []);
  let parameters: string[] = [];
  let origin = '';
  try {
    const url = new URL(target.startsWith('http') ? target : `https://${target}`);
    origin = url.origin;
    const foundParams: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (!foundParams.includes(key)) foundParams.push(key);
    });
    parameters = foundParams;
  } catch { /* URL input may be incomplete */ }

  useEffect(() => {
    if (origin && !value.scopeOrigin) {
      onChange({
        ...value,
        scopeOrigin: origin,
        parameters: value.parameters.length === 0 ? parameters : value.parameters,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);
  const fieldClass = 'w-full rounded border border-[var(--border-card)] bg-[var(--bg-surface)] p-2 text-sm';
  const save = async () => {
    setSaving(true);
    try {
      await window.api.saveSettings(paths);
      setMessage('Paths saved. Check runtime status in Tools Hub; Start Scan validates paths again.');
    } catch (error) { setMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setSaving(false); }
  };
  return <section aria-label="Active Testing plan" className="theme-card rounded-xl p-3 shrink-0 border border-orange-400/30">
    <details open>
      <summary className="font-semibold cursor-pointer">Active Testing — SQLmap / Commix / SSTImap / jwt_tool / Nikto</summary>
      <div className="max-h-64 overflow-y-auto space-y-3 pt-2">
        <p className="text-xs text-[var(--text-secondary)]">SQLmap, Commix, and SSTImap validate selected GET parameters. Commix probes command execution with proof markers. SSTImap verifies template injection with arithmetic proofs. jwt_tool inspects tokens with secret redaction. Nikto checks server issues. Use an origin covered by your assessment scope. Findings require analyst review.</p>
        <fieldset disabled={disabled || saving} className="space-y-3 disabled:opacity-60">
          <label className="block text-xs">Assessment origin (scheme, host, port)
            <input aria-label="Assessment origin" className={fieldClass} placeholder={origin || 'https://your-lab.example'} value={value.scopeOrigin} onChange={e => onChange({...value,scopeOrigin:e.target.value})}/>
          </label>
          {discoveredEndpoints && discoveredEndpoints.length > 0 && (
            <div className="rounded-lg p-2.5 bg-cyan-950/30 border border-cyan-500/30 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-cyan-300 font-semibold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  URL Berparameter Ditemukan ({discoveredEndpoints.length})
                </span>
                <span className="text-[10px] text-cyan-400/80 font-mono">Klik untuk auto-fill</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                {discoveredEndpoints.slice(0, 10).map((ep, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (onSelectEndpoint) {
                        onSelectEndpoint(ep.url, ep.parameters);
                      } else {
                        onChange({
                          ...value,
                          scopeOrigin: new URL(ep.url).origin,
                          parameters: ep.parameters
                        });
                      }
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-200 border border-cyan-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Pilih ${ep.url} (Params: ${ep.parameters.join(', ')})`}
                  >
                    <span className="font-bold text-amber-300">{ep.method}</span>
                    <span className="truncate max-w-[180px]">{new URL(ep.url).pathname}</span>
                    <span className="text-cyan-300 font-semibold">({ep.parameters.join(', ')})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {tools.includes('jwt_tool') && (
            <label className="block text-xs">JWT Token (Auto-detected or custom Bearer token)
              <input
                aria-label="Target JWT token"
                className={fieldClass}
                placeholder={discoveredJwt || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'}
                value={paths.jwtToken || ''}
                onChange={e => setPaths({...paths, jwtToken: e.target.value})}
              />
            </label>
          )}
          {tools.some(tool => ['sqlmap','commix','sstimap'].includes(tool)) && <div className="text-xs space-y-2">
            <p>Query parameters {parameters.length === 0 && '— add a query string to the target URL first.'}</p>
            <div className="flex flex-wrap gap-3">{parameters.map(parameter => <label key={parameter} className="flex gap-2 items-center">
              <input type="checkbox" checked={value.parameters.includes(parameter)} onChange={e => onChange({...value,parameters:e.target.checked ? [...value.parameters,parameter] : value.parameters.filter(p => p !== parameter)})}/>{parameter}
            </label>)}</div>
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">Deadline per tool (minutes)<input className={fieldClass} type="number" min={1} max={30} value={value.timeoutMinutes} onChange={e => onChange({...value,timeoutMinutes:Number(e.target.value)})}/></label>
            <label className="text-xs">Request delay (seconds)<input className={fieldClass} type="number" min={1} max={10} value={value.delaySeconds} onChange={e => onChange({...value,delaySeconds:Number(e.target.value)})}/></label>
          </div>
          <details><summary className="cursor-pointer text-sm">Runtime setup — configure and save before first scan</summary>
            <div className="space-y-2 pt-2">
              {tools.includes('nikto') && <label className="block text-xs">Nikto runtime<select className={fieldClass} value={niktoRuntime} onChange={e=>setPaths({...paths,niktoRuntime:e.target.value})}><option value="docker">Docker (recommended)</option><option value="perl">Local Perl script</option></select></label>}
              {tools.includes('nikto') && niktoRuntime === 'docker' && <>
                <label className="block text-xs">Docker executable (absolute path)<input className={fieldClass} value={paths.activeDockerPath || ''} onChange={e=>setPaths({...paths,activeDockerPath:e.target.value})}/></label>
                <label className="block text-xs">Pinned official Nikto image digest<input className={fieldClass} value={paths.niktoDockerImage || ''} onChange={e=>setPaths({...paths,niktoDockerImage:e.target.value})}/></label>
              </>}
              {runtimeFields.filter(([key, , tool]) => (tools.includes(tool) || (key === 'activePythonPath' && tools.includes('commix'))) && (tool !== 'nikto' || niktoRuntime === 'perl')).map(([key,label]) => <label key={key} className="block text-xs">{label}<input className={fieldClass} value={paths[key] || ''} onChange={e => setPaths({...paths,[key]:e.target.value})}/></label>)}
              <button type="button" onClick={save} className="rounded bg-orange-500/20 px-3 py-2 text-sm">{saving ? 'Saving…' : 'Save runtime paths'}</button>
            </div>
          </details>
        </fieldset>
        <p role="status" className="text-xs">{message}</p>
      </div>
    </details>
  </section>;
}
