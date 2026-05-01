import axios from 'axios';

// Simple in-memory cache for serverless (Note: This is per-instance and volatile on Vercel)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getCached(url: string, params: any) {
  const key = `${url}${JSON.stringify(params)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const response = await axios.get(url, { params });
  cache.set(key, { data: response.data, timestamp: Date.now() });
  return response.data;
}

export const sanitizeKey = (key: string | undefined): string | null => {
  if (!key) return null;
  const sanitized = key.replace(/[\r\n\t]/g, '').trim().replace(/['"`]/g, '').trim();
  
  const placeholders = [
    'YOUR_OPENWEATHER_API_KEY',
    'YOUR_PIXABAY_API_KEY',
    'ADD_YOUR_KEY_HERE',
    'REPLACE_ME',
    'undefined',
    'null'
  ];
  
  const isPlaceholder = placeholders.some(p => sanitized.toLowerCase() === p.toLowerCase());
  const isTooShort = sanitized.length < 15 && !sanitized.startsWith('AIza');
  
  if (!sanitized || isPlaceholder || isTooShort) {
    return null;
  }
  
  return sanitized;
};
