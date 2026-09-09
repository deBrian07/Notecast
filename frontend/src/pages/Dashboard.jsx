import Topbar from '@/components/Topbar.jsx';
import Workspace from '@/components/Workspace.jsx';

export default function Dashboard(){
  return(
    <div className="h-screen w-screen flex flex-col bg-blue-50 dark:bg-gray-900 transition-colors duration-300">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Workspace />
      </div>
    </div>
  );
}