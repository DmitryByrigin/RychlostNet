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

        if (!userId) {
            console.log('Прямое сохранение пропущено: пользователь не авторизован');
            return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Получаем данные из запроса
        const data = await req.json();
        console.log('Прямое сохранение: получены данные:', data);

        // Проверяем наличие необходимых полей и их корректность
        const downloadSpeed = Number(data.downloadSpeed);
        const uploadSpeed = Number(data.uploadSpeed);
        const ping = Number(data.ping);

        console.log('Прямое сохранение: проверка значений:',
            { downloadSpeed, uploadSpeed, ping, 
              isNaN_downloadSpeed: isNaN(downloadSpeed),
              isNaN_uploadSpeed: isNaN(uploadSpeed),
              isNaN_ping: isNaN(ping) });

        if (isNaN(downloadSpeed) || isNaN(uploadSpeed) || isNaN(ping) || 
            downloadSpeed <= 0 || uploadSpeed <= 0 || ping <= 0) {
            console.log('Прямое сохранение: не предоставлены корректные числовые значения');
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

        // Создаем запись в базе данных
        console.log('Прямое сохранение: сохраняем в БД для пользователя', userId);
        
        // Сохраняем результаты теста, используя только поля из схемы Prisma
        const testRecord = await db.speedTestHistory.create({
            data: {
                downloadSpeed: downloadSpeed,
                uploadSpeed: uploadSpeed,
                ping: ping,
                // Используем комбинацию информации о сервере и местоположении пользователя
                location: `${data.userLocation} -> ${data.serverName}`,
                isp: data.isp || 'Unknown',
                userId: userId,
                // Добавляем дополнительные поля для хранения в базе данных
                serverName: data.serverName || 'Unknown',
                serverLocation: data.serverLocation || 'Unknown',
                userLocation: data.userLocation || 'Unknown',
                jitter: data.jitter || 0
            }
        });

        console.log('Прямое сохранение: результаты успешно сохранены');
        
        return new NextResponse(JSON.stringify({ 
            success: true,
            message: 'Speed test results saved directly',
            id: testRecord.id
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Ошибка при прямом сохранении результатов теста:', error);
        return new NextResponse(JSON.stringify({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error' 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 