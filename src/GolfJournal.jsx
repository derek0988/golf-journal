import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ArrowLeft,
  CalendarDays,
  Flag,
  ClipboardList,
} from "lucide-react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap');`;

const COLORS = {
  fairway: "#16342B",
  fairwayDeep: "#0F241D",
  turf: "#3A7256",
  turfLight: "#6FA287",
  turfBright: "#4FA06B",
  rough: "#2A4A3A",
  trouble: "#5C2A20",
  scorecard: "#E9E3CC",
  scorecardDark: "#DCD4B8",
  sand: "#C7A869",
  flag: "#A6321D",
  ink: "#1E2620",
};

const CLUBS = ["Driver", "3W", "5W", "Hybrid", "3i", "4i", "5i", "6i", "7i", "8i", "9i", "PW"];

const ZONES = [
  { key: "trouble-left", label: "Left trouble", color: COLORS.trouble },
  { key: "rough-left", label: "Left rough", color: COLORS.rough },
  { key: "fairway", label: "Fairway", color: COLORS.turfBright },
  { key: "rough-right", label: "Right rough", color: COLORS.rough },
  { key: "trouble-right", label: "Right trouble", color: COLORS.trouble },
];

const emptyHole = (n, par = 4) => ({
  hole: n,
  par,
  teeClub: "",
  teeShot: null,
  strokes: par,
  putts: 2,
  penalties: 0,
  note: "",
});

const newRoundTemplate = () => ({
  id: `round_${Date.now()}`,
  date: new Date().toISOString().slice(0, 10),
  course: "",
  notes: "",
  holes: Array.from({ length: 18 }, (_, i) => emptyHole(i + 1)),
});

function totalsFor(holes) {
  const strokes = holes.reduce((s, h) => s + (h.strokes || 0), 0);
  const par = holes.reduce((s, h) => s + (h.par || 0), 0);
  const putts = holes.reduce((s, h) => s + (h.putts || 0), 0);
  const penalties = holes.reduce((s, h) => s + (h.penalties || 0), 0);
  return { strokes, par, putts, penalties, toPar: strokes - par };
}

function Stepper({ value, onChange, min = 0, label }) {
  return (
    <div className="stepper" aria-label={label}>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`decrease ${label}`}>
        <ChevronDown size={16} strokeWidth={3} />
      </button>
      <span className="stepper-val">{value}</span>
      <button type="button" className="stepper-btn" onClick={() => onChange(value + 1)} aria-label={`increase ${label}`}>
        <ChevronUp size={16} strokeWidth={3} />
      </button>
    </div>
  );
}

// Trapezoidal fairway diagram, 5 tap zones from tee (bottom) to green (top).
function TeeShotSelector({ value, onChange }) {
  const yBottom = 388;
  const yTop = 70;
  const centerX = 150;
  const bottomHalf = 140;
  const topHalf = 66;

  const zoneGeom = ZONES.map((z, i) => {
    const bl = centerX - bottomHalf + (i * (2 * bottomHalf)) / 5;
    const br = bl + (2 * bottomHalf) / 5;
    const tl = centerX - topHalf + (i * (2 * topHalf)) / 5;
    const tr = tl + (2 * topHalf) / 5;
    const points = `${bl},${yBottom} ${br},${yBottom} ${tr},${yTop} ${tl},${yTop}`;
    const cx = (bl + br + tl + tr) / 4;
    const cy = (yBottom + yTop) / 2;
    return { ...z, points, cx, cy };
  });

  const selected = zoneGeom.find((z) => z.key === value);

  return (
    <div className="tee-shot-wrap">
      <svg viewBox="0 0 300 420" className="tee-shot-svg" role="group" aria-label="Tee shot landing zone">
        {zoneGeom.map((z) => (
          <polygon
            key={z.key}
            points={z.points}
            fill={z.color}
            opacity={value && value !== z.key ? 0.35 : 1}
            stroke={value === z.key ? COLORS.sand : "transparent"}
            strokeWidth={4}
            style={{ cursor: "pointer" }}
            onClick={() => onChange(value === z.key ? null : z.key)}
          />
        ))}
        {/* green */}
        <circle cx={centerX} cy={yTop - 8} r={26} fill={COLORS.turfLight} opacity={0.9} />
        <line x1={centerX} y1={yTop - 34} x2={centerX} y2={yTop - 8} stroke={COLORS.scorecard} strokeWidth={2} />
        <path d={`M ${centerX} ${yTop - 34} L ${centerX} ${yTop - 20} L ${centerX + 14} ${yTop - 27} Z`} fill={COLORS.flag} />
        {/* tee markers */}
        <circle cx={centerX - 10} cy={yBottom + 8} r={3} fill={COLORS.scorecard} />
        <circle cx={centerX + 10} cy={yBottom + 8} r={3} fill={COLORS.scorecard} />
        {selected && <circle cx={selected.cx} cy={selected.cy} r={9} fill={COLORS.scorecard} stroke={COLORS.ink} strokeWidth={2} />}
      </svg>
      <div className="zone-label">{selected ? selected.label : "Tap where the tee shot landed"}</div>
    </div>
  );
}

