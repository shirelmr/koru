import { useState, useEffect } from "react";
import "./InsightModal.css";

export default function InsightModal({ isOpen, onClose }) {
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      setTimeout(() => setSaved(false), 400);
    }
  }, [isOpen]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 2200);
  };

  if (!isOpen) return null;

  return (
    <div className={`insight-overlay ${visible ? "overlay-in" : ""}`}>
      <div className={`insight-modal ${visible ? "modal-in" : ""}`}>

        {saved ? (
          <div className="success-state">
            <div className="success-ring">
              <svg viewBox="0 0 52 52" className="checkmark-svg">
                <circle className="checkmark-circle" cx="26" cy="26" r="23" fill="none" />
                <path className="checkmark-check" fill="none" d="M14 26 l8 8 l16-16" />
              </svg>
            </div>
            <p className="success-title">Successfully saved</p>
            <p className="success-sub">Your check-in has been logged</p>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="insight-header">
              <div className="insight-header-top">
                <div className="insight-pulse" />
                <span className="insight-label-badge">Analysis complete</span>
              </div>
              <h2 className="insight-title">Here's what I found</h2>
              <p className="insight-subtitle">
                "Woke up with a headache, slept 5h, had two coffees..."
              </p>
            </div>

            {/* TAG GRID */}
            <div className="insight-grid">
              <TagGroup label="🤕 Symptoms" tags={["headache", "fatigue"]} color="red" delay={0} />
              <TagGroup label="😴 Sleep" tags={["low · 5h"]} color="blue" delay={1} />
              <TagGroup label="☕ Intake" tags={["coffee ×2", "pizza"]} color="amber" delay={2} />
              <TagGroup label="😤 Stress" tags={["high"]} color="red" delay={3} />
              <TagGroup label="💪 Exercise" tags={["none"]} color="gray" delay={4} />
              <TagGroup label="😊 Mood" tags={["neutral"]} color="green" delay={5} />
            </div>

            {/* SCORE BAR */}
            <div className="wellness-bar-section">
              <div className="wellness-bar-header">
                <span className="wellness-bar-label">Wellness score</span>
                <span className="wellness-bar-value">4 / 10</span>
              </div>
              <div className="wellness-track">
                <div className="wellness-fill" style={{ "--fill-pct": "40%" }} />
              </div>
            </div>

            {/* ACTIONS */}
            <div className="insight-actions">
              <button className="confirm-btn" onClick={handleSave}>
                <span>Confirm & Save</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
              <button className="edit-link" onClick={onClose}>
                Edit manually
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function TagGroup({ label, tags, color, delay }) {
  return (
    <div className={`tag-group tag-group--${color}`} style={{ "--delay": `${delay * 60}ms` }}>
      <div className="tag-label">{label}</div>
      <div className="tag-list">
        {tags.map((tag, i) => (
          <TagChip key={i} label={tag} />
        ))}
        <button className="tag-add">+</button>
      </div>
    </div>
  );
}

function TagChip({ label }) {
  return (
    <div className="tag-chip">
      {label}
      <span className="tag-remove">×</span>
    </div>
  );
}