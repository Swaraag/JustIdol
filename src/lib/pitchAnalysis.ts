/**
 * Pitch Analysis Utilities
 * Implements YIN algorithm for pitch detection and comparison
 */

export interface PitchFrame {
  frequency: number;
  confidence: number;
  timestamp: number;
}

export interface PitchAnalysisResult {
  pitchAccuracy: number; // 0-100
  timingAccuracy: number; // 0-100
  vocalStability: number; // 0-100
  overallScore: number; // 0-100
  noteName: string;
  centsOff: number;
}

/**
 * YIN Algorithm for pitch detection
 * Based on the YIN pitch detection algorithm
 */
export class YINPitchDetector {
  private sampleRate: number;
  private threshold: number = 0.1;
  private minFrequency: number = 80;
  private maxFrequency: number = 2000;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  /**
   * Detect pitch using YIN algorithm
   */
  detectPitch(audioBuffer: Float32Array): { frequency: number; confidence: number } {
    const bufferLength = audioBuffer.length;
    const minPeriod = Math.floor(this.sampleRate / this.maxFrequency);
    const maxPeriod = Math.floor(this.sampleRate / this.minFrequency);

    // Calculate difference function
    const differenceFunction = this.calculateDifferenceFunction(audioBuffer, maxPeriod);
    
    // Calculate cumulative mean normalized difference function
    const cmndf = this.calculateCMNDF(differenceFunction, minPeriod);
    
    // Find the first minimum below threshold
    let period = minPeriod;
    for (let i = minPeriod; i < maxPeriod && i < cmndf.length; i++) {
      if (cmndf[i] < this.threshold) {
        period = i;
        break;
      }
    }

    // Parabolic interpolation for better accuracy
    const interpolatedPeriod = this.parabolicInterpolation(cmndf, period);
    const frequency = this.sampleRate / interpolatedPeriod;
    const confidence = 1 - cmndf[period];

    return {
      frequency: Math.max(this.minFrequency, Math.min(this.maxFrequency, frequency)),
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }

  private calculateDifferenceFunction(buffer: Float32Array, maxPeriod: number): Float32Array {
    const bufferLength = buffer.length;
    const differenceFunction = new Float32Array(maxPeriod);
    
    for (let tau = 0; tau < maxPeriod; tau++) {
      let sum = 0;
      for (let i = 0; i < bufferLength - tau; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      differenceFunction[tau] = sum;
    }
    
    return differenceFunction;
  }

  private calculateCMNDF(differenceFunction: Float32Array, minPeriod: number): Float32Array {
    const cmndf = new Float32Array(differenceFunction.length);
    let runningSum = 0;
    
    for (let tau = 0; tau < differenceFunction.length; tau++) {
      runningSum += differenceFunction[tau];
      if (tau < minPeriod) {
        cmndf[tau] = 1;
      } else {
        cmndf[tau] = differenceFunction[tau] * tau / runningSum;
      }
    }
    
    return cmndf;
  }

  private parabolicInterpolation(cmndf: Float32Array, period: number): number {
    if (period <= 0 || period >= cmndf.length - 1) {
      return period;
    }

    const y1 = cmndf[period - 1];
    const y2 = cmndf[period];
    const y3 = cmndf[period + 1];

    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;

    if (a === 0) return period;
    
    return period - b / (2 * a);
  }
}

/**
 * Convert frequency to note name and cents
 */
export function frequencyToNote(frequency: number): { noteName: string; centsOff: number } {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  
  if (frequency <= 0) {
    return { noteName: 'N/A', centsOff: 0 };
  }

  const h = Math.round(12 * Math.log2(frequency / C0));
  const octave = Math.floor(h / 12);
  const note = h % 12;
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = `${noteNames[note]}${octave}`;
  
  const exactFrequency = C0 * Math.pow(2, h / 12);
  const centsOff = 1200 * Math.log2(frequency / exactFrequency);
  
  return { noteName, centsOff };
}

/**
 * Calculate pitch accuracy based on semitone difference
 */
export function calculatePitchAccuracy(targetFreq: number, actualFreq: number): number {
  if (targetFreq <= 0 || actualFreq <= 0) return 0;
  
  const semitoneDiff = Math.abs(12 * Math.log2(actualFreq / targetFreq));
  const maxSemitoneDiff = 2; // Allow up to 2 semitones off
  
  return Math.max(0, 100 - (semitoneDiff / maxSemitoneDiff) * 100);
}

/**
 * Calculate timing accuracy based on onset detection
 */
export function calculateTimingAccuracy(
  targetOnsets: number[],
  actualOnsets: number[],
  tolerance: number = 0.1
): number {
  if (targetOnsets.length === 0) return 100;
  
  let matchedOnsets = 0;
  const usedActualOnsets = new Set<number>();
  
  for (const targetOnset of targetOnsets) {
    for (let i = 0; i < actualOnsets.length; i++) {
      if (usedActualOnsets.has(i)) continue;
      
      const timeDiff = Math.abs(actualOnsets[i] - targetOnset);
      if (timeDiff <= tolerance) {
        matchedOnsets++;
        usedActualOnsets.add(i);
        break;
      }
    }
  }
  
  return (matchedOnsets / targetOnsets.length) * 100;
}

/**
 * Calculate vocal stability based on pitch variance
 */
export function calculateVocalStability(pitchFrames: PitchFrame[]): number {
  if (pitchFrames.length < 2) return 100;
  
  const validFrames = pitchFrames.filter(frame => frame.confidence > 0.3);
  if (validFrames.length < 2) return 0;
  
  const frequencies = validFrames.map(frame => frame.frequency);
  const mean = frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
  const variance = frequencies.reduce((sum, freq) => sum + Math.pow(freq - mean, 2), 0) / frequencies.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Convert to percentage (lower deviation = higher stability)
  const maxDeviation = 50; // Hz
  return Math.max(0, 100 - (standardDeviation / maxDeviation) * 100);
}

/**
 * Analyze pitch data and generate karaoke score
 */
export function analyzePitchPerformance(
  referenceFrames: PitchFrame[],
  userFrames: PitchFrame[]
): PitchAnalysisResult {
  if (referenceFrames.length === 0 || userFrames.length === 0) {
    return {
      pitchAccuracy: 0,
      timingAccuracy: 0,
      vocalStability: 0,
      overallScore: 0,
      noteName: 'N/A',
      centsOff: 0
    };
  }

  // Calculate pitch accuracy
  let totalPitchAccuracy = 0;
  let validComparisons = 0;
  
  for (const userFrame of userFrames) {
    if (userFrame.confidence < 0.3) continue;
    
    // Find closest reference frame in time
    const closestRef = referenceFrames.reduce((closest, ref) => {
      const timeDiff = Math.abs(ref.timestamp - userFrame.timestamp);
      const closestTimeDiff = Math.abs(closest.timestamp - userFrame.timestamp);
      return timeDiff < closestTimeDiff ? ref : closest;
    });
    
    if (closestRef.confidence > 0.3) {
      const accuracy = calculatePitchAccuracy(closestRef.frequency, userFrame.frequency);
      totalPitchAccuracy += accuracy;
      validComparisons++;
    }
  }
  
  const pitchAccuracy = validComparisons > 0 ? totalPitchAccuracy / validComparisons : 0;
  
  // Calculate timing accuracy (simplified - based on pitch changes)
  const referenceOnsets = this.detectOnsets(referenceFrames);
  const userOnsets = this.detectOnsets(userFrames);
  const timingAccuracy = calculateTimingAccuracy(referenceOnsets, userOnsets);
  
  // Calculate vocal stability
  const vocalStability = calculateVocalStability(userFrames);
  
  // Calculate overall score (weighted)
  const overallScore = (pitchAccuracy * 0.5) + (timingAccuracy * 0.3) + (vocalStability * 0.2);
  
  // Get current note info
  const latestUserFrame = userFrames[userFrames.length - 1];
  const { noteName, centsOff } = frequencyToNote(latestUserFrame.frequency);
  
  return {
    pitchAccuracy: Math.round(pitchAccuracy),
    timingAccuracy: Math.round(timingAccuracy),
    vocalStability: Math.round(vocalStability),
    overallScore: Math.round(overallScore),
    noteName,
    centsOff: Math.round(centsOff)
  };
}

/**
 * Detect onsets in pitch frames (simplified)
 */
function detectOnsets(frames: PitchFrame[]): number[] {
  const onsets: number[] = [];
  const threshold = 0.5; // Confidence threshold
  
  for (let i = 1; i < frames.length; i++) {
    const prevFrame = frames[i - 1];
    const currentFrame = frames[i];
    
    // Detect onset if confidence increases significantly
    if (currentFrame.confidence > threshold && 
        currentFrame.confidence > prevFrame.confidence + 0.2) {
      onsets.push(currentFrame.timestamp);
    }
  }
  
  return onsets;
}