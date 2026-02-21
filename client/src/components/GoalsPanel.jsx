import { useState } from 'react';
import { gsap } from 'gsap';

const TYPE_ICONS = {
    goal: '🎯',
    project: '🚀',
    note: '📝',
    preference: '⚙️',
    fact: '📌'
};

const TYPE_LABELS = {
    goal: 'Goal',
    project: 'Project',
    note: 'Note',
    preference: 'Preference',
    fact: 'Fact'
};

export default function GoalsPanel({ memories, onAdd, onDelete }) {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ type: 'goal', content: '' });
    const [adding, setAdding] = useState(false);

    const handleAdd = async () => {
        if (!form.content.trim()) return;
        setAdding(true);
        await onAdd({ ...form });
        setForm({ type: 'goal', content: '' });
        setShowForm(false);
        setAdding(false);
    };

    const handleDelete = async (id, el) => {
        gsap.to(el, { opacity: 0, x: -20, duration: 0.25, onComplete: () => onDelete(id) });
    };

    const active = memories.filter(m => m.status === 'active');

    return (
        <div className="sidebar">
            <div className="goals-header">
                <span className="goals-title">Memory & Goals</span>
                <button
                    className="header-btn"
                    onClick={() => setShowForm(v => !v)}
                    title="Add new memory"
                >
                    {showForm ? '✕' : '+ Add'}
                </button>
            </div>

            {showForm && (
                <div className="add-goal-form">
                    <select
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    >
                        {Object.entries(TYPE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{TYPE_ICONS[val]} {label}</option>
                        ))}
                    </select>
                    <textarea
                        placeholder={`Enter your ${form.type}...`}
                        value={form.content}
                        onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
                    />
                    <button className="add-goal-btn" onClick={handleAdd} disabled={adding}>
                        {adding ? 'Saving...' : `Save ${TYPE_LABELS[form.type]}`}
                    </button>
                </div>
            )}

            <div className="goals-list">
                {active.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '24px 12px' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px', opacity: 0.4 }}>🧠</div>
                        <p>No memories yet.</p>
                        <p style={{ marginTop: '4px' }}>Add goals, projects, or notes to give Akane-chan context about you.</p>
                    </div>
                ) : (
                    active.map(mem => (
                        <div
                            key={mem._id}
                            className={`goal-item ${mem.type}`}
                            id={`goal-${mem._id}`}
                        >
                            <div className="goal-type-badge">
                                {TYPE_ICONS[mem.type]} {TYPE_LABELS[mem.type]}
                            </div>
                            <div className="goal-content">{mem.content}</div>
                            <button
                                className="goal-delete"
                                onClick={(e) => {
                                    const el = e.target.closest('.goal-item');
                                    handleDelete(mem._id, el);
                                }}
                                title="Delete"
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Stats footer */}
            {active.length > 0 && (
                <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid var(--border-glass)',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap'
                }}>
                    {Object.entries(TYPE_LABELS).map(([type, label]) => {
                        const count = active.filter(m => m.type === type).length;
                        if (!count) return null;
                        return <span key={type}>{TYPE_ICONS[type]} {count} {label}{count > 1 ? 's' : ''}</span>;
                    })}
                </div>
            )}
        </div>
    );
}
