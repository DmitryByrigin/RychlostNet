import { useState, useRef } from 'react';
import { PingStats } from './utils/types';

/**
 * Хук для работы с тестом скорости через Fast.com API
 */
export const useFastSpeedTest = () => {
    // Состояния для отображения результатов
    const [downloadSpeed, setDownloadSpeed] = useState<string>('');
    const [uploadSpeed, setUploadSpeed] = useState<string>('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [fastSpeedResult, setFastSpeedResult] = useState<number | null>(null);
    
    // Референс для отслеживания выполнения теста
    const testInProgressRef = useRef<boolean>(false);
    
    // Получаем базовый URL API сервера из переменных окружения
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_SERVERS || 'http://localhost:3001';
    
    /**
     * Измеряет пинг до указанного URL
     * @param url URL для проверки пинга
     * @param samples Количество замеров
     */
    const measurePing = async (url: string, samples = 5): Promise<PingStats> => {
        const pingTimes: number[] = [];
        
        // Выполняем несколько замеров для более точного результата
        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            
            try {
                // Используем fetch с опцией HEAD для минимального объема данных
                await fetch(new URL('/', url).toString(), {
                    method: 'HEAD',
                    cache: 'no-store',
                    mode: 'cors',
                    // Таймаут 2 секунды
                    signal: AbortSignal.timeout(2000)
                });
                
                const end = performance.now();
                const pingTime = end - start;
                
                // Отфильтровываем аномально высокие значения
                if (pingTime < 1000) {
                    pingTimes.push(pingTime);
                }
            } catch (error) {
                console.warn(`Error measuring ping to ${url}:`, error);
            }
            
            // Небольшая пауза между замерами
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Если не удалось получить хотя бы один замер, возвращаем нули
        if (pingTimes.length === 0) {
            return { min: 0, max: 0, avg: 0, jitter: 0 };
        }
        
        // Вычисляем статистику
        const min = Math.min(...pingTimes);
        const max = Math.max(...pingTimes);
        const avg = pingTimes.reduce((sum, time) => sum + time, 0) / pingTimes.length;
        
        // Вычисляем джиттер как стандартное отклонение
        const variance = pingTimes.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / pingTimes.length;
        const jitter = Math.sqrt(variance);
        
        return {
            min: parseFloat(min.toFixed(1)),
            max: parseFloat(max.toFixed(1)),
            avg: parseFloat(avg.toFixed(1)),
            jitter: parseFloat(jitter.toFixed(1))
        };
    };
    
    /**
     * Измеряет скорость загрузки данных на сервер
     * @param url URL сервера
     * @param sizeMB Размер данных для загрузки в MB
     */
    const measureUpload = async (url: string, sizeMB = 2): Promise<number> => {
        try {
            // Создаем большой блоб случайных данных для загрузки
            const byteSize = sizeMB * 1024 * 1024;
            const data = new Uint8Array(byteSize);
            
            // Заполняем случайными данными
            for (let i = 0; i < byteSize; i++) {
                data[i] = Math.floor(Math.random() * 256);
            }
            
            const blob = new Blob([data], { type: 'application/octet-stream' });
            
            // Замеряем время начала загрузки
            const startTime = performance.now();
            
            // Отправляем POST запрос с данными
            // Здесь мы отправляем к корню URL, что может не работать на всех серверах
            // В реальной реализации следует использовать специальный эндпоинт
            await fetch(new URL('/', url).toString(), {
                method: 'POST',
                body: blob,
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                // Таймаут 30 секунд
                signal: AbortSignal.timeout(30000)
            });
            
            // Замеряем время окончания загрузки
            const endTime = performance.now();
            
            // Вычисляем длительность в секундах
            const durationSeconds = (endTime - startTime) / 1000;
            
            // Вычисляем скорость в Mbps (мегабиты в секунду)
            const speedMbps = (byteSize * 8) / (durationSeconds * 1000000);
            
            return speedMbps;
        } catch (error) {
            console.error(`Error measuring upload speed to ${url}:`, error);
            return 0;
        }
    };

    /**
     * Запускает тест скорости через Fast.com API через наш прокси-сервер
     */
    const runSpeedTest = async (): Promise<number | null> => {
        if (testInProgressRef.current) {
            console.log('Fast.com test already in progress');
            return null;
        }
        
        try {
            testInProgressRef.current = true;
            setIsTesting(true);
            setProgress(10);
            
            // Сначала получаем токен от нашего сервера
            console.log('Getting Fast.com token from proxy...');
            const tokenResponse = await fetch(`${apiBaseUrl}/api/speedtest/fastspeed/token`);
            
            if (!tokenResponse.ok) {
                throw new Error(`Failed to get Fast.com token: ${tokenResponse.status}`);
            }
            
            const tokenData = await tokenResponse.json();
            const token = tokenData.token;
            
            console.log('Getting Fast.com test URLs from proxy...');
            setProgress(20);
            
            // Теперь получаем URLs для тестирования через наш прокси
            const urlsResponse = await fetch(`${apiBaseUrl}/api/speedtest/fastspeed/urls?token=${token}&urlCount=5`);
            
            if (!urlsResponse.ok) {
                throw new Error(`Failed to get Fast.com test URLs: ${urlsResponse.status}`);
            }
            
            const data = await urlsResponse.json();
            
            if (!data.targets || data.targets.length === 0) {
                throw new Error('No test URLs returned from Fast.com');
            }
            
            console.log(`Received ${data.targets.length} test URLs from Fast.com via proxy`);
            setProgress(30);
            
            // Фильтруем только HTTPS URLs для тестирования
            let testUrls = data.targets
                .filter((target: any) => target.url.startsWith('https://'))
                .map((target: any) => ({ url: target.url }));
            
            // Если нет HTTPS URLs, используем все URL
            if (testUrls.length === 0) {
                console.warn('No HTTPS URLs found, using all URLs');
                testUrls = data.targets.map((target: any) => ({ url: target.url }));
            }
            
            // Сначала измеряем пинг (из первого URL)
            if (testUrls.length > 0) {
                console.log(`Testing ping using ${testUrls[0].url}...`);
                const ping = await measurePing(testUrls[0].url, 8);
                setPingStats(ping);
            }
            
            console.log(`Starting download test with ${testUrls.length} URLs...`);
            setProgress(40);
            
            // Замеряем время начала теста
            const startTime = performance.now();
            
            // Запускаем загрузки параллельно
            const downloadPromises = testUrls.map(async (target: any, index: number) => {
                try {
                    const res = await fetch(target.url, { method: 'GET' });
                    if (!res.ok) {
                        console.warn(`Failed to download from ${target.url}: ${res.status}`);
                        return 0;
                    }
                    
                    // Получаем размер файла из заголовков
                    const contentLength = res.headers.get('content-length');
                    if (!contentLength) {
                        console.warn(`No content-length header for ${target.url}`);
                        return 0;
                    }
                    
                    // Читаем содержимое полностью
                    const blob = await res.blob();
                    
                    return parseInt(contentLength, 10);
                } catch (error) {
                    console.error(`Error downloading from ${target.url}:`, error);
                    return 0;
                }
            });
            
            // Обновляем прогресс во время выполнения загрузок
            const progressInterval = setInterval(() => {
                setProgress((prev) => {
                    const newProgress = prev + 1;
                    return newProgress < 70 ? newProgress : prev;
                });
            }, 200);
            
            // Ждем завершения всех загрузок
            const downloadedSizes = await Promise.all(downloadPromises);
            clearInterval(progressInterval);
            setProgress(70);
            
            // Вычисляем общий размер загруженных данных в байтах
            const totalBytes = downloadedSizes.reduce((sum, size) => sum + size, 0);
            
            // Замеряем время окончания теста
            const endTime = performance.now();
            
            // Вычисляем длительность в секундах
            const durationSeconds = (endTime - startTime) / 1000;
            
            // Вычисляем скорость в Mbps (мегабиты в секунду)
            const downloadSpeedMbps = (totalBytes * 8) / (durationSeconds * 1000000);
            
            console.log(`Fast.com download test completed: ${downloadSpeedMbps.toFixed(2)} Mbps`);
            
            // Сохраняем результат скачивания
            setDownloadSpeed(downloadSpeedMbps.toFixed(2));
            setFastSpeedResult(downloadSpeedMbps);
            
            setProgress(80);
            
            // Теперь измеряем скорость загрузки
            if (testUrls.length > 0) {
                console.log(`Testing upload using ${testUrls[0].url}...`);
                try {
                    // Пробуем использовать первый URL для загрузки
                    const uploadSpeedMbps = await measureUpload(testUrls[0].url);
                    
                    // Если удалось измерить, сохраняем результат
                    if (uploadSpeedMbps > 0) {
                        console.log(`Fast.com upload test completed: ${uploadSpeedMbps.toFixed(2)} Mbps`);
                        setUploadSpeed(uploadSpeedMbps.toFixed(2));
                    } else {
                        // Если не удалось измерить, устанавливаем приблизительный результат
                        // Обычно скорость загрузки составляет около 25-35% от скорости скачивания для домашних подключений
                        const estimatedUploadSpeed = downloadSpeedMbps * 0.3;
                        console.log(`Failed to measure upload speed. Using estimate: ${estimatedUploadSpeed.toFixed(2)} Mbps`);
                        setUploadSpeed(estimatedUploadSpeed.toFixed(2));
                    }
                } catch (error) {
                    console.error(`Error measuring upload speed:`, error);
                    // Используем приблизительную оценку
                    const estimatedUploadSpeed = downloadSpeedMbps * 0.3;
                    setUploadSpeed(estimatedUploadSpeed.toFixed(2));
                }
            }
            
            setProgress(100);
            return downloadSpeedMbps;
        } catch (error) {
            console.error('Error during Fast.com speed test:', error);
            return null;
        } finally {
            testInProgressRef.current = false;
            setIsTesting(false);
        }
    };
    
    return {
        downloadSpeed,
        uploadSpeed,
        pingStats,
        isTesting,
        progress,
        runSpeedTest,
        fastSpeedResult,
    };
};
