import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { PitchFrame } from '../lib/pitchAnalysis';

interface MicrophoneInputProps {
  onPitchDetected: (frame: PitchFrame) => void;
  onVolumeChange: (volume: number) => void;
  isEnabled: boolean;
  className?: string;
}

export default function MicrophoneInput({
  onPitchDetected,
  onVolumeChange,
  isEnabled,
  className = ''
}: MicrophoneInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);
  const timeDomainArrayRef = useRef<Float32Array | null>(null);

  // Initialize audio context and microphone
  const initializeMicrophone = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
      setPermissionGranted(true);
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create microphone source
      const microphone = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = microphone;
      
      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;
      
      // Connect microphone to analyser
      microphone.connect(analyser);
      
      // Create data arrays
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Float32Array(bufferLength);
      timeDomainArrayRef.current = new Float32Array(bufferLength);
      
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      setError('Failed to access microphone. Please check permissions.');
      setPermissionGranted(false);
    }
  }, []);

  // YIN pitch detection algorithm
  const detectPitchYIN = useCallback((timeDomainData: Float32Array): { frequency: number; confidence: number } => {
    const threshold = 0.15;
    const minFrequency = 80;
    const maxFrequency = 1000;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    const minPeriod = Math.floor(sampleRate / maxFrequency);
    const maxPeriod = Math.floor(sampleRate / minFrequency);
    
    // Calculate difference function
    const differenceFunction = calculateDifferenceFunction(timeDomainData, maxPeriod);
    
    // Calculate cumulative mean normalized difference function
    const cmndf = calculateCMNDF(differenceFunction, minPeriod);
    
    // Find first minimum below threshold
    for (let tau = minPeriod; tau < Math.min(maxPeriod, cmndf.length); tau++) {
      if (cmndf[tau] < threshold) {
        // Parabolic interpolation for better accuracy
        const betterTau = parabolicInterpolation(cmndf, tau);
        const frequency = sampleRate / betterTau;
        
        // Calculate confidence based on how far below threshold
        const confidence = Math.max(0, Math.min(1, (threshold - cmndf[tau]) / threshold));
        
        return { frequency, confidence };
      }
    }
    
    return { frequency: 0, confidence: 0 };
  }, []);

  // Helper functions for YIN algorithm
  const calculateDifferenceFunction = (data: Float32Array, maxPeriod: number): Float32Array => {
    const diff = new Float32Array(maxPeriod);
    
    for (let tau = 0; tau < maxPeriod; tau++) {
      let sum = 0;
      for (let i = 0; i < data.length - tau; i++) {
        const delta = data[i] - data[i + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }
    
    return diff;
  };

  const calculateCMNDF = (diff: Float32Array, minPeriod: number): Float32Array => {
    const cmndf = new Float32Array(diff.length);
    
    for (let tau = minPeriod; tau < diff.length; tau++) {
      let sum = 0;
      for (let i = 0; i < tau; i++) {
        sum += diff[i];
      }
      cmndf[tau] = diff[tau] / (sum / tau);
    }
    
    return cmndf;
  };

  const parabolicInterpolation = (cmndf: Float32Array, tau: number): number => {
    if (tau <= 0 || tau >= cmndf.length - 1) {
      return tau;
    }
    
    const x0 = tau - 1;
    const x1 = tau;
    const x2 = tau + 1;
    
    const y0 = cmndf[x0];
    const y1 = cmndf[x1];
    const y2 = cmndf[x2];
    
    const a = (y0 - 2 * y1 + y2) / 2;
    const b = (y2 - y0) / 2;
    
    if (a === 0) return tau;
    
    return tau - b / (2 * a);
  };

  // Calculate volume level
  const calculateVolume = useCallback((frequencyData: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += Math.pow(10, frequencyData[i] / 20);
    }
    return Math.log10(sum / frequencyData.length) * 20;
  }, []);

  // Main analysis loop
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !timeDomainArrayRef.current) {
      return;
    }

    analyserRef.current.getFloatFrequencyData(dataArrayRef.current);
    analyserRef.current.getFloatTimeDomainData(timeDomainArrayRef.current);
    
    // Calculate volume
    const currentVolume = calculateVolume(dataArrayRef.current);
    setVolume(currentVolume);
    onVolumeChange(isMuted ? 0 : currentVolume);
    
    // Detect pitch if not muted and enabled
    if (!isMuted && isEnabled) {
      const pitch = detectPitchYIN(timeDomainArrayRef.current);
      
      if (pitch.frequency > 0 && pitch.confidence > 0.1) {
        const frame: PitchFrame = {
          timestamp: Date.now(),
          frequency: pitch.frequency,
          confidence: pitch.confidence,
          volume: currentVolume
        };
        
        onPitchDetected(frame);
      }
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [detectPitchYIN, calculateVolume, onPitchDetected, onVolumeChange, isMuted, isEnabled]);

  // Start/stop recording
  const toggleRecording = useCallback(() => {
    if (!permissionGranted) {
      initializeMicrophone();
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    } else {
      setIsRecording(true);
      analyzeAudio();
    }
  }, [isRecording, permissionGranted, initializeMicrophone, analyzeAudio]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Microphone Input</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-colors ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-gray-700 hover:bg-red-500 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Recording Button */}
        <div className="flex justify-center">
          <button
            onClick={toggleRecording}
            disabled={!permissionGranted && !error}
            className={`flex items-center space-x-3 px-6 py-3 rounded-lg font-semibold transition-all transform ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white scale-105'
                : permissionGranted
                ? 'bg-red-500 hover:bg-red-500/80 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isRecording ? (
              <>
                <MicOff className="w-6 h-6" />
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                <span>{permissionGranted ? 'Start Recording' : 'Enable Microphone'}</span>
              </>
            )}
          </button>
        </div>

        {/* Volume Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Volume Level</span>
            <span>{Math.round(volume)} dB</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-100 ${
                volume > -20 ? 'bg-green-400' : 
                volume > -40 ? 'bg-yellow-400' : 'bg-gray-600'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, (volume + 60) * 1.67))}%` }}
            />
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              permissionGranted ? 'bg-green-400' : 'bg-gray-600'
            }`} />
            <span className="text-gray-400">
              {permissionGranted ? 'Microphone Ready' : 'No Permission'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'
            }`} />
            <span className="text-gray-400">
              {isRecording ? 'Recording' : 'Stopped'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Click "Enable Microphone" to grant permission</p>
          <p>• Use headphones to prevent feedback</p>
          <p>• Sing clearly into your microphone</p>
          <p>• The app will analyze your pitch in real-time</p>
        </div>
      </div>
    </div>
  );
}