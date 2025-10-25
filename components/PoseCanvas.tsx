/**
 * Pose Canvas Component
 * Renders pose skeleton overlay on webcam feed
 */

"use client";

import { useEffect, useRef } from "react";
import { Landmark, PoseLandmark } from "@/lib/types";

interface PoseCanvasProps {
  landmarks: Landmark[] | null;
  canvasWidth: number;
  canvasHeight: number;
  highlightJoints?: Set<number>; // Highlight specific joints (e.g., when they match well)
}

// Connection pairs for skeleton
const POSE_CONNECTIONS: [number, number][] = [
  // Face (simplified - just nose to shoulders)
  [PoseLandmark.LEFT_EYE, PoseLandmark.RIGHT_EYE],
  // [PoseLandmark.LEFT_EYE, PoseLandmark.NOSE],
  // [PoseLandmark.RIGHT_EYE, PoseLandmark.NOSE],
  // [PoseLandmark.LEFT_EAR, PoseLandmark.LEFT_EYE],
  // [PoseLandmark.RIGHT_EAR, PoseLandmark.RIGHT_EYE],

  // Torso
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER],
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP],
  [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP],
  [PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP],

  // Left arm
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW],
  [PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST],
  [PoseLandmark.LEFT_WRIST, PoseLandmark.LEFT_PINKY],
  [PoseLandmark.LEFT_WRIST, PoseLandmark.LEFT_INDEX],
  [PoseLandmark.LEFT_WRIST, PoseLandmark.LEFT_THUMB],

  // Right arm
  [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW],
  [PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST],
  [PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_PINKY],
  [PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_INDEX],
  [PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_THUMB],

  // Left leg
  [PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE],
  [PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE],
  [PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_HEEL],
  [PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_FOOT_INDEX],

  // Right leg
  [PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE],
  [PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE],
  [PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_HEEL],
  [PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_FOOT_INDEX],
];

export default function PoseCanvas({
  landmarks,
  canvasWidth,
  canvasHeight,
  highlightJoints = new Set(),
}: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !landmarks) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Mirror the canvas to match mirrored video
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasWidth, 0);

    // Draw connections
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      // Skip if either point has low visibility
      if ((start.visibility ?? 1) < 0.5 || (end.visibility ?? 1) < 0.5) {
        continue;
      }

      // Check if either joint is highlighted
      const isHighlighted =
        highlightJoints.has(startIdx) || highlightJoints.has(endIdx);

      ctx.beginPath();
      ctx.moveTo(start.x * canvasWidth, start.y * canvasHeight);
      ctx.lineTo(end.x * canvasWidth, end.y * canvasHeight);

      // Color based on highlight
      if (isHighlighted) {
        ctx.strokeStyle = "#FFD700"; // Gold
        ctx.lineWidth = 6;
      } else {
        ctx.strokeStyle = "#00ff00"; // Green
        ctx.lineWidth = 4;
      }

      ctx.stroke();
    }

    // Draw landmarks (skip face landmarks 0-10 for cleaner look)
    landmarks.forEach((landmark, index) => {
      if ((landmark.visibility ?? 1) < 0.5) return;

      // Skip face landmarks (nose, eyes, ears, mouth)
      if (index >= PoseLandmark.NOSE && index <= PoseLandmark.MOUTH_RIGHT) {
        return;
      }

      const x = landmark.x * canvasWidth;
      const y = landmark.y * canvasHeight;

      // Highlight specific joints
      const isHighlighted = highlightJoints.has(index);

      ctx.beginPath();
      ctx.arc(x, y, isHighlighted ? 8 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = isHighlighted ? "#FFD700" : "#00ff00";
      ctx.fill();

      // Add glow effect for highlighted joints
      if (isHighlighted) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#FFD700";
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Restore canvas state
    ctx.restore();
  }, [landmarks, canvasWidth, canvasHeight, highlightJoints]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
    />
  );
}
