import { NextRequest, NextResponse } from "next/server";

/**
 * API-эндпоинт для проверки доступности серверов LibreSpeed через Nest.js бэкенд
 * В случае недоступности Nest.js, пытается проверить напрямую через прокси
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get("server");
  const noCache = searchParams.get("noCache") || Date.now().toString();

  if (!server) {
    return NextResponse.json(
      { error: "Не указан параметр server" },
      { status: 400 }
    );
  }

  try {
    // Обращаемся к API Nest.js для проверки сервера
    const nestUrl = `http://localhost:3001/api/speedtest/librespeed/check?server=${
      encodeURIComponent(server)
    }&noCache=${noCache}`;

    console.log(`🔍 Проверка сервера через Nest API: ${server}`);

    const response = await fetch(nestUrl, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      },
      next: { revalidate: 0 }
    });

    // Если Nest API ответил успешно, просто передаем его ответ
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Ответ от Nest API: ${JSON.stringify(data)}`);
      
      return NextResponse.json(data, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "no-store, max-age=0"
        }
      });
    } else {
      throw new Error(`Nest API вернул ошибку: ${response.status}`);
    }
  } catch (nestError) {
    console.warn(`⚠️ Ошибка при обращении к Nest API: ${nestError}`);
    
    // Пробуем проверить сервер напрямую через наш прокси
    try {
      const proxyUrl = `/api/speedtest-proxy?path=empty.php&server=${
        encodeURIComponent(server)
      }&t=${Date.now()}`;
      
      console.log(`🔄 Резервная проверка через прокси: ${proxyUrl}`);
      
      const proxyResponse = await fetch(new URL(proxyUrl, request.url), {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      return NextResponse.json({ 
        available: proxyResponse.ok,
        proxyCheck: true
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "no-store, max-age=0"
        }
      });
    } catch (proxyError) {
      console.error(`❌ Ошибка при проверке через прокси: ${proxyError}`);
      
      // Если все методы проверки не сработали, возвращаем ошибку
      return NextResponse.json({ 
        error: "Ошибка при проверке сервера",
        available: false,
        details: String(nestError)
      }, { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
  }
}

/**
 * Обработка OPTIONS-запросов для предварительной проверки CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    },
  });
} 