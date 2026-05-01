import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached } from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { lat, lon } = req.query;
  try {
    const data = await getCached(`https://api.open-meteo.com/v1/forecast`, { 
      latitude: lat, 
      longitude: lon, 
      daily: 'uv_index_max', 
      timezone: 'auto', 
      forecast_days: 1 
    });
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('UV API Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'UV API Error',
      message: error.response?.data?.message || error.message || 'Internal Server Error'
    });
  }
}
