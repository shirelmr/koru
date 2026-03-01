import { useEffect, useRef, useState } from "react";
import Webcam from 'react-webcam';
import "./DailyCheckin.css";
import InsightModal from '../components/InsightModal'
import { createDraft } from '../backend/api'

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const USER_ID = 'demo-user'

const DailyCheckIn = () => {
  // --- STATES DE CHECKIN ---
  const [entry, setEntry] = useState("");
  const [sleep, setSleep] = useState(0);
  const [stress, setStress] = useState(0);
  const [tension, setTension] = useState(0);
  const [mood, setMood] = useState(0);
  const [focus, setFocus] = useState(0);
  const [exercise, setExercise] = useState(null);

  const [showInsights, setShowInsights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draftEntryId, setDraftEntryId] = useState(null);
  const [extractedData, setExtractedData] = useState(null);

  // --- STATES DE CAMARA DE 15 SEGUNDOS ---
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");

  // --- STATES DE RECONOCIMIENTO DE VOZ ---
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef(""); 

  // refs: camera + model
  const webcamRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);

  // previous nose position for movement
  const prevNoseRef = useRef(null);

  // Arreglos para guardar el historial de 15 segundos y sacar promedios
  const historyRef = useRef({ ear: [], brow: [], jaw: [], mood: [], move: [] });

  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (!entry.trim() && sleep === 0) return // Permitir submit si hay datos de cámara aunque no haya texto
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      let parts = []
      if (entry.trim()) parts.push(entry.trim())
      if (sleep > 0) parts.push(`Sleep quality: ${sleep}/5`)
      if (stress > 0) parts.push(`Stress level: ${stress}/5`)
      if (tension > 0) parts.push(`Tension level: ${tension}/5`)
      if (mood > 0) parts.push(`Mood level: ${mood}/5`)
      if (focus > 0) parts.push(`Focus level: ${focus}/5`)
      if (exercise === true) parts.push('Did exercise today')
      if (exercise === false) parts.push('No exercise today')
      const fullText = parts.join('. ')

      const result = await createDraft({ userId: USER_ID, text: fullText, date: today })
      setDraftEntryId(result.entry_id)
      setExtractedData(result.extracted_data)
      setShowInsights(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  };

  const renderDots = (current, max, onChange) => (
    <div className="dots-container">
      {[...Array(max)].map((_, i) => (
        <button
          key={i}
          className={`dot ${i < current ? "filled" : ""}`}
          onClick={() => onChange(i + 1 === current ? 0 : i + 1)}
          type="button"
          aria-label={`${i + 1} of ${max}`}
        />
      ))}
    </div>
  );

  // ---------- math helpers ----------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const computeEAR = (lm) => {
    const L1 = lm[33], L2 = lm[160], L3 = lm[158], L4 = lm[133], L5 = lm[153], L6 = lm[144];
    const R1 = lm[362], R2 = lm[385], R3 = lm[387], R4 = lm[263], R5 = lm[373], R6 = lm[380];
    const leftEAR = (dist(L2, L6) + dist(L3, L5)) / (2 * dist(L1, L4));
    const rightEAR = (dist(R2, R6) + dist(R3, R5)) / (2 * dist(R1, R4));
    return (leftEAR + rightEAR) / 2;
  };
  const computeBrowMetric = (lm) => dist(lm[70], lm[300]) / dist(lm[234], lm[454]);
  const computeJawMetric = (lm) => dist(lm[61], lm[291]) / dist(lm[234], lm[454]);
  const computeMoodMetric = (lm) => {
    const mouthCenterY = (lm[13].y + lm[14].y) / 2;
    const cornersAvgY = (lm[61].y + lm[291].y) / 2;
    return cornersAvgY - mouthCenterY;
  };
  const computeMovement = (lm) => {
    const nose = lm[1];
    const prev = prevNoseRef.current;
    prevNoseRef.current = { x: nose.x, y: nose.y };
    if (!prev) return 0;
    return Math.abs(nose.x - prev.x) + Math.abs(nose.y - prev.y);
  };

  // ---------- mapping to 1..5 dots ----------
  const earToSleep = (earVal) => {
    if (earVal < 0.20) return 1; if (earVal < 0.22) return 2; if (earVal < 0.24) return 3; if (earVal < 0.27) return 4; return 5;
  };
  const browToStress = (browMetric) => {
    if (browMetric < 0.20) return 5; if (browMetric < 0.215) return 4; if (browMetric < 0.23) return 3; if (browMetric < 0.245) return 2; return 1;
  };
  const jawToTension = (jawMetric) => {
    if (jawMetric < 0.28) return 5; if (jawMetric < 0.30) return 4; if (jawMetric < 0.32) return 3; if (jawMetric < 0.34) return 2; return 1;
  };
  const moodToDots = (moodMetric) => {
    if (moodMetric < -0.012) return 5; if (moodMetric < -0.004) return 4; if (moodMetric < 0.004) return 3; if (moodMetric < 0.012) return 2; return 1;
  };
  const movementToFocus = (move) => {
    if (move < 0.0018) return 5; if (move < 0.0032) return 4; if (move < 0.0048) return 3; if (move < 0.0068) return 2; return 1;
  };

  // ---------- Inicializar Reconocimiento de Voz ----------
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; 
      recognition.lang = 'en-US'; 

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscriptChunk = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscriptChunk += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }
        if (finalTranscriptChunk) finalTranscriptRef.current += finalTranscriptChunk + ' ';
        setEntry(finalTranscriptRef.current + interimTranscript);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        finalTranscriptRef.current = entry.trim() ? entry.trim() + ' ' : '';
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      }
    }
  };

  // ---------- Inicializar MediaPipe ----------
  useEffect(() => {
    const initModel = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        landmarkerRef.current = landmarker;
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Error loading MediaPipe:", err);
      }
    };
    initModel();
  }, []);

  const detect = () => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4 && landmarkerRef.current) {
      const video = webcamRef.current.video;
      const now = performance.now();
      const result = landmarkerRef.current.detectForVideo(video, now);
      const face = result?.faceLandmarks?.[0];

      if (face && face.length && isAnalyzing) {
        historyRef.current.ear.push(computeEAR(face));
        historyRef.current.brow.push(computeBrowMetric(face));
        historyRef.current.jaw.push(computeJawMetric(face));
        historyRef.current.mood.push(computeMoodMetric(face));
        historyRef.current.move.push(computeMovement(face));
      }
    }
    if (cameraActive) rafRef.current = requestAnimationFrame(detect);
  };

  useEffect(() => {
    if (cameraActive && isModelLoaded) rafRef.current = requestAnimationFrame(detect);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cameraActive, isModelLoaded, isAnalyzing]);

  // ---------- Temporizador de 15 segundos ----------
  useEffect(() => {
    let timer;
    if (isAnalyzing && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (isAnalyzing && timeLeft === 0) {
      finishAnalysis();
    }
    return () => clearTimeout(timer);
  }, [isAnalyzing, timeLeft]);

  const startAnalysis = () => {
    if (!isModelLoaded) return;
    setCameraActive(true);
    setIsAnalyzing(true);
    setTimeLeft(15);
    setAnalysisStatus('Please look directly at the camera...');
    historyRef.current = { ear: [], brow: [], jaw: [], mood: [], move: [] };
    prevNoseRef.current = null;
  };

  const finishAnalysis = () => {
    setIsAnalyzing(false);
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    if (historyRef.current.ear.length > 0) {
        setSleep(earToSleep(avg(historyRef.current.ear)));
        setStress(browToStress(avg(historyRef.current.brow)));
        setTension(jawToTension(avg(historyRef.current.jaw)));
        setMood(moodToDots(avg(historyRef.current.mood)));
        setFocus(movementToFocus(avg(historyRef.current.move)));
    }

    setAnalysisStatus('Analysis complete! Check your results below.');
    setTimeout(() => {
        setCameraActive(false);
        setAnalysisStatus('');
    }, 4000);
  };

  const handleInsightClose = () => {
    setShowInsights(false);
    setDraftEntryId(null);
    setExtractedData(null);
    setEntry("");
    setSleep(0); setStress(0); setTension(0); setMood(0); setFocus(0); setExercise(null);
  };

  return (
    <div className="checkin-wrapper">
      
      {/* Brand */}
      <div className="brand">
        <span className="brand-name">Kōru</span>
        <span className="brand-tag">Check-in</span>
      </div>

      {/* 📹 WIDGET DE CÁMARA FLOTANTE */}
      {cameraActive && (
        <div style={{ 
          position: 'fixed', bottom: '20px', right: '20px', width: '200px', 
          borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', 
          zIndex: 999, border: isAnalyzing ? '3px solid #C4705A' : '3px solid #82b09a',
          backgroundColor: '#000', transition: 'all 0.3s ease'
        }}>
          <Webcam
            ref={webcamRef} audio={false} videoConstraints={{ facingMode: "user" }}
            style={{ width: '100%', height: 'auto', display: 'block', transform: 'scaleX(-1)' }}
          />
          <div style={{ 
            position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0, 0, 0, 0.75)', 
            color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', 
            fontWeight: '500', padding: '8px', textAlign: 'center', boxSizing: 'border-box'
          }}>
            {isAnalyzing ? (
                <>Analyzing... <strong style={{color: '#C4705A', fontSize: '15px'}}>{timeLeft}s</strong></>
            ) : (
                <span style={{color: '#82b09a'}}>Completed ✔</span>
            )}
          </div>
        </div>
      )}

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

        {/* --- PASO 1: MAGIA FACIAL --- */}
        <div style={{ 
          background: 'rgba(130, 176, 154, 0.08)', 
          border: '1px solid rgba(130, 176, 154, 0.3)', 
          borderRadius: '16px', 
          padding: '1.5rem', 
          marginBottom: '2rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
        }}>
          <h3 style={{fontFamily: "'DM Sans', sans-serif", fontWeight: 600, margin: '0 0 0.5rem 0', color: '#2C362A', fontSize: '1.1rem'}}>
             Step 1: Let AI scan your mood
          </h3>
          <p style={{fontSize: '0.9rem', color: '#666', marginBottom: '1.2rem', lineHeight: '1.4'}}>
            (Optional) Look at the camera for 15 seconds. We'll automatically detect your sleep, stress, and tension levels without you clicking anything.
          </p>
          
          <button 
            type="button"
            className="log-button"
            style={{ 
                width: 'auto', padding: '0.6rem 1.5rem', 
                backgroundColor: isModelLoaded ? '#C4705A' : '#ccc',
                opacity: isAnalyzing ? 0.7 : 1,
                cursor: (isModelLoaded && !isAnalyzing) ? 'pointer' : 'not-allowed',
                boxShadow: '0 4px 12px rgba(196, 112, 90, 0.2)'
            }}
            onClick={startAnalysis}
            disabled={!isModelLoaded || isAnalyzing}
          >
            {isModelLoaded ? '📸 Start Face Scan' : 'Loading Face AI...'}
          </button>
          
          {analysisStatus && (
            <p style={{ fontSize: '0.9rem', color: isAnalyzing ? '#C4705A' : '#82b09a', marginTop: '0.8rem', fontWeight: 500 }}>
              {analysisStatus}
            </p>
          )}
        </div>

        {/* --- PASO 2: TEXTO Y VOZ --- */}
        <div style={{ marginBottom: '0.5rem' }}>
          <h3 style={{fontFamily: "'DM Sans', sans-serif", fontWeight: 600, margin: '0 0 0.5rem 0', color: '#2C362A', fontSize: '1.1rem'}}>
            Step 2: Tell us more
          </h3>
          <p style={{fontSize: '0.9rem', color: '#666', marginBottom: '1rem'}}>
            Use the mic for a voice diary or type normally. Mention what you ate, physical symptoms, or why you feel stressed today.
          </p>
        </div>

        <div className="textarea-wrapper" style={{ position: 'relative' }}>
          <textarea
            className="checkin-textarea"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Write freely or tap the mic... 'Woke up with a headache, slept 5h, had two coffees'"
            rows={5}
            style={{ paddingRight: '50px' }} 
          />
          
          <button
            onClick={toggleRecording}
            type="button"
            style={{
              position: 'absolute', bottom: '15px', right: '15px',
              backgroundColor: isRecording ? '#C4705A' : '#f0f0f0',
              color: isRecording ? 'white' : 'inherit',
              border: 'none', borderRadius: '50%', width: '42px', height: '42px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.3s ease', fontSize: '18px',
              boxShadow: isRecording ? '0 0 15px rgba(196, 112, 90, 0.5)' : 'none',
            }}
            title={isRecording ? "Stop recording" : "Start Voice Diary"}
          >
            {isRecording ? '⏹️' : '🎤'}
          </button>

          <span className="char-count" style={{ position: 'absolute', bottom: '-22px', left: '0' }}>
            {entry.length > 0 ? `${entry.length} chars` : ""}
            {isRecording && <span style={{ color: '#C4705A', marginLeft: '10px', fontWeight: 500, animation: 'pulse 1.5s infinite' }}>Listening...</span>}
          </span>
        </div>

        {/* --- INPUTS MANUALES (Se llenan solos con la cámara) --- */}
        <div className="quick-inputs" style={{ marginTop: '2.5rem' }}>
          <MetricRow emoji="😴" label="Sleep quality" dots={renderDots(sleep, 5, setSleep)} />
          <div className="divider" />
          <MetricRow emoji="😤" label="Stress level" dots={renderDots(stress, 5, setStress)} />
          <div className="divider" />
          <MetricRow emoji="😬" label="Tension" dots={renderDots(tension, 5, setTension)} />
          <div className="divider" />
          <MetricRow emoji="🙂" label="Mood" dots={renderDots(mood, 5, setMood)} />
          <div className="divider" />
          <MetricRow emoji="🧠" label="Focus" dots={renderDots(focus, 5, setFocus)} />
          <div className="divider" />

          <div className="input-row">
            <div className="input-label">
              <span className="input-emoji">💪</span>
              <span>Exercise</span>
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-option ${exercise === true ? "active" : ""}`}
                onClick={() => setExercise(exercise === true ? null : true)}
                type="button"
              >
                Yes
              </button>
              <button
                className={`toggle-option ${exercise === false ? "active-no" : ""}`}
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
          className={`log-button ${(entry.length > 0 || sleep > 0) ? "ready" : ""}`}
          onClick={handleSubmit}
          type="button"
          disabled={loading || (!entry.trim() && sleep === 0)}
        >
          {loading ? 'Analyzing with Gemini...' : (entry.length > 0 || sleep > 0) ? 'Log Entry →' : 'Log Entry'}
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
  );
};

function MetricRow({ emoji, label, dots }) {
  return (
    <div className="input-row">
      <div className="input-label">
        <span className="input-emoji">{emoji}</span>
        <span>{label}</span>
      </div>
      {dots}
    </div>
  );
}

export default DailyCheckIn;