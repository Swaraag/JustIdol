import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PitchFrame } from '../lib/pitchAnalysis';

interface PitchVisualizerProps {
  referenceFrames: PitchFrame[];
  userFrames: PitchFrame[];
  isRecording: boolean;
  isPlaying: boolean;
}

interface ChartDataPoint {
  time: number;
  referencePitch: number | null;
  userPitch: number | null;
  referenceNote: string;
  userNote: string;
}

export default function PitchVisualizer({ 
  referenceFrames, 
  userFrames, 
  isRecording, 
  isPlaying 
}: PitchVisualizerProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [currentUserPitch, setCurrentUserPitch] = useState<number | null>(null);
  const [currentReferencePitch, setCurrentReferencePitch] = useState<number | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  
  const chartRef = useRef<any>(null);

  // Convert frequency to note name
  const frequencyToNoteName = (frequency: number): string => {
    if (frequency <= 0) return 'N/A';
    
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const note = h % 12;
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${noteNames[note]}${octave}`;
  };

  // Convert frequency to MIDI note number for visualization
  const frequencyToMIDI = (frequency: number): number => {
    if (frequency <= 0) return 0;
    return 12 * Math.log2(frequency / 440) + 69;
  };

  // Convert MIDI note number back to frequency
  const midiToFrequency = (midi: number): number => {
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  // Update chart data when frames change
  useEffect(() => {
    const maxTime = Math.max(
      referenceFrames.length > 0 ? Math.max(...referenceFrames.map(f => f.timestamp)) : 0,
      userFrames.length > 0 ? Math.max(...userFrames.map(f => f.timestamp)) : 0
    );

    const timeStep = 100; // 100ms intervals
    const dataPoints: ChartDataPoint[] = [];

    for (let time = 0; time <= maxTime; time += timeStep) {
      // Find closest reference frame
      let referencePitch: number | null = null;
      let referenceNote = 'N/A';
      
      if (referenceFrames.length > 0) {
        const closestRef = referenceFrames.reduce((closest, frame) => {
          const timeDiff = Math.abs(frame.timestamp - time);
          const closestTimeDiff = Math.abs(closest.timestamp - time);
          return timeDiff < closestTimeDiff ? frame : closest;
        });
        
        if (Math.abs(closestRef.timestamp - time) < timeStep) {
          referencePitch = frequencyToMIDI(closestRef.frequency);
          referenceNote = frequencyToNoteName(closestRef.frequency);
        }
      }

      // Find closest user frame
      let userPitch: number | null = null;
      let userNote = 'N/A';
      
      if (userFrames.length > 0) {
        const closestUser = userFrames.reduce((closest, frame) => {
          const timeDiff = Math.abs(frame.timestamp - time);
          const closestTimeDiff = Math.abs(closest.timestamp - time);
          return timeDiff < closestTimeDiff ? frame : closest;
        });
        
        if (Math.abs(closestUser.timestamp - time) < timeStep) {
          userPitch = frequencyToMIDI(closestUser.frequency);
          userNote = frequencyToNoteName(closestUser.frequency);
        }
      }

      dataPoints.push({
        time: time / 1000, // Convert to seconds
        referencePitch,
        userPitch,
        referenceNote,
        userNote
      });
    }

    setChartData(dataPoints);
  }, [referenceFrames, userFrames]);

  // Update current pitches for real-time display
  useEffect(() => {
    if (isRecording && userFrames.length > 0) {
      const latestUserFrame = userFrames[userFrames.length - 1];
      setCurrentUserPitch(latestUserFrame.frequency);
    }

    if (isPlaying && referenceFrames.length > 0) {
      // Find reference frame closest to current playback time
      const currentTime = Date.now(); // This would be actual playback time in a real implementation
      const closestRef = referenceFrames.reduce((closest, frame) => {
        const timeDiff = Math.abs(frame.timestamp - currentTime);
        const closestTimeDiff = Math.abs(closest.timestamp - currentTime);
        return timeDiff < closestTimeDiff ? frame : closest;
      });
      
      setCurrentReferencePitch(closestRef.frequency);
    }
  }, [isRecording, isPlaying, userFrames, referenceFrames]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">Time: {label}s</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value ? frequencyToNoteName(midiToFrequency(entry.value)) : 'N/A'}
              {entry.value && (
                <span className="ml-2 text-gray-400">
                  ({midiToFrequency(entry.value).toFixed(1)} Hz)
                </span>
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Pitch Visualization</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPracticeMode}
              onChange={(e) => setIsPracticeMode(e.target.checked)}
              className="w-4 h-4 text-red-500 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
            />
            <span className="text-sm text-gray-300">Practice Mode</span>
          </label>
        </div>
      </div>

      {/* Current Pitch Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Target Pitch</h3>
          <div className="text-2xl font-bold text-red-500">
            {currentReferencePitch ? frequencyToNoteName(currentReferencePitch) : 'N/A'}
          </div>
          {currentReferencePitch && (
            <div className="text-sm text-gray-400">
              {currentReferencePitch.toFixed(1)} Hz
            </div>
          )}
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Your Pitch</h3>
          <div className="text-2xl font-bold text-green-400">
            {currentUserPitch ? frequencyToNoteName(currentUserPitch) : 'N/A'}
          </div>
          {currentUserPitch && (
            <div className="text-sm text-gray-400">
              {currentUserPitch.toFixed(1)} Hz
            </div>
          )}
        </div>
      </div>

      {/* Practice Mode Feedback */}
      {isPracticeMode && currentUserPitch && currentReferencePitch && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">Practice Feedback</h3>
          {(() => {
            const semitoneDiff = Math.abs(12 * Math.log2(currentUserPitch / currentReferencePitch));
            const centsOff = semitoneDiff * 100;
            
            if (centsOff < 50) {
              return (
                <div className="text-green-400 flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full" />
                  <span>Perfect! You're on pitch!</span>
                </div>
              );
            } else if (centsOff < 100) {
              return (
                <div className="text-yellow-400 flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                  <span>Close! Try adjusting slightly.</span>
                </div>
              );
            } else {
              return (
                <div className="text-red-400 flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full" />
                  <span>Off pitch. Try matching the target note.</span>
                </div>
              );
            }
          })()}
        </div>
      )}

      {/* Pitch Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="time" 
              stroke="#9CA3AF"
              label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              stroke="#9CA3AF"
              domain={[60, 84]} // C4 to C6 range
              tickFormatter={(value) => frequencyToNoteName(midiToFrequency(value))}
              label={{ value: 'Pitch', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference pitch line */}
            <Line
              type="monotone"
              dataKey="referencePitch"
              stroke="#e94560"
              strokeWidth={3}
              dot={false}
              name="Target Pitch"
              connectNulls={false}
            />
            
            {/* User pitch line */}
            <Line
              type="monotone"
              dataKey="userPitch"
              stroke="#00d4aa"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Your Pitch"
              connectNulls={false}
            />
            
            {/* Practice mode reference lines */}
            {isPracticeMode && (
              <>
                <ReferenceLine y={60} stroke="#4B5563" strokeDasharray="2 2" />
                <ReferenceLine y={72} stroke="#4B5563" strokeDasharray="2 2" />
                <ReferenceLine y={84} stroke="#4B5563" strokeDasharray="2 2" />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-1 bg-red-500" />
          <span className="text-gray-300">Target Pitch</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-1 bg-green-400" />
          <span className="text-gray-300">Your Pitch</span>
        </div>
      </div>
    </div>
  );
}