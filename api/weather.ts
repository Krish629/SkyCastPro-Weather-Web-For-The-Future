import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, sanitizeKey } from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { city, lat, lon, units = 'metric' } = req.query;
  const apiKey = sanitizeKey(process.env.OPENWEATHER_API_KEY);

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Configuration Error',
      message: 'OPENWEATHER_API_KEY is not configured on the server.',
      code: 'OPENWEATHER_KEY_MISSING'
    });
  }

  try {
    const params: any = { appid: apiKey, units };
    if (lat && lon) {
      params.lat = lat;
      params.lon = lon;
    } else if (city) {
      params.q = city;
    } else {
      return res.status(400).json({ error: 'Missing parameters', message: 'City or coordinates required.' });
    }

    const data = await getCached(`https://api.openweathermap.org/data/2.5/weather`, params);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Weather API Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Weather API Error',
      message: error.response?.data?.message || error.message || 'Internal Server Error',
      code: 'WEATHER_FETCH_FAILED'
    });
  }
}
