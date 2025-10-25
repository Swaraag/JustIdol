/**
 * Angle calculation utilities for pose comparison
 * Calculates joint angles from MediaPipe landmarks
 */

import { Landmark, JointAngles, PoseLandmark } from './types';

/**
 * Calculate angle between three 3D points
 * @param p1 - First point
 * @param p2 - Vertex point (middle)
 * @param p3 - Third point
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle3D(p1: Landmark, p2: Landmark, p3: Landmark): number {
  // Create vectors from vertex
  const v1 = {
    x: p1.x - p2.x,
    y: p1.y - p2.y,
    z: p1.z - p2.z,
  };

  const v2 = {
    x: p3.x - p2.x,
    y: p3.y - p2.y,
    z: p3.z - p2.z,
  };

  // Calculate dot product
  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

  // Calculate magnitudes
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  // Avoid division by zero
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  // Calculate angle using arccos
  const cosAngle = dotProduct / (mag1 * mag2);

  // Clamp to [-1, 1] to avoid NaN from floating point errors
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));

  // Convert to degrees
  const angleRad = Math.acos(clampedCos);
  const angleDeg = (angleRad * 180) / Math.PI;

  return angleDeg;
}

/**
 * Calculate 2D angle (ignoring z-axis) between three points
 * Useful as fallback when depth data is unreliable
 */
export function calculateAngle2D(p1: Landmark, p2: Landmark, p3: Landmark): number {
  const v1 = {
    x: p1.x - p2.x,
    y: p1.y - p2.y,
  };

  const v2 = {
    x: p3.x - p2.x,
    y: p3.y - p2.y,
  };

  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  const cosAngle = dotProduct / (mag1 * mag2);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  const angleRad = Math.acos(clampedCos);
  const angleDeg = (angleRad * 180) / Math.PI;

  return angleDeg;
}

/**
 * Calculate all joint angles from pose landmarks
 * @param landmarks - Array of 33 MediaPipe pose landmarks
 * @returns Object containing all calculated joint angles
 */
export function calculateJointAngles(landmarks: Landmark[]): JointAngles {
  if (landmarks.length !== 33) {
    throw new Error(`Expected 33 landmarks, got ${landmarks.length}`);
  }

  return {
    // Left arm angles
    left_elbow: calculateAngle3D(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.LEFT_ELBOW],
      landmarks[PoseLandmark.LEFT_WRIST]
    ),

    // Right arm angles
    right_elbow: calculateAngle3D(
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_ELBOW],
      landmarks[PoseLandmark.RIGHT_WRIST]
    ),

    // Left shoulder angle (shoulder-elbow-wrist from body perspective)
    left_shoulder: calculateAngle3D(
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.LEFT_ELBOW]
    ),

    // Right shoulder angle
    right_shoulder: calculateAngle3D(
      landmarks[PoseLandmark.RIGHT_HIP],
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_ELBOW]
    ),

    // Left armpit angle (elbow-shoulder-hip)
    left_armpit: calculateAngle3D(
      landmarks[PoseLandmark.LEFT_ELBOW],
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.LEFT_HIP]
    ),

    // Right armpit angle
    right_armpit: calculateAngle3D(
      landmarks[PoseLandmark.RIGHT_ELBOW],
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_HIP]
    ),

    // Left arm raise (how high arm is raised)
    // Using shoulder-shoulder midpoint to shoulder-elbow angle
    left_arm_raise: calculateArmRaise(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.LEFT_ELBOW]
    ),

    // Right arm raise
    right_arm_raise: calculateArmRaise(
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_ELBOW]
    ),

    // Left knee angle
    left_knee: calculateAngle3D(
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.LEFT_KNEE],
      landmarks[PoseLandmark.LEFT_ANKLE]
    ),

    // Right knee angle
    right_knee: calculateAngle3D(
      landmarks[PoseLandmark.RIGHT_HIP],
      landmarks[PoseLandmark.RIGHT_KNEE],
      landmarks[PoseLandmark.RIGHT_ANKLE]
    ),

    // Left hip angle
    left_hip: calculateAngle3D(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.LEFT_KNEE]
    ),

    // Right hip angle
    right_hip: calculateAngle3D(
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_HIP],
      landmarks[PoseLandmark.RIGHT_KNEE]
    ),

    // Torso lean (how much body is leaning forward/back)
    torso_lean: calculateTorsoLean(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.RIGHT_HIP]
    ),

    // Neck tilt
    neck_tilt: calculateAngle3D(
      landmarks[PoseLandmark.NOSE],
      getMidpoint(
        landmarks[PoseLandmark.LEFT_SHOULDER],
        landmarks[PoseLandmark.RIGHT_SHOULDER]
      ),
      getMidpoint(
        landmarks[PoseLandmark.LEFT_HIP],
        landmarks[PoseLandmark.RIGHT_HIP]
      )
    ),
  };
}

/**
 * Calculate arm raise angle relative to horizontal
 */
function calculateArmRaise(shoulder: Landmark, otherShoulder: Landmark, elbow: Landmark): number {
  // Create a horizontal reference point at shoulder level
  const horizontalRef: Landmark = {
    x: shoulder.x + 0.1, // Point to the side
    y: shoulder.y,       // Same height
    z: shoulder.z,
  };

  return calculateAngle3D(horizontalRef, shoulder, elbow);
}

/**
 * Calculate torso lean using shoulder and hip midpoints
 */
function calculateTorsoLean(
  leftShoulder: Landmark,
  rightShoulder: Landmark,
  leftHip: Landmark,
  rightHip: Landmark
): number {
  const shoulderMid = getMidpoint(leftShoulder, rightShoulder);
  const hipMid = getMidpoint(leftHip, rightHip);

  // Create vertical reference point below shoulder
  const verticalRef: Landmark = {
    x: shoulderMid.x,
    y: shoulderMid.y + 0.1,
    z: shoulderMid.z,
  };

  return calculateAngle3D(verticalRef, shoulderMid, hipMid);
}

/**
 * Calculate midpoint between two landmarks
 */
function getMidpoint(p1: Landmark, p2: Landmark): Landmark {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
    visibility: Math.min(p1.visibility ?? 1, p2.visibility ?? 1),
  };
}

/**
 * Validate that landmarks have sufficient visibility
 * @param landmarks - Array of landmarks
 * @param minVisibility - Minimum visibility threshold (0-1)
 * @returns true if enough landmarks are visible
 */
export function validateLandmarkVisibility(
  landmarks: Landmark[],
  minVisibility: number = 0.5
): boolean {
  const visibleCount = landmarks.filter(
    (lm) => (lm.visibility ?? 1) >= minVisibility
  ).length;

  // Require at least 70% of landmarks to be visible
  return visibleCount >= landmarks.length * 0.7;
}

/**
 * Normalize angle to 0-180 range
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  if (normalized > 180) normalized = 360 - normalized;
  return normalized;
}
