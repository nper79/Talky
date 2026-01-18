
import { GoogleGenAI, Modality } from "@google/genai";

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const CHAT_MODEL = 'gemini-3-flash-preview';

export async function getChatResponse(userText: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [{ parts: [{ text: userText }] }],
      config: {
        // System instruction to give the avatar a personality and keep answers short for better animation/audio timing
        systemInstruction: "You are a lively, friendly 3D avatar. You are chatting with a user. Keep your responses concise, conversational, and natural (1-3 sentences max). Do not use emojis, as they cannot be spoken.",
      },
    });

    return response.text || "I'm not sure what to say.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw new Error("I couldn't think of a response.");
  }
}

export async function generateSpeech(text: string, voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' = 'Kore'): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // We wrap the text in "Say:" to ensure the TTS model reads it strictly and doesn't try to continue the conversation itself.
    const prompt = `Say: ${text}`;

    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error("Speech generation was blocked by safety filters.");
    }

    const parts = candidate?.content?.parts || [];
    const audioPart = parts.find(part => 
      part.inlineData && 
      (part.inlineData.mimeType.startsWith('audio/') || part.inlineData.mimeType === 'audio/pcm')
    );

    if (!audioPart?.inlineData?.data) {
      throw new Error("No audio data received from the model.");
    }

    return audioPart.inlineData.data;
  } catch (error: any) {
    console.error("Gemini TTS Service Error:", error);
    if (error.message?.includes('non-audio response') || error.message?.includes('AudioOut model')) {
      throw new Error("The model could not generate audio for this phrase.");
    }
    throw error;
  }
}
