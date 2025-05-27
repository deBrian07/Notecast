import { useEffect, useState } from 'react';
import axios from 'axios';
import { PlayCircle, Play, Pause, Volume2, Download, Share, MoreHorizontal, FileText, MessageSquare, Clock, Plus, FolderPlus, Folder, ArrowLeft, Trash2, Edit } from 'lucide-react';
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
  
  // Project-podcast mapping stored in localStorage
  const [projectPodcastMap, setProjectPodcastMap] = useState({});
  
  // Dropdown menu state
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  const api = axios.create({
    baseURL: 'https://api.infinia.chat',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  // Load project-podcast mapping from localStorage
  useEffect(() => {
    const storedMapping = localStorage.getItem('notecast_project_podcast_map');
    if (storedMapping) {
      setProjectPodcastMap(JSON.parse(storedMapping));
    }
  }, []);

  // Save project-podcast mapping to localStorage
  const saveProjectPodcastMap = (mapping) => {
    localStorage.setItem('notecast_project_podcast_map', JSON.stringify(mapping));
    setProjectPodcastMap(mapping);
  };

  // Get podcast ID for a project
  const getProjectPodcastId = (projectId) => {
    return projectPodcastMap[projectId] || null;
  };

  // Set podcast ID for a project
  const setProjectPodcastId = (projectId, podcastId) => {
    const newMapping = { ...projectPodcastMap, [projectId]: podcastId };
    saveProjectPodcastMap(newMapping);
  };

  // Remove podcast mapping for a project
  const removeProjectPodcastId = (projectId) => {
    const newMapping = { ...projectPodcastMap };
    delete newMapping[projectId];
    saveProjectPodcastMap(newMapping);
  };

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
      // Get projects from localStorage
      const storedProjects = localStorage.getItem('notecast_projects');
      let projects = storedProjects ? JSON.parse(storedProjects) : [];
      
      // Get all podcasts to check which projects have podcasts
      const response = await api.get('/generate');
      const allPodcasts = response.data;
      
      // Check each project for associated podcasts using our mapping
      projects = projects.map(project => {
        const podcastId = getProjectPodcastId(project.id);
        const hasPodcast = podcastId && allPodcasts.some(p => p.id === podcastId && p.audio_filename);
        
        return {
          ...project,
          has_podcast: hasPodcast
        };
      });
      
      setProjects(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const saveProjectsToStorage = (projects) => {
    localStorage.setItem('notecast_projects', JSON.stringify(projects));
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
    
    // Save to localStorage
    const currentProjects = projects;
    const updatedProjects = [...currentProjects, newProject];
    saveProjectsToStorage(updatedProjects);
    setProjects(updatedProjects);
    
    setCurrentProject(newProject);
    setDocs([]);
    setSelected(null);
    setSelectedDoc(null);
    setAudio('');
    setShowProjectSelection(false);
    setActiveTab('sources');
  };

  const selectProject = async (project) => {
    // Refresh the project's podcast status before setting it as current
    try {
      const response = await api.get('/generate');
      const allPodcasts = response.data;
      
      const podcastId = getProjectPodcastId(project.id);
      const hasPodcast = podcastId && allPodcasts.some(p => p.id === podcastId && p.audio_filename);
      
      const updatedProject = { ...project, has_podcast: hasPodcast };
      
      setCurrentProject(updatedProject);
      setShowProjectSelection(false);
      setActiveTab('sources');
    } catch (error) {
      console.error('Error checking project podcast status:', error);
      // Fallback to using the project as-is
      setCurrentProject(project);
      setShowProjectSelection(false);
      setActiveTab('sources');
    }
  };

  const backToProjects = () => {
    setCurrentProject(null);
    setShowProjectSelection(true);
    setSelected(null);
    setSelectedDoc(null);
    setAudio('');
    fetchProjects(); // Refresh projects list
  };

  const deleteProject = async () => {
    if (!currentProject || isDeleting) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${currentProject.name}"? This will permanently delete all documents and podcasts in this project.`
    );
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    setShowDropdown(false);
    
    try {
      // Get the podcast ID for this project
      const podcastId = getProjectPodcastId(currentProject.id);
      
      if (podcastId) {
        try {
          // Delete the podcast (this will delete both the audio file and database entry)
          await api.delete(`/generate/${podcastId}`);
          console.log(`Deleted podcast ${podcastId} for project ${currentProject.name}`);
        } catch (error) {
          console.error(`Error deleting podcast ${podcastId}:`, error);
          // Continue with deletion even if podcast deletion fails
        }
        
        // Remove the podcast mapping for this project
        removeProjectPodcastId(currentProject.id);
      }
      
      // Delete all documents in the project
      for (const doc of docs) {
        try {
          // Delete the actual document file from server storage (data/uploads)
          await api.delete(`/documents/${doc.id}/file`);
          console.log(`Deleted document file for ${doc.id}`);
        } catch (error) {
          console.error(`Error deleting document file for ${doc.id}:`, error);
          // Continue with deletion even if file deletion fails
        }
        
        try {
          // Delete the document database entry
          await api.delete(`/documents/${doc.id}`);
          console.log(`Deleted document database entry ${doc.id}`);
        } catch (error) {
          console.error(`Error deleting document database entry ${doc.id}:`, error);
        }
      }
      
      // Remove project from localStorage
      const updatedProjects = projects.filter(p => p.id !== currentProject.id);
      saveProjectsToStorage(updatedProjects);
      setProjects(updatedProjects);
      
      // Navigate back to project selection
      setCurrentProject(null);
      setShowProjectSelection(true);
      setSelected(null);
      setSelectedDoc(null);
      setAudio('');
      
      console.log(`Successfully deleted project "${currentProject.name}" and all associated files`);
      
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('There was an error deleting the project. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renameProject = () => {
    if (!currentProject) return;
    
    setRenameValue(currentProject.name);
    setShowRenameModal(true);
    setShowDropdown(false);
  };

  const handleRenameSubmit = () => {
    if (!currentProject || !renameValue.trim() || isRenaming) return;
    
    setIsRenaming(true);
    
    try {
      // Update the project name
      const updatedProject = { ...currentProject, name: renameValue.trim() };
      
      // Update in projects list
      const updatedProjects = projects.map(p => 
        p.id === currentProject.id ? updatedProject : p
      );
      
      // Save to localStorage
      saveProjectsToStorage(updatedProjects);
      setProjects(updatedProjects);
      setCurrentProject(updatedProject);
      
      // Close modal
      setShowRenameModal(false);
      setRenameValue('');
      
      console.log(`Successfully renamed project to "${updatedProject.name}"`);
      
    } catch (error) {
      console.error('Error renaming project:', error);
      alert('There was an error renaming the project. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setShowRenameModal(false);
    setRenameValue('');
    setIsRenaming(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.workspace-dropdown')) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

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

  async function generateNewPodcast() {
    if (!currentProject) return;
    setLoading(true);

    try {
      // Delete any existing podcast for this project
      const existingPodcastId = getProjectPodcastId(currentProject.id);
      if (existingPodcastId) {
        try {
          await api.delete(`/generate/${existingPodcastId}`);
          console.log(`Deleted existing podcast ${existingPodcastId} for project ${currentProject.name}`);
          removeProjectPodcastId(currentProject.id);
        } catch (error) {
          console.error(`Error deleting existing podcast ${existingPodcastId}:`, error);
        }
      }

      // Generate new podcast using the first document in the project
      if (docs.length === 0) {
        alert('Please upload at least one document before generating a podcast.');
        setLoading(false);
        return;
      }
      
      const documentId = docs[0].id;
      await api.post(`/generate/${documentId}`);

      // Poll every 3s for completion
      let newPodcast = null;
      while (!newPodcast) {
        await new Promise(r => setTimeout(r, 3000));
        const list = (await api.get('/generate')).data;
        
        console.log('Polling for new podcast...');
        
        // Find the most recent podcast for this document that has audio
        const matchingPods = list
          .filter(p => p.document_id === documentId && p.audio_filename)
          .sort((a, b) => b.id - a.id); // Sort by ID descending (most recent first)
        
        if (matchingPods.length > 0) {
          newPodcast = matchingPods[0];
          console.log('Found new podcast:', newPodcast);
        }
      }

      // Associate the new podcast with this project
      setProjectPodcastId(currentProject.id, newPodcast.id);
      
      // Update project status
      const updatedProject = { ...currentProject, has_podcast: true };
      const updatedProjects = projects.map(p => 
        p.id === currentProject.id ? updatedProject : p
      );
      saveProjectsToStorage(updatedProjects);
      setProjects(updatedProjects);
      setCurrentProject(updatedProject);
      
      console.log(`New podcast generated successfully for project "${currentProject.name}". Use Load button to play it.`);
      
    } catch (error) {
      console.error('Error generating podcast:', error);
      alert('There was an error generating the podcast. Please try again.');
    }
    
    setLoading(false);
  }

  async function generate() {
    if (!currentProject) return;
    setLoading(true);

    try {
      // First, delete any existing podcasts for this project
      const existingPodcasts = await api.get('/generate');
      const projectPodcasts = existingPodcasts.data.filter(p => 
        p.document_id === currentProject.id || 
        (currentProject.id.startsWith('new_') && p.title && p.title.includes(currentProject.name))
      );
      
      // Delete existing podcasts for this project
      for (const podcast of projectPodcasts) {
        try {
          await api.delete(`/generate/${podcast.id}`);
          console.log(`Deleted existing podcast ${podcast.id} for project ${currentProject.name}`);
        } catch (error) {
          console.error(`Error deleting existing podcast ${podcast.id}:`, error);
        }
      }

      // Generate new podcast using the first document in the project or project ID
      const documentId = docs.length > 0 ? docs[0].id : currentProject.id;
      await api.post(`/generate/${documentId}`);

      // Poll every 3s for completion
      let pod = null;
      while (!pod) {
        await new Promise(r => setTimeout(r, 3000));
        const list = (await api.get('/generate')).data;
        
        console.log('Polling for new podcast...');
        
        // Find the most recent podcast that matches our project
        const matchingPods = list
          .filter(p => {
            // Match by document_id or project association
            return (p.document_id === documentId) || 
                   (p.document_id === currentProject.id) ||
                   (currentProject.id.startsWith('new_') && p.title && p.title.includes(currentProject.name));
          })
          .filter(p => p.audio_filename) // Must have audio
          .sort((a, b) => b.id - a.id); // Sort by ID descending (most recent first)
        
        if (matchingPods.length > 0) {
          pod = matchingPods[0];
          console.log('Found new podcast:', pod);
        }
      }

      // Fetch final audio blob and load it
      const res = await api.get(`/generate/${pod.id}/audio`, { responseType: 'blob' });
      setAudio(URL.createObjectURL(res.data));
      
      // Update project status
      const updatedProject = { ...currentProject, has_podcast: true };
      const updatedProjects = projects.map(p => 
        p.id === currentProject.id ? updatedProject : p
      );
      saveProjectsToStorage(updatedProjects);
      setProjects(updatedProjects);
      setCurrentProject(updatedProject);
      
    } catch (error) {
      console.error('Error generating podcast:', error);
      alert('There was an error generating the podcast. Please try again.');
    }
    
    setLoading(false);
  }

  async function loadExistingPodcast() {
    if (!currentProject) return;
    setLoading(true);

    try {
      // Check if this project has a mapped podcast ID
      const podcastId = getProjectPodcastId(currentProject.id);
      
      if (!podcastId) {
        console.log('No podcast mapping found for this project');
        alert('No existing podcast found for this project. Please generate a new one.');
        setLoading(false);
        return;
      }

      // Get all podcasts to verify the mapped podcast still exists
      const list = (await api.get('/generate')).data;
      const podcast = list.find(p => p.id === podcastId && p.audio_filename);
      
      if (!podcast) {
        console.log('Mapped podcast no longer exists in database');
        // Remove the invalid mapping
        removeProjectPodcastId(currentProject.id);
        
        // Update project status
        const updatedProject = { ...currentProject, has_podcast: false };
        const updatedProjects = projects.map(p => 
          p.id === currentProject.id ? updatedProject : p
        );
        saveProjectsToStorage(updatedProjects);
        setProjects(updatedProjects);
        setCurrentProject(updatedProject);
        
        alert('No existing podcast found for this project. Please generate a new one.');
        setLoading(false);
        return;
      }

      console.log('Found existing podcast for project:', podcast);
      
      // Fetch existing audio blob
      const res = await api.get(`/generate/${podcast.id}/audio`, { responseType: 'blob' });
      setAudio(URL.createObjectURL(res.data));
      
    } catch (error) {
      console.error('Error loading existing podcast:', error);
      alert('There was an error loading the existing podcast. Please try again.');
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
                        {loading ? 'Generating your podcast...' : 
                         audio ? 'Your podcast is ready!' : 
                         currentProject?.has_podcast ? 'Load your existing podcast or generate a new one for this project.' : 
                         'Generate a podcast first using the button below'}
                      </p>
                    </div>
                    {!loading && !audio && currentProject?.has_podcast && (
                      <button 
                        onClick={loadExistingPodcast}
                        className="audio-overview-button"
                      >
                        Load Podcast
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
                        <h3 className="audio-player-title">{currentProject?.name}</h3>
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
                          : currentProject?.has_podcast 
                            ? "Load your existing podcast or generate a new one for this project."
                            : "Generate your first podcast for this project."
                        }
                      </p>
                      {docs.length > 0 && (
                        <div className="audio-empty-actions">
                          {currentProject?.has_podcast && (
                            <button 
                              onClick={loadExistingPodcast}
                              className="audio-empty-button"
                            >
                              Load Existing
                            </button>
                          )}
                          <button 
                            onClick={generateNewPodcast}
                            className="audio-empty-button"
                          >
                            {currentProject?.has_podcast ? 'Generate New' : 'Generate Podcast'}
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
              <div className="workspace-dropdown">
                <button 
                  className="workspace-button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  disabled={isDeleting}
                >
                  <MoreHorizontal />
                </button>
                {showDropdown && (
                  <div className="workspace-dropdown-menu">
                    <button 
                      className="workspace-dropdown-item"
                      onClick={renameProject}
                    >
                      <Edit />
                      Rename Project
                    </button>
                    <button 
                      className="workspace-dropdown-item workspace-dropdown-item--danger"
                      onClick={deleteProject}
                      disabled={isDeleting}
                    >
                      <Trash2 />
                      {isDeleting ? 'Deleting...' : 'Delete Project'}
                    </button>
                  </div>
                )}
              </div>
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

      {/* Rename Modal */}
      {showRenameModal && (
        <div 
          className="rename-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleRenameCancel();
            }
          }}
        >
          <div className="rename-modal">
            <div className="rename-modal-header">
              <h3 className="rename-modal-title">Rename Project</h3>
            </div>
            <div className="rename-modal-content">
              <label className="rename-modal-label">Project Name</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="rename-modal-input"
                placeholder="Enter project name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSubmit();
                  } else if (e.key === 'Escape') {
                    handleRenameCancel();
                  }
                }}
              />
            </div>
            <div className="rename-modal-actions">
              <button
                onClick={handleRenameCancel}
                className="rename-modal-button rename-modal-button--cancel"
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="rename-modal-button rename-modal-button--save"
                disabled={isRenaming || !renameValue.trim()}
              >
                {isRenaming ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
