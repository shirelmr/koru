import { useEffect, useRef, useState } from "react";
import "./DailyCheckin.css";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const DailyCheckIn = () => {
  const [entry, setEntry] = useState("");
  const [sleep, setSleep] = useState(0);
  const [stress, setStress] = useState(0);
  const [tension, setTension] = useState(0);
  const [mood, setMood] = useState(0);
  const [focus, setFocus] = useState(0);
  const [exercise, setExercise] = useState(null);

  // CV toggles / status
  const [autoDetect, setAutoDetect] = useState(false);
  const [camStatus, setCamStatus] = useState("off"); // off | loading | on | error

  // refs: camera + model
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);

  // smoothing refs (EMA)
  const earSmoothRef = useRef(null);
  const browSmoothRef = useRef(null);
  const jawSmoothRef = useRef(null);
  const moodSmoothRef = useRef(null);
  const moveSmoothRef = useRef(null);

  // previous nose position for movement
  const prevNoseRef = useRef(null);

  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = () => {
    console.log({
      entry,
      sleep,
      stress,
      tension,
      mood,
      focus,
      exercise,
      date: new Date().toISOString(),
    });
    // later: call your FastAPI here, then open InsightModal with extracted data
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

  const ema = (prev, next, alpha = 0.12) => {
    if (prev == null) return next;
    return prev * (1 - alpha) + next * alpha;
  };

  // EAR (Eye Aspect Ratio)
  const computeEAR = (lm) => {
    // Left eye indices
    const L1 = lm[33],
      L2 = lm[160],
      L3 = lm[158],
      L4 = lm[133],
      L5 = lm[153],
      L6 = lm[144];
    // Right eye indices
    const R1 = lm[362],
      R2 = lm[385],
      R3 = lm[387],
      R4 = lm[263],
      R5 = lm[373],
      R6 = lm[380];

    const leftEAR = (dist(L2, L6) + dist(L3, L5)) / (2 * dist(L1, L4));
    const rightEAR = (dist(R2, R6) + dist(R3, R5)) / (2 * dist(R1, R4));
    return (leftEAR + rightEAR) / 2;
  };

  // Brow metric: inner brow distance normalized by face width
  const computeBrowMetric = (lm) => {
    const browL = lm[70];
    const browR = lm[300];
    const faceL = lm[234];
    const faceR = lm[454];
    return dist(browL, browR) / dist(faceL, faceR);
  };

  // Jaw tension metric: jaw corner distance normalized by face width
  const computeJawMetric = (lm) => {
    const jawL = lm[61];
    const jawR = lm[291];
    const faceL = lm[234];
    const faceR = lm[454];
    return dist(jawL, jawR) / dist(faceL, faceR);
  };

  // Mood metric: compare mouth corners vs mouth center (simple proxy)
  // More negative => corners higher (smile-ish). More positive => corners lower (sad-ish).
  const computeMoodMetric = (lm) => {
    const mouthL = lm[61];
    const mouthR = lm[291];
    const upperLip = lm[13];
    const lowerLip = lm[14];

    const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
    const cornersAvgY = (mouthL.y + mouthR.y) / 2;

    return cornersAvgY - mouthCenterY;
  };

  // Focus metric: head movement using nose tip displacement between frames (smaller movement => more focus)
  const computeMovement = (lm) => {
    const nose = lm[1];
    const prev = prevNoseRef.current;
    prevNoseRef.current = { x: nose.x, y: nose.y };

    if (!prev) return 0;
    return Math.abs(nose.x - prev.x) + Math.abs(nose.y - prev.y);
  };

  // ---------- mapping to 1..5 dots ----------
  const earToSleep = (earVal) => {
    // lower EAR -> more squint/closed -> tired -> lower sleep quality
    if (earVal < 0.20) return 1;
    if (earVal < 0.22) return 2;
    if (earVal < 0.24) return 3;
    if (earVal < 0.27) return 4;
    return 5;
  };

  const browToStress = (browMetric) => {
    // smaller ratio -> brows closer -> more stress/concentration
    if (browMetric < 0.20) return 5;
    if (browMetric < 0.215) return 4;
    if (browMetric < 0.23) return 3;
    if (browMetric < 0.245) return 2;
    return 1;
  };

  const jawToTension = (jawMetric) => {
    // smaller jaw width ratio can indicate clenching/tension
    if (jawMetric < 0.28) return 5;
    if (jawMetric < 0.30) return 4;
    if (jawMetric < 0.32) return 3;
    if (jawMetric < 0.34) return 2;
    return 1;
  };

  const moodToDots = (moodMetric) => {
    // This is subtle; treat it like a "vibe" meter:
    // smaller/negative -> corners up (better mood) => higher dots
    // larger/positive -> corners down => lower dots
    if (moodMetric < -0.012) return 5;
    if (moodMetric < -0.004) return 4;
    if (moodMetric < 0.004) return 3;
    if (moodMetric < 0.012) return 2;
    return 1;
  };

  const movementToFocus = (move) => {
    // smaller movement => higher focus
    if (move < 0.0018) return 5;
    if (move < 0.0032) return 4;
    if (move < 0.0048) return 3;
    if (move < 0.0068) return 2;
    return 1;
  };

  // ---------- MediaPipe init + loop ----------
  useEffect(() => {
    if (!autoDetect) {
      setCamStatus("off");

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      landmarkerRef.current = null;

      earSmoothRef.current = null;
      browSmoothRef.current = null;
      jawSmoothRef.current = null;
      moodSmoothRef.current = null;
      moveSmoothRef.current = null;
      prevNoseRef.current = null;

      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        setCamStatus("loading");

        // 1) camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) return;

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // 2) model
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

        if (cancelled) return;

        landmarkerRef.current = landmarker;
        setCamStatus("on");

        // 3) loop
        const loop = () => {
          if (!videoRef.current || !landmarkerRef.current) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }

          const now = performance.now();
          const result = landmarkerRef.current.detectForVideo(videoRef.current, now);
          const face = result?.faceLandmarks?.[0];

          if (face && face.length) {
            const ear = computeEAR(face);
            const brow = computeBrowMetric(face);
            const jaw = computeJawMetric(face);
            const moodM = computeMoodMetric(face);
            const move = computeMovement(face);

            // smooth everything
            earSmoothRef.current = ema(earSmoothRef.current, ear, 0.10);
            browSmoothRef.current = ema(browSmoothRef.current, brow, 0.10);
            jawSmoothRef.current = ema(jawSmoothRef.current, jaw, 0.10);
            moodSmoothRef.current = ema(moodSmoothRef.current, moodM, 0.10);
            moveSmoothRef.current = ema(moveSmoothRef.current, move, 0.18); // a bit faster

            const sleepDots = earToSleep(earSmoothRef.current);
            const stressDots = browToStress(browSmoothRef.current);
            const tensionDots = jawToTension(jawSmoothRef.current);
            const moodDots = moodToDots(moodSmoothRef.current);
            const focusDots = movementToFocus(moveSmoothRef.current);

            setSleep((p) => (p === sleepDots ? p : sleepDots));
            setStress((p) => (p === stressDots ? p : stressDots));
            setTension((p) => (p === tensionDots ? p : tensionDots));
            setMood((p) => (p === moodDots ? p : moodDots));
            setFocus((p) => (p === focusDots ? p : focusDots));
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        console.error(e);
        setCamStatus("error");
        setAutoDetect(false);
      }
    };

    start();

    return () => {
      cancelled = true;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      landmarkerRef.current = null;
    };
  }, [autoDetect]);

  return (
    <div className="checkin-wrapper">
      <div className="checkin-container">
        <div className="checkin-header">
          <h1 className="checkin-title">How are you today?</h1>
          <p className="checkin-date">{formatDate()}</p>

          {/* Auto-detect toggle */}
          <div className="cv-toggle">
            <button
              className={`cv-btn ${autoDetect ? "on" : ""}`}
              type="button"
              onClick={() => setAutoDetect((v) => !v)}
            >
              {autoDetect ? "Auto-detect: On" : "Auto-detect: Off"}
              <span className={`cv-dot ${camStatus}`} />
            </button>
            <div className="cv-hint">Uses your camera locally (nothing is uploaded).</div>
          </div>
        </div>

        {/* hidden video for CV */}
        <video ref={videoRef} className="cv-video" playsInline muted />

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
          <MetricRow
            emoji="😴"
            label="Sleep quality"
            autoDetect={autoDetect}
            camStatus={camStatus}
            dots={renderDots(sleep, 5, setSleep)}
          />

          <div className="divider" />

          <MetricRow
            emoji="😤"
            label="Stress level"
            autoDetect={autoDetect}
            camStatus={camStatus}
            dots={renderDots(stress, 5, setStress)}
          />

          <div className="divider" />

          <MetricRow
            emoji="😬"
            label="Tension"
            autoDetect={autoDetect}
            camStatus={camStatus}
            dots={renderDots(tension, 5, setTension)}
          />

          <div className="divider" />

          <MetricRow
            emoji="🙂"
            label="Mood"
            autoDetect={autoDetect}
            camStatus={camStatus}
            dots={renderDots(mood, 5, setMood)}
          />

          <div className="divider" />

          <MetricRow
            emoji="🧠"
            label="Focus"
            autoDetect={autoDetect}
            camStatus={camStatus}
            dots={renderDots(focus, 5, setFocus)}
          />

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

        <button
          className={`log-button ${entry.length > 0 ? "ready" : ""}`}
          onClick={handleSubmit}
          type="button"
        >
          Log Entry
        </button>

        <p className="footer-text">Takes 30 seconds · No account needed</p>
      </div>
    </div>
  );
};

function MetricRow({ emoji, label, autoDetect, camStatus, dots }) {
  return (
    <div className="input-row">
      <div className="input-label">
        <span className="input-emoji">{emoji}</span>
        <span>{label}</span>
        {autoDetect && camStatus === "on" && <span className="auto-pill">auto</span>}
      </div>
      {dots}
    </div>
  );
}

export default DailyCheckIn;