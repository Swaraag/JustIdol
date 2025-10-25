/**
 * Video processing API route
 * Processes uploaded videos to extract pose data
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { processVideo, referenceExists } from '@/lib/videoProcessor';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { videoId, sampledFps = 15 } = await request.json();

    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'No video ID provided' },
        { status: 400 }
      );
    }

    // Check if already processed
    const exists = await referenceExists(videoId);
    if (exists) {
      return NextResponse.json({
        success: true,
        videoId,
        message: 'Video already processed',
        alreadyProcessed: true,
      });
    }

    // Find video file
    const videosDir = path.join(process.cwd(), 'public', 'videos');
    const extensions = ['mp4', 'webm', 'mov', 'avi'];
    let videoPath: string | null = null;

    for (const ext of extensions) {
      const testPath = path.join(videosDir, `${videoId}.${ext}`);
      try {
        const fs = await import('fs/promises');
        await fs.access(testPath);
        videoPath = testPath;
        break;
      } catch {
        // File doesn't exist, try next extension
      }
    }

    if (!videoPath) {
      return NextResponse.json(
        { success: false, error: 'Video file not found' },
        { status: 404 }
      );
    }

    // Process video
    console.log(`Processing video: ${videoId}`);

    const referenceData = await processVideo(
      videoPath,
      videoId,
      sampledFps,
      (progress, currentFrame, totalFrames) => {
        console.log(`Processing: ${progress.toFixed(1)}% (${currentFrame}/${totalFrames})`);
      }
    );

    console.log(`Video processed successfully: ${videoId}`);
    console.log(`Extracted ${referenceData.poses.length} poses`);

    return NextResponse.json({
      success: true,
      videoId,
      poseCount: referenceData.poses.length,
      duration: referenceData.duration,
      sampledFps: referenceData.sampledFps,
    });
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}
