import { useState, useEffect } from 'react';
import { Settings, LogOut, Sun, Moon, Monitor, HelpCircle, MessageSquare, Globe, Crown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import './Topbar.css';

export default function Topbar(){
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  function logout(){ 
    localStorage.removeItem('token'); 
    window.location='/login'; 
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && !event.target.closest('.settings-dropdown')) {
        setShowSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const getThemeIcon = (themeType) => {
    switch (themeType) {
      case 'light': return <Sun size={16} />;
      case 'dark': return <Moon size={16} />;
      case 'auto': return <Monitor size={16} />;
      default: return <Monitor size={16} />;
    }
  };

  const getThemeLabel = (themeType) => {
    switch (themeType) {
      case 'light': return 'Light mode';
      case 'dark': return 'Dark mode';
      case 'auto': return 'Device';
      default: return 'Device';
    }
  };
  
  return(
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">
          <img src="/logo2.png" alt="Notecast" className="topbar-logo-image" />
        </div>
        <h1 className="topbar-title">Notecast</h1>
      </div>
      
      <div className="topbar-actions">
        <div className="settings-dropdown">
          <button 
            className="topbar-button topbar-button--ghost"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings />
          </button>
          {showSettings && (
            <div className="settings-dropdown-menu">
              <div className="settings-section">
                <div className="settings-section-title">Appearance</div>
                <button 
                  className={`settings-item ${theme === 'light' ? 'settings-item--active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <Sun size={16} />
                  Light mode
                </button>
                <button 
                  className={`settings-item ${theme === 'dark' ? 'settings-item--active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={16} />
                  Dark mode
                </button>
                <button 
                  className={`settings-item ${theme === 'auto' ? 'settings-item--active' : ''}`}
                  onClick={() => setTheme('auto')}
                >
                  <Monitor size={16} />
                  Device
                </button>
              </div>
              
              <div className="settings-divider"></div>
              
              <div className="settings-section">
                <button className="settings-item">
                  <MessageSquare size={16} />
                  Send feedback
                </button>
                <button className="settings-item">
                  <Globe size={16} />
                  Output Language
                </button>
              </div>
            </div>
          )}
        </div>
        <button 
          className="topbar-button topbar-button--outline"
          onClick={logout}
        >
          <LogOut />
          Logout
        </button>
      </div>
    </header>
  );
}