import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface FastTarget {
  url: string;
  [key: string]: any;
}

interface FastAPIResponse {
  targets: FastTarget[];
  client: {
    ip: string;
    location: {
      country: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  try {
    // Получаем параметры запроса
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const urlCount = searchParams.get('urlCount') || '5';
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }
    
    console.log(`Next.js API: Getting Fast.com test URLs with count: ${urlCount}`);
    
    // Запрос к Fast.com API
    const apiUrl = `https://api.fast.com/netflix/speedtest/v2?https=true&token=${token}&urlCount=${urlCount}`;
    
    console.log(`Fetching Fast.com API: ${apiUrl}`);
    
    const response = await axios.get<FastAPIResponse>(apiUrl, {
      timeout: 10000, // 10 секунд таймаут
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Fast.com API returned status ${response.status}`);
    }
    
    const data = response.data;
    
    if (!data.targets || data.targets.length === 0) {
      throw new Error('No test URLs returned from Fast.com');
    }
    
    console.log(`Received ${data.targets.length} test URLs from Fast.com`);
    
    // Фильтруем только HTTPS URLs для тестирования
    const testUrls = data.targets
      .filter((target: FastTarget) => target.url.startsWith('https://'))
      .map((target: FastTarget) => ({ url: target.url }));
    
    // Если нет HTTPS URLs, используем все URL
    if (testUrls.length === 0) {
      console.warn('No HTTPS URLs found, using all URLs');
      return NextResponse.json({ 
        targets: data.targets.map((target: FastTarget) => ({ url: target.url })),
        client: data.client
      });
    }
    
    return NextResponse.json({ 
      targets: testUrls,
      client: data.client
    });
  } catch (error: any) {
    console.error('Error fetching Fast.com test URLs:', error.message);
    
    // При ошибке используем резервные сервера
    if (error.response && error.response.status === 403) {
      console.log('Next.js API: Using fallback servers list for Fast.com');
      
      return NextResponse.json({
        targets: [
          { url: "https://ipv4-c004-sof001-i.1.speed.nflxvideo.net/?range=0-26214400" },
          { url: "https://ipv4-c033-fra001-i.1.speed.nflxvideo.net/?range=0-26214400" },
          { url: "https://ipv4-c008-vie001-i.1.speed.nflxvideo.net/?range=0-26214400" },
          { url: "https://ipv4-c009-bud001-i.1.speed.nflxvideo.net/?range=0-26214400" },
          { url: "https://ipv4-c031-prg001-i.1.speed.nflxvideo.net/?range=0-26214400" }
        ],
        client: {
          ip: "",
          location: {
            country: "Slovakia"
          }
        }
      });
    }
    
    return NextResponse.json(
      { error: `Failed to get Fast.com test URLs: ${error.message}` },
      { status: 500 }
    );
  }
} 