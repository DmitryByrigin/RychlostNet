import { NextResponse } from 'next/server';

// Токен для Fast.com (тот же, что используется в Nest.js версии)
const FAST_TOKEN = 'YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm';

export async function GET() {
  console.log('Next.js API: Getting Fast.com token');
  
  try {
    return NextResponse.json({ token: FAST_TOKEN });
  } catch (error) {
    console.error('Error getting Fast.com token:', error);
    return NextResponse.json(
      { error: 'Failed to get Fast.com token' },
      { status: 500 }
    );
  }
} 