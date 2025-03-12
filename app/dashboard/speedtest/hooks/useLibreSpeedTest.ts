import { useState, useRef, useEffect, useCallback } from 'react';
import { useServer } from '../contexts/ServerContext';
import { LibreSpeedServer, SpeedTestResult } from '../types/librespeed';
import { PingStats } from './utils/types';

/**
 * Хук для работы с тестом скорости через LibreSpeed API
 */
export const useLibreSpeedTest = () => {
    const [downloadSpeed, setDownloadSpeed] = useState<string>('');
    const [uploadSpeed, setUploadSpeed] = useState<string>('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [libreSpeedResult, setLibreSpeedResult] = useState<SpeedTestResult | null>(null);
    const [servers, setServers] = useState<LibreSpeedServer[]>([]);
    const [selectedServer, setSelectedServer] = useState<LibreSpeedServer | null>(null);
    
    const testInProgressRef = useRef<boolean>(false);
    const { geolocationData } = useServer();
    
    // Загрузка списка серверов
    useEffect(() => {
        const fetchServers = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/speedtest/server-info`);
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data && data.servers && data.servers.length > 0) {
                        // Преобразуем серверы в формат LibreSpeedServer
                        const formattedServers: LibreSpeedServer[] = data.servers.map((s: any) => ({
                            name: s.name || 'Неизвестный сервер',
                            server: s.url || '',
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
                        
                        setServers(formattedServers);
                        
                        // Если сервер еще не выбран, выбираем первый из списка
                        if (!selectedServer && formattedServers.length > 0) {
                            setSelectedServer(formattedServers[0]);
                        }
                    } else {
                        // Если серверов нет, создаем локальный сервер
                        const defaultServer: LibreSpeedServer = {
                            name: 'RychlostNet Local',
                            server: window.location.origin + '/api/librespeed',
                            dlURL: 'garbage.php',
                            ulURL: 'empty.php',
                            pingURL: 'empty.php',
                            getIpURL: 'getIP.php',
                            location: {
                                city: 'Local',
                                region: 'Local',
                                country: 'Local',
                                org: 'RychlostNet'
                            }
                        };
                        setServers([defaultServer]);
                        setSelectedServer(defaultServer);
                    }
                }
            } catch (error) {
                console.error('Ошибка при загрузке списка серверов LibreSpeed:', error);
            }
        };
        
        fetchServers();
    }, [selectedServer]);
    
    // Функция для тестирования загрузки (download)
// Функция для тестирования загрузки (download)
const testDownload = async (): Promise<number> => {
    try {
        if (!selectedServer) {
            throw new Error('Сервер не выбран');
        }
        
        // Используем API LibreSpeed для тестирования загрузки
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/librespeed/garbage?size=10000000`);
        
        if (response.ok) {
            const startTime = Date.now();
            await response.arrayBuffer(); // Дожидаемся полной загрузки данных
            const endTime = Date.now();
            
            // Считаем скорость в Mbps
            const duration = (endTime - startTime) / 1000; // в секундах
            const sizeInBits = 10000000 * 8; // в битах
            const speedMbps = sizeInBits / 1000000 / duration; // в Мбит/с
            
            return speedMbps;
        }
        
        throw new Error('Не удалось получить скорость загрузки');
    } catch (error) {
        console.error('Ошибка при тестировании скорости загрузки:', error);
        return 0;
    }
};
    // Функция для тестирования выгрузки (upload)
// Функция для тестирования выгрузки (upload)
const testUpload = async (): Promise<number> => {
    try {
        if (!selectedServer) {
            throw new Error('Сервер не выбран');
        }
        
        // Создаем данные для отправки
        const dataSize = 1024 * 1024 * 5; // 5 MB
        const randomData = new ArrayBuffer(dataSize);
        const blob = new Blob([randomData], { type: 'application/octet-stream' });
        
        // Создаем форму для multipart/form-data
        const formData = new FormData();
        formData.append('file', new File([blob], 'speedtest.bin', { type: 'application/octet-stream' }));
        
        const startTime = Date.now();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/librespeed/upload`, {
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
    
    // Функция для тестирования пинга
// Функция для тестирования пинга
const testPing = async (): Promise<{min: number, max: number, avg: number, jitter: number}> => {
    try {
        if (!selectedServer) {
            throw new Error('Сервер не выбран');
        }
        
        // Используем API LibreSpeed для тестирования пинга
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/librespeed/ping`);
        
        if (response.ok) {
            const data = await response.json();
            if (data) {
                const ping = data.ping || 0;
                const jitter = data.jitter || 0;
                
                return {
                    min: ping - jitter / 2,
                    max: ping + jitter / 2,
                    avg: ping,
                    jitter: jitter
                };
            }
        }
        
        throw new Error('Не удалось получить пинг');
    } catch (error) {
        console.error('Ошибка при тестировании пинга:', error);
        return { min: 0, max: 0, avg: 0, jitter: 0 };
    }
};
    // Функция для запуска всех тестов
    const runSpeedTest = async () => {
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
            // Тест пинга (20% прогресса)
            setProgress(10);
            const pingResult = await testPing();
            setPingStats(pingResult);
            setProgress(20);
            
            // Тест скорости загрузки (20% до 60% прогресса)
            setProgress(30);
            const dlSpeed = await testDownload();
            setDownloadSpeed(`${dlSpeed.toFixed(2)} Mbps`);
            setProgress(60);
            
            // Тест скорости выгрузки (60% до 100% прогресса)
            setProgress(70);
            const ulSpeed = await testUpload();
            setUploadSpeed(`${ulSpeed.toFixed(2)} Mbps`);
            setProgress(100);
            
            // Сохраняем результаты
            const result: SpeedTestResult = {
                download: dlSpeed,
                upload: ulSpeed,
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
    
    // Функция для отправки результатов на сервер
    const saveResults = async (result: SpeedTestResult) => {
        try {
            // Просто логируем результаты в консоль, так как эндпоинта нет
            console.log('Результаты LibreSpeed тестирования:', result);
            
            // Если в будущем понадобится отправка на сервер, используйте правильный эндпоинт
            // await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/librespeed/results`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(result)
            // });
        } catch (error) {
            console.error('Ошибка при сохранении результатов LibreSpeed:', error);
        }
    };
    
    return {
        downloadSpeed,
        uploadSpeed,
        pingStats,
        isTesting,
        progress,
        libreSpeedResult,
        runSpeedTest,
        servers,
        selectedServer,
        setSelectedServer
    };
};

