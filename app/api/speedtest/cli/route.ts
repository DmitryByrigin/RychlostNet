import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        // Получаем первый сервер из списка
        const servers = process.env.NEXT_PUBLIC_API_SERVERS?.split(',') || [];
        const backendUrl = servers[0];
        
        if (!backendUrl) {
            console.error('No API servers configured');
            return NextResponse.json({ error: 'Backend URL is not configured' }, { status: 500 });
        }

        console.log('Processing CLI speed test request');
        const cliTestUrl = `${backendUrl}/speedtest/cli`;
        console.log('Sending request to:', cliTestUrl);

        // Отправляем запрос к Nest.js бэкенду для CLI теста
        const cliResponse = await fetch(cliTestUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!cliResponse.ok) {
            const errorText = await cliResponse.text();
            console.error('CLI test error:', {
                status: cliResponse.status,
                statusText: cliResponse.statusText,
                error: errorText
            });
            throw new Error(`CLI test failed: ${errorText}`);
        }

        const cliResult = await cliResponse.json();
        console.log('CLI test completed successfully:', cliResult);
        return NextResponse.json(cliResult);
    } catch (error: any) {
        console.error('Error in CLI speed test:', error);
        return NextResponse.json(
            { error: error.message || 'Speed test failed' },
            { status: error.status || 500 }
        );
    }
}
