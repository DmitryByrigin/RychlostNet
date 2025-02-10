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

    const measurePing = async (serverUrl: string): Promise<PingStats> => {
        const pings: number[] = [];
        const samples = 10; // Уменьшаем количество замеров
        
        // Один пинг для разогрева
        try {
            await fetch(`${serverUrl}/speedtest/ping`);
        } catch (error) {
            console.warn('Warmup ping failed:', error);
        }

        // Основные замеры
        for (let i = 0; i < samples; i++) {
            try {
                const start = performance.now();
                const response = await fetch(`${serverUrl}/speedtest/ping`);
                if (!response.ok) continue;
                const end = performance.now();
                pings.push(end - start);
            } catch (error) {
                console.warn('Ping measurement failed:', error);
            }
        }

        if (pings.length === 0) {
            throw new Error('Ping test failed - no successful measurements');
        }

        // Сортируем пинги и берем лучшие 80%
        pings.sort((a, b) => a - b);
        const validPings = pings.slice(0, Math.ceil(pings.length * 0.8));

        const min = validPings[0];
        const max = validPings[validPings.length - 1];
        const avg = validPings.reduce((sum, ping) => sum + ping, 0) / validPings.length;
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
            }
        } catch (error) {
            console.error('Error in warmup:', error);
        }
    };

    const measureDownload = async (serverUrl: string): Promise<number> => {
        // Быстрый разогрев
        await fetch(`${serverUrl}/speedtest/download/1048576`, { cache: 'no-store' });

        let connections = 2;
        let maxConnections = 8;
        let bestSpeed = 0;
        
        // Меньше размеров файлов
        const sizes = [1, 4].map(mb => mb * 1024 * 1024);
        const results: SpeedTestResult[] = [];
        
        while (connections <= maxConnections) {
            let failedAttempts = 0;
            
            for (const size of sizes) {
                if (failedAttempts >= 2) break;

                const promises = Array(connections).fill(0).map(async () => {
                    const start = performance.now();
                    try {
                        const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                            cache: 'no-store',
                            headers: {
                                'Connection': 'keep-alive',
                                'Accept-Encoding': 'gzip, deflate',
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache'
                            },
                            mode: 'cors',
                            credentials: 'omit'
                        });
                        
                        if (!response.ok) return null;
                        
                        const reader = response.body?.getReader();
                        if (!reader) return null;

                        let receivedSize = 0;
                        while(true) {
                            const {done, value} = await reader.read();
                            if (done) break;
                            receivedSize += value.length;
                        }

                        const end = performance.now();
                        return { size: receivedSize, time: end - start };
                    } catch (error) {
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
                        continue;
                    }
                    maxConnections = connections;
                    break;
                }
            }
            
            connections *= 2;
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
