
import React, { useState, useEffect, useRef } from 'react';
import { Frame, AvatarState } from '../types';
import { getChatResponse, generateSpeech } from '../services/gemini';
import { decode, decodeAudioData } from '../utils/audio';

interface Props {
  frames: Frame[];
}

export const AvatarInteraction: React.FC<Props> = ({ frames }) => {
  const [userInput, setUserInput] = useState('');
  const [displayedText, setDisplayedText] = useState(''); // Text shown to user
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'generating_audio' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const idleFrames = frames.filter(f => f.state === AvatarState.IDLE);
  const talkingFrames = frames.filter(f => f.state === AvatarState.TALKING);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Animation Loop
  useEffect(() => {
    const activePool = isSpeaking ? (talkingFrames.length > 0 ? talkingFrames : frames) : (idleFrames.length > 0 ? idleFrames : frames);
    
    const interval = setInterval(() => {
      setCurrentFrameIndex(prev => (prev + 1) % activePool.length);
    }, isSpeaking ? 80 : 150);

    return () => clearInterval(interval);
  }, [isSpeaking, idleFrames, talkingFrames, frames]);

  // Handle Speech Process
  const processConversation = async (text: string) => {
    if (!text.trim() || (status !== 'idle' && status !== 'listening')) return;

    setStatus('thinking');
    setError(null);
    setDisplayedText(''); // Clear previous text immediately
    
    if (sourceRef.current) {
      sourceRef.current.stop();
      setIsSpeaking(false);
    }

    try {
      // Step 1: Brain
      const textResponse = await getChatResponse(text);
      // Note: We do NOT show textResponse yet. We wait for audio.
      setStatus('generating_audio');

      // Step 2: Voice
      const base64Audio = await generateSpeech(textResponse);
      if (!base64Audio) throw new Error("No audio data received.");

      // Step 3: Audio Prep
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const bytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      sourceRef.current = source;
      
      // Step 4: Play
      // Show text ONLY when audio starts
      setDisplayedText(textResponse);
      setIsSpeaking(true);
      setStatus('speaking');
      source.start();
      
      source.onended = () => {
        setIsSpeaking(false);
        setStatus('idle');
        // Optional: Clear text when audio ends if desired, or leave it until next turn
        // setDisplayedText(''); 
      };

      setUserInput(''); 
    } catch (err: any) {
      console.error("Interaction error:", err);
      setError(err.message || "An unexpected error occurred.");
      setStatus('idle');
      setIsSpeaking(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US'; 
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
    };

    recognition.onend = () => {
      setIsListening(false);
      // If we didn't start thinking (meaning no result), go back to idle
      if (status === 'listening') {
        setStatus('idle');
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript);
      processConversation(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setError("Could not hear you. Please try again.");
      setIsListening(false);
      setStatus('idle');
    };

    recognition.start();
  };

  const activePool = isSpeaking ? (talkingFrames.length > 0 ? talkingFrames : frames) : (idleFrames.length > 0 ? idleFrames : frames);
  const currentFrame = activePool[currentFrameIndex];

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
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : (isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-500')}`}></div>
          <span className="text-xs font-bold uppercase tracking-widest text-white">
            {isSpeaking ? 'Speaking' : (isListening ? 'Listening' : 'Idle')}
          </span>
        </div>

        {/* Loading/Status Overlay */}
        {(status === 'thinking' || status === 'generating_audio' || status === 'listening') && (
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] flex items-end justify-center pb-20 pointer-events-none">
            <div className="flex flex-col items-center gap-3 bg-slate-950/80 p-4 rounded-2xl backdrop-blur-md border border-white/10 animate-in slide-in-from-bottom-4">
              {status === 'listening' ? (
                <div className="flex gap-1 h-6 items-center">
                  <div className="w-1 h-2 bg-red-500 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
                  <div className="w-1 h-4 bg-red-500 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
                  <div className="w-1 h-6 bg-red-500 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.4s]"></div>
                  <div className="w-1 h-4 bg-red-500 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
                  <div className="w-1 h-2 bg-red-500 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
                </div>
              ) : (
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className="text-sm font-bold text-white shadow-sm uppercase tracking-wider">
                {status === 'listening' ? 'Listening...' : (status === 'thinking' ? 'Thinking...' : 'Generating Audio...')}
              </span>
            </div>
          </div>
        )}

        {/* AI Response Subtitle Bubble */}
        {displayedText && (
          <div className="absolute bottom-6 left-6 right-6">
            <div className="bg-slate-950/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl animate-in slide-in-from-bottom-2">
              <p className="text-slate-100 text-sm font-medium leading-relaxed text-center">
                "{displayedText}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interaction Controls */}
      <div className="w-full max-w-[400px] space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <div className="relative flex gap-2">
          {/* Microphone Button */}
          <button
            onClick={startListening}
            disabled={status !== 'idle' && status !== 'speaking'}
            className={`p-4 rounded-2xl transition-all shadow-lg flex-shrink-0 border-2 ${
              isListening 
                ? 'bg-red-500/20 border-red-500 text-red-500' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 hover:text-white'
            } ${status !== 'idle' && status !== 'speaking' && !isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Speak to Avatar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type message..."
              className="w-full h-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all shadow-inner"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  processConversation(userInput);
                }
              }}
              disabled={status !== 'idle' && status !== 'speaking'}
            />
            <button
              onClick={() => processConversation(userInput)}
              disabled={!userInput.trim() || (status !== 'idle' && status !== 'speaking')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
