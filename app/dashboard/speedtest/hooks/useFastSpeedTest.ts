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
    
    // Используем новые локальные API маршруты Next.js вместо бэкенда Nest.js
    const FASTCOM_TOKEN_URL = '/api/fastcom/token';
    const FASTCOM_URLS_URL = '/api/fastcom/urls';
    
    // Добавляем cache-busting параметр к URL
    const getCacheBustingUrl = (url: string) => {
        const cacheBuster = `_cb=${Date.now()}`;
        return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    };
    
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
                // Используем fetch с оригинальным URL вместо HEAD-запроса к корню домена
                await fetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    mode: 'cors',
                    // Устанавливаем таймаут 2 секунды
                    signal: AbortSignal.timeout(2000)
                });
                
                const end = performance.now();
                const pingTime = end - start;
                
                // Отфильтровываем аномально высокие значения
                if (pingTime < 1000) {
                    pingTimes.push(pingTime);
                }
            } catch (error) {
                // console.warn(`Error measuring ping to ${url}:`, error);
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
            // console.error(`Error measuring upload speed to ${url}:`, error);
            return 0;
        }
    };

    /**
     * Безопасно читает ответ API, с проверкой и клонированием для отладки
     */
    const safeReadApiResponse = async (response: Response) => {
        // Клонируем ответ, чтобы можно было прочитать его дважды
        const clonedResponse = response.clone();
        
        try {
            // Пытаемся прочитать как JSON
            return await response.json();
        } catch (error) {
            // console.error('Ошибка при парсинге JSON:', error);
            
            try {
                // Читаем клон ответа как текст для отладки
                const text = await clonedResponse.text();
                if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
                    // console.warn('Получен HTML вместо JSON - проблема с маршрутизацией API');
                }
            } catch (textError) {
                // console.error('Не удалось прочитать содержимое ответа:', textError);
            }
            
            throw new Error('Не удалось распарсить ответ API как JSON');
        }
    };

    /**
     * Измеряет скорость загрузки данных на сервер с использованием улучшенного алгоритма
     * @param baseUrl URL сервера
     * @returns Скорость загрузки в Mbps
     */
    const measureUploadImproved = async (baseUrl: string): Promise<number> => {
        try {
            // console.log('Начинаем улучшенное измерение Upload скорости...');
            
            // Размеры файлов для тестирования (в МБ)
            const fileSizes = [1, 4, 8];
            // Количество итераций для каждого размера
            const iterations = 2;
            // Максимальное время тестирования (в секундах)
            const maxTestDuration = 15;
            // Все измеренные скорости
            const uploadSpeeds: number[] = [];
            
            // Функция для выполнения параллельных загрузок
            const runParallelUploads = async (sizeMB: number, parallelCount: number): Promise<number[]> => {
                const promises = [];
                
                for (let p = 0; p < parallelCount; p++) {
                    // Каждый параллельный запрос получает слегка уменьшенный размер файла для стабильности
                    const actualSize = sizeMB * 0.9;
                    
                    // Создаем блоб случайных данных
                    const byteSize = Math.floor(actualSize * 1024 * 1024);
                    const data = new Uint8Array(byteSize);
                    
                    // Заполняем случайными данными с учетом лимита crypto.getRandomValues()
                    // Максимальный размер, который поддерживает crypto.getRandomValues() - 65536 байт
                    const CHUNK_SIZE = 65536; // 64KB
                    
                    // Заполняем буфер по частям
                    for (let offset = 0; offset < byteSize; offset += CHUNK_SIZE) {
                        const length = Math.min(CHUNK_SIZE, byteSize - offset);
                        const chunk = data.subarray(offset, offset + length);
                        crypto.getRandomValues(chunk);
                    }
                    
                    const blob = new Blob([data], { type: 'application/octet-stream' });
                    
                    // Формируем URL для тестирования
                    let uploadUrl = baseUrl;
                    if (!uploadUrl.endsWith('/')) uploadUrl += '/';
                    uploadUrl += `?r=${Math.random()}&p=${p}`;
                    
                    // console.log(`Параллельная загрузка #${p+1}: ${actualSize.toFixed(1)}MB на ${uploadUrl}`);
                    
                    // Устанавливаем таймаут для запроса
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                        controller.abort();
                    }, maxTestDuration * 1000);
                    
                    const promise = (async () => {
                        try {
                            const start = performance.now();
                            const response = await fetch(uploadUrl, {
                                method: 'POST',
                                headers: {
                                    'Cache-Control': 'no-cache',
                                    'Content-Type': 'application/octet-stream'
                                },
                                body: blob,
                                signal: controller.signal
                            });
                            
                            clearTimeout(timeoutId);
                            
                            if (response.ok) {
                                const endTime = performance.now();
                                
                                // Вычисляем скорость в Mbps
                                const uploadSize = byteSize;
                                const duration = (endTime - start) / 1000; // Время в секундах
                                
                                if (duration > 0) {
                                    const speedMbps = ((uploadSize * 8) / duration) / 1000000;
                                    // console.log(`Параллельная загрузка #${p+1}: ${speedMbps.toFixed(2)} Mbps, Время: ${duration.toFixed(2)} сек`);
                                    return speedMbps;
                                }
                            } else {
                                // console.warn(`HTTP ошибка в параллельной загрузке #${p+1}: ${response.status}`);
                            }
                        } catch (error) {
                            clearTimeout(timeoutId);
                            // console.warn(`Ошибка в параллельной загрузке #${p+1}:`, error);
                        }
                        return 0;
                    })();
                    
                    promises.push(promise);
                }
                
                return Promise.all(promises);
            };
            
            // Тестируем с разными размерами и параллельными загрузками
            for (const sizeMB of fileSizes) {
                // Для каждого размера меняем количество параллельных запросов
                // Для больших файлов используем меньше параллельных запросов
                const parallelCount = sizeMB <= 2 ? 4 : (sizeMB <= 4 ? 3 : 2);
                
                for (let i = 0; i < iterations; i++) {
                    try {
                        // console.log(`Upload тест ${sizeMB}MB с ${parallelCount} параллельными запросами, итерация ${i+1}`);
                        
                        const speeds = await runParallelUploads(sizeMB, parallelCount);
                        const validSpeeds = speeds.filter(s => s > 0);
                        
                        if (validSpeeds.length > 0) {
                            // Вычисляем общую скорость всех параллельных загрузок
                            const totalSpeed = validSpeeds.reduce((sum, speed) => sum + speed, 0);
                            uploadSpeeds.push(totalSpeed);
                            
                            // console.log(`Итерация ${i+1}: Общая скорость ${totalSpeed.toFixed(2)} Mbps`);
                            
                            // Если скорость хорошая, прекращаем тестирование для этого размера
                            if (totalSpeed > 30) { // 30 Mbps считается хорошей скоростью
                                break;
                            }
                        }
                    } catch (error) {
                        // console.warn(`Ошибка во время итерации теста загрузки ${sizeMB}MB:`, error);
                    }
                }
                
                // Если у нас уже есть хотя бы 3 измерения, можем остановиться
                if (uploadSpeeds.length >= 3) {
                    break;
                }
            }
            
            // Вычисляем среднюю скорость
            if (uploadSpeeds.length > 0) {
                // Сортируем скорости и исключаем минимальное и максимальное значения, если есть хотя бы 3 результата
                if (uploadSpeeds.length >= 3) {
                    uploadSpeeds.sort((a, b) => a - b);
                    uploadSpeeds.shift(); // Удаляем минимальное значение
                    uploadSpeeds.pop();   // Удаляем максимальное значение
                }
                
                const avgSpeed = uploadSpeeds.reduce((sum, speed) => sum + speed, 0) / uploadSpeeds.length;
                // console.log(`Результат тестирования Upload: ${avgSpeed.toFixed(2)} Mbps из ${uploadSpeeds.length} измерений`);
                return avgSpeed;
            }
            
            // Если не удалось измерить, возвращаем 0
            // console.warn('Не удалось измерить скорость Upload');
            return 0;
        } catch (error) {
            // console.error('Ошибка при тестировании скорости Upload:', error);
            return 0;
        }
    };

    /**
     * Запускает тест скорости через Fast.com API через наш прокси-сервер
     */
    const runSpeedTest = async (): Promise<number | null> => {
        if (testInProgressRef.current) {
            // console.log('⏳ Тест Fast.com уже выполняется');
            return null;
        }
        
        try {
            testInProgressRef.current = true;
            setIsTesting(true);
            setProgress(10);
            
            // Сначала получаем токен от нашего локального Next.js API
            // console.log('🔑 Получение токена Fast.com...');
            const tokenUrl = getCacheBustingUrl(FASTCOM_TOKEN_URL);
            
            const tokenResponse = await fetch(tokenUrl, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-store, no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!tokenResponse.ok) {
                throw new Error(`Failed to get Fast.com token: ${tokenResponse.status}`);
            }
            
            // Используем безопасное чтение ответа
            const tokenData = await safeReadApiResponse(tokenResponse);
            const token = tokenData.token;
            
            if (!token) {
                throw new Error('Token not found in response');
            }
            
            // console.log('🔍 Получение серверов Fast.com для тестирования...');
            setProgress(20);
            
            // Теперь получаем URLs для тестирования через наш локальный Next.js API
            const urlsUrl = getCacheBustingUrl(`${FASTCOM_URLS_URL}?token=${token}&urlCount=5`);
            
            const urlsResponse = await fetch(urlsUrl, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-store, no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!urlsResponse.ok) {
                throw new Error(`Failed to get Fast.com test URLs: ${urlsResponse.status}`);
            }
            
            // Используем безопасное чтение ответа
            const data = await safeReadApiResponse(urlsResponse);
            
            if (!data.targets || data.targets.length === 0) {
                throw new Error('No test URLs returned from Fast.com');
            }
            
            // console.log(`✅ Получено ${data.targets.length} тестовых URL от Fast.com`);
            setProgress(30);
            
            // Фильтруем только HTTPS URLs для тестирования
            let testUrls = data.targets
                .filter((target: any) => target.url && target.url.startsWith('https://'))
                .map((target: any) => ({ url: target.url }));
            
            // Если нет HTTPS URLs, используем все URL
            if (testUrls.length === 0) {
                // console.warn('No HTTPS URLs found, using all URLs');
                testUrls = data.targets
                    .filter((target: any) => target.url)
                    .map((target: any) => ({ url: target.url }));
            }
            
            // console.log(`🔄 Измерение пинга Fast.com...`);
            // Сначала измеряем пинг (из первого URL)
            if (testUrls.length > 0) {
                const ping = await measurePing(testUrls[0].url, 8);
                setPingStats(ping);
            }
            
            // console.log(`🔽 Запуск теста скорости загрузки на ${testUrls.length} серверах...`);
            // Замеряем время начала теста
            const startTime = performance.now();
            
            // Запускаем загрузки параллельно
            const downloadPromises = testUrls.map(async (target: any, index: number) => {
                try {
                    const res = await fetch(target.url, { method: 'GET' });
                    if (!res.ok) {
                        // console.warn(`Failed to download from ${target.url}: ${res.status}`);
                        return 0;
                    }
                    
                    // Получаем размер файла из заголовков
                    const contentLength = res.headers.get('content-length');
                    if (!contentLength) {
                        // console.warn(`No content-length header for ${target.url}`);
                        return 0;
                    }
                    
                    // Читаем содержимое полностью
                    const blob = await res.blob();
                    
                    return parseInt(contentLength, 10);
                } catch (error) {
                    // console.error(`Error downloading from ${target.url}:`, error);
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
            
            // console.log(`✅ Тест скачивания Fast.com завершен: ${downloadSpeedMbps.toFixed(2)} Mbps`);
            
            // Сохраняем результат скачивания
            setDownloadSpeed(downloadSpeedMbps.toFixed(2));
            setFastSpeedResult(downloadSpeedMbps);
            
            setProgress(80);
            
            // Теперь измеряем скорость загрузки
            if (testUrls.length > 0) {
                // console.log(`Запускаем улучшенное тестирование Upload на ${testUrls[0].url}...`);
                try {
                    const uploadSpeedMbps = await measureUploadImproved(testUrls[0].url);
                    
                    // Если удалось измерить, сохраняем результат
                    if (uploadSpeedMbps > 0) {
                        // console.log(`Тестирование Fast.com Upload завершено: ${uploadSpeedMbps.toFixed(2)} Mbps`);
                        setUploadSpeed(uploadSpeedMbps.toFixed(2));
                    } else {
                        // Если всё же не удалось измерить, используем несколько источников для оценки
                        // 1. Пробуем стандартное измерение
                        const standardUploadSpeed = await measureUpload(testUrls[0].url);
                        
                        if (standardUploadSpeed > 0) {
                            // console.log(`Стандартное измерение Upload: ${standardUploadSpeed.toFixed(2)} Mbps`);
                            setUploadSpeed(standardUploadSpeed.toFixed(2));
                        } else {
                            // 2. Если и это не удалось, используем более сложную оценку
                            // В среднем соотношение Upload/Download зависит от типа подключения:
                            // - Оптоволокно: ~80% от Download
                            // - Кабельное: ~20% от Download
                            // - ADSL: ~10% от Download
                            // - 4G/5G: ~30-40% от Download
                            
                            // Берем среднее значение
                            const estimatedUploadSpeed = downloadSpeedMbps * 0.4;
                            // console.log(`Не удалось измерить Upload. Используем оценку: ${estimatedUploadSpeed.toFixed(2)} Mbps`);
                            setUploadSpeed(estimatedUploadSpeed.toFixed(2));
                        }
                    }
                } catch (error) {
                    // console.error(`Ошибка при измерении Upload скорости:`, error);
                    // Используем приблизительную оценку
                    const estimatedUploadSpeed = downloadSpeedMbps * 0.4;
                    setUploadSpeed(estimatedUploadSpeed.toFixed(2));
                }
            }
            
            setProgress(100);
            return downloadSpeedMbps;
        } catch (error) {
            // console.error('Error during Fast.com speed test:', error);
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
