import React, { useState, useRef, useEffect } from 'react';
import { Loader } from './Loader';

// Browser compatibility for SpeechRecognition API
// Fix: Cast window to `any` to access experimental `SpeechRecognition` property.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

interface InputFormProps {
  userInput: string;
  setUserInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  hasExistingList: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({ userInput, setUserInput, onSubmit, isLoading, hasExistingList }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  // Fix: Use `any` for SpeechRecognition instance type as it's not in the default TS DOM lib and our constant shadows the type name.
  const recognitionRef = useRef<any | null>(null);
  const userInputBeforeRecording = useRef('');
  
  // Ref to track the actual mouse/touch press state, avoiding stale closures.
  const isMicButtonPressedRef = useRef(false);

  // Create a ref to hold the latest userInput value to avoid stale closures in event handlers.
  const userInputRef = useRef(userInput);
  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);


  useEffect(() => {
    if (!isSpeechRecognitionSupported) {
      console.log("Speech recognition not supported by this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
      
      // If the browser timed out but the user is still holding the button, attempt to restart.
      if (isMicButtonPressedRef.current) {
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.error("Recognition restart failed", e);
          // Failsafe to prevent getting stuck in a recording state.
          isMicButtonPressedRef.current = false;
        }
      } else {
        // If recording ended because the user released the button, submit the form with the final text.
        // Use the ref to get the LATEST value of userInput, avoiding the stale closure problem.
        if (userInputRef.current.trim() && formRef.current) {
           formRef.current.requestSubmit();
        }
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      // For fatal errors, prevent any restart attempts and inform the user.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert("Microphone access was denied. Please allow microphone access in your browser settings to use this feature.");
        isMicButtonPressedRef.current = false;
      }
      // For other non-fatal errors (like 'no-speech'), onend will be called next,
      // and our logic there will decide whether to restart or submit.
    };
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Iterate through all results from the beginning of the session
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript.trim() + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const baseText = userInputBeforeRecording.current.trim();
      const separator = baseText ? ' ' : '';

      // Append the latest final and interim results to the text that existed before recording started.
      setUserInput(baseText + separator + finalTranscript + interimTranscript);
      
      // If we got a final result, update the "base text" so future results append correctly.
      if (finalTranscript) {
        userInputBeforeRecording.current = (baseText + separator + finalTranscript).trim();
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
        if (recognitionRef.current) {
            isMicButtonPressedRef.current = false; // Prevent restart attempts on unmount
            recognitionRef.current.onend = null; // Avoid side-effects on unmount
            recognitionRef.current.stop();
        }
    };
  // The effect should only run once to set up the recognition object.
  // setUserInput is a stable function provided by React's useState.
  }, [setUserInput]);

  const handleMicPress = () => {
    if (!recognitionRef.current || isRecording) return;
    isMicButtonPressedRef.current = true;
    
    // Clear the input field and the base text for transcription.
    setUserInput('');
    userInputBeforeRecording.current = ''; 
    
    try {
        recognitionRef.current.start();
    } catch (e) {
        // This can happen if start() is called when not in a 'disconnected' state.
        console.error("Speech recognition failed to start:", e);
        isMicButtonPressedRef.current = false;
        setIsRecording(false);
    }
  };

  const handleMicRelease = () => {
    // Only stop if we are the ones who started it.
    if (!recognitionRef.current || !isMicButtonPressedRef.current) return;
    isMicButtonPressedRef.current = false;
    recognitionRef.current.stop();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && userInput.trim()) {
        formRef.current?.requestSubmit();
      }
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="w-full">
      <div className="relative">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your list, paste a recipe URL, or press and hold the mic to talk..."
          className="w-full p-4 pr-16 text-slate-800 bg-white border-2 border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-200 resize-none"
          rows={4}
          disabled={isLoading}
        />
        {isSpeechRecognitionSupported && (
          <button
            type="button"
            onMouseDown={handleMicPress}
            onMouseUp={handleMicRelease}
            onTouchStart={handleMicPress}
            onTouchEnd={handleMicRelease}
            // If the user's finger/mouse leaves the button, stop recording.
            onMouseLeave={isRecording ? handleMicRelease : undefined}
            disabled={isLoading}
            className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isRecording ? 'bg-red-500 text-white scale-110' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            aria-label={isRecording ? 'Recording...' : 'Press and hold to record'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="mt-4 w-full flex justify-center items-center gap-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-indigo-500/50 transform hover:-translate-y-0.5"
      >
        {isLoading ? (
          <>
            <Loader />
            <span>Thinking...</span>
          </>
        ) : hasExistingList ? (
          "✨ Add to Checklist"
        ) : (
          "✨ Generate Smart Checklist"
        )}
      </button>
    </form>
  );
};