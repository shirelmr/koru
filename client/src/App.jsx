import { useState } from 'react'
import DailyCheckIn from './components/DailyCheckin'
import Timeline from './components/Timeline'
import Patterns from './components/Patterns' // <-- Importa el nuevo componente
import './App.css'

function App() {
  const [screen, setScreen] = useState('patterns') // Empieza en patterns para probarlo

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
        {/* Botón para la nueva pantalla */}
        <button
          className={screen === 'patterns' ? 'active' : ''}
          onClick={() => setScreen('patterns')}
        >
          Patterns
        </button>
      </nav>
      
      {/* Lógica de renderizado */}
      {screen === 'checkin' && <DailyCheckIn />}
      {screen === 'timeline' && <Timeline />}
      {screen === 'patterns' && <Patterns />}
    </div>
  )
}

export default App