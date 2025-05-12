import { Button } from '@/components/ui/button';
export default function Topbar(){
  function logout(){ localStorage.removeItem('token'); window.location='/login'; }
  return(
    <header className="h-14 px-4 flex items-center justify-between border-b bg-white">
      <h2 className="font-bold text-lg">Notecast</h2>
      <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
    </header>
  );
}