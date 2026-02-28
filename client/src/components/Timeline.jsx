import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Timeline.css';

const mockEntries = [
  {
    id: 1,
    date: '2026-02-28',
    raw_text: 'Woke up feeling pretty good today. Had a solid breakfast, went for a run in the morning. Feeling energized and ready for the week.',
    tags: ['exercise', 'good sleep', 'low stress', 'energized'],
    mood: 'good',
  },
  {
    id: 2,
    date: '2026-02-27',
    raw_text: 'Headache most of the day. Slept only 4 hours, had three coffees to compensate. Stressful work calls back to back.',
    tags: ['headache', 'poor sleep', 'high stress', 'caffeine', 'fatigue'],
    mood: 'bad',
  },
  {
    id: 3,
    date: '2026-02-26',
    raw_text: 'Normal day. Nothing special to report. Cooked at home, watched a show, went to bed on time.',
    tags: ['neutral mood', 'home cooked', 'good sleep'],
    mood: 'neutral',
  },
  {
    id: 4,
    date: '2026-02-25',
    raw_text: 'Felt a bit anxious in the morning but it passed. Afternoon was productive. Light walk outside helped.',
    tags: ['anxiety', 'productive', 'light exercise', 'improving'],
    mood: 'neutral',
  },
  {
    id: 5,
    date: '2026-02-24',
    raw_text: 'Really good day. Finished a big project at work, celebrated with friends in the evening. Feeling accomplished.',
    tags: ['accomplished', 'social', 'low stress', 'happy'],
    mood: 'good',
  },
];

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

function ExpandedEntry({ entry }) {
  if (!entry) {
    return (
      <div className="empty-state">
        <span className="empty-icon">📅</span>
        <p className="empty-text">Select a day to read your full entry</p>
      </div>
    );
  }

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

      {/* Tags section */}
      <p className="section-label">Tags detected</p>
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

  const isCurrentMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth()    === today.getMonth();

  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const nextMonth = () => {
    if (!isCurrentMonth)
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const filteredEntries = mockEntries.filter((e) => {
    const d = parseDate(e.date);
    return (
      d.getFullYear() === currentMonth.getFullYear() &&
      d.getMonth()    === currentMonth.getMonth()
    );
  });

  const selectedEntry = mockEntries.find((e) => e.id === selectedId) || null;

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
          {filteredEntries.length === 0 ? (
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
