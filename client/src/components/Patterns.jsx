import { useState } from 'react';
import './Patterns.css';

// Mock data based on your API spec
const mockPatterns = [
  {
    id: 1,
    cause: 'Sleeping < 6h',
    effect: 'Headache',
    occurrences: 9,
    total: 11,
    percentage: 82,
    strength: 'high', // 'high' | 'med' | 'positive'
  },
  {
    id: 2,
    cause: 'High stress',
    effect: 'Poor sleep',
    occurrences: 5,
    total: 7,
    percentage: 71,
    strength: 'med',
  },
  {
    id: 3,
    cause: 'Exercise',
    effect: 'Good mood',
    occurrences: 8,
    total: 9,
    percentage: 88,
    strength: 'positive',
  },
];

export default function Patterns() {
  // Toggle this to true/false to test the empty state during the hackathon
  const [hasEnoughData, setHasEnoughData] = useState(true);

  return (
    <div className="patterns-wrapper">
      <div className="patterns-container">
        
        {/* Header */}
        <div className="patterns-header">
          <h1 className="patterns-title">Your Patterns</h1>
          <p className="patterns-subtext">Based on last 30 days</p>
        </div>

        {/* Content */}
        {!hasEnoughData ? (
          <div className="empty-state-patterns">
            <span className="empty-illustration">🔍</span>
            <p>Keep logging — patterns appear after 7 days</p>
            {/* Hackathon demo toggle */}
            <button 
              onClick={() => setHasEnoughData(true)} 
              style={{marginTop: '20px', fontSize: '0.8rem'}}
              className="log-button" /* Reusing the button style from DailyCheckin */
            >
              Simulate 7+ Days of Data
            </button>
          </div>
        ) : (
          <div className="patterns-list">
            {mockPatterns.map((pattern) => (
              <div key={pattern.id} className={`pattern-card strength-${pattern.strength}`}>
                <div className="pattern-info">
                  <h3 className="pattern-text">
                    {pattern.cause} → {pattern.effect}
                  </h3>
                  <p className="pattern-sub">
                    {pattern.occurrences} of {pattern.total} times · {pattern.percentage}% correlation
                  </p>
                </div>
                <div className={`pattern-badge badge-${pattern.strength}`}>
                  {pattern.strength === 'med' ? 'MED' : pattern.strength.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}