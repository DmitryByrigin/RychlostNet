import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        // Запрашиваем данные геолокации через ipstack
        const geoResponse = await fetch(
            `https://api.ipdata.co/?api-key=63c4dfaccc7a5385fa75956c7d58ae869791a2a2a204c7f21f5034f8`
        );
        if (!geoResponse.ok) {
            throw new Error(`Failed to fetch geolocation: ${geoResponse.statusText}`);
        }
        const geoData = await geoResponse.json();

        // Читаем список серверов из переменной окружения
        const serverUrls = process.env.NEXT_PUBLIC_API_SERVERS?.split(',') || [];
        if (serverUrls.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No servers available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Для сбора ошибок
        const errorLogs = new Set(); // Храним уникальные ошибки

        // Параллельные запросы к серверам с таймаутом для проверки доступности
        const serverRequests = serverUrls.map(async (serverUrl) => {
            try {
                const response = await fetch(`${serverUrl}/speedtest/server-info`, { timeout: 5000 });
                if (response.ok) {
                    const data = await response.json();
                    return { ...data, url: serverUrl }; // Добавляем URL для идентификации
                }
                console.log(`Server ${serverUrl} responded with status ${response.status}`);
            } catch (error) {
                console.log(`Error fetching server info from ${serverUrl}: ${error.message}`);
            }
            return null; // Сервер не доступен, возвращаем null
        });

        // Ожидание всех запросов
        const serverResponses = await Promise.all(serverRequests);

        // Логируем уникальные ошибки
        if (errorLogs.size > 0) {
            console.error("Server Errors:", Array.from(errorLogs));
        }

        // Фильтруем только доступные серверы
        const availableServers = serverResponses.filter((server) => server !== null);

        // Если нет доступных серверов
        if (availableServers.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No available servers' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Формируем финальный ответ
        const responseData = {
            city: geoData.city,
            region: geoData.region, // Название региона в ipstack доступно через region_name
            country: geoData.country_name,
            org: geoData.asn?.name || 'Unknown Organization', // Альтернативы на случай отсутствия данных
            servers: availableServers,
        };

        console.log('Geolocation data:', responseData);

        return new NextResponse(JSON.stringify(responseData), {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        console.error('Error processing request:', error);
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch data' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
