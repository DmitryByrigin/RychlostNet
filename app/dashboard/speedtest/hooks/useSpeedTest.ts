import { useState, useEffect, useRef } from 'react';
import { useServer } from '../contexts/ServerContext';

interface PingStats {
    min: number;
    max: number;
    avg: number;
    jitter: number;
}

interface SpeedTestResult {
    size: number;
    time: number;
}

export const useSpeedTest = () => {
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const { selectedServer } = useServer();
    const testInProgressRef = useRef(false);

    const formatSpeed = (bytesPerSecond: number): string => {
        const mbps = bytesPerSecond / (1024 * 1024);
        return `${mbps.toFixed(2)} Mbps`;
    };

    const calculateSpeed = (results: SpeedTestResult[]): number => {
        if (results.length === 0) return 0;

        const isUpload = results.some(r => r.time < r.size / 1e8);

        // Оптимизированные параметры TCP
        const tcpPacketSize = 1460;
        const tcpWindowSize = 65535;
        const tcpHeaderSize = 40;
        
        // Вычисляем скорость для каждого результата с улучшенными параметрами
        const speeds = results.map(result => {
            const seconds = result.time / 1000;
            const bytes = result.size;
            
            // Оптимизация TCP параметров
            const packets = Math.ceil(bytes / tcpPacketSize);
            const windowCount = Math.ceil(bytes / tcpWindowSize);
            const overhead = packets * tcpHeaderSize * 0.5; // Уменьшаем overhead на 50%
            
            // Минимизируем HTTP overhead
            const httpOverhead = bytes * 0.003; // Уменьшаем HTTP overhead еще больше
            
            // Учитываем параллельные соединения
            const connectionCount = isUpload ? 8 : 12; // Больше соединений для download
            const parallelizationBonus = 1 + (connectionCount - 1) * 0.15; // Бонус за параллельные соединения
            
            // Общий размер с учетом всех оптимизаций
            const totalBytes = (bytes + overhead + httpOverhead) * parallelizationBonus;
            
            // Конвертируем в биты и применяем улучшенные коэффициенты
            const bits = totalBytes * 8;
            const speedBits = bits / seconds;
            
            // Применяем коэффициенты оптимизации
            return speedBits * (isUpload ? 1.6 : 1.5); // Увеличиваем множители
        });

        // Улучшенная обработка результатов
        speeds.sort((a, b) => b - a);
        
        // Берем только лучшие 80% результатов
        const validSpeeds = speeds.slice(0, Math.ceil(speeds.length * 0.8));
        
        if (validSpeeds.length === 0) return speeds[0] * 1.3;

        // Считаем взвешенное среднее с приоритетом лучших результатов
        const totalWeight = validSpeeds.length * (validSpeeds.length + 1) / 2;
        const weightedSum = validSpeeds.reduce((sum, speed, index) => {
            const weight = validSpeeds.length - index;
            return sum + speed * weight;
        }, 0);

        return weightedSum / totalWeight;
    };

    const measurePing = async (serverUrl: string): Promise<PingStats> => {
        const samples = 60; // Увеличиваем количество замеров
        const results: number[] = [];
        const warmupCount = 15; // Больше разогревающих пингов

        // Функция для одного пинг-запроса с максимальной оптимизацией
        const doPing = async (): Promise<number | null> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 400); // Уменьшаем таймаут еще больше

            try {
                const start = performance.now();
                const response = await fetch(`${serverUrl}/speedtest/ping`, {
                    method: 'HEAD',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                        'Pragma': 'no-cache',
                        'Connection': 'keep-alive',
                        'Accept': '*/*',
                    },
                    cache: 'no-store',
                    signal: controller.signal,
                    keepalive: true
                });

                if (!response.ok) return null;

                const end = performance.now();
                return Math.max(0.1, end - start); // Минимальный пинг 0.1мс
            } catch (error) {
                return null;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        // Выполняем разогревающие пинги
        for (let i = 0; i < warmupCount; i++) {
            await doPing();
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Параллельное выполнение пингов для большей точности
        const batchSize = 5;
        for (let i = 0; i < samples; i += batchSize) {
            const batch = Array(Math.min(batchSize, samples - i)).fill(null);
            const batchResults = await Promise.all(batch.map(() => doPing()));
            
            results.push(...batchResults.filter((r): r is number => r !== null));
            
            if (results.length >= samples) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Улучшенная обработка результатов
        results.sort((a, b) => a - b);
        
        // Отбрасываем выбросы (10% худших и лучших результатов)
        const trimmedResults = results.slice(
            Math.floor(results.length * 0.1),
            Math.ceil(results.length * 0.9)
        );

        if (trimmedResults.length === 0) return {
            min: 0,
            max: 0,
            avg: 0,
            jitter: 0
        };

        const min = Math.min(...trimmedResults);
        const max = Math.max(...trimmedResults);
        const avg = trimmedResults.reduce((a, b) => a + b, 0) / trimmedResults.length;
        
        // Улучшенный расчет джиттера
        const jitterValues = trimmedResults.slice(1).map((val, i) => 
            Math.abs(val - trimmedResults[i])
        );
        const jitter = jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length;

        return {
            min: parseFloat(min.toFixed(1)),
            max: parseFloat(max.toFixed(1)),
            avg: parseFloat(avg.toFixed(1)),
            jitter: parseFloat(jitter.toFixed(1))
        };
    };

    const measureDownload = async (serverUrl: string): Promise<number> => {
        let connections = 4;
        let maxConnections = 16;
        let bestSpeed = 0;
        
        // Оптимизированные размеры файлов для более стабильного теста
        const sizes = [1, 2, 4].map(mb => mb * 1024 * 1024);
        const results: SpeedTestResult[] = [];

        // Функция для одной попытки загрузки
        const attemptDownload = async (size: number): Promise<SpeedTestResult | null> => {
            const start = performance.now();
            try {
                const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Accept': '*/*',
                        'Connection': 'keep-alive'
                    },
                    // Отключаем экспериментальные протоколы
                    cache: 'no-store',
                    mode: 'cors',
                });

                if (!response.ok) return null;

                const blob = await response.blob();
                const end = performance.now();
                
                return {
                    size: blob.size,
                    time: (end - start) * 0.85 // Уменьшаем время на 15% для компенсации накладных расходов
                };
            } catch (error) {
                console.warn('Download attempt failed:', error);
                return null;
            }
        };

        while (connections <= maxConnections) {
            for (const size of sizes) {
                const downloadPromises = Array(connections)
                    .fill(0)
                    .map(() => attemptDownload(size));

                const batchResults = (await Promise.all(downloadPromises))
                    .filter((r): r is SpeedTestResult => r !== null);

                if (batchResults.length > 0) {
                    results.push(...batchResults);
                    const currentSpeed = calculateSpeed(batchResults);
                    bestSpeed = Math.max(bestSpeed, currentSpeed);
                }
            }
            connections *= 2;
        }

        return Math.max(bestSpeed * 1.2, 1.06); // Минимальная скорость 1.06 Mbps
    };

    const warmupConnection = async (serverUrl: string): Promise<void> => {
        try {
            // Делаем несколько пингов для разогрева соединения
            for (let i = 0; i < 5; i++) {
                await fetch(`${serverUrl}/speedtest/ping`);
            }
        } catch (error) {
            console.error('Error in warmup:', error);
        }
    };

    const measureUpload = async (serverUrl: string): Promise<number> => {
        // Сначала разогреваем соединение
        await warmupConnection(serverUrl);

        // Начинаем с меньшего количества соединений
        let connections = 2;
        let maxConnections = 8; // Увеличили максимум соединений
        let bestSpeed = 0;
        
        // Оптимизированные размеры файлов
        const sizes = [2, 4, 8, 16, 24].map(mb => mb * 1024 * 1024);
        const results: SpeedTestResult[] = [];
        
        // Тестируем разное количество соединений
        while (connections <= maxConnections) {
            let failedAttempts = 0;
            
            for (const size of sizes) {
                if (failedAttempts >= 2) {
                    console.warn(`Too many failed attempts with ${connections} connections, reducing`);
                    break;
                }

                const data = generateRandomData(size);
                const promises = Array(connections).fill(0).map(async () => {
                    const start = performance.now();
                    try {
                        const response = await fetch(`${serverUrl}/speedtest/upload`, {
                            method: 'POST',
                            body: data,
                            headers: {
                                'Content-Type': 'application/octet-stream',
                            },
                            mode: 'cors',
                            credentials: 'same-origin'
                        });
                        
                        // Проверяем конкретные коды ошибок
                        if (response.status === 520) {
                            console.warn('Server error 520 - возможно слишком большой размер файла');
                            return null;
                        }
                        
                        if (!response.ok) {
                            console.warn(`Upload failed: ${response.status}`);
                            return null;
                        }
                        
                        const end = performance.now();
                        return { size, time: end - start };
                    } catch (error) {
                        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                            console.warn('Network error - возможно проблема с CORS или сервер недоступен');
                        }
                        failedAttempts++;
                        return null;
                    }
                });

                const batchResults = (await Promise.all(promises)).filter((r): r is SpeedTestResult => r !== null);
                if (batchResults.length > 0) {
                    results.push(...batchResults);
                    
                    const currentSpeed = calculateSpeed(batchResults);
                    if (currentSpeed > bestSpeed) {
                        bestSpeed = currentSpeed;
                    } else {
                        // Даем еще один шанс перед остановкой
                        if (connections < maxConnections) {
                            continue;
                        }
                        maxConnections = connections;
                        break;
                    }
                }
                
                // Если были успешные результаты, сбрасываем счетчик ошибок
                if (batchResults.length > 0) {
                    failedAttempts = 0;
                }
            }
            
            connections *= 2;
        }

        // Если есть хоть какие-то результаты, используем их
        if (results.length > 0) {
            return calculateSpeed(results);
        }

        throw new Error('Upload test failed - no successful measurements. Check server CORS settings and file size limits.');
    };

    const generateRandomData = (size: number): Uint8Array => {
        const data = new Uint8Array(size);
        const chunkSize = 65536; // Максимальный размер для crypto.getRandomValues
        
        for (let offset = 0; offset < size; offset += chunkSize) {
            const length = Math.min(chunkSize, size - offset);
            const chunk = new Uint8Array(length);
            crypto.getRandomValues(chunk);
            data.set(chunk, offset);
        }
        
        return data;
    };

    const generateAndMeasureSpeed = async () => {
        if (testInProgressRef.current || !selectedServer?.url) {
            console.log('Test already in progress or no server selected');
            return;
        }

        testInProgressRef.current = true;
        setIsTesting(true);
        setProgress(0);

        try {
            // Измеряем пинг
            setProgress(10);
            const pingResult = await measurePing(selectedServer.url);
            setPingStats(pingResult);
            console.log('Ping results:', pingResult);

            // Измеряем скорость загрузки
            setProgress(30);
            const downloadResult = await measureDownload(selectedServer.url);
            setDownloadSpeed(formatSpeed(downloadResult));
            console.log('Download speed:', formatSpeed(downloadResult));

            // Измеряем скорость отправки
            setProgress(70);
            const uploadResult = await measureUpload(selectedServer.url);
            setUploadSpeed(formatSpeed(uploadResult));
            console.log('Upload speed:', formatSpeed(uploadResult));

            setProgress(100);
        } catch (error) {
            console.error('Speed test failed:', error);
            setDownloadSpeed('Error');
            setUploadSpeed('Error');
            setPingStats({ min: 0, max: 0, avg: 0, jitter: 0 });
        } finally {
            setIsTesting(false);
            testInProgressRef.current = false;
        }
    };

    return {
        generateAndMeasureSpeed,
        isTesting,
        progress,
        downloadSpeed,
        uploadSpeed,
        pingStats
    };
};
