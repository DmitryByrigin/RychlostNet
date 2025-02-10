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

        // Вычисляем скорость для каждого результата с учетом всех накладных расходов
        const speeds = results.map(result => {
            const seconds = result.time / 1000;
            const bytes = result.size;
            
            // TCP overhead: IP header (20 bytes) + TCP header (20 bytes) = 40 bytes per packet
            // Типичный размер TCP пакета: 1460 bytes
            const packets = Math.ceil(bytes / 1460);
            const overhead = packets * 40;
            
            // HTTP overhead (примерно 5-10% от размера данных)
            const httpOverhead = bytes * 0.1;
            
            // Для upload учитываем дополнительные накладные расходы на обработку
            const processingOverhead = isUpload ? bytes * 0.2 : 0;
            
            // Общий размер с учетом накладных расходов
            const totalBytes = bytes + overhead + httpOverhead + processingOverhead;
            
            // Переводим в биты
            const bits = totalBytes * 8;
            
            // Добавляем фактор замедления для больших файлов
            const slowdownFactor = Math.max(0.4, 1 - (bytes / (50 * 1024 * 1024)) * 0.6);
            
            // Базовая скорость
            const baseSpeed = bits / seconds;

            // Применяем корректировки
            return baseSpeed * slowdownFactor;
        });

        // Сортируем и отбрасываем выбросы
        speeds.sort((a, b) => b - a);
        
        // Отбрасываем верхние 30% и нижние 20% результатов
        const start = Math.floor(speeds.length * 0.2);
        const end = Math.ceil(speeds.length * 0.7);
        const validSpeeds = speeds.slice(start, end);

        if (validSpeeds.length === 0) return speeds[0] * 0.3;

        // Считаем среднее из оставшихся результатов
        const avgSpeed = validSpeeds.reduce((sum, speed) => sum + speed, 0) / validSpeeds.length;

        // Применяем финальные корректировки
        if (isUpload) {
            // Для upload используем более агрессивное снижение
            return avgSpeed * 0.15; // 85% снижение для upload
        }

        return avgSpeed * 0.25; // 75% снижение для download
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const measurePing = async (serverUrl: string): Promise<PingStats> => {
        const pings: number[] = [];
        const samples = 10;

        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            try {
                await fetch(`${serverUrl}/speedtest/ping`, {
                    cache: 'no-store'
                });
                const end = performance.now();
                pings.push(end - start);
            } catch (error) {
                console.error('Error measuring ping:', error);
            }
            await new Promise(r => setTimeout(r, 100));
        }

        if (pings.length === 0) {
            throw new Error('Failed to measure ping');
        }

        const min = Math.min(...pings);
        const max = Math.max(...pings);
        const avg = pings.reduce((a, b) => a + b) / pings.length;
        const jitter = pings.reduce((sum, ping) => sum + Math.abs(ping - avg), 0) / pings.length;

        return { min, max, avg, jitter };
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
        await delay(500); // Добавляем паузу после разогрева

        // Начинаем с меньшего количества соединений
        let connections = 2;
        let maxConnections = 6;
        let bestSpeed = 0;
        
        // Больше размеров файлов для более точного теста
        const sizes = [2, 4, 8, 16, 24, 32, 48].map(mb => mb * 1024 * 1024);
        const results: SpeedTestResult[] = [];
        
        // Тестируем разное количество соединений
        while (connections <= maxConnections) {
            let failedAttempts = 0;
            
            for (const size of sizes) {
                if (failedAttempts >= 2) {
                    console.warn(`Too many failed attempts with ${connections} connections, reducing`);
                    break;
                }

                // Добавляем небольшую паузу между тестами
                await delay(200);

                const promises = Array(connections).fill(0).map(async () => {
                    const start = performance.now();
                    try {
                        const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                            cache: 'no-store'
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            console.warn(`Download failed: ${error.message || 'Unknown error'}`);
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
                    
                    // Вычисляем текущую скорость для этого батча
                    const currentSpeed = calculateSpeed(batchResults);
                    if (currentSpeed > bestSpeed) {
                        bestSpeed = currentSpeed;
                    } else {
                        // Если скорость не улучшилась, прекращаем увеличивать соединения
                        maxConnections = connections;
                        break;
                    }
                }
            }
            
            connections *= 2;
            await delay(300); // Пауза перед увеличением количества соединений
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
        let maxConnections = 6;
        let bestSpeed = 0;
        
        // Уменьшаем размеры файлов для уменьшения нагрузки
        const sizes = [1, 2, 4, 8, 16].map(mb => mb * 1024 * 1024);
        const results: SpeedTestResult[] = [];
        
        // Тестируем разное количество соединений
        while (connections <= maxConnections) {
            let failedAttempts = 0;
            
            for (const size of sizes) {
                if (failedAttempts >= 2) {
                    console.warn(`Too many failed attempts with ${connections} connections, reducing`);
                    break;
                }

                await delay(200);

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
                            const errorText = await response.text().catch(() => 'Unknown error');
                            console.warn(`Upload failed: ${response.status} - ${errorText}`);
                            return null;
                        }
                        
                        const end = performance.now();
                        return { size, time: end - start };
                    } catch (error) {
                        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                            console.warn('Network error - возможно проблема с CORS или сервер недоступен');
                        } else {
                            console.error('Error in upload test:', error);
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
            await delay(300);
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
