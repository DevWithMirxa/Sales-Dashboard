import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // still useful for same-origin/local dev
    headers: {
        'ngrok-skip-browser-warning': '1',
    },
});

// Cross-domain fix: frontend (Vercel) and backend (Railway) are on different
// domains, so the browser will NOT automatically send cookies set via
// document.cookie on the frontend to the backend's domain. Instead, we read
// the token from the client-readable cookie and attach it manually as an
// Authorization header on every request. The backend's `protect` middleware
// already supports this as a fallback to cookie-based auth.
api.interceptors.request.use((config) => {
    const token = Cookies.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;