export const TEST_CONFIG = {
    // Размеры тестовых данных как в speedtest.net
    SIZES: {
        SMALL: 25 * 1024 * 1024,    // 25MB для медленных соединений
        MEDIUM: 50 * 1024 * 1024,   // 50MB для средних соединений
        LARGE: 100 * 1024 * 1024,   // 100MB для быстрых соединений
        WARMUP: 1 * 1024 * 1024     // 1MB для разогрева
    },

    // Размеры чанков как в speedtest.net
    CHUNK_SIZES: {
        SMALL: 32 * 1024,     // 32KB для медленных соединений
        MEDIUM: 256 * 1024,   // 256KB для средних соединений
        LARGE: 512 * 1024     // 512KB для быстрых соединений
    },

    // Параметры теста
    PARALLEL_CONNECTIONS: 4,   // 4 параллельных соединения
    MAX_RETRIES: 2,           // Максимум попыток при ошибке
    RETRY_DELAY: 1000,        // 1 секунда между попытками
    
    // Таймауты и интервалы
    TIMEOUTS: {
        TEST: 30000,          // 30 секунд на тест
        WARMUP: 2000,         // 2 секунды на разогрев
        COOLDOWN: 1000,       // 1 секунда на охлаждение
        CHUNK: 5000           // 5 секунд на чанк
    },

    // Пороги скорости для выбора размеров
    SPEED_THRESHOLDS: {
        LOW: 10,              // Мбит/с
        MEDIUM: 50,           // Мбит/с
        HIGH: 100             // Мбит/с
    },

    // Корректировки как в speedtest.net
    ADJUSTMENTS: {
        SPEED: 1.04,          // +4% к скорости
        LATENCY: 0.98         // -2% к задержке
    }
};

// Утилиты для выбора параметров теста
export const selectTestSize = (speed: number): number => {
    if (speed < TEST_CONFIG.SPEED_THRESHOLDS.LOW) {
        return TEST_CONFIG.SIZES.SMALL;
    } else if (speed < TEST_CONFIG.SPEED_THRESHOLDS.MEDIUM) {
        return TEST_CONFIG.SIZES.MEDIUM;
    }
    return TEST_CONFIG.SIZES.LARGE;
};

export const selectChunkSize = (speed: number): number => {
    if (speed < TEST_CONFIG.SPEED_THRESHOLDS.LOW) {
        return TEST_CONFIG.CHUNK_SIZES.SMALL;
    } else if (speed < TEST_CONFIG.SPEED_THRESHOLDS.HIGH) {
        return TEST_CONFIG.CHUNK_SIZES.MEDIUM;
    }
    return TEST_CONFIG.CHUNK_SIZES.LARGE;
};

// Функция для быстрого измерения начальной скорости
export const measureInitialSpeed = async (dataChannel: RTCDataChannel): Promise<number> => {
    const sampleSize = 256 * 1024; // 256KB для быстрой проверки
    
    return new Promise((resolve, reject) => {
        if (!dataChannel || dataChannel.readyState !== 'open') {
            reject(new Error('Data channel not ready'));
            return;
        }

        let startTime = 0;
        let receivedSize = 0;
        let testComplete = false;

        const handleMessage = (event: MessageEvent) => {
            try {
                if (event.data instanceof ArrayBuffer) {
                    receivedSize += event.data.byteLength;
                    if (startTime === 0) {
                        startTime = performance.now();
                    }
                } else if (typeof event.data === 'string') {
                    const message = JSON.parse(event.data);
                    if (message.type === 'initial_speed_test_complete') {
                        testComplete = true;
                        const endTime = performance.now();
                        const duration = (endTime - startTime) / 1000;
                        const speed = (receivedSize * 8) / (1024 * 1024) / duration;
                        cleanup();
                        resolve(speed);
                    }
                }
            } catch (error) {
                console.error('Error in initial speed test:', error);
                cleanup();
                reject(error);
            }
        };

        const cleanup = () => {
            dataChannel.removeEventListener('message', handleMessage);
        };

        dataChannel.addEventListener('message', handleMessage);

        // Отправляем запрос на начало теста
        dataChannel.send(JSON.stringify({
            type: 'initial_speed_test_start',
            timestamp: performance.now(),
            size: sampleSize
        }));

        // Короткий таймаут для быстрого теста
        setTimeout(() => {
            if (!testComplete) {
                cleanup();
                // В случае таймаута предполагаем медленное соединение
                resolve(5); // 5 Mbps по умолчанию
            }
        }, 3000);
    });
};

