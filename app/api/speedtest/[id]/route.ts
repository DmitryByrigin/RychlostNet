import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";

export async function DELETE(req: NextRequest) {
    if (req.method !== 'DELETE') {
        return new NextResponse('Method Not Allowed', { status: 405 });
    }

    try {
        const url = new URL(req.url);
        const id = url.pathname.split('/').pop();
        if (!id) {
            console.error('ID not provided');
            return new NextResponse('Bad Request', { status: 400 });
        }

        console.log(`Deleting record with ID: ${id}`);
        const result = await db.speedTestHistory.delete({
            where: { id: String(id) },
        });
        return new NextResponse(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error deleting record:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
