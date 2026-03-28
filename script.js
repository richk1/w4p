// Client-side implementation of Pub 15-T Worksheet 1-B (W-4P withholding calculator).

import { computeWorksheet } from './withholding-calc.js'; 

(() => {
  'use strict';

  // Map of payroll periods to number of payments per year
  const PeriodDict = { monthly: 12, semimonthly: 24, biweekly: 26, weekly: 52, daily: 260 };

  // Helper DOM and formatting functions ------------------------------------------------

  // Short helper to get element by id. Returns null when not found.
  function el(id) { return document.getElementById(id); }

  // Convert input to a number, treat invalid as 0.
  function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  // Format a number as USD currency string.
  function currency(v) { return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }

  // Pad a string to the right (fallback for older browsers).
  function padRight(s, len) {
    s = String(s);
    if (typeof s.padEnd === 'function') return s.padEnd(len);
    const fill = len - s.length;
    return fill > 0 ? s + Array(fill + 1).join(' ') : s;
  }

  // UI utilities -----------------------------------------------------------------------

  // Resize a textarea to fit its content.
  function autosizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
  function scheduleAutosize(textarea) {
    if (!textarea) return;
    // If rAF is available, schedule a read/write in the next frame.
    // This prevents forced layout during DOMContentLoaded when styles may not be applied yet.
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => autosizeTextarea(textarea));
    } else {
      // fallback
      setTimeout(() => autosizeTextarea(textarea), 0);
    }
  }

  // Input validation helpers for dollar/cents inputs -----------------------------------

  function sanitizeNumberString(s) {
    if (s === undefined || s === null) return '';
    return String(s).trim().replace(/,/g, '');
  }

  // Accepts: "123", "123.4", "123.45", ".50"
  function isValidDollarAmountString(s) {
    s = sanitizeNumberString(s);
    return /^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(s);
  }

  // Visual invalid marker for inputs (adds class and inline style).
  function markInvalid(elm, invalid) {
    if (!elm) return;
    if (invalid) {
      elm.classList.add('invalid-input');
      elm.style.border = '1px solid #d33';
      elm.title = 'Enter a non-negative dollar amount (dollars and optional cents, up to 2 decimals)';
    } else {
      elm.classList.remove('invalid-input');
      elm.style.border = '';
      elm.title = '';
    }
  }

  // Parses a currency input by element id. Returns numeric value or null when invalid.
  function parseCurrencyInputById(id) {
    const input = el(id);
    if (!input) return null;
    const raw = input.value;
    const s = sanitizeNumberString(raw);
    if (!isValidDollarAmountString(s)) {
      markInvalid(input, true);
      return null;
    }
    markInvalid(input, false);
    return parseFloat(s);
  }

  // UI wiring and event handlers -------------------------------------------------------

  function init() {
    const hasW4P = el('hasW4P');
    const w4pPanel = el('w4pPanel');
    const noW4pPanel = el('noW4pPanel');
    const worksheetTA = el('worksheetTA');
    const computeBtn = el('computeBtn');

    if (!hasW4P || !computeBtn) {
      console.warn('Required UI elements missing; initialization aborted.');
      return;
    }

    // Toggle panels when the "Has W-4P" checkbox changes
    hasW4P.addEventListener('change', () => {
      if (hasW4P.checked) {
        w4pPanel?.classList.remove('hidden');
        noW4pPanel?.classList.add('hidden');
      } else {
        w4pPanel?.classList.add('hidden');
        noW4pPanel?.classList.remove('hidden');
      }
      // clear validation markers when toggling
      ['w4p_2b3', 'w4p_3', 'w4p_4a', 'w4p_4b', 'w4p_4c'].forEach(id => {
        const i = el(id); if (i) markInvalid(i, false);
      });
    });

    if (worksheetTA) {
      worksheetTA.addEventListener('input', () => autosizeTextarea(worksheetTA));
      // scheduleAutosize to avoid forcing layout during load / stylesheet parsing
      scheduleAutosize(worksheetTA);
    }

    computeBtn.addEventListener('click', () => {
      try {
        const taxYear = toNumber(el('taxYear')?.value);
        const filingStatus = el('filingStatus')?.value || 'Single';
        const periodKey = el('period')?.value || 'monthly';
        const paymentsPerYear = PeriodDict[periodKey] || 12;
        const paymentAmount = toNumber(el('paymentAmount')?.value);

        let w4p = null;
        let allowances = 0;

        if (hasW4P.checked) {
          // Validate W-4P dollar/cents inputs
          const fieldIds = ['w4p_2b3', 'w4p_3', 'w4p_4a', 'w4p_4b', 'w4p_4c'];
          const parsed = {};
          const invalidFields = [];
          fieldIds.forEach(id => {
            const val = parseCurrencyInputById(id);
            if (val === null) invalidFields.push(id);
            else parsed[id] = val;
          });

          if (invalidFields.length > 0) {
            const friendly = invalidFields.map(id => {
              if (id === 'w4p_2b3') return '2.b3 Other earned/pension income';
              if (id === 'w4p_3') return '3. Credits';
              if (id === 'w4p_4a') return '4.a Other income';
              if (id === 'w4p_4b') return '4.b Deductions';
              if (id === 'w4p_4c') return '4.c Extra withholding';
              return id;
            }).join(', ');
            alert('Please correct the following W-4P fields to be valid dollar amounts (dollars and optional cents): ' + friendly);
            return;
          }

          w4p = {
            FilingStatus: filingStatus,
            OtherEarnedOrPensionIncome: parsed['w4p_2b3'] || 0,
            Credits: parsed['w4p_3'] || 0,
            OtherIncome: parsed['w4p_4a'] || 0,
            Deductions: parsed['w4p_4b'] || 0,
            ExtraWithholding: parsed['w4p_4c'] || 0
          };
        } else {
          allowances = parseInt(el('allowances')?.value) || 0;
        }

        const opts = {
          taxYear,
          filingStatus,
          paymentsPerYear,
          paymentAmount,
          w4p,
          allowancesClaimed: allowances
        };

        const result = computeWorksheet(opts);
        if (worksheetTA) {
          worksheetTA.value = result.text;
          scheduleAutosize(worksheetTA);
        }
        const withholdingAmountEl = el('withholdingAmount');
        if (withholdingAmountEl) withholdingAmountEl.textContent = currency(result.L4c);
      } catch (err) {
        // Keep user-facing error simple; log full error for diagnostics.
        console.error('Computation error', err);
        alert('Failed to compute: ' + (err && err.message ? err.message : String(err)));
      }
    });

    // set initial UI state
    hasW4P.dispatchEvent(new Event('change'));
  }

  document.addEventListener('DOMContentLoaded', init);
})();