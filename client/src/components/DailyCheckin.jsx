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

  // refs: camera + model
  const webcamRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);

  // previous nose position for movement
  const prevNoseRef = useRef(null);

  // Arreglos para guardar el historial de 15 segundos y sacar promedios
  const historyRef = useRef({
      ear: [],
      brow: [],
      jaw: [],
      mood: [],
      move: []
  });

  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (!entry.trim()) return
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      let parts = [entry.trim()]
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

  // EAR (Eye Aspect Ratio)
  const computeEAR = (lm) => {
    const L1 = lm[33], L2 = lm[160], L3 = lm[158], L4 = lm[133], L5 = lm[153], L6 = lm[144];
    const R1 = lm[362], R2 = lm[385], R3 = lm[387], R4 = lm[263], R5 = lm[373], R6 = lm[380];

    const leftEAR = (dist(L2, L6) + dist(L3, L5)) / (2 * dist(L1, L4));
    const rightEAR = (dist(R2, R6) + dist(R3, R5)) / (2 * dist(R1, R4));
    return (leftEAR + rightEAR) / 2;
  };

  // Brow metric
  const computeBrowMetric = (lm) => {
    const browL = lm[70];
    const browR = lm[300];
    const faceL = lm[234];
    const faceR = lm[454];
    return dist(browL, browR) / dist(faceL, faceR);
  };

  // Jaw tension metric
  const computeJawMetric = (lm) => {
    const jawL = lm[61];
    const jawR = lm[291];
    const faceL = lm[234];
    const faceR = lm[454];
    return dist(jawL, jawR) / dist(faceL, faceR);
  };

  // Mood metric
  const computeMoodMetric = (lm) => {
    const mouthL = lm[61];
    const mouthR = lm[291];
    const upperLip = lm[13];
    const lowerLip = lm[14];

    const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
    const cornersAvgY = (mouthL.y + mouthR.y) / 2;

    return cornersAvgY - mouthCenterY;
  };

  // Focus metric
  const computeMovement = (lm) => {
    const nose = lm[1];
    const prev = prevNoseRef.current;
    prevNoseRef.current = { x: nose.x, y: nose.y };

    if (!prev) return 0;
    return Math.abs(nose.x - prev.x) + Math.abs(nose.y - prev.y);
  };

  // ---------- mapping to 1..5 dots ----------
  const earToSleep = (earVal) => {
    if (earVal < 0.20) return 1;
    if (earVal < 0.22) return 2;
    if (earVal < 0.24) return 3;
    if (earVal < 0.27) return 4;
    return 5;
  };

  const browToStress = (browMetric) => {
    if (browMetric < 0.20) return 5;
    if (browMetric < 0.215) return 4;
    if (browMetric < 0.23) return 3;
    if (browMetric < 0.245) return 2;
    return 1;
  };

  const jawToTension = (jawMetric) => {
    if (jawMetric < 0.28) return 5;
    if (jawMetric < 0.30) return 4;
    if (jawMetric < 0.32) return 3;
    if (jawMetric < 0.34) return 2;
    return 1;
  };

  const moodToDots = (moodMetric) => {
    if (moodMetric < -0.012) return 5;
    if (moodMetric < -0.004) return 4;
    if (moodMetric < 0.004) return 3;
    if (moodMetric < 0.012) return 2;
    return 1;
  };

  const movementToFocus = (move) => {
    if (move < 0.0018) return 5;
    if (move < 0.0032) return 4;
    if (move < 0.0048) return 3;
    if (move < 0.0068) return 2;
    return 1;
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
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        landmarkerRef.current = landmarker;
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Error cargando MediaPipe:", err);
      }
    };
    initModel();
  }, []);

  // ---------- Bucle de Detección ----------
  const detect = () => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4 && landmarkerRef.current) {
      const video = webcamRef.current.video;
      const now = performance.now();
      const result = landmarkerRef.current.detectForVideo(video, now);
      const face = result?.faceLandmarks?.[0];

      if (face && face.length && isAnalyzing) {
        const ear = computeEAR(face);
        const brow = computeBrowMetric(face);
        const jaw = computeJawMetric(face);
        const moodM = computeMoodMetric(face);
        const move = computeMovement(face);

        historyRef.current.ear.push(ear);
        historyRef.current.brow.push(brow);
        historyRef.current.jaw.push(jaw);
        historyRef.current.mood.push(moodM);
        historyRef.current.move.push(move);
      }
    }
    
    if (cameraActive) {
      rafRef.current = requestAnimationFrame(detect);
    }
  };

  useEffect(() => {
    if (cameraActive && isModelLoaded) {
      rafRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
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
    setAnalysisStatus('Mira a la cámara y compórtate natural...');
    
    // Limpiar el historial
    historyRef.current = { ear: [], brow: [], jaw: [], mood: [], move: [] };
    prevNoseRef.current = null;
  };

  const finishAnalysis = () => {
    setIsAnalyzing(false);
    
    // Calcular promedios
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    const avgEar = avg(historyRef.current.ear);
    const avgBrow = avg(historyRef.current.brow);
    const avgJaw = avg(historyRef.current.jaw);
    const avgMood = avg(historyRef.current.mood);
    const avgMove = avg(historyRef.current.move);

    if (historyRef.current.ear.length > 0) {
        setSleep(earToSleep(avgEar));
        setStress(browToStress(avgBrow));
        setTension(jawToTension(avgJaw));
        setMood(moodToDots(avgMood));
        setFocus(movementToFocus(avgMove));
    }

    setAnalysisStatus('¡Análisis completado! Revisa y ajusta tus resultados.');
    
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
    setSleep(0);
    setStress(0);
    setTension(0);
    setMood(0);
    setFocus(0);
    setExercise(null);
  };

  return (
    <div className="checkin-wrapper">
        
      {/* 📹 WIDGET DE CÁMARA FLOTANTE */}
      {cameraActive && (
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          width: '200px', 
          borderRadius: '12px', 
          overflow: 'hidden', 
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', 
          zIndex: 999,
          border: isAnalyzing ? '3px solid #C4705A' : '3px solid #82b09a',
          backgroundColor: '#000',
          transition: 'all 0.3s ease'
        }}>
          <Webcam
            ref={webcamRef}
            audio={false}
            videoConstraints={{ facingMode: "user" }}
            style={{ width: '100%', height: 'auto', display: 'block', transform: 'scaleX(-1)' }}
          />
          
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            width: '100%', 
            background: 'rgba(0, 0, 0, 0.75)', 
            color: '#fff', 
            fontFamily: 'Outfit, sans-serif',
            fontSize: '13px', 
            fontWeight: '500',
            padding: '8px',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}>
            {isAnalyzing ? (
                <>Analizando... <strong style={{color: '#C4705A', fontSize: '15px'}}>{timeLeft}s</strong></>
            ) : (
                <span style={{color: '#82b09a'}}>Completado ✔</span>
            )}
          </div>
        </div>
      )}

      <div className="checkin-container">
        <div className="checkin-header">
          <h1 className="checkin-title">How are you today?</h1>
          <p className="checkin-date">{formatDate()}</p>
        </div>

        {/* --- BOTÓN DE MAGIA --- */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <button 
            type="button"
            className="log-button"
            style={{ 
                width: 'auto', 
                padding: '0.5rem 1.5rem', 
                backgroundColor: isModelLoaded ? '#C4705A' : '#ccc',
                opacity: isAnalyzing ? 0.7 : 1,
                cursor: (isModelLoaded && !isAnalyzing) ? 'pointer' : 'not-allowed'
            }}
            onClick={startAnalysis}
            disabled={!isModelLoaded || isAnalyzing}
          >
            {isModelLoaded ? '📸 Auto-detect with Face AI' : 'Loading Face AI...'}
          </button>
          
          {analysisStatus && (
            <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.75rem', fontWeight: 500 }}>
              {analysisStatus}
            </p>
          )}
        </div>

        <div className="textarea-wrapper">
          <textarea
            className="checkin-textarea"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Write freely... 'Woke up with a headache, slept 5h, had two coffees'"
            rows={5}
          />
          <span className="char-count">{entry.length > 0 ? `${entry.length} chars` : ""}</span>
        </div>

        <div className="quick-inputs">
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
          className={`log-button ${entry.length > 0 ? "ready" : ""}`}
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