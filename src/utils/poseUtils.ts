// ============================================================================
// SIMPLE BUT EFFECTIVE DANCE SIMILARITY ALGORITHM
// ============================================================================
//
// Design: 3 core components for dance scoring
// 1. Arm Pose Matching (50%): How well arm angles match
// 2. Movement Activity (40%): Are you moving when you should?
// 3. Visibility Check (10%): Is there a person in frame?
//
// Key Features:
// - Returns 0 if no person detected
// - Heavily penalizes standing still
// - Uses angles (not just positions) to avoid spatial ambiguity
// - Simple, fast, effective
// ============================================================================

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// ============================================================================
// NORMALIZATION
// ============================================================================

export function normalizeLandmarks(landmarks: any[]): Landmark[] | null {
  if (!landmarks || landmarks.length === 0) return null;

  const xs = landmarks.map((l: any) => l.x);
  const ys = landmarks.map((l: any) => l.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.max(width, height, 0.001);

  return landmarks.map((landmark: any) => ({
    x: (landmark.x - minX) / scale,
    y: (landmark.y - minY) / scale,
    z: landmark.z / scale,
    visibility: landmark.visibility || 1,
  }));
}

// ============================================================================
// POSE DETECTION
// ============================================================================

function isPoseDetected(landmarks: Landmark[]): boolean {
  if (!landmarks || landmarks.length === 0) return false;

  // Check key arm points (shoulders, elbows, wrists)
  const keyPoints = [11, 12, 13, 14, 15, 16];
  let visibleCount = 0;

  for (const idx of keyPoints) {
    if (landmarks[idx] && (landmarks[idx].visibility || 0) > 0.5) {
      visibleCount++;
    }
  }

  // Need at least 4 out of 6 arm points visible
  return visibleCount >= 4;
}

// ============================================================================
// ANGLE CALCULATIONS
// ============================================================================

function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

interface ArmAngles {
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
}

function getArmAngles(landmarks: Landmark[]): ArmAngles | null {
  // Check if all required landmarks exist
  const required = [11, 12, 13, 14, 15, 16, 23, 24];
  if (!required.every((idx) => landmarks[idx])) {
    return null;
  }

  return {
    leftElbow: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
    rightElbow: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
    leftShoulder: calculateAngle(landmarks[13], landmarks[11], landmarks[23]),
    rightShoulder: calculateAngle(landmarks[14], landmarks[12], landmarks[24]),
  };
}

function compareAngles(angles1: ArmAngles, angles2: ArmAngles): number {
  const leftElbowDiff = Math.abs(angles1.leftElbow - angles2.leftElbow);
  const rightElbowDiff = Math.abs(angles1.rightElbow - angles2.rightElbow);
  const leftShoulderDiff = Math.abs(angles1.leftShoulder - angles2.leftShoulder);
  const rightShoulderDiff = Math.abs(angles1.rightShoulder - angles2.rightShoulder);

  // Average angular difference
  const avgDiff = (leftElbowDiff + rightElbowDiff + leftShoulderDiff + rightShoulderDiff) / 4;

  // Convert to similarity score (0-1, where 0 deg diff = 1.0, 180 deg diff = 0.0)
  return Math.max(0, 1 - avgDiff / 180);
}

// ============================================================================
// MOVEMENT DETECTION
// ============================================================================

function calculateMovementIntensity(
  currentAngles: ArmAngles,
  previousAngles: ArmAngles | null
): number {
  if (!previousAngles) return 0;

  const leftElbowChange = Math.abs(currentAngles.leftElbow - previousAngles.leftElbow);
  const rightElbowChange = Math.abs(currentAngles.rightElbow - previousAngles.rightElbow);
  const leftShoulderChange = Math.abs(currentAngles.leftShoulder - previousAngles.leftShoulder);
  const rightShoulderChange = Math.abs(currentAngles.rightShoulder - previousAngles.rightShoulder);

  // Average angular velocity (degrees per frame)
  const avgChange = (leftElbowChange + rightElbowChange + leftShoulderChange + rightShoulderChange) / 4;

  // Normalize: 0-10 degrees/frame maps to 0-1
  return Math.min(avgChange / 10, 1.0);
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

export function calculateSimilarityWithMovement(
  currentLandmarks1: any[] | null,
  previousLandmarks1: any[] | null,
  currentLandmarks2: any[] | null,
  previousLandmarks2: any[] | null,
): number {
  // 1. Check if person is in frame
  if (!currentLandmarks1 || !currentLandmarks2) return 0;
  if (!isPoseDetected(currentLandmarks1)) return 0;

  // 2. Get arm angles for both user and reference
  const userAngles = getArmAngles(currentLandmarks1);
  const refAngles = getArmAngles(currentLandmarks2);

  if (!userAngles || !refAngles) return 0;

  // 3. Calculate pose similarity (how well angles match)
  const poseSimilarity = compareAngles(userAngles, refAngles);

  // 4. Calculate movement intensity
  let userMovement = 0;
  let refMovement = 0;

  if (previousLandmarks1 && previousLandmarks2) {
    const prevUserAngles = getArmAngles(previousLandmarks1);
    const prevRefAngles = getArmAngles(previousLandmarks2);

    if (prevUserAngles && prevRefAngles) {
      userMovement = calculateMovementIntensity(userAngles, prevUserAngles);
      refMovement = calculateMovementIntensity(refAngles, prevRefAngles);
    }
  }

  // 5. Movement synchrony score
  const movementDiff = Math.abs(userMovement - refMovement);
  const movementSynchrony = Math.max(0, 1 - movementDiff);

  // 6. PENALIZE if reference is moving but user is not
  let finalScore = poseSimilarity * 0.5 + movementSynchrony * 0.5;

  if (refMovement > 0.15 && userMovement < 0.05) {
    // Reference is dancing, user is frozen
    finalScore *= 0.2; // 80% penalty
  }

  // 7. PENALIZE if user is barely moving at all
  if (userMovement < 0.05) {
    finalScore *= 0.3; // 70% penalty for being too static
  }

  return Math.max(0, Math.min(1, finalScore));
}
