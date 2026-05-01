/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Droplets, 
  Wind, 
  Thermometer, 
  Eye, 
  Sunrise, 
  Sunset, 
  Navigation, 
  AlertCircle,
  CloudRain,
  MapPin,
  Loader2,
  Settings2,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Mic,
  MicOff,
  MessageSquare,
  X,
  ArrowUp,
  Square,
  Globe as GlobeIcon,
  ChevronRight
} from 'lucide-react';
import Globe from "@/components/ui/globe";
import { motion, AnimatePresence } from 'motion/react';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";
import { ShineBorder } from "@/components/ui/shine-border";
import { GoogleGenAI } from "@google/genai";

import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip, MarkerPopup, MarkerLabel, useMap } from "@/components/ui/map";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/// Types
interface WeatherData {
  name: string;
  sys: { country: string; sunrise: number; sunset: number };
  main: { 
    temp: number; 
    feels_like: number; 
    temp_min: number; 
    temp_max: number; 
    humidity: number; 
  };
  weather: [{ main: string; description: string; icon: string }];
  wind: { speed: number; deg: number };
  coord: { lat: number; lon: number };
  visibility: number;
  timezone: number; // offset in seconds
  dt: number;
}

interface PollutionData {
  list: Array<{
    main: { aqi: number };
    components: {
      co: number;
      no2: number;
      o3: number;
      pm2_5: number;
      pm10: number;
    }
  }>;
}

interface ForecastData {
  list: Array<{
    dt: number;
    main: { temp: number; temp_min: number; temp_max: number };
    weather: Array<{ description: string; icon: string }>;
    dt_txt: string;
  }>;
}

const DEFAULT_BG = 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?q=80&w=2000&auto=format&fit=crop';

// Helper for Wind Direction
const getWindDirection = (deg: number) => {
  if (deg === undefined) return 'N/A';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
};

