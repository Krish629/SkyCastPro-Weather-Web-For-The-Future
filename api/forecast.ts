import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, sanitizeKey } from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { city, lat, lon, units = 'metric' } = req.query;
  const apiKey = sanitizeKey(process.env.OPENWEATHER_API_KEY);

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENWEATHER_API_KEY is not configured.' });
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
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Forecast API Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Forecast API Error',
      message: error.response?.data?.message || error.message || 'Internal Server Error'
    });
  }
}
