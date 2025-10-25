/**
 * ROI Overlay Component
 * Shows the Region of Interest box and validation warnings
 */

'use client';

import { PersonValidation } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface ROIOverlayProps {
  roiBounds: { x: number; y: number; width: number; height: number };
  validation: PersonValidation | null;
  canvasWidth: number;
  canvasHeight: number;
}

export default function ROIOverlay({
  roiBounds,
  validation,
  canvasWidth,
  canvasHeight,
}: ROIOverlayProps) {
  const isValid = validation?.isInROI && validation?.isCorrectPerson && validation?.isContinuous;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* ROI Box */}
      <svg width={canvasWidth} height={canvasHeight} className="absolute inset-0">
        <rect
          x={roiBounds.x}
          y={roiBounds.y}
          width={roiBounds.width}
          height={roiBounds.height}
          fill="none"
          stroke={isValid ? '#22c55e' : '#ef4444'}
          strokeWidth="4"
          strokeDasharray="20,10"
          rx="20"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;30"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>

        {/* Corner markers */}
        {[
          { x: roiBounds.x, y: roiBounds.y },
          { x: roiBounds.x + roiBounds.width, y: roiBounds.y },
          { x: roiBounds.x, y: roiBounds.y + roiBounds.height },
          { x: roiBounds.x + roiBounds.width, y: roiBounds.y + roiBounds.height },
        ].map((corner, i) => (
          <circle
            key={i}
            cx={corner.x}
            cy={corner.y}
            r="8"
            fill={isValid ? '#22c55e' : '#ef4444'}
            opacity="0.8"
          />
        ))}
      </svg>

      {/* Instructions/Warnings */}
      <div className="absolute left-1/2 top-8 -translate-x-1/2">
        <AnimatePresence mode="wait">
          {validation && validation.warnings.length > 0 ? (
            <motion.div
              key="warnings"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-red-400/50 bg-red-500/20 px-6 py-3 backdrop-blur-md"
            >
              {validation.warnings.map((warning, i) => (
                <div key={i} className="text-center font-semibold text-red-200">
                  ⚠️ {warning}
                </div>
              ))}
            </motion.div>
          ) : isValid ? (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-green-400/50 bg-green-500/20 px-6 py-3 backdrop-blur-md"
            >
              <div className="text-center font-semibold text-green-200">✓ Ready to dance!</div>
            </motion.div>
          ) : (
            <motion.div
              key="position"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-blue-400/50 bg-blue-500/20 px-6 py-3 backdrop-blur-md"
            >
              <div className="text-center font-semibold text-blue-200">
                Position yourself in the green box
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Calibration Status */}
      {validation && (
        <div className="absolute bottom-24 right-8">
          <div className="rounded-xl border border-white/30 bg-black/60 p-4 backdrop-blur-md">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    validation.isInROI ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-gray-300">In Position</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    validation.isCorrectPerson ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-gray-300">Correct Person</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    validation.isContinuous ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-gray-300">Tracking</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
