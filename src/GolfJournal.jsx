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
  MapPin,
  X,
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

const CLUB_OPTIONS = [
  "Driver", "2W", "3W", "4W", "5W", "7W",
  "2H", "3H", "4H", "5H",
  "1i", "2i", "3i", "4i", "5i", "6i", "7i", "8i", "9i",
  "PW", "GW", "AW", "SW", "LW",
  "Putter",
];
const DEFAULT_BAG = ["Driver", "3W", "5W", "4H", "5i", "6i", "7i", "8i", "9i", "PW", "GW", "SW", "Putter"];
const MAX_BAG_SIZE = 14;

const FAIRWAY_ZONES = [
  { key: "trouble-left", label: "Left trouble", color: COLORS.trouble },
  { key: "rough-left", label: "Left rough", color: COLORS.rough },
  { key: "fairway", label: "Fairway", color: COLORS.turfBright },
  { key: "rough-right", label: "Right rough", color: COLORS.rough },
  { key: "trouble-right", label: "Right trouble", color: COLORS.trouble },
];

const FAIRWAY_BUNKER_ZONES = [
  { key: "bunker-fairway-left", label: "Fairway bunker (left)", color: COLORS.sand },
  { key: "bunker-fairway-center", label: "Fairway bunker (center)", color: COLORS.sand },
  { key: "bunker-fairway-right", label: "Fairway bunker (right)", color: COLORS.sand },
];

const GREEN_ZONE = { key: "green", label: "On the green", color: COLORS.turfLight };

// Ordered back/right/front/left — "front" is the side facing the tee,
// "back" is farthest from the tee. Used for both the bunker ring (touching
// the green) and the miss ring (further out) around the green.
const RING_DIRS = ["back", "right", "front", "left"];

const BUNKER_RING_ZONES = RING_DIRS.map((d) => ({
  key: `bunker-${d}`,
  label: `Greenside bunker (${d})`,
  color: COLORS.sand,
}));

const MISS_RING_META = {
  front: ["miss-short", "Missed green — short"],
  back: ["miss-long", "Missed green — long"],
  left: ["miss-left", "Missed green — left"],
  right: ["miss-right", "Missed green — right"],
};
const MISS_RING_ZONES = RING_DIRS.map((d) => {
  const [key, label] = MISS_RING_META[d];
  return { key, label, color: COLORS.rough };
});

const ALL_ZONES = [...FAIRWAY_ZONES, ...FAIRWAY_BUNKER_ZONES, GREEN_ZONE, ...BUNKER_RING_ZONES, ...MISS_RING_ZONES];
const zoneLookup = (key) => ALL_ZONES.find((z) => z.key === key);

const emptyShot = () => ({
  id: `shot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  club: "",
  zone: null,
  putts: 0,
  isPenalty: false,
});

const emptyHole = (n, par = 4) => ({
  hole: n,
  par,
  shots: [emptyShot()],
  strokes: par,
  putts: 2,
  penalties: 0,
  note: "",
});

// Strokes = every logged shot that isn't a putting entry or a penalty
// (each counts 1) + total putts (from any Putter entries) + one stroke per
// penalty entry.
function computeHoleTotals(shots) {
  let normal = 0;
  let putts = 0;
  let penalties = 0;
  for (const s of shots) {
    if (s.isPenalty) penalties += 1;
    else if (s.club === "Putter") putts += s.putts || 0;
    else normal += 1;
  }
  return { strokes: normal + putts + penalties, putts, penalties };
}

// Older saved rounds stored a single teeClub/teeShot per hole instead of a
// shots array. Convert those on load so old data still displays correctly.
function migrateHole(h) {
  if (h.shots && h.shots.length > 0) {
    return { ...h, shots: h.shots.map((s) => ({ putts: 0, isPenalty: false, ...s })) };
  }
  const shots = h.teeClub || h.teeShot ? [{ id: `shot_${h.hole}_migrated`, club: h.teeClub || "", zone: h.teeShot || null, putts: 0, isPenalty: false }] : [emptyShot()];
  return { ...h, shots };
}
function migrateRound(round) {
  return { ...round, holes: round.holes.map(migrateHole) };
}

const newRoundTemplate = () => ({
  id: `round_${Date.now()}`,
  date: new Date().toISOString().slice(0, 10),
  course: "",
  notes: "",
  holes: Array.from({ length: 18 }, (_, i) => emptyHole(i + 1)),
});

const emptyTeeHole = (n, par = 4) => ({ hole: n, par, yards: 0 });

const emptyTee = (name = "White") => ({
  id: `tee_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name,
  rating: 72.0,
  slope: 113,
  holes: Array.from({ length: 18 }, (_, i) => emptyTeeHole(i + 1)),
});

