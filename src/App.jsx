import React, { useState, useRef, useEffect } from "react";
import runSimulation, {
  ACTIONS,
  forecastSurvival,
  chooseBestAction,
  applyAction,
  updateEconomy,
  DEFAULT_STATE,
  calculateUtility,
  setDefaultState,
  getDefaultState,
  resetDefaultState,
  DEFAULT_STATE_INFO,
} from "./script";

function LineChart({
  data,
  keys,
  colors,
  height = 260,
  highlightIndex = -1,
  visibleKeys = keys,
  onHover,
}) {
  if (!data || data.length === 0) return null;

  const SVG_WIDTH = 820;
  const PAD_LEFT = 60;
  const PAD_RIGHT = 20;
  const PAD_BOTTOM = 30;

  const innerWidth = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = height - PAD_BOTTOM;

  const x = (i) => PAD_LEFT + (i / (data.length - 1 || 1)) * innerWidth;

  const allValues = [];
  keys.forEach((k) => data.forEach((d) => allValues.push(d[k])));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  // Y scale maps value -> svg y coordinate
  const yScale = (v) =>
    innerHeight - ((v - min) / (max - min || 1)) * innerHeight + 10;

  // ticks for y axis
  const ticks = 5;
  const tickValues = Array.from(
    { length: ticks + 1 },
    (_, i) => min + ((max - min) * i) / ticks,
  ).reverse();

  // build path for a given key (only if visible)
  const buildPath = (k) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yScale(d[k])}`)
      .join(" ");

  // mouse handlers for tooltip/hover
  const handleMouseMove = (e) => {
    if (!onHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPos = e.clientX - rect.left - PAD_LEFT;
    const idx = Math.round((xPos / innerWidth) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    onHover(clamped, e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseLeave = () => {
    if (onHover) onHover(null);
  };

  return (
    <svg
      width={SVG_WIDTH}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: onHover ? "crosshair" : "default" }}
    >
      {/* background grid */}
      <rect
        x={PAD_LEFT}
        y={10}
        width={innerWidth}
        height={innerHeight}
        fill="transparent"
      />
      {tickValues.map((tv, i) => (
        <g key={i}>
          <line
            x1={PAD_LEFT}
            x2={PAD_LEFT + innerWidth}
            y1={yScale(tv)}
            y2={yScale(tv)}
            stroke="#e6eef6"
          />
          <text
            x={PAD_LEFT - 8}
            y={yScale(tv) + 4}
            fontSize={12}
            textAnchor="end"
            fill="#475569"
          >
            {tv.toFixed(0)}
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={x(i)}
          y={height - 4}
          fontSize={11}
          textAnchor="middle"
          fill="#64748b"
        >
          {d.month}
        </text>
      ))}

      {/* series paths */}
      {keys.map(
        (k, idx) =>
          visibleKeys.includes(k) && (
            <path
              key={k}
              d={buildPath(k)}
              stroke={colors[idx]}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
      )}

      {/* highlight marker */}
      {typeof highlightIndex === "number" &&
        highlightIndex >= 0 &&
        data[highlightIndex] && (
          <g>
            <line
              x1={x(highlightIndex)}
              x2={x(highlightIndex)}
              y1={10}
              y2={10 + innerHeight}
              stroke="#94a3b8"
              strokeDasharray="4"
            />
            {keys.map(
              (k, idx) =>
                visibleKeys.includes(k) && (
                  <circle
                    key={k + "pt"}
                    cx={x(highlightIndex)}
                    cy={yScale(data[highlightIndex][k])}
                    r={5}
                    fill={colors[idx]}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                ),
            )}
          </g>
        )}
    </svg>
  );
}

function ForecastTable({ forecasts }) {
  // If there are no forecasts (e.g., non-animated full run), render nothing
  if (!forecasts || forecasts.length === 0) return null;

  return (
    <table style={{ width: "100%" }} className="forecast-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Survival</th>
          <th>Expected Cash</th>
          <th>Utility</th>
        </tr>
      </thead>
      <tbody>
        {forecasts.map((f) => (
          <tr key={f.action} className="forecast-row">
            <td>{f.action}</td>
            <td>
              <div className="forecast-bar">
                <div
                  style={{
                    width: `${(f.survivalProbability * 100).toFixed(1)}%`,
                  }}
                />
              </div>
            </td>
            <td>{(f.expectedCash || 0).toFixed(2)}</td>
            <td>{(f.utility || 0).toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [history, setHistory] = useState([]);
  const [runs, setRuns] = useState(100);
  const [months, setMonths] = useState(24);

  // Editable defaults UI state and persistence
  const [defaultValues, setDefaultValues] = useState(() => getDefaultState());
  const localStorageKey = "life-under-inflation.defaults";

  // Load saved defaults from localStorage (if any) on mount
  useEffect(() => {
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDefaultValues(parsed);
        setDefaultState(parsed);
      } catch (e) {
        console.warn("Failed to parse saved defaults", e);
      }
    } else {
      setDefaultValues(getDefaultState());
    }
  }, []);

  const applyDefaults = () => {
    setDefaultState(defaultValues);
    // reset running simulation to use new defaults
    resetSim(defaultValues);
  };

  const saveDefaults = () => {
    localStorage.setItem(localStorageKey, JSON.stringify(defaultValues));
  };

  const resetDefaultsToOriginal = () => {
    resetDefaultState();
    const original = getDefaultState();
    setDefaultValues(original);
    localStorage.removeItem(localStorageKey);
    resetSim(original);
  };

  const onChangeDefault = (key, value) => {
    setDefaultValues((prev) => ({ ...prev, [key]: value }));
  };

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(700);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Visible series toggles for the chart
  const [visibleSeries, setVisibleSeries] = useState({
    cash: true,
    expenses: true,
    salary: true,
  });
  const toggleSeries = (k) =>
    setVisibleSeries((prev) => ({ ...prev, [k]: !prev[k] }));

  // Tooltip for chart hover
  const [tooltip, setTooltip] = useState(null);

  // Under-the-hood mutable simulation state
  const simStateRef = useRef(null);
  const monthRef = useRef(0);
  const intervalRef = useRef(null);

  // Reset simulation state
  const resetSim = (initialState) => {
    simStateRef.current = JSON.parse(
      JSON.stringify(initialState || DEFAULT_STATE),
    );
    monthRef.current = 0;
    setHistory([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // One step: compute forecasts, pick action, apply it, advance one month
  const stepOnce = async () => {
    if (!simStateRef.current)
      simStateRef.current = JSON.parse(JSON.stringify(DEFAULT_STATE));
    const stateClone = JSON.parse(JSON.stringify(simStateRef.current));

    // compute forecasts for each action (this is the "inner thinking" the AI does)
    const forecasts = await Promise.all(
      ACTIONS.map(async (action) => {
        const f = await forecastSurvival(stateClone, action, runs);
        return { action, ...f, utility: calculateUtility(f) };
      }),
    );

    // decide best action using the same monte-carlo heuristic
    const best = chooseBestAction(simStateRef.current, runs);

    // apply and progress
    applyAction(simStateRef.current, best);
    updateEconomy(simStateRef.current);

    monthRef.current += 1;

    const snapshot = {
      month: monthRef.current,
      action: best,
      cash: simStateRef.current.cash,
      salary: simStateRef.current.salary,
      expenses: simStateRef.current.expenses,
      inflation: simStateRef.current.inflation,
      investment: simStateRef.current.investment,
      happiness: simStateRef.current.happiness,
      forecasts,
    };

    setHistory((h) => {
      const next = [...h, snapshot];
      setCurrentIndex(next.length - 1);
      return next;
    });

    // stop conditions
    if (simStateRef.current.cash <= 0 || monthRef.current >= months) {
      setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  // Play / pause effect
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        stepOnce();
      }, speedMs);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // cleanup
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speedMs, runs, months]);

  // Public controls
  const handleRunFull = () => {
    // run a quick batch run and display results (non-animated)
    const hist = runSimulation({ months, monteCarloRuns: runs });
    resetSim();
    setHistory(hist);
    setCurrentIndex(hist.length - 1);
  };

  const handleStartAnimation = () => {
    resetSim();
    setIsPlaying(true);
  };

  const handleStep = () => {
    if (!simStateRef.current) resetSim();
    stepOnce();
  };

  const handleReset = () => resetSim();

  // init default state on mount
  useEffect(() => {
    resetSim();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Life Under Inflation</h1>
        <div className="small">
          Step through the AI's decision process and see per-action forecasts.
        </div>
      </div>

      <div className="controls">
        <label className="small">
          Months:{" "}
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          />
        </label>
        <label className="small" style={{ marginLeft: 12 }}>
          Monte Carlo runs:{" "}
          <input
            type="number"
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
          />
        </label>
        <button
          className="button"
          style={{ marginLeft: 12 }}
          onClick={handleRunFull}
        >
          Run Full
        </button>
        <button
          className="button"
          style={{ marginLeft: 8 }}
          onClick={handleStartAnimation}
        >
          Play
        </button>
        <button
          className="button"
          style={{ marginLeft: 8 }}
          onClick={() => setIsPlaying(false)}
        >
          Pause
        </button>
        <button
          className="button"
          style={{ marginLeft: 8 }}
          onClick={handleStep}
        >
          Step
        </button>
        <button
          className="button"
          style={{ marginLeft: 8 }}
          onClick={handleReset}
        >
          Reset
        </button>
        <label style={{ marginLeft: 12 }} className="small">
          Speed(ms):{" "}
          <input
            type="number"
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="card">
        <h3>Defaults (editable)</h3>
        <div className="small">
          Edit the simulation default values below and <strong>Apply</strong> to
          use them immediately. Use <strong>Save</strong> to persist to this
          browser.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 12,
          }}
        >
          {Object.keys(DEFAULT_STATE).map((k) => (
            <div key={k}>
              <label className="small">
                {k} <div className="small">{DEFAULT_STATE_INFO[k]}</div>
              </label>
              <input
                type="number"
                step={k === "inflation" ? 0.001 : 1}
                value={defaultValues[k] ?? ""}
                onChange={(e) =>
                  onChangeDefault(
                    k,
                    k === "inflation"
                      ? parseFloat(e.target.value)
                      : Number(e.target.value),
                  )
                }
                style={{ width: "100%", padding: 6, marginTop: 6 }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="button" onClick={applyDefaults}>
            Apply
          </button>
          <button
            className="button"
            style={{ marginLeft: 8 }}
            onClick={saveDefaults}
          >
            Save
          </button>
          <button
            className="button"
            style={{ marginLeft: 8 }}
            onClick={resetDefaultsToOriginal}
          >
            Reset to Original
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Key series</h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 8,
          }}
        >
          {["cash", "expenses", "salary"].map((k, i) => (
            <label
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={visibleSeries[k]}
                onChange={() => toggleSeries(k)}
              />
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: ["#0891b2", "#ef4444", "#10b981"][i],
                  display: "inline-block",
                  borderRadius: 3,
                }}
              />
              <span className="small">{k}</span>
            </label>
          ))}
        </div>

        <div className="chart-wrap" style={{ position: "relative" }}>
          <LineChart
            data={history}
            keys={["cash", "expenses", "salary"]}
            colors={["#0891b2", "#ef4444", "#10b981"]}
            height={260}
            highlightIndex={currentIndex}
            visibleKeys={Object.keys(visibleSeries).filter(
              (k) => visibleSeries[k],
            )}
            onHover={(idx, x, y) => {
              if (idx === null) {
                setCurrentIndex(-1);
                setTooltip(null);
                return;
              }
              setCurrentIndex(idx);
              // compute tooltip information
              const snap = history[idx];
              if (!snap) {
                setTooltip(null);
                return;
              }
              setTooltip({ x, y, index: idx, snap });
            }}
          />

          {tooltip && (
            <div
              className="tooltip"
              style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
            >
              <div style={{ fontWeight: 600 }}>Month {tooltip.snap.month}</div>
              <div className="small">Action: {tooltip.snap.action}</div>
              {Object.keys(tooltip.snap)
                .filter((k) =>
                  ["cash", "salary", "expenses", "inflation"].includes(k),
                )
                .map((k) => (
                  <div key={k}>
                    <strong>{k}:</strong>{" "}
                    {k === "inflation"
                      ? (tooltip.snap[k] * 100).toFixed(2) + "%"
                      : tooltip.snap[k].toFixed(2)}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Current month</h3>
        {history[currentIndex] ? (
          <div>
            <div className="small">
              Month: <strong>{history[currentIndex].month}</strong> — Action
              chosen: <strong>{history[currentIndex].action}</strong>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <strong>Cash</strong>
                <div className="card">
                  {history[currentIndex].cash.toFixed(2)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <strong>Salary</strong>
                <div className="card">
                  {history[currentIndex].salary.toFixed(2)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <strong>Expenses</strong>
                <div className="card">
                  {history[currentIndex].expenses.toFixed(2)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <strong>Inflation</strong>
                <div className="card">
                  {(history[currentIndex].inflation * 100).toFixed(2)}%
                </div>
              </div>
            </div>

            <h4 style={{ marginTop: 12 }}>
              Per-action forecasts (what the AI considered)
            </h4>
            <ForecastTable forecasts={history[currentIndex].forecasts} />
          </div>
        ) : (
          <div className="small">
            No steps yet — use <strong>Play</strong> or <strong>Step</strong>.
          </div>
        )}
      </div>

      <div className="card">
        <h3>Month-by-month</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Action</th>
              <th>Cash</th>
              <th>Salary</th>
              <th>Expenses</th>
              <th>Inflation</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, idx) => (
              <tr
                key={h.month}
                style={idx === currentIndex ? { background: "#f1f5f9" } : {}}
              >
                <td>{h.month}</td>
                <td>{h.action}</td>
                <td>{h.cash.toFixed(2)}</td>
                <td>{h.salary.toFixed(2)}</td>
                <td>{h.expenses.toFixed(2)}</td>
                <td>{(h.inflation * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
