import { NextRequest, NextResponse } from 'next/server';
import { tempFilesUtils } from '@/utils/tempFiles';
import fs from 'fs';

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    const filename = params.filename;
    const filePath = tempFilesUtils.getFilePath(filename);

    try {
        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return new NextResponse('File not found', { status: 404 });
        }

        // Читаем файл и проверяем его размер
        const fileBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);
        
        // Определяем Content-Type на основе расширения файла
        const contentType = filename.endsWith('.bin') ? 'application/octet-stream' : 'image/png';
        
        // Подробное логирование
        console.log(`Serving file ${filename}:`, {
            path: filePath,
            exists: fs.existsSync(filePath),
            statsSize: stats.size,
            bufferLength: fileBuffer.length,
            bufferByteLength: fileBuffer.byteLength,
            contentType,
            firstBytes: Array.from(fileBuffer.slice(0, 10)),
            lastBytes: Array.from(fileBuffer.slice(-10))
        });

        // Проверяем целостность буфера
        if (fileBuffer.length !== stats.size) {
            console.error(`Buffer size mismatch for ${filename}:`, {
                expectedSize: stats.size,
                actualSize: fileBuffer.length,
                bufferByteLength: fileBuffer.byteLength
            });
            throw new Error(`Buffer size mismatch for ${filename}`);
        }
        
        const headers = new Headers({
            'Content-Type': contentType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });

        // Возвращаем файл с правильным размером
        return new NextResponse(fileBuffer, { headers });
    } catch (error) {
        console.error(`Error serving file ${filename}:`, error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
