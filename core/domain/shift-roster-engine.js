'use strict';
// موتور چیدمان هوشمند شیفت (ShiftYar Logic adapted for NABZ)
const { calcMandatoryHours, getShiftHours } = require('./shift-calculator');

const SHIFTS = ['off', 'morning', 'evening', 'night', 'long', 'evening-night', 'full-day'];
const NIGHT_SHIFTS = ['night', 'evening-night', 'full-day'];

// تابع ارزیابی هزینه (Cost Function) برای الگوریتم بهینه‌سازی
function evaluateCost(grid, staff, rules, requests, days) {
  let cost = 0;
  const stats = staff.map(() => ({ h: 0, nights: 0, consec: 0, consecNights: 0 }));

  for (let d = 0; d < days; d++) {
    const coverage = { M: 0, E: 0, N: 0 };
    for (let i = 0; i < staff.length; i++) {
      const shift = grid[i][d];
      if (shift === 'off') { stats[i].consec = 0; stats[i].consecNights = 0; continue; }
      
      if (shift === 'morning' || shift === 'long' || shift === 'full-day') coverage.M++;
      if (shift === 'evening' || shift === 'long' || shift === 'evening-night' || shift === 'full-day') coverage.E++;
      if (shift === 'night' || shift === 'evening-night' || shift === 'full-day') coverage.N++;

      stats[i].h += 8; // میانگین ساعت کاری برای محاسبه سریع
      if (NIGHT_SHIFTS.includes(shift)) {
        stats[i].nights++;
        stats[i].consecNights++;
        if (stats[i].consecNights > rules.maxConsecNights) cost += 1000;
      } else {
        stats[i].consecNights = 0;
      }
      stats[i].consec++;
      if (stats[i].consec > rules.maxConsec) cost += 500;

      const req = requests[i] && requests[i][d];
      if (req && req !== shift) cost += 50;
    }
    if (coverage.M < rules.minM) cost += (rules.minM - coverage.M) * 200;
    if (coverage.E < rules.minE) cost += (rules.minE - coverage.E) * 200;
    if (coverage.N < rules.minN) cost += (rules.minN - coverage.N) * 300;
  }
  return cost;
}

// الگوریتم Simulated Annealing برای چیدمان بهینه
async function optimizeRoster(initialGrid, staff, rules, requests, days, iterations = 3000) {
  let currentGrid = initialGrid.map(row => [...row]);
  let currentCost = evaluateCost(currentGrid, staff, rules, requests, days);
  let bestGrid = currentGrid.map(row => [...row]);
  let bestCost = currentCost;
  let temperature = 50;
  const coolingRate = 0.995;

  const freeList = [];
  for (let i = 0; i < staff.length; i++) {
    for (let d = 0; d < days; d++) {
      if (!staff[i].locked || !staff[i].locked[d]) freeList.push(i * days + d);
    }
  }

  for (let it = 0; it < iterations; it++) {
    const temp = temperature * Math.pow(coolingRate, it / iterations);
    const c = freeList[Math.floor(Math.random() * freeList.length)];
    const i = Math.floor(c / days);
    const d = c % days;
    
    const oldShift = currentGrid[i][d];
    const newShift = SHIFTS[Math.floor(Math.random() * SHIFTS.length)];
    if (oldShift === newShift) continue;

    currentGrid[i][d] = newShift;
    const newCost = evaluateCost(currentGrid, staff, rules, requests, days);

    if (newCost < currentCost || Math.random() < Math.exp((currentCost - newCost) / temp)) {
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
  return { grid: bestGrid, cost: bestCost };
}

module.exports = { SHIFTS, evaluateCost, optimizeRoster };
