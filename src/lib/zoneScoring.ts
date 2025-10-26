/**
 * Zone-based Karaoke Scoring System
 * Implements comprehensive scoring based on pitch accuracy zones and silence rewards
 */

export interface ZoneScoreData {
  perfectZone: number; // Time spent in perfect zone (0-1 semitones off)
  keepTryingZone: number; // Time spent in keep trying zone (1-2 semitones off)
  farOffZone: number; // Time spent in far off zone (2-4 semitones off)
  completelyOffZone: number; // Time spent completely off (>4 semitones off)
  silenceReward: number; // Time spent silent during instrumental parts
  totalScore: number; // Weighted total score (0-100)
  zoneBreakdown: ZoneBreakdown;
}

export interface ZoneBreakdown {
  perfectTime: number; // Seconds in perfect zone
  keepTryingTime: number; // Seconds in keep trying zone
  farOffTime: number; // Seconds in far off zone
  completelyOffTime: number; // Seconds completely off
  silenceTime: number; // Seconds silent during instrumental
  totalTime: number; // Total analysis time
}

export interface ZoneWeights {
  perfect: number; // Weight for perfect zone (default: 1.0)
  keepTrying: number; // Weight for keep trying zone (default: 0.7)
  farOff: number; // Weight for far off zone (default: 0.3)
  completelyOff: number; // Weight for completely off zone (default: 0.1)
  silence: number; // Weight for silence during instrumental (default: 0.8)
}

export interface PitchFrame {
  frequency: number;
  confidence: number;
  timestamp: number;
  volume: number;
}

export interface VocalActivityFrame {
  isActive: boolean;
  timestamp: number;
  confidence: number;
}

export class ZoneScoringSystem {
  private weights: ZoneWeights;
  private analysisHistory: Array<{
    userPitch: number;
    targetPitch: number;
    timestamp: number;
    volume: number;
    isInstrumental: boolean;
    userConfidence: number;
    targetConfidence: number;
  }> = [];

  // Score smoothing and averaging (entire song analysis)
  private scoreHistory: number[] = [];
  private readonly maxScoreHistory = 200; // Keep last 200 scores for averaging
  private readonly smoothingWindow = 0; // 0 = use entire song duration

  constructor(weights?: Partial<ZoneWeights>) {
    this.weights = {
      perfect: 1.0,
      keepTrying: 0.7,
      farOff: 0.3,
      completelyOff: 0.1,
      silence: 0.8,
      ...weights,
    };
  }

  /**
   * Add a new analysis frame to the scoring system
   */
  addAnalysisFrame(
    userPitch: number,
    targetPitch: number,
    timestamp: number,
    volume: number,
    isInstrumental: boolean,
    userConfidence: number = 1.0,
    targetConfidence: number = 1.0
  ): void {
    this.analysisHistory.push({
      userPitch,
      targetPitch,
      timestamp,
      volume,
      isInstrumental,
      userConfidence,
      targetConfidence,
    });

    // Keep only last 10 seconds of data to prevent memory issues
    const cutoffTime = timestamp - 10000; // 10 seconds ago
    this.analysisHistory = this.analysisHistory.filter(
      (frame) => frame.timestamp > cutoffTime
    );

    // Debug logging
    console.log("Added frame to zone scoring:", {
      userPitch,
      targetPitch,
      volume,
      isInstrumental,
      historyLength: this.analysisHistory.length,
    });
  }

