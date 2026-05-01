// api/images.ts
export default async function handler(req: any, res: any) {
  const { q } = req.query;
  const apiKey = process.env.PIXABAY_API_KEY?.replace(/[\r\n\t]/g, '').trim().replace(/['"`]/g, '').trim();

  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return res.status(500).json({ error: 'Config Error: Pixabay Key missing' });
  }

  try {
    const query = new URLSearchParams({ 
      key: apiKey, 
      q: String(q), 
      image_type: 'photo', 
      category: 'places' 
    }).toString();
    const url = `https://pixabay.com/api/?${query}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Images Error', message: error.message });
  }
}
