import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { YINPitchDetector, PitchFrame } from '../lib/pitchAnalysis';

interface AudioPlayerProps {
  onReferenceData: (frames: PitchFrame[]) => void;
  onPlaybackStateChange: (isPlaying: boolean) => void;
}

export default function AudioPlayer({ onReferenceData, onPlaybackStateChange }: AudioPlayerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pitchDetectorRef = useRef<YINPitchDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const referenceFramesRef = useRef<PitchFrame[]>([]);

  // Initialize audio context
  useEffect(() => {
    const initAudioContext = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        pitchDetectorRef.current = new YINPitchDetector(audioContext.sampleRate);
        
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }
    };
    
    initAudioContext();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (MP3, WAV, etc.)');
      return;
    }
    
    setAudioFile(file);
    
    // Create audio element
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audioRef.current = audio;
    
    // Set up audio event listeners
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setIsPaused(false);
      onPlaybackStateChange(false);
    });
    
    // Connect to audio context for analysis
    if (audioContextRef.current && analyserRef.current) {
      const source = audioContextRef.current.createMediaElementSource(audio);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      sourceRef.current = source;
    }
    
    // Start analyzing the audio
    analyzeReferenceAudio();
    
  }, [onPlaybackStateChange]);

  const analyzeReferenceAudio = useCallback(async () => {
    if (!audioRef.current || !analyserRef.current || !pitchDetectorRef.current) return;
    
    setIsAnalyzing(true);
    referenceFramesRef.current = [];
    
    try {
      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Play audio silently for analysis
      const audio = audioRef.current;
      audio.volume = 0;
      audio.play();
      
      const startTime = Date.now();
      
      const analyzeFrame = () => {
        if (!analyserRef.current || !pitchDetectorRef.current) return;
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyserRef.current.getFloatTimeDomainData(dataArray);
        
        // Detect pitch
        const pitchResult = pitchDetectorRef.current.detectPitch(dataArray);
        
        if (pitchResult.confidence > 0.3) {
          const timestamp = Date.now() - startTime;
          
          referenceFramesRef.current.push({
            frequency: pitchResult.frequency,
            confidence: pitchResult.confidence,
            timestamp: timestamp
          });
        }
        
        // Continue analysis if audio is still playing
        if (!audio.paused && !audio.ended) {
          animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        } else {
          // Analysis complete
          audio.pause();
          audio.currentTime = 0;
          audio.volume = volume;
          setIsAnalyzing(false);
          
          // Send reference data
          onReferenceData(referenceFramesRef.current);
        }
      };
      
      analyzeFrame();
      
    } catch (error) {
      console.error('Error analyzing reference audio:', error);
      setIsAnalyzing(false);
    }
  }, [volume, onReferenceData]);

  const togglePlayback = useCallback(async () => {
    if (!audioRef.current) return;
    
    try {
      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setIsPaused(true);
        onPlaybackStateChange(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
        setIsPaused(false);
        onPlaybackStateChange(true);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [isPlaying, onPlaybackStateChange]);

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.volume = newMuted ? 0 : volume;
  }, [isMuted, volume]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Backing Track</h2>
        {isAnalyzing && (
          <div className="flex items-center space-x-2 text-yellow-400">
            <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Analyzing...</span>
          </div>
        )}
      </div>
      
      {/* File Upload */}
      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-300">
          Upload MP3 Backing Track
        </label>
        <div className="relative">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            id="audio-upload"
          />
          <label
            htmlFor="audio-upload"
            className="btn-secondary flex items-center space-x-2 cursor-pointer w-full justify-center"
          >
            <Upload className="w-5 h-5" />
            <span>{audioFile ? 'Change File' : 'Choose Audio File'}</span>
          </label>
        </div>
        {audioFile && (
          <p className="mt-2 text-sm text-gray-400">
            {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>
      
      {/* Playback Controls */}
      {audioFile && (
        <>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={togglePlayback}
              className="btn-primary flex items-center space-x-2"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            
            {/* Volume Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleMute}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 accent-red-500"
              />
            </div>
          </div>
          
          {/* Status */}
          {isPlaying && (
            <div className="mt-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-semibold">Playing</span>
              </div>
            </div>
          )}
        </>
      )}
      
      {!audioFile && (
        <div className="text-center py-8 text-gray-400">
          <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Upload an audio file to get started</p>
        </div>
      )}
    </div>
  );
}