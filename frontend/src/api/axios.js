/**
 * Axios instance configuration for Thanni Canuuu API.
 * Includes request/response interceptors for authentication.
 */
import axios from 'axios';

// API base URL - uses environment variable or defaults to localhost
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============================================
// REQUEST INTERCEPTOR
// ============================================

api.interceptors.request.use(
    (config) => {
        // Get token from localStorage
        const token = localStorage.getItem('access_token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle 401 Unauthorized
        if (error.response && error.response.status === 401) {
            // Clear auth data
            localStorage.removeItem('access_token');
            localStorage.removeItem('vendor');

            // Redirect to login (only if not already on login page)
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

// ============================================
// AUTH HELPER FUNCTIONS
// ============================================

export const setAuthToken = (token) => {
    localStorage.setItem('access_token', token);
};

export const getAuthToken = () => {
    return localStorage.getItem('access_token');
};

export const removeAuthToken = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('vendor');
};

export const isAuthenticated = () => {
    const token = getAuthToken();
    return !!token;
};

export const getVendor = () => {
    const vendorStr = localStorage.getItem('vendor');
    try {
        return vendorStr ? JSON.parse(vendorStr) : null;
    } catch {
        return null;
    }
};

export const setVendor = (vendor) => {
    localStorage.setItem('vendor', JSON.stringify(vendor));
};

export default api;
