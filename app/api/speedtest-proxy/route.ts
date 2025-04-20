import { NextRequest, NextResponse } from "next/server";

/**
 * Универсальный прокси для запросов к серверам LibreSpeed
 * Решает проблемы с CORS при тестировании скорости напрямую из браузера
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "empty.php";
  const server = searchParams.get("server");

  if (!server) {
    console.error("❌ Ошибка прокси: не указан сервер");
    return NextResponse.json(
      { error: "Не указан параметр server" },
      { status: 400 }
    );
  }

  // Инициализируем переменную до блока try-catch
  let fullUrl = getFullUrl(server, path);

  try {
    console.log(`🔄 Прокси GET: ${fullUrl}`);

    // Диагностика для запросов на тест загрузки
    if (path.includes("garbage.php")) {
      console.log(`📊 Запрос на тест загрузки: ${fullUrl}`);
    }

    // Копируем некоторые заголовки из исходного запроса
    const headers = new Headers();
    const headersToForward = [
      "accept",
      "content-type",
      "user-agent",
      "referer"
    ];

    headersToForward.forEach((header) => {
      const value = request.headers.get(header);
      if (value) headers.set(header, value);
    });

    // Добавляем заголовки для обхода кеширования
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    // Создаем контроллер для прерывания запроса по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд таймаут

    try {
      // Выполняем запрос к целевому серверу
      const response = await fetch(fullUrl, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      // Очищаем таймаут
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ Ошибка прокси: сервер вернул ${response.status}: ${response.statusText}`);
        throw new Error(`Сервер вернул ошибку: ${response.status} ${response.statusText}`);
      }

      // Для garbage.php логируем информацию о размере и типе данных
      if (path.includes("garbage.php")) {
        const contentLength = response.headers.get("Content-Length");
        const contentType = response.headers.get("Content-Type");
        console.log(`📦 Ответ от сервера для garbage.php: Content-Length=${contentLength}, Content-Type=${contentType}`);
        
        // Клонируем ответ чтобы прочитать его размер, не затрагивая основной ответ
        const clonedResponse = response.clone();
        const arrayBuffer = await clonedResponse.arrayBuffer();
        console.log(`📦 Получено ${arrayBuffer.byteLength} байт данных для garbage.php`);
      }

      // Создаем новый ответ с CORS-заголовками
      const responseBody = await response.blob();
      const newResponse = new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
          "Content-Type": response.headers.get("Content-Type") || "text/plain",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
      });

      return newResponse;
    } catch (fetchError) {
      // Очищаем таймаут в случае ошибки
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    // Подробное логирование ошибок для диагностики
    console.error("❌ Ошибка прокси GET:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : null;
    const isTimeoutError = error instanceof Error && error.name === 'AbortError';
    
    console.error("🔍 Подробности ошибки:", {
      url: fullUrl,
      error: errorMessage,
      stack: errorStack,
      type: typeof error,
      isTimeout: isTimeoutError
    });

    // Возвращаем подробную информацию об ошибке
    return NextResponse.json({
      error: isTimeoutError ? "Таймаут запроса" : "Ошибка при обработке запроса",
      details: errorMessage,
      url: fullUrl
    }, {
      status: isTimeoutError ? 504 : 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
  }
}

/**
 * Обработка POST-запросов для тестирования выгрузки (upload)
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "empty.php";
  const server = searchParams.get("server");

  if (!server) {
    console.error("❌ Ошибка прокси: не указан сервер");
    return NextResponse.json(
      { error: "Не указан параметр server" },
      { status: 400 }
    );
  }

  // Инициализируем переменную до блока try-catch
  let fullUrl = getFullUrl(server, path);

  try {
    console.log(`🔄 Прокси POST: ${fullUrl}`);

    // Копируем заголовки из исходного запроса
    const headers = new Headers();
    const headersToForward = [
      "accept",
      "content-type",
      "user-agent",
      "referer"
    ];

    headersToForward.forEach((header) => {
      const value = request.headers.get(header);
      if (value) headers.set(header, value);
    });

    // Добавляем заголовки для обхода кеширования
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    // Получаем тело запроса
    const body = await request.blob();

    // Создаем контроллер для прерывания запроса по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд таймаут

    try {
      // Выполняем запрос к целевому серверу
      const response = await fetch(fullUrl, {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        signal: controller.signal,
      });

      // Очищаем таймаут
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ Ошибка прокси: сервер вернул ${response.status}: ${response.statusText}`);
        throw new Error(`Сервер вернул ошибку: ${response.status} ${response.statusText}`);
      }

      // Создаем новый ответ с CORS-заголовками
      const responseBody = await response.blob();
      const newResponse = new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
          "Content-Type": response.headers.get("Content-Type") || "text/plain",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
      });

      return newResponse;
    } catch (fetchError) {
      // Очищаем таймаут в случае ошибки
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    // Подробное логирование ошибок для диагностики
    console.error("❌ Ошибка прокси POST:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : null;
    const isTimeoutError = error instanceof Error && error.name === 'AbortError';
    
    console.error("🔍 Подробности ошибки:", {
      url: fullUrl,
      error: errorMessage,
      stack: errorStack,
      type: typeof error,
      isTimeout: isTimeoutError
    });

    // Возвращаем подробную информацию об ошибке
    return NextResponse.json({
      error: isTimeoutError ? "Таймаут запроса" : "Ошибка при обработке запроса",
      details: errorMessage,
      url: fullUrl
    }, {
      status: isTimeoutError ? 504 : 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    },
  });
}

/**
 * Вспомогательная функция для формирования полного URL
 * Обрабатывает различные форматы серверов и путей
 */
function getFullUrl(server: string, path: string): string {
  // Удаляем завершающие слеши из сервера
  const cleanServer = server.replace(/\/+$/, '');
  
  // Проверяем, содержит ли сервер протокол
  const hasProtocol = cleanServer.startsWith('http://') || cleanServer.startsWith('https://');
  
  // Добавляем протокол, предпочитая https
  const serverWithProtocol = hasProtocol ? cleanServer : `https://${cleanServer}`;
  
  // Подготавливаем путь
  let finalPath = path;
  // Если путь не начинается с "/", добавляем его
  if (!finalPath.startsWith('/')) {
    finalPath = `/${finalPath}`;
  }
  
  // Проверяем, нужно ли добавлять "backend" к пути
  const needsBackendPrefix = !serverWithProtocol.includes('.backend.') && 
                            !serverWithProtocol.includes('/backend') &&
                            !finalPath.includes('backend/') && 
                            !finalPath.startsWith('/backend/');
  
  // Добавляем "/backend" к пути, если нужно
  if (needsBackendPrefix) {
    finalPath = `/backend${finalPath}`;
  }
  
  // Логируем формирование URL
  console.log(`🔍 URL: сервер=${serverWithProtocol}, путь=${finalPath}, добавлен prefix backend=${needsBackendPrefix}`);
  
  // Добавляем параметры для обхода кеширования и проблем с CORS
  const cacheBuster = Date.now();
  let finalUrl = `${serverWithProtocol}${finalPath}`;
  
  // Добавляем параметры к URL
  finalUrl += finalPath.includes('?') ? '&' : '?';
  finalUrl += `cors=true&_=${cacheBuster}`;
  
  return finalUrl;
} 