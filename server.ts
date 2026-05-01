import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dns from 'dns';

// Fix for potential DNS issues in some environments
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getCached(url: string, params: any) {
  const key = `${url}${JSON.stringify(params)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const response = await axios.get(url, { params });
  cache.set(key, { data: response.data, timestamp: Date.now() });
  return response.data;
}

const app = express();
app.use(express.json());

const sanitizeKey = (key: string | undefined): string | null => {
  if (!key) return null;
  // Remove all quotes (single, double, backticks) and trim whitespace
  const sanitized = key.trim().replace(/['"`]/g, '').trim();
  
  const placeholders = [
    'YOUR_GEMINI_API_KEY',
    'YOUR_OPENWEATHER_API_KEY',
    'YOUR_PIXABAY_API_KEY',
    'ADD_YOUR_KEY_HERE',
    'REPLACE_ME'
  ];
  
  if (sanitized && (placeholders.includes(sanitized) || sanitized.length < 8)) {
    console.warn(`Key "${sanitized.substring(0, 4)}..." seems to be a placeholder or too short.`);
    return null;
  }
  
  return sanitized || null;
};

// API Proxy Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

app.get('/api/weather', async (req, res) => {
  const { city, lat, lon, units = 'metric' } = req.query;
  const apiKey = sanitizeKey(process.env.OPENWEATHER_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ message: 'OPENWEATHER_API_KEY is not configured on the server. Please add it to your environment variables in Settings.' });
  }
  try {
    const params: any = { appid: apiKey, units };
    if (lat && lon) {
      params.lat = lat;
      params.lon = lon;
    } else {
      params.q = city;
    }
    const data = await getCached(`https://api.openweathermap.org/data/2.5/weather`, params);
    res.json(data);
  } catch (error: any) {
    console.error('Weather API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
  }
});

app.get('/api/forecast', async (req, res) => {
  const { city, lat, lon, units = 'metric' } = req.query;
  const apiKey = sanitizeKey(process.env.OPENWEATHER_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ message: 'OPENWEATHER_API_KEY is not configured.' });
  }
  try {
    const params: any = { appid: apiKey, units };
    if (lat && lon) {
      params.lat = lat;
      params.lon = lon;
    } else {
      params.q = city;
    }
    const data = await getCached(`https://api.openweathermap.org/data/2.5/forecast`, params);
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
  }
});

app.get('/api/pollution', async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = sanitizeKey(process.env.OPENWEATHER_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ message: 'OPENWEATHER_API_KEY is not configured.' });
  }
  try {
    const data = await getCached(`https://api.openweathermap.org/data/2.5/air_pollution`, { lat, lon, appid: apiKey });
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
  }
});

app.get('/api/uv', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const data = await getCached(`https://api.open-meteo.com/v1/forecast`, { latitude: lat, longitude: lon, daily: 'uv_index_max', timezone: 'auto', forecast_days: 1 });
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
  }
});

app.get('/api/images', async (req, res) => {
  const { q } = req.query;
  const apiKey = sanitizeKey(process.env.PIXABAY_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ message: 'PIXABAY_API_KEY is not configured.' });
  }
  try {
    const data = await getCached(`https://pixabay.com/api/`, { key: apiKey, q, image_type: 'photo', category: 'places' });
    res.json(data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
  }
});

app.post('/api/ai-insight', async (req, res) => {
  const { prompt } = req.body;
  const apiKey = sanitizeKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ message: 'GEMINI_API_KEY is not configured on the server. Please add it to your environment variables in Settings.' });
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    res.json({ text: result.response.text() });
  } catch (error: any) {
    console.error('Gemini API Insight Error:', error.message || error);
    const isInvalidKey = error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID');
    res.status(isInvalidKey ? 401 : 500).json({ 
      message: isInvalidKey ? 'The provided GEMINI_API_KEY is invalid. Please check your Gemini API key in settings.' : 'Failed to generate AI insight',
      details: error.message || 'Unknown error'
    });
  }
});

app.post('/api/ai-chat', async (req, res) => {
  const { prompt } = req.body;
  const apiKey = sanitizeKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ message: 'GEMINI_API_KEY is not configured on the server.' });
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    res.json({ text: result.response.text() });
  } catch (error: any) {
    console.error('Gemini Chat Error:', error.message || error);
    const isInvalidKey = error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID');
    res.status(isInvalidKey ? 401 : 500).json({ 
      message: isInvalidKey ? 'The provided GEMINI_API_KEY is invalid. Please check your settings.' : 'Failed to generate AI response',
      details: error.message || 'Unknown error'
    });
  }
});

// For Vercel, we export the app
export default app;

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development (Skip this on Vercel/Production)
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Basic static serving ONLY for local production testing
    // Vercel routes are handled by vercel.json
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if not on Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
