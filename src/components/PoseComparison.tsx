import { useRef, useEffect, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { calculateSimilarity, normalizeLandmarks } from "../utils/poseUtils";

interface PoseComparisonProps {
  referenceVideoUrl: string;
}

// Pose connections for drawing skeleton (body only, no face/hand details)
const POSE_CONNECTIONS = [
  // Shoulders
  [11, 12],

  // Right arm (shoulder -> elbow -> wrist only)
  [12, 14],
  [14, 16],

  // Left arm (shoulder -> elbow -> wrist only)
  [11, 13],
  [13, 15],

  // Torso
  [11, 23],
  [12, 24],
  [23, 24],

  // Right leg (hip -> knee -> ankle only)
  [24, 26],
  [26, 28],

  // Left leg (hip -> knee -> ankle only)
  [23, 25],
  [25, 27],
];

// Landmarks to draw (body only, excludes face and hand detail points)
const LANDMARKS_TO_DRAW = new Set([
  11,
  12, // shoulders
  13,
  14, // elbows
  15,
  16, // wrists
  23,
  24, // hips
  25,
  26, // knees
  27,
  28, // ankles
]);

export default function PoseComparison({
  referenceVideoUrl,
}: PoseComparisonProps) {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);

  const [similarity, setSimilarity] = useState(0);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const videoAnimationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const referenceLandmarksRef = useRef<any[] | null>(null);
  const lastWebcamTimeRef = useRef<number>(-1);
  const lastVideoTimeRef = useRef<number>(-1);

  // Smoothing buffers for temporal filtering
  const webcamLandmarksBufferRef = useRef<any[][]>([]);
  const videoLandmarksBufferRef = useRef<any[][]>([]);
  const SMOOTHING_FRAMES = 5; // Number of frames to average

  // Smooth landmarks by averaging over multiple frames
  const smoothLandmarks = useCallback(
    (newLandmarks: any[], buffer: any[][]) => {
      // Add new landmarks to buffer
      buffer.push(newLandmarks);

      // Keep only the last N frames
      if (buffer.length > SMOOTHING_FRAMES) {
        buffer.shift();
      }

      // Average all landmarks in the buffer
      if (buffer.length === 0) return newLandmarks;

      const smoothed = newLandmarks.map((_, index) => {
        let sumX = 0,
          sumY = 0,
          sumZ = 0,
          sumVis = 0;

        for (const frame of buffer) {
          if (frame[index]) {
            sumX += frame[index].x;
            sumY += frame[index].y;
            sumZ += frame[index].z || 0;
            sumVis += frame[index].visibility || 0;
          }
        }

        const count = buffer.length;
        return {
          x: sumX / count,
          y: sumY / count,
          z: sumZ / count,
          visibility: sumVis / count,
        };
      });

      return smoothed;
    },
    [SMOOTHING_FRAMES],
  );

  // Memoized drawing function - only draws body landmarks
  const drawPoseLandmarks = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      landmarks: any[],
      connectionColor: string,
      landmarkColor: string,
    ) => {
      const canvasWidth = ctx.canvas.width;
      const canvasHeight = ctx.canvas.height;

      // Draw connections (body only)
      ctx.strokeStyle = connectionColor;
      ctx.lineWidth = 4;
      ctx.beginPath();

      for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
        const [start, end] = POSE_CONNECTIONS[i];
        const startLandmark = landmarks[start];
        const endLandmark = landmarks[end];

        if (startLandmark && endLandmark) {
          ctx.moveTo(
            startLandmark.x * canvasWidth,
            startLandmark.y * canvasHeight,
          );
          ctx.lineTo(endLandmark.x * canvasWidth, endLandmark.y * canvasHeight);
        }
      }
      ctx.stroke();

      // Draw landmarks (body only - no face/hands)
      ctx.fillStyle = landmarkColor;
      for (let i = 0; i < landmarks.length; i++) {
        // Only draw body landmarks
        if (!LANDMARKS_TO_DRAW.has(i)) continue;

        const landmark = landmarks[i];
        if (landmark.visibility && landmark.visibility > 0.5) {
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvasWidth,
            landmark.y * canvasHeight,
            5,
            0,
            2 * Math.PI,
          );
          ctx.fill();
        }
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Initialize PoseLandmarker
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.7,
        });

        if (!mounted) {
          poseLandmarker.close();
          return;
        }

        poseLandmarkerRef.current = poseLandmarker;
        setIsLoading(false);

        // Initialize webcam
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
          if (webcamRef.current && mounted) {
            webcamRef.current.srcObject = stream;
            webcamRef.current.play();
            streamRef.current = stream;
            setIsWebcamReady(true);
          }
        });
      } catch (error) {
        console.error("Initialization error:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      if (videoAnimationFrameIdRef.current) {
        cancelAnimationFrame(videoAnimationFrameIdRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isStarted) return;

    let shouldContinue = true;

    const processWebcamFrame = () => {
      if (!shouldContinue) return;

      const video = webcamRef.current;
      const canvas = webcamCanvasRef.current;
      const poseLandmarker = poseLandmarkerRef.current;

      if (video && canvas && poseLandmarker && video.readyState >= 2) {
        const currentTime = video.currentTime;

        // Only process if video time has changed (skip duplicate frames)
        if (currentTime !== lastWebcamTimeRef.current) {
          lastWebcamTimeRef.current = currentTime;
          const startTimeMs = performance.now();

          // Detect pose
          const results = poseLandmarker.detectForVideo(video, startTimeMs);

          // Draw results
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (results.landmarks && results.landmarks.length > 0) {
              const rawLandmarks = results.landmarks[0];

              // Apply temporal smoothing
              const landmarks = smoothLandmarks(
                rawLandmarks,
                webcamLandmarksBufferRef.current,
              );

              drawPoseLandmarks(ctx, landmarks, "#00FF00", "#FF0000");

              // Calculate similarity if reference landmarks exist
              if (referenceLandmarksRef.current) {
                const normalized1 = normalizeLandmarks(landmarks);
                const normalized2 = normalizeLandmarks(
                  referenceLandmarksRef.current,
                );
                const score = calculateSimilarity(normalized1, normalized2);
                setSimilarity(score);
              }
            }

            ctx.restore();
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(processWebcamFrame);
    };

    const processVideoFrame = () => {
      if (!shouldContinue) return;

      const video = videoRef.current;
      const canvas = videoCanvasRef.current;
      const poseLandmarker = poseLandmarkerRef.current;

      if (
        video &&
        canvas &&
        poseLandmarker &&
        !video.paused &&
        video.readyState >= 2
      ) {
        const currentTime = video.currentTime;

        // Only process if video time has changed
        if (currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = currentTime;
          const startTimeMs = performance.now();

          // Detect pose
          const results = poseLandmarker.detectForVideo(video, startTimeMs);

          // Draw results
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (results.landmarks && results.landmarks.length > 0) {
              const rawLandmarks = results.landmarks[0];

              // Apply temporal smoothing
              const landmarks = smoothLandmarks(
                rawLandmarks,
                videoLandmarksBufferRef.current,
              );

              drawPoseLandmarks(ctx, landmarks, "#0000FF", "#FFFF00");
              referenceLandmarksRef.current = landmarks;
            }

            ctx.restore();
          }
        }
      }

      videoAnimationFrameIdRef.current =
        requestAnimationFrame(processVideoFrame);
    };

    // Start the reference video
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }

    processWebcamFrame();
    processVideoFrame();

    return () => {
      shouldContinue = false;

      // Pause the reference video when stopped
      if (videoRef.current) {
        videoRef.current.pause();
      }

      // Reset time refs and smoothing buffers
      lastWebcamTimeRef.current = -1;
      lastVideoTimeRef.current = -1;
      webcamLandmarksBufferRef.current = [];
      videoLandmarksBufferRef.current = [];
    };
  }, [isStarted, drawPoseLandmarks, smoothLandmarks]);

  const handleStart = useCallback(() => {
    setIsStarted(true);
  }, []);

  const handleStop = useCallback(() => {
    setIsStarted(false);
    setSimilarity(0);
    referenceLandmarksRef.current = null;
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p className="text-xl">Loading pose detection model...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">Reference Video</h3>
          <video
            ref={videoRef}
            src={referenceVideoUrl}
            loop
            muted
            className="hidden"
            playsInline
          />
          <canvas
            ref={videoCanvasRef}
            width={640}
            height={480}
            className="w-full border-2 border-blue-500 rounded-lg bg-black"
          />
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Your Webcam</h3>
          <video
            ref={webcamRef}
            autoPlay
            playsInline
            muted
            className="w-full hidden aspect-[4/3] border-2 border-green-500 rounded-lg object-contain bg-black"
          />
          <canvas
            ref={webcamCanvasRef}
            width={640}
            height={480}
            className="w-full aspect-[4/3] border-2 border-green-500 rounded-lg object-contain bg-black"
          />
          {!isWebcamReady && (
            <p className="mt-2 text-gray-600">Loading webcam...</p>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        {!isStarted ? (
          <button
            onClick={handleStart}
            disabled={!isWebcamReady}
            className={`text-xl font-bold py-4 px-8 rounded-lg transition-colors ${
              isWebcamReady
                ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            {isWebcamReady ? "▶ Start Comparison" : "⏳ Waiting for webcam..."}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="text-xl font-bold py-4 px-8 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            ⏹ Stop
          </button>
        )}
      </div>

      {isStarted && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">
            Similarity Score: {(similarity * 100).toFixed(1)}%
          </h2>
          <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                similarity > 0.8
                  ? "bg-green-500"
                  : similarity > 0.6
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${similarity * 100}%` }}
            />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>Green: Excellent match (&gt;80%)</p>
            <p>Yellow: Good match (60-80%)</p>
            <p>Red: Needs improvement (&lt;60%)</p>
          </div>
        </div>
      )}
    </div>
  );
}
