/**
 * Server-side video processing utilities
 * Extracts pose data from videos using MediaPipe and ffmpeg
 */

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { ReferenceData, PoseFrame, JointAngles, Landmark } from "./types";
import { calculateJointAngles } from "./angleCalculator";

// Get the paths to the installed ffmpeg and ffprobe binaries
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

/**
 * Get video metadata (duration, fps, dimensions) using ffprobe
 */
export async function getVideoMetadata(
  videoPath: string,
): Promise<{ duration: number; fps: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=r_frame_rate,width,height:format=duration",
      "-of",
      "json",
      videoPath,
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }

      try {
        const metadata = JSON.parse(stdout);
        const stream = metadata.streams?.[0];
        const format = metadata.format;

        if (!stream) {
          reject(new Error("No video stream found"));
          return;
        }

        const duration = parseFloat(format?.duration || "0");
        const fpsString = stream.r_frame_rate || "30/1";
        const [num, den] = fpsString.split("/").map(Number);
        const fps = num / (den || 1);
        const width = stream.width || 1280;
        const height = stream.height || 720;

        resolve({ duration, fps, width, height });
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`));
      }
    });
  });
}

/**
 * Extract frames from video at specified FPS using ffmpeg child_process
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  fps: number = 15,
): Promise<{ framePaths: string[]; frameCount: number }> {
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, "frame-%04d.png");

    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      videoPath,
      "-vf",
      `fps=${fps}`,
      "-q:v",
      "2",
      outputPattern,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed: ${stderr}`));
        return;
      }

      try {
        // Get all extracted frame paths
        const files = await fs.readdir(outputDir);
        const pngFiles = files
          .filter((f) => f.endsWith(".png"))
          .sort()
          .map((f) => path.join(outputDir, f));

        resolve({ framePaths: pngFiles, frameCount: pngFiles.length });
      } catch (error) {
        reject(new Error(`Failed to read extracted frames: ${error}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Process video and extract pose data
 */
export async function processVideo(
  videoPath: string,
  videoId: string,
  sampledFps: number = 15,
  onProgress?: (
    progress: number,
    currentFrame: number,
    totalFrames: number,
  ) => void,
): Promise<ReferenceData> {
  // Get video metadata
  const metadata = await getVideoMetadata(videoPath);

  // Create temp directory for frames
  const tempDir = path.join(process.cwd(), "public", "temp", videoId);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Extract frames
    const { framePaths, frameCount } = await extractFrames(
      videoPath,
      tempDir,
      sampledFps,
    );

    // Initialize MediaPipe Pose Landmarker
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Process each frame
    const poses: PoseFrame[] = [];
    const timestampInterval = 1000 / sampledFps; // milliseconds per frame

    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const timestamp = i * timestampInterval;

      // Load image with sharp and convert to raw buffer
      const imageBuffer = await sharp(framePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Detect pose
      const results = poseLandmarker.detect({
        data: new Uint8ClampedArray(imageBuffer.data),
        width: imageBuffer.info.width,
        height: imageBuffer.info.height,
      } as any);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0] as Landmark[];

        // Calculate angles
        const angles = calculateJointAngles(landmarks);

        poses.push({
          timestamp,
          angles,
          landmarks, // Store for potential debugging
        });
      }

      // Report progress
      if (onProgress) {
        const progress = ((i + 1) / frameCount) * 100;
        onProgress(progress, i + 1, frameCount);
      }
    }

    // Clean up
    poseLandmarker.close();

    // Remove temp frames
    await fs.rm(tempDir, { recursive: true, force: true });

    // Create reference data
    const referenceData: ReferenceData = {
      videoId,
      duration: metadata.duration,
      sampledFps,
      poses,
      createdAt: new Date().toISOString(),
    };

    // Save reference data
    const referenceDir = path.join(process.cwd(), "public", "references");
    await fs.mkdir(referenceDir, { recursive: true });
    const referencePath = path.join(referenceDir, `${videoId}.json`);
    await fs.writeFile(referencePath, JSON.stringify(referenceData, null, 2));

    return referenceData;
  } catch (error) {
    // Clean up on error
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Load reference data from file
 */
export async function loadReferenceData(
  videoId: string,
): Promise<ReferenceData | null> {
  const referencePath = path.join(
    process.cwd(),
    "public",
    "references",
    `${videoId}.json`,
  );

  try {
    const data = await fs.readFile(referencePath, "utf-8");
    return JSON.parse(data) as ReferenceData;
  } catch (error) {
    return null;
  }
}

/**
 * Check if reference data exists for video
 */
export async function referenceExists(videoId: string): Promise<boolean> {
  const referencePath = path.join(
    process.cwd(),
    "public",
    "references",
    `${videoId}.json`,
  );
  try {
    await fs.access(referencePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete reference data
 */
export async function deleteReference(videoId: string): Promise<void> {
  const referencePath = path.join(
    process.cwd(),
    "public",
    "references",
    `${videoId}.json`,
  );
  await fs.unlink(referencePath);
}

/**
 * List all available references
 */
export async function listReferences(): Promise<ReferenceData[]> {
  const referenceDir = path.join(process.cwd(), "public", "references");

  try {
    const files = await fs.readdir(referenceDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const references: ReferenceData[] = [];
    for (const file of jsonFiles) {
      const data = await fs.readFile(path.join(referenceDir, file), "utf-8");
      references.push(JSON.parse(data));
    }

    return references;
  } catch {
    return [];
  }
}
