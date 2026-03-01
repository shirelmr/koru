import { useState } from 'react'
import DailyCheckIn from './components/DailyCheckin'
import Timeline from './components/Timeline'
import Patterns from './components/Patterns'
import Onboarding from './components/Onboarding'
import './App.css'

function App() {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('koru_onboarded') === 'true')
  const [screen, setScreen] = useState('checkin')

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <div className="App">
      <nav className="dev-nav">
        <button
          className={screen === 'checkin' ? 'active' : ''}
          onClick={() => setScreen('checkin')}
        >
          Daily Check-In
        </button>
        <button
          className={screen === 'timeline' ? 'active' : ''}
          onClick={() => setScreen('timeline')}
        >
          Timeline
        </button>
        <button
          className={screen === 'patterns' ? 'active' : ''}
          onClick={() => setScreen('patterns')}
        >
          Patterns
        </button>
        <button
          className="reset-btn"
          onClick={() => {
            localStorage.removeItem('koru_onboarded');
            localStorage.removeItem('koru_condition');
            setOnboarded(false);
          }}
          title="Reset onboarding"
        >
          ↻
        </button>
      </nav>
      
      {screen === 'checkin' && <DailyCheckIn />}
      {screen === 'timeline' && <Timeline />}
      {screen === 'patterns' && <Patterns />}
    </div>
  )
}

export default App