import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth'; // Import authorization
import { db } from '@/lib/db';

const prisma = new PrismaClient();


export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Данные от клиента
        const {
            downloadSpeed,
            uploadSpeed,
            ping,
            userLocation, // Местоположение пользователя
            serverLocation, // Местоположение сервера
            serverName,     // Имя сервера
            isp,
        } = await req.json();

        // Проверка обязательных данных
        if (!serverLocation || !serverName) {
            return new NextResponse(
                JSON.stringify({ error: 'Server data is incomplete' }),
                { status: 400 }
            );
        }

        // Сохраняем в БД данные с правильным форматом
        const result = await prisma.speedTestHistory.create({
            data: {
                downloadSpeed,
                uploadSpeed,
                ping,
                userLocation, // Местоположение пользователя
                serverLocation, // Местоположение сервера
                serverName,
                isp,
                userId: session.user.id,
            },
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/speedtest:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


export async function DELETE(req: NextRequest) {
    try {
        console.log('Deleting all records');
        const result = await db.speedTestHistory.deleteMany({});
        return new NextResponse(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error deleting records:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}


export async function GET(req: NextRequest) {
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
