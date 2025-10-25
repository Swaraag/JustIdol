/**
 * Score Display Component
 * Shows current score, streak, and hit feedback
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GameState, HitRating } from '@/lib/types';
import { getRatingColor, calculateStreakMultiplier } from '@/lib/poseComparator';

interface ScoreDisplayProps {
  gameState: GameState;
  lastRating: HitRating | null;
  showRating: boolean;
}

export default function ScoreDisplay({ gameState, lastRating, showRating }: ScoreDisplayProps) {
  const streakMultiplier = calculateStreakMultiplier(gameState.streak);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Score - Top Left */}
      <div className="absolute left-8 top-8">
        <div className="rounded-2xl border border-white/30 bg-black/60 px-6 py-4 backdrop-blur-md">
          <div className="text-sm font-semibold text-gray-300">SCORE</div>
          <motion.div
            key={gameState.score}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-4xl font-bold text-white"
          >
            {gameState.score.toLocaleString()}
          </motion.div>
        </div>
      </div>

      {/* Streak - Top Right */}
      {gameState.streak > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute right-8 top-8"
        >
          <div className="rounded-2xl border border-yellow-400/50 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 px-6 py-4 backdrop-blur-md">
            <div className="text-sm font-semibold text-yellow-300">STREAK</div>
            <div className="flex items-baseline gap-2">
              <motion.div
                key={gameState.streak}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-4xl font-bold text-yellow-400"
              >
                {gameState.streak}
              </motion.div>
              {streakMultiplier > 1 && (
                <div className="text-xl font-bold text-yellow-300">×{streakMultiplier}</div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Hit Feedback - Center */}
      <AnimatePresence>
        {showRating && lastRating && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute left-1/2 top-1/3 -translate-x-1/2"
          >
            <div
              className="rounded-3xl border-4 px-12 py-6 text-center shadow-2xl backdrop-blur-sm"
              style={{
                borderColor: getRatingColor(lastRating),
                backgroundColor: `${getRatingColor(lastRating)}20`,
                boxShadow: `0 0 40px ${getRatingColor(lastRating)}80`,
              }}
            >
              <div
                className="text-6xl font-black drop-shadow-lg"
                style={{ color: getRatingColor(lastRating) }}
              >
                {lastRating}
              </div>
              {lastRating === 'PERFECT' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.1 }}
                  className="mt-2 text-3xl"
                >
                  ✨
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats - Bottom Left */}
      <div className="absolute bottom-8 left-8">
        <div className="rounded-2xl border border-white/30 bg-black/60 px-6 py-4 backdrop-blur-md">
          <div className="mb-2 text-sm font-semibold text-gray-300">ACCURACY</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="text-gray-300">Perfect:</span>
              <span className="font-bold text-white">{gameState.hits.PERFECT}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-400" />
              <span className="text-gray-300">Great:</span>
              <span className="font-bold text-white">{gameState.hits.GREAT}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-400" />
              <span className="text-gray-300">Good:</span>
              <span className="font-bold text-white">{gameState.hits.GOOD}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-400" />
              <span className="text-gray-300">OK:</span>
              <span className="font-bold text-white">{gameState.hits.OK}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <span className="text-gray-300">Miss:</span>
              <span className="font-bold text-white">{gameState.hits.MISS}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Max Streak - Bottom Right */}
      {gameState.maxStreak > 0 && (
        <div className="absolute bottom-8 right-8">
          <div className="rounded-2xl border border-white/30 bg-black/60 px-6 py-4 backdrop-blur-md">
            <div className="text-sm font-semibold text-gray-300">MAX STREAK</div>
            <div className="text-3xl font-bold text-yellow-400">{gameState.maxStreak}</div>
          </div>
        </div>
      )}
    </div>
  );
}
