/*
 Simulation module for the browser visualization.
 - Keeps simulation logic separate from `algo.js` so the original file remains unchanged.
 - Exports `runSimulation` which returns a month-by-month history array suitable for plotting.
*/

// Default initial state used when no `initialState` is provided to `runSimulation`.
//
// Lines/fields explained:
// - cash: available liquid cash (currency units)
// - salary: monthly income (currency units)
// - expenses: monthly recurring expenses (currency units)
// - inflation: monthly inflation rate (e.g., 0.05 = 5%)
// - investment: capital currently invested (currency units)
// - happiness: optional emotional metric (arbitrary units, lower = less happy)
//
// You can modify these defaults at runtime using `setDefaultState`, or
// retrieve a deep copy using `getDefaultState`. Use `resetDefaultState()`
// to restore the original values.
export const DEFAULT_STATE = {
  cash: 10000, // available liquid cash
  salary: 3000, // monthly income
  expenses: 2500, // monthly expenses
  inflation: 0.05, // starting inflation rate (5%)
  investment: 0, // invested capital
  happiness: 100, // optional emotional metric
};

// Keep an immutable copy of the original defaults to support reset
const ORIGINAL_DEFAULT_STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));

/**
 * setDefaultState(updates)
 * Merge provided `updates` into the `DEFAULT_STATE` object so new simulations
 * will start from the updated defaults. Example:
 *   setDefaultState({ cash: 20000, inflation: 0.02 })
 */
export function setDefaultState(updates) {
  if (!updates || typeof updates !== "object") return;
  Object.assign(DEFAULT_STATE, updates);
}

/**
 * getDefaultState()
 * Returns a deep copy of the current default state (safe to inspect/modify).
 */
export function getDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

/**
 * resetDefaultState()
 * Restores `DEFAULT_STATE` to the original values present when the module
 * was first loaded.
 */
export function resetDefaultState() {
  // remove any extra keys, then reassign original values
  Object.keys(DEFAULT_STATE).forEach((k) => delete DEFAULT_STATE[k]);
  Object.assign(
    DEFAULT_STATE,
    JSON.parse(JSON.stringify(ORIGINAL_DEFAULT_STATE)),
  );
}

/**
 * DEFAULT_STATE_INFO
 * Human-readable descriptions for each field in `DEFAULT_STATE`.
 */
export const DEFAULT_STATE_INFO = {
  cash: "Available liquid cash (currency units)",
  salary: "Monthly income (currency units)",
  expenses: "Monthly recurring expenses (currency units)",
  inflation: "Monthly inflation rate (e.g., 0.05 = 5%)",
  investment: "Capital currently invested (currency units)",
  happiness: "Optional emotional metric (arbitrary units)",
};

/**
 * randomNormal
 * Returns a normally-distributed random number using the Box–Muller transform.
 * mean: average value, std: standard deviation
 */
function randomNormal(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  // Box–Muller transform -> z0 is ~ N(0,1)
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std + mean;
}

/**
 * updateEconomy(simState)
 * Advances the economic state by one time-step (month):
 * - adds a small random drift to inflation (keeps it non-negative)
 * - grows expenses according to the inflation rate
 * - applies a volatile market return to invested capital
 * - applies net monthly cashflow (salary - expenses)
 */
export function updateEconomy(simState) {
  // small random shock to inflation
  simState.inflation += randomNormal(0, 0.01);
  // realistic floor for inflation
  simState.inflation = Math.max(simState.inflation, 0);

  // expenses scale with inflation
  simState.expenses *= 1 + simState.inflation;

  // investment return (volatile)
  const marketReturn = randomNormal(0.05, 0.1);
  simState.cash += simState.investment * marketReturn;

  // monthly cash flow: salary minus (inflation-adjusted) expenses
  simState.cash += simState.salary - simState.expenses;
}

/**
 * applyAction(simState, action)
 * Mutates the simState according to the chosen action.
 * Actions are simple heuristics (intended to be small, interpretable changes):
 * - WORK_MORE: increase salary at the cost of some happiness
 * - CUT_EXPENSES: reduce expenses but reduce happiness
 * - INVEST: move a fraction of cash into investment
 * - UPS KILL: pay a one-time cost to boost future salary (keeps original naming)
 * - DO_NOTHING: no change
 */