// Helper for Timezone-Aware Formatting
const formatLocalTime = (dt: number, timezoneOffset: number, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) => {
  // dt is UTC timestamp in seconds
  // timezoneOffset is offset from UTC in seconds
  const date = new Date((dt + timezoneOffset) * 1000);
  return date.toLocaleString('en-GB', { ...options, timeZone: 'UTC' });
};

  const getAIIcon = (type: string) => {
    switch (type) {
      case 'clothing': return '👕';
      case 'travel': return '🚗';
      case 'health': return '😷';
      case 'activity': return '🏃';
      default: return '💡';
    }
  };

  export default function App() {
    const [city, setCity] = useState('');
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [forecast, setForecast] = useState<ForecastData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Protected Error Setter
    const setSafeError = React.useCallback((msg: string | null) => {
      // Allow invalid API key messages to pass through so users can fix their settings
      if (msg && (msg.toLowerCase().includes('key') || msg.includes('GEMINI_API_KEY') || msg.toLowerCase().includes('api settings'))) {
        setError(msg);
        return;
      }

      if (msg && (msg.toLowerCase().includes('gemini') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted'))) {
        console.warn('Suppressed UI Error:', msg);
        return;
      }
      setError(msg);
    }, []);

    const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
    const [bgImage, setBgImage] = useState(DEFAULT_BG);
    const [aiInsights, setAiInsights] = useState<{clothing?: string; travel?: string; health?: string; activity?: string} | null>(null);
    const [pollution, setPollution] = useState<PollutionData | null>(null);
    const [uvIndex, setUvIndex] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState<string>('');
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'ai', text: string}>>([]);
    const [chatInput, setChatInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isHyperlocal, setIsHyperlocal] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isAIFocused, setIsAIFocused] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [animCycle, setAnimCycle] = useState(0);

    // Animation Styles for the background
    const bgAnimationStyles = [
        { initial: { scale: 1.1, filter: 'blur(10px) brightness(0.5)' }, animate: { scale: 1, filter: 'blur(0px) brightness(0.6)' }, transition: { duration: 1.5, ease: "easeOut" } }, // Zoom + Focus
        { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 1.2, ease: "circOut" } }, // Slide + Fade
        { initial: { filter: 'saturate(0)' }, animate: { filter: 'saturate(1.1)' }, transition: { duration: 2, ease: "easeInOut" } }, // Color Bleed
        { initial: { scale: 1.2 }, animate: { scale: 1 }, transition: { duration: 3, ease: "linear" } }, // Slow Zoom
        { initial: { opacity: 0, filter: 'brightness(2)' }, animate: { opacity: 1, filter: 'brightness(0.6)' }, transition: { duration: 1, ease: "easeIn" } } // Light Leak
    ];

    // Animation Variants
    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.1,
          delayChildren: 0.2
        }
      }
    };

    const itemVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 12
        }
      }
    };

    // Weather Effects Components
    const WeatherParticles = () => {
      if (!weather) return null;
      const type = weather.weather[0].main.toLowerCase();
      const description = weather.weather[0].description.toLowerCase();
      
      // Rain / Drizzle Effect
      if (type.includes('rain') || description.includes('drizzle')) {
        const particleCount = description.includes('heavy') ? 100 : description.includes('light') ? 40 : 70;
        return (
          <div className="absolute inset-0 pointer-events-none z-[3]">
            {[...Array(particleCount)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -50, x: Math.random() * 100 + "%", opacity: 0 }}
                animate={{ 
                  y: "110vh", 
                  opacity: [0, 0.4, 0],
                  x: (Math.random() * 100 + (Math.sin(i) * 2)) + "%" 
                }}
                transition={{ 
                  duration: 0.8 + Math.random() * 0.5, 
                  repeat: Infinity, 
                  delay: Math.random() * 2, 
                  ease: "linear" 
                }}
                className="absolute w-[1px] h-10 bg-blue-400/20 blur-[0.3px]"
              />
            ))}
          </div>
        );
      }
      
      // Snow Effect
      if (type.includes('snow')) {
        const particleCount = 50;
        return (
          <div className="absolute inset-0 pointer-events-none z-[3]">
            {[...Array(particleCount)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -20, x: Math.random() * 100 + "%", opacity: 0, rotate: 0 }}
                animate={{ 
                  y: "110vh", 
                  opacity: [0, 0.9, 0],
                  x: (Math.random() * 100 + (Math.sin(i / 5 + Date.now()/1000) * 10)) + "%",
                  rotate: [0, 360]
                }}
                transition={{ 
                  duration: 6 + Math.random() * 6, 
                  repeat: Infinity, 
                  delay: Math.random() * 5, 
                  ease: "easeInOut" 
                }}
                className="absolute w-2.5 h-2.5 bg-white/40 rounded-full blur-[1px]"
              />
            ))}
          </div>
        );
      }
      
      // Clouds / Overcast Effect
      if (type.includes('clouds') || type.includes('mist') || type.includes('fog') || type.includes('haze')) {
        const count = description.includes('scattered') ? 3 : 8;
        return (
          <div className="absolute inset-0 pointer-events-none z-[3] overflow-hidden">
            {[...Array(count)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: "-100%", y: (Math.random() * 100) + "%", opacity: 0 }}
                animate={{ x: "200%", opacity: [0, 0.15, 0] }}
                transition={{ 
                  duration: 120 + Math.random() * 100, 
                  repeat: Infinity, 
                  delay: i * 20, 
                  ease: "linear" 
                }}
                className="absolute w-[1200px] h-[600px] bg-white/[0.03] rounded-full blur-[180px]"
              />
            ))}
          </div>
        );
      }

      // Clear / Sunny / Night Effect
      if (type.includes('clear')) {
        if (isNight) {
          return (
            <div className="absolute inset-0 pointer-events-none z-[3]">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0.8, 1.2, 0.8]
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 3, 
                    repeat: Infinity, 
                    delay: Math.random() * 5, 
                    ease: "easeInOut" 
                  }}
                  className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]"
                  style={{ top: (Math.random() * 100) + "%", left: (Math.random() * 100) + "%" }}
                />
              ))}
            </div>
          );
        } else {
          return (
             <div className="absolute inset-0 pointer-events-none z-[3]">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.1, 0] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-tr from-yellow-400/5 to-transparent blur-[120px]"
                />
             </div>
          );
        }
      }

      return null;
    };

    // Debounced search logic
    useEffect(() => {
      if (city.length > 2) {
        const timer = setTimeout(() => {
          fetchWeather(city);
        }, 1200); // 1.2s debounce
        return () => clearTimeout(timer);
      }
    }, [city]);

    // Voice Search Implementation
    const startVoiceSearch = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSafeError("Voice search not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCity(transcript);
        fetchWeather(transcript);
      };
      recognition.start();
    };

  // Real-time Clock Implementation
  useEffect(() => {
    const updateTime = () => {
      if (weather) {
        const now = new Date();
        const cityDate = new Date(now.getTime() + (weather.timezone * 1000) + (now.getTimezoneOffset() * 60000));
        setCurrentTime(cityDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };
    
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [weather]);

  // Initial Fetch & Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          fetchWeather('London');
        }
      );
    } else {
      fetchWeather('London');
    }
  }, []);

  const fetchBackground = React.useCallback(async (cityName: string) => {
    if (!cityName || cityName.trim() === "") {
      setBgImage(DEFAULT_BG);
      return;
    }

    const timeKeyword = isNight ? 'night' : isEvening ? 'sunset' : 'day';
    const cleanCity = cityName.trim();
    const queries = [
      `${cleanCity} ${timeKeyword} skyline`,
      `${cleanCity} ${timeKeyword}`,
      cleanCity,
      `${cleanCity} landmark`,
      `weather ${timeKeyword} landscape`
    ];

    setAnimCycle(prev => (prev + 1) % bgAnimationStyles.length);

    for (const q of queries) {
      try {
        const res = await fetch(`/api/images?q=${encodeURIComponent(q)}`);
        if (!res.ok) continue;
        
        const data = await res.json();
        
        if (data && data.hits && data.hits.length > 0) {
          // Select from top 8 results for more variety
          const topHits = data.hits.slice(0, 8);
          const randomIndex = Math.floor(Math.random() * topHits.length);
          const imageUrl = topHits[randomIndex].largeImageURL || topHits[randomIndex].webformatURL;
          
          if (imageUrl) {
            setBgImage(imageUrl);
            return;
          }
        }
      } catch (e) {
        console.warn(`Background fetch failed for query "${q}":`, e);
      }
    }
    
    // If all else fails
    setBgImage(DEFAULT_BG);
  }, []);

  const fetchPollution = React.useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(`/api/pollution?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      setPollution(data);
    } catch (e) {
      console.error('Pollution fetch failed', e);
    }
  }, []);

  const fetchUV = React.useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(`/api/uv?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data.daily?.uv_index_max) {
        setUvIndex(data.daily.uv_index_max[0]);
      }
    } catch (e) {
      console.error('UV fetch failed', e);
    }
  }, []);

  // AI Insight Cache & Rate Limiting
  const insightCacheRef = useRef<Record<string, { data: any, timestamp: number }>>({});
  const lastThrottleRef = useRef<number>(0);

  const applyFallbackInsights = React.useCallback((w: WeatherData) => {
    const temp = w.main.temp;
    const isMetric = unit === 'metric';
    const isCold = isMetric ? temp < 15 : temp < 59;
    const isHot = isMetric ? temp > 28 : temp > 82;
    const main = w.weather[0].main.toLowerCase();
    const hasRain = main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm');
    const aqi = pollution?.list[0].main.aqi || 0;

    setAiInsights({
      clothing: isCold ? "Wear a heavy jacket and layers." : isHot ? "Shorts and light fabrics recommended." : "A light jacket or sweater is perfect.",
      travel: hasRain ? "Roads may be slippery; drive carefully." : "Clear skies for a smooth commute.",
      health: aqi > 3 ? "Air quality is poor; stay indoors if possible." : "Air quality is good for all groups.",
      activity: hasRain ? "Great day for reading or indoor cinema." : "Perfect conditions for outdoor exercise."
    });
  }, [unit, pollution]);
  
  // Assistant API Implementation using Modern SDK (Frontend)
  const ai = useMemo(() => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'REPLACE_ME') return null;
    return new GoogleGenAI({ apiKey });
  }, []);

  const generateAiInsight = React.useCallback(async (w: WeatherData, f: ForecastData) => {
    const cacheKey = `${w.name}-${unit}`;
    const now = Date.now();
    
    // 1. Check local cache (30 min)
    const cached = insightCacheRef.current[cacheKey];
    if (cached && (now - cached.timestamp < 1800000)) {
      setAiInsights(cached.data);
      return;
    }

    // 2. Check global cooldown (10 min after any 429)
    if (now - lastThrottleRef.current < 600000) {
      applyFallbackInsights(w);
      return;
    }

    if (!ai) {
      console.warn('Gemini API key is missing. Falling back to local rules.');
      applyFallbackInsights(w);
      return;
    }

    try {
      const prompt = `Act as an expert meteorologist. Return ONLY a JSON object:
      {
        "clothing": "outfit recommendation for ${w.main.temp}°${unit === 'metric' ? 'C' : 'F'}, ${w.weather[0].description}",
        "travel": "commute and travel advice",
        "health": "health risks (allergies, heat, etc)",
        "activity": "outdoor/indoor activity suggestion"
      }
      Context: AQI ${pollution?.list[0].main.aqi || 'unknown'}. Keep each tip under 10 words. Use emojis.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }]
      });
      
      const output = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(output);
      
      setAiInsights(parsedData);
      insightCacheRef.current[cacheKey] = { data: parsedData, timestamp: now };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.toLowerCase().includes('quota');
      const isKey = errMsg.includes('API_KEY_INVALID') || errMsg.includes('key not valid');
      
      if (isKey) {
        setSafeError("GEMINI_API_KEY is invalid. Please check your settings.");
      } else if (isQuota) {
        lastThrottleRef.current = now;
        console.warn('Weather AI throttled. Falling back to local rules.');
      } else {
        console.error('AI Insight failed', err);
      }
      applyFallbackInsights(w);
    }
  }, [unit, pollution, applyFallbackInsights, ai]);

  const updateAllData = React.useCallback((wData: WeatherData, fData: ForecastData) => {
    setWeather(wData);
    setForecast(fData);
    
    // Premium Alert Heuristic (if API alerts are empty)
    const localAlerts = (wData as any).alerts || [];
    if (localAlerts.length === 0) {
      if (wData.main.temp > 35 && unit === 'metric') localAlerts.push({ event: 'Heatwave Warning', description: 'Extreme temperatures detected. Stay hydrated.' });
      if (wData.wind.speed > 20) localAlerts.push({ event: 'High Wind Warning', description: 'Strong winds may cause disruptions.' });
      const mainWeather = wData.weather[0].main.toLowerCase();
      if (mainWeather.includes('thunderstorm')) localAlerts.push({ event: 'Storm Alert', description: 'Thunderstorms in vicinity. Seek shelter.' });
    }
    setAlerts(localAlerts);
    
    fetchBackground(wData.name);
    fetchPollution(wData.coord.lat, wData.coord.lon);
    fetchUV(wData.coord.lat, wData.coord.lon);
    generateAiInsight(wData, fData);
  }, [unit, fetchBackground, fetchPollution, fetchUV, generateAiInsight]);

  const fetchWeatherByCoords = React.useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    setIsHyperlocal(true);
    try {
      const wRes = await fetch(`/api/weather?lat=${lat}&lon=${lon}&units=${unit}`);
      const wData = await wRes.json();
      if (wRes.status !== 200) throw new Error(wData.message || 'Location not found');
      
      const fRes = await fetch(`/api/forecast?lat=${lat}&lon=${lon}&units=${unit}`);
      const fData = await fRes.json();

      updateAllData(wData, fData);
    } catch (err: any) {
      setSafeError(err.message);
    } finally {
      setLoading(false);
    }
  }, [unit, updateAllData]);

  const fetchWeather = React.useCallback(async (searchCity: string) => {
    if (!searchCity) return;
    setLoading(true);
    setError(null);
    setIsHyperlocal(false);
    try {
      const encodedCity = encodeURIComponent(searchCity);
      const wRes = await fetch(`/api/weather?city=${encodedCity}&units=${unit}`);
      const wData = await wRes.json();
      if (wRes.status !== 200) throw new Error(wData.message || 'City not found');
      
      const fRes = await fetch(`/api/forecast?city=${encodedCity}&units=${unit}`);
      const fData = await fRes.json();

      updateAllData(wData, fData);
    } catch (err: any) {
      setSafeError(err.message);
    } finally {
      setLoading(false);
    }
  }, [unit, updateAllData]);

  // Poll AQI data every 5 minutes
  useEffect(() => {
    if (!weather) return;
    const interval = setInterval(() => {
      fetchPollution(weather.coord.lat, weather.coord.lon);
    }, 300000);
    return () => clearInterval(interval);
  }, [weather, fetchPollution]);

  // Re-fetch when unit changes
  const lastUnitRef = useRef(unit);
  useEffect(() => {
    if (weather && lastUnitRef.current !== unit) {
      fetchWeather(weather.name);
      lastUnitRef.current = unit;
    }
  }, [unit, fetchWeather, weather]);


  const askAssistant = async () => {
    if (!chatInput.trim() || !weather || !forecast) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    if (!ai) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "I'm sorry, my AI brain (Gemini API key) isn't configured yet. Please add it in project settings! 🧠" }]);
      setIsThinking(false);
      return;
    }

    try {
      const nextRain = forecast.list.find(item => item.weather[0].main.toLowerCase().includes('rain'));
      const rainContext = nextRain ? `Rain expected at ${new Date(nextRain.dt * 1000).toLocaleTimeString()}.` : "No rain expected soon.";

      const prompt = `Act as a personal weather assistant like "Atmosphere AI".
      Current Location: ${weather.name}, ${weather.sys.country}
      Current Weather: ${weather.main.temp}°${unit === 'metric' ? 'C' : 'F'}, ${weather.weather[0].description}
      Forecast: ${rainContext}
      Humidity: ${weather.main.humidity}%, Wind: ${weather.wind.speed}
      AQI: ${pollution?.list[0].main.aqi || 'moderate'}, UV: ${uvIndex || 'safe'}
      
      User Question: "${userMsg}"
      Answer succinctly, helpfully, and with local context. If they ask about activities, be specific to the weather. Use emojis. Max 40 words.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }]
      });

      setChatHistory(prev => [...prev, { role: 'ai', text: result.text || "I'm sorry, I couldn't process that." }]);
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      const isKey = errMsg.includes('API_KEY_INVALID') || errMsg.includes('key not valid');
      
      if (isKey) {
        setChatHistory(prev => [...prev, { role: 'ai', text: "Your Gemini API Key seems to be invalid. Please check your project settings. 🔑" }]);
      } else {
        console.warn('Assistant API fallback triggered', errMsg);
        let fallbackMsg = "Connecting to Satellite... 📡 ";
        
        if (userMsg.toLowerCase().includes('wear')) {
          fallbackMsg += `Since it's ${Math.round(weather.main.temp)}°, ${weather.main.temp < 15 ? 'dress warmly with a coat!' : 'light comfortable clothes are best.'}`;
        } else if (userMsg.toLowerCase().includes('rain')) {
          const willRain = forecast.list.some(i => i.weather[0].main.toLowerCase().includes('rain'));
          fallbackMsg += willRain ? "Keep an umbrella handy, rain is expected! ☔" : "No rain in the immediate outlook. ☀️";
        } else {
          fallbackMsg += `In ${weather.name}, it's currently ${Math.round(weather.main.temp)}° and ${weather.weather[0].main}. Stay safe!`;
        }
        
        setChatHistory(prev => [...prev, { role: 'ai', text: fallbackMsg }]);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const isEvening = useMemo(() => {
    if (!weather) return false;
    const localTime = weather.dt;
    const sunset = weather.sys.sunset;
    // Defining evening as 1 hour before and after sunset
    return localTime >= sunset - 3600 && localTime <= sunset + 3600;
  }, [weather]);

  const isNight = useMemo(() => {
    if (!weather) return false;
    const localHour = new Date((weather.dt + weather.timezone) * 1000).getUTCHours();
    return localHour >= 19 || localHour <= 6;
  }, [weather]);

  const dailyForecast = useMemo(() => {
    if (!forecast) return [];
    return forecast.list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 5);
  }, [forecast]);

  const hourlyForecast = useMemo(() => {
    if (!forecast) return [];
    return forecast.list.slice(0, 8);
  }, [forecast]);

  const smartAlert = useMemo(() => {
    if (!weather) return null;
    const t = weather.main.temp;
    const c = weather.weather[0].main;
    const v = weather.visibility;
    
    if (unit === 'metric') {
      if (t > 35) return { title: "Extreme Heat", info: "Lows of 28°C", advice: "Hydrate and avoid direct sun.", color: "text-orange-400" };
      if (t < 5) return { title: "Freezing Warning", info: `Min: ${Math.round(weather.main.temp_min)}°C`, advice: "Dress in layers; watch for ice.", color: "text-blue-300" };
    } else {
      if (t > 95) return { title: "Extreme Heat", info: "Lows of 82°F", advice: "Hydrate and avoid direct sun.", color: "text-orange-400" };
      if (t < 41) return { title: "Freezing Warning", info: `Min: ${Math.round(weather.main.temp_min)}°F`, advice: "Dress in layers; watch for ice.", color: "text-blue-300" };
    }
    if (c.includes("Rain")) return { title: "Heavy Rain", info: "Visibility reduced", advice: "Carry an umbrella; drive carefully.", color: "text-indigo-300" };
    if (v < 2000) return { title: "Low Visibility", info: `${(v/1000).toFixed(1)}km range`, advice: "Fog/Haze: Use high-beams if driving.", color: "text-yellow-200" };
    return null;
  }, [weather, unit]);

  return (
    // @ts-ignore
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
    <div className="relative min-h-screen w-full flex items-center justify-center p-2 sm:p-4 transition-all duration-1000 overflow-hidden bg-brand-bg select-none">
      {/* Dynamic Animated Background with Parallax */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div 
            key={bgImage}
            initial={bgAnimationStyles[animCycle].initial}
            animate={{
               ...bgAnimationStyles[animCycle].animate,
               filter: (bgAnimationStyles[animCycle].animate.filter || '') + 
                       (isNight ? ' brightness(0.4)' : isEvening ? ' brightness(0.5) sepia(0.2)' : ' brightness(0.6)')
            }}
            exit={{ opacity: 0 }}
            transition={bgAnimationStyles[animCycle].transition}
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${bgImage})`,
            }}
          />
        </AnimatePresence>
        {/* Advanced Darkening & Readability Layers */}
        <div className={`absolute inset-0 z-[1] transition-colors duration-1000 ${
          isNight ? 'bg-black/60' : isEvening ? 'bg-orange-950/40' : 'bg-black/30'
        } pointer-events-none`} />
        <div className={`absolute inset-0 z-[2] bg-gradient-to-b ${
          isNight ? 'from-black/60 via-transparent to-black/90' : 
          isEvening ? 'from-orange-900/40 via-transparent to-black/80' : 
          'from-black/40 via-transparent to-black/70'
        } pointer-events-none`} />
        <div className="absolute inset-0 z-[2] backdrop-blur-[1px] pointer-events-none" />
      </div>

      {/* Atmospheric Blurs from Design */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none z-[1]"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none z-[1]"></div>
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-brand-bg/40 via-transparent to-brand-bg/85 pointer-events-none" />

      {/* Map Overlay */}
      <AnimatePresence>
        {isMapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl h-[70vh] bg-slate-900 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl"
            >
              <div className="absolute top-6 left-6 z-[110] flex flex-col gap-1 pointer-events-none">
                <h2 className="text-xl font-bold tracking-tighter text-white drop-shadow-md">Satellite & Map View</h2>
                <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold drop-shadow-md">Current Location Synchronized</p>
              </div>
              
              <button 
                onClick={() => setIsMapOpen(false)}
                className="absolute top-6 right-6 z-[110] w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-rose-500/80 transition-all shadow-lg"
              >
                <X size={20} />
              </button>

              <div className="w-full h-full">
                {weather && (
                  <Map 
                    center={[weather.coord.lon, weather.coord.lat]} 
                    zoom={8}
                    styles={{
                      dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
                    }}
                  >
                    <MapControls position="bottom-right" showZoom showLocate showFullscreen />
                    <MapMarker longitude={weather.coord.lon} latitude={weather.coord.lat}>
                      <MarkerContent>
                        <div className="relative group cursor-pointer">
                          <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping group-hover:bg-blue-500/40" />
                          <div className="relative w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(37,99,235,0.6)] flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white leading-none">W</span>
                          </div>
                        </div>
                      </MarkerContent>
                      <MarkerLabel position="top" className="bg-blue-600 text-white px-2 py-1 rounded-md shadow-xl border border-white/20 font-bold text-xs -translate-y-2">
                        {weather.name}
                      </MarkerLabel>
                      <MarkerTooltip>
                        <div className="flex flex-col gap-1 p-2 bg-slate-900 text-white rounded-lg border border-white/10">
                          <span className="font-bold whitespace-nowrap">{weather.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-bold">{Math.round(weather.main.temp)}°</span>
                            <span className="text-white/40 capitalize text-[9px]">{weather.weather[0].description}</span>
                          </div>
                        </div>
                      </MarkerTooltip>
                      <MarkerPopup closeButton>
                        <div className="flex flex-col gap-3 min-w-[200px] p-2 bg-slate-900 text-white">
                            <h3 className="font-bold border-b border-white/10 pb-2 flex items-center gap-2">
                              <MapPin size={12} className="text-blue-400" />
                              {weather.name} Weather
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="flex flex-col">
                                    <span className="text-white/40 uppercase text-[8px] font-bold tracking-wider">Temp</span>
                                    <span className="font-medium">{Math.round(weather.main.temp)}°{unit==='metric'?'C':'F'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white/40 uppercase text-[8px] font-bold tracking-wider">Feels Like</span>
                                    <span className="font-medium">{Math.round(weather.main.feels_like)}°</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white/40 uppercase text-[8px] font-bold tracking-wider">Humidity</span>
                                    <span className="font-medium">{weather.main.humidity}%</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white/40 uppercase text-[8px] font-bold tracking-wider">Condition</span>
                                    <span className="font-medium capitalize">{weather.weather[0].main}</span>
                                </div>
                            </div>
                        </div>
                      </MarkerPopup>
                    </MapMarker>
                  </Map>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <WeatherParticles />
      <AnimatePresence mode="wait">
        <motion.main 
          key={weather?.name || 'loading'}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={containerVariants}
          className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-24 sm:pt-32 pb-32 sm:pb-40 flex flex-col lg:flex-row gap-6 sm:gap-10 items-stretch"
        >
          {/* Left Column: Primary Weather & Detail Grid */}
          <div className="flex-1 flex flex-col gap-6 no-scrollbar lg:max-h-[90vh] lg:overflow-y-auto">
            
            {/* Header: Navigation Style */}
            <motion.nav variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 mb-2 sm:mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <div className="w-5 h-5 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
                </div>
                <span className="text-xl font-semibold tracking-tight">SkyCastPro <span className="text-blue-400 opacity-50 font-light">Web</span></span>
              </div>
              
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsMapOpen(true)}
                  className={`cursor-pointer group px-3 sm:px-4 py-2 bg-white/5 backdrop-blur-md border rounded-full flex items-center gap-2 sm:gap-4 transition-all relative ${isHyperlocal ? 'border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'border-white/10 opacity-90'}`}
                >
                  <Globe 
                    size={24}
                    className="relative z-20 hidden sm:block"
                  />
                  <div className="flex flex-col items-start gap-0.5 min-w-[80px] sm:min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <span className={`${isHyperlocal ? 'text-blue-400' : 'text-white/40'} animate-pulse text-[8px]`}>●</span>
                      <span className="text-[11px] font-bold uppercase truncate">
                        {isHyperlocal && <span className="text-blue-400 mr-1">[GPS]</span>}
                        {weather ? `${weather.name}, ${weather.sys.country}` : 'Scanning...'}
                      </span>
                    </div>
                    {weather && (
                      <span className="text-[9px] text-white/40 font-medium gap-1 flex items-center">
                        <MapPin size={8} /> {weather.coord.lat.toFixed(4)}, {weather.coord.lon.toFixed(4)}
                      </span>
                    )}
                  </div>
                </motion.div>
                <div className="text-[10px] sm:text-xs text-white/40 font-bold tracking-widest uppercase flex flex-col items-end">
                  <span>{weather ? formatLocalTime(weather.dt, weather.timezone, { weekday: 'long', day: 'numeric', month: 'long' }) : '...'}</span>
                  <span className="text-blue-400 font-mono text-[14px]">{currentTime || '--:--:--'}</span>
                </div>
              </div>
            </motion.nav>

            {/* Search Bar - Integrated with Unit Toggle */}
              <motion.div variants={itemVariants} className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="relative group flex-1">
                <form 
                  onSubmit={(e) => { e.preventDefault(); if(city) fetchWeather(city); }}
                >
                  <ShineBorder 
                    isFocused={isSearchFocused}
                    color={["#60a5fa", "#3b82f6", "#2563eb"]}
                    className="rounded-2xl w-full"
                  >
                    <input 
                      type="text" 
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      placeholder="Search city..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 sm:py-4 px-6 pl-10 sm:pl-12 pr-12 focus:outline-none transition-all placeholder:text-white/40 text-white text-sm backdrop-blur-xl"
                    />
                  </ShineBorder>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-20" size={16} />
                  {loading && <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 text-blue-400 animate-spin z-20" size={18} />}
                </form>
                <button 
                  onClick={startVoiceSearch}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all p-1 rounded-full z-20 ${isListening ? 'bg-rose-500/20 text-rose-400 scale-110' : 'text-white/40 hover:text-blue-400'}`}
                  title="Voice Search"
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
              <button 
                onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
                className={`glass-card p-3 rounded-2xl transition-all font-black text-[10px] w-12 h-[52px] flex items-center justify-center border-2 ${unit === 'metric' ? 'border-blue-500/20 text-blue-400' : 'border-orange-500/20 text-orange-400'}`}
                title="Toggle System Units"
              >
                {unit === 'metric' ? '°C' : '°F'}
              </button>
            </motion.div>

            {/* Error Message with Retry */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl mb-4 flex justify-between items-center"
              >
                <span className="text-xs text-rose-400 font-medium">Error: {error}</span>
                <button onClick={() => fetchWeather(city || 'London')} className="text-[10px] bg-rose-500/20 px-2 py-1 rounded-lg font-bold hover:bg-rose-500/30 transition-all">RETRY</button>
              </motion.div>
            )}

            {/* Hero Section: Current Weather or Radar */}
            {loading && !weather ? (
              <motion.div variants={itemVariants} className="flex-1 glass-panel rounded-[32px] flex flex-col items-center justify-center gap-6 animate-pulse p-10 min-h-[400px]">
                <div className="w-32 h-32 bg-white/10 rounded-full blur-sm" />
                <div className="space-y-3 w-full flex flex-col items-center">
                  <div className="w-2/3 h-8 bg-white/10 rounded-xl" />
                  <div className="w-1/2 h-4 bg-white/10 rounded-lg" />
                  <div className="w-1/3 h-4 bg-white/10 rounded-lg" />
                </div>
                <div className="flex gap-4 w-full justify-center mt-4">
                  <div className="w-20 h-10 bg-white/10 rounded-xl" />
                  <div className="w-20 h-10 bg-white/10 rounded-xl" />
                </div>
              </motion.div>
            ) : weather && (
              <motion.div variants={itemVariants}>
                <GlowCard 
                  glowColor="blue"
                  customSize 
                  className="rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col sm:flex-row items-center justify-between shadow-2xl relative overflow-hidden flex-grow min-h-[300px] sm:min-h-[350px] lg:flex-initial"
                >
                {/* Decorative glow */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]"></div>
                
                <div className="z-10 text-center sm:text-left">
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setIsMapOpen(true)}
                    className="flex items-center gap-3 mb-4 cursor-pointer group w-fit mx-auto sm:mx-0 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <Globe size={20} />
                    <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors">
                      {weather.name}, {weather.sys.country}
                    </span>
                    <ChevronRight size={14} className="text-white/20 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </motion.div>
                  <motion.h1 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-7xl sm:text-8xl lg:text-9xl font-light tracking-tighter mb-2"
                  >
                    {Math.round(weather.main.temp)}<span className="text-4xl text-white/40 align-top mt-8 inline-block font-normal">°{unit === 'metric' ? 'C' : 'F'}</span>
                  </motion.h1>
                  <p className="text-2xl font-medium text-blue-300 mb-6 capitalize">{weather.weather[0].description}</p>
                  
                  <div className="flex items-center gap-4 mb-6">
                    {pollution && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                        <Activity size={14} className={pollution.list[0].main.aqi <= 2 ? "text-emerald-400" : "text-amber-400"} />
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-tighter text-white/30 font-bold">Air Quality</span>
                          <span className="text-[10px] font-bold">
                            {['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][pollution.list[0].main.aqi - 1]}
                          </span>
                        </div>
                      </div>
                    )}
                    {uvIndex !== null && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                        <Zap size={14} className={uvIndex <= 3 ? "text-emerald-400" : uvIndex <= 6 ? "text-amber-400" : "text-rose-500"} />
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-tighter text-white/30 font-bold">UV Index</span>
                          <span className="text-[10px] font-bold">
                            {uvIndex.toFixed(1)} ({uvIndex <= 2 ? 'Low' : uvIndex <= 5 ? 'Moderate' : uvIndex <= 7 ? 'High' : 'Very High'})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center sm:justify-start gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest mb-1 font-bold">High</span>
                      <span className="font-semibold text-lg">{Math.round(weather.main.temp_max)}°</span>
                    </div>
                    <div className="w-px h-10 bg-white/10"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest mb-1 font-bold">Low</span>
                      <span className="font-semibold text-lg">{Math.round(weather.main.temp_min)}°</span>
                    </div>
                  </div>
                </div>

                {/* Smart Alert Sub-panel (New detailed design) */}
                {smartAlert && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-6 right-6 lg:relative lg:top-0 lg:right-0 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl max-w-[180px] z-20 shadow-xl"
                  >
                    <div className={`flex items-center gap-2 mb-2 ${smartAlert.color}`}>
                      <AlertCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">{smartAlert.title}</span>
                    </div>
                    <p className="text-xs font-bold text-white mb-1">{smartAlert.info}</p>
                    <p className="text-[9px] leading-tight text-white/60 font-medium">{smartAlert.advice}</p>
                  </motion.div>
                )}

                {/* Weather Illustration Area */}
                <div className="relative w-48 h-48 sm:w-64 sm:h-64 mt-8 sm:mt-0">
                  <div className="absolute inset-0 bg-blue-400/10 blur-[60px] rounded-full"></div>
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 w-full h-full flex items-center justify-center"
                  >
                    <img 
                      src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`} 
                      alt="Condition"
                      className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                      loading="lazy"
                    />
                  </motion.div>
                </div>
              </GlowCard>
            </motion.div>
          )}

            {/* Hourly Forecast Row */}
            {hourlyForecast.length > 0 && weather && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-3 sm:gap-4 scroll-mt-20">
                {hourlyForecast.slice(0, 6).map((item, idx) => (
                  <motion.div 
                    key={item.dt}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ 
                      scale: 1.05, 
                      y: -5, 
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                      boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)"
                    }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 400, 
                      damping: 17,
                      delay: idx * 0.05 
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all cursor-pointer ${idx === 0 ? 'glass-card-active' : 'glass-card'}`}
                  >
                    <span className={`text-[10px] ${idx === 0 ? 'text-blue-300 font-bold uppercase' : 'text-white/40'}`}>
                      {idx === 0 ? 'Now' : formatLocalTime(item.dt, weather.timezone, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-lg font-bold">{Math.round(item.main.temp)}°</span>
                    <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'}`}></div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: AI Intelligence & Outlook */}
          <div className="lg:w-80 flex flex-col gap-6 no-scrollbar lg:max-h-[90vh] lg:overflow-y-auto">
            
            {/* AI Smart Insight Panel */}
            {aiInsights && (
              <motion.div variants={itemVariants}>
                <GlowCard 
                  glowColor="purple"
                  customSize
                  className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Sparkles size={40} /></div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-4 border-b border-white/5 pb-2">Intelligence Brief</h3>
                  <div className="flex flex-col gap-3">
                    {Object.entries(aiInsights).map(([key, value]) => (
                      <div key={key} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-500">
                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{getAIIcon(key)}</span>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-white/30 font-black">{key}</span>
                          <p className="text-[11px] leading-tight text-white/80 font-medium">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </motion.div>
            )}

            {/* Weather Alerts if any */}
            {alerts.length > 0 && (
              <motion.div variants={itemVariants} className="flex flex-col gap-2">
                {alerts.map((alert: any, idx: number) => (
                  <div key={idx} className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex gap-3 items-center">
                    <AlertCircle className="text-rose-400" size={18} />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-rose-300 uppercase">{alert.event}</span>
                      <p className="text-[11px] text-white/70 line-clamp-2">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* 5-Day Forecast List */}
            <motion.div variants={itemVariants}>
              <GlowCard 
                glowColor="orange"
                customSize
                className="rounded-[32px] p-6 flex flex-col gap-4 shadow-xl"
              >
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center justify-between">
                  <span>5-Day Outlook</span>
                  <span className="text-blue-400/50 flex items-center gap-1"><Clock size={10} /> 12:00 Local</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {dailyForecast.map((item, idx) => (
                    <motion.div 
                      key={item.dt} 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.05)" }}
                      transition={{ delay: 0.5 + (idx * 0.1) }}
                      className={`flex justify-between items-center py-2.5 px-2 rounded-xl transition-colors ${idx < dailyForecast.length - 1 ? 'border-b border-white/5' : ''}`}
                    >
                      <span className="w-12 text-sm font-medium text-white/60">
                        {weather ? formatLocalTime(item.dt, weather.timezone, { weekday: 'short' }) : '...'}
                      </span>
                      <img 
                        src={`https://openweathermap.org/img/wn/${item.weather[0].icon}.png`} 
                        className="w-8 h-8 filter drop-shadow-md" 
                        alt=""
                      />
                      <div className="flex gap-3 text-sm min-w-[60px] justify-end">
                        <span className="font-bold text-white">{Math.round(item.main.temp)}°</span>
                        <span className="text-white/30 font-medium">L</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </GlowCard>
            </motion.div>

            {/* Mini Metrics Grid */}
            {weather && (
              <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                <MetricCard 
                  label="Humidity" 
                  value={`${weather.main.humidity}%`} 
                  progress={weather.main.humidity}
                  color="bg-blue-400"
                  icon={<Droplets size={14} className="text-blue-400" />}
                />
                <MetricCard 
                  label="Wind Speed" 
                  value={`${Math.round(weather.wind.speed)} ${unit === 'metric' ? 'm/s' : 'mph'}`} 
                  progress={Math.min((weather.wind.speed / (unit === 'metric' ? 20 : 45)) * 100, 100)}
                  color="bg-cyan-400"
                  icon={<Wind size={14} className="text-cyan-400" />}
                  extra={
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                        {getWindDirection(weather.wind.deg)}
                      </span>
                      <div className="relative w-7 h-7 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-white/5 bg-white/2">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-0.5 bg-white/20"></div>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-0.5 bg-white/20"></div>
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-[1px] bg-white/20"></div>
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-[1px] bg-white/20"></div>
                        </div>
                        <motion.div 
                          title={`Wind Direction: ${weather.wind.deg}°`}
                          initial={{ scale: 0, rotate: weather.wind.deg - 180 }}
                          animate={{ scale: 1, rotate: weather.wind.deg }}
                          whileHover={{ scale: 1.2 }}
                          className="text-cyan-400 group-hover:text-cyan-300 transition-colors"
                        >
                          <ArrowUp size={14} strokeWidth={3} />
                        </motion.div>
                      </div>
                    </div>
                  }
                />
                 <MetricCard 
                  label="Feels Like" 
                  value={`${Math.round(weather.main.feels_like)}°`} 
                  progress={Math.abs((weather.main.feels_like / 40) * 100)}
                  color="bg-indigo-400"
                  icon={<Thermometer size={14} className="text-indigo-400" />}
                />
                <MetricCard 
                  label="Visibility" 
                  value={`${(weather.visibility / 1000).toFixed(1)} km`} 
                  progress={Math.min((weather.visibility / 10000) * 100, 100)}
                  color="bg-purple-400"
                  icon={<Eye size={14} className="text-purple-400" />}
                />
                <MetricCard 
                  label="Air Index (AQI)" 
                  value={pollution ? pollution.list[0].main.aqi.toString() : '--'} 
                  progress={pollution ? (pollution.list[0].main.aqi / 5) * 100 : 0}
                  color={pollution && pollution.list[0].main.aqi <= 2 ? "bg-emerald-400" : "bg-amber-400"}
                  icon={<Activity size={14} className={pollution && pollution.list[0].main.aqi <= 2 ? "text-emerald-400" : "text-amber-400"} />}
                />
                <MetricCard 
                  label="UV Intensity" 
                  value={uvIndex !== null ? uvIndex.toFixed(1) : '--'} 
                  progress={uvIndex !== null ? Math.min((uvIndex / 12) * 100, 100) : 0}
                  color={uvIndex !== null && uvIndex <= 3 ? "bg-emerald-400" : "bg-orange-400"}
                  icon={<Zap size={14} className={uvIndex !== null && uvIndex <= 3 ? "text-emerald-400" : "text-orange-400"} />}
                />
              </motion.div>
            )}

            {/* Sun Cycle Details */}
            {weather && (
              <motion.div variants={itemVariants} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-[24px] p-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-xl text-orange-300"><Sunrise size={18} /></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Sunrise</span>
                    <span className="text-xs font-bold">{weather ? formatLocalTime(weather.sys.sunrise, weather.timezone) : '--:--'}</span>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex items-center gap-3 text-right">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Sunset</span>
                    <span className="text-xs font-bold">{weather ? formatLocalTime(weather.sys.sunset, weather.timezone) : '--:--'}</span>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-xl text-purple-300"><Sunset size={18} /></div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.main>
      </AnimatePresence>

      {/* Subtle Footer */}
      <footer className="absolute bottom-6 left-0 right-0 z-20 flex justify-between items-center px-10 text-[9px] text-white/30 tracking-widest uppercase pointer-events-none">
        <div>System Intelligence Active</div>
        <div className="flex gap-6 pointer-events-auto">
          <span className="hover:text-white/60 transition-colors cursor-help">OpenWeatherMap</span>
          <span className="hover:text-white/60 transition-colors cursor-help">Pixabay Engine</span>
          <span className="hover:text-white/60 transition-colors cursor-help">Neural Intelligence</span>
        </div>
      </footer>

      {/* Floating AI Assistant Trigger */}
      <button 
        onClick={() => setIsAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-110 active:scale-95 group"
      >
        <MessageSquare className="group-hover:animate-bounce" size={24} />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping"></span>
      </button>

      {/* AI Assistant Overlay */}
      <AnimatePresence>
        {isAssistantOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssistantOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 100 }}
              className="fixed bottom-24 right-6 w-[90vw] sm:w-[400px] max-h-[600px] glass-panel border border-white/20 rounded-[32px] z-[70] shadow-2xl flex flex-col overflow-hidden bg-brand-bg/95"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-xl">
                    <Sparkles size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Atmosphere AI Assistant</h3>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active & Learning</p>
                  </div>
                </div>
                <button onClick={() => setIsAssistantOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} className="text-white/40" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 no-scrollbar">
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <Sparkles className="text-blue-400/20 mb-4" size={48} />
                    <p className="text-sm text-white/50 font-medium">Hello! I'm your hyperlocal weather advisor. Ask me anything about the conditions or your plans.</p>
                    <div className="grid grid-cols-1 gap-2 mt-6 w-full px-4">
                      {["Should I go out now?", "Best time for a run?", "What should I wear?"].map(q => (
                        <button 
                          key={q}
                          onClick={() => { setChatInput(q); }}
                          className="text-[11px] font-bold text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-400/30 transition-all text-blue-300"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20' 
                        : 'bg-white/5 text-white border border-white/10'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-black/20">
                <ShineBorder 
                  isFocused={isAIFocused}
                  color={["#a855f7", "#ec4899", "#3b82f6"]}
                  className="rounded-2xl"
                >
                  <PromptInput
                    value={chatInput}
                    onValueChange={setChatInput}
                    isLoading={isThinking}
                    onSubmit={askAssistant}
                    className="bg-black/40 border-white/10 rounded-2xl backdrop-blur-xl"
                  >
                    <PromptInputTextarea 
                      placeholder="Ask the weather expert..." 
                      className="text-white placeholder:text-white/30 text-xs py-3 px-4 min-h-[44px]"
                      onFocus={() => setIsAIFocused(true)}
                      onBlur={() => setIsAIFocused(false)}
                    />
                    <PromptInputActions className="justify-end pt-1">
                      <PromptInputAction
                        tooltip={isThinking ? "Thinking..." : "Send Advice Request"}
                      >
                        <Button
                          variant="default"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50"
                          onClick={askAssistant}
                          disabled={!chatInput.trim() || isThinking}
                        >
                          {isThinking ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ArrowUp className="size-4" />
                          )}
                        </Button>
                      </PromptInputAction>
                    </PromptInputActions>
                  </PromptInput>
                </ShineBorder>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </NextThemesProvider>
  );
}

function MetricCard({ label, value, progress, color, icon, extra }: { label: string, value: string, progress: number, color: string, icon: React.ReactNode, extra?: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <GlowCard 
        glowColor="blue"
        customSize
        className="rounded-[24px] p-5 flex flex-col gap-2 transition-all cursor-pointer group shadow-lg hover:shadow-xl duration-300 h-full"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold">{label}</span>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-lg sm:text-xl font-bold text-white">{value}</div>
          {extra}
        </div>
        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-1">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className={`${color} h-full rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
          />
        </div>
      </GlowCard>
    </motion.div>
  );
}
