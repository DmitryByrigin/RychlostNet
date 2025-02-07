import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        // Попытка использовать основной сервис
        try {
            console.log('Trying primary service (ipdata.co)...');
            const geoResponse = await fetch(
                `https://api.ipdata.co/?api-key=63c4dfaccc7a5385fa75956c7d58ae869791a2a2a204c7f21f5034f8`,
                {
                    headers: {
                        'Accept': 'application/json',
                    }
                }
            );

            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                console.log('Successfully received data from ipdata.co');

                if (geoData && geoData.city && geoData.region && geoData.country_name) {
                    const serverData = await getServerInfo();
                    const responseData = {
                        ip: geoData.ip,
                        city: geoData.city,
                        region: geoData.region,
                        country: geoData.country_name,
                        org: geoData.asn?.name || 'Unknown Organization',
                        servers: serverData.servers,
                        source: 'ipdata.co' // Добавляем источник данных
                    };

                    return new NextResponse(JSON.stringify(responseData), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'public, max-age=3600',
                        },
                    });
                }
            }

            if (!geoResponse.ok) {
                console.log(`ipdata.co failed with status ${geoResponse.status}`);
                if (geoResponse.status === 429) {
                    console.log('Rate limit exceeded for ipdata.co');
                }
            }

            // Если ipdata.co не сработал, используем ipapi.co
            console.log('Using fallback service (ipapi.co)...');
            const fallbackResponse = await fetch('https://ipapi.co/json/');
            
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('Successfully received data from ipapi.co');
                const serverData = await getServerInfo();

                const responseData = {
                    ip: fallbackData.ip,
                    city: fallbackData.city,
                    region: fallbackData.region,
                    country: fallbackData.country_name,
                    org: fallbackData.org || 'Unknown Organization',
                    servers: serverData.servers,
                    source: 'ipapi.co' // Добавляем источник данных
                };

                return new NextResponse(JSON.stringify(responseData), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            }

            throw new Error('Both geolocation services failed');
        } catch (error) {
            console.error('Error in geolocation API:', error);
            return new NextResponse(JSON.stringify({ error: 'Failed to fetch geolocation data' }), { status: 500 });
        }
    } catch (error) {
        console.error('Error in geolocation API:', error);
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch geolocation data' }), { status: 500 });
    }
}

// Вспомогательная функция для получения информации о серверах
async function getServerInfo() {
    const serverUrls = process.env.NEXT_PUBLIC_API_SERVERS?.split(',') || [];
    const errorLogs = new Set<string>();
    let availableServers = [];

    if (serverUrls.length > 0) {
        const serverRequests = serverUrls.map(async (serverUrl) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(`${serverUrl}/speedtest/server-info`, {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return { ...data, url: serverUrl };
                } else {
                    errorLogs.add(`Server ${serverUrl} responded with status ${response.status}`);
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        errorLogs.add(`Server ${serverUrl} timed out`);
                    } else {
                        errorLogs.add(`Error fetching server info from ${serverUrl}: ${error.message}`);
                    }
                } else {
                    errorLogs.add(`Unknown error fetching server info from ${serverUrl}`);
                }
            }
            return null;
        });

        const serverResponses = await Promise.all(serverRequests);
        availableServers = serverResponses.filter((server) => server !== null);

        if (errorLogs.size > 0) {
            console.error("Server Errors:", Array.from(errorLogs));
        }
    }

    return { servers: availableServers };
}