export const runDownloadTest = async (dataChannel: RTCDataChannel, size?: number): Promise<number> => {
    // Определяем размер теста на основе начальной скорости соединения
    if (!size) {
        const initialSpeed = await measureInitialSpeed(dataChannel);
        size = selectTestSize(initialSpeed);
    }

    return new Promise((resolve, reject) => {
        if (!dataChannel || dataChannel.readyState !== 'open') {
            reject(new Error('Data channel not ready'));
            return;
        }

        console.log('Starting download test with size:', size, 'bytes');

        let startTime = 0;
        let receivedSize = 0;
        let testComplete = false;
        const threadProgress = new Map<number, { received: number, total: number }>();
        let lastProgressUpdate = 0;

        const handleMessage = (event: MessageEvent) => {
            try {
                if (typeof event.data === 'string') {
                    const message = JSON.parse(event.data);
                    
                    switch (message.type) {
                        case 'download_progress':
                            if (startTime === 0) {
                                startTime = performance.now();
                            }
                            
                            const threadId = message.threadId;
                            threadProgress.set(threadId, {
                                received: message.sent,
                                total: message.total
                            });
                            
                            receivedSize = Array.from(threadProgress.values())
                                .reduce((sum, curr) => sum + curr.received, 0);
                            
                            // Обновляем прогресс не чаще чем раз в SPEED_MEASUREMENT_INTERVAL
                            const now = performance.now();
                            if (now - lastProgressUpdate >= TEST_CONFIG.TIMEOUTS.CHUNK) {
                                const currentSpeed = receivedSize * 8 / (1024 * 1024) / ((now - startTime) / 1000);
                                console.log('Download progress:', {
                                    threadId,
                                    threadReceived: message.sent,
                                    totalReceived: receivedSize,
                                    totalSize: size,
                                    currentSpeed
                                });
                                lastProgressUpdate = now;
                            }
                            break;
                            
                        case 'download_test_complete':
                            testComplete = true;
                            const endTime = performance.now();
                            const duration = (endTime - startTime) / 1000;
                            const speed = (receivedSize * 8) / (1024 * 1024) / duration;
                            console.log('Final download stats:', {
                                totalReceived: receivedSize,
                                duration,
                                speed
                            });
                            cleanup();
                            resolve(speed);
                            break;
                            
                        case 'error':
                            console.error('Download error:', message.error);
                            reject(new Error(message.error || 'Unknown download error'));
                            cleanup();
                            break;
                    }
                } else if (event.data instanceof ArrayBuffer) {
                    receivedSize += event.data.byteLength;
                    if (startTime === 0) {
                        startTime = performance.now();
                    }
                }
            } catch (error) {
                console.error('Error handling message:', error);
                reject(error);
                cleanup();
            }
        };

        const cleanup = () => {
            dataChannel.removeEventListener('message', handleMessage);
        };

        dataChannel.addEventListener('message', handleMessage);

        dataChannel.send(JSON.stringify({
            type: 'download_test_start',
            timestamp: performance.now(),
            size
        }));

        setTimeout(() => {
            if (!testComplete) {
                cleanup();
                reject(new Error('Download test timeout'));
            }
        }, TEST_CONFIG.TIMEOUTS.TEST);
    });
};

export const runUploadTest = async (dataChannel: RTCDataChannel, size: number = 1024 * 1024): Promise<number> => {
    return new Promise((resolve, reject) => {
        if (!dataChannel || dataChannel.readyState !== 'open') {
            reject(new Error('Data channel not ready'));
            return;
        }

        console.log('Starting upload test with size:', size, 'bytes');

        let startTime = 0;
        let testComplete = false;
        let numThreads = 0;
        const threadStates = new Map<number, {
            sent: number,
            total: number,
            buffer: ArrayBuffer
        }>();

        const handleMessage = (event: MessageEvent) => {
            try {
                if (typeof event.data === 'string') {
                    const message = JSON.parse(event.data);
                    
                    switch (message.type) {
                        case 'upload_test_start':
                            startTime = performance.now();
                            numThreads = message.numThreads;
                            const threadSize = Math.floor(size / numThreads);
                            
                            // Инициализируем состояние для каждого потока
                            for (let i = 0; i < numThreads; i++) {
                                const buffer = new ArrayBuffer(threadSize);
                                const view = new Uint8Array(buffer);
                                for (let j = 0; j < threadSize; j++) {
                                    view[j] = Math.random() * 255;
                                }
                                
                                threadStates.set(i, {
                                    sent: 0,
                                    total: threadSize,
                                    buffer
                                });
                            }
                            
                            // Запускаем все потоки
                            for (let i = 0; i < numThreads; i++) {
                                sendNextChunk(i);
                            }
                            break;
                        
                        case 'upload_progress':
                            console.log('Upload progress:', message);
                            break;
                            
                        case 'upload_test_complete':
                            console.log('Upload test complete:', message);
                            testComplete = true;
                            const duration = message.duration / 1000; // в секундах
                            const speed = (size * 8) / (1024 * 1024) / duration; // Mbps
                            cleanup();
                            resolve(speed);
                            break;
                            
                        case 'error':
                            console.error('Upload error:', message.error);
                            reject(new Error(message.error || 'Unknown upload error'));
                            cleanup();
                            break;
                    }
                }
            } catch (error) {
                console.error('Error handling message:', error);
                reject(error);
                cleanup();
            }
        };

        const sendNextChunk = async (threadId: number) => {
            try {
                const state = threadStates.get(threadId);
                if (!state) return;

                const chunkSize = Math.min(16384, state.total - state.sent);
                if (chunkSize <= 0) return;

                const chunk = state.buffer.slice(state.sent, state.sent + chunkSize);
                
                // Отправляем метаданные чанка
                dataChannel.send(JSON.stringify({
                    type: 'upload_chunk',
                    timestamp: performance.now(),
                    threadId,
                    chunkSize,
                    totalSent: state.sent,
                    totalSize: state.total
                }));
                
                // Небольшая пауза перед отправкой бинарных данных
                await new Promise(resolve => setTimeout(resolve, 1));
                
                // Отправляем сам чанк
                dataChannel.send(chunk);
                state.sent += chunkSize;

                // Если есть еще данные для отправки, планируем следующий чанк
                if (state.sent < state.total) {
                    setTimeout(() => sendNextChunk(threadId), 1);
                } else if (Array.from(threadStates.values()).every(s => s.sent >= s.total)) {
                    // Если все потоки завершили отправку
                    dataChannel.send(JSON.stringify({
                        type: 'upload_complete',
                        timestamp: performance.now(),
                        totalSize: size
                    }));
                }
            } catch (error) {
                console.error('Error sending chunk:', error);
                reject(error);
                cleanup();
            }
        };

        const cleanup = () => {
            dataChannel.removeEventListener('message', handleMessage);
        };

        dataChannel.addEventListener('message', handleMessage);

        // Отправляем запрос на начало теста
        dataChannel.send(JSON.stringify({
            type: 'upload_test_start',
            timestamp: performance.now(),
            size
        }));

        // Таймаут на случай если тест зависнет
        setTimeout(() => {
            if (!testComplete) {
                cleanup();
                reject(new Error('Upload test timeout'));
            }
        }, TEST_CONFIG.TIMEOUTS.TEST);
    });
};

