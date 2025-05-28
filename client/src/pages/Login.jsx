import { useState } from 'react';
import axios from 'axios';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const nav = useNavigate();

  // axios instance
  const api = axios.create({ baseURL: 'https://api.infinia.chat' });

  async function handleLogin() {
    setIsLoading(true);
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
      window.location = '/app'; 
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegister) {
      handleRegister();
    } else {
      handleLogin();
    }
  };

  return (
    <div className="login-container">
      {/* Background */}
      <div className="login-background"></div>
      
      {/* Header */}
      <div className="login-header">
        <div className="login-logo">
          <img src="/logo2.png" alt="Notecast" className="login-logo-image" />
        </div>
      </div>

      {/* Main Content */}
      <div className="login-content">
        <div className="login-card">
          <div className="login-card-header">
            <h1 className="login-title">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="login-subtitle">
              {isRegister 
                ? 'Join Notecast to start creating amazing podcasts from your documents'
                : 'Sign in to your account to continue creating podcasts'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group">
              <label className="login-label">Username</label>
              <input
                type="text"
                className="login-input"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            {isRegister && (
              <div className="login-form-group">
                <label className="login-label">Email</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="login-form-group">
              <label className="login-label">Password</label>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="login-input login-password-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="login-submit-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="login-loading">
                  <div className="login-spinner"></div>
                  {isRegister ? 'Creating account...' : 'Signing in...'}
                </div>
              ) : (
                <>
                  {isRegister ? <UserPlus size={20} /> : <LogIn size={20} />}
                  {isRegister ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="login-toggle-button"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister 
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}