import { useState, useEffect } from 'react';
import './Patterns.css';
import { getPatterns } from '../backend/api';

const USER_ID = 'demo-user';

function StatCard({ emoji, label, value, sub }) {
  return (
    <div className="stat-card">
      <span className="stat-emoji">{emoji}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function MoodBar({ moods, total }) {
  const pct = (count) => total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className="mood-bar-section">
      <p className="section-title">Mood distribution</p>
      <div className="mood-bar-track">
        <div className="mood-bar-fill mood-good" style={{ width: `${pct(moods.good)}%` }} />
        <div className="mood-bar-fill mood-neutral" style={{ width: `${pct(moods.neutral)}%` }} />
        <div className="mood-bar-fill mood-bad" style={{ width: `${pct(moods.bad)}%` }} />
      </div>
      <div className="mood-bar-legend">
        <span><span className="legend-dot" style={{ background: '#6B8F71' }} /> Good {pct(moods.good)}%</span>
        <span><span className="legend-dot" style={{ background: '#C4A460' }} /> Neutral {pct(moods.neutral)}%</span>
        <span><span className="legend-dot" style={{ background: '#C4705A' }} /> Bad {pct(moods.bad)}%</span>
      </div>
    </div>
  );
}

function PredictionCard({ prediction }) {
  const isPositive = prediction.type === 'positive';
  return (
    <div className={`prediction-card ${isPositive ? 'prediction-positive' : 'prediction-warning'}`}>
      <div className="prediction-header">
        <span className="prediction-icon">{prediction.icon}</span>
        <p className="prediction-text">{prediction.text}</p>
      </div>
      <p className="prediction-tip">{prediction.tip}</p>
    </div>
  );
}

export default function Patterns() {
  const [hasEnoughData, setHasEnoughData] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [stats, setStats] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    getPatterns({ userId: USER_ID })
      .then((res) => {
        setHasEnoughData(res.has_enough_data);
        setPatterns(res.patterns || []);
        setStats(res.stats || null);
        setPredictions(res.predictions || []);
      })
      .catch((err) => {
        console.error('Failed to load patterns:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="patterns-wrapper">
      {/* Brand */}
      <div className="brand">
        <span className="brand-name">Kōru</span>
        <span className="brand-tag">Patterns</span>
      </div>

      <div className="patterns-container">
        
        {/* Header */}
        <div className="patterns-header">
          <h1 className="patterns-title">Your Patterns</h1>
          <p className="patterns-subtext">
            {stats ? `Based on ${stats.total_entries} entries` : 'Based on last 30 days'}
          </p>
        </div>

        {/* Loading / Error / Empty */}
        {loading ? (
          <div className="empty-state-patterns">
            <p>Analyzing your patterns...</p>
          </div>
        ) : error ? (
          <div className="empty-state-patterns">
            <span className="empty-illustration">⚠️</span>
            <p>{error}</p>
            <button onClick={loadData} className="retry-btn">Retry</button>
          </div>
        ) : !hasEnoughData ? (
          <div className="empty-state-patterns">
            <span className="empty-illustration">🔍</span>
            <p>Keep logging — patterns appear after 7 days</p>
          </div>
        ) : (
          <>
            {/* ── Stats Overview ── */}
            {stats && (
              <div className="stats-grid">
                <StatCard
                  emoji="📊"
                  label="Entries"
                  value={stats.total_entries}
                />
                <StatCard
                  emoji="😴"
                  label="Avg sleep"
                  value={stats.avg_sleep_hours ? `${stats.avg_sleep_hours}h` : '—'}
                />
                <StatCard
                  emoji="💪"
                  label="Exercise"
                  value={`${stats.exercise_rate}%`}
                  sub="of days"
                />
                <StatCard
                  emoji="😊"
                  label="Good days"
                  value={`${stats.total_entries > 0 ? Math.round(stats.mood_distribution.good / stats.total_entries * 100) : 0}%`}
                />
              </div>
            )}

            {/* ── Mood Bar ── */}
            {stats && (
              <MoodBar moods={stats.mood_distribution} total={stats.total_entries} />
            )}

            {/* ── Top Symptoms ── */}
            {stats?.top_symptoms?.length > 0 && (
              <div className="symptoms-section">
                <p className="section-title">Most frequent symptoms</p>
                <div className="symptoms-list">
                  {stats.top_symptoms.map((s) => (
                    <div key={s.name} className="symptom-row">
                      <span className="symptom-name">{s.name}</span>
                      <div className="symptom-bar-track">
                        <div
                          className="symptom-bar-fill"
                          style={{ width: `${Math.min(s.count / stats.total_entries * 100, 100)}%` }}
                        />
                      </div>
                      <span className="symptom-count">{s.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Correlations ── */}
            <p className="section-title">Correlations detected</p>
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
                    {/* Mini bar */}
                    <div className="correlation-track">
                      <div
                        className={`correlation-fill fill-${pattern.strength}`}
                        style={{ width: `${pattern.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className={`pattern-badge badge-${pattern.strength}`}>
                    {pattern.strength === 'med' ? 'MED' : pattern.strength.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Predictions / Tips ── */}
            {predictions.length > 0 && (
              <>
                <p className="section-title" style={{ marginTop: '32px' }}>Insights & predictions</p>
                <div className="predictions-list">
                  {predictions.map((pred, i) => (
                    <PredictionCard key={i} prediction={pred} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}