
import React, { useState } from 'react';
import { AppState, Frame, SourceVideo } from './types';
import { VideoManager } from './components/VideoManager';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { AvatarInteraction } from './components/AvatarInteraction';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: 'setup',
    sourceVideos: [],
    frames: [],
  });

  const handleVideosUpdate = (sourceVideos: SourceVideo[]) => {
    setState({ ...state, sourceVideos });
  };

  const startProcessing = () => {
    setState({ ...state, step: 'processing' });
  };

  const handleProcessingComplete = (frames: Frame[]) => {
    setState({ ...state, frames, step: 'interact' });
  };

  const reset = () => {
    // Revoke blob URLs to prevent memory leaks
    state.sourceVideos.forEach(v => URL.revokeObjectURL(v.previewUrl));
    setState({ step: 'setup', sourceVideos: [], frames: [] });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-500/30">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Avatar Animator Pro</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">Multi-Source Motion Engine</p>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] ${state.step === 'setup' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : 'border-slate-800 text-slate-600'}`}>1</span>
            <span className={`transition-colors ${state.step === 'setup' ? 'text-blue-400' : 'text-slate-500'}`}>Source Setup</span>
          </div>
          <div className="w-4 h-px bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] ${state.step === 'processing' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : 'border-slate-800 text-slate-600'}`}>2</span>
            <span className={`transition-colors ${state.step === 'processing' ? 'text-blue-400' : 'text-slate-500'}`}>Frame Extraction</span>
          </div>
          <div className="w-4 h-px bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] ${state.step === 'interact' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : 'border-slate-800 text-slate-600'}`}>3</span>
            <span className={`transition-colors ${state.step === 'interact' ? 'text-blue-400' : 'text-slate-500'}`}>Interactive Mode</span>
          </div>
        </nav>

        {state.step !== 'setup' && (
          <button 
            onClick={reset}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1 group bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:-rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            New Project
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {state.step === 'setup' && (
          <div className="py-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-500">
                Multi-Video Avatar Lab
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Upload multiple video snippets. Label them as <span className="text-white font-bold">Idle</span> or <span className="text-blue-400 font-bold">Talking</span>. 
                We'll split them into frames and synchronize them with Gemini TTS.
              </p>
            </div>
            
            <VideoManager 
              sourceVideos={state.sourceVideos} 
              onVideosUpdate={handleVideosUpdate} 
              onStartProcessing={startProcessing}
            />
          </div>
        )}

        {state.step === 'processing' && (
          <ProcessingOverlay 
            sourceVideos={state.sourceVideos} 
            onComplete={handleProcessingComplete} 
          />
        )}

        {state.step === 'interact' && (
          <AvatarInteraction frames={state.frames} />
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-900 bg-slate-950/80 backdrop-blur-sm flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <p>Avatar Animator Pro v2.0 • Gemini 2.5 Native Audio</p>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-blue-400 transition-colors">Documentation</a>
          <a href="#" className="hover:text-blue-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-blue-400 transition-colors">API Status</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
