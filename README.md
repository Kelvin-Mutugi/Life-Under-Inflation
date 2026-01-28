# Life Under Inflation — Simulation & Visualizer

## Overview

**Life Under Inflation** is a small simulation project that models personal finances under stochastic inflation and volatile investments. It includes:

- `algo.js` — original Node.js simulation (left unchanged).
- `src/script.js` — browser-friendly simulation engine and exported helpers.
- `src/App.jsx` — React-based visualization and interactive controls (animated stepper, per-action forecasts, defaults editor).
- Development setup using Vite.

This repository is intended for exploration, visualization, and demonstration of Monte Carlo decision-making under economic uncertainty.

---

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the app in a browser:
   - http://localhost:5173/

---

## Core concepts

### State (fields)

The simulation uses a simple state object describing a household's finances:

- `cash` — available liquid cash (currency units)
- `salary` — monthly income (currency units)
- `expenses` — monthly recurring expenses (currency units)
- `inflation` — monthly inflation rate (decimal; for example `0.05` = 5%)
- `investment` — capital currently invested (currency units)
- `happiness` — optional emotional metric (arbitrary units)

These defaults are found in `src/script.js` as `DEFAULT_STATE`. The UI provides a **Defaults** panel to edit, apply, and persist these values.

### Randomness and distributions

The simulation uses normally distributed random variables implemented with the Box–Muller transform. Given two independent uniform random variables u1,u2 ∈ (0,1):

```
z0 = sqrt(-2 * ln(u1)) * cos(2π * u2)
```

`z0` is a standard normal sample (mean 0, variance 1). To obtain N(mean, std^2) we return `z0 * std + mean`.

Random samples are used for:

- **Inflation shocks**: small normal drift, std ≈ 0.01
- **Market returns**: normal with mean ≈ 0.05 (5%) and std ≈ 0.1 (10%)

---

## Economy update — per-month calculations

The function `updateEconomy(simState)` advances the state by one month using these steps and formulas:

1. **Inflation shock**

   ```text
   inflation = inflation + Normal(0, 0.01)
   inflation = max(inflation, 0)
   ```

   - A small random drift is applied to model short-term inflation shocks.
   - Inflation is floored at 0 for realism (no negative inflation in this model).

2. **Expenses grow with inflation**

   ```text
   expenses = expenses * (1 + inflation)
   ```

   - This models the effect of inflation on recurring costs.

3. **Investment market return**

   ```text
   marketReturn ~ Normal(0.05, 0.1)
   cash = cash + investment * marketReturn
   ```

   - Investment returns are volatile with mean 5% and std 10%.

4. **Net monthly cashflow**

   ```text
   cash = cash + salary - expenses
   ```

   - Salary is added and expenses subtracted to update available cash.

---

## Actions and their effects

The simulation supports a small set of discrete, interpretable actions applied at the start of a month via `applyAction(simState, action)`:

- `WORK_MORE`
  - `salary *= 1.10`
  - `happiness -= 5`
- `CUT_EXPENSES`
  - `expenses *= 0.85`
  - `happiness -= 10`
- `INVEST`
  - `investAmount = cash * 0.3`
  - `cash -= investAmount`
  - `investment += investAmount`
- `UPS KILL` (upskilling)
  - `cash -= 1000`
  - `salary *= 1.20`
- `DO_NOTHING`
  - no immediate change

These actions are intentionally simple so their long-term effects remain interpretable.

---

## Monte Carlo forecasting (short-term)

To decide between actions, the AI performs a short Monte Carlo forecast for each candidate action using the function `forecastSurvival(currentState, action, MONTE_CARLO_RUNS, FORECAST_MONTHS)`.

Algorithm summary:

1. For each simulation run (1..N):
   - clone the current state
   - apply the candidate action
   - simulate `FORECAST_MONTHS` steps of `updateEconomy`; stop early if `cash <= 0`
   - if `cash > 0` at the end of the horizon, count as a surviving run and accumulate ending cash