const newCourseTemplate = () => ({
  id: `course_${Date.now()}`,
  name: "",
  tees: [emptyTee("White")],
  handicaps: Array.from({ length: 18 }, (_, i) => i + 1),
});

function courseParTotal(tee) {
  return tee.holes.reduce((s, h) => s + (h.par || 0), 0);
}
function courseYardsTotal(tee) {
  return tee.holes.reduce((s, h) => s + (h.yards || 0), 0);
}

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

// Combined diagram: fairway strip (tee-side zones) narrowing into a green
// complex at the top — a green circle, surrounded by a bunker ring (any
// direction), surrounded by a miss ring (short/long/left/right), plus three
// round fairway-bunker markers over the fairway strip. Same diagram is used
// for every shot on the hole — it describes where the ball ended up, not
// which shot number it was or what the player intended.
function ShotZoneSelector({ value, onChange }) {
  const CX = 150;
  const CY = 170;
  const R_GREEN = 26;
  const R_BUNKER = 52;
  const R_MISS = 84;
  const yBottom = 520;
  const fairwayTop = CY + R_MISS; // rings meet the fairway strip here
  const bottomHalf = 135;
  const topHalf = R_MISS; // matches the ring diameter for a smooth join

  const toPoint = (r, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
  };
  // Annulus sector path. Angles are "clock" degrees: 0 = back (away from
  // tee), 90 = right, 180 = front (toward tee), 270 = left.
  const sectorPath = (rInner, rOuter, angleStart, angleEnd) => {
    const p1 = toPoint(rOuter, angleStart);
    const p2 = toPoint(rOuter, angleEnd);
    const p3 = toPoint(rInner, angleEnd);
    const p4 = toPoint(rInner, angleStart);
    const largeArc = angleEnd - angleStart > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
  };

  const QUADRANTS = [
    { dir: "back", start: 315, end: 405 },
    { dir: "right", start: 45, end: 135 },
    { dir: "front", start: 135, end: 225 },
    { dir: "left", start: 225, end: 315 },
  ];

  const bunkerRingGeom = QUADRANTS.map((q, i) => {
    const mid = (q.start + q.end) / 2;
    const c = toPoint((R_GREEN + R_BUNKER) / 2, mid);
    return { ...BUNKER_RING_ZONES[i], shape: "path", d: sectorPath(R_GREEN, R_BUNKER, q.start, q.end), cx: c.x, cy: c.y };
  });

  const missRingGeom = QUADRANTS.map((q, i) => {
    const mid = (q.start + q.end) / 2;
    const c = toPoint((R_BUNKER + R_MISS) / 2, mid);
    return { ...MISS_RING_ZONES[i], shape: "path", d: sectorPath(R_BUNKER, R_MISS, q.start, q.end), cx: c.x, cy: c.y };
  });

  const greenGeom = { ...GREEN_ZONE, shape: "circle", cx: CX, cy: CY, r: R_GREEN };

  const fairwayGeom = FAIRWAY_ZONES.map((z, i) => {
    const bl = CX - bottomHalf + (i * (2 * bottomHalf)) / 5;
    const br = bl + (2 * bottomHalf) / 5;
    const tl = CX - topHalf + (i * (2 * topHalf)) / 5;
    const tr = tl + (2 * topHalf) / 5;
    const points = `${bl},${yBottom} ${br},${yBottom} ${tr},${fairwayTop} ${tl},${fairwayTop}`;
    return { ...z, shape: "poly", points, cx: (bl + br + tl + tr) / 4, cy: (yBottom + fairwayTop) / 2 };
  });

  const midY = (yBottom + fairwayTop) / 2;
  const t = (yBottom - midY) / (yBottom - fairwayTop);
  const halfWidthMid = bottomHalf + (topHalf - bottomHalf) * t;
  const fairwayBunkerGeom = [
    { ...FAIRWAY_BUNKER_ZONES[0], shape: "circle", cx: CX - halfWidthMid * 0.55, cy: midY, r: 20 },
    { ...FAIRWAY_BUNKER_ZONES[1], shape: "circle", cx: CX, cy: midY, r: 20 },
    { ...FAIRWAY_BUNKER_ZONES[2], shape: "circle", cx: CX + halfWidthMid * 0.55, cy: midY, r: 20 },
  ];

  const allGeom = [...fairwayGeom, ...fairwayBunkerGeom, greenGeom, ...bunkerRingGeom, ...missRingGeom];
  const selected = allGeom.find((z) => z.key === value);

  const shapeProps = (z) => ({
    fill: z.color,
    opacity: value && value !== z.key ? 0.35 : 1,
    stroke: value === z.key ? COLORS.sand : COLORS.fairwayDeep,
    strokeWidth: value === z.key ? 4 : 1.5,
    style: { cursor: "pointer" },
    onClick: () => onChange(value === z.key ? null : z.key),
  });

  return (
    <div className="tee-shot-wrap">
      <svg viewBox="0 0 300 560" className="tee-shot-svg" role="group" aria-label="Shot landing zone">
        {fairwayGeom.map((z) => (
          <polygon key={z.key} points={z.points} {...shapeProps(z)} />
        ))}
        {fairwayBunkerGeom.map((z) => (
          <circle key={z.key} cx={z.cx} cy={z.cy} r={z.r} {...shapeProps(z)} />
        ))}
        {missRingGeom.map((z) => (
          <path key={z.key} d={z.d} {...shapeProps(z)} />
        ))}
        {bunkerRingGeom.map((z) => (
          <path key={z.key} d={z.d} {...shapeProps(z)} />
        ))}
        <circle cx={greenGeom.cx} cy={greenGeom.cy} r={greenGeom.r} {...shapeProps(greenGeom)} />
        {/* flag, decorative only */}
        <line x1={CX} y1={CY - R_GREEN} x2={CX} y2={CY - R_MISS - 30} stroke={COLORS.scorecard} strokeWidth={2} pointerEvents="none" />
        <path d={`M ${CX} ${CY - R_MISS - 30} L ${CX} ${CY - R_MISS - 17} L ${CX + 14} ${CY - R_MISS - 24} Z`} fill={COLORS.flag} pointerEvents="none" />
        {/* tee markers, decorative only */}
        <circle cx={CX - 10} cy={yBottom + 8} r={3} fill={COLORS.scorecard} pointerEvents="none" />
        <circle cx={CX + 10} cy={yBottom + 8} r={3} fill={COLORS.scorecard} pointerEvents="none" />
        {selected && <circle cx={selected.cx} cy={selected.cy} r={7} fill={COLORS.scorecard} stroke={COLORS.ink} strokeWidth={2} pointerEvents="none" />}
      </svg>
      <div className="zone-label">{selected ? selected.label : "Tap where the shot ended up"}</div>
    </div>
  );
}

