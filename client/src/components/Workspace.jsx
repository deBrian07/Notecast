import { useEffect, useState } from 'react';
import axios from 'axios';
import { PlayCircle, Play, Pause, Volume2, Download, Share, MoreHorizontal, FileText, MessageSquare, Clock } from 'lucide-react';
import './Workspace.css';

export default function Workspace(){
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioRef, setAudioRef] = useState(null);
  const [activeTab, setActiveTab] = useState('studio');

  const api = axios.create({
    baseURL: 'https://api.infinia.chat',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  // Listen for "select-doc" custom event dispatched by Sidebar
  useEffect(() => {
    const handler = e => {
      setSelected(e.detail);
      setAudio('');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    };
    window.addEventListener('select-doc', handler);
    return () => window.removeEventListener('select-doc', handler);
  }, []);

  // Audio event handlers
  useEffect(() => {
    if (audioRef) {
      const updateTime = () => setCurrentTime(audioRef.currentTime);
      const updateDuration = () => setDuration(audioRef.duration);
      const handleEnded = () => setIsPlaying(false);

      audioRef.addEventListener('timeupdate', updateTime);
      audioRef.addEventListener('loadedmetadata', updateDuration);
      audioRef.addEventListener('ended', handleEnded);

      return () => {
        audioRef.removeEventListener('timeupdate', updateTime);
        audioRef.removeEventListener('loadedmetadata', updateDuration);
        audioRef.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioRef]);

  const togglePlayPause = () => {
    if (audioRef) {
      if (isPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (audioRef) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioRef.currentTime = percent * duration;
    }
  };

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
      
      // Debug: log the podcast list
      console.log('Polling for podcasts, found:', list.length);
      console.log('Looking for document_id:', selected.id);
      console.log('Available podcasts:', list.map(p => ({ id: p.id, document_id: p.document_id, audio_filename: p.audio_filename })));
      
      // Find podcasts with matching document_id and audio_filename, prioritize most recent
      const matchingPods = list
        .filter(p => p.document_id === selected.id && p.audio_filename)
        .sort((a, b) => b.id - a.id); // Sort by ID descending (most recent first)
      
      if (matchingPods.length > 0) {
        pod = matchingPods[0]; // Use the most recent matching podcast
        console.log('Found exact match (most recent):', pod);
      } else {
        // Fallback: try to find by title match (for cases where document_id is None)
        const recentPods = list
          .filter(p => p.audio_filename) // Has audio
          .sort((a, b) => b.id - a.id); // Sort by ID descending (most recent first)
        
        if (recentPods.length > 0) {
          console.log('No exact match found, checking if most recent podcast might be ours...');
          console.log('Most recent podcast:', recentPods[0]);
          
          // If we just started generation and there's a very recent podcast, it might be ours
          const mostRecent = recentPods[0];
          if (mostRecent && mostRecent.title && mostRecent.title.includes(selected.orig_filename)) {
            console.log('Found podcast by title match:', mostRecent);
            pod = mostRecent;
          }
        }
      }
    }

    console.log('Found matching podcast:', pod);

    // Fetch final audio blob
    const res = await api.get(`/generate/${pod.id}/audio`, { responseType: 'blob' });
    setAudio(URL.createObjectURL(res.data));
    setLoading(false);
  }

  async function loadExistingPodcast() {
    if (!selected) return;
    setLoading(true);

    try {
      // Get existing podcasts without generating new ones
      const list = (await api.get('/generate')).data;
      
      console.log('Looking for existing podcasts for document_id:', selected.id);
      console.log('Available podcasts:', list.map(p => ({ id: p.id, document_id: p.document_id, audio_filename: p.audio_filename })));
      
      // Find podcasts with matching document_id and audio_filename, prioritize most recent
      const matchingPods = list
        .filter(p => p.document_id === selected.id && p.audio_filename)
        .sort((a, b) => b.id - a.id); // Sort by ID descending (most recent first)
      
      let pod = null;
      if (matchingPods.length > 0) {
        pod = matchingPods[0]; // Use the most recent matching podcast
        console.log('Found existing podcast:', pod);
      } else {
        // Fallback: try to find by title match (for cases where document_id is None)
        const recentPods = list
          .filter(p => p.audio_filename) // Has audio
          .sort((a, b) => b.id - a.id); // Sort by ID descending (most recent first)
        
        if (recentPods.length > 0) {
          const mostRecent = recentPods[0];
          if (mostRecent && mostRecent.title && mostRecent.title.includes(selected.orig_filename)) {
            console.log('Found podcast by title match:', mostRecent);
            pod = mostRecent;
          }
        }
      }

      if (pod) {
        // Fetch existing audio blob
        const res = await api.get(`/generate/${pod.id}/audio`, { responseType: 'blob' });
        setAudio(URL.createObjectURL(res.data));
      } else {
        console.log('No existing podcast found for this document');
        // Could show a message to user that no podcast exists yet
      }
    } catch (error) {
      console.error('Error loading existing podcast:', error);
    }
    
    setLoading(false);
  }

  // No doc selected → friendly placeholder
  if (!selected) {
    return (
      <main className="workspace">
        <div className="workspace-empty">
          <div className="workspace-empty-icon">
            <PlayCircle />
          </div>
          <h3 className="workspace-empty-title">Select a document to begin</h3>
          <p className="workspace-empty-text">Choose a document from the sidebar to generate your podcast</p>
        </div>
      </main>
    );
  }

  return (
    <main className="workspace">
      {/* Header with Navigation Tabs */}
      <div className="workspace-header">
        <div className="workspace-header-content">
          <div className="workspace-header-top">
            <div>
              <h1 className="workspace-title">{selected.orig_filename}</h1>
              <p className="workspace-subtitle">Ready for podcast generation</p>
            </div>
            <div className="workspace-actions">
              <button className="workspace-button">
                <Share />
                Share
              </button>
              <button className="workspace-button">
                <MoreHorizontal />
              </button>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="workspace-tabs">
          <nav className="workspace-nav">
            <button
              onClick={() => setActiveTab('sources')}
              className={`workspace-tab ${activeTab === 'sources' ? 'workspace-tab--active' : ''}`}
            >
              Sources
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`workspace-tab ${activeTab === 'chat' ? 'workspace-tab--active' : ''}`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`workspace-tab ${activeTab === 'studio' ? 'workspace-tab--active' : ''}`}
            >
              Studio
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="workspace-content">
        <div className="workspace-grid">
          {/* LEFT – Audio Overview & Interactive Badge */}
          <section className="workspace-main">
            {/* Audio Overview Section */}
            <div className="audio-overview-card">
              <div className="audio-overview-header">
                <div className="audio-overview-header-content">
                  <div>
                    <h2 className="audio-overview-title">Audio Overview</h2>
                    <p className="audio-overview-subtitle">
                      {loading ? 'Generating your podcast...' : audio ? 'Your podcast is ready!' : 'Generate an audio overview of your document'}
                    </p>
                  </div>
                  {!loading && !audio && (
                    <button 
                      onClick={generate}
                      className="audio-overview-button"
                    >
                      Generate Podcast
                    </button>
                  )}
                </div>
              </div>

              <div className="audio-overview-content">
                {/* Loading State */}
                {loading && (
                  <div className="audio-loading">
                    <div className="audio-loading-spinner"></div>
                    <div className="audio-loading-text">
                      <p className="audio-loading-title">Loading conversation...</p>
                      <p className="audio-loading-subtitle">This may take a few moments...</p>
                    </div>
                  </div>
                )}

                {/* Audio Player */}
                {audio && !loading && (
                  <div className="audio-player">
                    <div className="audio-player-header">
                      <h3 className="audio-player-title">{selected.orig_filename}</h3>
                      <div className="audio-player-meta">
                        <span className="audio-player-duration">{formatTime(duration)} • English</span>
                        <button className="workspace-button">
                          <Download />
                          Download
                        </button>
                        <button className="workspace-button">
                          <Share />
                          Share
                        </button>
                      </div>
                    </div>

                    {/* Custom Audio Player */}
                    <div className="audio-player-controls">
                      <div className="audio-controls">
                        {/* Play/Pause Button */}
                        <button
                          onClick={togglePlayPause}
                          className="audio-play-button"
                        >
                          {isPlaying ? <Pause /> : <Play />}
                        </button>

                        {/* Progress Bar */}
                        <div className="audio-progress">
                          <div 
                            className="audio-progress-bar"
                            onClick={handleSeek}
                          >
                            <div 
                              className="audio-progress-fill"
                              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <div className="audio-progress-time">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>

                        {/* Volume */}
                        <div className="audio-volume">
                          <Volume2 />
                        </div>
                      </div>
                    </div>

                    {/* Hidden HTML5 Audio Element */}
                    <audio
                      ref={setAudioRef}
                      src={audio}
                      style={{ display: 'none' }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  </div>
                )}

                {/* Empty State */}
                {!audio && !loading && (
                  <div className="audio-empty">
                    <div className="audio-empty-icon">
                      <PlayCircle />
                    </div>
                    <p className="audio-empty-text">Click to load the conversation.</p>
                    <button 
                      onClick={loadExistingPodcast}
                      className="audio-empty-button"
                    >
                      Load
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Mode Badge */}
            <div className="interactive-badge">
              <div className="interactive-badge-content">
                Interactive mode
                <span className="interactive-badge-beta">BETA</span>
              </div>
            </div>
          </section>

          {/* RIGHT – Notes + Quick Actions */}
          <aside className="workspace-sidebar">
            {/* Notes Section */}
            <div className="notes-card">
              <div className="notes-header">
                <h2 className="notes-title">Notes</h2>
                <button className="workspace-button">
                  <MoreHorizontal />
                </button>
              </div>
              <div className="notes-content">
                <div className="notes-empty-icon">
                  <FileText />
                </div>
                <p className="notes-empty-text">No notes yet</p>
                <button className="notes-add-button">
                  + Add note
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <div className="quick-action-card">
                <div className="quick-action-icon">
                  <FileText />
                </div>
                <h3 className="quick-action-title">Study guide</h3>
                <p className="quick-action-description">Generate study materials</p>
              </div>

              <div className="quick-action-card">
                <div className="quick-action-icon">
                  <MessageSquare />
                </div>
                <h3 className="quick-action-title">FAQ</h3>
                <p className="quick-action-description">Common questions</p>
              </div>

              <div className="quick-action-card">
                <div className="quick-action-icon">
                  <Clock />
                </div>
                <h3 className="quick-action-title">Timeline</h3>
                <p className="quick-action-description">Key events overview</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}