2. Compute metrics:

   ```text
   survivalProbability = surviveCount / N
   expectedCash = totalCash / (surviveCount || 1)
   ```

Defaults used by the UI: `N = 100` runs and `FORECAST_MONTHS = 6`. These are configurable when calling the function.

---

## Utility function and action selection

Each candidate action's forecast is summarized into a scalar **utility** that balances short-term survival against expected wealth:

```
utility = w1 * survivalProbability + w2 * (expectedCash / 10000)
```

- Current weights: `w1 = 0.6`, `w2 = 0.4` (survival prioritized). The `expectedCash` normalization divides by 10000 to keep units comparable.
- `chooseBestAction(currentState, monteCarloRuns)` evaluates utilities for each action and selects the action with the highest utility.

---

## Full simulation loop

`runSimulation({ months, monteCarloRuns, initialState })` performs a multi-month simulation as follows:

1. Initialize simulation state (deep clone of `initialState` or `DEFAULT_STATE`).
2. For month = 1..`months`:
   - `bestAction = chooseBestAction(state, monteCarloRuns)`
   - `applyAction(state, bestAction)`
   - `updateEconomy(state)`
   - record snapshot `{ month, action, cash, salary, expenses, inflation, investment, happiness }`
   - stop early if `cash <= 0`
3. Return the full `history` array of snapshots for visualization.

This function is the core driver used by the UI and for offline experiments.

---

## Exposed API (in `src/script.js`)

- `default export runSimulation({ months, monteCarloRuns, initialState })` → `history[]`
- `DEFAULT_STATE` — current defaults (object)
- `DEFAULT_STATE_INFO` — descriptions for default fields
- `setDefaultState(updates)` — merge updates into `DEFAULT_STATE`
- `getDefaultState()` — deep copy of current defaults
- `resetDefaultState()` — restore original defaults
- `updateEconomy(simState)` — advance state one month
- `applyAction(simState, action)` — apply named action to state
- `forecastSurvival(currentState, action, MONTE_CARLO_RUNS = 100, FORECAST_MONTHS = 6)` → `{ survivalProbability, expectedCash }`
- `calculateUtility(result)` → `utility` number
- `ACTIONS` — array of action identifiers
- `chooseBestAction(currentState, monteCarloRuns = 100)` → `action`

Usage examples:

```js
import runSimulation, {
  getDefaultState,
  setDefaultState,
  forecastSurvival,
} from "./script";

console.log(getDefaultState());
setDefaultState({ cash: 20000, inflation: 0.02 });
const hist = runSimulation({ months: 24, monteCarloRuns: 100 });
const f = await forecastSurvival(getDefaultState(), "INVEST", 200, 6);
```

---

## Visualization (`src/App.jsx`)

The React app provides:

- Play / Pause / Step controls to animate month-by-month progression
- Per-month snapshot panel showing the chosen action and numeric values
- Per-action forecast table (survival, expected cash, utility) visible for each step
- Chart with grid lines, y-axis labels, legend toggles, and hover tooltip
- Defaults panel to edit default state values and persist them to localStorage

Recording tips for social media:

- Reduce Monte Carlo runs for smooth frame rate when animating
- Increase font sizes and line widths in `src/index.css` for readability on mobile
- Use the Step control to highlight specific decisions and show per-action forecasts

---

## Performance considerations

- Monte Carlo simulation is CPU-bound. Reduce `monteCarloRuns` or `FORECAST_MONTHS` for faster interactive performance.
- For heavy runs, move forecast computations to a Web Worker or compute results server-side and stream them to the client.

---

## Ideas for extensions

- Offload Monte Carlo work to a Web Worker for responsive UI during heavy computation.
- Add an export feature to capture a chart image or a short animation for sharing.
- Add deterministic testing with a seedable RNG for reproducibility.
- Provide advanced policy options (parameterized rules rather than discrete actions).