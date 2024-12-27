import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { tempFilesUtils } from '@/utils/tempFiles';

async function generateMultipleNoiseImages(): Promise<string[]> {
    const sizes = [50000, 100000, 150000, 200000, 250000, 300000];
    const imagePaths = [];

    for (const size of sizes) {
        const bytesPerPixel = 3;
        const pixels = size / bytesPerPixel;
        const dimension = Math.round(Math.sqrt(pixels));
        const noiseBuffer = Buffer.from(Array.from({ length: dimension * dimension * bytesPerPixel }, () => Math.floor(Math.random() * 256)));
        const filename = `noiseImage_${size}.png`;
        const outputPath = tempFilesUtils.getFilePath(filename);

        try {
            await sharp(noiseBuffer, {
                raw: {
                    width: dimension,
                    height: dimension,
                    channels: 3
                }
            })
                .toFormat('png')
                .toFile(outputPath);

            imagePaths.push(tempFilesUtils.getApiPath(filename));
        } catch (error) {
            console.error('Error generating noise image:', error);
            throw error;
        }
    }

    return imagePaths;
}

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const startUploadTime = Date.now();
        const buffer = await req.arrayBuffer();
        const uploadTimeTaken = Date.now() - startUploadTime;
        const uploadSize = buffer.byteLength;

        const imagePaths = await generateMultipleNoiseImages();

        const largeResponseData = Buffer.alloc(5 * 1024 * 1024, 'a'); // 5MB data for download speed test
        const downloadSpeedKbps = (largeResponseData.byteLength / (uploadTimeTaken / 1000)) / 1024;

        const uploadSpeedKbps = (uploadSize / (uploadTimeTaken / 1000)) / 1024;

        return new NextResponse(
            JSON.stringify({
                imagePaths,
                uploadSpeed: `${uploadSpeedKbps.toFixed(2)} Kbps`,
                downloadSpeed: `${downloadSpeedKbps.toFixed(2)} Kbps`,
                largeResponseData: largeResponseData.toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Error:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function GET(req: NextRequest) {
    if (req.method !== 'GET') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    return new NextResponse('Pong', { status: 200 });
}