function HoleScreen({ round, holeIndex, onHoleChange, onNav, onGoReview, bag }) {
  const h = round.holes[holeIndex];
  const patch = (p) => onHoleChange(h.hole, p);

  const shots = h.shots || [];
  const applyShots = (nextShots) => {
    const totals = computeHoleTotals(nextShots);
    patch({ shots: nextShots, ...totals });
  };
  const updateShot = (idx, p) => applyShots(shots.map((s, i) => (i === idx ? { ...s, ...p } : s)));
  const addShot = () => applyShots([...shots, emptyShot()]);
  const removeShot = (idx) => {
    const next = shots.filter((_, i) => i !== idx);
    applyShots(next.length ? next : [emptyShot()]);
  };
  const togglePenalty = (idx) => {
    updateShot(idx, shots[idx].isPenalty ? { isPenalty: false } : { isPenalty: true, club: "", zone: null });
  };

  const clubGridClubs = CLUB_OPTIONS.filter((c) => bag.includes(c));

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

      {shots.map((shot, idx) => {
        const label = idx === 0 ? "Shot 1 (tee)" : `Shot ${idx + 1}`;
        return (
          <div className="section" key={shot.id}>
            <div className="section-label-row">
              <span className="section-label">{label}</span>
              <div className="shot-header-actions">
                <button
                  className={`penalty-btn ${shot.isPenalty ? "penalty-btn-active" : ""}`}
                  onClick={() => togglePenalty(idx)}
                >
                  Penalty
                </button>
                {shots.length > 1 && (
                  <button className="remove-shot-btn" onClick={() => removeShot(idx)} aria-label={`remove ${label}`}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {shot.isPenalty ? (
              <div className="penalty-summary">Penalty stroke — adds 1 to the score</div>
            ) : (
              <>
                <div className="club-grid">
                  {clubGridClubs.map((c) => (
                    <button
                      key={c}
                      className={`club-btn ${shot.club === c ? "club-btn-active" : ""}`}
                      onClick={() => updateShot(idx, { club: shot.club === c ? "" : c, zone: shot.club === c ? shot.zone : null })}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {shot.club === "Putter" ? (
                  <div className="putts-control">
                    <span className="section-label" style={{ marginBottom: 0 }}>Number of putts</span>
                    <Stepper label="putts this shot" value={shot.putts || 0} min={0} onChange={(v) => updateShot(idx, { putts: v })} />
                  </div>
                ) : (
                  <>
                    <div className="section-label" style={{ marginTop: 14 }}>{label} — result</div>
                    <ShotZoneSelector value={shot.zone} onChange={(v) => updateShot(idx, { zone: v })} />
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      <button className="add-shot-btn" onClick={addShot}>
        <Plus size={14} /> Add another shot
      </button>

      <div className="section">
        <div className="section-label">Hole result</div>
        <div className="computed-summary">
          <div className="summary-item">
            <span className="summary-val">{h.strokes}</span>
            <span className="summary-label">strokes</span>
          </div>
          <div className="summary-item">
            <span className="summary-val">{h.putts}</span>
            <span className="summary-label">putts</span>
          </div>
          <div className="summary-item">
            <span className="summary-val">{h.penalties}</span>
            <span className="summary-label">penalties</span>
          </div>
        </div>
        <p className="computed-hint">Calculated automatically from the shots logged above.</p>
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
          const firstShot = (h.shots || [])[0];
          const zone = zoneLookup(firstShot?.zone);
          const rel = h.strokes - h.par;
          return (
            <div key={h.hole} className="review-row" onClick={() => onEditHole(h.hole - 1)}>
              <span className="review-hole-num">{h.hole}</span>
              <span className="review-cell">{h.par}</span>
              <span className="review-cell review-club">{firstShot?.club || "—"}</span>
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

function BagEditor({ bag, onChange, onSave, onCancel }) {
  const toggle = (club) => {
    if (bag.includes(club)) {
      onChange(bag.filter((c) => c !== club));
    } else if (bag.length < MAX_BAG_SIZE) {
      onChange([...bag, club]);
    }
  };

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="back-btn" onClick={onCancel}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="section">
        <div className="section-label-row">
          <span className="section-label">Your bag</span>
          <span className="bag-count">{bag.length}/{MAX_BAG_SIZE}</span>
        </div>
        <p className="hcp-hint">Pick the clubs you carry — up to {MAX_BAG_SIZE}. These are what you'll choose from during a round.</p>
        <div className="club-grid">
          {CLUB_OPTIONS.map((c) => {
            const active = bag.includes(c);
            const disabled = !active && bag.length >= MAX_BAG_SIZE;
            return (
              <button
                key={c}
                className={`club-btn ${active ? "club-btn-active" : ""}`}
                style={disabled ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
                onClick={() => !disabled && toggle(c)}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
      <button className="save-btn" onClick={onSave}>Save bag</button>
    </div>
  );
}

function RoundSetup({ round, onChange, onBegin, onCancel, courses }) {
  const applyCourseTee = (courseId, teeId) => {
    const c = courses.find((c) => c.id === courseId);
    if (!c) return;
    const tee = c.tees.find((t) => t.id === teeId) || c.tees[0];
    onChange({
      ...round,
      course: c.name,
      courseId: c.id,
      teeId: tee.id,
      teeName: tee.name,
      holes: round.holes.map((h) => {
        const src = tee.holes.find((th) => th.hole === h.hole);
        return src ? { ...h, par: src.par, strokes: src.par } : h;
      }),
    });
  };

  const selectedCourse = courses.find((c) => c.id === round.courseId);

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="back-btn" onClick={onCancel}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="setup-card">
        <div className="setup-title">New round</div>

        {courses.length > 0 && (
          <>
            <label className="setup-label">Saved course (optional)</label>
            <select
              className="course-select"
              value={round.courseId || ""}
              onChange={(e) => {
                const c = courses.find((c) => c.id === e.target.value);
                if (c) applyCourseTee(c.id, c.tees[0].id);
                else onChange({ ...round, courseId: null, teeId: null, teeName: null });
              }}
            >
              <option value="">— Type course name manually —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {selectedCourse && selectedCourse.tees.length > 1 && (
              <>
                <label className="setup-label">Tee</label>
                <select
                  className="course-select"
                  value={round.teeId || ""}
                  onChange={(e) => applyCourseTee(selectedCourse.id, e.target.value)}
                >
                  {selectedCourse.tees.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </>
            )}
          </>
        )}

        {!round.courseId && (
          <>
            <label className="setup-label">Course</label>
            <input className="course-input" placeholder="Course name" value={round.course} onChange={(e) => onChange({ ...round, course: e.target.value })} />
          </>
        )}

        <label className="setup-label">Date</label>
        <input className="date-input" type="date" value={round.date} onChange={(e) => onChange({ ...round, date: e.target.value })} />
        <button className="save-btn" style={{ marginTop: 20 }} onClick={onBegin}>
          Begin round — Hole 1
        </button>
      </div>
    </div>
  );
}

function CourseHoleTable({ tee, onHoleChange }) {
  const front = tee.holes.slice(0, 9);
  const back = tee.holes.slice(9, 18);

  const renderNine = (holes, label) => (
    <div className="course-nine">
      <div className="course-nine-title">
        {label}
        <span className="course-nine-sub">Par {courseParTotal({ holes })} · {courseYardsTotal({ holes })} yds</span>
      </div>
      <div className="course-grid-head">
        <span>Hole</span>
        <span>Par</span>
        <span>Yards</span>
      </div>
      {holes.map((h) => (
        <div key={h.hole} className="course-row">
          <span className="course-hole-num">{h.hole}</span>
          <Stepper label={`hole ${h.hole} par`} value={h.par} min={3} onChange={(v) => onHoleChange(h.hole, { par: v })} />
          <input
            className="yards-input"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={h.yards || ""}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onHoleChange(h.hole, { yards: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      ))}
    </div>
  );

  return (
    <>
      {renderNine(front, "Front Nine")}
      {renderNine(back, "Back Nine")}
    </>
  );
}

function HandicapTable({ handicaps, onChange }) {
  // handicaps[i] = the stroke index (1-18) assigned to hole (i+1)
  const setSIForHole = (holeIdx, value) => {
    const clamped = Math.min(18, Math.max(1, value));
    const next = [...handicaps];
    next[holeIdx] = clamped;
    onChange(next);
  };

  const renderNine = (start, end, label) => (
    <div className="course-nine">
      <div className="course-nine-title">{label}</div>
      {Array.from({ length: end - start }, (_, k) => {
        const holeIdx = start + k;
        const holeNum = holeIdx + 1;
        return (
          <div key={holeNum} className="si-row">
            <span className="si-label">Hole {holeNum}</span>
            <span className="si-arrow-label">SI</span>
            <Stepper label={`stroke index for hole ${holeNum}`} value={handicaps[holeIdx]} min={1} onChange={(v) => setSIForHole(holeIdx, v)} />
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {renderNine(0, 9, "Front Nine")}
      {renderNine(9, 18, "Back Nine")}
    </>
  );
}

function CourseEditor({ course, onChange, onSave, onCancel, onDelete }) {
  const [activeTee, setActiveTee] = useState(course.tees[0].id);
  const tee = course.tees.find((t) => t.id === activeTee) || course.tees[0];

  const updateTee = (patch) => {
    onChange({ ...course, tees: course.tees.map((t) => (t.id === tee.id ? { ...t, ...patch } : t)) });
  };
  const updateTeeHole = (holeNum, patch) => {
    updateTee({ holes: tee.holes.map((h) => (h.hole === holeNum ? { ...h, ...patch } : h)) });
  };
  const addTee = () => {
    const names = ["White", "Blue", "Black", "Gold", "Red", "Green"];
    const used = course.tees.map((t) => t.name);
    const name = names.find((n) => !used.includes(n)) || `Tee ${course.tees.length + 1}`;
    const nt = emptyTee(name);
    // seed new tee's par from an existing tee so par stays consistent by default
    nt.holes = nt.holes.map((h, i) => ({ ...h, par: course.tees[0].holes[i].par }));
    onChange({ ...course, tees: [...course.tees, nt] });
    setActiveTee(nt.id);
  };
  const removeTee = (teeId) => {
    if (course.tees.length <= 1) return;
    const next = course.tees.filter((t) => t.id !== teeId);
    onChange({ ...course, tees: next });
    if (activeTee === teeId) setActiveTee(next[0].id);
  };

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="back-btn" onClick={onCancel}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="setup-card">
        <label className="setup-label">Course name</label>
        <input className="course-input" placeholder="Course name" value={course.name} onChange={(e) => onChange({ ...course, name: e.target.value })} />
      </div>

      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-label">Tees</div>
        <div className="tee-chip-row">
          {course.tees.map((t) => (
            <button key={t.id} className={`tee-chip ${t.id === activeTee ? "tee-chip-active" : ""}`} onClick={() => setActiveTee(t.id)}>
              {t.name}
              {course.tees.length > 1 && (
                <span
                  className="tee-chip-remove"
                  onClick={(e) => { e.stopPropagation(); removeTee(t.id); }}
                >
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
          <button className="tee-chip tee-chip-add" onClick={addTee}><Plus size={13} /></button>
        </div>

        <div className="tee-fields">
          <label className="setup-label">Tee name</label>
          <input className="course-input" value={tee.name} onChange={(e) => updateTee({ name: e.target.value })} />
          <div className="tee-rating-row">
            <div className="tee-rating-field">
              <label className="setup-label">Course rating</label>
              <input
                className="rating-input"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="72.0"
                value={tee.rating || ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateTee({ rating: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="tee-rating-field">
              <label className="setup-label">Slope rating</label>
              <input
                className="rating-input"
                type="number"
                inputMode="numeric"
                placeholder="113"
                value={tee.slope || ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateTee({ slope: e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
        </div>
      </div>

      <CourseHoleTable tee={tee} onHoleChange={updateTeeHole} />

      <div className="section">
        <div className="section-label">Handicap (stroke index)</div>
        <p className="hcp-hint">Shared across all tees. SI 1 is the hardest hole, SI 18 the easiest.</p>
        <HandicapTable handicaps={course.handicaps} onChange={(next) => onChange({ ...course, handicaps: next })} />
      </div>

      <button className="save-btn" onClick={onSave}>Save course</button>
      {onDelete && (
        <button className="delete-course-btn" onClick={onDelete}>
          <Trash2 size={14} /> Delete course
        </button>
      )}
    </div>
  );
}

function CourseStub({ course, onOpen, onDelete }) {
  const tee = course.tees[0];
  return (
    <div className="stub" onClick={() => onOpen(course.id)}>
      <div className="stub-perf" />
      <div className="stub-main">
        <div className="stub-top">
          <span className="stub-course">{course.name || "Untitled course"}</span>
          <button className="stub-delete" onClick={(e) => { e.stopPropagation(); onDelete(course.id); }} aria-label="delete course">
            <Trash2 size={14} />
          </button>
        </div>
        <div className="stub-meta">
          <span><MapPin size={12} /> {course.tees.length} tee{course.tees.length > 1 ? "s" : ""}</span>
        </div>
        <div className="stub-stats">
          <div className="stub-stat">
            <span className="stub-stat-val">{courseParTotal(tee)}</span>
            <span className="stub-stat-label">par</span>
          </div>
          <div className="stub-stat">
            <span className="stub-stat-val">{tee.rating.toFixed(1)}</span>
            <span className="stub-stat-label">rating</span>
          </div>
          <div className="stub-stat">
            <span className="stub-stat-val">{tee.slope}</span>
            <span className="stub-stat-label">slope</span>
          </div>
        </div>
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
  const [courses, setCourses] = useState(null);
  const [bag, setBag] = useState(DEFAULT_BAG);
  const [editingBag, setEditingBag] = useState(DEFAULT_BAG);
  const [view, setView] = useState("list"); // list | setup | hole | review | courses-list | course-editor | bag-editor
  const [editing, setEditing] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
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
      try {
        const res = await window.storage.get("courses-index", false);
        const list = res ? JSON.parse(res.value) : [];
        setCourses(list);
      } catch (e) {
        setCourses([]);
      }
      try {
        const res = await window.storage.get("golf-bag", false);
        const saved = res ? JSON.parse(res.value) : DEFAULT_BAG;
        setBag(saved);
        setEditingBag(saved);
      } catch (e) {
        // keep default bag
      }
    })();
  }, []);

  const saveBag = async () => {
    try {
      await window.storage.set("golf-bag", JSON.stringify(editingBag), false);
      setBag(editingBag);
      setView("list");
    } catch (e) {
      setError("Couldn't save your bag — try again.");
    }
  };

  const persistIndex = async (list) => {
    try {
      await window.storage.set("rounds-index", JSON.stringify(list), false);
    } catch (e) {
      setError("Couldn't save — try again.");
    }
  };

  const persistCoursesIndex = async (list) => {
    try {
      await window.storage.set("courses-index", JSON.stringify(list), false);
    } catch (e) {
      console.error("persistCoursesIndex failed:", e);
      setError(`Couldn't save — ${e && e.message ? e.message : "unknown error"}`);
    }
  };

  const startNewCourse = () => {
    setEditingCourse(newCourseTemplate());
    setView("course-editor");
  };

  const openCourse = async (id) => {
    try {
      const res = await window.storage.get(`course:${id}`, false);
      if (res) {
        setEditingCourse(JSON.parse(res.value));
        setView("course-editor");
      }
    } catch (e) {
      setError("Couldn't load that course.");
    }
  };

  const saveCourse = async () => {
    try {
      await window.storage.set(`course:${editingCourse.id}`, JSON.stringify(editingCourse), false);
      const summary = editingCourse;
      const rest = (courses || []).filter((c) => c.id !== editingCourse.id);
      const updated = [...rest, summary].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCourses(updated);
      await persistCoursesIndex(updated);
      setView("courses-list");
      setEditingCourse(null);
    } catch (e) {
      console.error("saveCourse failed:", e);
      setError(`Couldn't save this course: ${e && e.message ? e.message : "unknown error"}`);
    }
  };

  const deleteCourse = async (id) => {
    try {
      await window.storage.delete(`course:${id}`, false);
    } catch (e) {
      // ignore missing key
    }
    const updated = (courses || []).filter((c) => c.id !== id);
    setCourses(updated);
    await persistCoursesIndex(updated);
    if (view === "course-editor") {
      setView("courses-list");
      setEditingCourse(null);
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
        setEditing(migrateRound(JSON.parse(res.value)));
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
        .section-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .section-label-row .section-label { margin-bottom: 0; }
        .remove-shot-btn { background: none; border: none; color: ${COLORS.ink}66; cursor: pointer; padding: 4px; display: flex; }
        .remove-shot-btn:hover { color: ${COLORS.flag}; }
        .add-shot-btn { width: 100%; background: transparent; border: 2px dashed ${COLORS.scorecard}66; color: ${COLORS.scorecard}; border-radius: 8px; padding: 12px; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; margin-bottom: 12px; }
        .add-shot-btn:hover { border-color: ${COLORS.sand}; color: ${COLORS.sand}; }

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

        .shot-header-actions { display: flex; align-items: center; gap: 8px; }
        .penalty-btn { background: ${COLORS.scorecardDark}; border: 2px solid transparent; border-radius: 6px; padding: 5px 10px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: ${COLORS.ink}99; cursor: pointer; }
        .penalty-btn:hover { border-color: ${COLORS.flag}55; }
        .penalty-btn-active { background: ${COLORS.flag}; color: ${COLORS.scorecard}; }
        .penalty-summary { font-size: 13px; color: ${COLORS.flag}; font-weight: 600; padding: 8px 0 2px; }

        .putts-control { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; background: ${COLORS.scorecardDark}55; border-radius: 6px; padding: 10px 12px; }

        .computed-summary { display: flex; justify-content: space-between; gap: 10px; }
        .summary-item { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; background: ${COLORS.scorecardDark}; border-radius: 6px; padding: 10px 0; }
        .summary-val { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 20px; color: ${COLORS.ink}; }
        .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: ${COLORS.ink}88; }
        .computed-hint { font-size: 11px; color: ${COLORS.ink}77; margin: 8px 0 0; }

        .bag-count { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 700; color: ${COLORS.ink}99; }

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

        .header-actions { display: flex; align-items: center; gap: 10px; }
        .courses-link-btn { background: transparent; border: 1px solid ${COLORS.sand}66; color: ${COLORS.scorecard}; border-radius: 999px; padding: 9px 14px; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; cursor: pointer; }
        .courses-link-btn:hover { border-color: ${COLORS.sand}; color: ${COLORS.sand}; }

        .course-select { width: 100%; background: ${COLORS.scorecardDark}; border: none; border-radius: 4px; padding: 10px 12px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: ${COLORS.ink}; margin-bottom: 4px; }

        .delete-course-btn { width: 100%; background: transparent; border: 1px solid ${COLORS.flag}88; color: ${COLORS.flag}; border-radius: 6px; padding: 12px; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; margin-bottom: 30px; margin-top: -10px; }
        .delete-course-btn:hover { background: ${COLORS.flag}15; }

        .tee-chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .tee-chip { background: ${COLORS.scorecardDark}; border: 2px solid transparent; border-radius: 999px; padding: 7px 12px; font-weight: 600; font-size: 13px; color: ${COLORS.ink}; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .tee-chip-active { background: ${COLORS.turf}; color: ${COLORS.scorecard}; }
        .tee-chip-remove { display: flex; opacity: 0.6; }
        .tee-chip-remove:hover { opacity: 1; }
        .tee-chip-add { padding: 7px 10px; }

        .tee-fields { background: ${COLORS.scorecardDark}55; border-radius: 6px; padding: 10px 12px 4px; }
        .tee-rating-row { display: flex; gap: 12px; }
        .tee-rating-field { flex: 1; }
        .rating-input { width: 100%; background: ${COLORS.scorecardDark}; border: none; border-radius: 4px; padding: 9px 10px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 14px; color: ${COLORS.ink}; }

        .course-nine { background: ${COLORS.scorecard}; border-radius: 4px; padding: 12px 12px 4px; margin-bottom: 14px; color: ${COLORS.ink}; }
        .course-nine-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid ${COLORS.ink}22; padding-bottom: 6px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }
        .course-nine-sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: none; letter-spacing: 0; color: ${COLORS.ink}88; font-weight: 500; }
        .course-grid-head { display: grid; grid-template-columns: 36px 1fr 90px; gap: 8px; }
        .course-grid-head span { font-size: 9px; text-transform: uppercase; color: ${COLORS.ink}88; text-align: center; }
        .course-row { display: grid; grid-template-columns: 36px 1fr 90px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed ${COLORS.ink}18; }
        .course-hole-num { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13px; text-align: center; }
        .yards-input { width: 100%; background: ${COLORS.scorecardDark}; border: none; border-radius: 4px; padding: 6px 8px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13px; color: ${COLORS.ink}; text-align: center; }

        .hcp-hint { font-size: 12px; color: ${COLORS.ink}88; margin: -4px 0 10px; }
        .si-row { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed ${COLORS.ink}18; }
        .si-label { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 13px; }
        .si-arrow-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: ${COLORS.ink}77; text-align: right; }

        .error-banner { max-width: 480px; margin: 0 auto 14px; background: ${COLORS.flag}22; border: 1px solid ${COLORS.flag}; color: ${COLORS.scorecard}; padding: 8px 12px; border-radius: 4px; font-size: 13px; }

        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      {error && <div className="error-banner">{error}</div>}

      {view === "list" && (
        <>
          <div className="header-row">
            <div className="header-title"><Flag size={26} strokeWidth={2.2} /> Golf Journal</div>
            <div className="header-actions">
              <button className="courses-link-btn" onClick={() => { setEditingBag(bag); setView("bag-editor"); }}>My Bag</button>
              <button className="courses-link-btn" onClick={() => setView("courses-list")}><MapPin size={15} /> Courses</button>
              <button className="new-btn" onClick={startNew}><Plus size={16} /> New round</button>
            </div>
          </div>
          <div className="list-wrap">
            {rounds === null && <div className="empty-state">Loading your rounds...</div>}
            {rounds && rounds.length === 0 && <div className="empty-state">No rounds logged yet.<br />Tee off with "New round" above.</div>}
            {rounds && rounds.map((r) => <RoundStub key={r.id} round={r} onOpen={openRound} onDelete={deleteRound} />)}
          </div>
        </>
      )}

      {view === "bag-editor" && (
        <BagEditor bag={editingBag} onChange={setEditingBag} onSave={saveBag} onCancel={() => setView("list")} />
      )}

      {view === "courses-list" && (
        <>
          <div className="header-row">
            <div className="header-title"><MapPin size={24} strokeWidth={2.2} /> Courses</div>
            <button className="new-btn" onClick={startNewCourse}><Plus size={16} /> Add course</button>
          </div>
          <div className="list-wrap">
            <button className="back-btn" style={{ marginBottom: 4 }} onClick={() => setView("list")}><ArrowLeft size={16} /> Back to rounds</button>
            {courses === null && <div className="empty-state">Loading your courses...</div>}
            {courses && courses.length === 0 && <div className="empty-state">No courses saved yet.<br />Add one to speed up round setup.</div>}
            {courses && courses.map((c) => <CourseStub key={c.id} course={c} onOpen={openCourse} onDelete={deleteCourse} />)}
          </div>
        </>
      )}

      {view === "course-editor" && editingCourse && (
        <CourseEditor
          course={editingCourse}
          onChange={setEditingCourse}
          onSave={saveCourse}
          onCancel={() => setView("courses-list")}
          onDelete={(courses || []).some((c) => c.id === editingCourse.id) ? () => deleteCourse(editingCourse.id) : null}
        />
      )}

      {view === "setup" && editing && (
        <RoundSetup round={editing} onChange={setEditing} onBegin={() => { setHoleIndex(0); setView("hole"); }} onCancel={() => setView("list")} courses={courses || []} />
      )}

      {view === "hole" && editing && (
        <HoleScreen
          round={editing}
          holeIndex={holeIndex}
          onHoleChange={updateHole}
          onNav={setHoleIndex}
          onGoReview={() => setView("review")}
          bag={bag}
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
