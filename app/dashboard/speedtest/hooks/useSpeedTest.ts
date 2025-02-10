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

        // Определяем тип теста
        const isUpload = results.some(r => r.time < r.size / 1e8);

        // Вычисляем скорость для каждого результата
        const speeds = results.map(result => {
            const seconds = result.time / 1000;
            const bytes = result.size;
            
            // TCP overhead: IP header (20 bytes) + TCP header (20 bytes) = 40 bytes per packet
            // Типичный размер TCP пакета: 1460 bytes
            const packets = Math.ceil(bytes / 1460);
            const overhead = packets * 40;
            
            // HTTP overhead (минимальный)
            const httpOverhead = bytes * 0.01;
            
            // Общий размер с учетом накладных расходов
            const totalBytes = bytes + overhead + httpOverhead;
            
            // Переводим в биты
            const bits = totalBytes * 8;
            
            // Базовая скорость
            const baseSpeed = bits / seconds;

            return baseSpeed;
        });

        // Сортируем и отбрасываем выбросы
        speeds.sort((a, b) => b - a);
        
        // Отбрасываем только явные выбросы (верхние 10%)
        const validSpeeds = speeds.slice(Math.floor(speeds.length * 0.1));

        if (validSpeeds.length === 0) return speeds[0];

        // Считаем среднее из оставшихся результатов
        const avgSpeed = validSpeeds.reduce((sum, speed) => sum + speed, 0) / validSpeeds.length;

        // Применяем минимальные корректировки
        if (isUpload) {
            return avgSpeed * 0.95; // 5% снижение для upload
        }

        return avgSpeed * 0.9; // 10% снижение для download
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const measurePing = async (serverUrl: string): Promise<PingStats> => {
        const pings: number[] = [];
        const samples = 20; // Больше замеров
        
        // Делаем пару пингов для разогрева соединения
        for (let i = 0; i < 3; i++) {
            try {
                const start = performance.now();
                await fetch(`${serverUrl}/speedtest/ping`);
                const end = performance.now();
                await delay(20); // Уменьшаем паузу
            } catch (error) {
                console.warn('Warmup ping failed:', error);
            }
        }

        // Основные замеры
        for (let i = 0; i < samples; i++) {
            try {
                const start = performance.now();
                const response = await fetch(`${serverUrl}/speedtest/ping`);
                if (!response.ok) {
                    console.warn(`Ping failed with status: ${response.status}`);
                    continue;
                }
                const end = performance.now();
                pings.push(end - start);
                await delay(50); // Уменьшаем паузу между пингами
            } catch (error) {
                console.warn('Ping measurement failed:', error);
            }
        }

        if (pings.length === 0) {
            throw new Error('Ping test failed - no successful measurements');
        }

        // Сортируем пинги
        pings.sort((a, b) => a - b);

        // Отбрасываем только явные выбросы (верхние 10%)
        const validPings = pings.slice(0, Math.ceil(pings.length * 0.9));

        // Вычисляем статистику
        const min = validPings[0]; // Минимальный пинг
        const max = validPings[validPings.length - 1]; // Максимальный пинг
        const avg = validPings.reduce((sum, ping) => sum + ping, 0) / validPings.length;

        // Вычисляем джиттер как стандартное отклонение
        const variance = validPings.reduce((sum, ping) => sum + Math.pow(ping - avg, 2), 0) / validPings.length;
        const jitter = Math.sqrt(variance);

        return {
            min: Math.round(min),
            max: Math.round(max),
            avg: Math.round(avg),
            jitter: Math.round(jitter * 10) / 10
        };
    };

    const warmupConnection = async (serverUrl: string): Promise<void> => {
        try {
            // Делаем несколько пингов для разогрева соединения
            for (let i = 0; i < 5; i++) {
                await fetch(`${serverUrl}/speedtest/ping`);
                await delay(200); // Добавляем задержку между пингами
            }
        } catch (error) {
            console.error('Error in warmup:', error);
        }
    };

    const measureDownload = async (serverUrl: string): Promise<number> => {
        // Сначала разогреваем соединение
        await warmupConnection(serverUrl);
        await delay(200); // Уменьшаем задержку

        // Начинаем с меньшего количества соединений
        let connections = 2;
        let maxConnections = 12; // Увеличиваем максимум соединений
        let bestSpeed = 0;
        
        // Оптимизированные размеры файлов
        const sizes = [4, 8, 16, 32].map(mb => mb * 1024 * 1024);
        const results: SpeedTestResult[] = [];
        
        // Тестируем разное количество соединений
        while (connections <= maxConnections) {
            let failedAttempts = 0;
            
            for (const size of sizes) {
                if (failedAttempts >= 2) {
                    console.warn(`Too many failed attempts with ${connections} connections, reducing`);
                    break;
                }

                await delay(50); // Уменьшаем задержку

                const promises = Array(connections).fill(0).map(async () => {
                    const start = performance.now();
                    try {
                        const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                            cache: 'no-store'
                        });
                        
                        if (!response.ok) {
                            console.warn(`Download failed: ${response.status}`);
                            return null;
                        }
                        
                        await response.arrayBuffer();
                        const end = performance.now();
                        return { size, time: end - start };
                    } catch (error) {
                        console.error('Error in download test:', error);
                        failedAttempts++;
                        return null;
                    }
                });

                const batchResults = (await Promise.all(promises)).filter((r): r is SpeedTestResult => r !== null);
                if (batchResults.length > 0) {
                    results.push(...batchResults);
                    
                    const currentSpeed = calculateSpeed(batchResults);
                    if (currentSpeed > bestSpeed * 1.1) { // Увеличиваем только если прирост больше 10%
                        bestSpeed = currentSpeed;
                    } else {
                        // Даем еще два шанса перед остановкой
                        if (connections < maxConnections) {
                            continue;
                        }
                        maxConnections = connections;
                        break;
                    }
                }
            }
            
            connections *= 2;
            await delay(100); // Уменьшаем задержку
        }

        if (results.length === 0) {
            throw new Error('Download test failed - no successful measurements');
        }

        return calculateSpeed(results);
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

    const measureUpload = async (serverUrl: string): Promise<number> => {
        // Сначала разогреваем соединение
        await warmupConnection(serverUrl);
        await delay(500);

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

                await delay(100); // Уменьшили задержку

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
            await delay(200); // Уменьшили задержку
        }

        // Если есть хоть какие-то результаты, используем их
        if (results.length > 0) {
            return calculateSpeed(results);
        }

        throw new Error('Upload test failed - no successful measurements. Check server CORS settings and file size limits.');
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
