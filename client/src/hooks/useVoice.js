import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoice({ onTranscript, onSpeakStart, onSpeakEnd }) {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);

    const recognitionRef = useRef(null);
    const synthRef = useRef(null);
    const isListeningRef = useRef(false); // track real-time without stale closure
    const onTranscriptRef = useRef(onTranscript);

    // Keep callback refs fresh — avoids stale closures
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

    // Init speech synthesis safely (avoid SSR issues)
    useEffect(() => {
        synthRef.current = window.speechSynthesis;
    }, []);

    // Init speech recognition ONCE
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('SpeechRecognition not supported in this browser.');
            return;
        }

        setIsSupported(true);

        const recognition = new SpeechRecognition();
        recognition.continuous = true;       // keep listening until manually stopped
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('🎙️ Mic started');
            isListeningRef.current = true;
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            let interim = '';
            let finalText = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += t;
                } else {
                    interim += t;
                }
            }

            const current = finalText || interim;
            setTranscript(current);

            if (finalText.trim()) {
                // Stop listening before sending so Nova can reply
                recognition.stop();
                isListeningRef.current = false;
                setIsListening(false);
                if (onTranscriptRef.current) {
                    onTranscriptRef.current(finalText.trim());
                }
            }
        };

        recognition.onend = () => {
            console.log('🎙️ Mic ended');
            isListeningRef.current = false;
            setIsListening(false);
        };

        recognition.onerror = (e) => {
            console.error('🎙️ Speech recognition error:', e.error);
            isListeningRef.current = false;
            setIsListening(false);

            if (e.error === 'not-allowed') {
                alert('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
            }
        };

        recognitionRef.current = recognition;

        return () => {
            try { recognition.abort(); } catch (_) { }
        };
    }, []); // ← empty deps: only run once

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }
        if (isListeningRef.current) return;

        // Cancel any ongoing speech before listening
        if (synthRef.current) synthRef.current.cancel();

        setTranscript('');
        try {
            recognitionRef.current.start();
        } catch (err) {
            // Already started — abort and restart
            try {
                recognitionRef.current.abort();
                setTimeout(() => recognitionRef.current.start(), 200);
            } catch (_) { }
        }
    }, []);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current || !isListeningRef.current) return;
        try {
            recognitionRef.current.stop();
        } catch (_) { }
        isListeningRef.current = false;
        setIsListening(false);
    }, []);

    const speak = useCallback((text) => {
        const synth = synthRef.current || window.speechSynthesis;
        if (!synth) return;

        synth.cancel();

        // Clean markdown for TTS
        const clean = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .replace(/[-*]\s/g, '')
            .replace(/\n+/g, ' ')
            .trim();

        if (!clean) return;

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        utterance.volume = 1;

        // Pick a good voice — wait for voices to load if needed
        const setVoice = () => {
            const voices = synth.getVoices();
            const preferred = voices.find(v =>
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Microsoft Zira') ||
                v.name.includes('Microsoft David') ||
                (v.lang === 'en-US' && v.localService === false)
            );
            if (preferred) utterance.voice = preferred;
        };

        if (synth.getVoices().length > 0) {
            setVoice();
        } else {
            synth.onvoiceschanged = setVoice;
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            if (onSpeakStart) onSpeakStart();
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            if (onSpeakEnd) onSpeakEnd();
        };
        utterance.onerror = (e) => {
            console.error('TTS error:', e);
            setIsSpeaking(false);
            if (onSpeakEnd) onSpeakEnd();
        };

        synth.speak(utterance);
    }, [onSpeakStart, onSpeakEnd]);

    const cancelSpeech = useCallback(() => {
        const synth = synthRef.current || window.speechSynthesis;
        if (synth) synth.cancel();
        setIsSpeaking(false);
    }, []);

    return {
        isListening,
        isSpeaking,
        transcript,
        isSupported,
        startListening,
        stopListening,
        speak,
        cancelSpeech
    };
}
