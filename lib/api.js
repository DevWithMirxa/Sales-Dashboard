import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // important for sending/receiving HttpOnly cookies
    headers: {
        'ngrok-skip-browser-warning': '1',
    },
});

// Optionally you can intercept requests to attach headers manually, but using cookies is preferred here
// api.interceptors.request.use(config => { ... })

export default api;
