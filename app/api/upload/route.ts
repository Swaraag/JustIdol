/**
 * Video upload API route
 * Handles user video uploads
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No video file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Please upload MP4, WebM, MOV, or AVI",
        },
        { status: 400 },
      );
    }

    // Validate file size (max 300MB)
    const maxSize = 300 * 1024 * 1024; // 300MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 200MB" },
        { status: 400 },
      );
    }

    // Generate unique video ID
    const videoId = uuidv4();
    const extension = file.name.split(".").pop() || "mp4";
    const filename = `${videoId}.${extension}`;

    // Ensure videos directory exists
    const videosDir = path.join(process.cwd(), "public", "videos");
    await fs.mkdir(videosDir, { recursive: true });

    // Save file
    const filepath = path.join(videosDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      videoId,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}