export const measureLatency = async (dataChannel: RTCDataChannel, samples: number = 20): Promise<number> => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.error('Data channel not ready');
        throw new Error('Data channel not ready');
    }

    // Wait for any pending data to be sent
    if (dataChannel.bufferedAmount > 0) {
        console.warn('Waiting for buffered data to clear...');
        await new Promise<void>(resolve => {
            const checkBuffer = () => {
                if (dataChannel.bufferedAmount === 0) {
                    resolve();
                } else {
                    setTimeout(checkBuffer, 100);
                }
            };
            checkBuffer();
        });
    }

    // Add initial warmup pings
    for (let i = 0; i < 3; i++) {
        try {
            await sendPing(dataChannel);
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.warn('Warmup ping failed:', error);
        }
    }

    const pings: number[] = [];
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;

    // Measure actual pings
    for (let i = 0; i < samples; i++) {
        try {
            const pingTime = await sendPing(dataChannel);
            pings.push(pingTime);
            consecutiveFailures = 0;
            
            // Add small delay between pings to avoid flooding
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
            console.warn(`Ping attempt ${i + 1} failed:`, error);
            consecutiveFailures++;
            
            if (consecutiveFailures >= maxConsecutiveFailures) {
                throw new Error(`${maxConsecutiveFailures} consecutive ping failures`);
            }
            
            // Add a small delay before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (pings.length === 0) {
        throw new Error('No successful pings');
    }

    // Calculate average ping with outlier removal
    pings.sort((a, b) => a - b);
    
    // Remove extreme outliers (values more than 2 standard deviations from mean)
    const mean = pings.reduce((sum, ping) => sum + ping, 0) / pings.length;
    const stdDev = Math.sqrt(
        pings.reduce((sum, ping) => sum + Math.pow(ping - mean, 2), 0) / pings.length
    );
    
    const validPings = pings.filter(
        ping => Math.abs(ping - mean) <= 2 * stdDev
    );

    // Calculate final average
    const avgPing = validPings.reduce((sum, ping) => sum + ping, 0) / validPings.length;

    // Log ping statistics for debugging
    console.log('Ping statistics:', {
        samples: pings.length,
        validSamples: validPings.length,
        min: Math.min(...validPings),
        max: Math.max(...validPings),
        mean: avgPing,
        stdDev
    });

    return avgPing;
};

const sendPing = (dataChannel: RTCDataChannel): Promise<number> => {
    return new Promise<number>((resolve, reject) => {
        const startTime = performance.now(); // Use high-precision timer
        
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Ping timeout after 5 seconds'));
        }, TEST_CONFIG.TIMEOUTS.CHUNK);

        const handleMessage = (event: MessageEvent) => {
            try {
                if (typeof event.data === 'string') {
                    const message = JSON.parse(event.data);
                    if (message.type === 'pong' || message.type === 'ping_response') {
                        const endTime = performance.now();
                        const pingTime = endTime - startTime;
                        cleanup();
                        resolve(pingTime);
                    }
                }
            } catch (error) {
                console.error('Error handling ping response:', error);
                cleanup();
                reject(error);
            }
        };

        const cleanup = () => {
            clearTimeout(timeout);
            dataChannel.removeEventListener('message', handleMessage);
        };

        dataChannel.addEventListener('message', handleMessage);
        
        try {
            dataChannel.send(JSON.stringify({
                type: 'ping',
                timestamp: startTime
            }));
        } catch (error) {
            console.error('Error sending ping:', error);
            cleanup();
            reject(error);
        }
    });
};
