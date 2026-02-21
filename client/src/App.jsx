import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import Avatar3D from './components/Avatar3D';
import ChatPanel from './components/ChatPanel';
// GoalsPanel is removed
import { useVoice } from './hooks/useVoice';
import { api } from './services/api';

const USER_ID = 'nova-user-1';

const TABS = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
];

const App = () => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [avatarState, setAvatarState] = useState('idle');
    const [memories, setMemories] = useState([]);
    const [serverStatus, setServerStatus] = useState('connecting');
    const [activeTab, setActiveTab] = useState('chat');
    const [dailyReport, setDailyReport] = useState(null);
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [toasts, setToasts] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isTaskFound, setIsTaskFound] = useState(false);

    const headerRef = useRef(null);

    // Use a ref so voice callback always has the latest sendMessage (avoids stale closure)
    const sendMessageRef = useRef(null);

    const handleSpeakStart = useCallback(() => setAvatarState('talking'), []);
    const handleSpeakEnd = useCallback(() => setAvatarState('idle'), []);
    const handleTranscript = useCallback((text) => {
        if (text && sendMessageRef.current) sendMessageRef.current(text);
    }, []);

    const { isListening, isSpeaking, isSupported, startListening, stopListening, speak } = useVoice({
        onTranscript: handleTranscript,
        onSpeakStart: handleSpeakStart,
        onSpeakEnd: handleSpeakEnd
    });

    // Update avatar state based on voice
    useEffect(() => {
        if (isListening) setAvatarState('listening');
        else if (!isSpeaking && !isLoading) setAvatarState('idle');
    }, [isListening, isSpeaking, isLoading]);

    // Load history and memories
    const checkServerAndLoadData = useCallback(async () => {
        try {
            setServerStatus('connecting');
            // Health check
            await api.healthCheck();
            setServerStatus('online');

            // Load chat history
            const { messages: hist } = await api.getChatHistory(USER_ID);
            if (hist?.length) setMessages(hist);

            // Load memories
            const mems = await api.getMemories(USER_ID);
            setMemories(mems || []);

            // Load Daily Report
            const dateStr = new Date().toISOString().split('T')[0];
            let report = await api.getDailyReport(USER_ID, dateStr);
            if (!report || report.message) {
                report = await api.generateDailyReport(USER_ID, dateStr);
            }
            setDailyReport(report);
        } catch (err) {
            setServerStatus('offline');
            console.warn('Server not reachable:', err.message);
        }
    }, []);

    useEffect(() => {
        checkServerAndLoadData();

        // Entrance animation
        gsap.fromTo(headerRef.current,
            { opacity: 0, y: -20 },
            { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
        );
    }, [checkServerAndLoadData]);

    // Auto-retry when offline
    useEffect(() => {
        if (serverStatus !== 'offline') return;

        const timer = setInterval(() => {
            console.log('🔄 Auto-retrying server connection...');
            checkServerAndLoadData();
        }, 10000); // Retry every 10s

        return () => clearInterval(timer);
    }, [serverStatus, checkServerAndLoadData]);

    const specialMemories = useMemo(() => memories.filter(m => m.type !== 'reminder'), [memories]);

    const filteredMemories = useMemo(() => {
        return specialMemories.filter(m => {
            const catMatch = filterCategory === 'all' || m.category === filterCategory;
            const prioMatch = filterPriority === 'all' || m.priority === filterPriority;
            return catMatch && prioMatch;
        });
    }, [specialMemories, filterCategory, filterPriority]);

    const sendMessage = useCallback(async (text) => {
        if (!text?.trim() || isLoading) return;

        const userMsg = { role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        setAvatarState('thinking');
        setIsTaskFound(false); // Reset on new message

        try {
            const { reply, memoryAdded, addedMemoryTypes } = await api.sendMessage(USER_ID, text);
            const novaMsg = { role: 'assistant', content: reply, timestamp: new Date() };
            setMessages(prev => [...prev, novaMsg]);
            setAvatarState('talking');

            // Define special types that trigger "Evolution" and UI updates
            const specialTypes = ['note', 'goal', 'learning', 'career'];

            // Only trigger "Task Found" (Avatar evolution) if a special memory was added
            if (memoryAdded && addedMemoryTypes?.some(type => specialTypes.includes(type))) {
                setIsTaskFound(true);
            }

            speak(reply);

            // Re-fetch memories if AI updated them
            if (memoryAdded) {
                console.log('✨ Memories updated by AI, refreshing...');
                const mems = await api.getMemories(USER_ID);
                setMemories(mems || []);
            }
        } catch (err) {
            const errMsg = {
                role: 'assistant',
                content: serverStatus === 'offline'
                    ? "I can't reach the server right now. Make sure the backend is running on port 5000."
                    : `Sorry, I ran into an error: ${err.message}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errMsg]);
            setAvatarState('idle');
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, speak, serverStatus]);

    // Keep ref always pointing to latest sendMessage (used by voice callback)
    useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

    const handleMicToggle = useCallback(() => {
        if (isListening) stopListening();
        else startListening();
    }, [isListening, startListening, stopListening]);

    const deleteMemory = useCallback(async (id) => { // Renamed from handleDeleteMemory
        try {
            await api.deleteMemory(id);
            setMemories(prev => prev.filter(m => m._id !== id));
        } catch (err) {
            console.error('Delete memory error:', err.message);
        }
    }, []);

    const toggleReminder = async (id, status) => {
        try {
            const updated = await api.updateMemory(id, { status: status ? 'completed' : 'active' });
            setMemories(prev => prev.map(m => m._id === id ? updated : m));
        } catch (err) {
            console.error('Toggle reminder error:', err);
        }
    };

    const getCategoryProgress = (category) => {
        const catMems = memories.filter(m => m.category === category && m.type === 'goal');
        if (!catMems.length) return 0;
        const total = catMems.reduce((acc, m) => acc + (m.progress || 0), 0);
        return Math.round(total / catMems.length);
    };

    const DashboardView = () => (
        <div className="dashboard-overlay">
            <div className="dashboard-grid">
                {/* Progress Overview */}
                <section className="dashboard-card main-stats glass-card">
                    <header className="card-header">
                        <h3>🎯 Goal Progress Overview</h3>
                    </header>
                    <div className="radial-stats">
                        <div className="radial-item">
                            <div className="radial-progress" style={{ '--progress': `${getCategoryProgress('career')}%` }}>
                                <div className="radial-inner"><span>{getCategoryProgress('career')}%</span></div>
                            </div>
                            <label>Career</label>
                        </div>
                        <div className="radial-item">
                            <div className="radial-progress" style={{ '--progress': `${getCategoryProgress('learning')}%` }}>
                                <div className="radial-inner"><span>{getCategoryProgress('learning')}%</span></div>
                            </div>
                            <label>Learning</label>
                        </div>
                        <div className="radial-item">
                            <div className="radial-progress" style={{ '--progress': `${getCategoryProgress('health')}%` }}>
                                <div className="radial-inner"><span>{getCategoryProgress('health')}%</span></div>
                            </div>
                            <label>Health</label>
                        </div>
                    </div>
                </section>

                {/* Counter Stats */}
                <div className="side-stats-stack">
                    <section className="dashboard-card stat-mini glass-card">
                        <div className="stat-value">🔥 12</div>
                        <div className="stat-label">Day Streak</div>
                    </section>
                    <section className="dashboard-card stat-mini glass-card">
                        <div className="stat-value">✅ {memories.filter(m => m.status === 'completed').length}</div>
                        <div className="stat-label">Goals Done</div>
                    </section>
                </div>

                {/* Deadlines */}
                <section className="dashboard-card deadlines-card glass-card">
                    <header className="card-header">
                        <h3>⏳ Upcoming Deadlines</h3>
                    </header>
                    <div className="deadlines-list">
                        {memories.filter(m => m.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 3).map(m => (
                            <div key={m._id} className="deadline-item">
                                <span>{m.title}</span>
                                <small>{new Date(m.deadline).toLocaleDateString()}</small>
                            </div>
                        ))}
                    </div>
                </section>

                {/* AI Suggestion */}
                <section className="dashboard-card suggestion-card glass-card">
                    <header className="card-header">
                        <h3>💡 AI Suggestion</h3>
                    </header>
                    <p>Focus on finishing <strong>React Revision</strong> before starting new learning modules to maintain consistency.</p>
                </section>

                {/* MEMORY & GOALS INTEGRATED INTO DASHBOARD */}
                <section className="dashboard-card memory-management-card glass-card">
                    <header className="card-header">
                        <h3>🧠 Memory & Goal Manager</h3>
                        <div className="card-actions">
                        </div>
                    </header>
                    <div className="filter-row">
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                            <option value="all">Categories</option>
                            <option value="career">Career</option>
                            <option value="learning">Learning</option>
                            <option value="personal">Personal</option>
                        </select>
                        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                            <option value="all">Priority</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div className="cards-list-dashboard">
                        {filteredMemories.map(mem => (
                            <div key={mem._id} className={`memory-card-mini ${mem.type}`}>
                                <div className="card-top">
                                    <span className="type-icon">{mem.type === 'note' ? '📄' : '🎯'}</span>
                                    <span className="card-title-mini">{mem.title || mem.content}</span>
                                </div>
                                {mem.type === 'goal' && mem.progress > 0 && (
                                    <div className="mini-progress">
                                        <div className="mini-bar" style={{ width: `${mem.progress}%` }}></div>
                                    </div>
                                )}
                                <button className="delete-btn-tiny" onClick={() => deleteMemory(mem._id)}>×</button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );


    const showToast = useCallback((msg, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    // Proactive Reminder Check
    useEffect(() => {
        if (memories.length > 0) {
            const approaching = memories.filter(m =>
                m.type === 'goal' &&
                m.deadline &&
                m.status === 'active' &&
                new Date(m.deadline) < new Date(Date.now() + 86400000) // Within 24 hours
            );
            if (approaching.length > 0) {
                showToast(`⚠️ Deadline approaching: ${approaching[0].title}`, 'warning');
            }
        }
    }, [memories, showToast]);


    return (
        <div className={`app ${activeTab}-active`}>
            {/* Header */}
            <header className="header" ref={headerRef}>
                <div className="header-left">
                    <div className="header-logo">
                        <div className="logo-dot"></div>
                        Akane<span>-chan</span>
                    </div>

                    <nav className="header-tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span className="tab-icon">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="header-center">
                    <div className="header-status">
                        <span className={`status-dot ${serverStatus}`}></span>
                        {serverStatus === 'online' ? '● Ready' : '● Connecting...'}
                    </div>
                </div>

                <div className="header-right">
                    <div className="header-actions">
                        <div
                            className="notification-bell-container"
                            onMouseEnter={() => setShowNotifications(true)}
                            onMouseLeave={() => setShowNotifications(false)}
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <div className="notification-bell">
                                🔔
                                {specialMemories.length > 0 && <span className="bell-badge">{specialMemories.length}</span>}
                            </div>

                            {showNotifications && (
                                <div className="notifications-dropdown glass-card">
                                    <div className="dropdown-header">Recent Memories & Goals</div>
                                    <div className="dropdown-list">
                                        {specialMemories.length === 0 ? <p className="empty-msg">No memories yet.</p> :
                                            specialMemories.slice(0, 5).map(m => (
                                                <div key={m._id} className="dropdown-item">
                                                    <span className="item-icon">{m.type === 'note' ? '📄' : '🎯'}</span>
                                                    <div className="item-content">
                                                        <div className="item-title">{m.title || m.content}</div>
                                                        <div className="item-meta">{m.category} · {m.priority}</div>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                    <button className="view-all-btn" onClick={() => setActiveTab('dashboard')}>View All in Dashboard</button>
                                </div>
                            )}
                        </div>
                        <div className="user-profile">👤</div>
                    </div>
                </div>
            </header>


            {/* LEFT PANEL: MEMORY & GOALS (Restored) */}
            <aside className="left-panel sidebar">
                <div className="panel-header">
                    <h2 className="panel-title">🧠 MEMORY & GOALS</h2>
                </div>

                <div className="filter-row">
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="all">Categories</option>
                        <option value="career">Career</option>
                        <option value="learning">Learning</option>
                        <option value="personal">Personal</option>
                    </select>
                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                        <option value="all">Priority</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                <div className="cards-list">
                    {filteredMemories.map(mem => (
                        <div key={mem._id} className={`memory-card-mini ${mem.type}`}>
                            <div className="card-top">
                                <span className="type-icon">{mem.type === 'note' ? '📄' : '🎯'}</span>
                                <span className="card-title-mini">{mem.title || mem.content}</span>
                            </div>
                            {mem.type === 'goal' && mem.progress > 0 && (
                                <div className="mini-progress">
                                    <div className="mini-bar" style={{ width: `${mem.progress}%` }}></div>
                                </div>
                            )}
                            <button className="delete-btn-tiny" onClick={() => deleteMemory(mem._id)}>×</button>
                        </div>
                    ))}
                </div>
            </aside>

            {/* CENTER PANEL: AVATAR / DASHBOARD */}
            <main className="center-panel">
                <div className="avatar-background-layer">
                    <div className="avatar-area">
                        <Avatar3D avatarState={avatarState} isTaskFound={isTaskFound} className="avatar-canvas" />

                        {/* Holographic Overlays */}
                        <div className="hologram-ui" style={{ top: '20%', left: '15%' }}>
                            <div className="h-header">SCANNING...</div>
                            <div className="h-val">82% BIO-SYNC</div>
                        </div>
                        <div className="hologram-ui" style={{ top: '60%', right: '10%' }}>
                            <div className="h-header">CORE TEMP</div>
                            <div className="h-val">36.5°C</div>
                        </div>
                        <div className="hologram-ui" style={{ bottom: '15%', left: '25%' }}>
                            <div className="h-header">MEMORY CACHE</div>
                            <div className="h-val">Active: {specialMemories.length}</div>
                        </div>
                    </div>
                </div>

                {activeTab === 'dashboard' && <DashboardView />}
            </main>

            {/* RIGHT PANEL: CHAT INTERFACE (Swapped) */}
            <aside className="right-panel sidebar chat-sidebar-mode">
                <ChatPanel
                    messages={messages}
                    isLoading={isLoading}
                    onSend={sendMessage}
                    onSuggestion={sendMessage}
                    avatarState={avatarState}
                    isListening={isListening}
                    onMicToggle={handleMicToggle}
                    voiceSupported={isSupported}
                />
            </aside>

            {/* Toast Notifications */}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.type}`}>
                        {t.msg}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;
