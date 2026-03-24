import axios from 'axios';

const getApiBase = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    
    // If using the Vite dev server, we can use the envUrl if it's set
    // Otherwise in production/packaged builds, we should be dynamic
    if (import.meta.env.DEV && envUrl) {
        return envUrl;
    }

    // In production, we're served from the backend (port 5000)
    // Using a relative path is the most portable and robust
    return '/api';
};

const API_BASE = getApiBase();
export const SERVER_URL = API_BASE.replace('/api', '');

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('classify_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('classify_token');
            localStorage.removeItem('classify_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
