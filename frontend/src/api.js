import axios from 'axios';

const raw = import.meta.env.VITE_API_URL;
export const API_BASE_URL = raw === undefined ? 'http://localhost:8000' : raw;

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
