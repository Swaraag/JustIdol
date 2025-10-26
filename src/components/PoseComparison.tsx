import { useRef, useEffect, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { calculateSimilarity, normalizeLandmarks } from "../utils/poseUtils";
import { KaraokeScoringHookResult } from "../hooks/useKaraokeScoring.ts";
import AudioVisualizer from "./karaoke/AudioVisualizer.tsx";

interface PoseComparisonProps {
  referenceVideoUrl: string;
  onChangeVideo: () => void;
  karaoke: KaraokeScoringHookResult;
  selectedMicrophone: string;
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
  onChangeVideo,
  karaoke,
  selectedMicrophone,
}: PoseComparisonProps) {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);

  const [similarity, setSimilarity] = useState(0);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [combinedScore, setCombinedScore] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({
    width: 640,
    height: 480,
  });
  const [webcamDimensions, setWebcamDimensions] = useState({
    width: 640,
    height: 480,
  });

  const scoreHistoryRef = useRef<number[]>([]);

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
    [SMOOTHING_FRAMES]
  );

  // Memoized drawing function - only draws body landmarks
  const drawPoseLandmarks = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      landmarks: any[],
      connectionColor: string,
      landmarkColor: string
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
            startLandmark.y * canvasHeight
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
            2 * Math.PI
          );
          ctx.fill();
        }
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Initialize PoseLandmarker
        const vision = await FilesetResolver.forVisionTasks("/models");

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.7,
          minPosePresenceConfidence: 0.7,
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
            streamRef.current = stream;

            webcamRef.current.onloadedmetadata = () => {
              if (webcamRef.current && mounted) {
                webcamRef.current.play();
                setWebcamDimensions({
                  width: webcamRef.current.videoWidth,
                  height: webcamRef.current.videoHeight,
                });
                setIsWebcamReady(true);
              }
            };
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

  // Connect video audio when video is loaded and ready
  useEffect(() => {
    if (!videoRef.current || !referenceVideoUrl) return;

    const video = videoRef.current;
    console.log("🎥 Setting up video audio connection...");

    const handleCanPlay = async () => {
      try {
        console.log("🎵 Video ready, connecting audio...");
        await karaoke.connectVideo(video);
        console.log("✅ Video audio connected for karaoke!");
      } catch (err) {
        console.error("❌ Failed to connect video audio:", err);
      }
    };

    const handleLoadedData = async () => {
      try {
        console.log("📊 Video data loaded, connecting audio...");
        await karaoke.connectVideo(video);
        console.log("✅ Video audio connected!");
      } catch (err) {
        console.error("❌ Failed to connect video audio:", err);
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);

    // Also try to connect immediately if video is already ready
    if (video.readyState >= 2) {
      console.log("🎬 Video already ready, connecting immediately...");
      handleCanPlay();
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      karaoke.disconnectVideo();
      console.log("🔌 Video audio disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceVideoUrl]);

  // Calculate combined score (dance + vocal)
  useEffect(() => {
    if (karaoke.zoneScore && isStarted) {
      const danceScore = similarity * 100;
      const vocalScore = karaoke.zoneScore.totalScore;

      // 50/50 split
      const combined = Math.round((danceScore + vocalScore) / 2);
      setCombinedScore(combined);
    }
  }, [similarity, karaoke.zoneScore, isStarted]);

  useEffect(() => {
    if (!isStarted) return;
    console.log("useEffect Started");
    let shouldContinue = true;
    setIsVideoPlaying(false);

    // Start karaoke recording when dance starts
    const startKaraoke = async () => {
      if (selectedMicrophone) {
        try {
          await karaoke.startRecording(selectedMicrophone);
          console.log("Karaoke recording started!");
        } catch (error) {
          console.error("Failed to start karaoke recording:", error);
        }
      }
    };

    startKaraoke();

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
                webcamLandmarksBufferRef.current
              );

              drawPoseLandmarks(ctx, landmarks, "#00FF00", "#FF0000");

              // Calculate similarity if reference landmarks exist
              if (referenceLandmarksRef.current) {
                const normalized1 = normalizeLandmarks(landmarks);
                const normalized2 = normalizeLandmarks(
                  referenceLandmarksRef.current
                );
                const score = calculateSimilarity(normalized1, normalized2);
                setSimilarity(score);

                // Track score for final average
                scoreHistoryRef.current.push(score);
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

          // Set video playing to true once we start processing frames
          if (!isVideoPlaying) {
            setIsVideoPlaying(true);
          }

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
                videoLandmarksBufferRef.current
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
      const video = videoRef.current;

      // Set video dimensions when playing
      const handleLoadedMetadata = () => {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };

      // Handle video end
      const handleVideoEnded = () => {
        // Calculate final score from history
        if (scoreHistoryRef.current.length > 0) {
          const average =
            scoreHistoryRef.current.reduce((a, b) => a + b, 0) /
            scoreHistoryRef.current.length;
          setFinalScore(average);
        } else {
          setFinalScore(0);
        }
        setIsFinished(true);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleVideoEnded);

      if (video.videoWidth > 0) {
        handleLoadedMetadata();
      }

      // Enable audio for the video
      video.muted = false;
      video.volume = 1.0;
      
      console.log("🎬 Starting video, ensuring audio is connected...");

      // Ensure video audio is connected
      karaoke.connectVideo(video).then(() => {
        console.log("✅ Video audio reconnected on start");
      }).catch((err) => {
        console.error("❌ Failed to connect video audio on start:", err);
      });

      // Only reset and play if video is paused
      video.currentTime = 0;
      video.play().catch((err) => {
        console.error("Error playing video:", err);
      });
    }

    processWebcamFrame();
    processVideoFrame();

    return () => {
      shouldContinue = false;

      // Stop karaoke recording when dance stops
      karaoke.stopRecording();

      // Pause the reference video when stopped
      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();
        video.removeEventListener("ended", () => {});
      }

      // Reset video playing state
      setIsVideoPlaying(false);

      // Reset time refs and smoothing buffers
      lastWebcamTimeRef.current = -1;
      lastVideoTimeRef.current = -1;
      webcamLandmarksBufferRef.current = [];
      videoLandmarksBufferRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarted]);

  const handleStop = useCallback(() => {
    setIsStarted(false);
    setSimilarity(0);
    referenceLandmarksRef.current = null;
    karaoke.stopRecording();
  }, [karaoke]);

  const handleRetry = useCallback(() => {
    // Reset all state
    setIsFinished(false);
    setIsStarted(false);
    setIsVideoPlaying(false);
    setSimilarity(0);
    setFinalScore(0);
    setCombinedScore(0);
    scoreHistoryRef.current = [];
    referenceLandmarksRef.current = null;
    karaoke.reset();

    // Restart after a brief delay to ensure cleanup
    setTimeout(() => {
      setIsStarted(true);
    }, 100);
  }, [karaoke]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-black via-red-950 to-purple-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-6">
            {/* Demon hunter summoning circle */}
            <div className="absolute inset-0 border-4 border-red-600/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-red-500 border-r-purple-500 rounded-full animate-spin"></div>
            <div
              className="absolute inset-3 border-4 border-transparent border-t-purple-500 border-r-pink-500 rounded-full animate-spin"
              style={{
                animationDirection: "reverse",
                animationDuration: "1.5s",
              }}
            ></div>
            <div
              className="absolute inset-6 border-4 border-transparent border-t-pink-500 rounded-full animate-spin"
              style={{ animationDuration: "1s" }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-pink-400 font-black mb-2">
            SUMMONING DEMON HUNTER
          </p>
          <p className="text-red-300/70 font-medium">
            Loading pose detection magic...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-black z-50">
      {/* Demon Hunter Battle Arena Background with Character Silhouettes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/50 via-black to-purple-950/50"></div>
        {/* Mystical demon energy particles */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDuration: "3s" }}
        ></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: "1.5s", animationDuration: "4s" }}
        ></div>

        {/* Fading K-pop performer silhouettes */}
        <div
          className="absolute top-28 left-265 opacity-15 animate-pulse"
          style={{ animationDuration: "4s" }}
        >
          <img
            src="/images/demon-hunter.png"
            alt=""
            className="w-140 h-100 object-contain"
          />
        </div>
      </div>

      {/* Fullscreen Reference Video */}
      <div className="w-full h-full relative">
        <video
          ref={videoRef}
          src={referenceVideoUrl}
          className="hidden"
          playsInline
          crossOrigin="anonymous"
        />
        <canvas
          ref={videoCanvasRef}
          width={videoDimensions.width}
          height={videoDimensions.height}
          className="w-full h-full object-contain"
        />
        {/* Battle arena overlay effect */}
        <div className="absolute inset-0 pointer-events-none border-8 border-red-900/20"></div>
      </div>

      {/* Demon Hunter Webcam Portal in Corner */}
      <div className="absolute bottom-8 right-8 w-80">
        <div className="relative group">
          {/* Demon energy aura around webcam */}
          <div className="absolute -inset-2 bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse"></div>

          <div className="relative">
            {/* Mystical frame indicators */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-transparent via-red-400 to-transparent"></div>
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"></div>

            <div className="relative bg-gradient-to-br from-gray-950 to-red-950 rounded-2xl overflow-hidden border-2 border-red-500/50 shadow-2xl shadow-red-500/50">
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                className="hidden"
              />
              <canvas
                ref={webcamCanvasRef}
                width={webcamDimensions.width}
                height={webcamDimensions.height}
                className="w-full"
                style={{ transform: "scaleX(-1)" }}
              />
              {!isWebcamReady && (
                <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-400 mb-2"></div>
                    <p className="text-sm font-bold text-red-300">
                      Activating Hunter Vision...
                    </p>
                  </div>
                </div>
              )}
              {/* Hunter status label */}
              <div className="absolute top-2 left-2 bg-black/80 px-3 py-1 rounded-lg border border-red-500/50">
                <p className="text-xs font-black text-red-400">HUNTER CAM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Audio Visualizers */}
      <div className="absolute bottom-8 left-8 z-10 flex gap-4">
        {/* User Microphone Audio Visualizer */}
        <div className="bg-black/90 backdrop-blur-sm border-2 border-green-500/50 rounded-xl p-4 shadow-2xl">
          <p className="text-xs font-black text-green-400 mb-2 text-center">USER MIC</p>
          <AudioVisualizer
            analyser={karaoke.micAnalyser}
            isActive={karaoke.isRecording}
            type="both"
            className="w-80"
          />
        </div>

        {/* Video Reference Audio Visualizer */}
        <div className="bg-black/90 backdrop-blur-sm border-2 border-blue-500/50 rounded-xl p-4 shadow-2xl">
          <p className="text-xs font-black text-blue-400 mb-2 text-center">VIDEO AUDIO</p>
          <AudioVisualizer
            analyser={karaoke.videoAnalyser}
            isActive={isVideoPlaying}
            type="both"
            className="w-80"
          />
        </div>
      </div>

      {/* Demon Hunter Control Panel */}
      <div className="absolute top-8 left-8 z-10 flex gap-4">
        <button
          onClick={onChangeVideo}
          className="group relative px-6 py-3 rounded-xl bg-black/80 backdrop-blur-sm border-2 border-red-700/50 text-red-200 font-black hover:bg-red-950/50 hover:border-red-500 transition-all duration-300 shadow-lg hover:shadow-red-500/50 hover:scale-105"
        >
          <span className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            RETREAT
          </span>
        </button>

        {!isStarted ? (
          <button
            onClick={() => setIsStarted(true)}
            disabled={!isWebcamReady}
            className={`group relative px-8 py-3 rounded-xl font-black text-xl transition-all duration-300 shadow-lg hover:shadow-2xl border-2 ${
              isWebcamReady
                ? "bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 text-white hover:scale-110 border-red-400/50 hover:border-red-300 shadow-red-500/50"
                : "bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700"
            }`}
          >
            <span className="flex items-center gap-3">
              {isWebcamReady ? (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>START HUNT</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  PREPARING HUNTER...
                </>
              )}
            </span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="group relative px-8 py-3 rounded-xl bg-gradient-to-r from-red-700 to-red-900 text-white font-black text-xl hover:from-red-600 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 border-2 border-red-500/50"
          >
            <span className="flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              END HUNT
            </span>
          </button>
        )}
      </div>

      {/* Demon Summoning Loading State */}
      {isStarted && !isVideoPlaying && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-6">
              {/* Demon hunter summoning circle animation */}
              <div className="absolute inset-0 border-4 border-red-600/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-red-500 border-r-purple-500 rounded-full animate-spin"></div>
              <div
                className="absolute inset-3 border-4 border-transparent border-t-purple-500 border-r-pink-500 rounded-full animate-spin"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "1.5s",
                }}
              ></div>
              <div
                className="absolute inset-6 border-4 border-transparent border-t-pink-500 rounded-full animate-spin"
                style={{ animationDuration: "1s" }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-pink-400 font-black">
              INITIALIZING BATTLE
            </p>
            <p className="text-red-300/70 mt-2 font-medium">
              Prepare yourself, Hunter...
            </p>
          </div>
        </div>
      )}

      {/* Demon Hunter Combat Score Display */}
      {isStarted && isVideoPlaying && !isFinished && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse"></div>

            <div className="relative bg-black/90 backdrop-blur-md px-10 py-6 rounded-2xl border-2 border-red-500/50 shadow-2xl">
              {/* Combined Score */}
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-600 to-purple-600 px-4 py-1 rounded-full border-2 border-red-400/50">
                <p className="text-xs font-black text-white">TOTAL SYNC RATE</p>
              </div>

              <h2 className="text-6xl font-black mb-3 text-center relative">
                <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 blur-sm animate-pulse">
                  {combinedScore}%
                </span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-pink-400">
                  {combinedScore}%
                </span>
              </h2>

              {/* Individual Scores */}
              <div className="flex justify-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-xs text-purple-300 font-bold mb-1">
                    DANCE
                  </p>
                  <p className="text-2xl font-black text-purple-400">
                    {(similarity * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="w-px bg-red-500/30"></div>
                <div className="text-center">
                  <p className="text-xs text-pink-300 font-bold mb-1">VOCAL</p>
                  <p className="text-2xl font-black text-pink-400">
                    {karaoke.zoneScore ? karaoke.zoneScore.totalScore : 0}%
                  </p>
                </div>
              </div>

              {/* Power bar */}
              <div className="relative w-80 h-5 bg-gray-900 rounded-full overflow-hidden shadow-inner border border-red-900/50">
                <div
                  className={`h-full transition-all duration-300 rounded-full relative ${
                    combinedScore > 80
                      ? "bg-gradient-to-r from-red-500 via-pink-500 to-red-500 shadow-lg shadow-red-500/50"
                      : combinedScore > 60
                      ? "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 shadow-lg shadow-purple-500/50"
                      : "bg-gradient-to-r from-gray-600 via-red-600 to-gray-600 shadow-lg shadow-red-500/30"
                  }`}
                  style={{ width: `${combinedScore}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                </div>
              </div>

              <div className="flex justify-between mt-2 text-xs font-black">
                <span className="text-red-400">TRAINEE</span>
                <span className="text-purple-400">A-RANK</span>
                <span className="text-pink-400">S-RANK</span>
              </div>

              {/* Pitch Display */}
              {karaoke.isRecording && (
                <div className="mt-4 pt-4 border-t border-red-500/30">
                  <div className="flex justify-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-green-300 font-bold mb-1">
                        YOUR NOTE
                      </p>
                      <p className="text-lg font-black text-green-400">
                        {karaoke.userNote}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-blue-300 font-bold mb-1">
                        TARGET
                      </p>
                      <p className="text-lg font-black text-blue-400">
                        {karaoke.targetNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demon Hunter Victory/Defeat Screen */}
      {isFinished && (
        <div className="absolute inset-0 bg-gradient-to-br from-black via-red-950/95 to-purple-950/95 backdrop-blur-xl flex items-center justify-center z-30">
          {/* Background character images */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute top-0 left-80 opacity-15 animate-pulse"
              style={{ animationDuration: "4s" }}
            >
              <img
                src="/images/demon.png"
                alt=""
                className="w-280 h-200 object-contain"
              />
            </div>
            <div
              className="absolute top-0 right-80 opacity-15 animate-pulse"
              style={{ animationDuration: "4s", animationDelay: "2s" }}
            >
              <img
                src="/images/demon.png"
                alt=""
                className="w-280 h-200 object-contain transform scale-x-[-1]"
              />
            </div>
          </div>

          <div className="text-center max-w-4xl px-8 relative z-10">
            {/* Rank announcement */}
            <div className="mb-8">
              <div className="relative inline-block mb-6">
                {/* Epic glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 rounded-3xl blur-3xl opacity-60 animate-pulse"></div>

                <h1 className="relative text-8xl font-black mb-4">
                  <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 blur-sm">
                    HUNT COMPLETE
                  </span>
                  <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-pink-400">
                    HUNT COMPLETE
                  </span>
                </h1>
              </div>

              {/* Combined Final Score Badge */}
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-purple-950 border-4 border-red-500/50 rounded-3xl px-16 py-10 shadow-2xl">
                  {/* Rank icon */}
                  <div className="mb-4">
                    {combinedScore > 80 ? (
                      <svg
                        className="w-24 h-24 mx-auto text-red-400"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ) : combinedScore > 60 ? (
                      <svg
                        className="w-24 h-24 mx-auto text-purple-400"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-24 h-24 mx-auto text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    )}
                  </div>

                  {/* Combined Score */}
                  <div className="text-9xl font-black mb-2">
                    <span
                      className={`bg-gradient-to-r ${
                        combinedScore > 80
                          ? "from-red-400 via-pink-400 to-red-400"
                          : combinedScore > 60
                          ? "from-purple-400 via-pink-400 to-purple-400"
                          : "from-gray-400 via-red-400 to-gray-400"
                      } bg-clip-text text-transparent`}
                    >
                      {combinedScore}%
                    </span>
                  </div>

                  {/* Individual Scores Breakdown */}
                  <div className="flex justify-center gap-8 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-purple-300 font-bold mb-1">
                        DANCE
                      </p>
                      <p className="text-3xl font-black text-purple-400">
                        {(finalScore * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-4xl text-red-500/50">+</div>
                    <div className="text-center">
                      <p className="text-sm text-pink-300 font-bold mb-1">
                        VOCAL
                      </p>
                      <p className="text-3xl font-black text-pink-400">
                        {karaoke.zoneScore ? karaoke.zoneScore.totalScore : 0}%
                      </p>
                    </div>
                  </div>

                  <div
                    className={`text-3xl font-black ${
                      combinedScore > 80
                        ? "text-red-400"
                        : combinedScore > 60
                        ? "text-purple-400"
                        : "text-gray-400"
                    }`}
                  >
                    {combinedScore > 80
                      ? "S-RANK HUNTER"
                      : combinedScore > 60
                      ? "A-RANK HUNTER"
                      : "TRAINEE HUNTER"}
                  </div>
                </div>
              </div>

              <p className="text-4xl text-white font-black mb-3">
                {combinedScore > 80
                  ? "LEGENDARY PERFORMANCE!"
                  : combinedScore > 60
                  ? "EXCELLENT TECHNIQUE!"
                  : "KEEP TRAINING!"}
              </p>

              <p className="text-xl text-red-200/80 mb-8 max-w-2xl mx-auto">
                {combinedScore > 80
                  ? "You've mastered both dance and vocals! Your movements are flawless and your voice is divine!"
                  : combinedScore > 60
                  ? "Strong performance, Hunter! A few more training sessions and you'll reach S-Rank!"
                  : "Every legend starts somewhere! Keep training and you'll become a master demon hunter!"}
              </p>
            </div>

            {/* Action buttons with demon hunter styling */}
            <div className="flex gap-6 justify-center">
              <button onClick={handleRetry} className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative px-12 py-5 rounded-xl bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 text-white font-black text-2xl hover:from-red-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-110 border-2 border-red-400/50">
                  <span className="flex items-center gap-3">
                    <svg
                      className="w-7 h-7"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>RETRY HUNT</span>
                  </span>
                </div>
              </button>

              <button onClick={onChangeVideo} className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative px-12 py-5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-black text-2xl hover:from-purple-500 hover:to-blue-500 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-110 border-2 border-purple-400/50">
                  <span className="flex items-center gap-3">
                    <svg
                      className="w-7 h-7"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span>NEW MISSION</span>
                  </span>
                </div>
              </button>
            </div>

            {/* Achievement unlocked message for S-Rank */}
            {combinedScore > 80 && (
              <div className="mt-8 inline-block">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl blur opacity-75 animate-pulse"></div>
                  <div className="relative bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black px-6 py-3 rounded-xl border-2 border-yellow-300 flex items-center gap-3">
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span>ACHIEVEMENT UNLOCKED: DEMON SLAYER</span>
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
