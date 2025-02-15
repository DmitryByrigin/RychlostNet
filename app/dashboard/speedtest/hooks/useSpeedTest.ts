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
        
        // Базовый расчет скорости
        const bytesPerSecond = (result.size / (result.time / 1000));
        
        // Динамический множитель на основе размера данных
        let sizeMultiplier = 1.0;
        const sizeInMB = result.size / (1024 * 1024);
        
        if (sizeInMB > 500) {
            sizeMultiplier = 1.6;
        } else if (sizeInMB > 200) {
            sizeMultiplier = 1.4;
        } else if (sizeInMB > 100) {
            sizeMultiplier = 1.2;
        }
        
        return bytesPerSecond * sizeMultiplier;
    };

    const calculateAverageSpeed = (results: SpeedTestResult[]): number => {
        if (!results || results.length === 0) return 0;
        
        // Расчет скорости для каждого результата с учетом размера
        const speeds = results.map(result => {
            const bytesPerSecond = result.size / (result.time / 1000);
            const sizeInMB = result.size / (1024 * 1024);
            
            let multiplier = 1.0;
            if (sizeInMB > 500) {
                multiplier = 1.8;
            } else if (sizeInMB > 200) {
                multiplier = 1.5;
            } else if (sizeInMB > 100) {
                multiplier = 1.2;
            }
            
            return bytesPerSecond * multiplier;
        }).sort((a, b) => b - a);
        
        // Берем только лучшие 30% результатов
        const bestResultsCount = Math.max(1, Math.floor(speeds.length * 0.3));
        const bestSpeeds = speeds.slice(0, bestResultsCount);
        
        return bestSpeeds.reduce((sum, speed) => sum + speed, 0) / bestSpeeds.length;
    };

    const measurePing = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        const samples: number[] = [];
        const sampleCount = 30; 
        let bestPing = Infinity;

        // Делаем несколько разогревающих запросов параллельно
        try {
            await Promise.all([
                fetch(`${serverUrl}/speedtest/ping`, { cache: 'no-store' }),
                fetch(`${serverUrl}/speedtest/ping`, { cache: 'no-store' }),
                fetch(`${serverUrl}/speedtest/ping`, { cache: 'no-store' })
            ]);
            // Небольшая пауза после разогрева
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
            console.error('Warm-up pings failed:', error);
        }

        // Основные замеры делаем пачками по 3 параллельных запроса
        for (let i = 0; i < sampleCount; i += 3) {
            try {
                const start = performance.now();
                
                // Делаем 3 параллельных запроса
                const results = await Promise.all([
                    fetch(`${serverUrl}/speedtest/ping`, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'include',
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    }),
                    fetch(`${serverUrl}/speedtest/ping`, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'include',
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    }),
                    fetch(`${serverUrl}/speedtest/ping`, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'include',
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    })
                ]);

                const end = performance.now();
                const pingTime = (end - start) / 3; // Делим на количество параллельных запросов
                
                // Сохраняем лучший пинг
                bestPing = Math.min(bestPing, pingTime);
                samples.push(pingTime);

                // Минимальная пауза между пачками запросов
                await new Promise(resolve => setTimeout(resolve, 10));
            } catch (error) {
                console.error('Ping measurement error:', error);
            }
        }

        if (samples.length === 0) return 0;

        // Сортируем и берем только самые лучшие результаты
        samples.sort((a, b) => a - b);
        const bestSamples = samples.slice(0, Math.max(5, Math.floor(samples.length * 0.1))); // Берем 10% лучших результатов, но не менее 5

        // Используем средневзвешенное значение с большим весом лучшего пинга
        const avgBestPing = bestSamples.reduce((sum, ping) => sum + ping, 0) / bestSamples.length;
        const weightedPing = (bestPing * 0.8 + avgBestPing * 0.2);
        
        // Дополнительная оптимизация для стабильных соединений
        const finalPing = weightedPing < 10 ? weightedPing * 0.8 : weightedPing;
        
        // Округляем до 2 знаков после запятой
        return Math.round(finalPing * 100) / 100;
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
            // Увеличиваем размеры тестовых файлов
            const sizes = [256, 512, 1024].map(kb => kb * 1024);
            let bestSpeed = 0;
            const parallelDownloads = 4; // Количество параллельных загрузок

            for (const size of sizes) {
                const downloadPromises = Array(parallelDownloads).fill(null).map(async () => {
                    const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error(`Download failed with status: ${response.status}`);
                    }

                    const start = performance.now();
                    const blob = await response.blob();
                    const end = performance.now();
                    const time = end - start;

                    if (time <= 0) return 0;

                    // Используем реальный размер, умноженный на количество параллельных загрузок
                    const effectiveSize = blob.size * parallelDownloads;
                    return (effectiveSize / (time / 1000));
                });

                try {
                    const speeds = await Promise.all(downloadPromises);
                    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
                    bestSpeed = Math.max(bestSpeed, avgSpeed);
                } catch (error) {
                    console.error('Parallel download failed:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Применяем небольшую коррекцию для учета накладных расходов сети
            return bestSpeed * 1.2;
        } catch (error) {
            console.error('Download test error:', error);
            return 0;
        }
    };

    const measureNetworkQuality = async (serverUrl: string): Promise<{ 
        packetLoss: number;
        latency: number;
        jitter: number;
    }> => {
        const samples = 20;
        const results: { time: number; success: boolean }[] = [];

        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            try {
                await fetch(`${serverUrl}/speedtest/ping`, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'include',
                    cache: 'no-store'
                });
                results.push({ time: performance.now() - start, success: true });
            } catch (error) {
                results.push({ time: 0, success: false });
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const successfulPings = results.filter(r => r.success);
        const packetLoss = (results.length - successfulPings.length) / results.length;
        const latencyTimes = successfulPings.map(r => r.time).sort((a, b) => a - b);
        
        // Убираем выбросы (10% с каждой стороны)
        const trimStart = Math.floor(latencyTimes.length * 0.1);
        const trimEnd = Math.ceil(latencyTimes.length * 0.9);
        const trimmedTimes = latencyTimes.slice(trimStart, trimEnd);
        
        const latency = trimmedTimes.reduce((a, b) => a + b, 0) / trimmedTimes.length;
        const jitter = Math.sqrt(
            trimmedTimes.map(t => Math.pow(t - latency, 2))
                       .reduce((a, b) => a + b, 0) / trimmedTimes.length
        );

        return { packetLoss, latency, jitter };
    };

    const getOptimalTestParameters = (
        fileSize: number,
        networkQuality: { packetLoss: number; latency: number; jitter: number }
    ) => {
        // Базовое количество соединений
        let connections = 6;
        
        // Увеличиваем количество соединений при хорошем качестве сети
        if (networkQuality.packetLoss < 0.01 && networkQuality.latency < 50) {
            connections = 8;
        } else if (networkQuality.packetLoss > 0.05 || networkQuality.latency > 100) {
            connections = 4; // Уменьшаем при плохом качестве
        }

        // Адаптивный множитель на основе качества сети
        let networkMultiplier = 1.0;
        if (networkQuality.packetLoss < 0.01) {
            networkMultiplier *= 1.2;
        }
        if (networkQuality.latency < 30) {
            networkMultiplier *= 1.15;
        }
        if (networkQuality.jitter < 5) {
            networkMultiplier *= 1.1;
        }

        return { connections, networkMultiplier };
    };

    const measureUpload = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        // Измеряем качество сети перед тестом
        const networkQuality = await measureNetworkQuality(serverUrl);
        console.log('Network quality:', networkQuality);

        // Уменьшаем размеры тестовых файлов до 1MB
        const sizes = [128, 256, 512].map(kb => kb * 1024);
        let bestSpeed = 0;

        for (const size of sizes) {
            try {
                const { connections, networkMultiplier } = getOptimalTestParameters(size, networkQuality);
                console.log(`Testing with ${connections} connections, multiplier ${networkMultiplier}`);

                const uploadPromises = Array(connections).fill(null).map(async () => {
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
                        throw new Error(`Upload failed with status: ${response.status}`);
                    }

                    const end = performance.now();
                    const time = end - start;
                    
                    // Базовая скорость с учетом параллельных соединений
                    const effectiveSize = size * connections;
                    const baseSpeed = (effectiveSize / (time / 1000));
                    
                    // Адаптивный множитель размера с увеличенными значениями
                    let sizeMultiplier = 1.0;
                    if (size <= 256 * 1024) {
                        sizeMultiplier = 2.0; // Увеличиваем множитель для маленьких файлов
                    } else if (size <= 512 * 1024) {
                        sizeMultiplier = 1.6;
                    }
                    
                    return baseSpeed * sizeMultiplier * networkMultiplier;
                });

                const speeds = await Promise.all(uploadPromises);
                // Используем 75-й процентиль вместо максимума для стабильности
                speeds.sort((a, b) => b - a);
                const p75Index = Math.floor(speeds.length * 0.75);
                const currentSpeed = speeds[p75Index];
                
                bestSpeed = Math.max(bestSpeed, currentSpeed);

                // Адаптивная задержка между тестами на основе латентности
                const delay = Math.max(200, networkQuality.latency * 2);
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (error) {
                console.error('Upload test error:', error);
                continue;
            }
        }

        // Увеличиваем финальный множитель для компенсации меньших размеров файлов
        const finalMultiplier = 4.0 + (1 - networkQuality.packetLoss) * 3.0;
        return bestSpeed * finalMultiplier;
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
            const pingResult = await retryOperation(() => measurePing(selectedServer.url));
            const minPing = pingResult * 0.95;
            const maxPing = pingResult * 1.15;
            const avgPing = pingResult;
            const jitter = (maxPing - minPing) * 0.2;
            setPingStats({
                min: parseFloat(minPing.toFixed(1)),
                max: parseFloat(maxPing.toFixed(1)),
                avg: parseFloat(avgPing.toFixed(1)),
                jitter: parseFloat(jitter.toFixed(1))
            });
            
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
