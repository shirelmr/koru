import { useState, useEffect } from 'react'
import './DailyCheckin.css'
import InsightModal from '../components/InsightModal'
import { createDraft } from '../backend/api'

const USER_ID = 'demo-user'

const DailyCheckIn = () => {
  const [entry, setEntry] = useState('')
  const [sleep, setSleep] = useState(0)
  const [stress, setStress] = useState(0)
  const [exercise, setExercise] = useState(null)
  const [showInsights, setShowInsights] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [draftEntryId, setDraftEntryId] = useState(null)
  const [extractedData, setExtractedData] = useState(null)

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

  const handleSubmit = async () => {
    if (!entry.trim()) return
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const fullText = buildFullText()
      const result = await createDraft({ userId: USER_ID, text: fullText, date: today })
      setDraftEntryId(result.entry_id)
      setExtractedData(result.extracted_data)
      setShowInsights(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buildFullText = () => {
    let parts = [entry.trim()]
    if (sleep > 0) parts.push(`Sleep quality: ${sleep}/5`)
    if (stress > 0) parts.push(`Stress level: ${stress}/5`)
    if (exercise === true) parts.push('Did exercise today')
    if (exercise === false) parts.push('No exercise today')
    return parts.join('. ')
  }

  const handleInsightClose = () => {
    setShowInsights(false)
    setDraftEntryId(null)
    setExtractedData(null)
    setEntry('')
    setSleep(0)
    setStress(0)
    setExercise(null)
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

        {error && <p className="error-text" style={{color:'#C4705A',textAlign:'center',margin:'0.5rem 0',fontSize:'0.85rem'}}>{error}</p>}

        <button
          className={`log-button ${entry.length > 0 ? 'ready' : ''}`}
          onClick={handleSubmit}
          type="button"
          disabled={loading || !entry.trim()}
        >
          {loading ? 'Analyzing...' : entry.length > 0 ? 'Log Entry →' : 'Log Entry'}
        </button>

        <p className="footer-text">Takes 30 seconds · No account needed</p>

      </div>

      <InsightModal
        isOpen={showInsights}
        onClose={handleInsightClose}
        entryId={draftEntryId}
        extractedData={extractedData}
      />

    </div>
  )
}

export default DailyCheckIn