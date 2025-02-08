import { useState, useEffect, useRef } from 'react';
import { useServer } from '../contexts/ServerContext';

interface PingStats {
    min: number; 
    max: number;
    avg: number;
    jitter: number;  
}

interface SpeedTestResult {
    fileName: string;
    size: number;
    time: number;
}

export const useSpeedTest = () => {
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const { selectedServer, geolocationData } = useServer();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const PARALLEL_CONNECTIONS = 8;
    const testInProgressRef = useRef(false);

    useEffect(() => {
        if (selectedServer) {
            console.log('Speed test server updated:', {
                name: selectedServer.name,
                url: selectedServer.url,
                sponsor: selectedServer.sponsor
            });
        }
    }, [selectedServer]);

    const loadImageWithProgress = async (url: string): Promise<{ size: number; time: number; data: ArrayBuffer }> => {
        console.log(`Starting to fetch: ${url}`);
        const startTime = performance.now();
        
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Проверяем заголовки запроса
        const headers: Record<string, string> = {
            'Accept': '*/*',
            'Cache-Control': 'no-cache'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('Request headers:', headers);
        
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error('Fetch failed:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            throw new Error(`Failed to fetch data at URL: ${url}`);
        }

        // Получаем размер файла из заголовков
        const contentLength = response.headers.get('content-length');
        const expectedSize = contentLength ? parseInt(contentLength, 10) : 0;

        // Логируем заголовки ответа
        console.log('Response headers:', {
            contentType: response.headers.get('content-type'),
            contentLength: expectedSize,
            allHeaders: Object.fromEntries(response.headers.entries())
        });

        // Читаем файл как ArrayBuffer
        const data = await response.arrayBuffer();
        const endTime = performance.now();

        // Проверяем содержимое буфера
        const view = new Uint8Array(data);
        console.log('Received data:', {
            expectedSize,
            actualSize: data.byteLength,
            firstBytes: Array.from(view.slice(0, 10)),
            lastBytes: Array.from(view.slice(-10)),
            time: endTime - startTime
        });

        // Проверяем соответствие размеров
        if (expectedSize > 0 && data.byteLength !== expectedSize) {
            console.error(`Size mismatch: expected ${expectedSize} bytes, got ${data.byteLength} bytes`);
            throw new Error(`Size mismatch: expected ${expectedSize} bytes, got ${data.byteLength} bytes`);
        }

        // Извлекаем размер из имени файла
        const match = url.match(/noiseData_(\d+)\.bin/);
        const originalSize = match ? parseInt(match[1], 10) : expectedSize;

        console.log(`File size information:`, {
            url,
            expectedSize,
            actualSize: data.byteLength,
            originalSize,
            extractedFromName: match ? match[1] : 'not found'
        });

        return {
            size: originalSize,
            time: endTime - startTime,
            data
        };
    };

    // Функция для генерации случайного размера в заданном диапазоне
    const getRandomSize = (min: number, max: number): number => {
        return Math.floor(Math.random() * (max - min + 1) + min);
    };

    // Функция для генерации набора размеров файлов для теста
    const generateTestFileSizes = (): number[] => {
        const sizes = new Set<number>();
        
        // Функция для добавления уникального размера
        const addUniqueSize = (min: number, max: number) => {
            let size: number;
            do {
                size = getRandomSize(min, max) * 1024 * 1024;
            } while (sizes.has(size));
            sizes.add(size);
        };
        
        // Маленькие файлы (1-4 MB)
        addUniqueSize(1, 2);
        addUniqueSize(3, 4);
        
        // Средние файлы (5-15 MB)
        addUniqueSize(5, 8);
        addUniqueSize(10, 15);
        
        // Большие файлы (16-60 MB)
        addUniqueSize(16, 25);
        addUniqueSize(40, 60);
        
        return Array.from(sizes).sort((a, b) => a - b);
    };

    const generateTestFiles = async () => {
        const testSizes = generateTestFileSizes();
        console.log('Generated random file sizes for testing:', testSizes.map(size => size / (1024 * 1024) + ' MB'));
        
        const uploadResponse = await fetch(`${appUrl}/api/generateImage`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sizes: testSizes })
        });

        if (!uploadResponse.ok) {
            console.error('Failed to generate images:', {
                status: uploadResponse.status,
                statusText: uploadResponse.statusText
            });
            throw new Error('Failed to generate images');
        }

        const responseData = await uploadResponse.json();
        console.log('Response from /api/generateImage:', responseData);

        const { imagePaths } = responseData;
        if (!imagePaths || !Array.isArray(imagePaths)) {
            throw new Error('Invalid response: imagePaths is not an array');
        }

        return imagePaths;
    };

    const generateAndMeasureSpeed = async () => {
        if (testInProgressRef.current) {
            console.log('Test already in progress');
            return;
        }

        testInProgressRef.current = true;
        setIsTesting(true);
        setProgress(0);

        try {
            // Сначала запускаем CLI тест
            console.log('Running CLI speed test...');
            setProgress(10);
            let cliTestData;
            try {
                const cliTestResponse = await fetch('/api/speedtest/cli', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (cliTestResponse.ok) {
                    cliTestData = await cliTestResponse.json();
                    console.log('CLI test results:', cliTestData);
                } else {
                    console.warn('CLI test failed, continuing with regular test only');
                }
            } catch (cliError) {
                console.warn('CLI test error:', cliError);
            }

            setProgress(20);

            // Генерируем тестовые файлы для обычного теста
            const imagePaths = await generateTestFiles();
            setProgress(40);

            const formData = new FormData();
            const loadPromises = [];

            // Разбиваем изображения на группы для параллельной загрузки
            for (let i = 0; i < imagePaths.length; i += PARALLEL_CONNECTIONS) {
                const batch = imagePaths.slice(i, i + PARALLEL_CONNECTIONS);
                const batchPromises = batch.map(async (path) => {
                    const normalizedPath = path.replace(/\\/g, '/').replace('/public', '');
                    const fullUrl = `${appUrl}${normalizedPath}`;
                    const { size, time, data } = await loadImageWithProgress(fullUrl);
                    
                    const fileName = normalizedPath.split('/').pop() || 'image.bin';
                    const match = path.match(/noiseData_(\d+)\.bin/);
                    const originalSize = match ? parseInt(match[1], 10) : size;

                    const file = new File([data], fileName, {
                        type: 'application/octet-stream',
                        lastModified: Date.now()
                    });

                    formData.append('files', file);

                    return { 
                        fileName,
                        size: originalSize,
                        time 
                    };
                });

                const results = await Promise.all(batchPromises);
                loadPromises.push(...results);
                setProgress(40 + (i / imagePaths.length) * 30);
            }

            // Добавляем информацию о сервере и CLI результатах
            const serverData = {
                ...selectedServer,
                name: selectedServer?.name || 'Unknown',
                country: selectedServer?.country || 'Unknown',
                location: selectedServer?.location || {
                    city: 'Unknown',
                    region: 'Unknown',
                    country: 'Unknown',
                    org: 'Unknown'
                },
                userLocation: {
                    // Используем данные о местоположении пользователя из geolocationData
                    city: geolocationData?.city || 'Unknown',
                    region: geolocationData?.region || 'Unknown',
                    country: geolocationData?.country || 'Unknown',
                    org: geolocationData?.org || 'Unknown'
                }
            };

            console.log('Speed test data:', {
                server: serverData,
                serverLocation: serverData.location,
                userLocation: serverData.userLocation
            });

            formData.append('serverInfo', JSON.stringify(serverData));
            if (cliTestData) {
                formData.append('cliTestData', JSON.stringify(cliTestData));
            }

            console.log('Running regular speed test...', {
                server: serverData,
                cliTestData
            });

            const speedTestResponse = await fetch('/api/speedtest', {
                method: 'POST',
                body: formData
            });

            if (!speedTestResponse.ok) {
                const errorText = await speedTestResponse.text();
                console.error('Speed test error:', errorText);
                throw new Error(`Speed test failed: ${errorText}`);
            }

            const speedTestData = await speedTestResponse.json();
            console.log('Regular speed test results:', speedTestData);

            // Применяем корректировку результатов, если есть CLI данные
            let finalResults = speedTestData;
            if (cliTestData && cliTestData.downloadSpeed && cliTestData.uploadSpeed) {
                const cliDownloadMbps = parseFloat(cliTestData.downloadSpeed);
                const cliUploadMbps = parseFloat(cliTestData.uploadSpeed);
                const regularDownloadMbps = parseFloat(speedTestData.downloadSpeed);
                const regularUploadMbps = parseFloat(speedTestData.uploadSpeed);

                // Получаем значения пинга из CLI теста
                const cliPing = cliTestData.ping || {};
                const cliPingValues = {
                    min: cliPing.min ? parseFloat(cliPing.min) : null,
                    max: cliPing.max ? parseFloat(cliPing.max) : null,
                    avg: cliPing.avg ? parseFloat(cliPing.avg) : parseFloat(cliPing.latency || '0'),
                    jitter: parseFloat(cliPing.jitter || '0')
                };

                // Получаем значения пинга из регулярного теста
                const regularPing = speedTestData.ping || {};
                const regularPingValues = {
                    min: parseFloat(regularPing.min || '0'),
                    max: parseFloat(regularPing.max || '0'),
                    avg: parseFloat(regularPing.avg || '0'),
                    jitter: parseFloat(regularPing.jitter || '0')
                };

                // Вычисляем средневзвешенное значение (70% CLI, 30% regular)
                const correctedDownload = (cliDownloadMbps * 0.7 + regularDownloadMbps * 0.3).toFixed(2);
                const correctedUpload = (cliUploadMbps * 0.7 + regularUploadMbps * 0.3).toFixed(2);

                // Комбинируем результаты пинга, предпочитая CLI значения, если они доступны
                const combinedPing = {
                    min: (cliPingValues.min || regularPingValues.min).toFixed(2),
                    max: (cliPingValues.max || regularPingValues.max).toFixed(2),
                    avg: (cliPingValues.avg || regularPingValues.avg).toFixed(2),
                    jitter: (cliPingValues.jitter || regularPingValues.jitter).toFixed(2)
                };

                finalResults = {
                    ...speedTestData,
                    downloadSpeed: `${correctedDownload} Mbps`,
                    uploadSpeed: `${correctedUpload} Mbps`,
                    ping: combinedPing
                };

                console.log('Combined test results:', {
                    cli: {
                        ping: cliTestData.ping,
                        parsed: cliPingValues
                    },
                    regular: {
                        ping: speedTestData.ping,
                        parsed: regularPingValues
                    },
                    final: combinedPing
                });
            }

            // Устанавливаем финальные результаты для отображения
            setUploadSpeed(finalResults.uploadSpeed);
            setDownloadSpeed(finalResults.downloadSpeed);
            setPingStats({
                min: parseFloat(finalResults.ping.min) || 0,
                max: parseFloat(finalResults.ping.max) || 0,
                avg: parseFloat(finalResults.ping.avg) || 0,
                jitter: parseFloat(finalResults.ping.jitter) || 0
            });

            setProgress(100);
            return finalResults.results;
        } catch (error) {
            console.error('Error during speed test:', error);
            setProgress(0);
            throw error;
        } finally {
            setIsTesting(false);
            testInProgressRef.current = false;
            setProgress(0);
        }
    };

    const runCLITest = async () => {
        const response = await fetch('/api/speedtest/cli');
        if (!response.ok) throw new Error('CLI test failed');
        return response.json();
    };

    return { 
        uploadSpeed, 
        downloadSpeed, 
        pingStats, 
        isTesting, 
        progress,
        generateAndMeasureSpeed,
        runCLITest
    };
};
