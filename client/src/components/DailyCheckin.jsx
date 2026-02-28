import { useState } from 'react';
import './DailyCheckIn.css';

const DailyCheckIn = () => {
  const [entry, setEntry] = useState('');
  const [sleep, setSleep] = useState(0);
  const [stress, setStress] = useState(0);
  const [exercise, setExercise] = useState(false);

  const formatDate = () => {
    const today = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('en-US', options);
  };

  const handleSubmit = () => {
    console.log({
      entry,
      sleep,
      stress,
      exercise,
      date: new Date().toISOString()
    });
    // Here you would typically send data to your backend
    alert('Entry logged successfully!');
  };

  const renderDots = (current, max, onChange) => {
    return (
      <div className="dots-container">
        {[...Array(max)].map((_, index) => (
          <button
            key={index}
            className={`dot ${index < current ? 'filled' : ''}`}
            onClick={() => onChange(index + 1)}
            type="button"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="daily-checkin">
      <h1 className="checkin-title">How are you today?</h1>
      <p className="checkin-date">{formatDate()}</p>
      
      <textarea
        className="checkin-textarea"
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        placeholder="Write freely... 'Woke up with a headache, slept 5h, had two coffees'"
      />
      
      <div className="sliders-row">
        <div className="slider-item">
          <span className="slider-label">😴 Sleep</span>
          {renderDots(sleep, 5, setSleep)}
        </div>
        
        <div className="slider-item">
          <span className="slider-label">😤 Stress</span>
          {renderDots(stress, 5, setStress)}
        </div>
        
        <div className="slider-item">
          <span className="slider-label">💪 Exercise</span>
          <button
            className={`toggle ${exercise ? 'active' : ''}`}
            onClick={() => setExercise(!exercise)}
            type="button"
          >
            {exercise ? 'Yes' : 'No'}
          </button>
        </div>
      </div>
      
      <button className="log-button" onClick={handleSubmit}>
        Log Entry
      </button>
      
      <p className="footer-text">Takes 30 seconds · No account needed</p>
    </div>
  );
};

export default DailyCheckIn;