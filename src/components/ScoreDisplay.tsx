import { useState, useEffect } from 'react';
import { Trophy, Target, Clock, Activity, Star, TrendingUp } from 'lucide-react';
import { PitchAnalysisResult, analyzePitchPerformance, PitchFrame } from '../lib/pitchAnalysis';

interface ScoreDisplayProps {
  referenceFrames: PitchFrame[];
  userFrames: PitchFrame[];
  isAnalyzing: boolean;
}

export default function ScoreDisplay({ referenceFrames, userFrames, isAnalyzing }: ScoreDisplayProps) {
  const [analysisResult, setAnalysisResult] = useState<PitchAnalysisResult | null>(null);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Analyze performance when data changes
  useEffect(() => {
    if (referenceFrames.length > 0 && userFrames.length > 0 && !isAnalyzing) {
      const result = analyzePitchPerformance(referenceFrames, userFrames);
      setAnalysisResult(result);
      
      // Add to score history
      setScoreHistory(prev => [...prev.slice(-9), result.overallScore]);
    }
  }, [referenceFrames, userFrames, isAnalyzing]);

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBackground = (score: number): string => {
    if (score >= 90) return 'bg-green-500/20 border-green-500/30';
    if (score >= 80) return 'bg-yellow-500/20 border-yellow-500/30';
    if (score >= 70) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getScoreMessage = (score: number): string => {
    if (score >= 95) return "🎉 PERFECT! You're a karaoke superstar!";
    if (score >= 90) return "🌟 EXCELLENT! Outstanding performance!";
    if (score >= 80) return "👏 GREAT! Very good singing!";
    if (score >= 70) return "👍 GOOD! Nice job!";
    if (score >= 60) return "🎵 OKAY! Keep practicing!";
    if (score >= 50) return "🎤 FAIR! Focus on pitch accuracy.";
    return "🎶 Keep trying! Practice makes perfect!";
  };

  const getScoreGrade = (score: number): string => {
    if (score >= 95) return 'S+';
    if (score >= 90) return 'S';
    if (score >= 85) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'D+';
    if (score >= 50) return 'D';
    return 'F';
  };

  const averageScore = scoreHistory.length > 0 
    ? scoreHistory.reduce((sum, score) => sum + score, 0) / scoreHistory.length 
    : 0;

  const scoreTrend = scoreHistory.length >= 2 
    ? scoreHistory[scoreHistory.length - 1] - scoreHistory[scoreHistory.length - 2]
    : 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Performance Score</h2>
        <button
          onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
          className="text-sm text-red-500 hover:text-red-600 transition-colors"
        >
          {showDetailedBreakdown ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {isAnalyzing ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Analyzing your performance...</p>
        </div>
      ) : analysisResult ? (
        <>
          {/* Main Score Display */}
          <div className={`rounded-xl p-8 text-center border-2 ${getScoreBackground(analysisResult.overallScore)}`}>
            <div className="flex items-center justify-center space-x-4 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <div>
                <div className={`text-6xl font-bold ${getScoreColor(analysisResult.overallScore)}`}>
                  {analysisResult.overallScore}
                </div>
                <div className="text-2xl font-semibold text-gray-300">
                  Grade: {getScoreGrade(analysisResult.overallScore)}
                </div>
              </div>
            </div>
            
            <div className="text-lg text-gray-300 mb-2">
              {analysisResult.noteName} ({analysisResult.centsOff > 0 ? '+' : ''}{analysisResult.centsOff} cents)
            </div>
            
            <div className="text-xl font-semibold text-white">
              {getScoreMessage(analysisResult.overallScore)}
            </div>
          </div>

          {/* Score Breakdown */}
          {showDetailedBreakdown && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-5 h-5 text-red-500" />
                  <span className="font-semibold text-white">Pitch Accuracy</span>
                </div>
                <div className="text-3xl font-bold text-red-500">
                  {analysisResult.pitchAccuracy}%
                </div>
                <div className="text-sm text-gray-400">
                  How well you matched the target pitch
                </div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${analysisResult.pitchAccuracy}%` }}
                  />
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-white">Timing</span>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {analysisResult.timingAccuracy}%
                </div>
                <div className="text-sm text-gray-400">
                  How well you matched the rhythm
                </div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${analysisResult.timingAccuracy}%` }}
                  />
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-white">Stability</span>
                </div>
                <div className="text-3xl font-bold text-green-400">
                  {analysisResult.vocalStability}%
                </div>
                <div className="text-sm text-gray-400">
                  How steady your voice was
                </div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${analysisResult.vocalStability}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Score History */}
          {scoreHistory.length > 1 && (
            <div className="mt-6 bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Score History</h3>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">
                    Avg: {averageScore.toFixed(1)}
                    {scoreTrend !== 0 && (
                      <span className={`ml-2 ${scoreTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ({scoreTrend > 0 ? '+' : ''}{scoreTrend.toFixed(1)})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              
              <div className="flex items-end space-x-2 h-16">
                {scoreHistory.map((score, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div 
                      className={`w-full rounded-t transition-all duration-300 ${
                        score >= 80 ? 'bg-green-500' : 
                        score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${(score / 100) * 48}px` }}
                    />
                    <div className="text-xs text-gray-400 mt-1">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips for Improvement */}
          <div className="mt-6 bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <span>Tips for Improvement</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              {analysisResult.pitchAccuracy < 70 && (
                <p>• Focus on matching the target pitch more closely</p>
              )}
              {analysisResult.timingAccuracy < 70 && (
                <p>• Work on your rhythm and timing with the backing track</p>
              )}
              {analysisResult.vocalStability < 70 && (
                <p>• Practice holding notes steady without wavering</p>
              )}
              {analysisResult.overallScore >= 80 && (
                <p>• Great job! Try experimenting with vocal dynamics</p>
              )}
              <p>• Practice regularly to improve your consistency</p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Record your performance to see your score!</p>
        </div>
      )}
    </div>
  );
}