import { NextRequest, NextResponse } from 'next/server';
import { Server } from '@/app/dashboard/speedtest/types/geolocation';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const serverData = await getServerInfo();
        console.log(serverData);

        // Возвращаем только информацию о серверах
        const responseData = {
            servers: serverData.servers,
            source: 'server-info'
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
    } catch (error) {
        console.error('Error in getgeolocation:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}

// Вспомогательная функция для получения информации о серверах
async function getServerInfo(): Promise<{ servers: Server[] }> {
    const serverUrl = process.env.APP_SERVER_URL || 'http://localhost:3000';
    const sponsor = process.env.SPONSOR || 'BBXNET';
    const organization = process.env.ORGANIZATION || 'BBXNET s. r. o.';

    return {
        servers: [
            {
                url: serverUrl,
                lat: 59.938629150390625,
                lon: 30.314130783081055,
                distance: 0,
                name: process.env.NAME || 'Test BBXNET Server - Development',
                country: 'Russia',
                cc: 'Russia',
                sponsor: sponsor,
                id: '1',
                host: '62.76.233.48',
                location: {
                    city: 'Saint Petersburg',
                    region: 'St. Petersburg',
                    country: 'Russia',
                    org: organization
                }
            }
        ]
    };
}
