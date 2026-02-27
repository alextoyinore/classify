import axios from 'axios';

const getApiBase = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
    }
    // Fallback to current hostname (covers both localhost and LAN IP access)
    return `http://${window.location.hostname}:5000/api`;
};

const API_BASE = getApiBase();

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
