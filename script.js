
/***********************
 * INITIAL STATE
 ***********************/
let state = {
  cash: 10000,
  salary: 3000,
  expenses: 2500,
  inflation: 0.05,
  investment: 0
};

const FORECAST_MONTHS = 6;
const MONTE_CARLO_RUNS = 60;

let month = 0;
let running = false;
let history = [];


/***********************
 * RANDOM NORMAL (Box-Muller)
 ***********************/
function randomNormal(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std + mean;
}


/***********************
 * ECONOMY UPDATE
 ***********************/
function updateEconomy(simState) {
  simState.inflation += randomNormal(0, 0.01);
  simState.inflation = Math.max(simState.inflation, 0);

  simState.expenses *= (1 + simState.inflation);

  const marketReturn = randomNormal(0.05, 0.1);
  simState.cash += simState.investment * marketReturn;

  simState.cash += simState.salary - simState.expenses;
}


/***********************
 * ACTIONS
 ***********************/
function applyAction(simState, action) {

  switch (action) {

    case "WORK":
      simState.salary *= 1.1;
      break;

    case "CUT":
      simState.expenses *= 0.85;
      break;

    case "INVEST":
      const amount = simState.cash * 0.3;
      simState.cash -= amount;
      simState.investment += amount;
      break;

    case "NONE":
      break;
  }
}


/***********************
 * MONTE CARLO FORECAST
 ***********************/
function forecast(currentState, action) {

  let surviveCount = 0;

  for (let i = 0; i < MONTE_CARLO_RUNS; i++) {

    let sim = JSON.parse(JSON.stringify(currentState));
    applyAction(sim, action);

    for (let m = 0; m < FORECAST_MONTHS; m++) {
      updateEconomy(sim);
      if (sim.cash <= 0) break;
    }

    if (sim.cash > 0) surviveCount++;
  }

  return surviveCount / MONTE_CARLO_RUNS;
}


/***********************
 * AI DECISION
 ***********************/
function chooseAction() {

  const actions = ["WORK", "CUT", "INVEST", "NONE"];

  let bestAction = "NONE";
  let bestScore = -Infinity;

  for (let action of actions) {

    const survivalProb = forecast(state, action);

    // Utility: survival weighted + mild wealth incentive
    const utility = 0.7 * survivalProb + 0.3 * (state.cash / 10000);

    if (utility > bestScore) {
      bestScore = utility;
      bestAction = action;
    }
  }

  return bestAction;
}


/***********************
 * DRAW GRAPH
 ***********************/
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

function drawChart() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.moveTo(0, canvas.height - history[0] / 50);

  for (let i = 0; i < history.length; i++) {
    ctx.lineTo(i * 30, canvas.height - history[i] / 50);
  }

  ctx.stroke();
}


/***********************
 * UPDATE UI
 ***********************/
function updateStats(action) {
  document.getElementById("stats").innerHTML = `
    <strong>Month:</strong> ${month} <br>
    <strong>Action:</strong> ${action} <br>
    <strong>Cash:</strong> ${state.cash.toFixed(2)} <br>
    <strong>Salary:</strong> ${state.salary.toFixed(2)} <br>
    <strong>Expenses:</strong> ${state.expenses.toFixed(2)} <br>
    <strong>Inflation:</strong> ${(state.inflation * 100).toFixed(2)}%
  `;
}


/***********************
 * MAIN LOOP
 ***********************/
function step() {

  if (!running) return;

  month++;

  const action = chooseAction();
  applyAction(state, action);
  updateEconomy(state);

  history.push(state.cash);
  drawChart();
  updateStats(action);

  if (state.cash <= 0) {
    running = false;
    alert("AI WENT BANKRUPT");
  } else {
    setTimeout(step, 1000);
  }
}


/***********************
 * START
 ***********************/
function startSimulation() {
  if (!running) {
    running = true;
    step();
  }
}