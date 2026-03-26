// Pure calculation module for Pub 15-T Worksheet 1-B (W-4P).
// No DOM interactions — suitable for unit tests.
// Imports withholding tables from `withholding-tables.js`.

import WithholdingTables from './withholding-tables.js';

// Round toward zero to N decimals (mimic MidpointRounding.ToZero)
export function roundTowardZero(value, decimals) {
  const f = Math.pow(10, decimals);
  return value >= 0 ? Math.floor(value * f) / f : Math.ceil(value * f) / f;
}

// Map filing status and tax year to a withholding table object
export function getWithholdingTable(filingStatus, taxYear) {
  let tables = WithholdingTables[taxYear];
  if (!tables) {
    // Fall back to most recent available (2026) for demo/test purposes
    tables = WithholdingTables[2026];
  }

  // Map legacy statuses
  if (filingStatus === 'MarriedFilingSeparately') filingStatus = 'Single';
  if (filingStatus === 'QualifyingWidow') filingStatus = 'MarriedFilingJointly';

  if (filingStatus === 'MarriedFilingJointly') return tables.MarriedFilingJointly;
  if (filingStatus === 'HeadOfHousehold') return tables.HeadOfHousehold;
  return tables.Single;
}

// Given a table and an annual income, return bracket base, base tax and marginal rate
export function getRateInfo(table, income) {
  const n = table.bracketMin.length - 1;
  for (let i = 0; i < n; i++) {
    if (income < table.bracketMin[i + 1]) {
      return {
        incomeBase: table.bracketMin[i],
        incomeLimit: table.bracketMin[i + 1],
        baseTax: table.baseTax[i],
        marginalRate: table.rate[i]
      };
    }
  }
  return {
    incomeBase: table.bracketMin[n],
    incomeLimit: Infinity,
    baseTax: table.baseTax[n],
    marginalRate: table.rate[n]
  };
}

// Align label/value pairs into a readable fixed-width block (pure string formatter)
export function formatEntries(entries) {
  const lines = [];
  const valueWidth = 12;
  const numericLike = s => /^[\s\-]?\d*[\.,]?\d+%?$/.test(s);

  for (const [label, value] of entries) {
    if (label === "" && value === null) { lines.push(''); continue; }
    if (label === "") { lines.push(String(value)); continue; }

    let s = (value === null || value === undefined) ? '' : (typeof value === 'number' ? value.toFixed(2) : String(value));
    if (s && numericLike(s)) s = s.padStart(valueWidth);
    lines.push(label.padEnd(60) + ' ' + s);
  }
  return lines.join('\n');
}

/**
 * computeWorksheet(opts)
 * - opts: {
 *     taxYear: number,
 *     filingStatus: string,
 *     paymentsPerYear: number,
 *     paymentAmount: number,
 *     w4p: null | { FilingStatus, OtherEarnedOrPensionIncome, Credits, OtherIncome, Deductions, ExtraWithholding },
 *     allowancesClaimed: number
 *   }
 *
 * Returns: { text: string, L4c: number, L4a: number }
 */
