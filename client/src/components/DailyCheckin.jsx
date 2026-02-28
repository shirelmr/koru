import { useState } from 'react'
import './DailyCheckin.css'

const DailyCheckIn = () => {
  const [entry, setEntry] = useState('')
  const [sleep, setSleep] = useState(0)
  const [stress, setStress] = useState(0)
  const [exercise, setExercise] = useState(null) // null = untouched

  const formatDate = () => {
    const today = new Date()
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleSubmit = () => {
    console.log({ entry, sleep, stress, exercise, date: new Date().toISOString() })
  }

  const renderDots = (current, max, onChange) => (
    <div className="dots-container">
      {[...Array(max)].map((_, i) => (
        <button
          key={i}
          className={`dot ${i < current ? 'filled' : ''}`}
          onClick={() => onChange(i + 1 === current ? 0 : i + 1)}
          type="button"
          aria-label={`${i + 1} of ${max}`}
        />
      ))}
    </div>
  )

  return (
    <div className="checkin-wrapper">
      <div className="checkin-container">
        {/* Header */}
        <div className="checkin-header">
          <h1 className="checkin-title">How are you today?</h1>
          <p className="checkin-date">{formatDate()}</p>
        </div>

        {/* Textarea */}
        <div className="textarea-wrapper">
          <textarea
            className="checkin-textarea"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Write freely... 'Woke up with a headache, slept 5h, had two coffees'"
            rows={5}
          />
          <span className="char-count">{entry.length > 0 ? `${entry.length} chars` : ''}</span>
        </div>

        {/* Quick inputs */}
        <div className="quick-inputs">
          <div className="input-row">
            <div className="input-label">
              <span className="input-emoji">😴</span>
              <span>Sleep quality</span>
            </div>
            {renderDots(sleep, 5, setSleep)}
          </div>

          <div className="divider" />

          <div className="input-row">
            <div className="input-label">
              <span className="input-emoji">😤</span>
              <span>Stress level</span>
            </div>
            {renderDots(stress, 5, setStress)}
          </div>

          <div className="divider" />

          <div className="input-row">
            <div className="input-label">
              <span className="input-emoji">💪</span>
              <span>Exercise</span>
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-option ${exercise === true ? 'active' : ''}`}
                onClick={() => setExercise(exercise === true ? null : true)}
                type="button"
              >
                Yes
              </button>
              <button
                className={`toggle-option ${exercise === false ? 'active-no' : ''}`}
                onClick={() => setExercise(exercise === false ? null : false)}
                type="button"
              >
                No
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          className={`log-button ${entry.length > 0 ? 'ready' : ''}`}
          onClick={handleSubmit}
          type="button"
        >
          Log Entry
        </button>

        <p className="footer-text">Takes 30 seconds · No account needed</p>
      </div>
    </div>
  )
}

export default DailyCheckIn