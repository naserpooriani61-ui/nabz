'use strict';
// NABZ Intelligent Shift Planner Engine (Adapted from ShiftYar)
const T = ['off', 'morning', 'evening', 'night', 'long', 'evening-night', 'full-day'];
const TI = {}; T.forEach((t, i) => (TI[t] = i));
const WORKI = new Uint8Array([0, 1, 1, 1, 1, 1, 1]);
const NIGHTI = new Uint8Array([0, 0, 0, 1, 0, 1, 1]);
const COV = new Uint8Array([0, 1, 2, 4, 3, 6, 7]); // M=1, E=2, N=4

function rng(seed) {
  let a = seed >>> 0 || 1;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function evaluateCost(grid, staff, rules, requests, days) {
  let cost = 0;
  const stats = staff.map(() => ({ h: 0, nights: 0, consec: 0, consecNights: 0 }));
  for (let d = 0; d < days; d++) {
    const coverage = { M: 0, E: 0, N: 0 };
    for (let i = 0; i < staff.length; i++) {
      const shift = grid[i][d];
      if (shift === 0) { stats[i].consec = 0; stats[i].consecNights = 0; continue; }
      if (COV[shift] & 1) coverage.M++;
      if (COV[shift] & 2) coverage.E++;
      if (COV[shift] & 4) coverage.N++;
      
      stats[i].h += 8; // Simplified hours for cost calculation
      if (NIGHTI[shift]) {
        stats[i].nights++;
        stats[i].consecNights++;
        if (stats[i].consecNights > rules.maxConsecNights) cost += 1000;
      } else {
        stats[i].consecNights = 0;
      }
      stats[i].consec++;
      if (stats[i].consec > rules.maxConsec) cost += 500;

      const req = requests[i] && requests[i][d];
      if (req >= 0 && req !== shift) cost += 50;
    }
    if (coverage.M < rules.minM) cost += (rules.minM - coverage.M) * 200;
    if (coverage.E < rules.minE) cost += (rules.minE - coverage.E) * 200;
    if (coverage.N < rules.minN) cost += (rules.minN - coverage.N) * 300;
  }
  return cost;
}

async function optimize(initialGrid, staff, rules, requests, days, iterations = 3000) {
  let currentGrid = initialGrid.map(row => [...row]);
  let currentCost = evaluateCost(currentGrid, staff, rules, requests, days);
  let bestGrid = currentGrid.map(row => [...row]);
  let bestCost = currentCost;
  let temperature = 50;
  const coolingRate = 0.995;
  const rnd = rng(Date.now());

  const freeList = [];
  for (let i = 0; i < staff.length; i++) {
    for (let d = 0; d < days; d++) {
      if (!staff[i].locked || !staff[i].locked[d]) freeList.push(i * days + d);
    }
  }

  for (let it = 0; it < iterations; it++) {
    const temp = temperature * Math.pow(coolingRate, it / iterations);
    const c = freeList[Math.floor(rnd() * freeList.length)];
    const i = Math.floor(c / days);
    const d = c % days;
    
    const oldShift = currentGrid[i][d];
    const newShift = Math.floor(rnd() * T.length);
    if (oldShift === newShift) continue;

    currentGrid[i][d] = newShift;
    const newCost = evaluateCost(currentGrid, staff, rules, requests, days);

    if (newCost < currentCost || rnd() < Math.exp((currentCost - newCost) / temp)) {
      currentCost = newCost;
      if (newCost < bestCost) {
        bestCost = newCost;
        bestGrid = currentGrid.map(row => [...row]);
      }
    } else {
      currentGrid[i][d] = oldShift;
    }
    
    if (it % 500 === 0) await new Promise(resolve => setImmediate(resolve));
  }
  return { grid: bestGrid.map(row => row.map(idx => T[idx])), cost: bestCost };
}

module.exports = { optimize, T };
