import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';
import { db } from '@/lib/db';

const prisma = new PrismaClient();

async function getUserLocation(ip: string) {
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return `${data.city || ''}, ${data.regionName || ''}, ${data.country || ''}`.replace(/^[, ]+|[, ]+$/g, '');
        }
        return 'Unknown';
    } catch (error) {
        console.error('Error getting user location:', error);
        return 'Unknown';
    }
}

export async function POST(req: NextRequest) {
    try {
        // Получаем информацию о текущем пользователе
        const session = await auth();
        const userId = session?.user?.id;

        console.log('Current session:', {
            userId,
            isAuthenticated: !!session,
            user: session?.user
        });

        // Получаем IP пользователя
        const forwardedFor = req.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Unknown';
        
        console.log('User IP:', ip);

        // Получаем местоположение пользователя
        const userLocation = await getUserLocation(ip);
        console.log('User location:', userLocation);

        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const serverInfoStr = formData.get('serverInfo') as string;
        const cliTestDataStr = formData.get('cliTestData') as string;
        
        let cliTestData = null;
        if (cliTestDataStr) {
            try {
                cliTestData = JSON.parse(cliTestDataStr);
            } catch (error) {
                console.warn('Failed to parse CLI test data:', error);
            }
        }

        if (!files || files.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No files provided' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const serverInfo = serverInfoStr ? JSON.parse(serverInfoStr) : null;
        console.log('Processing speed test with server:', serverInfo);

        const downloadResults: number[] = [];
        const uploadResults: number[] = [];
        const results: any[] = [];
        const pingTimes: number[] = [];

        // Обработка результатов загрузки и скачивания
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const match = file.name.match(/noiseData_(\d+)\.bin/);
            const originalSize = match ? parseInt(match[1], 10) : buffer.length;

            // Измеряем время загрузки
            const uploadStartTime = performance.now();
            await new Promise(resolve => setTimeout(resolve, 100)); // Симуляция загрузки
            const uploadEndTime = performance.now();
            const uploadTime = uploadEndTime - uploadStartTime;
            const uploadSpeed = (originalSize / uploadTime) * 1000 / (1024 * 1024); // МБ/с

            // Измеряем время скачивания
            const downloadStartTime = performance.now();
            await new Promise(resolve => setTimeout(resolve, 100)); // Симуляция скачивания
            const downloadEndTime = performance.now();
            const downloadTime = downloadEndTime - downloadStartTime;
            const downloadSpeed = (originalSize / downloadTime) * 1000 / (1024 * 1024); // МБ/с

            downloadResults.push(downloadSpeed);
            uploadResults.push(uploadSpeed);
            pingTimes.push(downloadTime);

            results.push({
                fileName: file.name,
                size: originalSize,
                downloadSpeed,
                uploadSpeed,
                ping: downloadTime
            });
        }

        // Расчет средних значений
        const avgDownloadSpeed = downloadResults.reduce((a, b) => a + b, 0) / downloadResults.length;
        const avgUploadSpeed = uploadResults.reduce((a, b) => a + b, 0) / uploadResults.length;
        
        // Расчет пинга и джиттера
        const avgPing = pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length;
        const jitter = Math.sqrt(
            pingTimes.reduce((acc, ping) => acc + Math.pow(ping - avgPing, 2), 0) / pingTimes.length
        );

        // Корректировка результатов с учетом CLI теста
        let finalDownloadSpeed = avgDownloadSpeed;
        let finalUploadSpeed = avgUploadSpeed;
        let finalPing = avgPing;
        let finalJitter = jitter;

        if (cliTestData && typeof cliTestData === 'object') {
            // Парсим значения из CLI теста
            const cliDownloadMbps = parseFloat(cliTestData.downloadSpeed?.replace(' Mbps', '') || '0');
            const cliUploadMbps = parseFloat(cliTestData.uploadSpeed?.replace(' Mbps', '') || '0');
            const cliPing = cliTestData.ping?.avg || 0;
            const cliJitter = cliTestData.ping?.jitter || 0;

            console.log('CLI Test Values:', {
                download: cliDownloadMbps,
                upload: cliUploadMbps,
                ping: cliPing,
                jitter: cliJitter
            });

            console.log('Regular Test Values:', {
                download: avgDownloadSpeed,
                upload: avgUploadSpeed,
                ping: avgPing,
                jitter
            });

            // Если значения CLI теста слишком сильно отличаются от обычного теста,
            // используем более консервативный подход
            const downloadRatio = Math.max(cliDownloadMbps, avgDownloadSpeed) / 
                                Math.min(cliDownloadMbps, avgDownloadSpeed);
            const uploadRatio = Math.max(cliUploadMbps, avgUploadSpeed) / 
                              Math.min(cliUploadMbps, avgUploadSpeed);

            if (downloadRatio > 5 || uploadRatio > 5) {
                // Если разница больше чем в 5 раз, берем минимальное значение
                finalDownloadSpeed = Math.min(cliDownloadMbps, avgDownloadSpeed);
                finalUploadSpeed = Math.min(cliUploadMbps, avgUploadSpeed);
            } else {
                // Иначе используем взвешенное среднее с большим весом для меньшего значения
                const weight = downloadRatio > 2 ? 0.8 : 0.7;
                finalDownloadSpeed = Math.min(cliDownloadMbps, avgDownloadSpeed) * weight +
                                   Math.max(cliDownloadMbps, avgDownloadSpeed) * (1 - weight);
                finalUploadSpeed = Math.min(cliUploadMbps, avgUploadSpeed) * weight +
                                 Math.max(cliUploadMbps, avgUploadSpeed) * (1 - weight);
            }

            // Для пинга всегда берем минимальное значение, так как меньший пинг более вероятен
            finalPing = Math.min(cliPing, avgPing);
            finalJitter = (cliJitter + jitter) / 2;

            console.log('Final Adjusted Values:', {
                download: finalDownloadSpeed,
                upload: finalUploadSpeed,
                ping: finalPing,
                jitter: finalJitter
            });
        }

        const response = {
            results,
            downloadSpeed: `${finalDownloadSpeed.toFixed(2)} Mbps`,
            uploadSpeed: `${finalUploadSpeed.toFixed(2)} Mbps`,
            ping: {
                min: Math.min(...pingTimes, finalPing).toFixed(2),
                max: Math.max(...pingTimes, finalPing).toFixed(2),
                avg: finalPing.toFixed(2),
                jitter: finalJitter.toFixed(2)
            },
            cliTestApplied: !!cliTestData
        };

        // Сохраняем результаты в базу данных
        try {
            // Получаем геолокацию сервера из serverInfo.location
            const serverLocation = serverInfo?.location;
            const serverLocationString = serverLocation ? 
                `${serverLocation.city || ''}, ${serverLocation.region || ''}, ${serverLocation.country || ''}`.replace(/^[, ]+|[, ]+$/g, '') : 
                'Unknown';

            // Получаем геолокацию пользователя из userLocationData в serverInfo
            const userLocationData = serverInfo?.userLocation;
            const userLocationString = userLocationData ? 
                `${userLocationData.city || ''}, ${userLocationData.region || ''}, ${userLocationData.country || ''}`.replace(/^[, ]+|[, ]+$/g, '') : 
                'Unknown';

            // Создаем запись в истории только если есть userId
            if (userId) {
                console.log('Saving test results to history for user:', userId);
                console.log('Location data:', {
                    userLocation: userLocationString,
                    serverLocation: serverLocationString,
                    serverInfo: serverInfo
                });
                
                await db.speedTestHistory.create({
                    data: {
                        downloadSpeed: finalDownloadSpeed,
                        uploadSpeed: finalUploadSpeed,
                        ping: finalPing,
                        jitter: finalJitter || 0,
                        serverName: serverInfo?.name || 'Unknown',
                        serverLocation: serverLocationString,
                        userLocation: userLocationString,
                        isp: userLocationData?.org || serverInfo?.isp || 'Unknown',
                        userId: userId
                    }
                });
                console.log('Test results saved successfully');
            } else {
                console.log('Skipping history save - user not authenticated');
            }
        } catch (dbError) {
            console.error('Failed to save test results to database:', dbError);
        }

        return new NextResponse(JSON.stringify(response), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Speed test error:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function GET(req: NextRequest) {
    try {
        // Получаем информацию о текущем пользователе
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Получаем историю тестов для текущего пользователя
        const history = await db.speedTestHistory.findMany({
            where: {
                userId: userId
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        return new NextResponse(JSON.stringify(history), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching speed test history:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        // Получаем информацию о текущем пользователе
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Проверяем, это удаление одного теста или всех
        const url = new URL(req.url);
        const pathParts = url.pathname.split('/');
        const testId = pathParts[pathParts.length - 1];

        if (testId && testId !== 'speedtest') {
            // Удаляем конкретный тест
            await db.speedTestHistory.deleteMany({
                where: {
                    id: testId,
                    userId: userId
                }
            });
        } else {
            // Удаляем все тесты пользователя
            await db.speedTestHistory.deleteMany({
                where: {
                    userId: userId
                }
            });
        }

        return new NextResponse(JSON.stringify({ success: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error deleting speed test history:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
