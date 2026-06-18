import type { VercelRequest, VercelResponse } from '@vercel/node';

// Proxies Open-Meteo (no API key needed) into the shape the frontend expects.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lat = (req.query.lat as string) || process.env.WEATHER_LAT || '40.7128';
  const lon = (req.query.lon as string) || process.env.WEATHER_LON || '-74.0060';
  const label = (req.query.label as string) || process.env.WEATHER_LABEL || 'Home';
  const units = req.query.units === 'metric' ? 'metric' : 'imperial';
  const tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
  const windUnit = units === 'metric' ? 'kmh' : 'mph';

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&timezone=auto&forecast_days=7&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const d = (await r.json()) as any;

    const nowMs = Date.now();
    const hourly = (d.hourly?.time ?? [])
      .map((t: string, i: number) => ({
        time: t,
        temp: d.hourly.temperature_2m[i],
        code: d.hourly.weather_code[i],
        precipProb: d.hourly.precipitation_probability?.[i] ?? 0
      }))
      .filter((h: { time: string }) => new Date(h.time).getTime() >= nowMs - 3600000)
      .slice(0, 24);

    const daily = (d.daily?.time ?? []).map((t: string, i: number) => ({
      date: t,
      tempMax: d.daily.temperature_2m_max[i],
      tempMin: d.daily.temperature_2m_min[i],
      code: d.daily.weather_code[i],
      precipProb: d.daily.precipitation_probability_max?.[i] ?? 0,
      sunrise: d.daily.sunrise?.[i] ?? '',
      sunset: d.daily.sunset?.[i] ?? ''
    }));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({
      current: {
        temp: d.current.temperature_2m,
        apparent: d.current.apparent_temperature,
        code: d.current.weather_code,
        isDay: d.current.is_day === 1,
        windSpeed: d.current.wind_speed_10m,
        humidity: d.current.relative_humidity_2m
      },
      hourly,
      daily,
      units,
      label,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('weather error', err);
    res.status(502).json({ error: 'weather', message: String(err) });
  }
}
