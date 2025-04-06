import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';
import { db } from '@/lib/db';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        
        const {
            downloadSpeed,
            uploadSpeed,
            ping,
            userLocation,
            serverLocation,
            serverName,
            isp,
        } = await req.json();

        if (!serverLocation || !serverName) {
            return new NextResponse(
                JSON.stringify({ error: 'Server data is incomplete' }),
                { status: 400 }
            );
        }

        // Если пользователь авторизован, сохраняем результаты
        if (session && session.user.id) {
            await prisma.speedTestHistory.create({
                data: {
                    downloadSpeed,
                    uploadSpeed,
                    ping,
                    userLocation,
                    serverLocation,
                    serverName,
                    isp,
                    userId: session.user.id,
                },
            });
        }

        // Возвращаем результаты всем пользователям
        return NextResponse.json({
            downloadSpeed,
            uploadSpeed,
            ping,
            userLocation,
            serverLocation,
            serverName,
            isp
        }, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/speedtest:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        console.log('Deleting all records');
        const result = await db.speedTestHistory.deleteMany({});
        return new NextResponse(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error deleting records:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function GET() {
    try {
        const session = await auth();
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const result = await prisma.speedTestHistory.findMany({
            where: { userId: session.user.id },
            orderBy: { timestamp: 'desc' },
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('Error in GET /api/speedtest:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
