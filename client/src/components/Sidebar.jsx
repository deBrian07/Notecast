import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, Plus } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar(){
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  const api = axios.create({ 
    baseURL: 'https://api.infinia.chat', 
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  
  useEffect(() => { 
    api.get('/documents').then(r => setDocs(r.data)); 
  }, []);

  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
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

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h2 className="sidebar-title">Sources</h2>
        <p className="sidebar-subtitle">Documents for your notebook</p>
      </div>

      {/* Upload Section */}
      <div className="sidebar-upload">
        <button 
          onClick={() => document.getElementById('fileInput').click()}
          className="sidebar-upload-button"
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

      {/* Documents List */}
      <div className="sidebar-content">
        {docs.length === 0 ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">
              <FileText />
            </div>
            <h3 className="sidebar-empty-title">No documents yet</h3>
            <p className="sidebar-empty-text">Upload a PDF or document to get started</p>
          </div>
        ) : (
          <div className="sidebar-documents">
            {docs.map(doc => (
              <div
                key={doc.id}
                onClick={() => handleDocSelect(doc)}
                className={`document-card ${selectedDoc?.id === doc.id ? 'document-card--selected' : ''}`}
              >
                <div className="document-card-content">
                  <div className={`document-icon ${selectedDoc?.id === doc.id ? 'document-icon--selected' : ''}`}>
                    <FileText />
                  </div>
                  <div className="document-info">
                    <p className={`document-title ${selectedDoc?.id === doc.id ? 'document-title--selected' : ''}`}>
                      {doc.orig_filename}
                    </p>
                    <p className="document-meta">
                      PDF • {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          {docs.length} {docs.length === 1 ? 'document' : 'documents'} uploaded
        </div>
      </div>
    </aside>
  );
}