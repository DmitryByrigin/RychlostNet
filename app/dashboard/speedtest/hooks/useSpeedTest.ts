import { useState, useEffect } from 'react';
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
    const { selectedServer } = useServer();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const PARALLEL_CONNECTIONS = 8;

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
        
        // Проверяем заголовки запроса
        const headers = {
            'Accept': '*/*',
            'Cache-Control': 'no-cache'
        };
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

    const generateAndMeasureSpeed = async () => {
        setIsTesting(true);
        setProgress(0);

        try {
            if (!selectedServer) {
                throw new Error('No server selected');
            }

            console.log('Using server for speed test:', {
                name: selectedServer.name,
                url: selectedServer.url,
                sponsor: selectedServer.sponsor
            });

            // Генерируем изображения разных размеров
            console.log('Requesting file generation with sizes:', [1, 2, 5, 10, 20, 50].map(mb => mb * 1024 * 1024));
            const uploadResponse = await fetch(`${appUrl}/api/generateImage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sizes: [1, 2, 5, 10, 20, 50].map(mb => mb * 1024 * 1024) })
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

            setProgress(30); // 30% после генерации изображений

            const formData = new FormData();
            const loadPromises = [];

            // Разбиваем изображения на группы для параллельной загрузки
            for (let i = 0; i < imagePaths.length; i += PARALLEL_CONNECTIONS) {
                const batch = imagePaths.slice(i, i + PARALLEL_CONNECTIONS);
                const batchPromises = batch.map(async (path) => {
                    const normalizedPath = path.replace(/\\/g, '/').replace('/public', '');
                    const fullUrl = `${appUrl}${normalizedPath}`;
                    const { size, time, data } = await loadImageWithProgress(fullUrl);
                    
                    console.log(`Processing file ${path}:`, {
                        originalSize: size,
                        arrayBufferSize: data.byteLength
                    });

                    // Извлекаем оригинальный размер из имени файла
                    const match = path.match(/noiseData_(\d+)\.bin/);
                    const originalSize = match ? parseInt(match[1], 10) : size;

                    const fileName = normalizedPath.split('/').pop() || 'image.bin';
                    
                    // Создаем File объект с правильным размером
                    const file = new File([data], fileName, {
                        type: 'application/octet-stream',
                        lastModified: Date.now()
                    });

                    console.log(`Created File object for ${fileName}:`, {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        originalSize: originalSize
                    });

                    // Добавляем файл и его размер в FormData
                    formData.append('files', file);
                    formData.append(`${file.name}_size`, originalSize.toString());

                    return { 
                        fileName,
                        size: originalSize,
                        time 
                    };
                });

                const results = await Promise.all(batchPromises);
                loadPromises.push(...results);
                setProgress(30 + (i / imagePaths.length) * 40); // От 30% до 70%
            }

            // Используем URL сервера для теста скорости
            const baseUrl = selectedServer.url.replace('/speedtest/test', '');
            const speedTestUrl = `${baseUrl}/speedtest/test`;

            console.log('Sending FormData to server:', {
                url: speedTestUrl,
                totalFiles: formData.getAll('files').length,
                totalSizes: formData.getAll('files_size').length,
                files: Array.from(formData.getAll('files')).map((file: any) => ({
                    name: file.name,
                    size: file.size,
                    type: file.type
                })),
                sizes: Array.from(formData.getAll('files_size'))
            });

            const response = await fetch(speedTestUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Server response:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });
                const errorText = await response.text();
                console.error('Error response body:', errorText);
                throw new Error('Failed to test speed');
            }

            const data = await response.json();
            console.log('Speed test results:', data);

            setUploadSpeed(data.uploadSpeed);
            setDownloadSpeed(data.downloadSpeed);
            setPingStats({
                min: parseFloat(data.ping.min),
                max: parseFloat(data.ping.max),
                avg: parseFloat(data.ping.avg),
                jitter: parseFloat(data.ping.jitter),
            });

            setProgress(100);
            return data.results;
        } catch (error) {
            console.error('Error during speed test:', error);
            setProgress(0);
            throw error;
        } finally {
            setIsTesting(false);
        }
    };

    return { 
        uploadSpeed, 
        downloadSpeed, 
        pingStats, 
        isTesting, 
        progress,
        generateAndMeasureSpeed 
    };
};
