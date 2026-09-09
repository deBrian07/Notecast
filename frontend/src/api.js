import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function createApi(withAuth = false) {
  const headers = {};
  if (withAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return axios.create({
    baseURL: API_BASE_URL,
    headers,
  });
}