  /**
   * Calculate current zone-based score
   */
  calculateZoneScore(): ZoneScoreData {
    console.log(
      "Calculating zone score, history length:",
      this.analysisHistory.length
    );

    if (this.analysisHistory.length === 0) {
      console.log("No analysis history, returning empty score");
      return this.getEmptyScore();
    }

    // Use entire song duration for analysis (no time window)
    const recentFrames =
      this.smoothingWindow === 0
        ? this.analysisHistory // Use all frames for entire song analysis
        : this.analysisHistory.filter(
            (frame) =>
              Date.now() - frame.timestamp < this.smoothingWindow * 1000
          );

    console.log(
      "Recent frames count:",
      recentFrames.length,
      "out of",
      this.analysisHistory.length
    );

    if (recentFrames.length === 0) {
      console.log("No recent frames, returning empty score");
      return this.getEmptyScore();
    }

    const zoneBreakdown = this.calculateZoneBreakdownFromFrames(recentFrames);
    const totalTime = zoneBreakdown.totalTime;

    console.log("Zone breakdown (last 3s):", {
      perfectTime: zoneBreakdown.perfectTime,
      keepTryingTime: zoneBreakdown.keepTryingTime,
      farOffTime: zoneBreakdown.farOffTime,
      completelyOffTime: zoneBreakdown.completelyOffTime,
      totalTime,
    });

    if (totalTime === 0) {
      console.log("Total time is 0, returning empty score");
      return this.getEmptyScore();
    }

    // Calculate zone percentages (excluding silence)
    const perfectZone = zoneBreakdown.perfectTime / totalTime;
    const keepTryingZone = zoneBreakdown.keepTryingTime / totalTime;
    const farOffZone = zoneBreakdown.farOffTime / totalTime;
    const completelyOffZone = zoneBreakdown.completelyOffTime / totalTime;

    // Much more aggressive deduction-based scoring
    let deductions = 0;

    // Deduct points for time spent in worse zones (very harsh scoring)
    deductions += keepTryingZone * 25; // 25 points deducted for "keep trying"
    deductions += farOffZone * 50; // 50 points deducted for "far off"
    deductions += completelyOffZone * 80; // 80 points deducted for "completely off"

    // Calculate base score (80 - deductions, with max of 100)
    const rawScore = Math.min(100, Math.max(0, 80 - deductions));

    // Add to score history for smoothing
    this.scoreHistory.push(rawScore);
    if (this.scoreHistory.length > this.maxScoreHistory) {
      this.scoreHistory.shift(); // Remove oldest score
    }

    // Calculate smoothed score (more responsive to actual performance)
    let smoothedScore = rawScore;
    if (this.scoreHistory.length > 1) {
      // Use simple moving average of last 5 scores for more responsiveness
      const recentScores = this.scoreHistory.slice(
        -Math.min(5, this.scoreHistory.length)
      );
      smoothedScore =
        recentScores.reduce((sum, score) => sum + score, 0) /
        recentScores.length;
    }

    // More responsive smoothing: blend with previous smoothed score
    if (this.scoreHistory.length > 3) {
      const previousSmoothed =
        this.scoreHistory.slice(-2).reduce((sum, score) => sum + score, 0) / 2;
      smoothedScore = smoothedScore * 0.4 + previousSmoothed * 0.6;
    }

    const totalScore = Math.round(smoothedScore);

    console.log("Score calculation:", {
      perfectZone: Math.round(perfectZone * 100) + "%",
      keepTryingZone: Math.round(keepTryingZone * 100) + "%",
      farOffZone: Math.round(farOffZone * 100) + "%",
      completelyOffZone: Math.round(completelyOffZone * 100) + "%",
      deductions: Math.round(deductions),
      rawScore: Math.round(rawScore),
      smoothedScore: Math.round(smoothedScore),
      totalScore,
      scoreHistoryLength: this.scoreHistory.length,
      recentScores: this.scoreHistory.slice(-5).map((s) => Math.round(s)),
    });

    return {
      perfectZone,
      keepTryingZone,
      farOffZone,
      completelyOffZone,
      silenceReward: 0, // No longer used
      totalScore,
      zoneBreakdown,
    };
  }

  /**
   * Calculate zone breakdown from specific frames
   */
  private calculateZoneBreakdownFromFrames(
    frames: typeof this.analysisHistory
  ): ZoneBreakdown {
    let perfectTime = 0;
    let keepTryingTime = 0;
    let farOffTime = 0;
    let completelyOffTime = 0;
    let totalTime = 0;

    console.log("Calculating zone breakdown for", frames.length, "frames");

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const nextFrame = frames[i + 1];

      // Calculate time duration for this frame
      const frameDuration = nextFrame
        ? Math.max(0.05, nextFrame.timestamp - frame.timestamp) // Minimum 50ms
        : 0.1; // Default 100ms for last frame

      totalTime += frameDuration;

      // Skip frames with low confidence or no user pitch
      if (frame.userConfidence < 0.1 || frame.userPitch <= 0) {
        console.log(
          `Skipping frame ${i}: confidence=${frame.userConfidence}, pitch=${frame.userPitch}`
        );
        continue;
      }

      // Skip instrumental parts (no silence consideration)
      if (frame.isInstrumental) {
        console.log(`Skipping frame ${i}: instrumental part`);
        continue;
      }

      // Calculate pitch accuracy zone
      const semitoneDiff = this.calculateSemitoneDifference(
        frame.userPitch,
        frame.targetPitch
      );

      console.log(
        `Frame ${i}: userPitch=${frame.userPitch}, targetPitch=${
          frame.targetPitch
        }, semitoneDiff=${semitoneDiff.toFixed(2)}`
      );

      // If no target pitch available, use volume-based scoring
      if (frame.targetPitch <= 0) {
        // Score based on volume consistency and pitch stability
        if (frame.volume > 0.3 && frame.userPitch > 0) {
          // Good volume and pitch detected - treat as keep trying
          keepTryingTime += frameDuration;
          console.log(
            `Frame ${i}: No target pitch, good volume/pitch - keepTrying`
          );
        } else if (frame.volume > 0.1) {
          // Low volume or unstable pitch - treat as far off
          farOffTime += frameDuration;
          console.log(`Frame ${i}: No target pitch, low volume - farOff`);
        } else {
          // Very low volume - treat as completely off
          completelyOffTime += frameDuration;
          console.log(
            `Frame ${i}: No target pitch, very low volume - completelyOff`
          );
        }
      } else {
        // Normal zone calculation when target pitch is available (more sensitive thresholds)
        if (semitoneDiff <= 0.5) {
          perfectTime += frameDuration;
          console.log(`Frame ${i}: Perfect zone`);
        } else if (semitoneDiff <= 1.5) {
          keepTryingTime += frameDuration;
          console.log(`Frame ${i}: Keep trying zone`);
        } else if (semitoneDiff <= 3.0) {
          farOffTime += frameDuration;
          console.log(`Frame ${i}: Far off zone`);
        } else {
          completelyOffTime += frameDuration;
          console.log(`Frame ${i}: Completely off zone`);
        }
      }
    }

