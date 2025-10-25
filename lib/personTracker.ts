/**
 * Person tracking and validation utilities
 * Ensures the correct person is being tracked and filters background people
 */

import { Landmark, PersonValidation, ROIBounds, PoseLandmark } from './types';

/**
 * Region of Interest (ROI) manager
 * Ensures user stays in the center region for proper tracking
 */
export class ROIManager {
  private bounds: ROIBounds;
  private frameWidth: number;
  private frameHeight: number;

  constructor(frameWidth: number, frameHeight: number, roiPercentage: number = 0.7) {
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;

    // Calculate ROI bounds (centered region)
    const margin = (1 - roiPercentage) / 2;
    this.bounds = {
      xMin: margin,
      xMax: 1 - margin,
      yMin: margin * 0.5, // Less strict on vertical
      yMax: 1 - margin * 0.5,
    };
  }

  /**
   * Check if key body parts are within ROI
   */
  isInROI(landmarks: Landmark[]): boolean {
    // Check shoulders and hips (core body parts)
    const keyPoints = [
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.RIGHT_HIP],
    ];

    // All key points must be in ROI
    return keyPoints.every((point) => {
      return (
        point.x >= this.bounds.xMin &&
        point.x <= this.bounds.xMax &&
        point.y >= this.bounds.yMin &&
        point.y <= this.bounds.yMax
      );
    });
  }

  /**
   * Get ROI bounds for rendering overlay
   */
  getBounds(): ROIBounds {
    return { ...this.bounds };
  }

  /**
   * Get pixel coordinates of ROI bounds
   */
  getPixelBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.bounds.xMin * this.frameWidth,
      y: this.bounds.yMin * this.frameHeight,
      width: (this.bounds.xMax - this.bounds.xMin) * this.frameWidth,
      height: (this.bounds.yMax - this.bounds.yMin) * this.frameHeight,
    };
  }
}

/**
 * Person continuity tracker
 * Detects when a different person enters the frame
 */
export class ContinuityTracker {
  private previousLandmarks: Landmark[] | null = null;
  private failedFrames: number = 0;
  private readonly maxFailedFrames: number = 30; // ~1 second at 30 fps
  private readonly maxJumpThreshold: number = 0.3; // 30% of frame

  /**
   * Check if current pose is continuous with previous
   * Detects sudden jumps that indicate person switching
   */
  isContinuous(landmarks: Landmark[]): boolean {
    if (!this.previousLandmarks) {
      this.previousLandmarks = landmarks;
      return true;
    }

    // Calculate average movement of key points
    const keyIndices = [
      PoseLandmark.NOSE,
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
    ];

    let totalMovement = 0;
    for (const idx of keyIndices) {
      const prev = this.previousLandmarks[idx];
      const curr = landmarks[idx];

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const movement = Math.sqrt(dx * dx + dy * dy);
      totalMovement += movement;
    }

    const avgMovement = totalMovement / keyIndices.length;

    // If movement is too large, person likely switched
    if (avgMovement > this.maxJumpThreshold) {
      this.failedFrames++;
      if (this.failedFrames >= this.maxFailedFrames) {
        // Too many failed frames, reset tracking
        this.reset();
        return false;
      }
      return false;
    }

    // Movement is reasonable, update tracking
    this.previousLandmarks = landmarks;
    this.failedFrames = 0;
    return true;
  }

  /**
   * Reset tracker (call when starting new tracking session)
   */
  reset(): void {
    this.previousLandmarks = null;
    this.failedFrames = 0;
  }

  /**
   * Get number of consecutive failed frames
   */
  getFailedFrameCount(): number {
    return this.failedFrames;
  }
}

/**
 * Body size tracker
 * Ensures the same person stays in frame (prevents swapping)
 */
export class BodySizeTracker {
  private baselineSize: number | null = null;
  private readonly sizeTolerancePercent: number = 0.25; // 25% variation allowed

