import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { gsap } from 'gsap';

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
    return (
        <div className="message nova">
            <div className="message-avatar">N</div>
            <div className="message-bubble">
                <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ msg }) {
    const bubbleRef = useRef(null);
    const isNova = msg.role === 'assistant';

    useLayoutEffect(() => {
        if (bubbleRef.current) {
            gsap.fromTo(bubbleRef.current,
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
            );
        }
    }, []);

    const renderContent = (text) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div ref={bubbleRef} className={`message ${isNova ? 'nova' : 'user'}`}>
            <div className="message-avatar">{isNova ? 'A' : 'U'}</div>
            <div>
                <div
                    className="message-bubble"
                    dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                />
                <div className={`message-time`} style={{ textAlign: isNova ? 'left' : 'right' }}>
                    {formatTime(msg.timestamp || Date.now())}
                </div>
            </div>
        </div>
    );
}

const SUGGESTIONS = [
    "What are my current goals?",
    "Add a new project",
    "Give me a productivity tip",
    "What should I focus on today?"
];

export default function ChatPanel({ messages, isLoading, onSend, onSuggestion, isListening, onMicToggle, voiceSupported }) {
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [inputValue, setInputValue] = useState('');

    // Auto-scroll
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const handleSend = () => {
        const text = inputValue.trim();
        if (!text || isLoading) return;
        onSend(text);
        setInputValue('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-area">
            {/* Messages */}
            {messages.length === 0 ? (
                <div className="empty-chat">
                    <div className="empty-icon">✦</div>
                    <h3>Hello, I'm Akane-chan</h3>
                    <p>Your personal AI manager. Ask me anything or try a suggestion below.</p>
                    <div className="suggestions">
                        {SUGGESTIONS.map(s => (
                            <button key={s} className="suggestion-chip" onClick={() => onSuggestion(s)}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="chat-messages">
                    {messages.map((msg, i) => (
                        <MessageBubble key={msg._id || i} msg={msg} />
                    ))}
                    {isLoading && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>
            )}

            {/* Input */}
            <div className="chat-input-area">
                <button
                    id="mic-btn"
                    className={`icon-btn mic ${isListening ? 'active' : ''}`}
                    onClick={onMicToggle}
                    title={voiceSupported ? (isListening ? 'Stop listening' : 'Start voice input') : 'Voice not supported'}
                    disabled={!voiceSupported}
                >
                    🎙️
                </button>
                <div className="chat-input-wrapper">
                    <textarea
                        ref={inputRef}
                        id="chat-input"
                        className="chat-input"
                        placeholder="Message Akane-chan..."
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                </div>
                <button
                    id="send-btn"
                    className="icon-btn send"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    title="Send message"
                >
                    ➤
                </button>
            </div>
        </div>
    );
}
