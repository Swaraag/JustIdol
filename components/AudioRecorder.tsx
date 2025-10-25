'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { YINPitchDetector, PitchFrame } from '@/lib/pitchAnalysis';

interface AudioRecorderProps {
  onRecordingData: (frames: PitchFrame[]) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  isPlaying: boolean;
}

export default function AudioRecorder({ 
  onRecordingData, 
  onRecordingStateChange,
  isPlaying 
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentNote, setCurrentNote] = useState<string>('N/A');
  const [confidence, setConfidence] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pitchDetectorRef = useRef<YINPitchDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingFramesRef = useRef<PitchFrame[]>([]);
  const startTimeRef = useRef<number>(0);

  // Initialize audio context and pitch detector
  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
          }
        });
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        microphone.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        microphoneRef.current = microphone;
        pitchDetectorRef.current = new YINPitchDetector(audioContext.sampleRate);
        
        // Stop the initial stream
        stream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };
    
    initAudio();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });
      
      if (!audioContextRef.current || !analyserRef.current || !pitchDetectorRef.current) {
        throw new Error('Audio context not initialized');
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      microphone.connect(analyserRef.current);
      
      microphoneRef.current = microphone;
      recordingFramesRef.current = [];
      startTimeRef.current = Date.now();
      
      setIsRecording(true);
      setIsPaused(false);
      onRecordingStateChange(true);
      
      // Start real-time analysis
      analyzeAudio();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  }, [onRecordingStateChange]);

  const stopRecording = useCallback(() => {
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0);
    setCurrentNote('N/A');
    setConfidence(0);
    onRecordingStateChange(false);
    
    // Send recorded data
    onRecordingData(recordingFramesRef.current);
  }, [onRecordingData, onRecordingStateChange]);

  const pauseRecording = useCallback(() => {
    setIsPaused(!isPaused);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPaused]);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !pitchDetectorRef.current || !isRecording || isPaused) {
      return;
    }
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);
    
    // Calculate audio level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setAudioLevel(rms * 100);
    
    // Detect pitch
    const pitchResult = pitchDetectorRef.current.detectPitch(dataArray);
    
    if (pitchResult.confidence > 0.3) {
      const timestamp = Date.now() - startTimeRef.current;
      
      // Convert frequency to note name
      const noteName = frequencyToNoteName(pitchResult.frequency);
      setCurrentNote(noteName);
      setConfidence(pitchResult.confidence);
      
      // Store pitch frame
      recordingFramesRef.current.push({
        frequency: pitchResult.frequency,
        confidence: pitchResult.confidence,
        timestamp: timestamp
      });
    }
    
    // Continue analysis
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [isRecording, isPaused]);

  // Convert frequency to note name
  const frequencyToNoteName = (frequency: number): string => {
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    if (frequency <= 0) return 'N/A';
    
    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const note = h % 12;
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${noteNames[note]}${octave}`;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Microphone</h2>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-gray-400">
            {currentNote} ({confidence.toFixed(2)})
          </div>
        </div>
      </div>
      
      {/* Audio Level Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Audio Level</span>
          <span className="text-sm text-gray-400">{audioLevel.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-karaoke-success h-2 rounded-full transition-all duration-100"
            style={{ width: `${Math.min(100, audioLevel)}%` }}
          />
        </div>
      </div>
      
      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isPlaying}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic className="w-5 h-5" />
            <span>Start Recording</span>
          </button>
        ) : (
          <>
            <button
              onClick={pauseRecording}
              className="btn-secondary flex items-center space-x-2"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={stopRecording}
              className="btn-primary flex items-center space-x-2 bg-red-600 hover:bg-red-700"
            >
              <Square className="w-5 h-5" />
              <span>Stop Recording</span>
            </button>
          </>
        )}
      </div>
      
      {/* Recording Status */}
      {isRecording && (
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-semibold">
              {isPaused ? 'Recording Paused' : 'Recording...'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Sing along with the backing track
          </p>
        </div>
      )}
    </div>
  );
}
