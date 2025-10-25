/**
 * Core type definitions for the Just Dance clone application
 */

// MediaPipe Pose Detection Types
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseLandmarks {
  landmarks: Landmark[];
  worldLandmarks?: Landmark[];
}

// Joint Angles
export interface JointAngles {
  // Arms
  left_elbow: number;
  right_elbow: number;
  left_shoulder: number;
  right_shoulder: number;
  left_armpit: number;
  right_armpit: number;
  left_arm_raise: number;
  right_arm_raise: number;

  // Legs
  left_knee: number;
  right_knee: number;
  left_hip: number;
  right_hip: number;

  // Body
  torso_lean: number;
  neck_tilt: number;
}

// Reference Pose Data
export interface PoseFrame {
  timestamp: number; // in milliseconds
  angles: JointAngles;
  landmarks?: Landmark[]; // Optional: store for debugging
}

export interface ReferenceData {
  videoId: string;
  duration: number; // in seconds
  sampledFps: number;
  poses: PoseFrame[];
  videoUrl?: string;
  title?: string;
  createdAt: string;
}

// Scoring
export type HitRating = 'PERFECT' | 'GREAT' | 'GOOD' | 'OK' | 'MISS';

export interface ScoreResult {
  similarity: number; // 0-1
  rating: HitRating;
  points: number;
  angleDifferences: Partial<Record<keyof JointAngles, number>>;
}

export interface GameState {
  score: number;
  streak: number;
  maxStreak: number;
  hits: Record<HitRating, number>;
  isPlaying: boolean;
  currentTime: number;
}

// Person Tracking & Validation
export interface ROIBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PersonValidation {
  isInROI: boolean;
  isCorrectPerson: boolean;
  isContinuous: boolean;
  bodySize: number;
  baselineSize?: number;
  warnings: string[];
}

// Video Processing
export interface ProcessingProgress {
  status: 'downloading' | 'extracting' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;
  message?: string;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  title?: string;
  thumbnail?: string;
}

// API Request/Response Types
export interface UploadVideoRequest {
  file: File;
}

export interface DownloadVideoRequest {
  url: string;
}

export interface ProcessVideoRequest {
  videoId: string;
  sampledFps?: number;
}

export interface VideoProcessResponse {
  success: boolean;
  videoId: string;
  referenceData?: ReferenceData;
  error?: string;
}

// MediaPipe Configuration
export interface MediaPipeConfig {
  modelComplexity: 0 | 1 | 2;
  enableSegmentation: boolean;
  smoothLandmarks: boolean;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

// Angle Comparison Configuration
export interface ComparisonConfig {
  angleTolerance: number; // degrees
  armWeight: number;
  legWeight: number;
  scoreCooldown: number; // milliseconds
  similarityThresholds: {
    perfect: number;
    great: number;
    good: number;
    ok: number;
  };
}

// Default configurations
export const DEFAULT_MEDIAPIPE_CONFIG: MediaPipeConfig = {
  modelComplexity: 1,
  enableSegmentation: true,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  angleTolerance: 30,
  armWeight: 1.5,
  legWeight: 1.5,
  scoreCooldown: 200,
  similarityThresholds: {
    perfect: 0.9,
    great: 0.8,
    good: 0.7,
    ok: 0.6,
  },
};

// MediaPipe Pose Landmark Indices
export enum PoseLandmark {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}
