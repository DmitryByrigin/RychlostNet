"use client"

import { useState, useEffect, useRef } from 'react';
import { PingStats } from '../types/speedTest';
import { useFetchGeolocation } from './useFetchGeolocation';

const animateValue = (start: number, end: number, duration: number, callback: (value: number) => void) => {
    const range = end - start;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        const value = start + (range * (progress / duration));
        callback(Math.min(value, end));
        if (progress < duration) {
            requestAnimationFrame(step);
        }
    };

    requestAnimationFrame(step);
};

export const useSpeedTest = () => {
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: null });
    const [isTesting, setIsTesting] = useState(false);
    const { geolocationData } = useFetchGeolocation();
    const pingStatsRef = useRef(pingStats);

    useEffect(() => {
        pingStatsRef.current = pingStats;
    }, [pingStats]);

    const measurePing = async (url: string, attempts: number = 5) => {
        let minPing = Number.MAX_SAFE_INTEGER;
        let maxPing = 0;
        let totalPing = 0;

        for (let i = 0; i < attempts; i++) {
            const startPingTime = performance.now();
            await fetch(url);
            const endPingTime = performance.now();
            const ping = endPingTime - startPingTime;
            minPing = Math.min(minPing, ping);
            maxPing = Math.max(maxPing, ping);
            totalPing += ping;
        }

        const avgPing = totalPing / attempts;
        setPingStats({ min: minPing, max: maxPing, avg: avgPing });
    };

    const generateAndMeasureSpeed = async () => {
        setIsTesting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Задержка 3 секунды

            const file = new Blob(['a'.repeat(5 * 1024 * 1024)], { type: 'application/octet-stream' });
            const startTime = performance.now();

            const response = await fetch('/api/generateImage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                body: file,
            });

            const endTime = performance.now();
            const timeTaken = endTime - startTime;
            const sizeInBytes = file.size;
            const uploadSpeedMbps = ((sizeInBytes / (timeTaken / 1000)) / 1024) / 1024;

            const { largeResponseData } = await response.json();
            const largeResponseBuffer = new Uint8Array(Buffer.from(largeResponseData, 'base64'));
            const downloadTimeStart = performance.now();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const downloadTimeEnd = performance.now();
            const downloadTimeTaken = downloadTimeEnd - downloadTimeStart;
            const downloadSpeedMbps = ((largeResponseBuffer.byteLength / (downloadTimeTaken / 1000)) / 1024) / 1024;

            await measurePing('/api/generateImage');

            // Ожидание завершения обновления состояния pingStats
            await new Promise(resolve => setTimeout(resolve, 1000));

            animateValue(0, uploadSpeedMbps, 1000, (value) => setUploadSpeed(`${value.toFixed(2)} Mbps`));
            animateValue(0, downloadSpeedMbps, 1000, (value) => setDownloadSpeed(`${value.toFixed(2)} Mbps`));

            // Отправка данных на сервер
            const speedTestData = {
                downloadSpeed: downloadSpeedMbps,
                uploadSpeed: uploadSpeedMbps,
                ping: pingStatsRef.current.avg,
                location: geolocationData?.city || 'Unknown Location',
                isp: geolocationData?.org || 'Unknown ISP'
            };

            console.log(speedTestData)

            try {
                const postResponse = await fetch('/api/speedtest', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(speedTestData),
                });

                if (!postResponse.ok) {
                    throw new Error('Network response was not ok');
                }

                const result = await postResponse.json();
                console.log('Speed test data saved:', result);
            } catch (error) {
                console.error('Error saving speed test data:', error);
            }

        } catch (error) {
            console.error('Error measuring speed:', error);
        }
        setIsTesting(false);
    };

    return {
        uploadSpeed,
        downloadSpeed,
        pingStats,
        isTesting,
        generateAndMeasureSpeed,
    };
};
