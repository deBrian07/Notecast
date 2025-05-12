import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
export default function Sidebar(){
  const [docs,setDocs]=useState([]);
  const api=axios.create({ baseURL:'https://api.infinia.chat', headers:{ Authorization:`Bearer ${localStorage.getItem('token')}` }});
  useEffect(()=>{ api.get('/documents').then(r=>setDocs(r.data)); },[]);
  return(
    <aside className="h-full overflow-y-auto p-4 bg-gray-50">
      <Button size="sm" className="w-full mb-4" onClick={()=>document.getElementById('fileInput').click()}>Upload PDF</Button>
      <input type="file" id="fileInput" accept=".pdf,.docx" hidden onChange={async e=>{
        const file=e.target.files[0]; if(!file) return;
        const form=new FormData(); form.append('file',file);
        await api.post('/documents/upload',form);
        setDocs((await api.get('/documents')).data);
      }}/>
      <ul className="space-y-2">
        {docs.map(d=>(
          <li key={d.id} className="text-sm truncate cursor-pointer hover:underline" onClick={()=>window.dispatchEvent(new CustomEvent('select-doc',{detail:d}))}>{d.orig_filename}</li>
        ))}
      </ul>
    </aside>
  );
}