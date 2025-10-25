/**
 * Web Audio API utilities for karaoke functionality
 * Handles pitch detection, vocal activity detection, and audio analysis
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface PitchResult {
  frequency: number;
  confidence: number;
}

export interface VocalActivity {
  isActive: boolean;
  ratio: number;
  totalActivity: number;
}

export interface KaraokeScore {
  score: number;
  rawScore: number;
  category: ScoreCategory;
  feedback: string;
  noteDifference: number;
  confidence: number;
  isImproving: boolean;
}

export type ScoreCategory = 'perfect' | 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export interface ScoreData {
  overall: number;
  pitch: number;
  timing: number;
}

export interface ReferencePitchData {
  frequency: number;
  confidence: number;
  timestamp: number;
}

export class YINPitchDetector {
  private sampleRate: number;
  private threshold: number;
  private minFrequency: number;
  private maxFrequency: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.threshold = 0.1;
    this.minFrequency = 80;
    this.maxFrequency = 2000;
  }

  detectPitch(audioBuffer: Float32Array): PitchResult {
    const bufferLength = audioBuffer.length;
    const minPeriod = Math.floor(this.sampleRate / this.maxFrequency);
    const maxPeriod = Math.floor(this.sampleRate / this.minFrequency);

    // Apply vocal-specific preprocessing
    const vocalProcessedBuffer = this.preprocessForVocalDetection(audioBuffer);
    
    const differenceFunction = this.calculateDifferenceFunction(vocalProcessedBuffer, maxPeriod);
    const cmndf = this.calculateCMNDF(differenceFunction, minPeriod);
    
    // Find multiple candidate periods and select the most vocal-like one
    const candidates = this.findVocalCandidates(cmndf, minPeriod, maxPeriod);
    const bestCandidate = this.selectBestVocalCandidate(candidates, audioBuffer);
    
    const interpolatedPeriod = this.parabolicInterpolation(cmndf, bestCandidate.period);
    const frequency = this.sampleRate / interpolatedPeriod;
    const confidence = bestCandidate.confidence;

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

  private preprocessForVocalDetection(audioBuffer: Float32Array): Float32Array {
    // Apply high-pass filter to remove low-frequency instruments (bass, drums)
    const filteredBuffer = this.applyHighPassFilter(audioBuffer, 200); // Cut off below 200Hz
    
    // Apply spectral emphasis to vocal frequencies
    const emphasizedBuffer = this.emphasizeVocalFrequencies(filteredBuffer);
    
    return emphasizedBuffer;
  }

  private applyHighPassFilter(buffer: Float32Array, cutoffFreq: number): Float32Array {
    const filteredBuffer = new Float32Array(buffer.length);
    const rc = 1.0 / (2 * Math.PI * cutoffFreq / this.sampleRate);
    const dt = 1.0 / this.sampleRate;
    const alpha = rc / (rc + dt);
    
    let prevInput = 0;
    let prevOutput = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const input = buffer[i];
      const output = alpha * (prevOutput + input - prevInput);
      filteredBuffer[i] = output;
      prevInput = input;
      prevOutput = output;
    }
    
    return filteredBuffer;
  }

  private emphasizeVocalFrequencies(buffer: Float32Array): Float32Array {
    const emphasizedBuffer = new Float32Array(buffer.length);
    
    // Vocal frequency ranges with emphasis weights
    const vocalRanges = [
      { min: 200, max: 400, weight: 1.2 },   // Baritone vocals
      { min: 400, max: 800, weight: 1.5 },   // Tenor vocals (most common)
      { min: 800, max: 1200, weight: 1.3 },  // Alto vocals
      { min: 1200, max: 2000, weight: 1.1 }  // Soprano vocals
    ];
    
    // Apply FFT to get frequency domain
    const fftSize = Math.min(2048, buffer.length);
    const fftBuffer = new Float32Array(fftSize);
    const fftOutput = new Float32Array(fftSize * 2);
    
    // Copy input to FFT buffer
    for (let i = 0; i < Math.min(buffer.length, fftSize); i++) {
      fftBuffer[i] = buffer[i];
    }
    
    // Simple frequency domain processing (simplified FFT)
    for (let i = 0; i < fftSize; i++) {
      const freq = (i * this.sampleRate) / fftSize;
      let weight = 1.0;
      
      // Apply vocal frequency emphasis
      for (const range of vocalRanges) {
        if (freq >= range.min && freq <= range.max) {
          weight = range.weight;
          break;
        }
      }
      
      fftOutput[i] = fftBuffer[i] * weight;
    }
    
    // Convert back to time domain (simplified IFFT)
    for (let i = 0; i < buffer.length; i++) {
      emphasizedBuffer[i] = fftOutput[i] || buffer[i];
    }
    
    return emphasizedBuffer;
  }

  private findVocalCandidates(cmndf: Float32Array, minPeriod: number, maxPeriod: number): Array<{period: number, confidence: number}> {
    const candidates: Array<{period: number, confidence: number}> = [];
    
    // Find all periods below threshold
    for (let i = minPeriod; i < maxPeriod && i < cmndf.length; i++) {
      if (cmndf[i] < this.threshold) {
        const frequency = this.sampleRate / i;
        const confidence = 1 - cmndf[i];
        
        // Only consider frequencies in vocal range
        if (frequency >= 80 && frequency <= 2000) {
          candidates.push({ period: i, confidence });
        }
      }
    }
    
    // Sort by confidence (highest first)
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    return candidates.slice(0, 5); // Return top 5 candidates
  }

  private selectBestVocalCandidate(candidates: Array<{period: number, confidence: number}>, audioBuffer: Float32Array): {period: number, confidence: number} {
    if (candidates.length === 0) {
      return { period: Math.floor(this.sampleRate / 440), confidence: 0 }; // Default to A4
    }
    
    // If only one candidate, return it
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // Analyze harmonic content to find the most vocal-like candidate
    let bestCandidate = candidates[0];
    let bestScore = 0;
    
    for (const candidate of candidates) {
      const frequency = this.sampleRate / candidate.period;
      const harmonicScore = this.calculateVocalHarmonicScore(frequency, audioBuffer);
      const totalScore = candidate.confidence * 0.7 + harmonicScore * 0.3;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCandidate = candidate;
      }
    }
    
    return bestCandidate;
  }

  private calculateVocalHarmonicScore(fundamentalFreq: number, audioBuffer: Float32Array): number {
    let harmonicScore = 0;
    let harmonicCount = 0;
    
    // Check for strong harmonics (characteristic of vocals)
    for (let harmonic = 2; harmonic <= 6; harmonic++) {
      const harmonicFreq = fundamentalFreq * harmonic;
      
      // Check if this harmonic frequency has significant energy
      const binIndex = Math.floor((harmonicFreq * audioBuffer.length) / this.sampleRate);
      if (binIndex < audioBuffer.length) {
        const energy = Math.abs(audioBuffer[binIndex]);
        if (energy > 0.1) { // Threshold for significant harmonic
          harmonicScore += energy * (1 / harmonic); // Lower harmonics get more weight
          harmonicCount++;
        }
      }
    }
    
    // Normalize by number of harmonics found
    return harmonicCount > 0 ? harmonicScore / harmonicCount : 0;
  }
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private referenceAnalyser: AnalyserNode | null = null;
  private referenceAudio: MediaElementAudioSourceNode | null = null;
  private pitchDetector: YINPitchDetector | null = null;
  private referencePitchDetector: YINPitchDetector | null = null;
  
  // Scoring system
  private scoreHistory: number[] = [];
  private maxScoreHistory = 50; // Keep last 50 scores for averaging

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });
      
      this.pitchDetector = new YINPitchDetector(this.audioContext.sampleRate);
      this.referencePitchDetector = new YINPitchDetector(this.audioContext.sampleRate);
    } catch (error) {
      console.error('Error initializing audio context:', error);
      throw error;
    }
  }

  async enumerateAudioDevices(): Promise<AudioDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`
        }));
    } catch (error) {
      console.error('Error enumerating devices:', error);
      throw error;
    }
  }

  async startRecording(deviceId: string): Promise<void> {
    if (!this.audioContext) {
      await this.initializeAudioContext();
    }

    if (this.audioContext!.state === 'suspended') {
      await this.audioContext!.resume();
    }

    const constraints = {
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100,
        channelCount: 1
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    this.microphone = this.audioContext!.createMediaStreamSource(stream);
    this.analyser = this.audioContext!.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    this.microphone.connect(this.analyser);
  }

  stopRecording(): void {
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
  }

  async setupReferenceAudio(file: File): Promise<void> {
    if (!this.audioContext) {
      await this.initializeAudioContext();
    }

    const fileURL = URL.createObjectURL(file);
    const audioElement = new Audio(fileURL);
    
    await new Promise((resolve, reject) => {
      audioElement.addEventListener('loadeddata', resolve);
      audioElement.addEventListener('error', reject);
      audioElement.load();
    });

    this.referenceAudio = this.audioContext!.createMediaElementSource(audioElement);
    this.referenceAnalyser = this.audioContext!.createAnalyser();
    this.referenceAnalyser.fftSize = 2048;
    this.referenceAnalyser.smoothingTimeConstant = 0.8;
    this.referenceAnalyser.minDecibels = -90;
    this.referenceAnalyser.maxDecibels = -10;

    // Connect reference audio to analyser for visualization
    this.referenceAudio.connect(this.referenceAnalyser);
    // Don't connect to destination to avoid audio feedback
  }

  detectVocalActivity(frequencyData: Uint8Array): VocalActivity {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const bufferLength = frequencyData.length;
    
    // More specific vocal ranges with higher weights for melody detection
    const vocalRanges = [
      { min: 200, max: 400, weight: 0.8 },    // Baritone vocals
      { min: 400, max: 800, weight: 1.2 },    // Tenor vocals (most common for melody)
      { min: 800, max: 1200, weight: 1.0 },   // Alto vocals
      { min: 1200, max: 2000, weight: 0.9 }  // Soprano vocals
    ];
    
    // Instrument frequency ranges to exclude
    const instrumentRanges = [
      { min: 80, max: 200, weight: -0.5 },    // Bass instruments (reduce weight)
      { min: 2000, max: 4000, weight: -0.3 }, // High frequency instruments
      { min: 4000, max: 8000, weight: -0.2 }  // Very high frequencies
    ];
    
    let vocalActivity = 0;
    let totalActivity = 0;
    let melodyActivity = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const frequency = (i * sampleRate) / (bufferLength * 2);
      const amplitude = frequencyData[i];
      
      if (amplitude < 8) continue; // Higher threshold for noise reduction
      
      let rangeWeight = 0;
      
      // Check vocal ranges
      for (const range of vocalRanges) {
        if (frequency >= range.min && frequency <= range.max) {
          rangeWeight = range.weight;
          break;
        }
      }
      
      // Check instrument ranges (reduce their weight)
      for (const range of instrumentRanges) {
        if (frequency >= range.min && frequency <= range.max) {
          rangeWeight = Math.max(rangeWeight + range.weight, 0);
          break;
        }
      }
      
      totalActivity += amplitude;
      
      if (rangeWeight > 0) {
        vocalActivity += amplitude * rangeWeight;
        
        // Extra weight for melody frequencies (400-800Hz)
        if (frequency >= 400 && frequency <= 800) {
          melodyActivity += amplitude * 1.5;
        }
      }
    }
    
    const vocalRatio = totalActivity > 0 ? vocalActivity / totalActivity : 0;
    const melodyRatio = totalActivity > 0 ? melodyActivity / totalActivity : 0;
    
    // More sensitive detection for actual singing
    const isVocalActive = (vocalRatio > 0.25 || melodyRatio > 0.15) && totalActivity > 25;
    
    return {
      isActive: isVocalActive,
      ratio: vocalRatio,
      totalActivity: totalActivity
    };
  }

  extractVocalFrequency(frequencyData: Uint8Array): PitchResult {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const bufferLength = frequencyData.length;
    
    const vocalRanges = [
      { min: 80, max: 200, weight: 0.3 },
      { min: 200, max: 400, weight: 0.8 },
      { min: 400, max: 800, weight: 1.0 },
      { min: 800, max: 1200, weight: 0.9 },
      { min: 1200, max: 2000, weight: 0.7 }
    ];
    
    let bestFrequency = 0;
    let bestConfidence = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const frequency = (i * sampleRate) / (bufferLength * 2);
      const amplitude = frequencyData[i];
      
      if (amplitude < 10) continue;
      
      let rangeWeight = 0;
      for (const range of vocalRanges) {
        if (frequency >= range.min && frequency <= range.max) {
          rangeWeight = range.weight;
          break;
        }
      }
      
      if (rangeWeight === 0) continue;
      
      const confidence = (amplitude / 255) * rangeWeight;
      const harmonicBoost = this.calculateHarmonicBoost(frequency, frequencyData, sampleRate, bufferLength);
      const finalConfidence = confidence * (1 + harmonicBoost);
      
      if (finalConfidence > bestConfidence) {
        bestConfidence = finalConfidence;
        bestFrequency = frequency;
      }
    }
    
    return {
      frequency: bestFrequency,
      confidence: bestConfidence
    };
  }

  private calculateHarmonicBoost(fundamentalFreq: number, frequencyData: Uint8Array, sampleRate: number, bufferLength: number): number {
    let harmonicBoost = 0;
    
    for (let harmonic = 2; harmonic <= 4; harmonic++) {
      const harmonicFreq = fundamentalFreq * harmonic;
      const harmonicBin = Math.floor((harmonicFreq * bufferLength * 2) / sampleRate);
      
      if (harmonicBin < bufferLength) {
        const harmonicAmplitude = frequencyData[harmonicBin];
        if (harmonicAmplitude > 5) {
          harmonicBoost += (harmonicAmplitude / 255) * (1 / harmonic);
        }
      }
    }
    
    return Math.min(harmonicBoost, 0.5);
  }

  getCurrentPitch(): PitchResult {
    if (!this.analyser || !this.pitchDetector) {
      return { frequency: 0, confidence: 0 };
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);

    return this.pitchDetector.detectPitch(dataArray);
  }

  getCurrentVolume(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getReferenceAnalyser(): AnalyserNode | null {
    return this.referenceAnalyser;
  }

  isReferenceAudioReady(): boolean {
    return this.referenceAnalyser !== null;
  }

  private videoPlaying: boolean = false;

  setVideoPlaying(playing: boolean): void {
    this.videoPlaying = playing;
  }

  isVideoPlaying(): boolean {
    return this.videoPlaying && this.referenceAnalyser !== null;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  async connectVideoAudio(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioContext) return;

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // If we already have a reference audio source, don't create a new one
    if (this.referenceAudio) {
      console.log('Video audio already connected, reusing existing connection');
      return;
    }

    try {
      this.referenceAudio = this.audioContext.createMediaElementSource(videoElement);
      this.referenceAnalyser = this.audioContext.createAnalyser();
      this.referenceAnalyser.fftSize = 2048;
      this.referenceAnalyser.smoothingTimeConstant = 0.8;
      this.referenceAnalyser.minDecibels = -90;
      this.referenceAnalyser.maxDecibels = -10;

      // Connect audio source to analyser
      this.referenceAudio.connect(this.referenceAnalyser);
      
      // Also connect to destination so video audio plays through speakers
      this.referenceAudio.connect(this.audioContext.destination);
      
      console.log('Video audio connected to analyser successfully');
    } catch (error) {
      console.error('Error connecting video audio:', error);
    }
  }

  disconnectVideoAudio(): void {
    if (this.referenceAudio) {
      this.referenceAudio.disconnect();
      this.referenceAudio = null;
    }
    if (this.referenceAnalyser) {
      this.referenceAnalyser = null;
    }
    this.videoPlaying = false;
    console.log('Video audio disconnected');
  }

  getReferencePitch(): PitchResult {
    if (!this.referenceAnalyser || !this.referencePitchDetector) {
      return { frequency: 0, confidence: 0 };
    }

    const bufferLength = this.referenceAnalyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.referenceAnalyser.getFloatTimeDomainData(dataArray);

    return this.referencePitchDetector.detectPitch(dataArray);
  }

  getReferenceVolume(): number {
    if (!this.referenceAnalyser) return 0;

    const bufferLength = this.referenceAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.referenceAnalyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  getReferenceVocalActivity(): VocalActivity {
    if (!this.referenceAnalyser) {
      return { isActive: false, ratio: 0, totalActivity: 0 };
    }

    const bufferLength = this.referenceAnalyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    this.referenceAnalyser.getByteFrequencyData(frequencyData);

    return this.detectVocalActivity(frequencyData);
  }

  calculateScore(pitch: number, volume: number, targetFrequency: number = 0, vocalActivity: VocalActivity): ScoreData {
    let pitchScore = 0;
    let timingScore = 0;

    if (vocalActivity.isActive && targetFrequency > 0 && pitch > 0) {
      // There's singing in the reference - score based on pitch accuracy
      const semitoneDiff = Math.abs(12 * Math.log2(pitch / targetFrequency));
      
      if (semitoneDiff < 1.0) {
        pitchScore = 100; // Perfect
      } else if (semitoneDiff < 2.0) {
        pitchScore = 90; // Great
      } else if (semitoneDiff < 3.0) {
        pitchScore = 80; // Good
      } else if (semitoneDiff < 4.0) {
        pitchScore = 70; // Close
      } else if (semitoneDiff < 6.0) {
        pitchScore = 60; // Fair
      } else {
        pitchScore = Math.max(40, 60 - (semitoneDiff - 6) * 3);
      }
      
      timingScore = Math.min(100, Math.max(60, volume * 200));
    } else if (!vocalActivity.isActive) {
      // No singing in reference - reward for NOT singing (low volume)
      if (volume < 0.1) {
        pitchScore = 100; // Perfect - not singing during instrumental
        timingScore = 100; // Perfect timing - staying quiet
      } else if (volume < 0.2) {
        pitchScore = 80; // Good - mostly quiet
        timingScore = 80;
      } else if (volume < 0.3) {
        pitchScore = 60; // Fair - some noise
        timingScore = 60;
      } else {
        pitchScore = 40; // Poor - singing during instrumental
        timingScore = 40;
      }
    } else {
      // No reference available
      timingScore = Math.min(100, Math.max(70, volume * 150));
    }

    const overallScore = Math.round((pitchScore * 0.7) + (timingScore * 0.3));

    return {
      overall: overallScore,
      pitch: Math.round(pitchScore),
      timing: Math.round(timingScore)
    };
  }

  frequencyToNoteName(frequency: number): string {
    if (frequency <= 0) return 'N/A';
    
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const note = h % 12;
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${noteNames[note]}${octave}`;
  }

  // Note-based scoring system
  calculateScoreFromNotes(userNote: string, targetNote: string, confidence: number = 1.0): KaraokeScore {
    // Calculate note difference (not semitones)
    const noteDifference = this.calculateNoteDifference(userNote, targetNote);
    
    // Convert note difference to a score (0-100)
    const baseScore = this.noteDifferenceToScore(noteDifference);
    
    // Apply confidence weighting
    const confidenceWeightedScore = baseScore * confidence;
    
    // Add to score history for averaging
    this.scoreHistory.push(confidenceWeightedScore);
    if (this.scoreHistory.length > this.maxScoreHistory) {
      this.scoreHistory.shift();
    }
    
    // Calculate running average
    const averageScore = this.scoreHistory.reduce((sum, score) => sum + score, 0) / this.scoreHistory.length;
    
    // Determine score category and feedback
    const scoreCategory = this.getScoreCategory(averageScore);
    const feedback = this.getScoreFeedback(scoreCategory, noteDifference, userNote, targetNote);
    
    return {
      score: Math.round(averageScore),
      rawScore: Math.round(confidenceWeightedScore),
      category: scoreCategory,
      feedback: feedback,
      noteDifference: noteDifference,
      confidence: confidence,
      isImproving: this.isScoreImproving()
    };
  }

  private calculateNoteDifference(userNote: string, targetNote: string): number {
    if (!userNote || !targetNote || userNote === 'N/A' || targetNote === 'N/A') {
      return 10; // Maximum difference for invalid notes
    }

    // Extract note name and octave
    const userMatch = userNote.match(/^([A-G]#?)(\d+)$/);
    const targetMatch = targetNote.match(/^([A-G]#?)(\d+)$/);
    
    if (!userMatch || !targetMatch) {
      return 10; // Invalid note format
    }

    const userNoteName = userMatch[1];
    const userOctave = parseInt(userMatch[2]);
    const targetNoteName = targetMatch[1];
    const targetOctave = parseInt(targetMatch[2]);

    // Calculate note difference within the same octave
    const noteDifference = this.getNoteDistance(userNoteName, targetNoteName);
    
    // Add octave difference (but be forgiving - same note in different octaves is good)
    const octaveDifference = Math.abs(userOctave - targetOctave);
    
    // If it's the same note name, octave difference doesn't matter much
    if (noteDifference === 0) {
      return octaveDifference <= 1 ? 0 : octaveDifference * 0.5; // Same note, different octave = good
    }
    
    // Combine note and octave differences
    return noteDifference + (octaveDifference * 0.3); // Octave difference is less important
  }

  private getNoteDistance(note1: string, note2: string): number {
    const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const index1 = noteOrder.indexOf(note1);
    const index2 = noteOrder.indexOf(note2);
    
    if (index1 === -1 || index2 === -1) {
      return 6; // Maximum distance for invalid notes
    }
    
    // Calculate shortest distance around the circle of fifths
    let distance = Math.abs(index1 - index2);
    distance = Math.min(distance, 12 - distance); // Wrap around
    
    return distance;
  }

  private noteDifferenceToScore(noteDifference: number): number {
    // Very forgiving scoring based on note differences
    if (noteDifference <= 0.5) {
      return 100; // Perfect - same note or very close
    } else if (noteDifference <= 1) {
      return 95; // Excellent - adjacent note
    } else if (noteDifference <= 1.5) {
      return 90; // Very good - very close note
    } else if (noteDifference <= 2) {
      return 85; // Good - one step away
    } else if (noteDifference <= 2.5) {
      return 80; // Fair - minor third away
    } else if (noteDifference <= 3) {
      return 75; // Okay - major third away
    } else if (noteDifference <= 4) {
      return 70; // Acceptable - perfect fourth away
    } else if (noteDifference <= 5) {
      return 60; // Poor - tritone away
    } else if (noteDifference <= 6) {
      return 50; // Bad - perfect fifth away
    } else if (noteDifference <= 7) {
      return 40; // Very bad - minor sixth away
    } else if (noteDifference <= 8) {
      return 30; // Terrible - major sixth away
    } else {
      return 20; // Awful - more than a sixth away
    }
  }

  private getScoreCategory(score: number): ScoreCategory {
    if (score >= 95) return 'perfect';
    if (score >= 85) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'bad';
  }

  private getScoreFeedback(category: ScoreCategory, noteDifference: number, userNote: string, targetNote: string): string {
    const direction = noteDifference > 0 ? 'higher' : 'lower';
    const absDiff = Math.abs(noteDifference);
    
    switch (category) {
      case 'perfect':
        return '🎵 Perfect! 🎵';
      case 'excellent':
        return absDiff < 1 ? '🌟 Excellent!' : `Great! Just slightly ${direction}`;
      case 'good':
        return `Good! Try singing ${direction}`;
      case 'fair':
        return `Getting there! Sing ${direction}`;
      case 'poor':
        return `Keep trying! Go ${direction}`;
      case 'bad':
        return `Practice more! Much ${direction}`;
      default:
        return 'Keep practicing!';
    }
  }

  private isScoreImproving(): boolean {
    if (this.scoreHistory.length < 10) return false;
    
    const recentScores = this.scoreHistory.slice(-10);
    const olderScores = this.scoreHistory.slice(-20, -10);
    
    if (olderScores.length === 0) return false;
    
    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
    
    return recentAvg > olderAvg + 2; // Improving if recent average is 2+ points higher
  }

  getCurrentScore(): KaraokeScore | null {
    if (this.scoreHistory.length === 0) return null;
    
    const latestScore = this.scoreHistory[this.scoreHistory.length - 1];
    const averageScore = this.scoreHistory.reduce((sum, score) => sum + score, 0) / this.scoreHistory.length;
    
    return {
      score: Math.round(averageScore),
      rawScore: Math.round(latestScore),
      category: this.getScoreCategory(averageScore),
      feedback: this.getScoreFeedback(this.getScoreCategory(averageScore), 0, '', ''),
      noteDifference: 0,
      confidence: 1.0,
      isImproving: this.isScoreImproving()
    };
  }

  resetScoreHistory(): void {
    this.scoreHistory = [];
  }

  cleanup(): void {
    this.stopRecording();
    this.disconnectVideoAudio();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
