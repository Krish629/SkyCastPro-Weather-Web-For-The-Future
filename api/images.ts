import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, sanitizeKey } from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q } = req.query;
  const apiKey = sanitizeKey(process.env.PIXABAY_API_KEY);

  if (!apiKey) {
    return res.status(500).json({ message: 'PIXABAY_API_KEY is not configured.' });
  }

  try {
    const data = await getCached(`https://pixabay.com/api/`, { 
      key: apiKey, 
      q, 
      image_type: 'photo', 
      category: 'places' 
    });
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Images API Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Images API Error',
      message: error.response?.data?.message || error.message || 'Internal Server Error'
    });
  }
}