export function computeWorksheet(opts) {
  const taxYear = opts.taxYear;
  const filingStatus = opts.filingStatus === 'MarriedFilingSeparately' ? 'Single' : opts.filingStatus;
  const table = getWithholdingTable(opts.filingStatus, taxYear);

  // W-4P inputs (normalized)
  const W4P_2B3 = opts.w4p?.OtherEarnedOrPensionIncome ?? 0;
  const W4P_3   = opts.w4p?.Credits ?? 0;
  const W4P_4a  = opts.w4p?.OtherIncome ?? 0;
  const W4P_4b  = opts.w4p?.Deductions ?? 0;
  const W4P_4c  = opts.w4p?.ExtraWithholding ?? 0;

  // Step 1: annualize payment and compute adjusted annual payment
  const L1a = opts.paymentAmount;
  const L1b = opts.paymentsPerYear;
  const L1c = L1a * L1b;

  let L1d = 0, L1e = 0, L1f = 0, L1g = 0, L1h = 0, L1i = 0;
  let L1j = 0, L1k = 0, L1l = 0;

  if (opts.w4p) {
    L1d = W4P_4a;
    L1e = L1d + L1c;
    L1f = W4P_4b;
    L1g = (opts.w4p.FilingStatus === 'Single') ? 8600 : 12900;
    L1h = L1f + L1g;
    L1i = Math.max(0, L1e - L1h);
  } else {
    L1j = opts.allowancesClaimed;
    L1k = 4300 * L1j;
    L1l = Math.max(0, L1c - L1k);
  }

  // Step 2: Tentative annual withholding amount (Parts I & II)
  const doPart2 = !!opts.w4p && W4P_2B3 > 0;

  let L2a = 0, L2b = 0, L2c = 0, L2d = 0;
  if (doPart2) {
    L2a = W4P_2B3;
    L2b = (opts.w4p.FilingStatus === 'Single') ? 8600 : 12900;
    L2c = Math.max(0, L2a - L2b);
  } else {
    L2d = Math.max(0, Math.max(L1i, L1l));
  }

  const aapa = Math.max(L2c, L2d);
  const ri = getRateInfo(table, aapa);
  const L2e = ri.incomeBase;
  const L2f = ri.baseTax;
  const L2g = ri.marginalRate;
  const L2h = aapa - L2e;
  const L2i = L2h * L2g;
  const L2j = L2f + L2i;

  // Part II (if applicable)
  let L2k = 0, L2l = 0, L2m = 0, L2n = 0, L2o = 0, L2p = 0, L2q = 0, L2r = 0, L2s = 0, L2t = 0;
  if (doPart2) {
    L2k = W4P_2B3;
    L2l = L1i;
    L2m = Math.max(0, L2k + L2l);
    const ri2 = getRateInfo(table, L2m);
    L2n = ri2.incomeBase;
    L2o = ri2.baseTax;
    L2p = ri2.marginalRate;
    L2q = L2m - L2n;
    L2r = L2q * L2p;
    L2s = L2o + L2r;
    L2t = Math.max(0, L2s - L2j);
  }

  const L2u = (W4P_2B3 > 0) ? L2t : L2j;

  // Step 3: credits
  const L3a = W4P_3;
  const L3b = Math.max(0, L2u - L3a);

  // Step 4: final per-period withholding
  const L4a = roundTowardZero(L3b / L1b, 2);
  const L4b = W4P_4c;
  const L4c = L4a + L4b;

  // Build nicely formatted output (string) for display / tests
  const entries = [
    ["", `${taxYear} Pub 15-T Worksheet 1-B (Form W-4P Calculator)`],
    ["", null],
    ["", "Form W-4P Info"],
    ["Filing Status:", opts.filingStatus],
    ["2.B3 Other earned or pension income", W4P_2B3],
    ["3.   Credits", L3a],
    ["4.a  Other income", W4P_4a],
    ["4.b  Deductions", L4b === undefined ? L4b : L1f], // preserve original labels (L1f was deductions)
    ["4.c  Extra withholding per payment", W4P_4c],
    ["", null],
    ["", "Pub 15-T Worksheet 1B"],
    ["", "Step 1. Adjust the payee's payment amount"],
    ["1.a  Payment received per period", L1a],
    ["1.b  Number of payments per year", L1b],
    ["1.c  Total Yearly payment", L1c],
    ["", null],
    ["1.d  Other income (line 4a of W-4P)", L1d],
    ["1.e  Add lines 1c and 1d", L1e],
    ["1.f  Deductions (line 4b of W-4P)", L1f],
    ["1.g  Filing status adjustment amount", L1g],
    ["1.h  Add lines 1f and 1g", L1h],
    ["1.i  Adjusted Annual Payment Amount (L1e - L1h)", L1i],
    ["", null],
    ["", "If using pre-2022 W-4P form"],
    ["1.j  Allowances claimed on most recent (pre-2022) W-4P", L1j],
    ["1.k  Allowance amount (line 1j x $4,300)", L1k],
    ["1.l  Adjusted Annual Payment Amount (line 1c - line 1k)", L1l],
    ["", null],
    ["", "Step 2. Figure the Tentative Annual Withholding Amount"],
    ["", "Part I"],
    ["2.a  Other earned or pension income (line 2B3 of W-4P)", L2a],
    ["2.b  Filing status adjustment amount", L2b],
    ["2.c  L2a - L2b", L2c],
    ["2.d  Adjusted annual payment amount", L2d],
    ["2.e  Base income amount from the tax table", L2e],
    ["2.f  Base tax amount from the tax table", L2f],
    ["2.g  Marginal tax rate from the tax table", (L2g * 100).toFixed(2) + '%'],
    ["2.h  Excess income", L2h],
    ["2.i  Tax on excess income", L2i],
    ["2.j  Tentative annual withholding amount", L2j],
    ["", null],
    ["", "Part II"],
    ["2.k  Other earned or pension income (line 2B3 of W-4P)", L2k],
    ["2.l  Adjusted annual payment amount", L2l],
    ["2.m  L2k + L2l", L2m],
    ["2.n  Base income amount from the tax table", L2n],
    ["2.o  Base tax amount from the tax table", L2o],
    ["2.p  Marginal tax rate from the tax table", (L2p * 100).toFixed(2) + '%'],
    ["2.q  Excess income", L2q],
    ["2.r  Tax on excess income", L2r],
    ["2.s  Tentative annual withholding amount", L2s],
    ["2.t  Tax in excess of that owed on other job/pension", L2t],
    ["", null],
    ["", "Part III (choose Tentative AWA)"],
    ["2.u  Tentative annual withholding amount", L2u],
    ["", null],
    ["", "Step 3. Account for tax credits"],
    ["3.a  Credits from line 3 of W-4P", L3a],
    ["3.b  Adjusted for tax credits", L3b],
    ["", null],
    ["", "Step 4. Figure the final amount to withhold"],
    ["4.a  Tentative Withholding per period", L4a],
    ["4.b  Extra withholding per payment from line 4c of W-4P", L4b],
    ["4.c  Final withholding per period.", L4c]
  ];

  return { text: formatEntries(entries), L4c, L4a };
}