import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login.jsx';
import Dashboard from '@/pages/Dashboard.jsx';
export default function App(){
  const token = localStorage.getItem('token');
  return (
    <Routes>
      <Route path="/login" element={<Login/>}/>
      <Route path="/app/*" element={ token? <Dashboard/> : <Navigate to="/login"/> }/>
      <Route path="*" element={<Navigate to={ token? '/app' : '/login' }/>}/>
    </Routes>
  );
}