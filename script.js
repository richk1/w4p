/**
 * W-4P Calculator
 * Estimates the federal income tax withholding from periodic pension
 * or annuity payments using the IRS Percentage Method tables.
 *
 * NOTE: This is a simplified estimate. Always verify with IRS Publication 15-T
 * or a qualified tax professional.
 */

// 2024 IRS Percentage Method – standard withholding amounts per pay period
// Source: IRS Publication 15-T (2024), Worksheet 4
const ALLOWANCE_PER_PERIOD = {
  weekly: 103.85,
  biweekly: 207.69,
  semimonthly: 225.00,
  monthly: 450.00,
  quarterly: 1350.00,
  semiannual: 2700.00,
  annual: 5400.00,
};

// 2024 Percentage Method Tables (Married Filing Jointly example)
// Each bracket: [min, max, base_tax, rate, over_amount]
const TAX_BRACKETS = {
  single: [
    [0,        11600,   0,       0.10,  0],
    [11600,    47150,   1160,    0.12,  11600],
    [47150,    100525,  5426,    0.22,  47150],
    [100525,   191950,  17168.5, 0.24,  100525],
    [191950,   243725,  39110.5, 0.32,  191950],
    [243725,   609350,  55678.5, 0.35,  243725],
    [609350,   Infinity,183647.25,0.37, 609350],
  ],
  married: [
    [0,        23200,   0,       0.10,  0],
    [23200,    94300,   2320,    0.12,  23200],
    [94300,    201050,  10852,   0.22,  94300],
    [201050,   383900,  34337,   0.24,  201050],
    [383900,   487450,  78221,   0.32,  383900],
    [487450,   731200,  111357,  0.35,  487450],
    [731200,   Infinity,196669.5,0.37,  731200],
  ],
};

/**
 * Calculate estimated withholding for one pay period.
 *
 * @param {number} grossPayment  - Gross pension/annuity payment for the period
 * @param {string} filingStatus  - "single" | "married"
 * @param {string} payPeriod     - key from ALLOWANCE_PER_PERIOD
 * @param {number} allowances    - Number of withholding allowances claimed
 * @param {number} additionalWH - Extra dollar amount to withhold
 * @returns {object}             - Breakdown of the withholding calculation
 */
function calculateWithholding(grossPayment, filingStatus, payPeriod, allowances, additionalWH) {
  const allowanceValue = ALLOWANCE_PER_PERIOD[payPeriod] ?? 0;
  const totalAllowanceAmt = allowances * allowanceValue;
  const adjustedWage = Math.max(0, grossPayment - totalAllowanceAmt);

  // Annualise the adjusted wage for bracket lookup
  const periodsPerYear = {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
  }[payPeriod] ?? 1;

  const annualizedWage = adjustedWage * periodsPerYear;
  const brackets = TAX_BRACKETS[filingStatus] ?? TAX_BRACKETS.single;

  // Find applicable bracket (brackets are sorted ascending; stop once we pass our wage)
  let annualTax = 0;
  for (const [min, max, baseTax, rate, over] of brackets) {
    if (annualizedWage <= min) break;
    const taxableInBracket = Math.min(annualizedWage, max) - over;
    annualTax = baseTax + taxableInBracket * rate;
  }

  const periodTax = annualTax / periodsPerYear;
  const totalWithholding = periodTax + additionalWH;

  return {
    grossPayment,
    totalAllowanceAmt,
    adjustedWage,
    estimatedTax: periodTax,
    additionalWH,
    totalWithholding: Math.max(0, totalWithholding),
  };
}

/** Format a number as USD currency */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/** Populate the results section with calculated values */
function showResults(result) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('res-gross', formatCurrency(result.grossPayment));
  set('res-allowances', formatCurrency(result.totalAllowanceAmt));
  set('res-adjusted', formatCurrency(result.adjustedWage));
  set('res-estimated-tax', formatCurrency(result.estimatedTax));
  set('res-additional', formatCurrency(result.additionalWH));
  set('res-total', formatCurrency(result.totalWithholding));

  const resultsSection = document.getElementById('results');
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/** Handle form submission */
function handleSubmit(event) {
  event.preventDefault();

  const grossPayment  = parseFloat(document.getElementById('gross-payment').value) || 0;
  const filingStatus  = document.getElementById('filing-status').value;
  const payPeriod     = document.getElementById('pay-period').value;
  const allowances    = parseInt(document.getElementById('allowances').value, 10) || 0;
  const additionalWH  = parseFloat(document.getElementById('additional-wh').value) || 0;

  const result = calculateWithholding(grossPayment, filingStatus, payPeriod, allowances, additionalWH);
  showResults(result);
}

/** Wire up event listeners once the DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('w4p-form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
});
