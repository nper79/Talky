
import React, { useRef, useState } from 'react';
import { AvatarState, Frame } from '../types';

interface Props {
  onFramesExtracted: (frames: Frame[]) => void;
}

export const VideoUploader: React.FC<Props> = ({ onFramesExtracted }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);

    const video = videoRef.current;
    if (!video) return;

    video.src = URL.createObjectURL(file);
    video.load();

    video.onloadedmetadata = async () => {
      const frames: Frame[] = [];
      const duration = video.duration;
      const frameRate = 10; // Extract 10 frames per second
      const totalFrames = Math.floor(duration * frameRate);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      for (let i = 0; i < totalFrames; i++) {
        video.currentTime = i / frameRate;
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({
          id: Math.random().toString(36).substr(2, 9),
          dataUrl: canvas.toDataURL('image/jpeg', 0.8),
          state: AvatarState.IDLE,
        });

        setProgress(Math.round(((i + 1) / totalFrames) * 100));
        
        // Limit to 100 frames to prevent memory issues in this demo
        if (frames.length >= 100) break;
      }

      onFramesExtracted(frames);
      setIsProcessing(false);
    };
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/50 hover:bg-slate-800/80 transition-all cursor-pointer relative overflow-hidden group">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
        disabled={isProcessing}
      />
      
      {!isProcessing ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2">Upload Source Video</h3>
          <p className="text-slate-400">Click or drag a short clip to extract frames</p>
        </div>
      ) : (
        <div className="text-center w-full max-w-xs">
          <div className="mb-4 flex justify-between items-end">
            <span className="text-sm font-medium text-blue-400">Processing Video...</span>
            <span className="text-sm font-bold text-blue-400">{progress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="mt-4 text-xs text-slate-500 italic">Decompressing and analyzing frames...</p>
        </div>
      )}

      <video ref={videoRef} className="hidden" muted />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
