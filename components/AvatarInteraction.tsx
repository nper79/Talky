
import React, { useState, useEffect, useRef } from 'react';
import { Frame, AvatarState } from '../types';
import { decode, decodeAudioData } from '../utils/audio';
import { getChatResponse, generateSpeech } from '../services/gemini';

interface Props {
  frames: Frame[];
}

export const AvatarInteraction: React.FC<Props> = ({ frames }) => {
  // Estados de UI e Lógica
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs de Áudio e Reconhecimento
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);

  const idleFrames = frames.filter(f => f.state === AvatarState.IDLE);
  const talkingFrames = frames.filter(f => f.state === AvatarState.TALKING);

  // --- Inicialização do Reconhecimento de Voz ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; // Changed to English to match app context, but keep logic robust

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true;
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            // Processing happens on button release
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const currentText = interimTranscript || event.results[event.results.length - 1][0].transcript;
        setTranscription(currentText);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
           setError('Microphone error: ' + event.error);
           setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError('Your browser does not support speech recognition.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // --- Loop de Animação ---
  useEffect(() => {
    const activePool = isSpeaking 
      ? (talkingFrames.length > 0 ? talkingFrames : frames) 
      : (idleFrames.length > 0 ? idleFrames : frames);
    
    const intervalTime = isSpeaking ? 80 : 150;

    const interval = setInterval(() => {
      setCurrentFrameIndex(prev => (prev + 1) % activePool.length);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isSpeaking, idleFrames, talkingFrames, frames]);

  // --- Ações de Conversação ---
  const startRecording = () => {
    if (!recognitionRef.current) return;
    
    // Reset de estados
    setError(null);
    setTranscription('');
    setAiResponse('');
    stopAudio();
    
    setIsRecording(true);

    // Prevent "already started" error
    if (!isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition start error:', e);
      }
    }
    
    // Ensure AudioContext is ready for playback later
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const stopRecording = async () => {
    if (!recognitionRef.current || !isRecording) return;
    
    setIsRecording(false);
    
    // We try to stop the engine. 
    // onend will fire and update isRecognitionActiveRef.
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn('Recognition stop error:', e);
    }
    
    if (transcription.trim().length < 2) return;

    processSpeech(transcription);
  };

  const processSpeech = async (text: string) => {
    setIsThinking(true);
    try {
      // 1. Get Chat Response
      const responseText = await getChatResponse(text);
      setAiResponse(responseText);
      
      // 2. Generate Audio (TTS)
      const audioDataB64 = await generateSpeech(responseText);
      
      if (audioDataB64) {
        playAudio(audioDataB64);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process response.');
    } finally {
      setIsThinking(false);
    }
  };

  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) return;
    
    stopAudio();
    
    const bytes = decode(base64);
    const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => setIsSpeaking(false);
    
    currentSourceRef.current = source;
    setIsSpeaking(true);
    source.start(0);
  };

  const stopAudio = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
      currentSourceRef.current = null;
    }
    setIsSpeaking(false);
  };

  const currentFrame = isSpeaking && talkingFrames.length > 0
    ? talkingFrames[currentFrameIndex % talkingFrames.length]
    : idleFrames.length > 0 ? idleFrames[currentFrameIndex % idleFrames.length] : frames[currentFrameIndex];

  return (
    <div className={`flex flex-col items-center w-full transition-all duration-500 ${isFullScreen ? 'fixed inset-0 z-50 bg-black justify-center' : 'max-w-4xl mx-auto'}`}>
      
      <div className={`relative overflow-hidden transition-all duration-500 ${
        isFullScreen 
          ? 'w-full h-full' 
          : 'w-full max-w-[360px] aspect-[9/16] bg-slate-900 rounded-3xl border-4 border-slate-800 shadow-2xl mb-6 ring-1 ring-slate-800/50'
      }`}>
        {currentFrame && (
          <img 
            src={currentFrame.dataUrl} 
            className="w-full h-full object-cover"
            alt="Avatar" 
          />
        )}

        {/* Status Badge */}
        <div className="absolute top-4 right-4 px-3 py-1 bg-slate-950/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2 z-20">
          <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isRecording ? 'bg-red-500 animate-pulse' : (isSpeaking ? 'bg-green-500' : (isThinking ? 'bg-yellow-500' : 'bg-blue-500'))
          }`}></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">
            {isRecording ? 'Listening' : (isThinking ? 'Thinking' : (isSpeaking ? 'Speaking' : 'Ready'))}
          </span>
        </div>

        {/* Fullscreen Toggle */}
        <button 
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="absolute top-4 left-4 p-2 bg-slate-950/40 hover:bg-slate-900 backdrop-blur-md rounded-full text-white z-20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 9a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 13.586V15a1 1 0 01-2 0v-4a1 1 0 011-1zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0v-1.586l-2.293 2.293a1 1 0 01-1.414-1.414L13.586 15H12z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Transcription Overlay */}
        {(isRecording || transcription) && (
          <div className="absolute bottom-24 left-4 right-4 z-20">
             <div className="bg-slate-950/60 backdrop-blur-md p-3 rounded-2xl border border-white/5 text-center shadow-2xl">
                <p className="text-white text-sm font-medium line-clamp-2">
                  {transcription || "Listening..."}
                </p>
             </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* PTT Button */}
      {!isFullScreen && (
        <div className="w-full max-w-[400px] flex flex-col items-center gap-6">
          <div className="relative group">
            {/* Pulsing rings when recording */}
            {isRecording && (
              <>
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25"></div>
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-pulse opacity-40 scale-125"></div>
              </>
            )}
            
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={isRecording ? stopRecording : undefined}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 touch-none ${
                isRecording 
                  ? 'bg-red-600 scale-110 shadow-red-500/50' 
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/50'
              }`}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-tighter">
              {isRecording ? 'Release to Send' : 'Hold to Talk'}
            </p>
            <p className="text-slate-600 text-[10px] uppercase font-medium">Flash Chat + Native TTS Pipeline</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-medium text-center w-full animate-in fade-in slide-in-from-bottom-2">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Mobile-style Controls */}
      {isFullScreen && (
        <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4 z-30">
           <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              className={`w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all active:scale-95 touch-none ${
                isRecording ? 'bg-red-600/80 scale-110' : 'bg-white/10'
              }`}
           >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
           </button>
        </div>
      )}
    </div>
  );
};
