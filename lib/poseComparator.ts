/**
 * Pose comparison and scoring utilities
 * Compares user pose against reference poses in real-time
 */

import { JointAngles, ScoreResult, HitRating, ComparisonConfig, DEFAULT_COMPARISON_CONFIG } from './types';

/**
 * Calculate angular difference between two angles
 * @param angle1 - First angle in degrees
 * @param angle2 - Second angle in degrees
 * @returns Absolute difference in degrees (0-180)
 */
export function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2);
  // Handle wrap-around (e.g., 5° and 355° should be 10° apart, not 350°)
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Compare two sets of joint angles and calculate similarity score
 * @param userAngles - User's current joint angles
 * @param referenceAngles - Reference pose joint angles
 * @param config - Comparison configuration
 * @returns Score result with similarity, rating, and points
 */
export function comparePoses(
  userAngles: JointAngles,
  referenceAngles: JointAngles,
  config: ComparisonConfig = DEFAULT_COMPARISON_CONFIG
): ScoreResult {
  const angleDiffs: Partial<Record<keyof JointAngles, number>> = {};
  const weights: Partial<Record<keyof JointAngles, number>> = {};

  // Define weights for each angle
  const angleWeights: Record<keyof JointAngles, number> = {
    // Arms (weighted higher)
    left_elbow: config.armWeight,
    right_elbow: config.armWeight,
    left_shoulder: config.armWeight,
    right_shoulder: config.armWeight,
    left_armpit: config.armWeight * 0.8,
    right_armpit: config.armWeight * 0.8,
    left_arm_raise: config.armWeight * 1.2,
    right_arm_raise: config.armWeight * 1.2,

    // Legs (weighted higher)
    left_knee: config.legWeight,
    right_knee: config.legWeight,
    left_hip: config.legWeight,
    right_hip: config.legWeight,

    // Body (normal weight)
    torso_lean: 1.0,
    neck_tilt: 0.7,
  };

  let totalWeightedDiff = 0;
  let totalWeight = 0;

  // Calculate weighted differences for each angle
  for (const key in userAngles) {
    const angleKey = key as keyof JointAngles;
    const userAngle = userAngles[angleKey];
    const refAngle = referenceAngles[angleKey];
    const weight = angleWeights[angleKey];

    const diff = angleDifference(userAngle, refAngle);
    angleDiffs[angleKey] = diff;
    weights[angleKey] = weight;

    // Normalize difference to 0-1 scale (0 = perfect match, 1 = max tolerance)
    const normalizedDiff = Math.min(diff / config.angleTolerance, 1);

    totalWeightedDiff += normalizedDiff * weight;
    totalWeight += weight;
  }

  // Calculate similarity (0-1, where 1 is perfect match)
  const similarity = 1 - (totalWeightedDiff / totalWeight);

  // Determine rating and points based on similarity
  const { rating, points } = getRatingAndPoints(similarity, config);

  return {
    similarity,
    rating,
    points,
    angleDifferences: angleDiffs,
  };
}

/**
 * Get rating and points based on similarity score
 */
function getRatingAndPoints(
  similarity: number,
  config: ComparisonConfig
): { rating: HitRating; points: number } {
  const thresholds = config.similarityThresholds;

  if (similarity >= thresholds.perfect) {
    return { rating: 'PERFECT', points: 100 };
  } else if (similarity >= thresholds.great) {
    return { rating: 'GREAT', points: 80 };
  } else if (similarity >= thresholds.good) {
    return { rating: 'GOOD', points: 60 };
  } else if (similarity >= thresholds.ok) {
    return { rating: 'OK', points: 40 };
  } else {
    return { rating: 'MISS', points: 0 };
  }
}

/**
 * Find the closest reference pose by timestamp
 * Uses binary search for efficiency
 * @param referencePoses - Array of reference poses (must be sorted by timestamp)
 * @param currentTime - Current video time in milliseconds
 * @param lookAheadWindow - How far ahead to look (ms) for smoother matching
 * @returns Index of closest pose, or -1 if not found
 */
export function findClosestPose(
  referencePoses: Array<{ timestamp: number }>,
  currentTime: number,
  lookAheadWindow: number = 200
): number {
  if (referencePoses.length === 0) return -1;

  // Adjust current time to look slightly ahead
  const adjustedTime = currentTime + lookAheadWindow;

  // Binary search for closest timestamp
  let left = 0;
  let right = referencePoses.length - 1;
  let closestIndex = 0;
  let closestDiff = Math.abs(referencePoses[0].timestamp - adjustedTime);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const diff = Math.abs(referencePoses[mid].timestamp - adjustedTime);

    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = mid;
    }

    if (referencePoses[mid].timestamp < adjustedTime) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return closestIndex;
}

/**
 * Calculate streak multiplier
 * @param streak - Current streak count
 * @returns Multiplier (1x, 1.5x, 2x, etc.)
 */
export function calculateStreakMultiplier(streak: number): number {
  if (streak < 5) return 1.0;
  if (streak < 10) return 1.5;
  if (streak < 20) return 2.0;
  if (streak < 50) return 2.5;
  return 3.0;
}

/**
 * Cooldown manager for scoring
 * Prevents score spam by enforcing minimum time between scores
 */
export class ScoreCooldown {
  private lastScoreTime: number = 0;
  private cooldownMs: number;

  constructor(cooldownMs: number = 200) {
    this.cooldownMs = cooldownMs;
  }

  /**
   * Check if scoring is allowed (not in cooldown)
   */
  canScore(): boolean {
    const now = Date.now();
    return now - this.lastScoreTime >= this.cooldownMs;
  }

  /**
   * Mark that a score was just recorded
   */
  recordScore(): void {
    this.lastScoreTime = Date.now();
  }

  /**
   * Reset cooldown
   */
  reset(): void {
    this.lastScoreTime = 0;
  }

  /**
   * Get time remaining in cooldown (ms)
   */
  getTimeRemaining(): number {
    const now = Date.now();
    const elapsed = now - this.lastScoreTime;
    return Math.max(0, this.cooldownMs - elapsed);
  }
}

/**
 * Calculate overall accuracy percentage
 * @param hits - Record of hit counts by rating
 * @returns Accuracy percentage (0-100)
 */
export function calculateAccuracy(hits: Record<HitRating, number>): number {
  const total = Object.values(hits).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;

  const weighted =
    hits.PERFECT * 1.0 +
    hits.GREAT * 0.8 +
    hits.GOOD * 0.6 +
    hits.OK * 0.4 +
    hits.MISS * 0;

  return (weighted / total) * 100;
}

/**
 * Get color for rating (for UI display)
 */
export function getRatingColor(rating: HitRating): string {
  switch (rating) {
    case 'PERFECT':
      return '#FFD700'; // Gold
    case 'GREAT':
      return '#00FF00'; // Green
    case 'GOOD':
      return '#00BFFF'; // Blue
    case 'OK':
      return '#FFA500'; // Orange
    case 'MISS':
      return '#FF0000'; // Red
  }
}

/**
 * Calculate expected score for a perfect run
 * Useful for showing potential max score
 */
export function calculateMaxPossibleScore(totalPoses: number): number {
  return totalPoses * 100; // Assuming all PERFECT hits
}
