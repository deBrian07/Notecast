import Sidebar from '@/components/Sidebar.jsx';
import Topbar from '@/components/Topbar.jsx';
import Workspace from '@/components/Workspace.jsx';

export default function Dashboard(){
  return(
    <div className="h-screen w-screen flex flex-col bg-blue-50">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Workspace />
        </div>
      </div>
    </div>
  );
}