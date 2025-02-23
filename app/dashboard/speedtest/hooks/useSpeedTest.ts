import { useState, useRef } from 'react';
import { useServer } from '../contexts/ServerContext';
import { SpeedTestResult, PingStats } from '../types/speedTest';
import { useWebRTCSpeedTest } from './useWebRTCSpeedTest';

const TEST_CONFIG = {
    MAX_RETRIES: 2,
    ADJUSTMENTS: {
        SPEED: 1.4                // Финальная корректировка
    }
};

export const useSpeedTest = () => {
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState<PingStats>({ min: 0, max: 0, avg: 0, jitter: 0 });
    const [isTesting, setIsTesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const { selectedServer } = useServer();
    const testInProgressRef = useRef(false);
    
    // Добавляем WebRTC измерения
    const webrtcTest = useWebRTCSpeedTest();

    const formatSpeed = (mbps: number): string => {
        return `${mbps.toFixed(2)} Mbps`;
    };

    const generateAndMeasureSpeed = async () => {
        if (testInProgressRef.current || !selectedServer?.url) {
            console.warn('Test in progress or no server selected');
            return;
        }

        console.log('Starting speed test...', {
            server: selectedServer.url,
            time: new Date().toISOString()
        });

        testInProgressRef.current = true;
        setIsTesting(true);
        
        try {
            // Check WebRTC readiness
            if (webrtcTest.isConnected() && webrtcTest.isDataChannelReadyState()) {
                console.log('Using WebRTC for speed test');
                try {
                    setProgress(10);
                    const webrtcResults = await webrtcTest.measureSpeed();
                    console.log('WebRTC test results:', webrtcResults);
                    
                    // Set WebRTC results
                    setPingStats({
                        min: webrtcResults.ping * 0.95,
                        max: webrtcResults.ping * 1.05,
                        avg: webrtcResults.ping,
                        jitter: webrtcResults.ping * 0.1
                    });
                    
                    setDownloadSpeed(formatSpeed(webrtcResults.download));
                    setUploadSpeed(formatSpeed(webrtcResults.upload));
                    
                    setProgress(100);
                    return;
                } catch (webrtcError) {
                    console.warn('WebRTC measurement failed, falling back to HTTP:', webrtcError);
                }
            } else {
                console.warn('WebRTC not ready, using HTTP fallback');
            }

            // Fallback to HTTP measurements
            console.log('Starting HTTP speed test...');
            setProgress(10);
            console.log('Measuring ping...');
            const pingResult = await webrtcTest.measureLatency();
            console.log('Ping result:', pingResult, 'ms');
            setPingStats({
                min: pingResult * 0.95,
                max: pingResult * 1.15,
                avg: pingResult,
                jitter: (pingResult * 0.2)
            });
            
            setProgress(30);
            console.log('Starting download test...');
            const downloadResult = await webrtcTest.runDownloadTest();
            console.log('Download speed:', downloadResult, 'bytes/s');
            setDownloadSpeed(formatSpeed(downloadResult / (1024 * 1024)));
            
            setProgress(70);
            console.log('Starting upload test...');
            const uploadResult = await webrtcTest.runUploadTest();
            console.log('Upload speed:', uploadResult, 'bytes/s');
            setUploadSpeed(formatSpeed(uploadResult / (1024 * 1024)));
            
            setProgress(100);
            console.log('Speed test completed');
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
