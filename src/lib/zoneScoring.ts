/**
 * Zone-based Karaoke Scoring System
 * Implements comprehensive scoring based on pitch accuracy zones and silence rewards
 */

export interface ZoneScoreData {
    perfectZone: number;      // Time spent in perfect zone (0-1.5 semitones off)
    greatZone: number;        // Time spent in great zone (1.5-2.5 semitones off)
    keepTryingZone: number;   // Time spent in keep trying zone (2.5-4.0 semitones off)
    offPitchZone: number;    // Time spent off pitch (>4.0 semitones off)
    skippedFrames: number;   // Time spent in skipped frames (low confidence/volume)
    silenceReward: number;    // Time spent silent during instrumental parts
    totalScore: number;       // Real-time instantaneous score (average of 5 scores)
    cumulativeScore: number;  // Background cumulative average score (0-100)
    zoneBreakdown: ZoneBreakdown;
  }
  
  export interface ZoneBreakdown {
    perfectTime: number;      // Seconds in perfect zone
    greatTime: number;        // Seconds in great zone
    keepTryingTime: number;   // Seconds in keep trying zone
    offPitchTime: number;     // Seconds off pitch
    skippedTime: number;      // Seconds in skipped frames (low confidence/volume)
    silenceTime: number;     // Seconds silent during instrumental
    totalTime: number;        // Total analysis time
  }
  
  export interface ZoneWeights {
    perfect: number;          // Weight for perfect zone (default: 1.0)
    great: number;           // Weight for great zone (default: 0.8)
    keepTrying: number;       // Weight for keep trying zone (default: 0.6)
    offPitch: number;        // Weight for off pitch zone (default: 0.2)
    silence: number;         // Weight for silence during instrumental (default: 0.8)
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
    
    // Half-second update system
    private lastScoreUpdate: number = 0;
    private readonly scoreUpdateInterval = 500; // Update every 500ms
    private cachedScore: ZoneScoreData | null = null;
    
    // New cumulative score system - track instantaneous scores
    private instantaneousScoreHistory: number[] = [];
  
    constructor(weights?: Partial<ZoneWeights>) {
      this.weights = {
        perfect: 1.0,
        great: 0.8,
        keepTrying: 0.6,
        offPitch: 0.2,
        silence: 0.8,
        ...weights
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
        targetConfidence
      });
      
      // Keep only last 10 seconds of data to prevent memory issues
      const cutoffTime = timestamp - 10000; // 10 seconds ago
      this.analysisHistory = this.analysisHistory.filter(frame => frame.timestamp > cutoffTime);
      
      // Debug logging (reduced frequency)
      if (this.analysisHistory.length % 10 === 0) {
        console.log('Added frame to zone scoring:', {
          userPitch,
          targetPitch,
          volume,
          isInstrumental,
          historyLength: this.analysisHistory.length
        });
      }
    }
  
    /**
     * Calculate instantaneous score based on recent frames (average of 5 recent scores)
     */
    calculateInstantaneousScore(): number {
      if (this.analysisHistory.length === 0) {
        return 80; // Default starting score
      }

      // Get frames from the last 1 second (since we update every 500ms)
      const now = Date.now();
      const recentFrames = this.analysisHistory.filter(frame => 
        (now - frame.timestamp) < 1000 // Last 1 second
      );

      if (recentFrames.length === 0) {
        return 80; // Default if no recent frames
      }

      // Calculate individual scores for recent frames and take average of 5
      const individualScores: number[] = [];
      
      // Process frames in chunks to get multiple score samples
      const chunkSize = Math.max(1, Math.floor(recentFrames.length / 5));
      
      for (let i = 0; i < 5 && i * chunkSize < recentFrames.length; i++) {
        const startIdx = i * chunkSize;
        const endIdx = Math.min(startIdx + chunkSize, recentFrames.length);
        const chunkFrames = recentFrames.slice(startIdx, endIdx);
        
        if (chunkFrames.length > 0) {
          const zoneBreakdown = this.calculateZoneBreakdownFromFrames(chunkFrames);
          const totalTime = zoneBreakdown.totalTime;

          if (totalTime > 0) {
            // Calculate zone percentages for this chunk
            const perfectZone = zoneBreakdown.perfectTime / totalTime;
            const greatZone = zoneBreakdown.greatTime / totalTime;
            const keepTryingZone = zoneBreakdown.keepTryingTime / totalTime;
            const offPitchZone = zoneBreakdown.offPitchTime / totalTime;

            // Calculate score for this chunk (much easier to get 90s)
            let score = 0;
            score += perfectZone * 100;        // Perfect gets full 100 points
            score += greatZone * 98;          // Great gets 98 points (increased from 95)
            score += keepTryingZone * 90;     // Keep trying gets 90 points (increased from 80)
            score += offPitchZone * 75;       // Off pitch gets 75 points (increased from 60)
            
            individualScores.push(Math.min(100, Math.max(0, Math.round(score))));
          }
        }
      }

      // If we don't have 5 scores, pad with the average
      while (individualScores.length < 5) {
        const avgScore = individualScores.length > 0 
          ? individualScores.reduce((sum, score) => sum + score, 0) / individualScores.length
          : 80;
        individualScores.push(Math.round(avgScore));
      }

      // Take average of 5 scores
      const averageScore = individualScores.reduce((sum, score) => sum + score, 0) / individualScores.length;
      const instantaneousScore = Math.round(averageScore);

      console.log('Instantaneous score calculation (avg of 5):', {
        individualScores,
        averageScore: instantaneousScore,
        recentFramesCount: recentFrames.length
      });

      return instantaneousScore;
    }

    /**
     * Calculate current zone-based score (both instantaneous and cumulative)
     * Updates every half second to reduce jitter
     */
    calculateZoneScore(): ZoneScoreData {
      const now = Date.now();
      
      // TEMPORARILY DISABLE CACHING TO DEBUG PERCENTAGE ISSUE
      // Return cached score if we're within the update interval
      // if (this.cachedScore && (now - this.lastScoreUpdate) < this.scoreUpdateInterval) {
      //   console.log('Returning cached score, time since last update:', now - this.lastScoreUpdate, 'ms');
      //   return this.cachedScore;
      // }
      
      console.log('Calculating NEW zone score, history length:', this.analysisHistory.length);
      
      if (this.analysisHistory.length === 0) {
        console.log('No analysis history, returning empty score');
        this.cachedScore = this.getEmptyScore();
        this.lastScoreUpdate = now;
        return this.cachedScore;
      }
      
      // Debug: Show recent frame data
      const debugFrames = this.analysisHistory.slice(-5);
      console.log('Recent frames data:', debugFrames.map(f => ({
        userPitch: f.userPitch,
        targetPitch: f.targetPitch,
        volume: f.volume,
        confidence: f.userConfidence,
        isInstrumental: f.isInstrumental
      })));
  
      // Use entire song duration for analysis (no time window)
      const recentFrames = this.smoothingWindow === 0 
        ? this.analysisHistory // Use all frames for entire song analysis
        : this.analysisHistory.filter(frame => 
            (Date.now() - frame.timestamp) < this.smoothingWindow * 1000
          );
  
      console.log('Recent frames count:', recentFrames.length, 'out of', this.analysisHistory.length);
  
      if (recentFrames.length === 0) {
        console.log('No recent frames, returning empty score');
        return this.getEmptyScore();
      }
  
      const zoneBreakdown = this.calculateZoneBreakdownFromFrames(recentFrames);
      const totalTime = zoneBreakdown.totalTime;
      
      console.log('Zone breakdown (last 3s):', {
        perfectTime: zoneBreakdown.perfectTime,
        greatTime: zoneBreakdown.greatTime,
        keepTryingTime: zoneBreakdown.keepTryingTime,
        offPitchTime: zoneBreakdown.offPitchTime,
        skippedTime: zoneBreakdown.skippedTime,
        silenceTime: zoneBreakdown.silenceTime,
        totalTime
      });
  
      if (totalTime === 0) {
        console.log('Total time is 0, returning empty score');
        return this.getEmptyScore();
      }
  
      // Calculate zone percentages (now includes ALL frames for 100% total)
      const perfectZone = zoneBreakdown.perfectTime / totalTime;
      const greatZone = zoneBreakdown.greatTime / totalTime;
      const keepTryingZone = zoneBreakdown.keepTryingTime / totalTime;
      const offPitchZone = zoneBreakdown.offPitchTime / totalTime;
      const skippedFrames = zoneBreakdown.skippedTime / totalTime;
      const silenceReward = zoneBreakdown.silenceTime / totalTime;
      
      // Debug: Show calculated percentages
      console.log('Calculated percentages:', {
        perfect: Math.round(perfectZone * 100) + '%',
        great: Math.round(greatZone * 100) + '%',
        keepTrying: Math.round(keepTryingZone * 100) + '%',
        offPitch: Math.round(offPitchZone * 100) + '%',
        skipped: Math.round(skippedFrames * 100) + '%',
        silence: Math.round(silenceReward * 100) + '%',
        total: Math.round((perfectZone + greatZone + keepTryingZone + offPitchZone + skippedFrames + silenceReward) * 100) + '%'
      });
      
      // CRITICAL DEBUG: Check if percentages are actually 0
      if (perfectZone === 0 && greatZone === 0 && keepTryingZone === 0 && offPitchZone === 0) {
        console.error('🚨 ALL PERCENTAGES ARE 0! This indicates a serious bug!');
        console.error('Zone breakdown times:', {
          perfectTime: zoneBreakdown.perfectTime,
          greatTime: zoneBreakdown.greatTime,
          keepTryingTime: zoneBreakdown.keepTryingTime,
          offPitchTime: zoneBreakdown.offPitchTime,
          skippedTime: zoneBreakdown.skippedTime,
          silenceTime: zoneBreakdown.silenceTime,
          totalTime
        });
      }

      // Much more generous cumulative scoring for easier 90s
      let scoreAdjustment = 0;
      
      // Extremely generous rewards for good performance
      scoreAdjustment += perfectZone * 80;        // Up to +80 points for perfect (increased from 60)
      scoreAdjustment += greatZone * 60;         // Up to +60 points for great (increased from 45)
      scoreAdjustment += keepTryingZone * 10;     // +10 points for keep trying (was -2)
      scoreAdjustment -= offPitchZone * 2;       // Only -2 points for off pitch (reduced penalty)
      scoreAdjustment += skippedFrames * 2;      // +2 points for skipped frames (slight positive weight)
      scoreAdjustment += silenceReward * 5;      // +5 points for silence during instrumental
      
      // Calculate final score (80 + adjustment, clamped to 0-100)
      const baseScore = 80;
      const rawScore = Math.min(100, Math.max(0, baseScore + scoreAdjustment));
      
      // Calculate instantaneous score for real-time display
      const instantaneousScore = this.calculateInstantaneousScore();
      
      // Add instantaneous score to history for cumulative calculation
      this.instantaneousScoreHistory.push(instantaneousScore);
      if (this.instantaneousScoreHistory.length > 100) {
        this.instantaneousScoreHistory.shift(); // Keep last 100 instantaneous scores
      }
      
      // Calculate cumulative score as true average of instantaneous scores
      let cumulativeScore = 80; // Default starting score
      if (this.instantaneousScoreHistory.length > 0) {
        const sum = this.instantaneousScoreHistory.reduce((total, score) => total + score, 0);
        cumulativeScore = Math.round(sum / this.instantaneousScoreHistory.length);
      }

      console.log('Score calculation:', {
        perfectZone: Math.round(perfectZone * 100) + '%',
        greatZone: Math.round(greatZone * 100) + '%',
        keepTryingZone: Math.round(keepTryingZone * 100) + '%',
        offPitchZone: Math.round(offPitchZone * 100) + '%',
        scoreAdjustment: Math.round(scoreAdjustment),
        baseScore,
        rawScore: Math.round(rawScore),
        instantaneousScore,
        cumulativeScore,
        instantaneousScoreHistoryLength: this.instantaneousScoreHistory.length,
        recentInstantaneousScores: this.instantaneousScoreHistory.slice(-5).map(s => Math.round(s))
      });

      const result = {
        perfectZone,
        greatZone,
        keepTryingZone,
        offPitchZone,
        skippedFrames,
        silenceReward,
        totalScore: instantaneousScore, // Display instantaneous score
        cumulativeScore: cumulativeScore, // Background cumulative score
        zoneBreakdown
      };
      
      // Cache the result and update timestamp
      this.cachedScore = result;
      this.lastScoreUpdate = now;
      
      return result;
    }
  
    /**
     * Calculate zone breakdown from specific frames
     */
    private calculateZoneBreakdownFromFrames(frames: typeof this.analysisHistory): ZoneBreakdown {
      let perfectTime = 0;
      let greatTime = 0;
      let keepTryingTime = 0;
      let offPitchTime = 0;
      let skippedTime = 0;  // Track skipped frames
      let silenceTime = 0;   // Track instrumental parts
      let totalTime = 0;
  
      // Debug logging (reduced frequency)
      if (frames.length % 20 === 0) {
        console.log('Calculating zone breakdown for', frames.length, 'frames');
      }
      
      console.log('Starting zone breakdown calculation for', frames.length, 'frames');

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const nextFrame = frames[i + 1];
        
        // Calculate time duration for this frame
        const frameDuration = nextFrame 
          ? Math.max(0.05, nextFrame.timestamp - frame.timestamp) // Minimum 50ms
          : 0.1; // Default 100ms for last frame

        totalTime += frameDuration;
        
        // Track frames with very low confidence or no user pitch as "skipped" (more lenient)
        if (frame.userConfidence < 0.01 || (frame.userPitch <= 0 && frame.volume < 0.01)) {
          skippedTime += frameDuration;
          if (i % 10 === 0) { // More frequent logging for debugging
            console.log(`SKIPPED frame ${i}: confidence=${frame.userConfidence}, pitch=${frame.userPitch}, volume=${frame.volume}`);
          }
          continue;
        }

        // Track instrumental parts as "silence"
        if (frame.isInstrumental) {
          silenceTime += frameDuration;
          if (i % 10 === 0) { // More frequent logging for debugging
            console.log(`SILENCE frame ${i}: instrumental part`);
          }
          continue;
        }

        // Calculate pitch accuracy zone
        const semitoneDiff = this.calculateSemitoneDifference(frame.userPitch, frame.targetPitch);
        
        // Debug logging (reduced frequency)
        if (i % 20 === 0) {
          console.log(`Frame ${i}: userPitch=${frame.userPitch}, targetPitch=${frame.targetPitch}, semitoneDiff=${semitoneDiff.toFixed(2)}`);
        }
        
        // If no target pitch available, use volume-based scoring
        if (frame.targetPitch <= 0) {
          // Score based on volume consistency and pitch stability
          if (frame.volume > 0.3 && frame.userPitch > 0) {
            // Good volume and pitch detected - treat as great
            greatTime += frameDuration;
            console.log(`Frame ${i}: No target pitch, good volume/pitch - great`);
          } else if (frame.volume > 0.1) {
            // Low volume or unstable pitch - treat as keep trying
            keepTryingTime += frameDuration;
            console.log(`Frame ${i}: No target pitch, low volume - keepTrying`);
          } else {
            // Very low volume - treat as off pitch
            offPitchTime += frameDuration;
            console.log(`Frame ${i}: No target pitch, very low volume - offPitch`);
          }
        } else {
          // Very generous zone calculation to reward good singing (extended ranges)
          if (semitoneDiff <= 1.5) {
            perfectTime += frameDuration;
            if (i % 10 === 0) console.log(`PERFECT frame ${i}: semitoneDiff=${semitoneDiff.toFixed(2)}`);
          } else if (semitoneDiff <= 2.5) {
            greatTime += frameDuration;
            if (i % 10 === 0) console.log(`GREAT frame ${i}: semitoneDiff=${semitoneDiff.toFixed(2)}`);
          } else if (semitoneDiff <= 4.0) {
            keepTryingTime += frameDuration;
            if (i % 10 === 0) console.log(`KEEP TRYING frame ${i}: semitoneDiff=${semitoneDiff.toFixed(2)}`);
          } else {
            offPitchTime += frameDuration;
            if (i % 10 === 0) console.log(`OFF PITCH frame ${i}: semitoneDiff=${semitoneDiff.toFixed(2)}`);
          }
        }
      }
  
      console.log('Final zone breakdown:', {
        perfectTime,
        greatTime,
        keepTryingTime,
        offPitchTime,
        skippedTime,
        silenceTime,
        totalTime
      });

      return {
        perfectTime,
        greatTime,
        keepTryingTime,
        offPitchTime,
        skippedTime,
        silenceTime,
        totalTime
      };
    }
  
    /**
     * Calculate detailed zone breakdown
     */
    private calculateZoneBreakdown(): ZoneBreakdown {
      let perfectTime = 0;
      let greatTime = 0;
      let keepTryingTime = 0;
      let offPitchTime = 0;
      let skippedTime = 0;  // Track skipped frames
      let silenceTime = 0;   // Track instrumental parts
      let totalTime = 0;
  
      // Debug logging (reduced frequency)
      if (this.analysisHistory.length % 20 === 0) {
        console.log('Calculating zone breakdown for', this.analysisHistory.length, 'frames');
      }

      for (let i = 0; i < this.analysisHistory.length; i++) {
        const frame = this.analysisHistory[i];
        const nextFrame = this.analysisHistory[i + 1];
        
        // Calculate time duration for this frame
        const frameDuration = nextFrame 
          ? nextFrame.timestamp - frame.timestamp 
          : 0.1; // Default 100ms for last frame

        totalTime += frameDuration;
        
        // Debug logging (reduced frequency)
        if (i % 30 === 0) {
          console.log(`Frame ${i}:`, {
            userPitch: frame.userPitch,
            targetPitch: frame.targetPitch,
            volume: frame.volume,
            isInstrumental: frame.isInstrumental,
            frameDuration
          });
        }

        // Track frames with very low confidence as "skipped"
        if (frame.userConfidence < 0.05) {
          skippedTime += frameDuration;
          if (i % 50 === 0) { // Only log every 50th skipped frame
            console.log(`Skipped frame ${i} due to very low user confidence:`, frame.userConfidence);
          }
          continue;
        }
  
        // Track instrumental parts as "silence"
        if (frame.isInstrumental) {
          silenceTime += frameDuration;
          continue;
        }
  
        // Calculate pitch accuracy zone
        const semitoneDiff = this.calculateSemitoneDifference(frame.userPitch, frame.targetPitch);
        
        // If no target pitch available, give partial credit for any singing
        if (frame.targetPitch <= 0) {
          if (frame.userPitch > 0) {
            // Give partial credit for singing when no reference is available
            keepTryingTime += frameDuration * 0.7; // 70% credit
          }
        } else {
          // Very generous zone calculation to reward good singing (extended ranges)
          if (semitoneDiff <= 1.5) {
            perfectTime += frameDuration;
          } else if (semitoneDiff <= 2.5) {
            greatTime += frameDuration;
          } else if (semitoneDiff <= 4.0) {
            keepTryingTime += frameDuration;
          } else {
            offPitchTime += frameDuration;
          }
        }
      }
  
      return {
        perfectTime,
        greatTime,
        keepTryingTime,
        offPitchTime,
        skippedTime,
        silenceTime,
        totalTime
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
        greatZone: 0,
        keepTryingZone: 0,
        offPitchZone: 0,
        skippedFrames: 0,
        silenceReward: 0,
        totalScore: 80, // Instantaneous score starts at 80
        cumulativeScore: 80, // Cumulative score starts at 80
        zoneBreakdown: {
          perfectTime: 0,
          greatTime: 0,
          keepTryingTime: 0,
          offPitchTime: 0,
          skippedTime: 0,
          silenceTime: 0,
          totalTime: 0
        }
      };
    }
  
    /**
     * Get score feedback based on zone performance
     */
    getScoreFeedback(score: ZoneScoreData): string {
      const { perfectZone, greatZone, keepTryingZone, offPitchZone, silenceReward, totalScore } = score;
  
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
      const { perfectZone, greatZone, keepTryingZone, offPitchZone, silenceReward } = score;

      if (perfectZone > 0.6) {
        feedback.push("🎵 Excellent pitch accuracy!");
      } else if (perfectZone > 0.4) {
        feedback.push("🎶 Good pitch accuracy!");
      } else if (perfectZone < 0.2) {
        feedback.push("🎤 Work on pitch accuracy");
      }

      if (greatZone > 0.3) {
        feedback.push("🌟 Great job staying close to the pitch!");
      }

      if (keepTryingZone > 0.3) {
        feedback.push("👍 You're getting close!");
      }

      if (offPitchZone > 0.3) {
        feedback.push("🎯 Focus on matching the melody");
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
      if (totalScore >= 95) return 'S+';
      if (totalScore >= 90) return 'S';
      if (totalScore >= 85) return 'A+';
      if (totalScore >= 80) return 'A';
      if (totalScore >= 75) return 'B+';
      if (totalScore >= 70) return 'B';
      if (totalScore >= 65) return 'C+';
      if (totalScore >= 60) return 'C';
      if (totalScore >= 55) return 'D+';
      if (totalScore >= 50) return 'D';
      return 'F';
    }
  
    /**
     * Reset the scoring system
     */
    reset(): void {
      this.analysisHistory = [];
      this.scoreHistory = []; // Clear score history on reset
      this.instantaneousScoreHistory = []; // Clear instantaneous score history
      this.cachedScore = null; // Clear cached score
      this.lastScoreUpdate = 0; // Reset update timestamp
      console.log('Zone scoring system reset');
    }
  
    /**
     * Get recent performance trend
     */
    getPerformanceTrend(windowSize: number = 50): 'improving' | 'declining' | 'stable' {
      if (this.analysisHistory.length < windowSize * 2) {
        return 'stable';
      }
  
      const recentFrames = this.analysisHistory.slice(-windowSize);
      const olderFrames = this.analysisHistory.slice(-windowSize * 2, -windowSize);
  
      const recentScore = this.calculateScoreForFrames(recentFrames);
      const olderScore = this.calculateScoreForFrames(olderFrames);
  
      const difference = recentScore - olderScore;
      
      if (difference > 5) return 'improving';
      if (difference < -5) return 'declining';
      return 'stable';
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
          const semitoneDiff = this.calculateSemitoneDifference(frame.userPitch, frame.targetPitch);
          if (semitoneDiff <= 1.5) {
            totalScore += 100;
          } else if (semitoneDiff <= 2.5) {
            totalScore += 95;
          } else if (semitoneDiff <= 4.0) {
            totalScore += 80;
          } else {
            totalScore += 60;
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