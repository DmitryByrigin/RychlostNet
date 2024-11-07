import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        // Fetch geolocation data
        const geoResponse = await fetch('https://ipapi.co/json/');
        const geoData = await geoResponse.json();

        // Fetch server list from Speedtest API
        const serversResponse = await fetch('https://www.speedtest.net/api/js/servers?engine=js&limit=10&https_functional=true');
        const servers = await serversResponse.json();

        const data = {
            ip: geoData.ip,
            city: geoData.city,
            region: geoData.region,
            country: geoData.country,
            org: geoData.org,
            servers
        };

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch data' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
