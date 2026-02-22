import React from 'react';
import './DailySummaryCard.css';

export default function DailySummaryCard({ memories, onMinimize, onViewReport }) {
    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    // Calculate stats
    const goals = memories.filter(m => m.type === 'goal');
    const totalGoals = goals.length;
    const completedGoals = goals.filter(m => m.status === 'completed' || m.progress >= 100).length;

    // For "Goals Updated", mock it as goals with progress > 0
    const updatedGoals = goals.filter(m => m.progress > 0).length;

    // Approaching deadlines
    const upcomingDeadlines = goals
        .filter(m => m.deadline && m.status !== 'completed')
        .map(m => {
            const daysLeft = Math.ceil((new Date(m.deadline) - today) / (1000 * 60 * 60 * 24));
            return { ...m, daysLeft };
        })
        .filter(m => m.daysLeft >= 0)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    const nextDeadline = upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    return (
        <div className="ds-root">
            {/* Left Avatar Section */}
            <div className="ds-avatar-area">
                <img
                    src="/images/akane1.png"
                    alt="Akane Avatar"
                    className="ds-avatar"
                />
            </div>

            {/* Right Content Section */}
            <div className="ds-content-area">
                <div className="ds-header">
                    Here's your daily summary for {dateString}.
                </div>

                <div className="ds-stats-glass-box">
                    {/* Goals Updated */}
                    <div className="ds-stat-row">
                        <div className="ds-stat-left">
                            <span className="ds-icon icon-chart">📈</span>
                            <span className="ds-label">Goals Updated</span>
                        </div>
                        <div className="ds-stat-right">
                            {updatedGoals}/{totalGoals}
                        </div>
                    </div>

                    {/* Tasks Completed */}
                    <div className="ds-stat-row">
                        <div className="ds-stat-left">
                            <span className="ds-icon icon-leaf">🍃</span>
                            <span className="ds-label">Tasks Completed</span>
                        </div>
                        <div className="ds-stat-right">
                            {completedGoals}
                        </div>
                    </div>

                    {/* Deadline Approaching */}
                    {nextDeadline ? (
                        <div className="ds-stat-row ds-warning-row">
                            <div className="ds-stat-left">
                                <span className="ds-icon icon-warning">⚠️</span>
                                <span className="ds-label text-warning">1 Deadline Approaching</span>
                                <span className="ds-subtext"> · {nextDeadline.title} in {nextDeadline.daysLeft} days</span>
                            </div>
                        </div>
                    ) : (
                        <div className="ds-stat-row">
                            <div className="ds-stat-left">
                                <span className="ds-icon" style={{ opacity: 0 }}>✔️</span>
                                <span className="ds-label" style={{ color: 'rgba(255,255,255,0.4)' }}>No immediate deadlines</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="ds-footer">
                    <button className="ds-report-btn" onClick={onViewReport}>
                        View Full Report <span className="ds-chevron">›</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
