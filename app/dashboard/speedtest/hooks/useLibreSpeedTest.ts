import { useState, useRef, useEffect, useCallback } from 'react';
import { useServer } from '../contexts/ServerContext';
import { LibreSpeedServer } from '../types/librespeed';
import { PingStats, SpeedTestResult } from './utils/types';

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
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<SpeedTestResult | null>(null);
    const [currentTest, setCurrentTest] = useState<string | null>(null);
    const [checkingServers, setCheckingServers] = useState<boolean>(true);
    
    const testInProgressRef = useRef<boolean>(false);
    const { geolocationData } = useServer();
    
    // Кэширование данных о серверах
    const CACHE_DURATION = 5 * 60 * 1000; // 5 минут в миллисекундах
    
    // Константы для использования нашего бэкенда в качестве прокси
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_SERVERS || 'http://localhost:3001';
    const LIBRESPEED_ENDPOINT = `${API_BASE_URL}/api/speedtest/librespeed`;
    
    // Функция для определения ближайшего сервера с приоритетом для Словакии
    const findBestServer = useCallback((servers: LibreSpeedServer[], userCountry?: string): LibreSpeedServer => {
        // Если пользователь из Словакии, ищем словацкие серверы или ближайшие в регионе
        if (userCountry?.toLowerCase() === 'slovakia' || userCountry?.toLowerCase() === 'slovak republic') {
            // Приоритет 1: Сервер в Словакии
            const slovakServer = servers.find(s => 
                s.location?.country?.toLowerCase() === 'slovakia' || 
                s.location?.country?.toLowerCase() === 'slovak republic' ||
                s.location?.country?.toLowerCase() === 'slovensko');
                
            if (slovakServer) return slovakServer;
            
            // Приоритет 2: Сервера в соседних странах
            const nearbyCountries = ['czech republic', 'austria', 'hungary', 'poland'];
            const nearbyServer = servers.find(s => 
                s.location?.country && nearbyCountries.includes(s.location.country.toLowerCase()));
                
            if (nearbyServer) return nearbyServer;
        }
        
        // Для других пользователей или если не нашли подходящих серверов для Словакии:
        // Ищем точное совпадение по стране
        if (userCountry) {
            const sameCountryServer = servers.find(s => 
                s.location?.country?.toLowerCase() === userCountry.toLowerCase());
                
            if (sameCountryServer) return sameCountryServer;
        }
        
        // Если нет совпадений, возвращаем первый сервер как дефолтный
        return servers[0];
    }, []);

    // Проверяет доступность сервера через наш прокси
    const checkServerAvailability = async (server: string): Promise<boolean> => {
        try {
            // Используем наш прокси для проверки сервера
            // Добавляем только параметр noCache для предотвращения кэширования запросов
            const testUrl = `${LIBRESPEED_ENDPOINT}/check?server=${encodeURIComponent(server)}&noCache=${Date.now()}`;
            const response = await fetch(testUrl, {
                method: 'GET',
                cache: 'no-cache',
                // Устанавливаем короткий таймаут
                signal: AbortSignal.timeout(2000)
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.available === true;
            }
            return false;
        } catch (err) {
            console.log(`Ошибка при проверке сервера: ${server}`, err);
            return false;
        }
    };

    // Загрузка списка серверов с кэшированием
    useEffect(() => {
        const fetchServers = async () => {
            try {
                // Начинаем проверку серверов
                setCheckingServers(true);
                
                // Проверяем локальный кэш
                const cacheKey = 'librespeed_servers_cache';
                const cacheStr = localStorage.getItem(cacheKey);
                
                if (cacheStr) {
                    try {
                        const cache = JSON.parse(cacheStr);
                        if (Date.now() - cache.timestamp < CACHE_DURATION) {
                            console.log('Using cached LibreSpeed server info');
                            setServers(cache.data);
                            
                            // Автоматический выбор лучшего сервера
                            if (!selectedServer && cache.data.length > 0) {
                                const bestServer = findBestServer(cache.data, geolocationData?.country);
                                setSelectedServer(bestServer);
                            }
                            
                            // Завершаем проверку серверов из кэша
                            setCheckingServers(false);
                            return;
                        }
                    } catch (e) {
                        console.warn('Failed to parse server cache:', e);
                    }
                }
                
                // Получаем список серверов через наш прокси
                console.log('Получаем список серверов через прокси...');
                
                try {
                    const response = await fetch(`${LIBRESPEED_ENDPOINT}/servers`);
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data && Array.isArray(data) && data.length > 0) {
                            console.log(`Получено ${data.length} серверов через прокси`);
                            
                            // Используем серверы, полученные через прокси
                            setServers(data);
                            
                            // Выбираем предпочтительный сервер в Словакии, если доступен
                            const slovakServers = data.filter(server => 
                                server.location?.country?.includes('Slovakia') || 
                                server.name?.includes('Slovakia')
                            );
                            
                            // Если есть словацкие серверы, используем их
                            if (slovakServers.length > 0) {
                                const bestServer = findBestServer(slovakServers, 'Slovakia');
                                setSelectedServer(bestServer);
                                console.log(`🌍 Выбран сервер: ${bestServer.name}`);
                            } else {
                                // Иначе используем ближайший европейский сервер
                                const bestServer = findBestServer(data, geolocationData?.country);
                                setSelectedServer(bestServer);
                                console.log(`🌍 Выбран сервер: ${bestServer.name}`);
                            }
                            
                            // Кэшируем результат
                            localStorage.setItem(cacheKey, JSON.stringify({
                                data: data,
                                timestamp: Date.now()
                            }));
                            
                            // Завершаем проверку серверов
                            setCheckingServers(false);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Ошибка при получении серверов через прокси:', error);
                }
                
                // Если API не сработал, используем проверенный список публичных серверов
                console.log('Using static list of verified LibreSpeed servers');
                
                // Список проверенных серверов (используем HTTP чтобы избежать проблем с сертификатами)
                const staticLibreSpeedServers: LibreSpeedServer[] = [
                    // Серверы в Словакии и рядом
                    {
                        name: "Bratislava, Slovakia (Otelo)",
                        server: "http://bratislava.otelo.sk:8080/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Bratislava",
                            region: "",
                            country: "Slovakia",
                            org: "Otelo"
                        }
                    },
                    {
                        name: "Bratislava, Slovakia (VNET)",
                        server: "http://speedtest.host.sk/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Bratislava",
                            region: "",
                            country: "Slovakia",
                            org: "VNET"
                        }
                    },
                    {
                        name: "Nitra, Slovakia (Slovanet)",
                        server: "http://st.slovanet.sk/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Nitra",
                            region: "",
                            country: "Slovakia",
                            org: "Slovanet"
                        }
                    },
                    {
                        name: "Budapest, Hungary (Tarr)",
                        server: "http://st.tarr.hu/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Budapest",
                            region: "",
                            country: "Hungary",
                            org: "Tarr"
                        }
                    },
                    {
                        name: "Vienna, Austria (Easyname)",
                        server: "http://speedtest.easyname.com/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Vienna",
                            region: "",
                            country: "Austria",
                            org: "Easyname"
                        }
                    },
                    {
                        name: "Prague, Czech Republic (O2)",
                        server: "http://speedtest.o2.cz/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Prague",
                            region: "",
                            country: "Czech Republic",
                            org: "O2"
                        }
                    },
                    {
                        name: "Munich, Germany (M-net)",
                        server: "http://speedtest.m-net.de/",
                        dlURL: "garbage.php",
                        ulURL: "empty.php",
                        pingURL: "empty.php",
                        getIpURL: "getIP.php",
                        location: {
                            city: "Munich",
                            region: "",
                            country: "Germany",
                            org: "M-net"
                        }
                    }
                ];
                
                setServers(staticLibreSpeedServers);
                
                // Теперь проверим доступность серверов и выберем лучший
                try {
                    console.log('🔍 Проверка доступности серверов...');
                    const availableServers: LibreSpeedServer[] = [];
                    
                    // Проверяем все сервера 
                    for (const server of staticLibreSpeedServers) {
                        const isAvailable = await checkServerAvailability(server.server);
                        if (isAvailable) {
                            console.log(`✅ Сервер ${server.name} доступен`);
                            availableServers.push(server);
                        }
                    }
                    
                    if (availableServers.length > 0) {
                        console.log(`🔢 Найдено ${availableServers.length} доступных серверов`);
                        // Обновляем список серверов только доступными серверами
                        setServers(availableServers);
                        
                        // Автоматический выбор лучшего сервера
                        if (!selectedServer) {
                            const bestServer = findBestServer(availableServers, geolocationData?.country);
                            setSelectedServer(bestServer);
                            console.log(`🌍 Выбран сервер: ${bestServer.name}`);
                        }
                    } else {
                        console.log('Нет доступных серверов, используем исходный список');
                        if (!selectedServer && staticLibreSpeedServers.length > 0) {
                            const bestServer = findBestServer(staticLibreSpeedServers, geolocationData?.country);
                            setSelectedServer(bestServer);
                        }
                    }
                } catch (error) {
                    console.error('Ошибка при проверке серверов:', error);
                    // Если произошла ошибка, просто выбираем из статического списка
                    if (!selectedServer && staticLibreSpeedServers.length > 0) {
                        const bestServer = findBestServer(staticLibreSpeedServers, geolocationData?.country);
                        setSelectedServer(bestServer);
                    }
                }
                
                // Завершаем проверку серверов
                setCheckingServers(false);
            } catch (error) {
                console.error('Ошибка при загрузке списка серверов LibreSpeed:', error);
                
                // Если произошла ошибка, но у нас есть выбранный сервер, используем его
                if (!selectedServer && servers.length > 0) {
                    setSelectedServer(servers[0]);
                }
            }
        };
        
        fetchServers();
    }, [findBestServer, geolocationData?.country]);
    
    // Запуск теста LibreSpeed
    const runLibreSpeedTest = useCallback(async () => {
        // Если нет выбранного сервера, не запускаем тест
        if (!selectedServer) {
            console.error('LibreSpeed test cancelled - no server selected');
            return null;
        }

        console.log(`🚀 Запуск теста LibreSpeed на сервере: ${selectedServer.name}`);
        
        try {
            setIsRunning(true);
            
            // Используем наш прокси для запуска теста LibreSpeed
            // Это решает проблему с CORS
            const response = await fetch(`${LIBRESPEED_ENDPOINT}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    server: selectedServer
                })
            });
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('✅ Тест LibreSpeed завершен:', {
                    download: `${responseData.result.download.toFixed(2)} Mbps`,
                    upload: `${responseData.result.upload.toFixed(2)} Mbps`,
                    ping: `${responseData.result.ping.toFixed(2)} ms`,
                    jitter: `${responseData.result.jitter ? responseData.result.jitter.toFixed(2) : 0} ms`,
                    server: responseData.result.server || selectedServer.name
                });
                
                // Извлекаем результат, учитывая структуру ответа
                const result = responseData.success && responseData.result ? responseData.result : responseData;
                
                // Преобразуем результат в формат SpeedTestResult
                const speedTestResult: SpeedTestResult = {
                    download: result.download,
                    upload: result.upload,
                    ping: {
                        avg: result.ping,
                        min: result.ping - (result.jitter / 2) || result.ping,
                        max: result.ping + (result.jitter / 2) || result.ping,
                        jitter: result.jitter
                    },
                    jitter: result.jitter,
                    ip: result.ip,
                    isp: result.isp,
                    server: selectedServer,
                    timestamp: new Date().toISOString()
                };
                
                // Устанавливаем результаты в оба состояния
                setResult(speedTestResult);
                setLibreSpeedResult(speedTestResult);
                
                // Устанавливаем также отдельные показатели для отображения
                setDownloadSpeed(result.download.toFixed(2));
                setUploadSpeed(result.upload.toFixed(2));
                setPingStats({
                    avg: result.ping,
                    min: result.ping - (result.jitter / 2) || result.ping,
                    max: result.ping + (result.jitter / 2) || result.ping, 
                    jitter: result.jitter
                });
                
                return speedTestResult;
            } else {
                console.error('LibreSpeed test failed:', await response.text());
                return null;
            }
        } catch (error) {
            console.error('Error during LibreSpeed test:', error);
            return null;
        } finally {
            setIsRunning(false);
        }
    }, [selectedServer]);
    
    // Функция для запуска всех тестов
    const runSpeedTest = async () => {
        // Если тест уже запущен, просто вернемся
        if (isRunning || testInProgressRef.current) {
            return null;
        }

        try {
            testInProgressRef.current = true;
            setIsRunning(true);
            setIsTesting(true);
            setProgress(0);

            // Обнуляем предыдущий результат
            setResult(null);
            setLibreSpeedResult(null);

            // Шаг 1: Начинаем тест
            setProgress(10);
            setCurrentTest('ping');
            
            // Запускаем полный тест через наш прокси
            const testResult = await runLibreSpeedTest();
            
            if (!testResult) {
                throw new Error('Тест не удалось завершить');
            }

            // Завершаем тест
            setProgress(100);
            setCurrentTest(null);
            
            return testResult;
        } catch (error) {
            console.error('Error during speed test:', error);
            return null;
        } finally {
            testInProgressRef.current = false;
            setIsRunning(false);
            setIsTesting(false);
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
        setSelectedServer,
        isRunning,
        result,
        currentTest,
        checkingServers
    };
};
