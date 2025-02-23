import { NextRequest, NextResponse } from 'next/server';
import { Server } from '@/app/dashboard/speedtest/types/geolocation';
import axios from 'axios';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const backendUrl = process.env.NEXT_PUBLIC_API_SERVERS || 'http://localhost:3001';
        console.log('Fetching server info from:', backendUrl);
        
        const response = await axios.get(`${backendUrl}/speedtest/server-info`, {
            headers: {
                'Accept': 'application/json'
            },
            timeout: 5000
        });

        if (!response.data) {
            throw new Error(`Backend responded with empty data`);
        }

        // Преобразуем данные в формат Server
        const serverInfo = response.data;
        const server: Server = {
            name: serverInfo.name,
            sponsor: serverInfo.sponsor,
            url: serverInfo.url,
            lat: serverInfo.location.lat,
            lon: serverInfo.location.lon,
            distance: 0,
            country: serverInfo.location.country,
            cc: 'SK', // Hardcoded for now
            id: '1', // Hardcoded for now
            host: serverInfo.url,
            location: {
                city: serverInfo.location.city,
                region: serverInfo.location.region,
                country: serverInfo.location.country,
                org: serverInfo.location.org
            }
        };

        return new NextResponse(JSON.stringify({ servers: [server] }), {
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
        
        // Определяем тип ошибки и извлекаем нужную информацию
        let errorMessage = 'Unknown error';
        let errorCode = 'UNKNOWN';
        
        if (error instanceof Error) {
            errorMessage = error.message;
            // Проверяем, является ли это ошибкой Axios
            if (axios.isAxiosError(error)) {
                errorCode = error.code || String(error.response?.status) || 'NETWORK_ERROR';
                // Добавляем дополнительную информацию от Axios
                errorMessage = error.response?.data?.message || error.message;
            }
        }
        
        return new NextResponse(JSON.stringify({ 
            error: 'Internal Server Error',
            details: errorMessage,
            code: errorCode
        }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
