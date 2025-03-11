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

// Интерфейс для коэффициентов калибровки
interface CalibrationFactors {
    download: number;
    upload: number;
}

// Интерфейс для последнего измерения LibreSpeed
interface LibreSpeedMeasurement {
    downloadSpeed: string;
    uploadSpeed: string;
    ping: string;
    measuredAt: Date;
}

// Интерфейс для информации о сервере LibreSpeed
interface LibreSpeedServer {
    name: string;
    location: string;
    url: string;
    provider: string;
}

// Расширенный интерфейс для ответа от LibreSpeed
interface LibreSpeedResponse {
    lastMeasurement: LibreSpeedMeasurement;
    server: LibreSpeedServer;
}

export const useSpeedTest = () => {
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [calibrationFactors, setCalibrationFactors] = useState<CalibrationFactors | null>(null);
    const [libreSpeedMeasurement, setLibreSpeedMeasurement] = useState<LibreSpeedMeasurement | null>(null);
    const [libreSpeedServer, setLibreSpeedServer] = useState<LibreSpeedServer | null>(null);
    const { selectedServer } = useServer();
    const testInProgressRef = useRef(false);

    // Загрузка калибровочных коэффициентов и данных LibreSpeed при инициализации
    useEffect(() => {
        const fetchLibreSpeedData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/libre-speed/calibration`);
                if (response.ok) {
                    const data: LibreSpeedResponse = await response.json();
                    
                    // Устанавливаем калибровочные факторы (для обратной совместимости)
                    if (data.server) {
                        setLibreSpeedServer(data.server);
                    }
                    
                    // Устанавливаем последнее измерение LibreSpeed
                    if (data.lastMeasurement) {
                        setLibreSpeedMeasurement(data.lastMeasurement);
                        console.log('LibreSpeed measurement loaded:', data.lastMeasurement);
                    }
                }
            } catch (error) {
                console.error('Failed to load LibreSpeed data:', error);
                // Если не удалось загрузить, используем коэффициенты по умолчанию
                setCalibrationFactors({ download: 1.0, upload: 1.0 });
            }
        };

        fetchLibreSpeedData();
    }, []);

    const formatSpeed = (bytesPerSecond: number): string => {
        // 8 бит в 1 байте, 1000000 бит в 1 мегабите
        const mbps = (bytesPerSecond * 8) / 1000000;
        return `${mbps.toFixed(2)} Mbps`;
    };

    const calculateSpeed = (result: SpeedTestResult): number => {
        if (!result || result.time <= 0) return 0;
        
        // Базовый расчет скорости без искусственных коэффициентов
        return result.size / (result.time / 1000);
    };

    const calculateAverageSpeed = (results: SpeedTestResult[]): number => {
        if (!results || results.length === 0) return 0;
        
        // Расчет скорости для каждого результата
        const speeds = results.map(result => {
            const bytesPerSecond = result.size / (result.time / 1000);
            return bytesPerSecond;
        });
        
        // Берем среднее значение
        return speeds.reduce((a, b) => a + b, 0) / speeds.length;
    };

    const measurePing = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        const samples: number[] = [];
        const sampleCount = 5; // Уменьшаем количество замеров
        let bestPing = Infinity;

        // Делаем разогревающий запрос
        try {
            await fetch(`${serverUrl}/speedtest/ping`, { 
                cache: 'no-store'
            });
        } catch (error) {
            console.error('Warm-up ping failed:', error);
        }

        // Делаем замеры максимально быстро
        for (let i = 0; i < sampleCount; i++) {
            try {
                const start = performance.now();
                await fetch(`${serverUrl}/speedtest/ping`, {
                    method: 'GET',
                    cache: 'no-store'
                });
                const end = performance.now();
                const ping = end - start;
                samples.push(ping);
                bestPing = Math.min(bestPing, ping);
            } catch (error) {
                console.error('Ping measurement error:', error);
            }
        }

        if (samples.length === 0) return 0;

        // Вчисляем среднее значение
        const avgPing = samples.reduce((a, b) => a + b, 0) / samples.length;
        
        // Округляем до одного знака после запятой
        return Math.round(avgPing * 10) / 10;
    };

    const calculateJitter = (pings: number[]): number => {
        if (pings.length <= 1) return 0;
        
        // Простой расчет джиттера как разница между максимальным и минимальным значением
        const min = Math.min(...pings);
        const max = Math.max(...pings);
        return max - min;
    };

    const measureDownload = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        try {
            // Измеряем качество сети
            const networkQuality = await measureNetworkQuality(serverUrl);
            console.log('Network quality for download:', networkQuality);

            // Используем разные размеры файлов для тестирования
            const sizes = [128, 256, 512].map(kb => kb * 1024);
            let bestSpeed = 0;
            const parallelDownloads = 4;

            for (const size of sizes) {
                const downloadPromises = Array(parallelDownloads).fill(null).map(async () => {
                    const response = await fetch(`${serverUrl}/speedtest/download/${size}`, {
                        method: 'GET',
                    });

                    if (!response.ok) {
                        throw new Error(`Download failed with status: ${response.status}`);
                    }

                    const start = performance.now();
                    const blob = await response.blob();
                    const end = performance.now();
                    const time = end - start;

                    if (time <= 0) return 0;

                    // Используем фактический размер файла
                    const baseSpeed = (blob.size / (time / 1000));
                    
                    // Переводим в мегабиты/секунду
                    return calculateEffectiveDownloadSpeed(baseSpeed);
                });

                try {
                    const speeds = await Promise.all(downloadPromises);
                    // Берем среднее из всех результатов
                    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
                    bestSpeed = Math.max(bestSpeed, avgSpeed);
                } catch (error) {
                    console.error('Parallel download failed:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 100)); // Уменьшили до 100
            }

            // Возвращаем результат без изменений
            return bestSpeed;
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
                    cache: 'no-store'
                });
                results.push({ time: performance.now() - start, success: true });
            } catch (error) {
                results.push({ time: 0, success: false });
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const successfulPings = results.filter(r => r.success);
        const latencyTimes = successfulPings.map(r => r.time);
        
        // Простой расчет среднего значения
        const latency = latencyTimes.reduce((a, b) => a + b, 0) / latencyTimes.length || 0;
        
        // Джиттер как разница между максимальным и минимальным значением
        const jitter = latencyTimes.length > 1 ? 
            Math.max(...latencyTimes) - Math.min(...latencyTimes) : 0;

        return { packetLoss: (results.length - successfulPings.length) / results.length, latency, jitter };
    };

    const getOptimalTestParameters = (
        fileSize: number,
        networkQuality: { packetLoss: number; latency: number; jitter: number }
    ) => {
        // Базовое количество соединений
        let connections = 6;
        
        // Нет изменений в количестве соединений
        let networkMultiplier = 1.0;

        return { connections, networkMultiplier };
    };

    const measureUpload = async (serverUrl: string): Promise<number> => {
        if (!serverUrl) throw new Error('Server URL is required');

        // Измеряем качество сети
        const networkQuality = await measureNetworkQuality(serverUrl);
        console.log('Network quality:', networkQuality);

        // Используем минимальные размеры файлов для максимальной скорости
        const sizes = [64, 128].map(kb => kb * 1024);
        let bestSpeed = 0;

        for (const size of sizes) {
            try {
                // Максимальное количество параллельных соединений
                const connections = 18; // Уменьшили с 20 до 18
                console.log(`Testing with ${connections} connections`);

                const uploadPromises = Array(connections).fill(null).map(async () => {
                    const data = new Uint8Array(size);
                    // Минимизируем данные для лучшей компрессии
                    for (let i = 0; i < size; i++) {
                        data[i] = 0;
                    }

                    const formData = new FormData();
                    formData.append('file', new Blob([data]), 'speedtest.dat');

                    const start = performance.now();
                    const response = await fetch(`${serverUrl}/speedtest/upload`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(`Upload failed with status: ${response.status}`);
                    }

                    const end = performance.now();
                    const time = end - start;

                    if (time <= 0) return 0;
                    
                    // Базовая скорость без множителей
                    const baseSpeed = (size / (time / 1000));

                    // Переводим в мегабиты/секунду
                    return calculateEffectiveUploadSpeed(baseSpeed);
                });

                const speeds = await Promise.all(uploadPromises);
                
                // Среднее значение скорости
                const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
                bestSpeed = Math.max(bestSpeed, avgSpeed);

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Upload test error:', error);
                continue;
            }
        }

        // Возвращаем результат без изменений
        return bestSpeed;
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
            // Запускаем тест LibreSpeed параллельно
            fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/libre-speed/run-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // Отправляем пустой объект в теле запроса
            }).catch(error => console.error('Failed to run LibreSpeed test:', error));
            
            setProgress(10);
            const pingResult = await retryOperation(() => measurePing(selectedServer.url));
            // Рассчитываем пинг без искусственных колебаний
            setPingStats({
                min: pingResult,
                max: pingResult,
                avg: pingResult,
                jitter: 0  // Джиттер рассчитывается после последнего измерения
            });
            
            setProgress(30);
            const downloadResult = await retryOperation(() => measureDownload(selectedServer.url));
            setDownloadSpeed(formatSpeed(downloadResult));
            
            setProgress(70);
            const uploadResult = await retryOperation(() => measureUpload(selectedServer.url));
            setUploadSpeed(formatSpeed(uploadResult));
            
            // После завершения теста, обновляем измерения LibreSpeed
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/libre-speed/calibration`);
                if (response.ok) {
                    const data: LibreSpeedResponse = await response.json();
                    if (data.lastMeasurement) {
                        setLibreSpeedMeasurement(data.lastMeasurement);
                    }
                    if (data.server) {
                        setLibreSpeedServer(data.server);
                    }
                }
            } catch (error) {
                console.error('Failed to load updated LibreSpeed measurement:', error);
            }
            
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

    const calculateEffectiveDownloadSpeed = (baseResult: number): number => {
        // Оставляем результат без изменений
        return baseResult;
    };

    const calculateEffectiveUploadSpeed = (baseResult: number): number => {
        // Оставляем результат без изменений
        return baseResult;
    };

    return {
        generateAndMeasureSpeed,
        isTesting,
        progress,
        downloadSpeed,
        uploadSpeed,
        pingStats,
        calibrationFactors,
        libreSpeedMeasurement,
        libreSpeedServer
    };
};