function HoleScreen({ round, holeIndex, onHoleChange, onNav, onGoReview }) {
  const h = round.holes[holeIndex];
  const patch = (p) => onHoleChange(h.hole, p);

  return (
    <div className="hole-screen">
      <div className="hole-topbar">
        <span className="hole-course-tag">{round.course || "Untitled round"}</span>
        <button className="review-link" onClick={onGoReview}>
          <ClipboardList size={14} /> Scorecard
        </button>
      </div>

      <div className="hole-title-row">
        <div className="hole-title">
          <span className="hole-title-num">Hole {h.hole}</span>
          <span className="hole-title-of">of 18</span>
        </div>
        <div className="par-control">
          <span className="par-label">Par</span>
          <Stepper label="par" value={h.par} min={3} onChange={(v) => patch({ par: v })} />
        </div>
      </div>

      <div className="section">
        <div className="section-label">Tee shot club</div>
        <div className="club-grid">
          {CLUBS.map((c) => (
            <button
              key={c}
              className={`club-btn ${h.teeClub === c ? "club-btn-active" : ""}`}
              onClick={() => patch({ teeClub: h.teeClub === c ? "" : c })}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-label">Tee shot result</div>
        <TeeShotSelector value={h.teeShot} onChange={(v) => patch({ teeShot: v })} />
      </div>

      <div className="section">
        <div className="section-label">Hole result</div>
        <div className="stat-row">
          <div className="stat-item">
            <span className="stat-name">Strokes</span>
            <Stepper label="strokes" value={h.strokes} min={1} onChange={(v) => patch({ strokes: v })} />
          </div>
          <div className="stat-item">
            <span className="stat-name">Putts</span>
            <Stepper label="putts" value={h.putts} min={0} onChange={(v) => patch({ putts: v })} />
          </div>
          <div className="stat-item">
            <span className="stat-name">Penalties</span>
            <Stepper label="penalties" value={h.penalties} min={0} onChange={(v) => patch({ penalties: v })} />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Notes</div>
        <textarea
          className="hole-note-full"
          placeholder="Club feel, wind, lie, decisions made..."
          value={h.note}
          onChange={(e) => patch({ note: e.target.value })}
        />
      </div>

      <div className="hole-nav">
        <button className="nav-btn" disabled={holeIndex === 0} onClick={() => onNav(holeIndex - 1)}>
          <ChevronLeft size={16} /> Hole {h.hole - 1 || ""}
        </button>
        <button className="nav-btn nav-btn-primary" onClick={() => (holeIndex === 17 ? onGoReview() : onNav(holeIndex + 1))}>
          {holeIndex === 17 ? "Review scorecard" : `Hole ${h.hole + 1}`} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ReviewScreen({ round, onEditHole, onNotesChange, onSave, onBackToHole }) {
  const t = totalsFor(round.holes);
  const front = round.holes.slice(0, 9);
  const back = round.holes.slice(9, 18);

  const renderNine = (holes, label) => {
    const nt = totalsFor(holes);
    return (
      <div className="review-nine">
        <div className="review-nine-title">{label}</div>
        <div className="review-grid-head">
          <span>Hole</span>
          <span>Par</span>
          <span>Club</span>
          <span>Score</span>
          <span>Putts</span>
          <span>Tee</span>
        </div>
        {holes.map((h) => {
          const zone = ZONES.find((z) => z.key === h.teeShot);
          const rel = h.strokes - h.par;
          return (
            <div key={h.hole} className="review-row" onClick={() => onEditHole(h.hole - 1)}>
              <span className="review-hole-num">{h.hole}</span>
              <span className="review-cell">{h.par}</span>
              <span className="review-cell review-club">{h.teeClub || "—"}</span>
              <span className="review-cell review-score" style={{ color: rel > 0 ? COLORS.flag : rel < 0 ? COLORS.turfBright : COLORS.ink }}>
                {h.strokes}
              </span>
              <span className="review-cell">{h.putts}</span>
              <span className="review-cell">
                <span className="tee-dot" style={{ background: zone ? zone.color : "transparent", border: zone ? "none" : `1px dashed ${COLORS.ink}55` }} />
              </span>
            </div>
          );
        })}
        <div className="review-totals-row">
          <span className="review-totals-label">{label === "Front Nine" ? "OUT" : "IN"}</span>
          <span></span>
          <span></span>
          <span className="review-cell review-score">{nt.strokes}</span>
          <span className="review-cell">{nt.putts}</span>
          <span></span>
        </div>
      </div>
    );
  };

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="back-btn" onClick={onBackToHole}>
          <ArrowLeft size={16} /> Back to hole
        </button>
      </div>

      <div className="scorecard-header">
        <span className="review-course-name">{round.course || "Untitled round"}</span>
        <span className="review-date">{round.date}</span>
      </div>

      {renderNine(front, "Front Nine")}
      {renderNine(back, "Back Nine")}

      <div className="grand-total">
        <div className="gt-block">
          <span className="gt-label">TOTAL</span>
          <span className="gt-val">{t.strokes}</span>
        </div>
        <div className="gt-block">
          <span className="gt-label">TO PAR</span>
          <span className="gt-val" style={{ color: t.toPar > 0 ? COLORS.flag : t.toPar < 0 ? COLORS.turfBright : COLORS.scorecard }}>
            {t.toPar > 0 ? `+${t.toPar}` : t.toPar === 0 ? "E" : t.toPar}
          </span>
        </div>
        <div className="gt-block">
          <span className="gt-label">PUTTS</span>
          <span className="gt-val">{t.putts}</span>
        </div>
      </div>

      <div className="round-notes-wrap">
        <label className="round-notes-label">Round notes</label>
        <textarea
          className="round-notes"
          placeholder="How did the round feel? Conditions, mental game, takeaways..."
          value={round.notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>

      <button className="save-btn" onClick={onSave}>
        Save round
      </button>
    </div>
  );
}

function RoundSetup({ round, onChange, onBegin, onCancel }) {
  return (
    <div className="editor">
      <div className="editor-top">
        <button className="back-btn" onClick={onCancel}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="setup-card">
        <div className="setup-title">New round</div>
        <label className="setup-label">Course</label>
        <input className="course-input" placeholder="Course name" value={round.course} onChange={(e) => onChange({ ...round, course: e.target.value })} />
        <label className="setup-label">Date</label>
        <input className="date-input" type="date" value={round.date} onChange={(e) => onChange({ ...round, date: e.target.value })} />
        <button className="save-btn" style={{ marginTop: 20 }} onClick={onBegin}>
          Begin round — Hole 1
        </button>
      </div>
    </div>
  );
}

function RoundStub({ round, onOpen, onDelete }) {
  const t = totalsFor(round.holes);
  return (
    <div className="stub" onClick={() => onOpen(round.id)}>
      <div className="stub-perf" />
      <div className="stub-main">
        <div className="stub-top">
          <span className="stub-course">{round.course || "Untitled round"}</span>
          <button className="stub-delete" onClick={(e) => { e.stopPropagation(); onDelete(round.id); }} aria-label="delete round">
            <Trash2 size={14} />
          </button>
        </div>
        <div className="stub-meta">
          <span><CalendarDays size={12} /> {round.date}</span>
        </div>
        <div className="stub-stats">
          <div className="stub-stat">
            <span className="stub-stat-val">{t.strokes}</span>
            <span className="stub-stat-label">strokes</span>
          </div>
          <div className="stub-stat">
            <span className="stub-stat-val" style={{ color: t.toPar > 0 ? COLORS.flag : t.toPar < 0 ? COLORS.turf : COLORS.ink }}>
              {t.toPar > 0 ? `+${t.toPar}` : t.toPar === 0 ? "E" : t.toPar}
            </span>
            <span className="stub-stat-label">to par</span>
          </div>
          <div className="stub-stat">
            <span className="stub-stat-val">{t.putts}</span>
            <span className="stub-stat-label">putts</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GolfJournal() {
  const [rounds, setRounds] = useState(null);
  const [view, setView] = useState("list"); // list | setup | hole | review
  const [editing, setEditing] = useState(null);
  const [holeIndex, setHoleIndex] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("rounds-index", false);
        const list = res ? JSON.parse(res.value) : [];
        setRounds(list);
      } catch (e) {
        setRounds([]);
      }
    })();
  }, []);

  const persistIndex = async (list) => {
    try {
      await window.storage.set("rounds-index", JSON.stringify(list), false);
    } catch (e) {
      setError("Couldn't save — try again.");
    }
  };

  const startNew = () => {
    setEditing(newRoundTemplate());
    setView("setup");
  };

  const openRound = async (id) => {
    try {
      const res = await window.storage.get(`round:${id}`, false);
      if (res) {
        setEditing(JSON.parse(res.value));
        setHoleIndex(0);
        setView("review");
      }
    } catch (e) {
      setError("Couldn't load that round.");
    }
  };

  const updateHole = useCallback((holeNum, patch) => {
    setEditing((prev) => ({
      ...prev,
      holes: prev.holes.map((h) => (h.hole === holeNum ? { ...h, ...patch } : h)),
    }));
  }, []);

  const saveRound = async () => {
    try {
      await window.storage.set(`round:${editing.id}`, JSON.stringify(editing), false);
      const summary = { id: editing.id, date: editing.date, course: editing.course, holes: editing.holes };
      const rest = (rounds || []).filter((r) => r.id !== editing.id);
      const updated = [summary, ...rest].sort((a, b) => (a.date < b.date ? 1 : -1));
      setRounds(updated);
      await persistIndex(updated);
      setView("list");
      setEditing(null);
    } catch (e) {
      setError("Couldn't save this round — try again.");
    }
  };

  const deleteRound = async (id) => {
    try {
      await window.storage.delete(`round:${id}`, false);
    } catch (e) {
      // ignore missing key
    }
    const updated = (rounds || []).filter((r) => r.id !== id);
    setRounds(updated);
    await persistIndex(updated);
  };

  return (
    <div className="app">
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        .app {
          min-height: 100vh;
          background: ${COLORS.fairway};
          background-image: radial-gradient(circle at 20% 10%, ${COLORS.turf}22, transparent 40%),
                             radial-gradient(circle at 90% 80%, ${COLORS.turf}18, transparent 45%);
          font-family: 'Inter', sans-serif;
          color: ${COLORS.scorecard};
          padding: 24px 16px 60px;
        }
        .header-row { display: flex; align-items: center; justify-content: space-between; max-width: 640px; margin: 0 auto 20px; }
        .header-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: 28px; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
        .header-title svg { color: ${COLORS.sand}; }
        .new-btn { background: ${COLORS.turf}; color: ${COLORS.scorecard}; border: none; border-radius: 999px; padding: 10px 18px; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 0.15s ease, transform 0.1s ease; }
        .new-btn:hover { background: ${COLORS.turfLight}; }
        .new-btn:active { transform: scale(0.97); }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${COLORS.sand}; outline-offset: 2px; }

        .list-wrap { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .empty-state { text-align: center; padding: 60px 20px; color: ${COLORS.turfLight}; font-family: 'Fraunces', serif; font-size: 18px; }

        .stub { background: ${COLORS.scorecard}; border-radius: 4px; position: relative; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.25); transition: transform 0.12s ease, box-shadow 0.12s ease; overflow: hidden; }
        .stub:nth-child(odd) { transform: rotate(-0.4deg); }
        .stub:nth-child(even) { transform: rotate(0.4deg); }
        .stub:hover { transform: rotate(0deg) translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
        .stub-perf { height: 6px; background-image: repeating-linear-gradient(90deg, ${COLORS.fairway} 0 6px, transparent 6px 12px); opacity: 0.5; }
        .stub-main { padding: 14px 18px 16px; color: ${COLORS.ink}; }
        .stub-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .stub-course { font-family: 'Fraunces', serif; font-weight: 600; font-size: 19px; }
        .stub-delete { background: none; border: none; color: ${COLORS.ink}66; cursor: pointer; padding: 4px; border-radius: 4px; }
        .stub-delete:hover { color: ${COLORS.flag}; background: ${COLORS.flag}15; }
        .stub-meta { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: ${COLORS.ink}99; display: flex; gap: 4px; align-items: center; margin-top: 2px; }
        .stub-stats { display: flex; gap: 22px; margin-top: 10px; }
        .stub-stat { display: flex; flex-direction: column; }
        .stub-stat-val { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 20px; }
        .stub-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: ${COLORS.ink}77; }

        .editor { max-width: 480px; margin: 0 auto; }
        .editor-top { margin-bottom: 14px; }
        .back-btn, .review-link { background: none; border: none; color: ${COLORS.scorecard}; display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; padding: 4px; }
        .back-btn:hover, .review-link:hover { color: ${COLORS.sand}; }

        .setup-card { background: ${COLORS.scorecard}; border-radius: 8px; padding: 20px; color: ${COLORS.ink}; }
        .setup-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; margin-bottom: 14px; }
        .setup-label { display: block; font-size: 12px; color: ${COLORS.ink}99; margin: 10px 0 4px; }

        .course-input, .date-input { background: ${COLORS.scorecardDark}; border: none; border-radius: 4px; padding: 10px 12px; font-family: 'Fraunces', serif; font-weight: 600; color: ${COLORS.ink}; width: 100%; }
        .date-input { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 500; }

        .hole-screen { max-width: 480px; margin: 0 auto; }
        .hole-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .hole-course-tag { font-size: 12px; color: ${COLORS.turfLight}; text-transform: uppercase; letter-spacing: 0.05em; }
        .hole-title-row { display: flex; justify-content: space-between; align-items: center; background: ${COLORS.scorecard}; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
        .hole-title { display: flex; align-items: baseline; gap: 6px; }
        .hole-title-num { font-family: 'Fraunces', serif; font-weight: 700; font-size: 26px; color: ${COLORS.ink}; }
        .hole-title-of { font-size: 12px; color: ${COLORS.ink}77; }
        .par-control { display: flex; align-items: center; gap: 8px; }
        .par-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${COLORS.ink}88; }

        .section { background: ${COLORS.scorecard}; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; color: ${COLORS.ink}; }
        .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: ${COLORS.ink}88; margin-bottom: 10px; font-weight: 600; }

        .club-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .club-btn { background: ${COLORS.scorecardDark}; border: 2px solid transparent; border-radius: 6px; padding: 10px 4px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13px; color: ${COLORS.ink}; cursor: pointer; }
        .club-btn:hover { border-color: ${COLORS.turf}55; }
        .club-btn-active { background: ${COLORS.turf}; color: ${COLORS.scorecard}; border-color: ${COLORS.turf}; }

        .tee-shot-wrap { display: flex; flex-direction: column; align-items: center; }
        .tee-shot-svg { width: 100%; max-width: 280px; height: auto; touch-action: manipulation; }
        .zone-label { margin-top: 8px; font-size: 13px; font-weight: 600; color: ${COLORS.ink}; text-align: center; min-height: 18px; }

        .stat-row { display: flex; justify-content: space-between; gap: 10px; }
        .stat-item { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
        .stat-name { font-size: 11px; color: ${COLORS.ink}88; text-transform: uppercase; letter-spacing: 0.04em; }

        .stepper { display: flex; align-items: center; justify-content: center; gap: 4px; background: ${COLORS.scorecardDark}; border-radius: 6px; padding: 3px 4px; }
        .stepper-btn { background: ${COLORS.fairway}; color: ${COLORS.scorecard}; border: none; border-radius: 4px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
        .stepper-btn:hover { background: ${COLORS.turf}; }
        .stepper-val { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 16px; color: ${COLORS.ink}; min-width: 20px; text-align: center; }

        .hole-note-full { width: 100%; background: ${COLORS.scorecardDark}; border: none; border-radius: 6px; padding: 10px 12px; font-family: 'Inter', sans-serif; font-size: 14px; color: ${COLORS.ink}; min-height: 60px; resize: vertical; }

        .hole-nav { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 30px; }
        .nav-btn { flex: 1; background: ${COLORS.scorecardDark}; color: ${COLORS.ink}; border: none; border-radius: 6px; padding: 12px; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; }
        .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .nav-btn-primary { background: ${COLORS.turf}; color: ${COLORS.scorecard}; }
        .nav-btn-primary:hover { background: ${COLORS.turfLight}; }

        .scorecard-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
        .review-course-name { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; }
        .review-date { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: ${COLORS.turfLight}; }

        .review-nine { background: ${COLORS.scorecard}; border-radius: 4px; padding: 12px 12px 4px; margin-bottom: 14px; color: ${COLORS.ink}; }
        .review-nine-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid ${COLORS.ink}22; padding-bottom: 6px; margin-bottom: 4px; }
        .review-grid-head, .review-row, .review-totals-row { display: grid; grid-template-columns: 30px 40px 1fr 50px 50px 34px; align-items: center; gap: 4px; }
        .review-grid-head span { font-size: 9px; text-transform: uppercase; color: ${COLORS.ink}88; text-align: center; }
        .review-row { padding: 6px 0; border-bottom: 1px dashed ${COLORS.ink}18; cursor: pointer; }
        .review-row:hover { background: ${COLORS.scorecardDark}55; }
        .review-hole-num { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13px; }
        .review-cell { font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-align: center; }
        .review-club { font-size: 11px; }
        .review-score { font-weight: 700; font-size: 13px; }
        .tee-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
        .review-totals-row { padding: 6px 0; border-top: 2px solid ${COLORS.ink}30; }
        .review-totals-label { font-family: 'Fraunces', serif; font-weight: 700; font-size: 11px; }

        .grand-total { display: flex; background: ${COLORS.fairwayDeep}; border: 1px solid ${COLORS.sand}55; border-radius: 4px; margin-bottom: 16px; overflow: hidden; }
        .gt-block { flex: 1; padding: 12px; text-align: center; border-right: 1px solid ${COLORS.sand}33; }
        .gt-block:last-child { border-right: none; }
        .gt-label { display: block; font-size: 10px; letter-spacing: 0.08em; color: ${COLORS.sand}; margin-bottom: 4px; }
        .gt-val { display: block; font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 22px; color: ${COLORS.scorecard}; }

        .round-notes-wrap { margin-bottom: 18px; }
        .round-notes-label { display: block; font-size: 12px; color: ${COLORS.turfLight}; margin-bottom: 6px; font-weight: 500; }
        .round-notes { width: 100%; background: ${COLORS.scorecard}; border: none; border-radius: 4px; padding: 10px 12px; font-family: 'Inter', sans-serif; font-size: 14px; color: ${COLORS.ink}; min-height: 70px; resize: vertical; }

        .save-btn { width: 100%; background: ${COLORS.turf}; color: ${COLORS.scorecard}; border: none; border-radius: 6px; padding: 14px; font-weight: 600; font-size: 15px; cursor: pointer; margin-bottom: 30px; }
        .save-btn:hover { background: ${COLORS.turfLight}; }

        .error-banner { max-width: 480px; margin: 0 auto 14px; background: ${COLORS.flag}22; border: 1px solid ${COLORS.flag}; color: ${COLORS.scorecard}; padding: 8px 12px; border-radius: 4px; font-size: 13px; }

        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      {error && <div className="error-banner">{error}</div>}

      {view === "list" && (
        <>
          <div className="header-row">
            <div className="header-title"><Flag size={26} strokeWidth={2.2} /> Golf Journal</div>
            <button className="new-btn" onClick={startNew}><Plus size={16} /> New round</button>
          </div>
          <div className="list-wrap">
            {rounds === null && <div className="empty-state">Loading your rounds...</div>}
            {rounds && rounds.length === 0 && <div className="empty-state">No rounds logged yet.<br />Tee off with "New round" above.</div>}
            {rounds && rounds.map((r) => <RoundStub key={r.id} round={r} onOpen={openRound} onDelete={deleteRound} />)}
          </div>
        </>
      )}

      {view === "setup" && editing && (
        <RoundSetup round={editing} onChange={setEditing} onBegin={() => { setHoleIndex(0); setView("hole"); }} onCancel={() => setView("list")} />
      )}

      {view === "hole" && editing && (
        <HoleScreen
          round={editing}
          holeIndex={holeIndex}
          onHoleChange={updateHole}
          onNav={setHoleIndex}
          onGoReview={() => setView("review")}
        />
      )}

      {view === "review" && editing && (
        <ReviewScreen
          round={editing}
          onEditHole={(idx) => { setHoleIndex(idx); setView("hole"); }}
          onNotesChange={(notes) => setEditing({ ...editing, notes })}
          onSave={saveRound}
          onBackToHole={() => setView("hole")}
        />
      )}
    </div>
  );
}
