import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy Routes
  app.get('/api/weather', async (req, res) => {
    const { city, lat, lon, units = 'metric' } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;
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
      res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
    }
  });

  app.get('/api/forecast', async (req, res) => {
    const { city, lat, lon, units = 'metric' } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;
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
    const apiKey = process.env.OPENWEATHER_API_KEY;
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
    const apiKey = process.env.PIXABAY_API_KEY;
    try {
      const data = await getCached(`https://pixabay.com/api/`, { key: apiKey, q, image_type: 'photo', category: 'places' });
      res.json(data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { message: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
