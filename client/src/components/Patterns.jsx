import { useState, useEffect } from 'react';
import './Patterns.css';
import { getPatterns } from '../backend/api';

const USER_ID = 'demo-user';

export default function Patterns() {
  const [hasEnoughData, setHasEnoughData] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPatterns({ userId: USER_ID })
      .then((res) => {
        setHasEnoughData(res.has_enough_data);
        setPatterns(res.patterns || []);
      })
      .catch((err) => console.error('Failed to load patterns:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="patterns-wrapper">
      <div className="patterns-container">
        
        {/* Header */}
        <div className="patterns-header">
          <h1 className="patterns-title">Your Patterns</h1>
          <p className="patterns-subtext">Based on last 30 days</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="empty-state-patterns">
            <p>Loading patterns...</p>
          </div>
        ) : !hasEnoughData ? (
          <div className="empty-state-patterns">
            <span className="empty-illustration">🔍</span>
            <p>Keep logging — patterns appear after 7 days</p>
          </div>
        ) : (
          <div className="patterns-list">
            {patterns.map((pattern, i) => (
              <div key={i} className={`pattern-card strength-${pattern.strength}`}>
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