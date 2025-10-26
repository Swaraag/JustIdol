// Normalize landmarks to be scale and position invariant
export function normalizeLandmarks(landmarks: any[]) {
  if (!landmarks || landmarks.length === 0) return null;

  // Get bounding box
  const xs = landmarks.map((l) => l.x);
  const ys = landmarks.map((l) => l.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.max(width, height);

  // Normalize to [0, 1] range centered
  return landmarks.map((landmark) => ({
    x: (landmark.x - minX) / scale,
    y: (landmark.y - minY) / scale,
    z: landmark.z / scale,
    visibility: landmark.visibility,
  }));
}

// Calculate similarity between two pose landmarks with weighted scoring
export function calculateSimilarity(
  landmarks1: any[] | null,
  landmarks2: any[] | null,
): number {
  if (!landmarks1 || !landmarks2) return 0;

  // Define landmarks with weights (higher = more important)
  const landmarkWeights: { [key: number]: number } = {
    // TORSO - ZERO weight - completely ignored
    11: 0, // left shoulder
    12: 0, // right shoulder
    23: 0, // left hip
    24: 0, // right hip

    // ARMS - High weight (2.0x) - very important
    13: 2.0, // left elbow
    14: 2.0, // right elbow
    15: 2.5, // left wrist (even more important - end of limb)
    16: 2.5, // right wrist

    // LEGS - High weight (2.0x) - very important
    25: 2.0, // left knee
    26: 2.0, // right knee
    27: 2.5, // left ankle (even more important - end of limb)
    28: 2.5, // right ankle
  };

  let totalWeightedDistance = 0;
  let totalWeight = 0;

  Object.keys(landmarkWeights).forEach((idxStr) => {
    const idx = parseInt(idxStr);
    const weight = landmarkWeights[idx];

    if (landmarks1[idx] && landmarks2[idx]) {
      const dx = landmarks1[idx].x - landmarks2[idx].x;
      const dy = landmarks1[idx].y - landmarks2[idx].y;
      const dz = landmarks1[idx].z - landmarks2[idx].z;

      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Apply weight to this landmark's distance
      totalWeightedDistance += distance * weight;
      totalWeight += weight;
    }
  });

  if (totalWeight === 0) return 0;

  // Calculate weighted average distance
  const avgWeightedDistance = totalWeightedDistance / totalWeight;

  // Convert distance to similarity (0-1, where 1 is identical)
  const similarity = Math.max(0, 1 - avgWeightedDistance * 0.6);

  return similarity;
}

interface BodyAngles {
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
  leftKnee: number;
  rightKnee: number;
  leftHip: number;
  rightHip: number;
}

// Calculate angle-based similarity
export function calculateAngleSimilarity(
  landmarks1: any[] | null,
  landmarks2: any[] | null,
): number {
  if (!landmarks1 || !landmarks2) return 0;

  const angles1 = calculateBodyAngles(landmarks1);
  const angles2 = calculateBodyAngles(landmarks2);

  let totalDiff = 0;
  let count = 0;

  for (let key in angles1) {
    const typedKey = key as keyof BodyAngles;
    if (angles2[typedKey] !== undefined) {
      const diff = Math.abs(angles1[typedKey] - angles2[typedKey]);
      totalDiff += Math.min(diff, 360 - diff); // Handle angle wraparound
      count++;
    }
  }

  if (count === 0) return 0;

  const avgDiff = totalDiff / count;
  const similarity = Math.max(0, 1 - avgDiff / 180); // Normalize to 0-1

  return similarity;
}

function calculateBodyAngles(landmarks: any[]): BodyAngles {
  return {
    leftElbow: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
    rightElbow: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
    leftShoulder: calculateAngle(landmarks[13], landmarks[11], landmarks[23]),
    rightShoulder: calculateAngle(landmarks[14], landmarks[12], landmarks[24]),
    leftKnee: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
    rightKnee: calculateAngle(landmarks[24], landmarks[26], landmarks[28]),
    leftHip: calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
    rightHip: calculateAngle(landmarks[12], landmarks[24], landmarks[26]),
  };
}

function calculateAngle(a: any, b: any, c: any): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

// Enhanced similarity with movement penalty
export function calculateSimilarityWithMovement(
  currentLandmarks1: any[] | null,
  previousLandmarks1: any[] | null,
  currentLandmarks2: any[] | null,
  previousLandmarks2: any[] | null,
): number {
  if (!currentLandmarks1 || !currentLandmarks2) return 0;

  // Calculate base pose similarity
  const poseSimilarity = calculateSimilarity(
    currentLandmarks1,
    currentLandmarks2,
  );

  // If no previous frames, return base similarity
  if (!previousLandmarks1 || !previousLandmarks2) {
    return poseSimilarity;
  }

  // Check if reference is moving (any limb endpoint)
  const limbEndpoints = [13, 14, 15, 16, 25, 26, 27, 28]; // elbows, wrists, knees, ankles

  let referenceMovementDetected = false;
  let userMovementDetected = false;

  limbEndpoints.forEach((idx) => {
    if (currentLandmarks2[idx] && previousLandmarks2[idx]) {
      const refDelta = {
        x: currentLandmarks2[idx].x - previousLandmarks2[idx].x,
        y: currentLandmarks2[idx].y - previousLandmarks2[idx].y,
        z: currentLandmarks2[idx].z - previousLandmarks2[idx].z,
      };
      const refSpeed = Math.sqrt(
        refDelta.x ** 2 + refDelta.y ** 2 + refDelta.z ** 2,
      );

      if (refSpeed > 0.005) {
        // Movement threshold
        referenceMovementDetected = true;
      }
    }

    if (currentLandmarks1[idx] && previousLandmarks1[idx]) {
      const userDelta = {
        x: currentLandmarks1[idx].x - previousLandmarks1[idx].x,
        y: currentLandmarks1[idx].y - previousLandmarks1[idx].y,
        z: currentLandmarks1[idx].z - previousLandmarks1[idx].z,
      };
      const userSpeed = Math.sqrt(
        userDelta.x ** 2 + userDelta.y ** 2 + userDelta.z ** 2,
      );

      if (userSpeed > 0.005) {
        // Movement threshold
        userMovementDetected = true;
      }
    }
  });

  // Apply penalty if reference is moving but user is not
  let finalScore = poseSimilarity;

  if (referenceMovementDetected && !userMovementDetected) {
    // EXTREME PENALTY: User is frozen when they should be moving
    finalScore *= 0.05; // Reduce score by 95%!
  }

  return finalScore;
}