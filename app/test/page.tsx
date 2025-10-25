/**
 * Test page - Just the webcam canvas with pose detection
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Landmark } from "@/lib/types";
import PoseCanvas from "@/components/PoseCanvas";

export default function TestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const animationFrameRef = useRef<number>();
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    let mounted = true;

    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        if (mounted) {
          poseLandmarkerRef.current = poseLandmarker;
          setIsLoading(false);
        }
      } catch (err) {
        console.error("MediaPipe error:", err);
        if (mounted) {
          setError("Failed to load pose detection");
        }
      }
    }

    initMediaPipe();

    return () => {
      mounted = false;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  // Initialize webcam
  useEffect(() => {
    if (isLoading) return;

    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            const width = videoRef.current!.videoWidth;
            const height = videoRef.current!.videoHeight;
            setDimensions({ width, height });
            processWebcam();
          };
        }
      } catch (err) {
        console.error("Webcam error:", err);
        setError("Failed to access webcam");
      }
    }

    startWebcam();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading]);

  // Process webcam frames
  const processWebcam = () => {
    const processFrame = () => {
      if (!videoRef.current || !poseLandmarkerRef.current) return;

      const results = poseLandmarkerRef.current.detectForVideo(
        videoRef.current,
        performance.now(),
      );

      if (results.landmarks && results.landmarks.length > 0) {
        setLandmarks(results.landmarks[0] as Landmark[]);
      } else {
        setLandmarks(null);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-8 text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-2xl font-bold text-red-400">Error</h2>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <div className="text-center">
          <div className="mb-4 text-6xl">⏳</div>
          <p className="text-2xl font-bold text-white">
            Loading pose detection...
          </p>
        </div>
      )}

      {/* Webcam Canvas */}
      {!isLoading && !error && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="rounded-lg"
            style={{ transform: "scaleX(-1)" }}
            width={dimensions.width}
            height={dimensions.height}
          />

          {/* Pose Overlay */}
          {landmarks && (
            <div className="absolute inset-0">
              <PoseCanvas
                landmarks={landmarks}
                canvasWidth={dimensions.width}
                canvasHeight={dimensions.height}
              />
            </div>
          )}

          {/* Info Overlay */}
          <div className="absolute left-4 top-4 rounded-lg border border-white/30 bg-black/60 px-4 py-2 backdrop-blur-md">
            <div className="text-sm text-white">
              <div>
                Resolution: {dimensions.width}x{dimensions.height}
              </div>
              <div>Pose Detected: {landmarks ? "✅ Yes" : "❌ No"}</div>
              <div>Landmarks: {landmarks ? landmarks.length : 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
