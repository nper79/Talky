
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Frame, SourceVideo } from './types';
import { VideoManager } from './components/VideoManager';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { AvatarInteraction } from './components/AvatarInteraction';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [state, setState] = useState<AppState>({
    step: 'setup',
    sourceVideos: [],
    frames: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } else {
          // Fallback check for environment variable if the helper isn't present
          setHasKey(!!process.env.API_KEY);
        }
      } catch (e) {
        console.error("Error checking API key status", e);
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      // Per instructions: assume success after triggering openSelectKey to avoid race conditions
      setHasKey(true);
    }
  };

  const handleVideosUpdate = (sourceVideos: SourceVideo[]) => {
    setState(prev => ({ ...prev, sourceVideos }));
  };

  const startProcessing = () => {
    setState(prev => ({ ...prev, step: 'processing' }));
  };

  const handleProcessingComplete = (frames: Frame[]) => {
    setState(prev => ({ ...prev, frames, step: 'interact' }));
  };

  const reset = () => {
    state.sourceVideos.forEach(v => URL.revokeObjectURL(v.previewUrl));
    setState({ step: 'setup', sourceVideos: [], frames: [] });
  };

  const saveCharacter = () => {
    if (state.frames.length === 0) return;
    const data = JSON.stringify(state.frames);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadCharacter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const frames = JSON.parse(event.target?.result as string) as Frame[];
        if (Array.isArray(frames) && frames.length > 0 && frames[0].dataUrl) {
          setState(prev => ({ ...prev, frames, step: 'interact' }));
        }
      } catch (err) {
        console.error("Failed to load character:", err);
        alert("Invalid character file.");
      }
    };
    reader.readAsText(file);
  };

  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 p-10 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Setup Required</h1>
          <p className="text-slate-400 leading-relaxed">
            The Gemini Live API requires a paid API key from a Google Cloud project with billing enabled.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleSelectKey}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20 active:scale-95"
            >
              Select Paid API Key
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium underline underline-offset-4"
            >
              Learn more about billing
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 mb-12 animate-in slide-in-from-top-4 duration-700">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
            AVATAR PRO
          </h1>
          <p className="text-slate-500 text-sm font-medium tracking-widest uppercase mt-1">Real-time Character Interaction</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {state.step === 'setup' && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={loadCharacter} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-800 transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Load Character
              </button>
            </>
          )}
          
          {state.step === 'interact' && (
            <>
              <button 
                onClick={saveCharacter}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-800 transition-all"
              >
                Save
              </button>
              <button 
                onClick={reset}
                className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider border border-red-500/20 transition-all"
              >
                New
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {state.step === 'setup' && (
          <VideoManager 
            sourceVideos={state.sourceVideos} 
            onVideosUpdate={handleVideosUpdate} 
            onStartProcessing={startProcessing} 
          />
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
    </div>
  );
};

export default App;
