import { useState, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported] = useState(() => {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  });

  const toggleListen = useCallback(() => {
    if (!supported || disabled) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [supported, disabled, isListening, onTranscript]);

  if (!supported) return null;

  return (
    <button
      onClick={toggleListen}
      disabled={disabled}
      className={`flex items-center justify-center rounded-lg p-2 transition-all ${
        isListening
          ? "bg-red-100 text-red-600 hover:bg-red-200"
          : "text-surface-400 hover:bg-surface-100 hover:text-surface-600"
      } disabled:opacity-40`}
      title={isListening ? "Остановить запись" : "Голосовой ввод"}
    >
      {isListening ? (
        <MicOff className="h-5 w-5 animate-pulse" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </button>
  );
}
