import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { api } from '../services/api';

const USER_ID = 'nova-user-1';

export default function AnalyticsView({ memories }) {
    const [stats, setStats] = useState(null);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);

    useEffect(() => {
        let isMounted = true;

        async function loadAnalytics() {
            setLoading(true);
            try {
                const analyticsData = await api.getAnalytics(USER_ID, days);
                const insightsData = await api.getWeeklyInsights(USER_ID);

                if (isMounted) {
                    setStats(analyticsData);
                    setInsights(insightsData.insight);
                }
            } catch (err) {
                console.error("Failed to load analytics:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadAnalytics();
        return () => { isMounted = false; };
    }, [days, memories]);

    // Parse [Text](memory:ID) syntax from AI insight
    const renderInsightText = (text) => {
        if (!text) return "Analyzing your data...";

        // Regex to find 1) [Text] 2) (memory:ID)
        const parts = text.split(/(\[.*?\]\(memory:[a-fA-F0-9]+\))/g);

        return parts.map((part, index) => {
            const match = part.match(/\[(.*?)\]\(memory:([a-fA-F0-9]+)\)/);
            if (match) {
                const [, label, id] = match;
                // Check if this memory is already completed
                const memory = memories.find(m => m._id === id);
                const isCompleted = memory && (memory.progress >= 100 || memory.status === 'completed');

                return (
                    <span
                        key={index}
                        className="insight-memory-link"
                    >
                        {label}
                    </span>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    if (loading || !stats) {
        return (
            <div className="dashboard-view">
                <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-view">
            <div className="dashboard-container">
                <header className="dashboard-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                    <h2>📈 Progress & Analytics</h2>
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="modern-select"
                        style={{ width: '150px' }}
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                    </select>
                </header>

                <div className="dashboard-grid">
                    {/* TOP STATS */}
                    <div className="glass-card stat-card glow-blue">
                        <div className="stat-label">🔥 Current Streak</div>
                        <div className="stat-value">{stats.currentStreak} Days</div>
                        <div className="stat-sub">Longest: {stats.longestStreak} Days</div>
                    </div>

                    <div className="glass-card stat-card glow-green">
                        <div className="stat-label">✅ Completion Rate</div>
                        <div className="stat-value">{stats.completionRate}%</div>
                        <div className="stat-sub">{stats.completedGoals} / {stats.totalGoals} Goals</div>
                    </div>

                    {/* CHART */}
                    <div className="glass-card chart-card" style={{ gridColumn: '1 / -1', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: 'var(--text-main)' }}>Productivity Trends</h3>
                        <div style={{ flex: 1, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(15, 15, 30, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#00e5ff' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="completed"
                                        stroke="#00e5ff"
                                        strokeWidth={3}
                                        dot={{ fill: '#00e5ff', strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6, fill: '#fff' }}
                                        animationDuration={1500}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* AI INSIGHTS */}
                    <div className="glass-card insight-card" style={{ gridColumn: '1 / -1', borderLeft: '4px solid var(--accent-pink)' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>✨</span> Akane-chan's Weekly Insights
                        </h3>
                        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                            {renderInsightText(insights)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
