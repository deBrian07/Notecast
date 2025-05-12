import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { PlayCircle, Loader2 } from 'lucide-react';

export default function Workspace(){
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState('');

  const api = axios.create({
    baseURL: 'https://api.infinia.chat',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  // Listen for "select-doc" custom event dispatched by Sidebar
  useEffect(() => {
    const handler = e => {
      setSelected(e.detail);
      setAudio('');
    };
    window.addEventListener('select-doc', handler);
    return () => window.removeEventListener('select-doc', handler);
  }, []);

  async function generate() {
    if (!selected) return;
    setLoading(true);

    // Kick off background generation
    await api.post(`/generate/${selected.id}`);

    // Poll every 3s for completion
    let pod = null;
    while (!pod) {
      await new Promise(r => setTimeout(r, 3000));
      const list = (await api.get('/generate')).data;
      pod = list.find(p => p.document_id === selected.id && p.audio_filename);
    }

    // Fetch final audio blob
    const res = await api.get(`/generate/${pod.id}/audio`, { responseType: 'blob' });
    setAudio(URL.createObjectURL(res.data));
    setLoading(false);
  }

  // No doc selected → friendly placeholder
  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        Select or upload a document to begin
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-6 overflow-y-auto space-y-6">
      {/* Document title */}
      <h3 className="font-semibold text-lg truncate" title={selected.orig_filename}>
        {selected.orig_filename}
      </h3>

      {/* Generate button */}
      <Button
        onClick={generate}
        disabled={loading}
        className="w-44"
      >
        {loading ? (
          <Loader2 className="animate-spin h-4 w-4 mr-2" />
        ) : null}
        {loading ? 'Generating…' : 'Generate Podcast'}
      </Button>

      {/* Audio player */}
      {audio && (
        <div className="mt-4 flex flex-col items-center w-full max-w-2xl">
          <PlayCircle className="h-8 w-8 mb-2" />
          <audio controls src={audio} className="w-full rounded" />
        </div>
      )}
    </div>
  );
}