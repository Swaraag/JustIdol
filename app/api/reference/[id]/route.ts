/**
 * Reference data API route
 * Serves processed pose data for a specific video
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadReferenceData } from '@/lib/videoProcessor';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'No video ID provided' },
        { status: 400 }
      );
    }

    const referenceData = await loadReferenceData(id);

    if (!referenceData) {
      return NextResponse.json(
        { success: false, error: 'Reference data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: referenceData,
    });
  } catch (error) {
    console.error('Reference fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load reference data',
      },
      { status: 500 }
    );
  }
}
