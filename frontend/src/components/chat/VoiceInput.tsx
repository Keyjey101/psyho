import { useState, useCallback, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [supported] = useState(() => {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  });

  const toggleListen = useCallback(() => {
    if (!supported || disabled) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.start();
  }, [supported, disabled, isListening, onTranscript]);

  if (!supported) return null;

  return (
    <button
      onClick={toggleListen}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full p-2 transition-all ${
        isListening
          ? "bg-[#FDF5F3] text-[#C4786A]"
          : "text-[#8A7A6A] hover:text-[#B8785A]"
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
