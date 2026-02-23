/**
 * API configuration - single source for backend URL
 * Set VITE_API_URL in .env for production (e.g. https://api.example.com)
 * Backend default port: 5000 (ensure server runs on same port)
 */
export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'https://privy-tech.onrender.com';
