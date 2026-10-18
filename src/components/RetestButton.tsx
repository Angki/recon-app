import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useScanStore} from '../stores/useScanStore';
import type {Vulnerability} from '../types/vulnerability';

export default function RetestButton({scanId,finding}:{scanId:string;finding:Vulnerability}) {
  const navigate = useNavigate();
  const status = useScanStore(s => s.status);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const supported = ['sqlmap','nikto','commix'].includes(finding.scanner) && Boolean(finding._dbId);
  const prepare = async () => {
    if (['STARTING','RUNNING','STOPPING'].includes(useScanStore.getState().status)) return;
    setLoading(true); setError('');
    try {
      const draft = await window.api.prepareTestingWorkflow({kind:'retest',sourceScanId:scanId,findingId:finding._dbId});
      if (['STARTING','RUNNING','STOPPING'].includes(useScanStore.getState().status)) throw new Error('Wait for the active run to finish');
      useScanStore.getState().setTestingDraft(draft);
      navigate('/');
    } catch (e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setLoading(false);}
  };
  return <span className="inline-flex flex-col items-end gap-1">
    <button type="button" disabled={!supported || loading || ['STARTING','RUNNING','STOPPING'].includes(status)} title={supported ? 'Prepare a linked retest for review' : 'Retest supports saved SQLmap, Commix and Nikto findings'} onClick={e => {e.stopPropagation();void prepare();}} className="px-2 py-1 rounded border border-[var(--border-card)] text-xs disabled:opacity-40">{loading ? 'Preparing…' : 'Retest'}</button>
    {error && <span role="alert" className="text-xs text-red-400 max-w-64">{error}</span>}
  </span>;
}