  /**
   * Calculate body size metric (shoulder-to-hip distance)
   */
  private calculateBodySize(landmarks: Landmark[]): number {
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const leftHip = landmarks[PoseLandmark.LEFT_HIP];
    const rightHip = landmarks[PoseLandmark.RIGHT_HIP];

    // Calculate shoulder width
    const shoulderWidth = Math.sqrt(
      Math.pow(rightShoulder.x - leftShoulder.x, 2) +
      Math.pow(rightShoulder.y - leftShoulder.y, 2) +
      Math.pow(rightShoulder.z - leftShoulder.z, 2)
    );

    // Calculate hip width
    const hipWidth = Math.sqrt(
      Math.pow(rightHip.x - leftHip.x, 2) +
      Math.pow(rightHip.y - leftHip.y, 2) +
      Math.pow(rightHip.z - leftHip.z, 2)
    );

    // Calculate torso height
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipMidY = (leftHip.y + rightHip.y) / 2;
    const torsoHeight = Math.abs(shoulderMidY - hipMidY);

    // Combined metric
    return shoulderWidth + hipWidth + torsoHeight;
  }

  /**
   * Set baseline size from calibration pose
   */
  setBaseline(landmarks: Landmark[]): void {
    this.baselineSize = this.calculateBodySize(landmarks);
  }

  /**
   * Check if current body size matches baseline
   */
  matchesBaseline(landmarks: Landmark[]): boolean {
    if (!this.baselineSize) {
      // No baseline set, establish it now
      this.setBaseline(landmarks);
      return true;
    }

    const currentSize = this.calculateBodySize(landmarks);
    const diff = Math.abs(currentSize - this.baselineSize);
    const tolerance = this.baselineSize * this.sizeTolerancePercent;

    return diff <= tolerance;
  }

  /**
   * Get current body size
   */
  getCurrentSize(landmarks: Landmark[]): number {
    return this.calculateBodySize(landmarks);
  }

  /**
   * Get baseline size
   */
  getBaseline(): number | null {
    return this.baselineSize;
  }

  /**
   * Reset baseline
   */
  reset(): void {
    this.baselineSize = null;
  }
}

/**
 * Complete person validation system
 * Combines all tracking methods
 */
export class PersonValidator {
  private roiManager: ROIManager;
  private continuityTracker: ContinuityTracker;
  private bodySizeTracker: BodySizeTracker;

  constructor(frameWidth: number, frameHeight: number) {
    this.roiManager = new ROIManager(frameWidth, frameHeight);
    this.continuityTracker = new ContinuityTracker();
    this.bodySizeTracker = new BodySizeTracker();
  }

  /**
   * Validate person in current frame
   */
  validate(landmarks: Landmark[]): PersonValidation {
    const warnings: string[] = [];

    // Check ROI
    const isInROI = this.roiManager.isInROI(landmarks);
    if (!isInROI) {
      warnings.push('Move to the center of the frame');
    }

    // Check continuity
    const isContinuous = this.continuityTracker.isContinuous(landmarks);
    if (!isContinuous) {
      warnings.push('Person switched - stay in frame');
    }

    // Check body size
    const matchesSize = this.bodySizeTracker.matchesBaseline(landmarks);
    if (!matchesSize) {
      warnings.push('Stay at consistent distance from camera');
    }

    return {
      isInROI,
      isCorrectPerson: matchesSize,
      isContinuous,
      bodySize: this.bodySizeTracker.getCurrentSize(landmarks),
      baselineSize: this.bodySizeTracker.getBaseline() ?? undefined,
      warnings,
    };
  }

  /**
   * Calibrate with initial pose
   */
  calibrate(landmarks: Landmark[]): void {
    this.bodySizeTracker.setBaseline(landmarks);
    this.continuityTracker.reset();
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.continuityTracker.reset();
    this.bodySizeTracker.reset();
  }

  /**
   * Get ROI bounds for UI overlay
   */
  getROIBounds(): ROIBounds {
    return this.roiManager.getBounds();
  }

  /**
   * Get ROI pixel bounds for canvas rendering
   */
  getROIPixelBounds(): { x: number; y: number; width: number; height: number } {
    return this.roiManager.getPixelBounds();
  }
}

/**
 * Calculate pose confidence score
 * Based on landmark visibility
 */
export function calculatePoseConfidence(landmarks: Landmark[]): number {
  const visibilityScores = landmarks
    .map((lm) => lm.visibility ?? 1)
    .filter((v) => v > 0);

  if (visibilityScores.length === 0) return 0;

  const avgVisibility = visibilityScores.reduce((a, b) => a + b, 0) / visibilityScores.length;
  return avgVisibility;
}
