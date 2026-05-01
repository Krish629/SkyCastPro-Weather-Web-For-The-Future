// api/pollution.ts
export default async function handler(req: any, res: any) {
  const { lat, lon } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY?.replace(/[\r\n\t]/g, '').trim().replace(/['"`]/g, '').trim();

  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return res.status(500).json({ error: 'Config Error: API Key missing' });
  }

  try {
    const query = new URLSearchParams({ lat: String(lat), lon: String(lon), appid: apiKey }).toString();
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?${query}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Pollution Error', message: error.message });
  }
}
