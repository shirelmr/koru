import { useState } from 'react';
import './Onboarding.css';

const CONDITIONS = [
  {
    id: 'general',
    emoji: '🌿',
    label: 'General Health',
    description: 'Track sleep, mood, stress, and daily wellness',
  },
  {
    id: 'diabetes',
    emoji: '🩸',
    label: 'Diabetes',
    description: 'Log glucose levels, insulin, meals, and carb intake',
  },
  {
    id: 'hypertension',
    emoji: '❤️‍🩹',
    label: 'Hypertension',
    description: 'Track blood pressure, sodium, medication, and heart rate',
  },
];

function ConditionPreview({ condition }) {
  const fields = {
    general: ['Sleep quality', 'Stress level', 'Mood', 'Exercise'],
    diabetes: ['Glucose (mg/dL)', 'Insulin taken', 'Carb intake', 'Meal type'],
    hypertension: ['Blood pressure', 'Heart rate', 'Sodium intake', 'Medication taken'],
  };

  return (
    <div className="onb-preview">
      <p className="onb-preview-title">Your daily check-in will include:</p>
      <ul className="onb-preview-list">
        {(fields[condition] || fields.general).map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="onb-preview-note">
        + Free-text journaling, AI face scan &amp; voice diary
      </p>
    </div>
  );
}

export default function Onboarding({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1); // 1 = pick, 2 = confirm

  const handleContinue = () => {
    if (!selected) return;
    setStep(2);
  };

  const handleConfirm = () => {
    localStorage.setItem('koru_condition', selected);
    localStorage.setItem('koru_onboarded', 'true');
    onComplete();
  };

  return (
    <div className="onb-wrapper">
      <div className="onb-container">
        {/* Brand */}
        <div className="brand">
          <span className="brand-name">Kōru</span>
          <span className="brand-tag">Setup</span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="onb-title">Welcome to Kōru</h1>
            <p className="onb-subtitle">
              Do you have a specific health condition you'd like to track?
              We'll personalize your daily check-in accordingly.
            </p>

            <div className="onb-cards">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  className={`onb-card ${selected === c.id ? 'onb-card-selected' : ''}`}
                  onClick={() => setSelected(c.id)}
                  type="button"
                >
                  <span className="onb-card-emoji">{c.emoji}</span>
                  <span className="onb-card-label">{c.label}</span>
                  <span className="onb-card-desc">{c.description}</span>
                  {selected === c.id && <span className="onb-card-check">✓</span>}
                </button>
              ))}
            </div>

            <button
              className={`onb-btn ${selected ? 'onb-btn-ready' : ''}`}
              onClick={handleContinue}
              disabled={!selected}
              type="button"
            >
              Continue →
            </button>
          </>
        ) : (
          <>
            <h1 className="onb-title">
              {CONDITIONS.find((c) => c.id === selected)?.emoji}{' '}
              {CONDITIONS.find((c) => c.id === selected)?.label}
            </h1>
            <p className="onb-subtitle">
              Here's what we'll track for you every day.
              You can always change this later.
            </p>

            <ConditionPreview condition={selected} />

            <div className="onb-actions">
              <button className="onb-btn onb-btn-ready" onClick={handleConfirm} type="button">
                Start Journaling →
              </button>
              <button className="onb-btn-back" onClick={() => setStep(1)} type="button">
                ← Go back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
