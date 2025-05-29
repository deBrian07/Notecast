import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PlayCircle, Play, Pause, Volume2, Download, Share, MoreHorizontal, FileText, MessageSquare, Clock, Plus, FolderPlus, Folder, ArrowLeft, Trash2, Edit, Send, BookOpen, Mic } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import './Workspace.css';

export default function Workspace(){
  const { effectiveTheme } = useTheme();
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

  // Add script state
  const [podcastScript, setPodcastScript] = useState('');
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptSegments, setScriptSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [timingCalibration, setTimingCalibration] = useState(1.0); // Calibration factor
  const [lastCalibrationTime, setLastCalibrationTime] = useState(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState(null);
  const [chatMessagesRef, setChatMessagesRef] = useState(null);

  const api = axios.create({
    baseURL: 'https://api.infinia.chat',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  // Custom components for ReactMarkdown
  const markdownComponents = {
    code({node, inline, className, children, ...props}) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={effectiveTheme === 'dark' ? oneDark : oneLight}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: '12px 0',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: '1.4'
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

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
      const response = await api.get('/projects');
      const backendProjects = response.data;
      
      // Convert backend projects to frontend format and add podcast status
      const projectsWithPodcastStatus = await Promise.all(
        backendProjects.map(async (project) => {
          const podcastId = getProjectPodcastId(project.id);
          let hasPodcast = false;
          
          if (podcastId) {
            try {
              const podcastResponse = await api.get('/generate');
              const allPodcasts = podcastResponse.data;
              hasPodcast = allPodcasts.some(p => p.id === podcastId && p.audio_filename);
            } catch (error) {
              console.error('Error checking podcast status:', error);
            }
          }
          
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            created_at: project.created_at,
            document_count: project.document_count,
            has_podcast: hasPodcast
          };
        })
      );
      
      setProjects(projectsWithPodcastStatus);
      
      // Also save to localStorage as backup
      saveProjectsToStorage(projectsWithPodcastStatus);
    } catch (error) {
      console.error('Error fetching projects:', error);
      // Fallback to localStorage if backend fails
      const storedProjects = localStorage.getItem('notecast_projects');
      if (storedProjects) {
        setProjects(JSON.parse(storedProjects));
      } else {
        setProjects([]);
      }
    }
  };

  const saveProjectsToStorage = (projects) => {
    localStorage.setItem('notecast_projects', JSON.stringify(projects));
  };

  const fetchProjectDocuments = async (projectId) => {
    try {
      // Use the project-specific documents endpoint
      const response = await api.get(`/documents/project/${projectId}`);
      setDocs(response.data);
    } catch (error) {
      console.error('Error fetching project documents:', error);
      setDocs([]);
    }
  };

  const createNewProject = async () => {
    try {
      const projectName = `New Project ${new Date().toLocaleDateString()}`;
      
      // Create project on backend
      const response = await api.post('/projects', {
        name: projectName,
        description: ""  // Send empty string instead of null
      });
      
      const newProject = {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        created_at: response.data.created_at,
        document_count: 0,
        has_podcast: false
      };
      
      // Update local state
      const updatedProjects = [...projects, newProject];
      setProjects(updatedProjects);
      saveProjectsToStorage(updatedProjects);
      
      setCurrentProject(newProject);
      setDocs([]);
      setSelected(null);
      setSelectedDoc(null);
      setAudio('');
      setPodcastScript('');
      setScriptSegments([]);
      setCurrentSegmentIndex(-1);
      setTimingCalibration(1.0);
      setLastCalibrationTime(0);
      setShowProjectSelection(false);
      setActiveTab('sources');
      
      console.log(`Successfully created new project: ${newProject.name}`);
    } catch (error) {
      console.error('Error creating project:', error);
      console.error('Error response:', error.response?.data);
      alert('There was an error creating the project. Please try again.');
    }
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
      
      // Clear audio and script when switching projects
      setAudio('');
      setPodcastScript('');
      setLoadingScript(false);
      setScriptSegments([]);
      setCurrentSegmentIndex(-1);
      setTimingCalibration(1.0);
      setLastCalibrationTime(0);
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
    setPodcastScript('');
    setScriptSegments([]);
    setCurrentSegmentIndex(-1);
    setTimingCalibration(1.0);
    setLastCalibrationTime(0);
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
      
      // Delete the project using backend API (this will cascade delete documents and podcasts)
      await api.delete(`/projects/${currentProject.id}`);
      console.log(`Deleted project ${currentProject.name} from backend`);
      
      // Remove project from local state
      const updatedProjects = projects.filter(p => p.id !== currentProject.id);
      saveProjectsToStorage(updatedProjects);
      setProjects(updatedProjects);
      
      // Navigate back to project selection
      setCurrentProject(null);
      setShowProjectSelection(true);
      setSelected(null);
      setSelectedDoc(null);
      setAudio('');
      setPodcastScript('');
      setScriptSegments([]);
      setCurrentSegmentIndex(-1);
      setTimingCalibration(1.0);
      setLastCalibrationTime(0);
      
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

  const handleRenameSubmit = async () => {
    if (!currentProject || !renameValue.trim() || isRenaming) return;
    
    setIsRenaming(true);
    
    try {
      // Update the project name on backend
      const response = await api.put(`/projects/${currentProject.id}`, {
        name: renameValue.trim(),
        description: currentProject.description
      });
      
      const updatedProject = {
        ...currentProject,
        name: response.data.name,
        description: response.data.description
      };
      
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
    
    if (!currentProject) {
      alert('Please select a project first before uploading documents.');
      return;
    }
    
    try {
      const form = new FormData(); 
      form.append('file', file);
      
      // Use the project-specific upload endpoint
      await api.post(`/documents/upload/${currentProject.id}`, form);
      
      // Refresh the documents list for this project
      await fetchProjectDocuments(currentProject.id);
      
      console.log(`Successfully uploaded ${file.name} to project ${currentProject.name}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('There was an error uploading the file. Please try again.');
    }
  };

  // Listen for "select-doc" custom event dispatched by Sidebar
  useEffect(() => {
    const handler = e => {
      setSelected(e.detail);
      setAudio('');
      setPodcastScript('');
      setScriptSegments([]);
      setCurrentSegmentIndex(-1);
      setTimingCalibration(1.0);
      setLastCalibrationTime(0);
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
      const updateTime = () => {
        setCurrentTime(audioRef.currentTime);
        updateCurrentSegment(audioRef.currentTime);
      };
      const updateDuration = () => setDuration(audioRef.duration);
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentSegmentIndex(-1);
      };

      audioRef.addEventListener('timeupdate', updateTime);
      audioRef.addEventListener('loadedmetadata', updateDuration);
      audioRef.addEventListener('ended', handleEnded);

      return () => {
        audioRef.removeEventListener('timeupdate', updateTime);
        audioRef.removeEventListener('loadedmetadata', updateDuration);
        audioRef.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioRef, scriptSegments]);

  // Function to update current segment based on audio time
  const updateCurrentSegment = (currentTime) => {
    if (scriptSegments.length === 0) return;
    
    // For backend timing data, we don't need calibration as much since it's accurate
    // But we can still apply minimal calibration for fine-tuning
    const calibratedTime = currentTime * timingCalibration;
    
    const segmentIndex = scriptSegments.findIndex(segment => {
      // Handle both old format (startTime/endTime) and new format (start_time/end_time)
      const startTime = segment.start_time !== undefined ? segment.start_time : segment.startTime;
      const endTime = segment.end_time !== undefined ? segment.end_time : segment.endTime;
      
      return calibratedTime >= startTime && calibratedTime < endTime;
    });
    
    if (segmentIndex !== -1 && segmentIndex !== currentSegmentIndex) {
      setCurrentSegmentIndex(segmentIndex);
      
      // Only apply dynamic calibration if we're using estimated timing (fallback)
      // For backend timing data, we trust it more and apply minimal calibration
      const hasBackendTiming = scriptSegments[0] && scriptSegments[0].start_time !== undefined;
      if (!hasBackendTiming) {
        performDynamicCalibration(currentTime, segmentIndex);
      } else {
        // Minimal calibration for backend timing data
        performMinimalCalibration(currentTime, segmentIndex);
      }
      
      // Auto-scroll to current segment
      const segmentElement = document.querySelector(`[data-segment-index="${segmentIndex}"]`);
      if (segmentElement) {
        segmentElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  };

  // Function to perform dynamic timing calibration
  const performDynamicCalibration = (currentTime, segmentIndex) => {
    // Only calibrate after we've been playing for a while and have enough data
    if (currentTime < 30 || segmentIndex < 5) return;
    
    // Only calibrate every 30 seconds to avoid over-correction
    if (currentTime - lastCalibrationTime < 30) return;
    
    const currentSegment = scriptSegments[segmentIndex];
    if (!currentSegment) return;
    
    // Calculate expected time vs actual time
    const expectedTime = currentSegment.startTime / timingCalibration;
    const actualTime = currentTime;
    const timeDrift = actualTime - expectedTime;
    
    // If drift is significant (more than 3 seconds), adjust calibration
    if (Math.abs(timeDrift) > 3) {
      const newCalibration = actualTime / currentSegment.startTime;
      
      // Smooth the calibration change to avoid sudden jumps
      const smoothedCalibration = timingCalibration * 0.8 + newCalibration * 0.2;
      
      // Limit calibration to reasonable bounds (0.7x to 1.3x)
      const boundedCalibration = Math.max(0.7, Math.min(1.3, smoothedCalibration));
      
      if (Math.abs(boundedCalibration - timingCalibration) > 0.05) {
        setTimingCalibration(boundedCalibration);
        setLastCalibrationTime(currentTime);
        console.log(`Timing calibration adjusted to ${boundedCalibration.toFixed(3)} (drift: ${timeDrift.toFixed(1)}s)`);
      }
    }
  };

  // Function to perform minimal timing calibration for backend timing data
  const performMinimalCalibration = (currentTime, segmentIndex) => {
    // Only calibrate after we've been playing for a while and have enough data
    if (currentTime < 60 || segmentIndex < 10) return;
    
    // Only calibrate every 60 seconds to avoid over-correction for accurate backend data
    if (currentTime - lastCalibrationTime < 60) return;
    
    const currentSegment = scriptSegments[segmentIndex];
    if (!currentSegment) return;
    
    // Calculate expected time vs actual time
    const startTime = currentSegment.start_time !== undefined ? currentSegment.start_time : currentSegment.startTime;
    const expectedTime = startTime / timingCalibration;
    const actualTime = currentTime;
    const timeDrift = actualTime - expectedTime;
    
    // Only adjust if drift is very significant (more than 5 seconds) for backend timing
    if (Math.abs(timeDrift) > 5) {
      const newCalibration = actualTime / startTime;
      
      // Very gentle calibration change for backend timing
      const smoothedCalibration = timingCalibration * 0.95 + newCalibration * 0.05;
      
      // Tighter bounds for backend timing (0.9x to 1.1x)
      const boundedCalibration = Math.max(0.9, Math.min(1.1, smoothedCalibration));
      
      if (Math.abs(boundedCalibration - timingCalibration) > 0.02) {
        setTimingCalibration(boundedCalibration);
        setLastCalibrationTime(currentTime);
        console.log(`Minimal timing calibration adjusted to ${boundedCalibration.toFixed(3)} (drift: ${timeDrift.toFixed(1)}s)`);
      }
    }
  };

  // Function to handle clicking on script segments to jump to that time
  const handleSegmentClick = (segmentIndex) => {
    if (!audioRef || scriptSegments.length === 0) return;
    
    const segment = scriptSegments[segmentIndex];
    if (segment) {
      // Handle both old format (startTime) and new format (start_time)
      const startTime = segment.start_time !== undefined ? segment.start_time : segment.startTime;
      
      // Apply inverse calibration when jumping to a segment
      const targetTime = startTime / timingCalibration;
      audioRef.currentTime = targetTime;
      setCurrentSegmentIndex(segmentIndex);
    }
  };

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
      
      // Fetch the script for the new podcast
      await fetchPodcastScript(newPodcast.id);
      
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
      
      // Fetch podcast script
      await fetchPodcastScript(podcast.id);
      
    } catch (error) {
      console.error('Error loading existing podcast:', error);
      alert('There was an error loading the existing podcast. Please try again.');
    }
    
    setLoading(false);
  }

  // Function to fetch podcast script
  const fetchPodcastScript = async (podcastId) => {
    if (!podcastId) return;
    
    setLoadingScript(true);
    try {
      const response = await api.get(`/generate/${podcastId}/script`);
      const script = response.data.script || '';
      const segmentTimings = response.data.segment_timings || [];
      
      setPodcastScript(script);
      
      // Use timing data from backend if available
      if (segmentTimings && segmentTimings.length > 0) {
        console.log('Using accurate timing data from backend:', segmentTimings);
        setScriptSegments(segmentTimings);
        setTimingCalibration(1.0); // Reset calibration since we have accurate timing
        setLastCalibrationTime(0);
      } else {
        console.log('No timing data from backend, falling back to estimation');
        // Fallback to estimation if no timing data available
        if (script) {
          parseScriptSegments(script);
        }
      }
    } catch (error) {
      console.error('Error fetching podcast script:', error);
      setPodcastScript('');
      setScriptSegments([]);
      setTimingCalibration(1.0);
      setLastCalibrationTime(0);
    }
    setLoadingScript(false);
  };

  // Function to parse script into timed segments
  const parseScriptSegments = (script) => {
    const lines = script.split('\n').filter(line => line.trim());
    const segments = [];
    let currentTime = 0;
    
    // More realistic speaking rates and pauses
    const baseWordsPerSecond = 2.0; // Slightly slower base rate
    const pauseBetweenSpeakers = 1.2; // Longer pause between speakers
    const pauseForPunctuation = 0.4; // Longer pause for punctuation
    const pauseForComma = 0.2; // Shorter pause for commas
    const introOutroPause = 2.0; // Extra pause for intro/outro sections
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      const startTime = currentTime;
      
      // Count words in the line
      let text = trimmedLine;
      let isHostLine = false;
      if (trimmedLine.startsWith('Host A:') || trimmedLine.startsWith('Host B:')) {
        text = trimmedLine.substring(7).trim();
        isHostLine = true;
      }
      
      const wordCount = text.split(/\s+/).length;
      
      // Adjust speaking rate based on content type
      let wordsPerSecond = baseWordsPerSecond;
      
      // Slower for questions (indicated by ?)
      if (text.includes('?')) {
        wordsPerSecond *= 0.85;
      }
      
      // Slower for emphasis (indicated by ! or ALL CAPS words)
      if (text.includes('!') || /[A-Z]{3,}/.test(text)) {
        wordsPerSecond *= 0.9;
      }
      
      // Faster for simple statements
      if (wordCount < 5) {
        wordsPerSecond *= 1.1;
      }
      
      // Very slow for intro/outro phrases
      if (text.toLowerCase().includes('welcome') || 
          text.toLowerCase().includes('thank you') ||
          text.toLowerCase().includes('that\'s all') ||
          text.toLowerCase().includes('see you')) {
        wordsPerSecond *= 0.7;
        currentTime += introOutroPause;
      }
      
      const baseDuration = wordCount / wordsPerSecond;
      
      // Add extra time for punctuation with more nuanced timing
      const periodCount = (text.match(/[.!]/g) || []).length;
      const questionCount = (text.match(/[?]/g) || []).length;
      const commaCount = (text.match(/[,;:]/g) || []).length;
      const ellipsisCount = (text.match(/\.\.\./g) || []).length;
      
      const punctuationTime = 
        periodCount * pauseForPunctuation + 
        questionCount * (pauseForPunctuation * 1.3) + // Questions get longer pauses
        commaCount * pauseForComma +
        ellipsisCount * (pauseForPunctuation * 2); // Ellipsis gets much longer pause
      
      // Add natural variation to prevent perfect timing (real speech isn't perfectly timed)
      const variationFactor = 0.9 + (Math.random() * 0.2); // ±10% variation
      const duration = (baseDuration + punctuationTime) * variationFactor;
      
      segments.push({
        index,
        text: trimmedLine,
        startTime,
        endTime: currentTime + duration,
        duration,
        wordCount,
        isHostLine
      });
      
      currentTime += duration;
      
      // Add pause between different speakers with more context
      const nextLine = lines[index + 1];
      if (nextLine && isHostLine) {
        const currentSpeaker = trimmedLine.startsWith('Host A:') ? 'A' : 'B';
        const nextSpeaker = nextLine.startsWith('Host A:') ? 'A' : 
                           nextLine.startsWith('Host B:') ? 'B' : null;
        
        if (nextSpeaker && currentSpeaker !== nextSpeaker) {
          // Longer pause if the current line ends with a question
          const speakerPause = text.endsWith('?') ? 
            pauseBetweenSpeakers * 1.5 : pauseBetweenSpeakers;
          currentTime += speakerPause;
        }
      }
      
      // Add small pause after narrative sections
      if (!isHostLine && nextLine && (nextLine.startsWith('Host A:') || nextLine.startsWith('Host B:'))) {
        currentTime += pauseForPunctuation;
      }
    });
    
    // Apply time scaling to better match actual audio duration
    // This helps correct for cumulative timing drift
    if (duration > 0 && segments.length > 0) {
      const estimatedTotalTime = currentTime;
      const actualDuration = duration; // From audio metadata
      const scaleFactor = actualDuration / estimatedTotalTime;
      
      // Only apply scaling if the difference is significant (more than 10%)
      if (Math.abs(scaleFactor - 1) > 0.1) {
        segments.forEach(segment => {
          segment.startTime *= scaleFactor;
          segment.endTime *= scaleFactor;
          segment.duration *= scaleFactor;
        });
        console.log(`Applied time scaling factor: ${scaleFactor.toFixed(3)}`);
      }
    }
    
    setScriptSegments(segments);
    console.log('Parsed script segments with improved timing:', segments);
  };

  // Chat functions
  const fetchProjectInfo = async (projectId) => {
    try {
      const response = await api.get(`/chat/project/${projectId}/info`);
      setProjectInfo(response.data);
    } catch (error) {
      console.error('Error fetching project info:', error);
      setProjectInfo(null);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentProject || chatLoading) return;
    
    const userMessage = {
      role: 'user',
      content: chatInput.trim()
    };
    
    // Add user message to chat
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const response = await api.post('/chat', {
        message: userMessage.content,
        project_id: currentProject.id,
        conversation_history: updatedMessages.slice(-10) // Send last 10 messages for context
      });
      
      const assistantMessage = {
        role: 'assistant',
        content: response.data.message,
        sources: response.data.sources
      };
      
      setChatMessages([...updatedMessages, assistantMessage]);
    } catch (error) {
      console.error('Error sending chat message:', error);
      
      // Add error message
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        error: true
      };
      
      setChatMessages([...updatedMessages, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Auto-scroll chat messages to bottom
  useEffect(() => {
    if (chatMessagesRef) {
      chatMessagesRef.scrollTop = chatMessagesRef.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // Load project info and clear chat when project changes
  useEffect(() => {
    if (currentProject && activeTab === 'chat') {
      fetchProjectInfo(currentProject.id);
      setChatMessages([]);
    }
  }, [currentProject, activeTab]);

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
            {docs.length === 0 ? (
              <div className="chat-empty-state">
                <div className="chat-empty-icon">
                  <MessageSquare />
                </div>
                <h3 className="chat-empty-title">No documents to chat with</h3>
                <p className="chat-empty-text">Upload documents to your project first, then start chatting about their content</p>
              </div>
            ) : (
              <div className="chat-interface">
                {/* Chat Header */}
                <div className="chat-header">
                  <div className="chat-header-content">
                    <div className="chat-header-info">
                      <h2 className="chat-title">Chat with your documents</h2>
                      <p className="chat-subtitle">
                        Ask questions about {docs.length} {docs.length === 1 ? 'document' : 'documents'} in this project
                      </p>
                    </div>
                    <div className="chat-header-actions">
                      <div className="chat-source-count">
                        <BookOpen size={16} />
                        {docs.length} sources
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="chat-messages" ref={setChatMessagesRef}>
                  {chatMessages.length === 0 ? (
                    <div className="chat-welcome">
                      <div className="chat-welcome-icon">
                        <MessageSquare />
                      </div>
                      <h3 className="chat-welcome-title">Start a conversation</h3>
                      <p className="chat-welcome-text">
                        Ask me anything about your documents. I can help explain concepts, summarize content, or answer specific questions.
                      </p>
                      <div className="chat-suggestions">
                        <button 
                          className="chat-suggestion"
                          onClick={() => setChatInput("What are the main topics covered in these documents?")}
                        >
                          What are the main topics covered?
                        </button>
                        <button 
                          className="chat-suggestion"
                          onClick={() => setChatInput("Can you summarize the key points?")}
                        >
                          Summarize the key points
                        </button>
                        <button 
                          className="chat-suggestion"
                          onClick={() => setChatInput("What are the most important concepts I should understand?")}
                        >
                          What should I focus on?
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-conversation">
                      {chatMessages.map((message, index) => (
                        <div key={index} className={`chat-message chat-message--${message.role}`}>
                          <div className="chat-message-content">
                            <div className="chat-message-avatar">
                              {message.role === 'user' ? (
                                <div className="chat-avatar chat-avatar--user">You</div>
                              ) : (
                                <div className="chat-avatar chat-avatar--assistant">
                                  <Mic size={16} />
                                </div>
                              )}
                            </div>
                            <div className="chat-message-body">
                              <div className={`chat-message-text ${message.error ? 'chat-message-text--error' : ''}`}>
                                <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
                              </div>
                              {message.sources && message.sources.length > 0 && (
                                <div className="chat-message-sources">
                                  <div className="chat-sources-header">
                                    <BookOpen size={14} />
                                    Sources
                                  </div>
                                  <div className="chat-sources-list">
                                    {message.sources.map((source, sourceIndex) => (
                                      <div key={sourceIndex} className="chat-source-item">
                                        <div className="chat-source-name">{source.filename}</div>
                                        <div className="chat-source-excerpt">{source.excerpt}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="chat-message chat-message--assistant">
                          <div className="chat-message-content">
                            <div className="chat-message-avatar">
                              <div className="chat-avatar chat-avatar--assistant">
                                <Mic size={16} />
                              </div>
                            </div>
                            <div className="chat-message-body">
                              <div className="chat-loading">
                                <div className="chat-loading-dots">
                                  <span></span>
                                  <span></span>
                                  <span></span>
                                </div>
                                <span className="chat-loading-text">Thinking...</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="chat-input-container">
                  <div className="chat-input-wrapper">
                    <textarea
                      value={chatInput}
                      onChange={handleChatInputChange}
                      onKeyDown={handleChatKeyPress}
                      placeholder="Ask a question about your documents..."
                      className="chat-input"
                      rows={1}
                      disabled={chatLoading}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || chatLoading}
                      className="chat-send-button"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <div className="chat-input-footer">
                    <span className="chat-input-hint">
                      Press Enter to send, Shift+Enter for new line
                    </span>
                  </div>
                </div>
              </div>
            )}
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

            {/* RIGHT – Script Display */}
            <aside className="workspace-sidebar">
              {/* Script Section */}
              <div className="script-card">
                <div className="script-header">
                  <h2 className="script-title">Podcast Script</h2>
                  <div className="script-header-actions">
                    {Math.abs(timingCalibration - 1.0) > 0.1 && (
                      <div className="timing-calibration-indicator" title={`Timing adjusted by ${((timingCalibration - 1) * 100).toFixed(1)}%`}>
                        <span className="calibration-icon">⚡</span>
                        <span className="calibration-text">{(timingCalibration * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    <button className="workspace-button">
                      <MoreHorizontal />
                    </button>
                  </div>
                </div>
                <div className="script-content">
                  {loadingScript ? (
                    <div className="script-loading">
                      <div className="script-loading-spinner"></div>
                      <p className="script-loading-text">Loading script...</p>
                    </div>
                  ) : podcastScript ? (
                    <div className="script-text">
                      {scriptSegments.length > 0 ? (
                        scriptSegments.map((segment, index) => {
                          // Handle both old format and new backend format
                          const trimmedLine = segment.text ? segment.text.trim() : '';
                          const isCurrentSegment = index === currentSegmentIndex;
                          const startTime = segment.start_time !== undefined ? segment.start_time : segment.startTime;
                          
                          if (trimmedLine.startsWith('Host A:')) {
                            return (
                              <div 
                                key={index} 
                                data-segment-index={index}
                                className={`script-line script-line-host-a ${isCurrentSegment ? 'script-line-current' : ''} ${audio ? 'script-line-clickable' : ''}`}
                                onClick={() => audio && handleSegmentClick(index)}
                                title={audio && startTime !== undefined ? `Jump to ${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')}` : ''}
                              >
                                <span className="script-speaker">Host A:</span>
                                <span className="script-dialogue">{trimmedLine.substring(7).trim()}</span>
                                {isCurrentSegment && <div className="script-progress-indicator"></div>}
                              </div>
                            );
                          } else if (trimmedLine.startsWith('Host B:')) {
                            return (
                              <div 
                                key={index} 
                                data-segment-index={index}
                                className={`script-line script-line-host-b ${isCurrentSegment ? 'script-line-current' : ''} ${audio ? 'script-line-clickable' : ''}`}
                                onClick={() => audio && handleSegmentClick(index)}
                                title={audio && startTime !== undefined ? `Jump to ${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')}` : ''}
                              >
                                <span className="script-speaker">Host B:</span>
                                <span className="script-dialogue">{trimmedLine.substring(7).trim()}</span>
                                {isCurrentSegment && <div className="script-progress-indicator"></div>}
                              </div>
                            );
                          } else if (trimmedLine) {
                            return (
                              <div 
                                key={index} 
                                data-segment-index={index}
                                className={`script-line script-line-narrative ${isCurrentSegment ? 'script-line-current' : ''} ${audio ? 'script-line-clickable' : ''}`}
                                onClick={() => audio && handleSegmentClick(index)}
                                title={audio && startTime !== undefined ? `Jump to ${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')}` : ''}
                              >
                                {trimmedLine}
                                {isCurrentSegment && <div className="script-progress-indicator"></div>}
                              </div>
                            );
                          }
                          return null;
                        })
                      ) : (
                        // Fallback to original parsing if segments aren't available
                        podcastScript.split('\n').map((line, index) => {
                          const trimmedLine = line.trim();
                          if (trimmedLine.startsWith('Host A:')) {
                            return (
                              <div key={index} className="script-line script-line-host-a">
                                <span className="script-speaker">Host A:</span>
                                <span className="script-dialogue">{trimmedLine.substring(7).trim()}</span>
                              </div>
                            );
                          } else if (trimmedLine.startsWith('Host B:')) {
                            return (
                              <div key={index} className="script-line script-line-host-b">
                                <span className="script-speaker">Host B:</span>
                                <span className="script-dialogue">{trimmedLine.substring(7).trim()}</span>
                              </div>
                            );
                          } else if (trimmedLine) {
                            return (
                              <div key={index} className="script-line script-line-narrative">
                                {trimmedLine}
                              </div>
                            );
                          }
                          return null;
                        })
                      )}
                    </div>
                  ) : (
                    <div className="script-empty">
                      <div className="script-empty-icon">
                        <FileText />
                      </div>
                      <h3 className="script-empty-title">No script available</h3>
                      <p className="script-empty-text">
                        {audio ? 'Script not found for this podcast' : 'Generate or load a podcast to view the script'}
                      </p>
                    </div>
                  )}
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
