import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Timeline.css';
import { getEntries } from '../backend/api';

const USER_ID = 'demo-user';

const MOOD_COLORS = {
  good:    '#6B8F71',
  neutral: '#C4A460',
  bad:     '#C4705A',
};

const MOOD_LABELS = {
  good:    'Feeling good',
  neutral: 'Neutral day',
  bad:     'Rough day',
};

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFullDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function DayCard({ entry, index, isSelected, onClick }) {
  const date      = parseDate(entry.date);
  const dayNum    = date.getDate();
  const weekday   = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const excerpt   = entry.raw_text.slice(0, 80) + (entry.raw_text.length > 80 ? '...' : '');
  const visibleTags = entry.tags.slice(0, 4);
  const extraCount  = entry.tags.length - 4;

  return (
    <div
      className={`day-card ${index % 2 !== 0 ? 'alt' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="card-main">
        {/* Date */}
        <div className="card-date">
          <span className="card-day-num">{dayNum}</span>
          <span className="card-weekday">{weekday}</span>
        </div>

        {/* Tags */}
        <div className="card-tags">
          {visibleTags.map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
          {extraCount > 0 && (
            <span className="tag-chip tag-extra">+{extraCount}</span>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight
          size={16}
          className={`card-chevron ${isSelected ? 'rotated' : ''}`}
        />
      </div>

      {/* Bottom row */}
      <div className="card-bottom">
        <span
          className="mood-dot"
          style={{ backgroundColor: MOOD_COLORS[entry.mood] }}
        />
        <span className="card-excerpt">{excerpt}</span>
      </div>
    </div>
  );
}

function DetailRow({ emoji, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="detail-row">
      <span className="detail-emoji">{emoji}</span>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function ExpandedEntry({ entry }) {
  if (!entry) {
    return (
      <div className="empty-state">
        <span className="empty-icon">📅</span>
        <p className="empty-text">Select a day to read your full entry</p>
      </div>
    );
  }

  const data = entry.extracted_json || {};

  return (
    <div className="expanded-entry" key={entry.id}>
      {/* Date + mood */}
      <p className="expanded-date">{formatFullDate(entry.date)}</p>
      <div className="expanded-mood">
        <span
          className="mood-dot mood-dot-lg"
          style={{ backgroundColor: MOOD_COLORS[entry.mood] }}
        />
        <span
          className="expanded-mood-label"
          style={{ color: MOOD_COLORS[entry.mood] }}
        >
          {MOOD_LABELS[entry.mood]}
        </span>
      </div>

      {/* Health details */}
      <div className="expanded-divider" />
      <p className="section-label">Health details</p>
      <div className="detail-grid">
        <DetailRow emoji="😴" label="Sleep" value={
          data.sleep_hours
            ? `${data.sleep} · ${data.sleep_hours}h`
            : data.sleep
        } />
        <DetailRow emoji="😤" label="Stress" value={data.stress} />
        <DetailRow emoji="💪" label="Exercise" value={data.exercise ? 'Yes' : 'No'} />
        <DetailRow emoji="😊" label="Mood" value={data.mood} />
      </div>

      {/* Condition-specific details */}
      {data.condition === 'diabetes' && data.condition_data && (
        <>
          <div className="expanded-divider" />
          <p className="section-label">🩸 Diabetes tracking</p>
          <div className="detail-grid">
            <DetailRow emoji="🩸" label="Glucose" value={data.condition_data.glucose ? `${data.condition_data.glucose} mg/dL` : null} />
            <DetailRow emoji="💉" label="Insulin" value={data.condition_data.insulin === true ? 'Taken' : data.condition_data.insulin === false ? 'Not taken' : null} />
            <DetailRow emoji="🍞" label="Carb intake" value={data.condition_data.carbs} />
            <DetailRow emoji="🍽️" label="Last meal" value={data.condition_data.meal_type} />
          </div>
        </>
      )}

      {data.condition === 'hypertension' && data.condition_data && (
        <>
          <div className="expanded-divider" />
          <p className="section-label">❤️‍🩹 Hypertension tracking</p>
          <div className="detail-grid">
            <DetailRow emoji="❤️‍🩹" label="Blood pressure" value={data.condition_data.bp} />
            <DetailRow emoji="💓" label="Heart rate" value={data.condition_data.heart_rate ? `${data.condition_data.heart_rate} bpm` : null} />
            <DetailRow emoji="🧂" label="Sodium intake" value={data.condition_data.sodium} />
            <DetailRow emoji="💊" label="Medication" value={data.condition_data.medication === true ? 'Taken' : data.condition_data.medication === false ? 'Not taken' : null} />
          </div>
        </>
      )}

      {/* Symptoms */}
      {data.symptoms?.length > 0 && (
        <>
          <p className="section-label">Symptoms</p>
          <div className="expanded-tags">
            {data.symptoms.map((s) => (
              <span key={s} className="tag-chip tag-chip-lg tag-symptom">{s}</span>
            ))}
          </div>
        </>
      )}

      {/* Food / intake */}
      {data.food?.length > 0 && (
        <>
          <p className="section-label">Food &amp; intake</p>
          <div className="expanded-tags">
            {data.food.map((f) => (
              <span key={f} className="tag-chip tag-chip-lg tag-food">{f}</span>
            ))}
          </div>
        </>
      )}

      {/* Tags */}
      <p className="section-label">Tags</p>
      <div className="expanded-tags">
        {entry.tags.map((tag) => (
          <span key={tag} className="tag-chip tag-chip-lg">{tag}</span>
        ))}
      </div>

      <div className="expanded-divider" />

      {/* Full text */}
      <p className="section-label">Your entry</p>
      <p className="expanded-text">{entry.raw_text}</p>
    </div>
  );
}

export default function Timeline() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedId, setSelectedId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true);
    getEntries({ userId: USER_ID, month: monthStr })
      .then((res) => setEntries(res.entries || []))
      .catch((err) => console.error('Failed to load entries:', err))
      .finally(() => setLoading(false));
  }, [monthStr]);

  const isCurrentMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth()    === today.getMonth();

  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const nextMonth = () => {
    if (!isCurrentMonth)
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const filteredEntries = entries;

  const selectedEntry = entries.find((e) => e.id === selectedId) || null;

  return (
    <div className="page">

      {/* ── Left panel ── */}
      <div className="panel-left">
        {/* Brand */}
        <div className="brand">
          <span className="brand-name">Kōru</span>
          <span className="brand-tag">Timeline</span>
        </div>

        <h1 className="timeline-title">Your<br />Timeline</h1>
        <p className="timeline-sub">Track how you've been feeling</p>

        {/* Month navigator */}
        <div className="month-nav">
          <button className="month-btn" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="month-label">{formatMonthYear(currentMonth)}</span>
          <button
            className={`month-btn ${isCurrentMonth ? 'disabled' : ''}`}
            onClick={nextMonth}
            disabled={isCurrentMonth}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Cards list */}
        <div className="cards-list">
          {loading ? (
            <p className="no-entries">Loading entries...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="no-entries">No entries for this month.</p>
          ) : (
            filteredEntries.map((entry, i) => (
              <DayCard
                key={entry.id}
                entry={entry}
                index={i}
                isSelected={selectedId === entry.id}
                onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="panel-right">
        <ExpandedEntry entry={selectedEntry} />
      </div>

    </div>
  );
}
