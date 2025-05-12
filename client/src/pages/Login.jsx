import { useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export default function Login(){
  const [username,setU]=useState('');
  const [pw,setP]=useState('');
  const nav=useNavigate();
  async function submit(){
    try{
      const form=new FormData();
      form.append('username',username);
      form.append('password',pw);
      const {data}=await axios.post('https://api.infinia.chat/auth/login',form);
      localStorage.setItem('token',data.access_token);
      nav('/app');
    }catch{ alert('login failed'); }
  }
  return(
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-6 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center">Log in to Notecast</h1>
          <Input value={username} onChange={e=>setU(e.target.value)} placeholder="Username"/>
          <Input type="password" value={pw} onChange={e=>setP(e.target.value)} placeholder="Password"/>
          <Button onClick={submit}><LogIn className="mr-2 h-4 w-4"/>Login</Button>
        </CardContent>
      </Card>
    </div>
  );
}