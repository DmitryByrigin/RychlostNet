import { NextRequest, NextResponse } from 'next/server';

// Указываем Next.js, что это динамический роут (не кэшировать)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Резервные серверы Fast.com для Словакии и ближайших регионов
// Получены непосредственно из Fast.com API 6 апреля 2025
const FAST_SERVERS = [
  { 
    url: "https://ipv4-c001-bts004-slovanet-isp.1.oca.nflxvideo.net/speedtest?c=sk&n=8778&v=62&e=1743973750&t=Snct6V7SG7zQBLOdWEyxZN34kh737dZhiJNslw",
    location: { city: "Bratislava", country: "SK" }
  },
  { 
    url: "https://ipv4-c002-ilz001-energotel31117-isp.1.oca.nflxvideo.net/speedtest?c=sk&n=8778&v=226&e=1743973750&t=w3aXG93cNCUuKf7UyfKDBzKaufGNTYvOUeKHYA",
    location: { city: "Zilina", country: "SK" }
  },
  { 
    url: "https://ipv4-c002-pzy001-energotel31117-isp.1.oca.nflxvideo.net/speedtest?c=sk&n=8778&v=226&e=1743973750&t=PcE-O9qVbDhMYnfjtdu3b80jmoMvIz1UhiSWxQ",
    location: { city: "Nitra", country: "SK" }
  },
  { 
    url: "https://ipv4-c001-vod001-peeringcz-isp.1.oca.nflxvideo.net/speedtest?c=sk&n=8778&v=152&e=1743973750&t=rq0qdi10X-pFXCbZPFwECx2r6WbUBbhFL0X3Dg",
    location: { city: "Praha 10", country: "CZ" }
  }
];

// Резервные серверы на случай, если ссылки из FAST_SERVERS станут недействительными
// Эти ссылки более универсальные, но могут быть менее оптимальными географически
const FALLBACK_SERVERS = [
  { url: "https://ipv4-c004-sof001-i.1.speed.nflxvideo.net/?range=0-26214400" },
  { url: "https://ipv4-c033-fra001-i.1.speed.nflxvideo.net/?range=0-26214400" },
  { url: "https://ipv4-c008-vie001-i.1.speed.nflxvideo.net/?range=0-26214400" },
  { url: "https://ipv4-c009-bud001-i.1.speed.nflxvideo.net/?range=0-26214400" },
  { url: "https://ipv4-c031-prg001-i.1.speed.nflxvideo.net/?range=0-26214400" }
];

/**
 * Обработчик GET запросов для получения списка URL серверов Fast.com
 */
export async function GET(request: NextRequest) {
  console.log('Next.js API: Запрос к маршруту /api/fastcom/urls получен');
  
  try {
    // Получаем параметры запроса
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const urlCount = searchParams.get('urlCount') || '5';
    
    console.log(`Параметры запроса: token=${token?.substring(0, 5)}..., urlCount=${urlCount}`);
    
    if (!token) {
      console.warn('Токен не указан в запросе');
      return NextResponse.json(
        { error: 'Token is required' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Fast-API': 'urls-error-no-token'
          }
        }
      );
    }
    
    // Используем актуальные серверы без обращения к Fast.com API
    console.log('Используем предварительно полученные серверы Fast.com для Словакии');
    
    const response = {
      targets: FAST_SERVERS,
      client: {
        ip: "195.80.176.66",
        location: {
          city: "Banska Bystrica",
          country: "SK"
        }
      },
      timestamp: Date.now()
    };
    
    console.log(`Возвращаем ${FAST_SERVERS.length} серверов Fast.com`);
    
    return NextResponse.json(
      response, 
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'X-Fast-API': 'urls-response-slovakia'
        }
      }
    );
  } catch (error: any) {
    console.error('Unhandled error in Fast.com URLs API:', error);
    
    // В случае ошибки возвращаем резервные серверы
    return NextResponse.json({
      targets: FALLBACK_SERVERS,
      client: {
        ip: "",
        location: {
          country: "Slovakia"
        }
      },
      timestamp: Date.now(),
      error: String(error)
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Fast-API': 'urls-fallback-unhandled-error'
      }
    });
  }
} 