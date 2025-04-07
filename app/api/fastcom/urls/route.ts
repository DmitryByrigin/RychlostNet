import { NextRequest, NextResponse } from 'next/server';

// Указываем Next.js, что это динамический роут (не кэшировать)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Базовый URL API Fast.com
const FAST_API_URL = 'https://api.fast.com/netflix/speedtest/v2';

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
    
    // Формируем URL для запроса к Fast.com API
    const fastApiUrl = new URL(FAST_API_URL);
    fastApiUrl.searchParams.set('https', 'true');
    fastApiUrl.searchParams.set('token', token);
    fastApiUrl.searchParams.set('urlCount', urlCount);
    
    console.log('Запрос к Fast.com API:', fastApiUrl.toString());
    
    // Делаем запрос к Fast.com API
    const response = await fetch(fastApiUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error('Ошибка при запросе к Fast.com API:', response.status);
      return NextResponse.json(
        { error: `Fast.com API error: ${response.status}` },
        { 
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Fast-API': 'urls-error-fast-api'
          }
        }
      );
    }
    
    // Получаем данные от Fast.com API
    const data = await response.json();
    
    console.log(`Получено ${data.targets?.length || 0} серверов от Fast.com API`);
    
    // Возвращаем данные клиенту
    return NextResponse.json(
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'X-Fast-API': 'urls-response-direct'
        }
      }
    );
  } catch (error: any) {
    console.error('Unhandled error in Fast.com URLs API:', error);
    
    // В случае ошибки возвращаем сообщение об ошибке
    return NextResponse.json({
      error: String(error),
      message: 'Failed to get servers from Fast.com API'
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Fast-API': 'urls-error-unhandled'
      }
    });
  }
} 