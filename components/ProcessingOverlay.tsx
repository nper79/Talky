
import React, { useEffect, useState, useRef } from 'react';
import { Frame, SourceVideo } from '../types';

interface Props {
  sourceVideos: SourceVideo[];
  onComplete: (frames: Frame[]) => void;
}

export const ProcessingOverlay: React.FC<Props> = ({ sourceVideos, onComplete }) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing pipeline...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allFramesRef = useRef<Frame[]>([]);

  useEffect(() => {
    let active = true;

    const process = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      for (let i = 0; i < sourceVideos.length; i++) {
        if (!active) break;
        
        setCurrentVideoIndex(i);
        const source = sourceVideos[i];
        setStatus(`Extracting ${source.state} frames from ${source.file.name}...`);
        
        video.src = source.previewUrl;
        video.load();

        await new Promise((resolve) => {
          video.onloadedmetadata = resolve;
        });

        const ctx = canvas.getContext('2d')!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Use trimmed duration
        const trimmedDuration = source.endTime - source.startTime;
        const frameRate = 12; 
        const totalFramesInSegment = Math.floor(trimmedDuration * frameRate);
        const maxFrames = 60; 
        const framesToExtract = Math.min(totalFramesInSegment, maxFrames);

        for (let j = 0; j < framesToExtract; j++) {
          if (!active) break;
          
          // Calculate precise time based on startTime + progress within segment
          const seekTime = source.startTime + (j / framesToExtract) * trimmedDuration;
          
          video.currentTime = seekTime;
          await new Promise((resolve) => {
            video.onseeked = resolve;
          });

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          allFramesRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            dataUrl: canvas.toDataURL('image/jpeg', 0.8),
            state: source.state,
          });

          const globalProgress = Math.round(((i / sourceVideos.length) + (j / framesToExtract / sourceVideos.length)) * 100);
          setProgress(globalProgress);
        }
      }

      if (active) {
        setStatus('Optimizing movement patterns...');
        setProgress(100);
        setTimeout(() => onComplete(allFramesRef.current), 800);
      }
    };

    process();
    return () => { active = false; };
  }, [sourceVideos, onComplete]);

  const currentSource = sourceVideos[currentVideoIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        <div className="relative w-48 h-48 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
          <svg className="absolute inset-0 transform -rotate-90 w-48 h-48">
            <circle
              cx="96"
              cy="96"
              r="92"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="4"
              className="text-blue-500 transition-all duration-300"
              strokeDasharray={578}
              strokeDashoffset={578 - (578 * progress) / 100}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white">{progress}%</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Complete</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">{status}</h3>
          <p className="text-sm text-slate-500">Video {currentVideoIndex + 1} of {sourceVideos.length}</p>
        </div>

        <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-left flex items-center gap-4">
           {currentSource && (
             <>
               <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden">
                 <video src={currentSource.previewUrl} className="w-full h-full object-cover" muted />
               </div>
               <div className="flex-1">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentSource.state} Mode</p>
                 <p className="text-sm text-slate-100 truncate">{currentSource.file.name}</p>
               </div>
             </>
           )}
        </div>

        <video ref={videoRef} className="hidden" muted />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
