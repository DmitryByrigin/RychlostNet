import { NextRequest, NextResponse } from 'next/server';

// Указываем, что маршрут должен быть динамическим
export const dynamic = 'force-dynamic';

// Фиксированный токен для Fast.com (использовать в случае, если не можем получить актуальный)
const FALLBACK_TOKEN = 'YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm';

/**
 * Обработчик GET запросов для получения токена Fast.com
 * 
 * @param request Запрос Next.js
 * @returns Ответ с токеном Fast.com или ошибкой
 */
export async function GET(request: NextRequest) {
    try {
        // В реальном API вы можете пытаться получить токен напрямую с Fast.com,
        // но здесь мы используем фиксированный токен, т.к. запросы с сервера блокируются
        
        // Возвращаем фиксированный токен
        return NextResponse.json({
            token: FALLBACK_TOKEN,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Ошибка при получении токена Fast.com:', error);
        
        // В случае ошибки возвращаем фиксированный токен
        return NextResponse.json({
            token: FALLBACK_TOKEN,
            timestamp: new Date().toISOString(),
            error: true,
            message: 'Используется резервный токен'
        });
    }
} 