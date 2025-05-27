import { Settings, LogOut } from 'lucide-react';
import './Topbar.css';

export default function Topbar(){
  function logout(){ 
    localStorage.removeItem('token'); 
    window.location='/login'; 
  }
  
  return(
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">
          <span>N</span>
        </div>
        <h1 className="topbar-title">Notecast</h1>
      </div>
      
      <div className="topbar-actions">
        <button className="topbar-button topbar-button--ghost">
          <Settings />
        </button>
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