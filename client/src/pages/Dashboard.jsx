import Sidebar from '@/components/Sidebar.jsx';
import Topbar from '@/components/Topbar.jsx';
import Workspace from '@/components/Workspace.jsx';
export default function Dashboard(){
  return(
    <div className="h-screen w-screen flex flex-col">
      <Topbar/>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="w-72 border-r"/>
        <Workspace className="flex-1"/>
      </div>
    </div>
  );
}