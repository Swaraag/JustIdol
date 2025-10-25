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

// Calculate similarity between two pose landmarks
export function calculateSimilarity(
  landmarks1: any[] | null,
  landmarks2: any[] | null,
): number {
  if (!landmarks1 || !landmarks2) return 0;

  // Use important body keypoints (exclude face landmarks for better body focus)
  const importantIndices = [
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
  ];

  let totalDistance = 0;
  let count = 0;

  importantIndices.forEach((idx) => {
    if (landmarks1[idx] && landmarks2[idx]) {
      const dx = landmarks1[idx].x - landmarks2[idx].x;
      const dy = landmarks1[idx].y - landmarks2[idx].y;
      const dz = landmarks1[idx].z - landmarks2[idx].z;

      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      totalDistance += distance;
      count++;
    }
  });

  if (count === 0) return 0;

  const avgDistance = totalDistance / count;

  // Convert distance to similarity (0-1, where 1 is identical)
  // Much more lenient - reduced multiplier from 5 to 2
  const similarity = Math.max(0, 1 - avgDistance * 2);

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
