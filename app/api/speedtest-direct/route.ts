import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

/**
 * Прямой API для сохранения результатов теста скорости
 * Без использования файлов и промежуточных измерений
 */
export async function POST(req: NextRequest) {
    try {
        // Получаем информацию о текущем пользователе
        const session = await auth();
        const userId = session?.user?.id;

        // Если пользователь не авторизован, просто возвращаем ошибку без сохранения
        if (!userId) {
            console.log('Пользователь не авторизован, результаты НЕ будут сохранены');
            return new NextResponse(JSON.stringify({ 
                error: 'Unauthorized',
                message: 'You must be logged in to save test results'
            }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Получаем данные из запроса
        const data = await req.json();
        console.log('Получены данные для сохранения:', data);

        // Проверяем наличие необходимых полей и их корректность
        const downloadSpeed = Number(data.downloadSpeed);
        const uploadSpeed = Number(data.uploadSpeed);
        const ping = Number(data.ping);

        console.log('Проверка значений:', 
            { downloadSpeed, uploadSpeed, ping });

        if (isNaN(downloadSpeed) || isNaN(uploadSpeed) || isNaN(ping) || 
            downloadSpeed <= 0 || uploadSpeed <= 0 || ping <= 0) {
            console.log('Не предоставлены корректные числовые значения');
            return new NextResponse(JSON.stringify({ 
                error: 'Missing required fields',
                details: {
                    downloadSpeed: isNaN(downloadSpeed) ? 'Not a number' : (downloadSpeed <= 0 ? 'Must be positive' : 'OK'),
                    uploadSpeed: isNaN(uploadSpeed) ? 'Not a number' : (uploadSpeed <= 0 ? 'Must be positive' : 'OK'),
                    ping: isNaN(ping) ? 'Not a number' : (ping <= 0 ? 'Must be positive' : 'OK')
                }
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Проверяем существование пользователя
        const userExists = await db.user.findUnique({
            where: { id: userId }
        });
        
        if (!userExists) {
            console.log('Пользователь с ID не найден:', userId);
            return new NextResponse(JSON.stringify({ 
                error: 'User not found',
                message: 'Your user account could not be found'
            }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Сохраняем результаты с привязкой к пользователю
        console.log('Сохраняем результаты в БД для пользователя:', userId);
        
        // Логируем полученные значения для отладки
        console.log('User location:', data.userLocation);
        console.log('ISP:', data.isp);
        
        const testRecord = await db.speedTestHistory.create({
            data: {
                downloadSpeed: downloadSpeed,
                uploadSpeed: uploadSpeed,
                ping: ping,
                location: `${data.userLocation} -> ${data.serverName}`,
                isp: data.isp || 'Unknown',
                userId: userId,
                serverName: data.serverName || 'Unknown',
                serverLocation: data.serverLocation || 'Unknown',
                userLocation: data.userLocation || 'Unknown',
                jitter: typeof data.jitter === 'number' ? data.jitter : 0,
                testType: 'combined'
            }
        });
        
        console.log('Результаты успешно сохранены с ID:', testRecord.id);
        
        return new NextResponse(JSON.stringify({ 
            success: true,
            message: 'Speed test results saved successfully',
            id: testRecord.id
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Ошибка при сохранении результатов теста:', error);
        return new NextResponse(JSON.stringify({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error' 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 