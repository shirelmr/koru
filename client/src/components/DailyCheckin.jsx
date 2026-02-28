import { useState, useEffect } from 'react'
import './DailyCheckin.css'
import InsightModal from '../components/InsightModal'

const DailyCheckIn = () => {
  const [entry, setEntry] = useState('')
  const [sleep, setSleep] = useState(0)
  const [stress, setStress] = useState(0)
  const [exercise, setExercise] = useState(null)
  const [showInsights, setShowInsights] = useState(false)

  // Inject Google Fonts
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Outfit:wght@300;400;500;600&display=swap'
    document.head.appendChild(link)
    return () => document.head.removeChild(link)
  }, [])

  const formatDate = () => {
    const today = new Date()
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleSubmit = () => {
    setShowInsights(true)
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

        <div className="checkin-header">
          <h1 className="checkin-title">How are you today?</h1>
          <p className="checkin-date">{formatDate()}</p>
        </div>

        <div className="header-ornament">
          <span className="ornament-line" />
          <span className="ornament-dot" />
          <span className="ornament-dot" style={{ opacity: 0.25 }} />
          <span className="ornament-dot" />
          <span className="ornament-line" />
        </div>

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

        <div className="quick-inputs">
          <div className="input-row">
            <div className="input-label">
              <span className="input-emoji">😴</span>
              <span>Sleep</span>
            </div>
            {renderDots(sleep, 5, setSleep)}
          </div>

          <div className="divider" />

          <div className="input-row">
            <div className="input-label">
              <span className="input-emoji">😤</span>
              <span>Stress</span>
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

        <button
          className={`log-button ${entry.length > 0 ? 'ready' : ''}`}
          onClick={handleSubmit}
          type="button"
        >
          {entry.length > 0 ? 'Log Entry →' : 'Log Entry'}
        </button>

        <p className="footer-text">Takes 30 seconds · No account needed</p>

      </div>

      <InsightModal
        isOpen={showInsights}
        onClose={() => setShowInsights(false)}
      />

    </div>
  )
}

export default DailyCheckIn