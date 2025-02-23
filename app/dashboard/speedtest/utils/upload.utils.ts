import { TEST_CONFIG } from './speedtest.utils';

export const uploadData = async (dataChannel: RTCDataChannel, size: number = TEST_CONFIG.SIZES.MEDIUM): Promise<number> => {
    // Используем размер блока как в speedtest.net
    const chunkSize = Math.min(TEST_CONFIG.CHUNK_SIZES.MEDIUM, 16 * 1024); // Уменьшаем размер чанка до 16KB
    
    // Создаем один блок данных для повторного использования
    const baseChunk = new Uint8Array(chunkSize);
    crypto.getRandomValues(baseChunk);

    let sent = 0;
    let lastUpdate = performance.now();
    const startTime = lastUpdate;
    let totalSent = 0;

    return new Promise((resolve, reject) => {
        const sendChunk = async () => {
            try {
                if (dataChannel.readyState !== 'open') {
                    reject(new Error('Data channel closed'));
                    return;
                }

                // Проверяем буфер отправки
                if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
                    // Ждем, пока буфер освободится
                    await new Promise<void>(resolve => {
                        const handleBufferLow = () => {
                            dataChannel.removeEventListener('bufferedamountlow', handleBufferLow);
                            resolve();
                        };
                        dataChannel.addEventListener('bufferedamountlow', handleBufferLow);
                    });
                }

                // Отправляем тот же блок данных несколько раз
                dataChannel.send(baseChunk);
                totalSent += chunkSize;
                sent += chunkSize;

                const now = performance.now();
                if (now - lastUpdate >= 200) {
                    lastUpdate = now;
                    const progress = (totalSent / size) * 100;
                    console.log(`Upload progress: ${progress.toFixed(2)}%`);
                }

                if (totalSent < size) {
                    // Используем setTimeout вместо requestAnimationFrame для контроля скорости
                    setTimeout(sendChunk, 0);
                } else {
                    const duration = (performance.now() - startTime) / 1000;
                    // Рассчитываем скорость как в speedtest.net
                    const speedMbps = (totalSent * 8) / (1024 * 1024) / duration;
                    // Применяем корректировку как в speedtest.net
                    resolve(speedMbps * TEST_CONFIG.ADJUSTMENTS.SPEED);
                }
            } catch (error) {
                reject(error);
            }
        };

        // Устанавливаем порог буфера
        dataChannel.bufferedAmountLowThreshold = 64 * 1024; // 64KB

        const timeout = setTimeout(() => {
            reject(new Error('Upload test timeout'));
        }, TEST_CONFIG.TIMEOUTS.TEST);

        // Начинаем с разогрева
        setTimeout(() => {
            console.log('Starting upload test with warmup...');
            sendChunk();
        }, TEST_CONFIG.TIMEOUTS.WARMUP);

        // Очистка таймаута при успешном завершении
        dataChannel.addEventListener('message', () => {
            clearTimeout(timeout);
        }, { once: true });
    });
};

export const runParallelUpload = async (dataChannel: RTCDataChannel, totalSize: number = TEST_CONFIG.SIZES.MEDIUM): Promise<number> => {
    const parallelConnections = TEST_CONFIG.PARALLEL_CONNECTIONS;
    const sizePerConnection = Math.ceil(totalSize / parallelConnections);
    
    try {
        const uploadPromises = Array(parallelConnections).fill(null).map(() => 
            uploadData(dataChannel, sizePerConnection)
        );

        const speeds = await Promise.all(uploadPromises);
        
        // Берем медиану из результатов как в speedtest.net
        speeds.sort((a, b) => a - b);
        const medianSpeed = speeds[Math.floor(speeds.length / 2)];
        
        // Суммируем скорости и применяем корректировку
        return medianSpeed * parallelConnections * TEST_CONFIG.ADJUSTMENTS.SPEED;
    } catch (error) {
        console.error('Parallel upload failed:', error);
        throw error;
    }
};

export const runUploadTest = async (dataChannel: RTCDataChannel, size?: number): Promise<number> => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error('WebRTC not ready');
    }

    let retries = TEST_CONFIG.MAX_RETRIES;
    
    while (retries >= 0) {
        try {
            // Начинаем с маленького размера для определения начальной скорости
            const initialSize = TEST_CONFIG.SIZES.SMALL;
            console.log('Testing with initial size:', initialSize);
            
            // Тестируем с разными размерами как в speedtest.net
            const testSizes = [
                TEST_CONFIG.SIZES.SMALL,
                TEST_CONFIG.SIZES.MEDIUM,
                TEST_CONFIG.SIZES.LARGE
            ];
            
            let bestSpeed = 0;
            
            for (const testSize of testSizes) {
                // Разогрев соединения
                await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.TIMEOUTS.WARMUP));
                console.log('Testing with size:', testSize);
                
                // Основной тест с параллельными соединениями
                const result = await runParallelUpload(dataChannel, testSize);
                bestSpeed = Math.max(bestSpeed, result);
                
                // Охлаждение соединения
                await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.TIMEOUTS.COOLDOWN));
            }
            
            // Применяем финальные корректировки как в speedtest.net
            return bestSpeed * TEST_CONFIG.ADJUSTMENTS.SPEED;
        } catch (error) {
            console.error('Upload test error:', error);
            retries--;
            
            if (retries >= 0) {
                await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.RETRY_DELAY));
                console.log('Retrying upload test...');
            } else {
                throw error;
            }
        }
    }
    
    throw new Error('Upload test failed after all retries');
};
