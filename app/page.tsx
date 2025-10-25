'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Square, Upload, X } from 'lucide-react';
import { AudioAnalyzer, AudioDevice, ScoreData, ReferencePitchData, KaraokeScore } from '../lib/audioAnalyzer';
import AudioVisualizer from '../components/AudioVisualizer';

export default function KaraokeApp() {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [isKaraokeMode, setIsKaraokeMode] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; duration: number; size: number } | null>(null);
  const [currentScore, setCurrentScore] = useState<ScoreData>({ overall: 0, pitch: 0, timing: 0 });
  const [karaokeScore, setKaraokeScore] = useState<KaraokeScore | null>(null);
  const [targetNote, setTargetNote] = useState('N/A');
  const [userNote, setUserNote] = useState('N/A');
  const [userPitch, setUserPitch] = useState(0);
  const [videoPitch, setVideoPitch] = useState(0);
  const [accuracy, setAccuracy] = useState<{ text: string; class: string }>({ text: '', class: '' });
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoTime, setVideoTime] = useState({ current: '0:00', total: '0:00' });

  // Audio analyzer instance
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Score tracking
  const allScoresRef = useRef<number[]>([]);
  const totalScoreSumRef = useRef(0);
  const scoreCountRef = useRef(0);
  const referencePitchDataRef = useRef<ReferencePitchData[]>([]);

  // Animation frame ref
  const animationFrameRef = useRef<number | null>(null);

  // Initialize audio context and enumerate devices
  useEffect(() => {
    initializeAudioAnalyzer();
    enumerateAudioDevices();
  }, []);

  // Start continuous pitch monitoring
  useEffect(() => {
    if (!audioAnalyzerRef.current) return;

    const monitorPitches = () => {
      if (!audioAnalyzerRef.current) return;

      // Get user pitch (always available when microphone is connected)
      const userPitchResult = audioAnalyzerRef.current.getCurrentPitch();
      if (userPitchResult.frequency > 0) {
        setUserPitch(userPitchResult.frequency);
        const userNoteName = audioAnalyzerRef.current.frequencyToNoteName(userPitchResult.frequency);
        setUserNote(userNoteName);
      }

      // Get video pitch (only when video audio is connected)
      const videoPitchResult = audioAnalyzerRef.current.getReferencePitch();
      if (videoPitchResult.frequency > 0) {
        setVideoPitch(videoPitchResult.frequency);
        const targetNoteName = audioAnalyzerRef.current.frequencyToNoteName(videoPitchResult.frequency);
        setTargetNote(targetNoteName);
        
        // Calculate karaoke score when both pitches are available
        if (userPitchResult.frequency > 0 && videoPitchResult.frequency > 0) {
          const userNoteName = audioAnalyzerRef.current.frequencyToNoteName(userPitchResult.frequency);
          const targetNoteName = audioAnalyzerRef.current.frequencyToNoteName(videoPitchResult.frequency);
          
          const score = audioAnalyzerRef.current.calculateScoreFromNotes(
            userNoteName, 
            targetNoteName, 
            Math.min(userPitchResult.confidence, videoPitchResult.confidence)
          );
          
          setKaraokeScore(score);
        }
      }
    };

    const interval = setInterval(monitorPitches, 100); // Update every 100ms
    return () => clearInterval(interval);
  }, [audioAnalyzerRef.current]);

  const initializeAudioAnalyzer = async () => {
    try {
      audioAnalyzerRef.current = new AudioAnalyzer();
    } catch (error) {
      console.error('Error initializing audio analyzer:', error);
      showStatus('Error initializing audio analyzer', 'error');
    }
  };

  const enumerateAudioDevices = async () => {
    try {
      if (!audioAnalyzerRef.current) return;
      const audioInputs = await audioAnalyzerRef.current.enumerateAudioDevices();
      setDevices(audioInputs);
      if (audioInputs.length > 0) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      showStatus('Error accessing audio devices', 'error');
    }
  };

  const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
    setStatus({ message, type });
    if (type === 'success') {
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !audioAnalyzerRef.current) return;

    try {
      showStatus('Processing uploaded file...', 'info');
      
      // Create video element to get duration
      const videoURL = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = videoURL;
      
      await new Promise((resolve, reject) => {
        tempVideo.addEventListener('loadedmetadata', resolve);
        tempVideo.addEventListener('error', reject);
      });

      setFileInfo({
        name: file.name,
        duration: tempVideo.duration,
        size: file.size / (1024 * 1024)
      });

      setIsKaraokeMode(true);
      showStatus('File loaded successfully! Ready for karaoke mode.', 'success');
      
    } catch (error) {
      console.error('File upload error:', error);
      showStatus(`Error loading file: ${error}`, 'error');
    }
  };

  const startRecording = async () => {
    try {
      if (!selectedDevice || !audioAnalyzerRef.current) {
        showStatus('Please select an audio device first', 'error');
        return;
      }

      await audioAnalyzerRef.current.startRecording(selectedDevice);
      setIsRecording(true);
      
      // Reset score tracking for new recording
      allScoresRef.current = [];
      totalScoreSumRef.current = 0;
      scoreCountRef.current = 0;
      audioAnalyzerRef.current.resetScoreHistory();
      setKaraokeScore(null);
      
      startAnalysis();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      showStatus(`Error starting recording: ${error}`, 'error');
    }
  };

  const stopRecording = () => {
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.stopRecording();
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsRecording(false);
  };

  const startAnalysis = () => {
    if (!audioAnalyzerRef.current) return;

    const analyze = () => {
      if (!isRecording || !audioAnalyzerRef.current) return;

      // Get current pitch and volume
      const pitchResult = audioAnalyzerRef.current.getCurrentPitch();
      const volume = audioAnalyzerRef.current.getCurrentVolume();
      
      // Get reference data for comparison
      const referencePitch = audioAnalyzerRef.current.getReferencePitch();
      const vocalActivity = audioAnalyzerRef.current.getReferenceVocalActivity();

      // Calculate score
      const score = audioAnalyzerRef.current.calculateScore(
        pitchResult.frequency, 
        volume, 
        referencePitch.frequency, 
        vocalActivity
      );
      
      // Add to running average
      allScoresRef.current.push(score.overall);
      totalScoreSumRef.current += score.overall;
      scoreCountRef.current++;

      const averageScore = Math.round(totalScoreSumRef.current / scoreCountRef.current);
      
      setCurrentScore({
        overall: averageScore,
        pitch: score.pitch,
        timing: score.timing
      });

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  const openKaraokeOverlay = async () => {
    if (!fileInfo || !audioAnalyzerRef.current) {
      showStatus('Please upload an MP4 file first', 'error');
      return;
    }

    try {
      setIsOverlayOpen(true);
      
      // Wait for video element to be available, then connect audio
      setTimeout(async () => {
        if (videoRef.current && audioAnalyzerRef.current) {
          try {
            await audioAnalyzerRef.current.connectVideoAudio(videoRef.current);
            // Set initial playing state based on video
            audioAnalyzerRef.current.setVideoPlaying(!videoRef.current.paused);
            console.log('Video audio connection established');
          } catch (error) {
            console.error('Failed to connect video audio:', error);
            showStatus('Failed to connect video audio for visualization', 'error');
          }
        }
      }, 500); // Increased timeout to ensure video is ready
      
      showStatus('Karaoke overlay opened! Press play and start singing!', 'success');
      
    } catch (error) {
      console.error('Error opening karaoke overlay:', error);
      showStatus(`Error opening overlay: ${error}`, 'error');
    }
  };

  const closeKaraokeOverlay = () => {
    setIsOverlayOpen(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (isRecording) {
      stopRecording();
    }
    // Disconnect video audio when closing overlay
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.disconnectVideoAudio();
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Status Message */}
      {status && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
          status.type === 'success' ? 'bg-green-600' :
          status.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          {status.message}
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          🎤 JustIdol Karaoke
        </h1>

        {/* Device Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Audio Input Device:</label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Upload MP4 File:</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.webm,.ogg"
            onChange={handleFileUpload}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* File Info */}
        {fileInfo && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">File Information:</h3>
            <p><strong>File:</strong> {fileInfo.name}</p>
            <p><strong>Duration:</strong> {fileInfo.duration.toFixed(2)}s</p>
            <p><strong>Size:</strong> {fileInfo.size.toFixed(2)} MB</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={startRecording}
            disabled={isRecording || !selectedDevice}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
          
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </button>

          {isKaraokeMode && (
            <button
              onClick={openKaraokeOverlay}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              <Play className="w-5 h-5" />
              Open Karaoke Overlay
            </button>
          )}
        </div>

        {/* Audio Visualizers */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4">Audio Visualizers</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Microphone Input Visualizer */}
            <div>
              <h4 className="text-lg font-medium mb-2 text-green-400">🎤 Your Microphone</h4>
              <AudioVisualizer
                analyser={audioAnalyzerRef.current?.getAnalyser() || null}
                isActive={isRecording}
                type="both"
                className="h-48"
              />
            </div>

            {/* Reference Audio Visualizer */}
            <div>
              <h4 className="text-lg font-medium mb-2 text-blue-400">🎵 Video Audio</h4>
              <AudioVisualizer
                analyser={audioAnalyzerRef.current?.getReferenceAnalyser() || null}
                isActive={isKaraokeMode && (audioAnalyzerRef.current?.isVideoPlaying() || false)}
                type="both"
                className="h-48"
              />
              {!isKaraokeMode && (
                <div className="h-48 bg-gray-800 rounded-lg border border-gray-600 flex items-center justify-center">
                  <p className="text-gray-400">Upload an MP4 file to see video audio</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score Display */}
        {isKaraokeMode && (
          <div className="mb-6 p-6 bg-gray-800 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Live Score</h3>
            {karaokeScore ? (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${
                      karaokeScore.category === 'perfect' ? 'text-yellow-400' :
                      karaokeScore.category === 'excellent' ? 'text-green-400' :
                      karaokeScore.category === 'good' ? 'text-blue-400' :
                      karaokeScore.category === 'fair' ? 'text-orange-400' :
                      karaokeScore.category === 'poor' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {karaokeScore.score}
                    </div>
                    <div className="text-sm text-gray-400">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-white">{karaokeScore.feedback}</div>
                    <div className="text-sm text-gray-400">Feedback</div>
                  </div>
                </div>
                <div className="text-center text-sm text-gray-500">
                  Note Difference: {karaokeScore.noteDifference.toFixed(1)} | 
                  Confidence: {Math.round(karaokeScore.confidence * 100)}%
                  {karaokeScore.isImproving && <span className="text-green-400 ml-2">📈 Improving!</span>}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <div className="text-2xl">🎤</div>
                <div>Start singing to see your score!</div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Pitch Display */}
        <div className="mb-6 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">🎵 Real-time Pitch Detection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Microphone Pitch */}
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <h4 className="text-lg font-medium mb-2 text-green-400">🎤 Your Voice</h4>
              <div className="text-3xl font-bold text-green-400 mb-2">{userNote}</div>
              <div className="text-sm text-gray-400">
                {userPitch > 0 ? `${userPitch.toFixed(1)} Hz` : 'No input detected'}
              </div>
              <div className="mt-2">
                <div className={`w-3 h-3 rounded-full mx-auto ${
                  userPitch > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                }`}></div>
              </div>
            </div>

            {/* Video Audio Pitch */}
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <h4 className="text-lg font-medium mb-2 text-blue-400">🎵 Video Audio</h4>
              <div className="text-3xl font-bold text-blue-400 mb-2">{targetNote}</div>
              <div className="text-sm text-gray-400">
                {videoPitch > 0 ? `${videoPitch.toFixed(1)} Hz` : 'No video audio'}
              </div>
              <div className="mt-2">
                <div className={`w-3 h-3 rounded-full mx-auto ${
                  videoPitch > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'
                }`}></div>
              </div>
            </div>
          </div>
          
          {/* Pitch Comparison */}
          {userPitch > 0 && videoPitch > 0 && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h4 className="text-lg font-medium mb-2 text-yellow-400">🎯 Pitch Comparison</h4>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">Semitone Difference:</div>
                <div className="text-xl font-bold text-yellow-400">
                  {Math.abs(12 * Math.log2(userPitch / videoPitch)).toFixed(1)} semitones
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {Math.abs(12 * Math.log2(userPitch / videoPitch)) < 1 ? '🎵 Perfect!' :
                   Math.abs(12 * Math.log2(userPitch / videoPitch)) < 2 ? '🎶 Great!' :
                   Math.abs(12 * Math.log2(userPitch / videoPitch)) < 3 ? '👍 Good!' : '🎤 Keep trying!'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Karaoke Overlay */}
      {isOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center">
          <div className="w-full h-full flex flex-col">
            {/* Close Button */}
            <button
              onClick={closeKaraokeOverlay}
              className="absolute top-4 right-4 z-10 p-2 bg-red-600 hover:bg-red-700 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Video Player */}
            <div className="flex-1 flex items-center justify-center">
              <video
                ref={videoRef}
                className="max-w-full max-h-full"
                controls
                autoPlay
                muted={false}
                onPlay={() => {
                  // Just update the playing state, don't reconnect audio
                  if (audioAnalyzerRef.current) {
                    audioAnalyzerRef.current.setVideoPlaying(true);
                    console.log('Video playing - audio should be flowing');
                  }
                }}
                onPause={() => {
                  if (audioAnalyzerRef.current) {
                    audioAnalyzerRef.current.setVideoPlaying(false);
                    console.log('Video paused');
                  }
                }}
                onLoadedData={() => {
                  console.log('Video loaded and ready');
                }}
              >
                <source src={fileInputRef.current?.files?.[0] ? URL.createObjectURL(fileInputRef.current.files[0]) : ''} type="video/mp4" />
              </video>
            </div>

            {/* Overlay Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
              {/* Audio Visualizers */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Microphone Visualizer */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-green-400">🎤 Your Voice</h4>
                  <AudioVisualizer
                    analyser={audioAnalyzerRef.current?.getAnalyser() || null}
                    isActive={isRecording}
                    type="both"
                    className="h-24"
                  />
                </div>

                {/* Reference Visualizer */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-blue-400">🎵 Video Audio</h4>
                  <AudioVisualizer
                    analyser={audioAnalyzerRef.current?.getReferenceAnalyser() || null}
                    isActive={audioAnalyzerRef.current?.isVideoPlaying() || false}
                    type="both"
                    className="h-24"
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={startRecording}
                  disabled={isRecording}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
                </button>
                
                <button
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-semibold"
                >
                  <Square className="w-5 h-5" />
                  Stop Recording
                </button>
              </div>

              {/* Overlay Pitch Display */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <div className="text-sm text-green-400 mb-1">🎤 Your Voice</div>
                  <div className="text-xl font-bold text-green-400">{userNote}</div>
                  <div className="text-xs text-gray-400">{userPitch > 0 ? `${userPitch.toFixed(0)}Hz` : 'No input'}</div>
                </div>
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <div className="text-sm text-blue-400 mb-1">🎵 Video</div>
                  <div className="text-xl font-bold text-blue-400">{targetNote}</div>
                  <div className="text-xs text-gray-400">{videoPitch > 0 ? `${videoPitch.toFixed(0)}Hz` : 'No audio'}</div>
                </div>
              </div>

              {/* Overlay Pitch Comparison */}
              {userPitch > 0 && videoPitch > 0 && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 text-yellow-400 text-center">🎯 Pitch Comparison</h4>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Semitone Difference:</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {Math.abs(12 * Math.log2(userPitch / videoPitch)).toFixed(1)} semitones
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.abs(12 * Math.log2(userPitch / videoPitch)) < 1 ? '🎵 Perfect!' :
                       Math.abs(12 * Math.log2(userPitch / videoPitch)) < 2 ? '🎶 Great!' :
                       Math.abs(12 * Math.log2(userPitch / videoPitch)) < 3 ? '👍 Good!' : '🎤 Keep trying!'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}