export function applyAction(simState, action) {
  switch (action) {
    case "WORK_MORE":
      // earn more, feel a bit worse
      simState.salary *= 1.1;
      simState.happiness -= 5;
      break;

    case "CUT_EXPENSES":
      // reduce recurring expenses substantially but at an emotional cost
      simState.expenses *= 0.85;
      simState.happiness -= 10;
      break;

    case "INVEST":
      // invest 30% of available cash into the market
      const investAmount = simState.cash * 0.3;
      simState.cash -= investAmount;
      simState.investment += investAmount;
      break;

    case "UPS KILL":
      // pay a one-time upskilling cost to increase salary growth
      simState.cash -= 1000;
      simState.salary *= 1.2;
      break;

    case "DO_NOTHING":
      // intentionally empty
      break;
  }
}

/**
 * forecastSurvival(currentState, action, MONTE_CARLO_RUNS, FORECAST_MONTHS)
 * Runs a Monte Carlo forecast to estimate the chance of "surviving" (cash > 0)
 * after applying `action` and simulating `FORECAST_MONTHS` months.
 * Returns an object with:
 * - survivalProbability: fraction of runs where cash remained > 0
 * - expectedCash: average ending cash across surviving runs (or average over 1 to avoid divide-by-zero)
 */
export function forecastSurvival(
  currentState,
  action,
  MONTE_CARLO_RUNS = 100,
  FORECAST_MONTHS = 6,
) {
  let surviveCount = 0;
  let totalCash = 0;

  for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
    // deep clone to avoid mutating the real state
    let simState = JSON.parse(JSON.stringify(currentState));

    // test taking the action immediately
    applyAction(simState, action);

    // simulate forward for a short horizon and stop early if bankrupt
    for (let m = 0; m < FORECAST_MONTHS; m++) {
      updateEconomy(simState);
      if (simState.cash <= 0) break;
    }

    if (simState.cash > 0) {
      surviveCount++;
      totalCash += simState.cash;
    }
  }

  return {
    survivalProbability: surviveCount / MONTE_CARLO_RUNS,
    expectedCash: totalCash / (surviveCount || 1),
  };
}

/**
 * calculateUtility(result)
 * Combines survival probability and expected cash into a single utility score.
 * Weights (w1,w2) reflect the relative importance of surviving vs. wealth.
 */
export function calculateUtility(result) {
  const w1 = 0.6; // prioritize survival
  const w2 = 0.4; // secondary weight for expected wealth
  return w1 * result.survivalProbability + w2 * (result.expectedCash / 10000);
}

/**
 * chooseBestAction(currentState, monteCarloRuns)
 * Tests each available action with a Monte Carlo forecast and selects the action
 * with the highest expected utility (using `calculateUtility`).
 */
export const ACTIONS = [
  "WORK_MORE",
  "CUT_EXPENSES",
  "INVEST",
  "UPS KILL",
  "DO_NOTHING",
];

export function chooseBestAction(currentState, monteCarloRuns = 100) {
  const actions = ACTIONS;
  let bestAction = null;
  let bestScore = -Infinity;

  for (let action of actions) {
    const forecast = forecastSurvival(currentState, action, monteCarloRuns);
    const utility = calculateUtility(forecast);
    if (utility > bestScore) {
      bestScore = utility;
      bestAction = action;
    }
  }

  return bestAction;
}

/**
 * runSimulation({ months, monteCarloRuns, initialState })
 * Runs the full simulation for `months` steps, choosing an action each month via
 * `chooseBestAction`, applying that action, then updating the economy. Returns an
 * array of monthly snapshots suitable for visualization (month number, action, cash, etc.).
 */
export default function runSimulation({
  months = 24,
  monteCarloRuns = 100,
  initialState,
} = {}) {
  const MONTHS_TO_SIMULATE = months;
  // clone initial state so we don't mutate inputs
  const state = JSON.parse(JSON.stringify(initialState || DEFAULT_STATE));
  const history = [];

  for (let month = 1; month <= MONTHS_TO_SIMULATE; month++) {
    // decide an action based on a short Monte Carlo forecast
    const bestAction = chooseBestAction(state, monteCarloRuns);

    // apply the chosen action and advance the economy one month
    applyAction(state, bestAction);
    updateEconomy(state);

    // record snapshot for visualization
    history.push({
      month,
      action: bestAction,
      cash: state.cash,
      salary: state.salary,
      expenses: state.expenses,
      inflation: state.inflation,
      investment: state.investment,
      happiness: state.happiness,
    });

    // stop early if bankrupt
    if (state.cash <= 0) break;
  }

  return history;
}
