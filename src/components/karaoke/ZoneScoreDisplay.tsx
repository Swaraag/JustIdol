import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Activity } from 'lucide-react';
import { ZoneScoreData, ZoneScoringSystem } from '../../lib/zoneScoring';

interface ZoneScoreDisplayProps {
  zoneScoringSystem: ZoneScoringSystem | null;
  isAnalyzing: boolean;
  className?: string;
}

export default function ZoneScoreDisplay({ 
  zoneScoringSystem, 
  isAnalyzing, 
  className = '' 
}: ZoneScoreDisplayProps) {
  const [scoreData, setScoreData] = useState<ZoneScoreData | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [performanceTrend, setPerformanceTrend] = useState<'improving' | 'declining' | 'stable'>('stable');

  // Update score data periodically
  useEffect(() => {
    if (zoneScoringSystem) {
      const updateScore = () => {
        // Always calculate score, even if history is empty (will return empty score)
        const newScore = zoneScoringSystem.calculateZoneScore();
        setScoreData(newScore);
        
        // Only add to score history if we have actual data
        if (zoneScoringSystem.getHistoryLength() > 0) {
          setScoreHistory(prev => [...prev.slice(-9), newScore.totalScore]);
          
          // Update performance trend
          setPerformanceTrend(zoneScoringSystem.getPerformanceTrend());
        }
      };

      updateScore();
      const interval = setInterval(updateScore, 500); // Update every 500ms
      return () => clearInterval(interval);
    }
  }, [zoneScoringSystem]);

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

  const averageScore = scoreHistory.length > 0 
    ? scoreHistory.reduce((sum, score) => sum + score, 0) / scoreHistory.length 
    : 0;

  const scoreTrend = scoreHistory.length >= 2 
    ? scoreHistory[scoreHistory.length - 1] - scoreHistory[scoreHistory.length - 2]
    : 0;

  if (!zoneScoringSystem) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8 text-gray-400">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Audio analyzer not initialized</p>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Analyzing your performance...</p>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8 text-gray-400">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Start singing to see your zone-based score!</p>
          {zoneScoringSystem.getHistoryLength() === 0 && (
            <p className="text-sm mt-2">Make sure your microphone is connected and start singing!</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Zone-Based Score</h2>
      </div>

      {/* Main Score Display */}
      <div className={`rounded-xl p-8 text-center border-2 ${getScoreBackground(scoreData.totalScore)}`}>
        <div className="flex items-center justify-center space-x-4 mb-4">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <div>
            <div className={`text-6xl font-bold ${getScoreColor(scoreData.totalScore)}`}>
              {scoreData.totalScore}
            </div>
            <div className="text-2xl font-semibold text-gray-300">
              Grade: {zoneScoringSystem.getScoreGrade(scoreData.totalScore)}
            </div>
          </div>
        </div>
        
        <div className="text-xl font-semibold text-white mb-2">
          {zoneScoringSystem.getScoreFeedback(scoreData)}
        </div>

        {/* Performance Trend Indicator */}
        <div className="flex items-center justify-center space-x-2 mt-2">
          {performanceTrend === 'improving' && (
            <div className="flex items-center space-x-1 text-green-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Improving!</span>
            </div>
          )}
          {performanceTrend === 'declining' && (
            <div className="flex items-center space-x-1 text-red-400">
              <TrendingUp className="w-4 h-4 rotate-180" />
              <span className="text-sm">Needs work</span>
            </div>
          )}
          {performanceTrend === 'stable' && (
            <div className="flex items-center space-x-1 text-gray-400">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Stable</span>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}