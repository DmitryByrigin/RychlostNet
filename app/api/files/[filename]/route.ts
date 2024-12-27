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
        const fileBuffer = fs.readFileSync(filePath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        console.error('Error reading file:', error);
        return new NextResponse('File not found', { status: 404 });
    }
}
