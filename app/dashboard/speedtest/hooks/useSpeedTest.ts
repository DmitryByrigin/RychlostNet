import { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';

export const useSpeedTest = () => {
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [pingStats, setPingStats] = useState({ min: 0, max: 0, avg: 0 });
    const [isTesting, setIsTesting] = useState(false);
    const { selectedServer } = useServer();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    useEffect(() => {
        if (selectedServer) {
            console.log('Speed test server updated:', {
                name: selectedServer.name,
                url: selectedServer.url,
                sponsor: selectedServer.sponsor
            });
        }
    }, [selectedServer]);

    const generateAndMeasureSpeed = async () => {
        setIsTesting(true);

        try {
            if (!selectedServer) {
                throw new Error('No server selected');
            }

            console.log('Using server for speed test:', {
                name: selectedServer.name,
                url: selectedServer.url,
                sponsor: selectedServer.sponsor
            });

            // Generate file for upload
            const file = new Blob(['0'.repeat(5 * 1024 * 1024)]);
            const uploadResponse = await fetch(`${appUrl}/api/generateImage`, {
                method: 'POST',
                body: file,
            });

            if (!uploadResponse.ok) throw new Error('Failed to upload file');

            const responseData = await uploadResponse.json();
            console.log('Response from /api/generateImage:', responseData);

            const { imagePaths } = responseData;

            if (!imagePaths || !Array.isArray(imagePaths)) {
                throw new Error('Invalid response: imagePaths is not an array');
            }

            const formData = new FormData();

            // Fix paths and upload images
            for (const path of imagePaths) {
                const normalizedPath = path.replace(/\\/g, '/').replace('/public', '');
                const fullUrl = `${appUrl}${normalizedPath}`;

                const response = await fetch(fullUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image at path: ${path}`);
                }

                const blob = await response.blob();
                const fileName = normalizedPath.split('/').pop() || 'image.png';
                formData.append('files', blob, fileName);
            }

            // Use the server's own reported URL for speed test
            const baseUrl = selectedServer.url.replace('/speedtest/test', '');
            const speedTestUrl = `${baseUrl}/speedtest/test`;

            console.log('Sending images to speedtest/test on server:', speedTestUrl);
            const nestResponse = await fetch(speedTestUrl, {
                method: 'POST',
                body: formData,
            });

            if (!nestResponse.ok) throw new Error('Failed to test speed');
            const testData = await nestResponse.json();

            console.log('Speed test result:', testData);

            setUploadSpeed(testData.uploadSpeed);
            setDownloadSpeed(testData.downloadSpeed);
            setPingStats({
                min: parseFloat(testData.ping.min),
                max: parseFloat(testData.ping.max),
                avg: parseFloat(testData.ping.avg),
            });
        } catch (error) {
            console.error('Error during speed test:', error);
        } finally {
            setIsTesting(false);
        }
    };

    return { uploadSpeed, downloadSpeed, pingStats, isTesting, generateAndMeasureSpeed };
};
