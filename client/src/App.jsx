import { useState } from 'react'
import DailyCheckIn from './components/DailyCheckin'
import Timeline from './components/Timeline'
import './App.css'

function App() {
  const [screen, setScreen] = useState('checkin')

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
      </nav>
      {screen === 'checkin' ? <DailyCheckIn /> : <Timeline />}
    </div>
  )
}

export default App
