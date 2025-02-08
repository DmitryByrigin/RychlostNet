import {NextRequest, NextResponse} from 'next/server';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const serverData = await getServerInfo();
        console.log(serverData);

        console.log('Trying primary service (ipdata.co)...');
        const geoResponse = await fetch(
            `https://api.ipdata.co/?api-key=63c4dfaccc7a5385fa75956c7d58ae869791a2a2a204c7f21f5034f8`,
            {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }
        );

        if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            console.log('Successfully received data from ipdata.co');

            if (geoData && geoData.city && geoData.region && geoData.country_name) {
                // const serverData = await getServerInfo();
                const responseData = {
                    ip: geoData.ip,
                    city: geoData.city,
                    region: geoData.region,
                    country: geoData.country_name,
                    org: geoData.asn?.name || 'Unknown Organization',
                    servers: serverData.servers,
                    source: 'ipdata.co'
                };

                return new NextResponse(JSON.stringify(responseData), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                });
            }
        }

        // Если первичный сервис не сработал, логируем ошибку
        console.log(`ipdata.co failed with status ${geoResponse.status}`);
        if (geoResponse.status === 429) {
            console.log('Rate limit exceeded for ipdata.co');
        }

        // Добавляем задержку перед использованием следующего сервиса
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Пробуем резервный сервис
        console.log('Using fallback service (ipapi.co)...');
        let fallbackResponse;
        try {
            fallbackResponse = await fetch('https://ipapi.co/json/', {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            console.log(`ipapi.co response status: ${fallbackResponse.status}`);
            
            if (!fallbackResponse.ok) {
                console.error(`ipapi.co failed with status ${fallbackResponse.status}`);
                throw new Error(`ipapi.co returned status ${fallbackResponse.status}`);
            }

            const fallbackData = await fallbackResponse.json();
            
            // Проверяем наличие необходимых полей в ответе
            if (!fallbackData.ip || !fallbackData.city || !fallbackData.region || !fallbackData.country_name) {
                console.error('ipapi.co returned incomplete data:', fallbackData);
                throw new Error('Incomplete data received from ipapi.co');
            }

            console.log('Successfully received data from ipapi.co');
            // const serverData = await getServerInfo();

            const responseData = {
                ip: fallbackData.ip,
                city: fallbackData.city,
                region: fallbackData.region,
                country: fallbackData.country_name,
                org: fallbackData.org || 'Unknown Organization',
                servers: serverData.servers,
                source: 'ipapi.co'
            };

            return new NextResponse(JSON.stringify(responseData), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
            });
        } catch (fallbackError: unknown) {
            console.error('Error with fallback service (ipapi.co):', fallbackError);
            // Если оба сервиса не сработали, возвращаем детальную ошибку
            throw new Error(`Both geolocation services failed. Primary: ${geoResponse.status}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error in geolocation API:', error);
        return new NextResponse(JSON.stringify({ 
            error: 'Failed to fetch geolocation data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }), { status: 500 });
    }
}

// Вспомогательная функция для получения информации о серверах
async function getServerInfo() {
    const serverUrls = process.env.NEXT_PUBLIC_API_SERVERS?.split(',') || [];
    console.log('Starting server info fetch...');
    const errorLogs = new Set<string>();
    let availableServers = [];

    if (serverUrls.length > 0) {
        const serverRequests = serverUrls.map(async (serverUrl) => {
            const controller = new AbortController();
            // Увеличиваем таймаут до 15 секунд
            const timeoutId = setTimeout(() => {
                console.log(`Timeout reached for server ${serverUrl}`);
                controller.abort();
            }, 15000);

            try {
                console.log(`Fetching server info from: ${serverUrl}`);
                const startTime = Date.now();
                const response = await fetch(`${serverUrl}/speedtest/server-info`, {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                const endTime = Date.now();
                console.log(`Response received from ${serverUrl} in ${endTime - startTime}ms`);
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`Successfully parsed data from ${serverUrl}`);
                    return { ...data, url: serverUrl };
                } else {
                    const error = `Server ${serverUrl} responded with status ${response.status}`;
                    console.error(error);
                    errorLogs.add(error);
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    const errorMsg = error.name === 'AbortError'
                        ? `Server ${serverUrl} timed out after 15 seconds`
                        : `Error fetching server info from ${serverUrl}: ${error.message}`;
                    console.error(errorMsg);
                    errorLogs.add(errorMsg);
                } else {
                    const errorMsg = `Unknown error fetching server info from ${serverUrl}`;
                    console.error(errorMsg);
                    errorLogs.add(errorMsg);
                }
            }
            return null;
        });

        console.log('Waiting for all server responses...');
        availableServers = await Promise.all(serverRequests);

        if (errorLogs.size > 0) {
            console.error("Server Errors:", Array.from(errorLogs));
        }
        console.log(`Found ${availableServers.length} available servers:`, availableServers);
    } else {
        console.warn('No server URLs provided in environment variable NEXT_PUBLIC_API_SERVERS');
    }

    return { servers: availableServers };
}
