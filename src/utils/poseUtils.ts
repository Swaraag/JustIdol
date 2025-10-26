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

// Calculate similarity based on angles of limbs relative to torso
export function calculateSimilarity(
  landmarks1: any[] | null,
  landmarks2: any[] | null,
): number {
  if (!landmarks1 || !landmarks2) return 0;

  // Calculate angles of limbs relative to the torso
  const getLimbAngles = (landmarks: any[]) => {
    return {
      // Upper arms relative to torso
      leftUpperArm: calculateAngle(landmarks[23], landmarks[11], landmarks[13]),
      rightUpperArm: calculateAngle(
        landmarks[24],
        landmarks[12],
        landmarks[14],
      ),

      // Forearms (elbow angles)
      leftForearm: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
      rightForearm: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),

      // Upper legs relative to torso
      leftUpperLeg: calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
      rightUpperLeg: calculateAngle(
        landmarks[12],
        landmarks[24],
        landmarks[26],
      ),

      // Lower legs (knee angles)
      leftLowerLeg: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
      rightLowerLeg: calculateAngle(
        landmarks[24],
        landmarks[26],
        landmarks[28],
      ),
    };
  };

  const angles1 = getLimbAngles(landmarks1);
  const angles2 = getLimbAngles(landmarks2);

  let totalDiff = 0;
  let count = 0;

  for (let key in angles1) {
    const typedKey = key as keyof typeof angles1;
    if (
      angles2[typedKey] !== undefined &&
      !isNaN(angles1[typedKey]) &&
      !isNaN(angles2[typedKey])
    ) {
      let diff = Math.abs(angles1[typedKey] - angles2[typedKey]);
      diff = Math.min(diff, 360 - diff);
      totalDiff += diff;
      count++;
    }
  }

  if (count === 0) return 0;

  const avgDiff = totalDiff / count;
  const similarity = Math.max(0, 1 - avgDiff / 180);

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

// Calculate movement similarity tracking velocity and motion of limbs (excluding torso)
export function calculateMovementSimilarity(
  currentLandmarks1: any[] | null,
  previousLandmarks1: any[] | null,
  currentLandmarks2: any[] | null,
  previousLandmarks2: any[] | null,
): number {
  if (
    !currentLandmarks1 ||
    !previousLandmarks1 ||
    !currentLandmarks2 ||
    !previousLandmarks2
  ) {
    return 1; // No movement data, return neutral score
  }

  // Only track limb endpoints (EXCLUDE torso: shoulders 11,12 and hips 23,24)
  const limbEndpoints = [
    13,
    14, // elbows
    15,
    16, // wrists
    25,
    26, // knees
    27,
    28, // ankles
  ];

  let totalVelocitySimilarity = 0;
  let count = 0;

  limbEndpoints.forEach((idx) => {
    if (
      currentLandmarks1[idx] &&
      previousLandmarks1[idx] &&
      currentLandmarks2[idx] &&
      previousLandmarks2[idx]
    ) {
      // Calculate velocity vector for user's limb
      const velocity1 = {
        x: currentLandmarks1[idx].x - previousLandmarks1[idx].x,
        y: currentLandmarks1[idx].y - previousLandmarks1[idx].y,
        z: currentLandmarks1[idx].z - previousLandmarks1[idx].z,
      };

      // Calculate velocity vector for reference limb
      const velocity2 = {
        x: currentLandmarks2[idx].x - previousLandmarks2[idx].x,
        y: currentLandmarks2[idx].y - previousLandmarks2[idx].y,
        z: currentLandmarks2[idx].z - previousLandmarks2[idx].z,
      };

      // Calculate velocity magnitudes (speed)
      const speed1 = Math.sqrt(
        velocity1.x ** 2 + velocity1.y ** 2 + velocity1.z ** 2,
      );
      const speed2 = Math.sqrt(
        velocity2.x ** 2 + velocity2.y ** 2 + velocity2.z ** 2,
      );

      // If both limbs are moving
      if (speed1 > 0.001 && speed2 > 0.001) {
        // Calculate directional similarity using dot product (cosine similarity)
        const dotProduct =
          (velocity1.x * velocity2.x +
            velocity1.y * velocity2.y +
            velocity1.z * velocity2.z) /
          (speed1 * speed2);
        const directionSimilarity = (dotProduct + 1) / 2; // Normalize [-1,1] to [0,1]

        // Calculate speed similarity
        const speedRatio = Math.min(speed1, speed2) / Math.max(speed1, speed2);

        // Combine: direction (80%) is more important than exact speed (20%)
        const velocitySimilarity = directionSimilarity * 0.8 + speedRatio * 0.2;
        totalVelocitySimilarity += velocitySimilarity;
        count++;
      }
      // If both limbs are stationary (both not moving = perfect match)
      else if (speed1 <= 0.001 && speed2 <= 0.001) {
        totalVelocitySimilarity += 1.0;
        count++;
      }
      // If one is moving and the other isn't (penalty)
      else {
        const maxSpeed = Math.max(speed1, speed2);
        // Heavy penalty for mismatched motion state
        const penalty = Math.max(0, 1 - maxSpeed * 15);
        totalVelocitySimilarity += penalty;
        count++;
      }
    }
  });

  if (count === 0) return 1;

  return totalVelocitySimilarity / count;
}

// Combined similarity: pose angles + limb velocity (excluding torso motion)
export function calculateCombinedSimilarity(
  currentWebcamLandmarks: any[] | null,
  previousWebcamLandmarks: any[] | null,
  currentReferenceLandmarks: any[] | null,
  previousReferenceLandmarks: any[] | null,
): number {
  // Calculate static pose similarity (limb angles relative to torso)
  const poseSimilarity = calculateSimilarity(
    currentWebcamLandmarks,
    currentReferenceLandmarks,
  );

  // Calculate movement similarity (limb velocity, excluding torso)
  const movementSimilarity = calculateMovementSimilarity(
    currentWebcamLandmarks,
    previousWebcamLandmarks,
    currentReferenceLandmarks,
    previousReferenceLandmarks,
  );

  // Combine both scores (50% pose positioning, 50% limb motion)
  const combinedScore = poseSimilarity * 0.5 + movementSimilarity * 0.5;

  return combinedScore;
}
