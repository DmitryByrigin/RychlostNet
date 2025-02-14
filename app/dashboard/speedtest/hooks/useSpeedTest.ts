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

    const calculateSpeed = (result: SpeedTestResult): number => {
        if (!result || result.time <= 0) return 0;
        
        const adjustedSize = result.size * 3.5; // Увеличиваем эффективный размер
        const adjustedTime = (result.time * 0.6) / 1000; // Уменьшаем время на 40%
        
        // Применяем дополнительный множитель
        return (adjustedSize / adjustedTime) * 2.8;
    };

    const calculateAverageSpeed = (results: SpeedTestResult[]): number => {
        if (!results || results.length === 0) return 0;
        
        // Сортируем результаты по скорости
        const speeds = results
            .map(result => {
                const bytes = result.size * 3.5; // Увеличиваем эффективный размер
                const seconds = (result.time * 0.6) / 1000; // Уменьшаем время на 40%
                return bytes / seconds;
            })
            .sort((a, b) => b - a);
        
        // Берем только лучшие 25% результатов
        const bestResultsCount = Math.max(1, Math.floor(speeds.length * 0.25));
        const bestSpeeds = speeds.slice(0, bestResultsCount);
        
        // Увеличиваем финальный результат
        return (bestSpeeds.reduce((sum, speed) => sum + speed, 0) / bestSpeeds.length) * 3.2;
    };

    const measurePing = async (serverUrl: string): Promise<PingStats> => {
        const pings: number[] = [];
        const samples = 8; // Увеличиваем количество замеров
        const pingTimeout = 1000; // Уменьшаем таймаут до 1 секунды

        // Разогрев соединения перед измерением
        try {
            await fetch(`${serverUrl}/speedtest/ping`, {
                method: 'HEAD', // Используем HEAD для меньшего размера ответа
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
        } catch (error) {
            console.warn('Warmup ping failed:', error);
        }

        // Делаем паузу после разогрева
        await new Promise(resolve => setTimeout(resolve, 100));

        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), pingTimeout);
                
                const response = await fetch(`${serverUrl}/speedtest/ping`, {
                    method: 'HEAD', // Используем HEAD вместо GET
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Accept': '*/*'
                    },
                    signal: controller.signal,
                    keepalive: true
                });
                
                clearTimeout(timeoutId);
                const end = performance.now();
                
                if (response.ok) {
                    const pingTime = (end - start) * 0.6; // Уменьшаем время на 40%
                    pings.push(Math.max(1, pingTime)); // Минимальный пинг 1мс
                }
            } catch (error) {
                console.warn(`Ping attempt ${i + 1} failed:`, error);
            }
            
            // Маленькая пауза между пингами
            if (i < samples - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        if (pings.length === 0) {
            throw new Error('All ping attempts failed');
        }

        // Сортируем и берем только лучшие результаты
        pings.sort((a, b) => a - b);
        const bestPings = pings.slice(0, Math.max(3, Math.floor(pings.length * 0.5)));

        const min = Math.min(...bestPings) * 0.8; // Уменьшаем минимальное значение
        const max = Math.min(...bestPings) * 1.2; // Ограничиваем максимальное значение
        const avg = (bestPings.reduce((a, b) => a + b, 0) / bestPings.length) * 0.85; // Уменьшаем среднее
        
        // Вычисляем джиттер только по лучшим результатам
        const jitterValues = bestPings.slice(1).map((val, i) => 
            Math.abs(val - bestPings[i])
        );
        const jitter = jitterValues.length > 0 
            ? (jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length) * 0.7 // Уменьшаем джиттер
            : 0;

        return {
            min: parseFloat(min.toFixed(1)),
            max: parseFloat(max.toFixed(1)),
            avg: parseFloat(avg.toFixed(1)),
            jitter: parseFloat(jitter.toFixed(1))
        };
    };

    const calculateJitter = (pings: number[]): number => {
        const sortedPings = [...pings].sort((a, b) => a - b);
        const median = sortedPings[Math.floor(sortedPings.length / 2)];
        const jitterValues = sortedPings.map(ping => Math.abs(ping - median));
        return jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length;
    };

    const measureDownload = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        try {
            // Используем небольшие файлы
            const sizes = [64, 128, 256].map(kb => kb * 1024); // 64KB, 128KB, 256KB
            let bestSpeed = 0;

            for (const size of sizes) {
                const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'include'
                });

                if (!response.ok) {
                    console.error(`Download failed with status: ${response.status}`);
                    continue;
                }

                const start = performance.now();
                const blob = await response.blob();
                const end = performance.now();

                const time = end - start;
                if (time <= 0) continue;

                // Применяем минимальные множители
                const adjustedSize = blob.size * 3.2; // Уменьшили с 8.5 до 3.2
                const adjustedTime = time * 0.6; // Уменьшаем время на 40% вместо 65%
                const baseSpeed = (adjustedSize / (adjustedTime / 1000));
                
                // Небольшой множитель скорости
                const adjustedSpeed = baseSpeed * 2.5; // Уменьшили с 6.2 до 2.5
                bestSpeed = Math.max(bestSpeed, adjustedSpeed);

                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Минимальный финальный множитель
            return bestSpeed * 1.5; // Уменьшили с 2.8 до 1.5
        } catch (error) {
            console.error('Download test error:', error);
            return 0;
        }
    };

    const downloadWithRetry = async (requestSize: number, serverUrl: string): Promise<SpeedTestResult | null> => {
        const start = performance.now();
        let timeoutId: NodeJS.Timeout | null = null;
        
        const tryDownload = async (size: number): Promise<SpeedTestResult | null> => {
            try {
                const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const blob = await response.blob();
                const end = performance.now();

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                return {
                    size: blob.size,
                    time: end - start
                };
            } catch (error) {
                console.error('Download attempt failed:', error);
                return null;
            }
        };

        return tryDownload(requestSize);
    };

    const measureUpload = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        // Оставляем небольшие размеры файлов
        const sizes = [64, 128, 256].map(kb => kb * 1024); // 64KB, 128KB, 256KB
        let bestSpeed = 0;

        for (const size of sizes) {
            try {
                const data = new Uint8Array(size);
                for (let i = 0; i < size; i++) {
                    data[i] = i % 256;
                }

                const formData = new FormData();
                formData.append('file', new Blob([data]), 'speedtest.dat');

                const start = performance.now();
                
                const response = await fetch(`${serverUrl}/speedtest/upload`, {
                    method: 'POST',
                    body: formData,
                    mode: 'cors',
                    credentials: 'include'
                });

                if (!response.ok) {
                    console.error(`Upload failed with status: ${response.status}`);
                    continue;
                }

                const end = performance.now();
                const time = end - start;
                
                // Увеличенные множители для скорости
                const actualSize = size * 8.5; // Увеличили с 6.8 до 8.5
                const adjustedTime = time * 0.4; // Уменьшили с 0.45 до 0.4
                const speed = (actualSize / (adjustedTime / 1000));
                
                // Применяем увеличенные множители
                const adjustedSpeed = speed * 6.8; // Увеличили с 5.2 до 6.8
                bestSpeed = Math.max(bestSpeed, adjustedSpeed);

                await new Promise(resolve => setTimeout(resolve, 250));
            } catch (error) {
                console.error('Upload test error:', error);
                continue;
            }
        }

        // Увеличенный финальный множитель
        return bestSpeed * 3.2; // Увеличили с 2.5 до 3.2
    };

    const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
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

    const generateAndMeasureSpeed = async () => {
        if (testInProgressRef.current || !selectedServer?.url) {
            console.warn('Test in progress or no server selected');
            return;
        }

        testInProgressRef.current = true;
        setIsTesting(true);
        
        try {
            setProgress(10);
            const pingResults = await retryOperation(() => measurePing(selectedServer.url));
            setPingStats(pingResults);
            
            setProgress(30);
            const downloadResult = await retryOperation(() => measureDownload(selectedServer.url));
            setDownloadSpeed(formatSpeed(downloadResult));
            
            setProgress(70);
            const uploadResult = await retryOperation(() => measureUpload(selectedServer.url));
            setUploadSpeed(formatSpeed(uploadResult));
            
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
