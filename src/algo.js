/*******************************************************
 * INFLATION SURVIVAL AI – LEVEL 4
 * -----------------------------------------------------
 * Features:
 * - Stochastic inflation
 * - Investment volatility
 * - Monte Carlo survival forecasting
 * - Utility-based decision making
 *******************************************************/


/***********************
 * 1️⃣ INITIAL STATE
 ***********************/

let state = {
  cash: 10000,          // Available money
  salary: 3000,         // Monthly income
  expenses: 2500,       // Monthly expenses
  inflation: 0.05,      // 5% starting inflation
  investment: 0,        // Invested capital
  happiness: 100        // Optional emotional metric
};

const MONTHS_TO_SIMULATE = 24;
const FORECAST_MONTHS = 6;
const MONTE_CARLO_RUNS = 100;


/***********************
 * 2️⃣ RANDOM NORMAL GENERATOR
 * Box-Muller Transform
 ***********************/
function randomNormal(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std + mean;
}


/***********************
 * 3️⃣ ECONOMY UPDATE
 ***********************/
function updateEconomy(simState) {

  // Inflation shock (small random drift)
  simState.inflation += randomNormal(0, 0.01);

  // Prevent negative inflation for realism
  simState.inflation = Math.max(simState.inflation, 0);

  // Expenses grow with inflation
  simState.expenses *= (1 + simState.inflation);

  // Investment return (volatile market)
  const marketReturn = randomNormal(0.05, 0.1);
  simState.cash += simState.investment * marketReturn;

  // Monthly cash flow
  simState.cash += simState.salary - simState.expenses;
}


/***********************
 * 4️⃣ ACTION DEFINITIONS
 ***********************/
function applyAction(simState, action) {

  switch (action) {

    case "WORK_MORE":
      simState.salary *= 1.10;  // 10% salary increase
      simState.happiness -= 5;
      break;

    case "CUT_EXPENSES":
      simState.expenses *= 0.85;  // Reduce expenses by 15%
      simState.happiness -= 10;
      break;

    case "INVEST":
      const investAmount = simState.cash * 0.3;
      simState.cash -= investAmount;
      simState.investment += investAmount;
      break;

    case "UPS KILL":
      simState.cash -= 1000;      // Cost of upskilling
      simState.salary *= 1.20;    // Future income boost
      break;

    case "DO_NOTHING":
      break;
  }
}


/***********************
 * 5️⃣ MONTE CARLO FORECAST
 ***********************/
function forecastSurvival(currentState, action) {

  let surviveCount = 0;
  let totalCash = 0;

  for (let i = 0; i < MONTE_CARLO_RUNS; i++) {

    // Deep clone state
    let simState = JSON.parse(JSON.stringify(currentState));

    // Apply action before forecasting
    applyAction(simState, action);

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
    expectedCash: totalCash / (surviveCount || 1)
  };
}


/***********************
 * 6️⃣ UTILITY FUNCTION
 ***********************/
function calculateUtility(result) {

  const w1 = 0.6; // survival weight
  const w2 = 0.4; // wealth weight

  return (w1 * result.survivalProbability) +
         (w2 * (result.expectedCash / 10000));
}


/***********************
 * 7️⃣ AI DECISION ENGINE
 ***********************/
function chooseBestAction(currentState) {

  const actions = [
    "WORK_MORE",
    "CUT_EXPENSES",
    "INVEST",
    "UPS KILL",
    "DO_NOTHING"
  ];

  let bestAction = null;
  let bestScore = -Infinity;

  for (let action of actions) {

    const forecast = forecastSurvival(currentState, action);
    const utility = calculateUtility(forecast);

    console.log(`Action: ${action}`);
    console.log(`   Survival Probability: ${(forecast.survivalProbability * 100).toFixed(1)}%`);
    console.log(`   Expected Cash: ${forecast.expectedCash.toFixed(2)}`);
    console.log(`   Utility Score: ${utility.toFixed(3)}\n`);

    if (utility > bestScore) {
      bestScore = utility;
      bestAction = action;
    }
  }

  return bestAction;
}


/***********************
 * 8️⃣ MAIN SIMULATION LOOP
 ***********************/
for (let month = 1; month <= MONTHS_TO_SIMULATE; month++) {

  console.log(`\n=========== MONTH ${month} ===========`);

  const bestAction = chooseBestAction(state);

  console.log(`AI chooses: ${bestAction}\n`);

  applyAction(state, bestAction);
  updateEconomy(state);

  console.log(`Cash: ${state.cash.toFixed(2)}`);
  console.log(`Salary: ${state.salary.toFixed(2)}`);
  console.log(`Expenses: ${state.expenses.toFixed(2)}`);
  console.log(`Inflation: ${(state.inflation * 100).toFixed(2)}%`);

  if (state.cash <= 0) {
    console.log("\n AI WENT BANKRUPT");
    break;
  }
}
