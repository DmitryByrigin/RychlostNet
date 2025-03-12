import { useState, useRef, useEffect, useCallback } from 'react';
import { LibreSpeedServer, SpeedTestResult } from '../types/librespeed';
import { PingStats, SpeedTestResultExtended } from './utils/types';
import { useServer } from '../contexts/ServerContext';

/**
 * Хук для работы с тестом скорости интернета 
 * Реализация через прямые API-запросы к бэкенду
 */
export const useSpeedTest = () => {
    // Состояния для отображения результатов
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState(false);
    const [progress, setProgress] = useState(0);
    
    // Состояния для управления серверами и результатами
    const [servers, setServers] = useState<LibreSpeedServer[]>([]);
    const [selectedServer, setSelectedServer] = useState<LibreSpeedServer | null>(null);
    const [libreSpeedResult, setLibreSpeedResult] = useState<SpeedTestResultExtended | null>(null);
    
    // Референс для отслеживания выполнения теста
    const testInProgressRef = useRef(false);
    const { geolocationData } = useServer();
    
    // Кэширование данных о серверах
    const CACHE_DURATION = 5 * 60 * 1000; // 5 минут в миллисекундах
    
    // Загрузка списка серверов с кэшированием
    useEffect(() => {
        const loadServers = async () => {
            try {
                // Проверяем локальный кэш
                const cacheKey = 'server_info_cache';
                const cacheStr = localStorage.getItem(cacheKey);
                
                if (cacheStr) {
                    try {
                        const cache = JSON.parse(cacheStr);
                        if (Date.now() - cache.timestamp < CACHE_DURATION) {
                            console.log('Using cached server info in useSpeedTest');
                            setServers(cache.data);
                            
                            // Если сервер еще не выбран, выбираем первый из списка
                            if (!selectedServer && cache.data.length > 0) {
                                setSelectedServer(cache.data[0]);
                            }
                            return;
                        }
                    } catch (e) {
                        console.warn('Failed to parse server cache:', e);
                    }
                }
                
                // Если нет кэша или кэш устарел, делаем запрос
                console.log('Fetching fresh server info in useSpeedTest...');
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/speedtest/server-info`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.servers && data.servers.length > 0) {
                        // Преобразуем серверы в формат LibreSpeedServer
                        const formattedServers: LibreSpeedServer[] = data.servers.map((s: any) => ({
                            name: s.name || 'Неизвестный сервер',
                            server: s.url || '', // Используем url как server
                            dlURL: 'garbage.php',
                            ulURL: 'empty.php',
                            pingURL: 'empty.php',
                            getIpURL: 'getIP.php',
                            location: s.location || {
                                city: s.city || '',
                                region: s.region || '',
                                country: s.country || '',
                                org: s.sponsor || ''
                            }
                        }));
                        
                        // Кэшируем результат
                        localStorage.setItem(cacheKey, JSON.stringify({
                            data: formattedServers,
                            timestamp: Date.now()
                        }));
                        
                        setServers(formattedServers);
                        
                        // Если сервер еще не выбран, выбираем первый из списка
                        if (!selectedServer && formattedServers.length > 0) {
                            setSelectedServer(formattedServers[0]);
                        }
                    }
                }
            } catch (error) {
                console.error('Ошибка при загрузке списка серверов:', error);
            }
        };
        
        loadServers();
    }, [selectedServer]);

    // Функция для тестирования пинга
// Функция для тестирования пинга
const testPing = async (): Promise<{min: number, max: number, avg: number, jitter: number}> => {
    try {
        if (!selectedServer) {
            throw new Error('Сервер не выбран');
        }
        
        // Выполним несколько запросов пинга для получения более точных данных
        const pingResults: number[] = [];
        const pingCount = 5;
        
        for (let i = 0; i < pingCount; i++) {
            const startTime = Date.now();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/speedtest/ping`);
            const endTime = Date.now();
            
            if (response.ok) {
                // Рассчитываем пинг как разницу во времени
                const pingTime = endTime - startTime;
                pingResults.push(pingTime);
            } else {
                throw new Error('Ошибка при тестировании пинга');
            }
        }
        
        if (pingResults.length > 0) {
            // Рассчитываем статистику
            const min = Math.min(...pingResults);
            const max = Math.max(...pingResults);
            const avg = pingResults.reduce((sum, time) => sum + time, 0) / pingResults.length;
            
            // Рассчитываем джиттер как стандартное отклонение
            const variance = pingResults.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / pingResults.length;
            const jitter = Math.sqrt(variance);
            
            return {
                min,
                max,
                avg,
                jitter
            };
        }
        
        throw new Error('Не получены данные о пинге');
    } catch (error) {
        console.error('Ошибка при тестировании пинга:', error);
        return { min: 0, max: 0, avg: 0, jitter: 0 };
    }
};
    
    // Функция для тестирования загрузки (download)
// Функция для тестирования загрузки (download)
const testDownload = async (): Promise<number> => {
    try {
        if (!selectedServer) {
            throw new Error('Сервер не выбран');
        }
        
        // Используем корректный URL эндпоинта (уменьшенный размер файла 2MB)
        const size = 1 * 1024 * 1024;
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/speedtest/download/${size}`);
        
        if (response.ok) {
            const startTime = Date.now();
            await response.arrayBuffer(); // Дожидаемся полной загрузки данных
            const endTime = Date.now();
            
            // Считаем скорость в Mbps
            const duration = (endTime - startTime) / 1000; // в секундах
            const speedMbps = (size * 8) / 1000000 / duration; // биты в Мбиты/с
            
            return speedMbps;
        }
        
        throw new Error('Не удалось получить скорость загрузки');
    } catch (error) {
        console.error('Ошибка при тестировании скорости загрузки:', error);
        return 0;
    }
};
    
// Функция для тестирования выгрузки (upload)
const testUpload = async (): Promise<number> => {
    try {
        if (!selectedServer) {
            throw new Error('Сервер не выбран');
        }
        
        // Создаем данные для отправки (уменьшенный размер)
        const dataSize = 1024 * 1024 * 1; // 1 MB
        const randomData = new ArrayBuffer(dataSize);
        const blob = new Blob([randomData], { type: 'application/octet-stream' });
        
        // Создаем форму для multipart/form-data
        const formData = new FormData();
        formData.append('file', new File([blob], 'speedtest.bin', { type: 'application/octet-stream' }));
        
        const startTime = Date.now();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/speedtest/upload`, {
            method: 'POST',
            body: formData
        });
        const endTime = Date.now();
        
        if (response.ok) {
            // Рассчитываем скорость в Mbps
            const duration = (endTime - startTime) / 1000; // в секундах
            const speedMbps = (dataSize * 8) / 1000000 / duration; // из бит в Мбит/с
            
            return speedMbps;
        }
        
        throw new Error('Не удалось получить скорость выгрузки');
    } catch (error) {
        console.error('Ошибка при тестировании скорости выгрузки:', error);
        return 0;
    }
};
    
    // Функция для запуска теста скорости
    const generateAndMeasureSpeed = async () => {
        // Если тест уже запущен, просто вернемся
        if (testInProgressRef.current) {
            return;
        }
        
        testInProgressRef.current = true;
        setIsTesting(true);
        setProgress(0);
        
        // Сбрасываем предыдущие результаты
        setDownloadSpeed('');
        setUploadSpeed('');
        setPingStats({ min: 0, max: 0, avg: 0, jitter: 0 });
        
        try {
            // Тест пинга (25% прогресса)
            setProgress(5);
            const pingResult = await testPing();
            setPingStats(pingResult);
            setProgress(25);
            
            // Тест скорости загрузки (25% до 65% прогресса)
            setProgress(30);
            const downloadResult = await testDownload();
            setDownloadSpeed(`${downloadResult.toFixed(2)} Mbps`);
            setProgress(65);
            
            // Тест скорости выгрузки (65% до 100% прогресса)
            setProgress(70);
            const uploadResult = await testUpload();
            setUploadSpeed(`${uploadResult.toFixed(2)} Mbps`);
            setProgress(100);
            
            // Сохраняем результаты
            const result: SpeedTestResultExtended = {
                download: downloadResult,
                upload: uploadResult,
                ping: {
                    min: pingResult.min,
                    max: pingResult.max,
                    avg: pingResult.avg
                },
                jitter: pingResult.jitter,
                ip: geolocationData?.ip || '',
                server: selectedServer || undefined,
                timestamp: new Date().toISOString()
            };
            
            setLibreSpeedResult(result);
            
            // Отправляем результаты на сервер
            saveResults(result);
            
        } catch (error) {
            console.error('Ошибка при запуске теста скорости:', error);
        } finally {
            setIsTesting(false);
            testInProgressRef.current = false;
        }
    };
    
    // Функция для сохранения результатов
    const saveResults = async (result: SpeedTestResultExtended) => {
        try {
            // Просто логируем результаты в консоль, так как эндпоинта нет
            console.log('Результаты тестирования:', result);
            
            // Если нужно в будущем добавить сохранение на сервер
            // await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/librespeed/results`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(result)
            // });
        } catch (error) {
            console.error('Ошибка при сохранении результатов:', error);
        }
    };
    
    // Возвращаем публичный API хука
    return {
        uploadSpeed,
        downloadSpeed,
        pingStats,
        isTesting,
        progress,
        libreSpeedResult,
        generateAndMeasureSpeed,
        servers,
        selectedServer,
        setSelectedServer
    };
};

