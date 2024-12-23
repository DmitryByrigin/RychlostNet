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

        const serverUrls = process.env.NEXT_PUBLIC_API_SERVERS?.split(',') || [];
        if (serverUrls.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No servers available' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const errorLogs = new Set<string>();

        const serverRequests = serverUrls.map(async (serverUrl) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Таймаут 5 секунд

            try {
                const response = await fetch(`${serverUrl}/speedtest/server-info`, {
                    signal: controller.signal,
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

        if (errorLogs.size > 0) {
            console.error("Server Errors:", Array.from(errorLogs));
        }

        const availableServers = serverResponses.filter((server) => server !== null);

        if (availableServers.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No available servers' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const responseData = {
            city: geoData.city,
            region: geoData.region,
            country: geoData.country_name,
            org: geoData.asn?.name || 'Unknown Organization',
            servers: availableServers,
        };


        return new NextResponse(JSON.stringify(responseData), {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Error processing request:', error.message);
            return new NextResponse(JSON.stringify({ error: 'Failed to fetch data' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            console.error('Unknown error:', error);
            return new NextResponse(JSON.stringify({ error: 'Unknown error occurred' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
}
