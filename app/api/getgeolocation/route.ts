import { NextRequest, NextResponse } from 'next/server';
import { Server } from '@/app/dashboard/speedtest/types/geolocation';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const backendUrl = process.env.NEXT_PUBLIC_API_SERVERS || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/speedtest/server-info`);
        if (!response.ok) {
            throw new Error(`Backend responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        return new NextResponse(JSON.stringify(data), {
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
