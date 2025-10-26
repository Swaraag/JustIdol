import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  className?: string;
  type?: 'waveform' | 'frequency' | 'both';
}

export default function AudioVisualizer({ 
  analyser, 
  isActive, 
  className = '', 
  type = 'both' 
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!analyser || !isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive || !analyser) return;

      analyser.getByteTimeDomainData(dataArray);
      analyser.getByteFrequencyData(frequencyData);

      // Calculate volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setVolume(rms);

      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (type === 'waveform' || type === 'both') {
        drawWaveform(ctx, canvas, dataArray);
      }

      if (type === 'frequency' || type === 'both') {
        drawFrequencyBars(ctx, canvas, frequencyData);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isActive, type]);

  const drawWaveform = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dataArray: Uint8Array) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e94560';
    ctx.beginPath();

    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };

  const drawFrequencyBars = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frequencyData: Uint8Array) => {
    const barWidth = canvas.width / frequencyData.length;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * canvas.height;

      // Color based on frequency range
      let color = '#00d4aa'; // Green for low frequencies
      if (i > frequencyData.length * 0.3) color = '#ffd700'; // Yellow for mid frequencies
      if (i > frequencyData.length * 0.6) color = '#e94560'; // Red for high frequencies

      ctx.fillStyle = color;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="w-full h-full bg-gray-900 rounded-lg border border-gray-600"
      />
      
      {/* Volume indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
        <span className="text-xs text-gray-300">
          Volume: {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Visualizer type indicator */}
      <div className="absolute top-2 left-2">
        <span className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
          {type === 'both' ? 'Waveform + Frequency' : 
           type === 'waveform' ? 'Waveform' : 'Frequency'}
        </span>
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-2 right-2">
        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>
    </div>
  );
}