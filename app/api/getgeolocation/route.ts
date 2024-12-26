import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        // Запрашиваем данные геолокации через ipdata.co
        const geoResponse = await fetch(
            `https://api.ipdata.co/?api-key=63c4dfaccc7a5385fa75956c7d58ae869791a2a2a204c7f21f5034f8`
        );
        const geoData = await geoResponse.json();
        if (!geoResponse.ok || !geoData.city || !geoData.region || !geoData.country_name) {
            console.warn('Primary geolocation service failed or returned incomplete data, trying alternative service.');
            const alternativeGeoResponse = await fetch('https://ipapi.co/json');
            if (!alternativeGeoResponse.ok) {
                throw new Error(`Failed to fetch alternative geolocation: ${alternativeGeoResponse.statusText}`);
            }
            const alternativeGeoData = await alternativeGeoResponse.json();
            return new NextResponse(JSON.stringify(alternativeGeoData), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Log user's IP address
        console.log(`Request from IP address: ${geoData.ip}`);

        const serverUrls = process.env.NEXT_PUBLIC_API_SERVERS?.split(',') || [];
        const errorLogs = new Set<string>();

        let availableServers = [];
        if (serverUrls.length > 0) {
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
            availableServers = serverResponses.filter((server) => server !== null);

            if (errorLogs.size > 0) {
                console.error("Server Errors:", Array.from(errorLogs));
            }
        }

        const responseData = {
            ip: geoData.ip,
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
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error in geolocation API:', error);
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch geolocation data' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
