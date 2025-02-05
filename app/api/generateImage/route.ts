import { NextRequest, NextResponse } from 'next/server';
import { tempFilesUtils } from '@/utils/tempFiles';
import fs from 'fs/promises';

async function generateNoiseImage(size: number): Promise<string> {
    // Создаем буфер фиксированного размера
    const noiseBuffer = Buffer.alloc(size);
    
    // Заполняем буфер случайными данными
    for (let i = 0; i < size; i++) {
        noiseBuffer[i] = Math.floor(Math.random() * 256);
    }
    
    console.log(`Buffer size before saving: ${noiseBuffer.length} bytes`);
    
    const filename = `noiseData_${size}.bin`;
    const outputPath = tempFilesUtils.getFilePath(filename);

    try {
        // Записываем бинарные данные напрямую
        await fs.writeFile(outputPath, noiseBuffer);
        
        // Проверяем размер записанного файла
        const stats = await fs.stat(outputPath);
        console.log(`File size after saving: ${stats.size} bytes`);
        
        // Проверяем, что размер файла соответствует ожидаемому
        if (stats.size !== size) {
            throw new Error(`File size mismatch: expected ${size} bytes, got ${stats.size} bytes`);
        }
        
        const apiPath = tempFilesUtils.getApiPath(filename);
        console.log(`Generated file: ${filename}, API path: ${apiPath}`);
        
        return apiPath;
    } catch (error) {
        console.error('Error generating noise data:', error);
        throw error;
    }
}

async function generateMultipleNoiseImages(sizes: number[]): Promise<string[]> {
    const imagePaths = [];
    const defaultSizes = [1, 2, 5, 10, 20, 50].map(mb => mb * 1024 * 1024);
    const targetSizes = sizes && sizes.length > 0 ? sizes : defaultSizes;

    for (const size of targetSizes) {
        const path = await generateNoiseImage(size);
        imagePaths.push(path);
    }

    return imagePaths;
}

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await req.json();
        const sizes = body.sizes || [];
        
        const startTime = performance.now();
        const imagePaths = await generateMultipleNoiseImages(sizes);
        const endTime = performance.now();
        
        const generationTime = endTime - startTime;
        console.log(`Generated ${imagePaths.length} images in ${generationTime}ms`);

        return NextResponse.json({
            imagePaths,
            generationTime,
            message: 'Images generated successfully'
        });
    } catch (error) {
        console.error('Error in generateImage route:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return new NextResponse('Method Not Allowed', { status: 405 });
}
