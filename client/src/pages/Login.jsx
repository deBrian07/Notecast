import { useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const nav = useNavigate();

  // axios instance
  const api = axios.create({ baseURL: 'https://api.infinia.chat' });

  async function handleLogin() {
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      const { data } = await api.post(
        '/auth/login',
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      localStorage.setItem('token', data.access_token);
      nav('/app');
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function handleRegister() {
    try {
      await api.post(
        '/auth/register',
        { username, email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );
      alert('Registration successful! Please log in.');
      setIsRegister(false);
    } catch (err) {
      alert('Registration failed: ' + (err.response?.data?.detail || err.message));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-6 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center">
            {isRegister ? 'Register' : 'Login'} to Notecast
          </h1>
          <Input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          {isRegister && (
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          )}
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {isRegister ? (
            <Button onClick={handleRegister} className="flex items-center">
              <UserPlus className="mr-2 h-4 w-4" /> Register
            </Button>
          ) : (
            <Button onClick={handleLogin} className="flex items-center">
              <LogIn className="mr-2 h-4 w-4" /> Login
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            className="mt-2"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Have an account? Login' : 'No account? Register'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}