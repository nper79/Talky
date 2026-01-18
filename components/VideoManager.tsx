
import React, { useState, useRef, useEffect } from 'react';
import { AvatarState, SourceVideo } from '../types';

interface Props {
  sourceVideos: SourceVideo[];
  onVideosUpdate: (videos: SourceVideo[]) => void;
  onStartProcessing: () => void;
}

const FPS = 30; // Standardize UI to 30 FPS for frame calculations

export const VideoManager: React.FC<Props> = ({ sourceVideos, onVideosUpdate, onStartProcessing }) => {
  // Trimming State
  const [trimmingVideoId, setTrimmingVideoId] = useState<string | null>(null);
  const [tempStart, setTempStart] = useState(0);
  const [tempEnd, setTempEnd] = useState(0);
  const trimVideoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    
    files.forEach(file => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => {
        const newVideo: SourceVideo = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          state: AvatarState.IDLE,
          previewUrl: url,
          startTime: 0,
          endTime: video.duration,
          duration: video.duration
        };
        onVideosUpdate([...sourceVideos, newVideo]); 
      };
    });
  };

  const removeVideo = (id: string) => {
    const videoToRemove = sourceVideos.find(v => v.id === id);
    if (videoToRemove) URL.revokeObjectURL(videoToRemove.previewUrl);
    onVideosUpdate(sourceVideos.filter(v => v.id !== id));
  };

  const toggleState = (id: string) => {
    onVideosUpdate(sourceVideos.map(v => 
      v.id === id ? { ...v, state: v.state === AvatarState.IDLE ? AvatarState.TALKING : AvatarState.IDLE } : v
    ));
  };

  // Trimming Logic
  const openTrimModal = (video: SourceVideo) => {
    setTrimmingVideoId(video.id);
    setTempStart(video.startTime);
    setTempEnd(video.endTime);
  };

  // Ensure video starts at the cut point when modal opens
  useEffect(() => {
    if (trimmingVideoId && trimVideoRef.current) {
      trimVideoRef.current.currentTime = tempStart;
    }
  }, [trimmingVideoId]);

  const saveTrim = () => {
    if (trimmingVideoId) {
      onVideosUpdate(sourceVideos.map(v => 
        v.id === trimmingVideoId ? { ...v, startTime: tempStart, endTime: tempEnd } : v
      ));
      setTrimmingVideoId(null);
    }
  };

  const activeTrimVideo = sourceVideos.find(v => v.id === trimmingVideoId);

  // Frame Calculations
  const currentStartFrame = Math.floor(tempStart * FPS);
  const currentEndFrame = Math.floor(tempEnd * FPS);
  const maxFrames = activeTrimVideo ? Math.floor(activeTrimVideo.duration * FPS) : 0;

  const handleFrameChange = (type: 'start' | 'end', frame: number) => {
    if (!activeTrimVideo) return;
    const time = frame / FPS;
    
    // Pause video to show precise frame
    if (trimVideoRef.current) {
      trimVideoRef.current.pause();
    }
    
    if (type === 'start') {
      const newStart = Math.min(time, tempEnd - 0.1); // Prevent overlap
      setTempStart(newStart);
      if (trimVideoRef.current) trimVideoRef.current.currentTime = newStart;
    } else {
      const newEnd = Math.max(time, tempStart + 0.1);
      setTempEnd(newEnd);
      if (trimVideoRef.current) trimVideoRef.current.currentTime = newEnd;
    }
  };

  const hasTalking = sourceVideos.some(v => v.state === AvatarState.TALKING);
  const hasIdle = sourceVideos.some(v => v.state === AvatarState.IDLE);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Upload Card */}
        <div className="relative group flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-900/40 hover:bg-slate-900/60 hover:border-blue-500/50 transition-all cursor-pointer aspect-[9/16]">
          <input
            type="file"
            multiple
            accept="video/*"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-slate-300 font-semibold text-center text-sm">Add Vertical Video</p>
          <p className="text-slate-500 text-[10px] mt-1 text-center">9:16 Aspect Ratio</p>
        </div>

        {/* Video Cards */}
        {sourceVideos.map((video) => (
          <div key={video.id} className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden group shadow-xl aspect-[9/16] flex flex-col">
            <div className="relative flex-1 overflow-hidden bg-black">
              <video 
                src={video.previewUrl} 
                className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all"
                muted
                onMouseOver={(e) => {
                  const v = e.currentTarget;
                  v.currentTime = video.startTime;
                  v.play();
                  const checkTime = () => {
                    if (v.currentTime >= video.endTime) {
                      v.currentTime = video.startTime;
                    }
                    if (!v.paused) requestAnimationFrame(checkTime);
                  };
                  requestAnimationFrame(checkTime);
                }}
                onMouseOut={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = video.startTime;
                }}
              />
              
              {/* Overlay Badges */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                 <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                   video.state === AvatarState.TALKING 
                     ? 'bg-blue-600/80 border-blue-400 text-white' 
                     : 'bg-slate-800/80 border-slate-600 text-slate-300'
                 }`}>
                   {video.state}
                 </span>
                 <button 
                  onClick={() => removeVideo(video.id)}
                  className="p-1.5 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-all backdrop-blur-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                  </svg>
                </button>
              </div>

              {/* Trim Indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                <div 
                  className="h-full bg-blue-500"
                  style={{
                    marginLeft: `${(video.startTime / video.duration) * 100}%`,
                    width: `${((video.endTime - video.startTime) / video.duration) * 100}%`
                  }}
                ></div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
              <p className="text-[10px] font-medium text-slate-400 truncate text-center">{video.file.name}</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => toggleState(video.id)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Switch Type
                </button>
                <button
                  onClick={() => openTrimModal(video)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition-colors flex items-center justify-center"
                  title="Trim Video"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sourceVideos.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-8">
          <div className="flex gap-4">
             <div className="px-4 py-2 bg-slate-900 rounded-full border border-slate-800 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hasIdle ? 'bg-slate-400' : 'bg-red-500'}`}></span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Idle: {sourceVideos.filter(v => v.state === AvatarState.IDLE).length}</span>
             </div>
             <div className="px-4 py-2 bg-blue-950/30 rounded-full border border-blue-900/50 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${hasTalking ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Talking: {sourceVideos.filter(v => v.state === AvatarState.TALKING).length}</span>
             </div>
          </div>

          <button
            onClick={onStartProcessing}
            disabled={!hasTalking || !hasIdle}
            className={`px-12 py-4 rounded-2xl font-black text-lg uppercase tracking-widest transition-all shadow-2xl ${
              (!hasTalking || !hasIdle) 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 active:scale-95 shadow-blue-500/40 border border-blue-500/30'
            }`}
          >
            Generate Avatar
          </button>
        </div>
      )}

      {/* Trimming Modal */}
      {activeTrimVideo && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-2xl flex flex-col gap-8 shadow-2xl">
            <h3 className="text-2xl font-bold text-white text-center">Trim Clip Frames</h3>
            
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Preview */}
              <div className="relative aspect-[9/16] w-[180px] flex-shrink-0 bg-black rounded-2xl overflow-hidden shadow-lg border border-slate-800">
                <video 
                  ref={trimVideoRef}
                  src={activeTrimVideo.previewUrl}
                  className="w-full h-full object-cover"
                  controls={false}
                  muted // Muted as requested
                  // No autoplay or loop to allow precise frame viewing
                />
              </div>

              {/* Controls */}
              <div className="flex-1 w-full space-y-6">
                
                {/* Start Frame Control */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-300">Start Frame:</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={currentStartFrame}
                        onChange={(e) => handleFrameChange('start', parseInt(e.target.value) || 0)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-sm w-20 text-right focus:border-blue-500 outline-none font-mono"
                      />
                      <span className="text-xs text-slate-500 font-mono w-12 text-right">{tempStart.toFixed(2)}s</span>
                    </div>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max={maxFrames}
                    value={currentStartFrame}
                    onChange={(e) => handleFrameChange('start', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* End Frame Control */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-300">End Frame:</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={currentEndFrame}
                        onChange={(e) => handleFrameChange('end', parseInt(e.target.value) || 0)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-sm w-20 text-right focus:border-blue-500 outline-none font-mono"
                      />
                      <span className="text-xs text-slate-500 font-mono w-12 text-right">{tempEnd.toFixed(2)}s</span>
                    </div>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max={maxFrames}
                    value={currentEndFrame}
                    onChange={(e) => handleFrameChange('end', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={() => {
                      if (trimVideoRef.current) {
                        trimVideoRef.current.currentTime = tempStart;
                        trimVideoRef.current.play();
                        setTimeout(() => trimVideoRef.current?.pause(), (tempEnd - tempStart) * 1000);
                      }
                    }}
                    className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Preview Loop
                  </button>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setTrimmingVideoId(null)}
                      className="flex-1 py-3 border border-slate-700 text-slate-400 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveTrim}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
