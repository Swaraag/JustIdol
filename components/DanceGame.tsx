/**
 * Dance Game Component
 * Main game logic with MediaPipe pose detection and real-time scoring
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { ReferenceData, GameState, HitRating, Landmark } from '@/lib/types';
import { calculateJointAngles } from '@/lib/angleCalculator';
import { comparePoses, ScoreCooldown, findClosestPose, calculateStreakMultiplier } from '@/lib/poseComparator';
import { PersonValidator } from '@/lib/personTracker';
import PoseCanvas from './PoseCanvas';
import ScoreDisplay from './ScoreDisplay';
import ROIOverlay from './ROIOverlay';

interface DanceGameProps {
  referenceData: ReferenceData;
  videoUrl: string;
}

type GamePhase = 'loading' | 'calibration' | 'countdown' | 'playing' | 'finished';

export default function DanceGame({ referenceData, videoUrl }: DanceGameProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>();
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const personValidatorRef = useRef<PersonValidator | null>(null);
  const scoreCooldownRef = useRef<ScoreCooldown>(new ScoreCooldown(200));

  // State
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [countdown, setCountdown] = useState(3);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    maxStreak: 0,
    hits: { PERFECT: 0, GREAT: 0, GOOD: 0, OK: 0, MISS: 0 },
    isPlaying: false,
    currentTime: 0,
  });
  const [currentLandmarks, setCurrentLandmarks] = useState<Landmark[] | null>(null);
  const [lastRating, setLastRating] = useState<HitRating | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video dimensions
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });

  // Initialize MediaPipe
  useEffect(() => {
    let mounted = true;

    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (mounted) {
          poseLandmarkerRef.current = poseLandmarker;
          setPhase('calibration');
        }
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        if (mounted) {
          setError('Failed to initialize pose detection');
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
    if (phase !== 'calibration') return;

    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;

          webcamRef.current.onloadedmetadata = () => {
            const width = webcamRef.current!.videoWidth;
            const height = webcamRef.current!.videoHeight;
            setVideoDimensions({ width, height });

            // Initialize person validator
            personValidatorRef.current = new PersonValidator(width, height);

            // Start calibration countdown
            setPhase('countdown');
          };
        }
      } catch (err) {
        console.error('Webcam error:', err);
        setError('Failed to access webcam. Please grant camera permissions.');
      }
    }

    startWebcam();
  }, [phase]);

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Start game
  const startGame = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setPhase('playing');
      setGameState((prev) => ({ ...prev, isPlaying: true }));
      processWebcam();
    }
  }, []);

  // Process webcam frames
  const processWebcam = useCallback(() => {
    if (!webcamRef.current || !poseLandmarkerRef.current || !videoRef.current) return;

    const processFrame = () => {
      if (phase !== 'playing' || !webcamRef.current || !poseLandmarkerRef.current) return;

      const currentTime = (videoRef.current?.currentTime || 0) * 1000; // Convert to ms

      // Detect pose
      const results = poseLandmarkerRef.current.detectForVideo(
        webcamRef.current,
        performance.now()
      );

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0] as Landmark[];
        setCurrentLandmarks(landmarks);

        // Validate person
        const validation = personValidatorRef.current?.validate(landmarks);

        // Only score if validation passes and cooldown allows
        if (
          validation?.isInROI &&
          validation?.isCorrectPerson &&
          validation?.isContinuous &&
          scoreCooldownRef.current.canScore()
        ) {
          scoreMove(landmarks, currentTime);
        }
      }

      // Check if video ended
      if (videoRef.current && videoRef.current.ended) {
        setPhase('finished');
        setGameState((prev) => ({ ...prev, isPlaying: false }));
        return;
      }

      // Update current time
      setGameState((prev) => ({ ...prev, currentTime }));

      // Continue processing
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  }, [phase]);

  // Score the current move
  const scoreMove = useCallback((landmarks: Landmark[], currentTime: number) => {
    try {
      // Calculate user angles
      const userAngles = calculateJointAngles(landmarks);

      // Find closest reference pose
      const closestIdx = findClosestPose(referenceData.poses, currentTime, 200);
      if (closestIdx === -1) return;

      const referencePose = referenceData.poses[closestIdx];

      // Compare poses
      const result = comparePoses(userAngles, referencePose.angles);

      // Update score
      const multiplier = calculateStreakMultiplier(gameState.streak);
      const points = Math.round(result.points * multiplier);

      setGameState((prev) => {
        const newStreak = result.rating !== 'MISS' ? prev.streak + 1 : 0;
        return {
          ...prev,
          score: prev.score + points,
          streak: newStreak,
          maxStreak: Math.max(prev.maxStreak, newStreak),
          hits: {
            ...prev.hits,
            [result.rating]: prev.hits[result.rating] + 1,
          },
        };
      });

      // Show feedback
      setLastRating(result.rating);
      setShowRating(true);
      setTimeout(() => setShowRating(false), 600);

      // Record score for cooldown
      scoreCooldownRef.current.recordScore();
    } catch (err) {
      console.error('Scoring error:', err);
    }
  }, [referenceData, gameState.streak]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (webcamRef.current && webcamRef.current.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Get ROI bounds
  const roiBounds = personValidatorRef.current?.getROIPixelBounds() || {
    x: 0,
    y: 0,
    width: videoDimensions.width,
    height: videoDimensions.height,
  };

  // Validation state
  const validation = currentLandmarks
    ? personValidatorRef.current?.validate(currentLandmarks) || null
    : null;

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-black">
      {/* Error State */}
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="rounded-3xl border border-red-400 bg-red-500/20 p-8 text-center backdrop-blur-md">
            <div className="mb-4 text-6xl">⚠️</div>
            <h2 className="mb-2 text-2xl font-bold text-red-200">Error</h2>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div className="mb-4 text-6xl">⏳</div>
            <p className="text-2xl font-bold text-white">Loading pose detection...</p>
          </div>
        </div>
      )}

      {/* Countdown */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4 text-9xl font-black text-white drop-shadow-2xl">
              {countdown}
            </div>
            <p className="text-2xl text-white">Get ready to dance!</p>
          </div>
        </div>
      )}

      {/* Finished State */}
      {phase === 'finished' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900/95 via-blue-900/95 to-pink-900/95 backdrop-blur-sm">
          <div className="rounded-3xl border border-white/30 bg-white/10 p-12 text-center backdrop-blur-md">
            <div className="mb-4 text-6xl">🎉</div>
            <h2 className="mb-6 text-5xl font-bold text-white">Great Job!</h2>
            <div className="mb-8 space-y-4">
              <div>
                <div className="text-gray-300">Final Score</div>
                <div className="text-6xl font-bold text-yellow-400">
                  {gameState.score.toLocaleString()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 text-left">
                <div>
                  <div className="text-gray-300">Max Streak</div>
                  <div className="text-3xl font-bold text-white">{gameState.maxStreak}</div>
                </div>
                <div>
                  <div className="text-gray-300">Perfect Hits</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {gameState.hits.PERFECT}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 text-xl font-bold text-white transition-all hover:scale-105"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Dance Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="h-auto w-1/2 object-contain"
        muted
      />

      {/* Webcam + Overlay */}
      <div className="relative h-full w-1/2">
        <video
          ref={webcamRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }} // Mirror webcam
        />

        {/* Pose Overlay */}
        {currentLandmarks && (
          <PoseCanvas
            landmarks={currentLandmarks}
            canvasWidth={videoDimensions.width}
            canvasHeight={videoDimensions.height}
          />
        )}

        {/* ROI Overlay */}
        {phase === 'calibration' || phase === 'countdown' || phase === 'playing' ? (
          <ROIOverlay
            roiBounds={roiBounds}
            validation={validation}
            canvasWidth={videoDimensions.width}
            canvasHeight={videoDimensions.height}
          />
        ) : null}
      </div>

      {/* Score Display */}
      {phase === 'playing' && (
        <ScoreDisplay gameState={gameState} lastRating={lastRating} showRating={showRating} />
      )}
    </div>
  );
}
