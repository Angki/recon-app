import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useScanStore} from '../stores/useScanStore';
import type {EndpointRecord,WorkflowRun} from '../types/workflow';
import VulnerabilityTable from '../components/VulnerabilityTable';

export default function Endpoints() {
  const navigate = useNavigate();
  const activeScan = useScanStore(s => s.scanId);
  const status = useScanStore(s => s.status);
  const [scans,setScans] = useState<{scanId:string;target:string;status:string;startTime?:string}[]>([]);
  const [scanId,setScanId] = useState(activeScan || '');
  const [search,setSearch] = useState('');
  const [page,setPage] = useState(1);
  const [items,setItems] = useState<EndpointRecord[]>([]);
  const [total,setTotal] = useState(0);
  const [runs,setRuns] = useState<WorkflowRun[]>([]);
  const [error,setError] = useState('');
  const [refresh,setRefresh] = useState(0);
  const [loading,setLoading] = useState(false);
  const [preparing,setPreparing] = useState(false);
  const [showFindings,setShowFindings] = useState(false);
  const busy = preparing || ['STARTING','RUNNING','STOPPING'].includes(status);
  useEffect(() => {
    let alive = true;
    window.api.getHistory().then(history => {
      if (!alive) return;
      setScans(history);
      setScanId(current => current || history[0]?.scanId || '');
    }).catch(e => {if (alive) setError(String(e));});
    return () => {alive=false;};
  },[refresh]);
  useEffect(() => {
    if (!scanId) return;
    let alive=true;
    const timer=setTimeout(() => {
      setLoading(true); setError('');
      Promise.all([window.api.getEndpoints(scanId,{page,search}),window.api.getWorkflowRuns(scanId)]).then(([inventory,links]) => {
        if (alive) {setItems(inventory.items);setTotal(inventory.total);setRuns(links);}
      }).catch(e => {if(alive) setError(String(e));}).finally(()=>{if(alive) setLoading(false);});
    },150);
    return () => {alive=false;clearTimeout(timer);};
  },[scanId,page,search,refresh]);
  useEffect(() => window.api.onScanStatus((_event,data) => {if (data.scanId === scanId || runs.some(run => run.scanId === data.scanId)) setRefresh(value=>value+1);}),[scanId,runs]);
  const prepare = async (endpoint:EndpointRecord,tool:'sqlmap'|'nikto'|'commix'|'sstimap'|'jwt_tool') => {
    if (busy) return;
    setPreparing(true);setError('');
    try {
      const draft=await window.api.prepareTestingWorkflow({kind:'endpoint',sourceScanId:scanId,endpointId:endpoint.id},tool);
      if (['STARTING','RUNNING','STOPPING'].includes(useScanStore.getState().status)) throw new Error('Wait for the active run to finish');
      useScanStore.getState().setTestingDraft(draft);
      navigate('/');
    } catch(e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setPreparing(false);}
  };
  return <div className="space-y-4 select-text">
    <div className="flex items-center justify-between"><h1 className="text-xl font-bold">Endpoint Inventory</h1><button className="rounded border p-2 text-sm" onClick={()=>setRefresh(n=>n+1)}>Refresh inventory</button></div>
    <p className="text-sm text-[var(--text-secondary)]">Review endpoints from new Katana, GAU and Arjun runs. Discovery observations are separate from vulnerabilities. GAU URLs are historical; GET is inferred. Scope here is the source scan's exact origin.</p>
    <label className="block text-sm">Source scan<select aria-label="Source scan" value={scanId} onChange={e=>{setScanId(e.target.value);setPage(1);setItems([]);setRuns([]);setTotal(0);}} className="w-full p-2 mt-1 rounded bg-[var(--bg-card)] border border-[var(--border-card)]"><option value="">Select a scan</option>{scans.map(scan=><option key={scan.scanId} value={scan.scanId}>{scan.startTime || scan.scanId} · {scan.target} · {scan.status}</option>)}</select></label>
    <input aria-label="Search endpoints" placeholder="Filter endpoint URL…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="w-full rounded p-2 border border-[var(--border-card)] bg-[var(--bg-card)]"/>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {loading && <p role="status">Loading inventory…</p>}
    <div className="overflow-auto rounded-xl border border-[var(--border-card)]">
      <table className="w-full text-sm text-left"><thead className="bg-[var(--bg-card)]"><tr>{['Method / Scope','Endpoint / Parameters','Sources','Prepare test'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
        {items.map(item=><tr key={item.id} className="border-t border-[var(--border-card)]"><td className="p-3">{item.method}<div className={item.inScope?'text-emerald-400':'text-amber-400'}>{item.inScope?'Same origin':'Out of scope'}</div></td><td className="p-3 break-all max-w-xl"><span>{item.url}</span><div className="text-[var(--text-secondary)]">Parameters: {item.parameters.join(', ') || 'none'}</div></td><td className="p-3">{item.sources.join(', ')}</td><td className="p-3"><div className="flex flex-wrap gap-2">{(['sqlmap','commix','sstimap','jwt_tool','nikto'] as const).map(tool=><button key={tool} disabled={busy || !item.inScope || item.method!=='GET' || (!['nikto','jwt_tool'].includes(tool) && !item.parameters.length)} onClick={()=>void prepare(item,tool)} className="border rounded px-2 py-1 disabled:opacity-40 text-xs" title={tool==='nikto'?'Checks the whole origin':tool==='jwt_tool'?'Test JWT authorization':'Choose parameters and review before launch'}>{tool==='sqlmap'?'Test SQLi':tool==='commix'?'Test CMD':tool==='sstimap'?'Test SSTI':tool==='jwt_tool'?'Test JWT':'Test server'}</button>)}</div></td></tr>)}
      </tbody></table>
      {!items.length && !loading && <p className="p-5 text-sm">No endpoints in this view. Run Katana, GAU or Arjun to populate inventory. Older scan artifacts are not imported automatically.</p>}
    </div>
    <div className="flex gap-3 items-center text-sm"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{total} endpoints · Page {page}</span><button disabled={page*50>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div>
    <section className="theme-card rounded-xl p-4 space-y-2"><h2 className="font-semibold">Linked tests & retests</h2><p className="text-xs">Latest 100 runs. “Not observed” is not a fixed verdict; review coverage and runtime changes.</p>{runs.length ? runs.map(run=><div key={run.scanId} className="border-t border-[var(--border-card)] py-2 text-sm"><span>{run.kind} · {run.status} · <strong>{run.verdict}</strong></span><div className="text-xs break-all">{run.scanId} — {run.target}</div><button className="underline text-xs" onClick={()=>{setScanId(run.scanId);setPage(1);setItems([]);setRuns([]);setTotal(0);setShowFindings(true);}}>View this run's findings</button></div>):<p className="text-sm">No linked runs yet.</p>}</section>
    {scanId && <details open={showFindings} onToggle={e=>setShowFindings(e.currentTarget.open)}><summary className="cursor-pointer font-semibold">Findings from selected scan — open to retest</summary><div className="h-[500px] mt-3"><VulnerabilityTable key={scanId} scanId={scanId} refreshTrigger={refresh}/></div></details>}
  </div>;
}
