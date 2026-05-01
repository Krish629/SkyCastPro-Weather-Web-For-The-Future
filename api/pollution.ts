import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, sanitizeKey } from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { lat, lon } = req.query;
  const apiKey = sanitizeKey(process.env.OPENWEATHER_API_KEY);

  if (!apiKey) {
    return res.status(500).json({ message: 'OPENWEATHER_API_KEY is not configured.' });
  }

  try {
    const data = await getCached(`https://api.openweathermap.org/data/2.5/air_pollution`, { lat, lon, appid: apiKey });
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Pollution API Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Pollution API Error',
      message: error.response?.data?.message || error.message || 'Internal Server Error'
    });
  }
}
