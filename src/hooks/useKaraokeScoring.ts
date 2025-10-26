import { useEffect, useRef, useState } from "react";
import { AudioAnalyzer, KaraokeScore } from "../lib/audioAnalyzer";
import { ZoneScoreData } from "../lib/zoneScoring";

export interface KaraokeScoringHookResult {
  // Audio analyzer instance
  audioAnalyzer: AudioAnalyzer | null;

  // State
  isRecording: boolean;
  userNote: string;
  targetNote: string;
  userPitch: number;
  videoPitch: number;
  karaokeScore: KaraokeScore | null;
  zoneScore: ZoneScoreData | null;

  // Controls
  startRecording: (deviceId: string) => Promise<void>;
  stopRecording: () => void;
  connectVideo: (videoElement: HTMLVideoElement) => Promise<void>;
  disconnectVideo: () => void;
  reset: () => void;

  // For visualizers
  micAnalyser: AnalyserNode | null;
  videoAnalyser: AnalyserNode | null;
}

export function useKaraokeScoring(): KaraokeScoringHookResult {
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [userNote, setUserNote] = useState("N/A");
  const [targetNote, setTargetNote] = useState("N/A");
  const [userPitch, setUserPitch] = useState(0);
  const [videoPitch, setVideoPitch] = useState(0);
  const [karaokeScore, setKaraokeScore] = useState<KaraokeScore | null>(null);
  const [zoneScore, setZoneScore] = useState<ZoneScoreData | null>(null);

  // Initialize audio analyzer on mount
  useEffect(() => {
    audioAnalyzerRef.current = new AudioAnalyzer();

    return () => {
      audioAnalyzerRef.current?.cleanup();
    };
  }, []);

  // Continuous pitch monitoring (runs every 100ms)
  useEffect(() => {
    if (!audioAnalyzerRef.current) return;

    const interval = setInterval(() => {
      if (!audioAnalyzerRef.current) return;

      // Get user pitch (microphone)
      const userPitchResult = audioAnalyzerRef.current.getCurrentPitch();
      const userVolume = audioAnalyzerRef.current.getCurrentVolume();

      if (userPitchResult.frequency > 0) {
        setUserPitch(userPitchResult.frequency);
        const userNoteName = audioAnalyzerRef.current.frequencyToNoteName(
          userPitchResult.frequency
        );
        setUserNote(userNoteName);
      }

      // Get video pitch (reference vocals)
      const videoPitchResult = audioAnalyzerRef.current.getReferencePitch();
      const vocalActivity =
        audioAnalyzerRef.current.getReferenceVocalActivity();

      if (videoPitchResult.frequency > 0) {
        setVideoPitch(videoPitchResult.frequency);
        const targetNoteName = audioAnalyzerRef.current.frequencyToNoteName(
          videoPitchResult.frequency
        );
        setTargetNote(targetNoteName);

        // Calculate karaoke score
        if (userPitchResult.frequency > 0 && videoPitchResult.frequency > 0) {
          const userNoteName = audioAnalyzerRef.current.frequencyToNoteName(
            userPitchResult.frequency
          );
          const targetNoteName = audioAnalyzerRef.current.frequencyToNoteName(
            videoPitchResult.frequency
          );

          const score = audioAnalyzerRef.current.calculateScoreFromNotes(
            userNoteName,
            targetNoteName,
            Math.min(userPitchResult.confidence, videoPitchResult.confidence)
          );

          setKaraokeScore(score);
        }
      }

      // Update zone scoring (only when recording)
      if (isRecording && audioAnalyzerRef.current) {
        const userConfidence =
          userPitchResult.frequency > 0 ? Math.min(1.0, userVolume * 2) : 0;
        const targetConfidence =
          videoPitchResult.frequency > 0
            ? Math.min(1.0, videoPitchResult.confidence)
            : 0;

        audioAnalyzerRef.current.addAnalysisFrameToZoneScoring(
          userPitchResult.frequency,
          videoPitchResult.frequency,
          Date.now(),
          userVolume,
          !vocalActivity.isActive,
          userConfidence,
          targetConfidence
        );

        const zoneScoreData = audioAnalyzerRef.current.getZoneScore();
        setZoneScore(zoneScoreData);
      } else {
        setZoneScore(null);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isRecording]);

  // Control functions
  const startRecording = async (deviceId: string) => {
    if (!audioAnalyzerRef.current) return;

    try {
      await audioAnalyzerRef.current.startRecording(deviceId);
      setIsRecording(true);
      audioAnalyzerRef.current.resetScoreHistory();
      setKaraokeScore(null);
      setZoneScore(null);
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  };

  const stopRecording = () => {
    if (!audioAnalyzerRef.current) return;
    audioAnalyzerRef.current.stopRecording();
    setIsRecording(false);
  };

  const connectVideo = async (videoElement: HTMLVideoElement) => {
    if (!audioAnalyzerRef.current) return;

    try {
      await audioAnalyzerRef.current.connectVideoAudio(videoElement);
      audioAnalyzerRef.current.setVideoPlaying(!videoElement.paused);
      console.log("Video audio connected");
    } catch (error) {
      console.error("Failed to connect video audio:", error);
      throw error;
    }
  };

  const disconnectVideo = () => {
    if (!audioAnalyzerRef.current) return;
    audioAnalyzerRef.current.disconnectVideoAudio();
  };

  const reset = () => {
    if (!audioAnalyzerRef.current) return;
    audioAnalyzerRef.current.resetScoreHistory();
    audioAnalyzerRef.current.getZoneScoringSystem().reset();
    setKaraokeScore(null);
    setZoneScore(null);
    setUserNote("N/A");
    setTargetNote("N/A");
    setUserPitch(0);
    setVideoPitch(0);
  };

  return {
    audioAnalyzer: audioAnalyzerRef.current,
    isRecording,
    userNote,
    targetNote,
    userPitch,
    videoPitch,
    karaokeScore,
    zoneScore,
    startRecording,
    stopRecording,
    connectVideo,
    disconnectVideo,
    reset,
    micAnalyser: audioAnalyzerRef.current?.getAnalyser() || null,
    videoAnalyser: audioAnalyzerRef.current?.getReferenceAnalyser() || null,
  };
}
