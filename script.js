// Minimal client-side port of Worksheet1B logic (2026 withholding tables embedded).
(() => {
  // Map of periods
  const PeriodDict = { monthly:12, semimonthly:24, biweekly:26, weekly:52, daily:260 };

  // Pre-built withholding tables for 2026 (derived from the project's C# commented tables)
  const WithholdingTables2026 = {
    Single: {
      bracketMin: [0,7500,19900,57900,113200,209275,263725,648100],
      baseTax:   [0,0,1240,5800,17966,41024,58448,192979.25],
      rate:      [0,0.10,0.12,0.22,0.24,0.32,0.35,0.37]
    },
    MarriedFilingJointly: {
      bracketMin: [0,19300,44100,120100,230700,422850,531750,788000],
      baseTax:   [0,0,2480,11600,35932,82048,116896,206583.50],
      rate:      [0,0.10,0.12,0.22,0.24,0.32,0.35,0.37]
    },
    HeadOfHousehold: {
      bracketMin: [0,15550,33250,83000,121250,217300,271750,656150],
      baseTax:   [0,0,1770,7740,16155,39207,56631,191171],
      rate:      [0,0.10,0.12,0.22,0.24,0.32,0.35,0.37]
    }
  };

  const WithholdingTables2025 = {
    Single: {
     bracketMin: [0, 6400, 18325, 54875, 109750, 203700, 256925, 632750],
     baseTax: [0, 0, 1192.50, 5578.50, 17651.00, 40199.00, 57231.00, 188769.75],
     rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    },
    MarriedFilingJointly: {
      bracketMin: [0, 17100, 40950, 114050, 223800, 411700, 518150, 768700],
      baseTax: [0, 0, 2385.00, 11157.00, 35302.00, 80398.00, 114462.00, 202154.50],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    },
    HeadOfHousehold: {
      bracketMin: [0, 13900, 30900, 78750, 117250, 211200, 264400, 640250],
      baseTax: [0, 0, 1700.00, 7442.00, 15912.00, 38460.00, 55484.00, 187031.50],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    }
  };
  const WithholdingTables2024 = {
    Single: {
      bracketin: [0, 6000, 17600, 53150, 106525, 197950, 249725, 615350],
      baseTax: [0, 0, 1160, 5426, 17168.50, 39110.50, 55678.50, 183647.25],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    },
    MarriedFilingJointly: {
      bracketMin: [0, 16300, 39500, 110600, 217350, 400200, 503750, 747500],
      baseTax: [0, 0, 2320.00, 10852.00, 34337.00, 78221.00, 111357.00, 196669.50],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    },
    HeadOfHousehold: {
      bracketMin: [0, 13300, 29850, 76400, 113800, 205250, 257000, 622650],
      baseTax: [0, 0, 1655.00, 7241.00, 15469.00, 37417.00, 53977.00, 181954.50],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    }
  };
  const WithholdingTables2023 = {
    Single: {
      bracketin: [0, 5250, 16250, 49975, 100625, 187350, 236500, 583375],
      baseTax: [0, 0, 1100, 5147, 16290, 37104, 52832, 174238.25],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    },
    MarriedFilingJointly: {
      bracketMin: [0, 14800, 36800, 104250, 205550, 379000, 477300, 708550],
      baseTax: [0, 0, 2200, 10294, 32580, 74208, 105664, 186601.50],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    },
    HeadOfHousehold: {
      bracketMin: [0, 12200, 27900, 72050, 107550, 194300, 243450, 590300],
      baseTax: [0, 0, 1570, 6868, 14678, 35498, 51226, 172623.50],
      rate: [0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
    }
  };

  // Helpers
  function el(id){ return document.getElementById(id); }
  function toNumber(v){ return Number(v) || 0; }
  function currency(v){ return v.toLocaleString(undefined, {style:'currency', currency:'USD', minimumFractionDigits:2}); }
  function padRight(s, len){
    s = String(s);
    if (typeof s.padEnd === 'function') return s.padEnd(len);
    const fill = len - s.length;
    return fill > 0 ? s + Array(fill + 1).join(' ') : s;
  }

  // Round toward zero to N decimals (mimic MidpointRounding.ToZero)
  function roundTowardZero(value, decimals){
    const f = Math.pow(10, decimals);
    if (value >= 0) return Math.floor(value * f) / f;
    return Math.ceil(value * f) / f;
  }

  // Get withholding table for a filing status (map MFS -> Single, QualifyingWidow -> MFJ)
  function getWithholdingTable(filingStatus, taxYear){
    let tables;
    if (taxYear === 2023) tables = WithholdingTables2023;
    else if (taxYear === 2024) tables = WithholdingTables2024;
    else if (taxYear === 2025) tables = WithholdingTables2025;
    else if (taxYear === 2026) tables = WithholdingTables2026;
    else {
      // Fallback: use 2026 tables for other years in this demo
      console.warn('Using 2026 tables as fallback for year', taxYear);
      alert('No tables for year ' + taxYear + ', using 2026 tables as fallback.');
      tables = WithholdingTables2026;
    }

    if (filingStatus === 'MarriedFilingSeparately') filingStatus = 'Single';
    if (filingStatus === 'QualifyingWidow') filingStatus = 'MarriedFilingJointly';

    if (filingStatus === 'MarriedFilingJointly') return tables.MarriedFilingJointly;
    if (filingStatus === 'HeadOfHousehold') return tables.HeadOfHousehold;
    return tables.Single;
  }

  // Equivalent of TaxWithholdingTable.GetRateInfo
  function getRateInfo(table, income){
    const n = table.bracketMin.length - 1;
    for (let i = 0; i < n; i++){
      if (income < table.bracketMin[i+1]) {
        return { incomeBase: table.bracketMin[i], incomeLimit: table.bracketMin[i+1], baseTax: table.baseTax[i], marginalRate: table.rate[i] };
      }
    }
    return { incomeBase: table.bracketMin[n], incomeLimit: Infinity, baseTax: table.baseTax[n], marginalRate: table.rate[n] };
  }

  // Reformat the line entries (label,value) into a text block with right-aligned values and left-aligned labels
  function formatEntries(entries){
    const lines = [];
    const valueWidth = 12;
	const numericLike = s => /^[\s\-]?\d*[\.,]?\d+%?$/.test(s);
    //const numericLike = s => /^[\s\-]?[0-9\.,]+%?$/.test(s);

    for (const [label, value] of entries){
      if (label === "" && value === null){ lines.push(''); continue; }
      if (label === "" ) { lines.push(String(value)); continue; }

      let s = (value === null || value === undefined) ? '' : (typeof value === 'number' ? value.toFixed(2) : String(value));
      if (s && numericLike(s)) s = s.padStart(valueWidth);
      lines.push(label.padEnd(60) + ' ' + s);
    }
    return lines.join('\n');
  }

  // Fill out the pub 15-T Worksheet 1B
  function computeWorksheet(opts){
    const taxYear = opts.taxYear;
    const filingStatus = opts.filingStatus === 'MarriedFilingSeparately' ? 'Single' : opts.filingStatus;
    const table = getWithholdingTable(opts.filingStatus, taxYear);

    // W4P fields
    const W4P_2B3 = opts.w4p?.OtherEarnedOrPensionIncome ?? 0;
    const W4P_3 = opts.w4p?.Credits ?? 0;
    const W4P_4a = opts.w4p?.OtherIncome ?? 0;
    const W4P_4b = opts.w4p?.Deductions ?? 0;
    const W4P_4c = opts.w4p?.ExtraWithholding ?? 0;

    // Step 1
    const L1a = opts.paymentAmount;
    const L1b = opts.paymentsPerYear;
    const L1c = L1a * L1b;

    let L1d=0, L1e=0, L1f=0, L1g=0, L1h=0, L1i=0;
    let L1j=0, L1k=0, L1l=0;
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

    // Step 2
    const doPart2 = !!opts.w4p && W4P_2B3 > 0;

    let L2a=0,L2b=0,L2c=0,L2d=0;
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

    // Part II
    let L2k=0,L2l=0,L2m=0,L2n=0,L2o=0,L2p=0,L2q=0,L2r=0,L2s=0,L2t=0;
    if (doPart2){
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

    // Step 3
    const L3a = W4P_3;
    const L3b = Math.max(0, L2u - L3a);

    // Step 4
    const L4a = roundTowardZero(L3b / L1b, 2);
    const L4b = W4P_4c;
    const L4c = L4a + L4b;

    // Build entries like AsString
    const entries = [
      ["", `${taxYear} Pub 15-T Worksheet 1-B (Form W-4P Calculator)`],
      ["", null],
      ["", "Form W-4P Info"],
      ["Filing Status:", opts.filingStatus],
      ["2.B3 Other earned or pension income", W4P_2B3],
      ["3.   Credits", W4P_3],
      ["4.a  Other income", W4P_4a],
      ["4.b  Deductions", W4P_4b],
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
      ["1.i  Adjusted Anual Payment Amount (L1e - L1h)", L1i],
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
      ["2.p  Marginal tax rate from the tax table", (L2p*100).toFixed(2) + '%'],
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
  function autosizeTextarea(el){
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // UI wiring
  function init(){
    const hasW4P = el('hasW4P');
    const w4pPanel = el('w4pPanel');
    const noW4pPanel = el('noW4pPanel');
    hasW4P.addEventListener('change', () => {
      if (hasW4P.checked) { w4pPanel.classList.remove('hidden'); noW4pPanel.classList.add('hidden'); }
      else { w4pPanel.classList.add('hidden'); noW4pPanel.classList.remove('hidden'); }
    });
    
    const out = el('worksheetTA');
    if (out) {
      out.addEventListener('input', () => autosizeTextarea(out));
      autosizeTextarea(out);
    }

    el('computeBtn').addEventListener('click', () => {
      try {
        const taxYear = toNumber(el('taxYear').value);
        const filingStatus = el('filingStatus').value;
        const periodKey = el('period').value;
        const paymentsPerYear = PeriodDict[periodKey] || 12;
        const paymentAmount = toNumber(el('paymentAmount').value);

        let w4p = null;
        let allowances = 0;
        if (hasW4P.checked) {
          w4p = {
            FilingStatus: filingStatus,
            OtherEarnedOrPensionIncome: toNumber(el('w4p_2b3').value),
            Credits: toNumber(el('w4p_3').value),
            OtherIncome: toNumber(el('w4p_4a').value),
            Deductions: toNumber(el('w4p_4b').value),
            ExtraWithholding: toNumber(el('w4p_4c').value)
          };
        } else {
          allowances = parseInt(el('allowances').value) || 0;
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
        el('worksheetTA').value = result.text;
        el('withholdingAmount').textContent = currency(result.L4c);
        autosizeTextarea(el('worksheetTA'));
      } catch (err) {
        alert('Failed to compute: ' + (err && err.message ? err.message : String(err)));
      }
    });

    // initial UI state
    hasW4P.dispatchEvent(new Event('change'));
  }

  document.addEventListener('DOMContentLoaded', init);
})();