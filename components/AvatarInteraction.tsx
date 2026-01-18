
import React, { useState, useEffect, useRef } from 'react';
import { Frame, AvatarState } from '../types';
import { decode, decodeAudioData, float32ToBase64PCM } from '../utils/audio';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

interface Props {
  frames: Frame[];
}

export const AvatarInteraction: React.FC<Props> = ({ frames }) => {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Avatar is outputting audio
  const [isUserSpeaking, setIsUserSpeaking] = useState(false); // User is inputting audio (VAD)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for Audio & Session
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const idleFrames = frames.filter(f => f.state === AvatarState.IDLE);
  const talkingFrames = frames.filter(f => f.state === AvatarState.TALKING);

  // --- Animation Loop ---
  useEffect(() => {
    // Determine which set of frames to use based on avatar speaking state
    const activePool = isSpeaking ? (talkingFrames.length > 0 ? talkingFrames : frames) : (idleFrames.length > 0 ? idleFrames : frames);
    
    // Adjust frame rate: slower for idle, faster for talking
    const intervalTime = isSpeaking ? 80 : 150;

    const interval = setInterval(() => {
      setCurrentFrameIndex(prev => (prev + 1) % activePool.length);
      
      // Sync 'isSpeaking' state with audio playback time
      if (outputAudioContextRef.current) {
        const ctx = outputAudioContextRef.current;
        // If current time is less than the scheduled end time of the last chunk, we are still playing audio
        const isPlaying = ctx.currentTime < nextStartTimeRef.current;
        if (isPlaying !== isSpeaking) {
          setIsSpeaking(isPlaying);
        }
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isSpeaking, idleFrames, talkingFrames, frames]);


  // --- Live API Connection ---
  const connect = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 1. Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      // 2. Setup Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // 3. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO], // Audio-only response for speed
          systemInstruction: { parts: [{ text: "You are a lively, friendly 3D avatar. Keep your responses concise (1-2 sentences) and conversational." }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("Live Session Connected");
            setIsConnected(true);
            
            // Start streaming audio input
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Simple volume check for "User Speaking" visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setIsUserSpeaking(rms > 0.02); // Threshold

              const base64PCM = float32ToBase64PCM(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                  session.sendRealtimeInput({
                    media: {
                      mimeType: 'audio/pcm;rate=16000',
                      data: base64PCM
                    }
                  });
                });
              }
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio) {
              const ctx = outputAudioContextRef.current;
              if (ctx) {
                // Decode
                const bytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
                
                // Schedule
                const now = ctx.currentTime;
                // Start at next available slot, or now if we fell behind (gapless logic)
                const startTime = Math.max(now, nextStartTimeRef.current);
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(startTime);
                
                nextStartTimeRef.current = startTime + audioBuffer.duration;
              }
            }

            // Handle Interruption (User spoke while model was talking)
            if (msg.serverContent?.interrupted) {
              console.log("Model interrupted");
              nextStartTimeRef.current = 0; // Stop future playback
              // Note: We can't easily stop currently playing nodes without tracking them all, 
              // but resetting nextStartTime prevents queue build-up.
            }
          },
          onclose: () => {
            console.log("Session Closed");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection lost.");
            disconnect();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection failed:", err);
      setError("Failed to access microphone or connect to AI.");
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    // Close Session
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }

    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop Processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setIsUserSpeaking(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const currentFrame = isSpeaking && talkingFrames.length > 0
    ? talkingFrames[currentFrameIndex % talkingFrames.length]
    : idleFrames.length > 0 ? idleFrames[currentFrameIndex % idleFrames.length] : frames[currentFrameIndex];

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center animate-in fade-in duration-700 w-full">
      
      {/* Avatar Display - 9:16 Aspect Ratio */}
      <div className="relative w-full max-w-[360px] aspect-[9/16] bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl mb-6 group ring-1 ring-slate-800/50">
        {currentFrame && (
          <img 
            src={currentFrame.dataUrl} 
            className="w-full h-full object-cover transition-opacity duration-300" 
            alt="Avatar" 
          />
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 px-3 py-1 bg-slate-950/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isConnected 
              ? (isSpeaking ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-blue-500') 
              : 'bg-red-500'
          }`}></div>
          <span className="text-xs font-bold uppercase tracking-widest text-white">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* User Speaking Visualizer (Simple Pulse) */}
        {isConnected && (
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transition-opacity duration-200 ${isUserSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
        )}
        
        {/* Connection Overlay */}
        {!isConnected && !error && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center">
             <button 
               onClick={connect}
               className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold uppercase tracking-wider shadow-xl shadow-blue-600/20 hover:scale-105 transition-all flex items-center gap-2"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
               </svg>
               Start Live Chat
             </button>
          </div>
        )}
      </div>

      {/* Interaction Controls */}
      <div className="w-full max-w-[400px] space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={connect} className="underline hover:text-red-300">Retry</button>
          </div>
        )}
        
        {isConnected && (
           <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-2 border border-slate-800">
             <div className="flex items-center gap-3 px-4">
               <div className={`w-3 h-3 rounded-full ${isUserSpeaking ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
               <span className="text-xs font-medium text-slate-400">Microphone Active</span>
             </div>
             
             <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-red-500/20"
             >
               End Session
             </button>
           </div>
        )}

        <div className="text-center">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium">
              Powered by Gemini Live API (Native Audio)
            </p>
        </div>
      </div>
    </div>
  );
};
