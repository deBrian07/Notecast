import { useEffect, useState } from 'react';
import axios from 'axios';
import { PlayCircle, Play, Pause, Volume2, Download, Share, MoreHorizontal, FileText, MessageSquare, Clock, Plus, FolderPlus, Folder, ArrowLeft } from 'lucide-react';
import './Workspace.css';

export default function Workspace(){
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioRef, setAudioRef] = useState(null);
  const [activeTab, setActiveTab] = useState('sources');
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // New project-based state
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showProjectSelection, setShowProjectSelection] = useState(true);

  const api = axios.create({
    baseURL: 'https://api.infinia.chat',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch documents when project changes
  useEffect(() => {
    if (currentProject) {
      fetchProjectDocuments(currentProject.id);
    }
  }, [currentProject]);

  const fetchProjects = async () => {
    try {
      // For now, we'll simulate projects using existing podcasts
      // In a real implementation, you'd have a separate projects endpoint
      const response = await api.get('/generate');
      const podcasts = response.data;
      
      // Group podcasts by document or create mock projects
      const projectsMap = new Map();
      
      podcasts.forEach(podcast => {
        const projectKey = podcast.document_id || `project_${podcast.id}`;
        if (!projectsMap.has(projectKey)) {
          projectsMap.set(projectKey, {
            id: projectKey,
            name: podcast.title || `Project ${projectKey}`,
            created_at: podcast.created_at,
            document_count: 0,
            has_podcast: !!podcast.audio_filename
          });
        }
        if (podcast.audio_filename) {
          projectsMap.get(projectKey).has_podcast = true;
        }
      });

      setProjects(Array.from(projectsMap.values()));
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchProjectDocuments = async (projectId) => {
    try {
      const response = await api.get('/documents');
      // Filter documents by project (for now, we'll use all documents)
      // In a real implementation, documents would be associated with projects
      setDocs(response.data);
    } catch (error) {
      console.error('Error fetching project documents:', error);
      setDocs([]);
    }
  };

  const createNewProject = () => {
    const newProject = {
      id: `new_${Date.now()}`,
      name: `New Project ${new Date().toLocaleDateString()}`,
      created_at: new Date().toISOString(),
      document_count: 0,
      has_podcast: false
    };
    
    setCurrentProject(newProject);
    setDocs([]);
    setSelected(null);
    setSelectedDoc(null);
    setAudio('');
    setShowProjectSelection(false);
    setActiveTab('sources');
  };

  const selectProject = (project) => {
    setCurrentProject(project);
    setShowProjectSelection(false);
    setActiveTab('sources');
  };

  const backToProjects = () => {
    setCurrentProject(null);
    setShowProjectSelection(true);
    setSelected(null);
    setSelectedDoc(null);
    setAudio('');
    fetchProjects(); // Refresh projects list
  };

  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    setSelected(doc);
    window.dispatchEvent(new CustomEvent('select-doc', { detail: doc }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    
    const form = new FormData(); 
    form.append('file', file);
    await api.post('/documents/upload', form);
    const updatedDocs = (await api.get('/documents')).data;
    setDocs(updatedDocs);
  };

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <div className="sources-tab-content">
            <div className="sources-header">
              <h2 className="sources-title">Sources</h2>
              <p className="sources-subtitle">Documents for your notebook</p>
            </div>

            <div className="sources-upload">
              <button 
                onClick={() => document.getElementById('fileInput').click()}
                className="sources-upload-button"
              >
                <Plus />
                Upload PDF
              </button>
              <input 
                type="file" 
                id="fileInput" 
                accept=".pdf,.docx" 
                hidden 
                onChange={handleFileUpload}
              />
            </div>

            <div className="sources-content">
              {docs.length === 0 ? (
                <div className="sources-empty">
                  <div className="sources-empty-icon">
                    <FileText />
                  </div>
                  <h3 className="sources-empty-title">No documents yet</h3>
                  <p className="sources-empty-text">Upload a PDF or document to get started</p>
                </div>
              ) : (
                <div className="sources-documents">
                  {docs.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => handleDocSelect(doc)}
                      className={`sources-document-card ${selectedDoc?.id === doc.id ? 'sources-document-card--selected' : ''}`}
                    >
                      <div className="sources-document-content">
                        <div className={`sources-document-icon ${selectedDoc?.id === doc.id ? 'sources-document-icon--selected' : ''}`}>
                          <FileText />
                        </div>
                        <div className="sources-document-info">
                          <p className={`sources-document-title ${selectedDoc?.id === doc.id ? 'sources-document-title--selected' : ''}`}>
                            {doc.orig_filename}
                          </p>
                          <p className="sources-document-meta">
                            PDF • {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sources-footer">
              <div className="sources-footer-text">
                {docs.length} {docs.length === 1 ? 'document' : 'documents'} uploaded
              </div>
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="chat-tab-content">
            <div className="chat-placeholder">
              <div className="chat-empty-icon">
                <MessageSquare />
              </div>
              <h3 className="chat-empty-title">Chat Coming Soon</h3>
              <p className="chat-empty-text">Interactive chat with your documents will be available here</p>
            </div>
          </div>
        );

      case 'studio':
      default:
        return (
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
                        <h3 className="audio-player-title">{selected?.orig_filename || currentProject?.name}</h3>
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
                      <p className="audio-empty-text">
                        {docs.length === 0 
                          ? "Add documents to your project first, then generate a podcast." 
                          : "Click to load or generate a podcast for this project."
                        }
                      </p>
                      {docs.length > 0 && (
                        <div className="audio-empty-actions">
                          <button 
                            onClick={loadExistingPodcast}
                            className="audio-empty-button"
                          >
                            Load Existing
                          </button>
                          <button 
                            onClick={generate}
                            className="audio-empty-button"
                          >
                            Generate New
                          </button>
                        </div>
                      )}
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
        );
    }
  };

  const renderProjectSelection = () => {
    return (
      <div className="project-selection">
        <div className="project-selection-header">
          <h1 className="project-selection-title">Welcome to Notecast</h1>
          <p className="project-selection-subtitle">Create a new podcast project or continue with an existing one</p>
        </div>

        <div className="project-actions">
          <button 
            onClick={createNewProject}
            className="project-action-card project-action-card--new"
          >
            <div className="project-action-icon">
              <FolderPlus />
            </div>
            <h3 className="project-action-title">Create New Project</h3>
            <p className="project-action-description">Start a fresh podcast project with new documents</p>
          </button>
        </div>

        {projects.length > 0 && (
          <div className="existing-projects">
            <h2 className="existing-projects-title">Your Projects</h2>
            <div className="projects-grid">
              {projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => selectProject(project)}
                  className="project-card"
                >
                  <div className="project-card-header">
                    <div className="project-card-icon">
                      <Folder />
                    </div>
                    <div className="project-card-status">
                      {project.has_podcast && (
                        <div className="project-status-badge">
                          <PlayCircle size={16} />
                          Podcast Ready
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="project-card-content">
                    <h3 className="project-card-title">{project.name}</h3>
                    <p className="project-card-meta">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                    <p className="project-card-description">
                      {project.document_count} documents • {project.has_podcast ? 'Has podcast' : 'No podcast yet'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Show project selection view
  if (showProjectSelection) {
    return (
      <main className="workspace">
        <div className="workspace-content">
          {renderProjectSelection()}
        </div>
      </main>
    );
  }

  // Show project workspace view
  return (
    <main className="workspace">
      {/* Header with Navigation Tabs */}
      <div className="workspace-header">
        <div className="workspace-header-content">
          <div className="workspace-header-top">
            <div className="workspace-header-left">
              <button 
                onClick={backToProjects}
                className="workspace-back-button"
              >
                <ArrowLeft />
                Back to Projects
              </button>
              <div>
                <h1 className="workspace-title">{currentProject?.name}</h1>
                <p className="workspace-subtitle">
                  {docs.length} {docs.length === 1 ? 'document' : 'documents'} • 
                  {currentProject?.has_podcast ? ' Podcast available' : ' No podcast yet'}
                </p>
              </div>
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
        {renderTabContent()}
      </div>
    </main>
  );
}