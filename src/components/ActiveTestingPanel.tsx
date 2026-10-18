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
  ['activePerlPath', 'Perl executable (absolute path)', 'nikto'],
  ['niktoScriptPath', 'nikto.pl (official program directory)', 'nikto'],
] as const;

export default function ActiveTestingPanel({ target, tools, value, onChange, disabled }: {
  target:string; tools:string[]; value:ActivePlan; onChange:(value:ActivePlan) => void; disabled:boolean;
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
  let parameters:string[] = [];
  let origin = '';
  try {
    const url = new URL(target.startsWith('http') ? target : `https://${target}`);
    origin = url.origin;
    parameters = [...new Set(url.searchParams.keys())];
  } catch { /* URL input may be incomplete */ }
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
      <summary className="font-semibold cursor-pointer">Active Testing — SQLmap / Commix / Nikto</summary>
      <div className="max-h-64 overflow-y-auto space-y-3 pt-2">
        <p className="text-xs text-[var(--text-secondary)]">SQLmap and Commix validate selected GET parameters. Commix probes command execution with proof markers. Nikto checks server issues. Use an origin covered by your assessment scope. Install Python tools from Tools Hub; findings require analyst review.</p>
        <fieldset disabled={disabled || saving} className="space-y-3 disabled:opacity-60">
          <label className="block text-xs">Assessment origin (scheme, host, port)
            <input aria-label="Assessment origin" className={fieldClass} placeholder={origin || 'https://your-lab.example'} value={value.scopeOrigin} onChange={e => onChange({...value,scopeOrigin:e.target.value})}/>
          </label>
          {tools.some(tool => ['sqlmap','commix'].includes(tool)) && <div className="text-xs space-y-2">
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
