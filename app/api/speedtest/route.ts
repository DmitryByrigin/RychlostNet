import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth'; // Обновляем импорт

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const session = await auth();
        if (!session || !session.user.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { downloadSpeed, uploadSpeed, ping, location, isp } = await req.json();
        const result = await prisma.speedTestHistory.create({
            data: {
                downloadSpeed,
                uploadSpeed,
                ping,
                location,
                isp,
                userId: session.user.id, // Сохраняем userId
            },
        });
        return new NextResponse(JSON.stringify(result), { status: 201, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error in POST /api/speedtest:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const session = await auth(); // Используем auth для получения сессии
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const result = await prisma.speedTestHistory.findMany({
            where: { userId: session.user.id }, // Фильтруем по userId
            orderBy: { timestamp: 'desc' },
        });
        return new NextResponse(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error in GET /api/speedtest:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