    console.log("Final zone breakdown:", {
      perfectTime,
      keepTryingTime,
      farOffTime,
      completelyOffTime,
      totalTime,
    });

    return {
      perfectTime,
      keepTryingTime,
      farOffTime,
      completelyOffTime,
      silenceTime: 0, // No longer used
      totalTime,
    };
  }

  /**
   * Calculate detailed zone breakdown
   */
  private calculateZoneBreakdown(): ZoneBreakdown {
    let perfectTime = 0;
    let keepTryingTime = 0;
    let farOffTime = 0;
    let completelyOffTime = 0;
    let totalTime = 0;

    console.log(
      "Calculating zone breakdown for",
      this.analysisHistory.length,
      "frames"
    );

    for (let i = 0; i < this.analysisHistory.length; i++) {
      const frame = this.analysisHistory[i];
      const nextFrame = this.analysisHistory[i + 1];

      // Calculate time duration for this frame
      const frameDuration = nextFrame
        ? nextFrame.timestamp - frame.timestamp
        : 0.1; // Default 100ms for last frame

      totalTime += frameDuration;

      console.log(`Frame ${i}:`, {
        userPitch: frame.userPitch,
        targetPitch: frame.targetPitch,
        volume: frame.volume,
        isInstrumental: frame.isInstrumental,
        frameDuration,
      });

      // Skip frames with low confidence (be more lenient)
      if (frame.userConfidence < 0.1) {
        console.log(
          `Skipping frame ${i} due to low user confidence:`,
          frame.userConfidence
        );
        continue;
      }

      // Skip instrumental parts (no silence consideration)
      if (frame.isInstrumental) {
        continue;
      }

      // Calculate pitch accuracy zone
      const semitoneDiff = this.calculateSemitoneDifference(
        frame.userPitch,
        frame.targetPitch
      );

      // If no target pitch available, give partial credit for any singing
      if (frame.targetPitch <= 0) {
        if (frame.userPitch > 0) {
          // Give partial credit for singing when no reference is available
          keepTryingTime += frameDuration * 0.7; // 70% credit
        }
      } else {
        // Normal zone calculation when target pitch is available
        if (semitoneDiff <= 1.0) {
          perfectTime += frameDuration;
        } else if (semitoneDiff <= 2.0) {
          keepTryingTime += frameDuration;
        } else if (semitoneDiff <= 4.0) {
          farOffTime += frameDuration;
        } else {
          completelyOffTime += frameDuration;
        }
      }
    }

    return {
      perfectTime,
      keepTryingTime,
      farOffTime,
      completelyOffTime,
      silenceTime: 0, // No longer used
      totalTime,
    };
  }

  /**
   * Calculate semitone difference between two frequencies
   */
  private calculateSemitoneDifference(freq1: number, freq2: number): number {
    if (freq1 <= 0 || freq2 <= 0) return 10; // Maximum difference for invalid frequencies
    return Math.abs(12 * Math.log2(freq1 / freq2));
  }

  /**
   * Get empty score for initialization
   */
  private getEmptyScore(): ZoneScoreData {
    return {
      perfectZone: 0,
      keepTryingZone: 0,
      farOffZone: 0,
      completelyOffZone: 0,
      silenceReward: 0,
      totalScore: 80, // Start at 80 instead of 100
      zoneBreakdown: {
        perfectTime: 0,
        keepTryingTime: 0,
        farOffTime: 0,
        completelyOffTime: 0,
        silenceTime: 0,
        totalTime: 0,
      },
    };
  }

  /**
   * Get score feedback based on zone performance
   */
  getScoreFeedback(score: ZoneScoreData): string {
    const {
      perfectZone,
      keepTryingZone,
      farOffZone,
      completelyOffZone,
      silenceReward,
      totalScore,
    } = score;

    if (totalScore >= 95) {
      return "🎉 PERFECT! You're a karaoke superstar!";
    } else if (totalScore >= 90) {
      return "🌟 EXCELLENT! Outstanding performance!";
    } else if (totalScore >= 80) {
      return "👏 GREAT! Very good singing!";
    } else if (totalScore >= 70) {
      return "👍 GOOD! Nice job!";
    } else if (totalScore >= 60) {
      return "🎵 OKAY! Keep practicing!";
    } else if (totalScore >= 50) {
      return "🎤 FAIR! Focus on pitch accuracy.";
    } else {
      return "🎶 Keep trying! Practice makes perfect!";
    }
  }

  /**
   * Get zone-specific feedback
   */
  getZoneFeedback(score: ZoneScoreData): string[] {
    const feedback: string[] = [];
    const {
      perfectZone,
      keepTryingZone,
      farOffZone,
      completelyOffZone,
      silenceReward,
    } = score;

    if (perfectZone > 0.6) {
      feedback.push("🎵 Excellent pitch accuracy!");
    } else if (perfectZone > 0.4) {
      feedback.push("🎶 Good pitch accuracy!");
    } else if (perfectZone < 0.2) {
      feedback.push("🎤 Work on pitch accuracy");
    }

    if (keepTryingZone > 0.3) {
      feedback.push("👍 You're getting close!");
    }

    if (farOffZone > 0.3) {
      feedback.push("🎯 Focus on matching the melody");
    }

    if (completelyOffZone > 0.2) {
      feedback.push("🎼 Practice the song more");
    }

    if (silenceReward > 0.5) {
      feedback.push("🔇 Great job staying quiet during instrumental parts!");
    } else if (silenceReward < 0.3) {
      feedback.push("🎵 Try to stay quiet during instrumental parts");
    }

    return feedback;
  }

  /**
   * Get score grade based on total score
   */
  getScoreGrade(totalScore: number): string {
    if (totalScore >= 95) return "S+";
    if (totalScore >= 90) return "S";
    if (totalScore >= 85) return "A+";
    if (totalScore >= 80) return "A";
    if (totalScore >= 75) return "B+";
    if (totalScore >= 70) return "B";
    if (totalScore >= 65) return "C+";
    if (totalScore >= 60) return "C";
    if (totalScore >= 55) return "D+";
    if (totalScore >= 50) return "D";
    return "F";
  }

  /**
   * Reset the scoring system
   */
  reset(): void {
    this.analysisHistory = [];
    this.scoreHistory = []; // Clear score history on reset
    console.log("Zone scoring system reset");
  }

  /**
   * Get recent performance trend
   */
  getPerformanceTrend(
    windowSize: number = 50
  ): "improving" | "declining" | "stable" {
    if (this.analysisHistory.length < windowSize * 2) {
      return "stable";
    }

    const recentFrames = this.analysisHistory.slice(-windowSize);
    const olderFrames = this.analysisHistory.slice(
      -windowSize * 2,
      -windowSize
    );

    const recentScore = this.calculateScoreForFrames(recentFrames);
    const olderScore = this.calculateScoreForFrames(olderFrames);

    const difference = recentScore - olderScore;

    if (difference > 5) return "improving";
    if (difference < -5) return "declining";
    return "stable";
  }

  /**
   * Calculate score for a specific set of frames
   */
  private calculateScoreForFrames(frames: typeof this.analysisHistory): number {
    if (frames.length === 0) return 0;

    let totalScore = 0;
    let validFrames = 0;

    for (const frame of frames) {
      if (frame.userConfidence < 0.1) continue;

      if (frame.isInstrumental) {
        totalScore += frame.volume < 0.1 ? 100 : 0;
      } else {
        const semitoneDiff = this.calculateSemitoneDifference(
          frame.userPitch,
          frame.targetPitch
        );
        if (semitoneDiff <= 1.0) {
          totalScore += 100;
        } else if (semitoneDiff <= 2.0) {
          totalScore += 70;
        } else if (semitoneDiff <= 4.0) {
          totalScore += 30;
        } else {
          totalScore += 10;
        }
      }
      validFrames++;
    }

    return validFrames > 0 ? totalScore / validFrames : 0;
  }

  /**
   * Get analysis history length
   */
  getHistoryLength(): number {
    return this.analysisHistory.length;
  }

  /**
   * Update zone weights
   */
  updateWeights(newWeights: Partial<ZoneWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }
}
