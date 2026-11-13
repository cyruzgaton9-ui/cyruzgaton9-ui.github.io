"use strict";

const $ = (selector) => document.querySelector(selector);
const rows = $("#inputRows");
let lastCalc = null;

function addRow(x = "", y = "") {
  const number = rows.children.length + 1;
  const row = document.createElement("tr");
  row.innerHTML = `<td>${number}</td>
    <td><label class="sr-only">X value, pair ${number}</label><input type="text" inputmode="decimal" data-col="x" aria-label="X value, pair ${number}" value="${escapeValue(x)}"></td>
    <td><label class="sr-only">Y value, pair ${number}</label><input type="text" inputmode="decimal" data-col="y" aria-label="Y value, pair ${number}" value="${escapeValue(y)}"></td>
    <td><button class="danger" type="button" aria-label="Delete pair ${number}">×</button></td>`;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    renumberRows();
    update();
  });
  rows.append(row);
  renumberRows();
}

function escapeValue(value) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

function renumberRows() {
  [...rows.rows].forEach((row, index) => {
    const number = index + 1;
    row.cells[0].textContent = number;
    row.querySelectorAll("input").forEach((input) => {
      input.setAttribute(
        "aria-label",
        `${input.dataset.col.toUpperCase()} value, pair ${number}`,
      );
    });
    row
      .querySelector("button")
      .setAttribute("aria-label", `Delete pair ${number}`);
  });
}

function parseRows() {
  const pairs = [];
  const errors = [];
  [...rows.rows].forEach((row, index) => {
    const inputs = [...row.querySelectorAll("input")];
    const values = inputs.map((input) => input.value.trim());
    inputs.forEach((input) => input.classList.remove("bad"));
    if (values.every((value) => value === "")) return;
    let valid = true;
    inputs.forEach((input, column) => {
      if (!values[column] || !Number.isFinite(Number(values[column]))) {
        input.classList.add("bad");
        errors.push(`Pair ${index + 1}: enter a ${column ? "Y" : "X"} value.`);
        valid = false;
      }
    });
    if (valid) pairs.push({ x: Number(values[0]), y: Number(values[1]) });
  });
  if (!errors.length && pairs.length < 2)
    errors.push("Enter at least two complete X and Y pairs.");
  if (!errors.length && pairs.every((pair) => pair.x === pairs[0].x)) {
    errors.push(
      "Every X value is identical, so the slope denominator is zero. Enter at least two different X values.",
    );
  }
  return { pairs, errors };
}

function calculate(data) {
  const n = data.length;
  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const sumX2 = data.reduce((sum, p) => sum + p.x ** 2, 0);
  const sumY2 = data.reduce((sum, p) => sum + p.y ** 2, 0);
  const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  const Sxx = data.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const Syy = data.reduce((sum, p) => sum + (p.y - meanY) ** 2, 0);
  const Sxy = data.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  if (!(Sxx > 0))
    throw new Error(
      "Every X value is identical, so the slope denominator is zero.",
    );

  const Bxy = Sxy / Sxx;
  const Ayx = meanY - Bxy * meanX;
  const points = data.map((p) => {
    const yhat = Ayx + Bxy * p.x;
    const residual = p.y - yhat;
    return { ...p, x2: p.x ** 2, y2: p.y ** 2, xy: p.x * p.y, yhat, residual };
  });
  const SSE = points.reduce((sum, p) => sum + p.residual ** 2, 0);
  const r =
    Syy > 1e-12 * Math.max(1, sumY2) ? Math.max(-1, Math.min(1, Sxy / Math.sqrt(Sxx * Syy))) : null;
  const Byx = Syy > 1e-12 * Math.max(1, sumY2) ? Sxy / Syy : null;
  return {
    n,
    sumX,
    sumY,
    sumX2,
    sumY2,
    sumXY,
    meanX,
    meanY,
    Sxx,
    Syy,
    Sxy,
    Bxy,
    Ayx,
    points,
    SSE,
    r,
    r2: r === null ? null : r ** 2,
    Byx,
    Axy: Byx === null ? null : meanX - Byx * meanY,
    se: n > 2 ? Math.sqrt(SSE / (n - 2)) : null,
    minX: Math.min(...data.map((p) => p.x)),
    maxX: Math.max(...data.map((p) => p.x)),
  };
}

function fmt(value) {
  const places = Number($("#precision").value);
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  if (Math.abs(value) < 0.5 * 10 ** -places) value = 0;
  return value.toFixed(places);
}

function update() {
  const { pairs, errors } = parseRows();
  const message = $("#validation");
  if (errors.length) {
    lastCalc = null;
    message.className = "error";
    message.textContent = errors[0];
    $("#results").innerHTML = "";
    return;
  }
  message.className = "success";
  message.textContent = `${pairs.length} complete pairs ready.`;
  try {
    render(calculate(pairs));
  } catch (error) {
    lastCalc = null;
    message.className = "error";
    message.textContent = error.message;
    $("#results").innerHTML = "";
  }
}

function strengthWord(m) {
  return m >= 0.8 ? "very strong" : m >= 0.6 ? "strong" : m >= 0.4 ? "moderate" : m >= 0.2 ? "weak" : "very weak";
}

function correlationLabel(r) {
  if (r === null) return "Correlation is undefined because Y has no variation.";
  if (Math.abs(r) < 1e-12) return "no correlation";
  return `${strengthWord(Math.abs(r))} ${r > 0 ? "positive" : "negative"} correlation`;
}

function names() {
  return {
    x: $("#xName").value.trim() || "X",
    y: $("#yName").value.trim() || "Y",
  };
}

function relationship(r) {
  if (r === null) return null;
  if (Math.abs(r) < 1e-12) return "no linear relationship";
  const dir = r > 0 ? "positive" : "negative";
  if (Math.abs(r) > 1 - 1e-12) return `a perfect ${dir} linear relationship`;
  return `a ${strengthWord(Math.abs(r))} ${dir} linear relationship`;
}

function equationText(c) {
  return `ŷ = ${fmt(c.Ayx)} ${c.Bxy < 0 ? "−" : "+"} ${fmt(Math.abs(c.Bxy))}x`;
}

// Returns [label, sentence] pairs written in plain text (names are not HTML-escaped here).
function interpretationItems(c) {
  const { x, y } = names();
  const rel = relationship(c.r);
  const pct = (v) => `${fmt(v * 100)}%`;
  const slope =
    Math.abs(c.Bxy) < 1e-12
      ? `${y} is not predicted to change as ${x} changes (slope = 0).`
      : `For every 1-unit increase in ${x}, ${y} is predicted to ${c.Bxy > 0 ? "increase" : "decrease"} by ${fmt(Math.abs(c.Bxy))} on average.`;
  let intercept = `When ${x} = 0, the predicted ${y} is ${fmt(c.Ayx)}.`;
  if (c.minX > 0 || c.maxX < 0)
    intercept += ` Because 0 is outside the observed range of ${x} (${fmt(c.minX)} to ${fmt(c.maxX)}), this intercept is only a mathematical starting point for the line and has no practical meaning.`;
  return [
    ["Slope (Bxy)", slope],
    ["Intercept (Ayx)", intercept],
    [
      "Correlation (r)",
      rel === null
        ? `The correlation is undefined because ${y} has no variation.`
        : `r = ${fmt(c.r)} indicates ${rel} between ${x} and ${y}.`,
    ],
    [
      "Coefficient of determination (r²)",
      c.r2 === null
        ? `r² is undefined because ${y} has no variation.`
        : `r² = ${fmt(c.r2)}: about ${pct(c.r2)} of the variation in ${y} is explained by its linear relationship with ${x}. The remaining ${pct(1 - c.r2)} is due to other factors or random variation.`,
    ],
    [
      "Standard error (Sy.x)",
      c.se === null
        ? "Sy.x requires at least 3 pairs."
        : `Sy.x = ${fmt(c.se)}: actual ${y} values typically fall about ${fmt(c.se)} units away from the regression line.`,
    ],
    [
      "Summary",
      c.r === null
        ? `In summary, ${y} has no variation, so no linear relationship can be measured. The fitted line is ${equationText(c)}.`
        : `In summary, the data show ${rel} (r = ${fmt(c.r)}). The fitted model ${equationText(c)} explains ${pct(c.r2)} of the variation in ${y}.`,
    ],
    [
      "Caution",
      "Correlation does not imply causation. This analysis describes a linear association only.",
    ],
  ];
}

function interpretationText(c) {
  return interpretationItems(c).map(([label, text]) => `${label}: ${text}`).join("\n");
}

function fillInterpretation(c) {
  const list = $("#interpretation");
  if (!list) return;
  list.innerHTML = interpretationItems(c)
    .map(([label, text]) => `<li><strong>${escapeValue(label)}.</strong> ${escapeValue(text)}</li>`)
    .join("");
}

function render(c) {
  lastCalc = c;
  const equation = equationText(c);
  const stats = [
    ["Sxx", fmt(c.Sxx)],
    ["Syy (SSy)", fmt(c.Syy)],
    ["Sxy", fmt(c.Sxy)],
    ["Sample covariance", fmt(c.Sxy / (c.n - 1))],
    [
      "Standard error Sy.x",
      c.se === null ? "Requires at least 3 pairs" : fmt(c.se),
    ],
    ["Reverse slope · Byx", fmt(c.Byx)],
    ["Reverse intercept · Axy", fmt(c.Axy)],
    ["Σy² (plain sum)", fmt(c.sumY2)],
    ["Σ(y − ŷ)² · SSE", fmt(c.SSE)],
  ];
  const headers = ["X", "Y", "X²", "Y²", "XY", "ŷ", "y − ŷ", "(y − ŷ)²"];
  const values = c.points.map((p) => [
    p.x,
    p.y,
    p.x2,
    p.y2,
    p.xy,
    p.yhat,
    p.residual,
    p.residual ** 2,
  ]);
  const totals = [c.sumX, c.sumY, c.sumX2, c.sumY2, c.sumXY, null, null, c.SSE];
  const tableCells = (cells) =>
    cells
      .map((value) => `<td>${value === null ? "" : fmt(value)}</td>`)
      .join("");

  $("#results").innerHTML = `
    <section>
      <div class="row between"><h2>2. Regression results</h2>
        <div class="actions no-print">
          <button id="copyResults">Copy results</button><button id="copyTable">Copy table</button>
          <button id="downloadCsv">Download CSV</button><button onclick="window.print()">Print</button>
        </div>
      </div>
      <p id="resultStatus" class="hint" aria-live="polite"></p>
      <div class="metric-grid">
        ${metric("Slope · Bxy", fmt(c.Bxy))}${metric("Intercept · Ayx", fmt(c.Ayx))}
        ${metric("Mean X · x̄", fmt(c.meanX))}${metric("Mean Y · ȳ", fmt(c.meanY))}
        ${metric("Pearson's r", fmt(c.r))}${metric("r²", fmt(c.r2))}
      </div>
      <p class="equation">${equation}</p><p><strong>${correlationLabel(c.r)}</strong></p>
      <div class="advanced">${stats.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}</div>
    </section>
    <section><div class="row between"><h2>3. Interpretation</h2>
      <div class="actions no-print"><button id="copyInterp">Copy interpretation</button></div></div>
      <p id="interpStatus" class="hint" aria-live="polite"></p>
      <ul class="interp" id="interpretation"></ul>
    </section>
    <section><h2>4. Computation table</h2><div class="table-wrap">
      <table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
      <tbody>${values.map((row) => `<tr>${tableCells(row)}</tr>`).join("")}</tbody>
      <tfoot><tr>${tableCells(totals)}</tr></tfoot></table></div>
      <p class="hint">Footer shows ΣX, ΣY, ΣX², ΣY², ΣXY and SSE. Syy (SSy) is shown above.</p>
    </section>
    <section><h2>5. Visual checks</h2><div class="plot-grid">
      <div class="plot-box"><h3>Scatter plot and fitted line</h3><div id="scatter"></div><p class="plot-note">The line summarizes the linear trend; it does not imply that X causes Y.</p></div>
      <div class="plot-box"><h3>Residual plot</h3><div id="residual"></div><p class="plot-note">Look for residuals scattered around zero with no curve or funnel. Patterns can indicate that a straight line is a poor fit.</p></div>
    </div></section>
    <section><h2>6. Predict a value</h2><div class="row">
      <label for="prediction">If X =</label><input id="prediction" inputmode="decimal" type="number" step="any" placeholder="e.g. 6">
      <span>then ŷ = <strong id="predicted">—</strong></span></div>
      <p id="predictSentence"></p>
      <p id="extrapolation" aria-live="polite" class="hint">Enter an X value to calculate its prediction.</p>
    </section>
    <section><h2>7. Show your solution</h2>
      <label class="row"><input id="showSolution" type="checkbox" style="width:auto"> Show the step-by-step breakdown</label>
      <ol class="solution" id="solution" hidden></ol></section>`;

  fillInterpretation(c);
  $("#copyInterp").addEventListener("click", async () => {
    await copyText(interpretationText(c));
    $("#interpStatus").textContent = "Interpretation copied to clipboard.";
  });
  drawPlot("#scatter", c, false);
  drawPlot("#residual", c, true);
  $("#prediction").addEventListener("input", () => predict(c));
  $("#showSolution").addEventListener("change", (event) => {
    $("#solution").hidden = !event.target.checked;
    if (event.target.checked) showSolution(c);
  });
  $("#copyResults").addEventListener("click", () => copyText(resultsText(c)));
  $("#copyTable").addEventListener("click", () => copyText(tableText(c)));
  $("#downloadCsv").addEventListener("click", () => downloadCsv(c));
}

function metric(label, value) {
  return `<div class="metric"><div class="label">${label}</div><strong>${value}</strong></div>`;
}

function drawPlot(selector, c, residualPlot) {
  const width = 520,
    height = 310,
    left = 55,
    right = 16,
    top = 16,
    bottom = 46;
  const xs = c.points.map((p) => p.x);
  const ys = c.points.map((p) => (residualPlot ? p.residual : p.y));
  const dx = Math.max(...xs) - Math.min(...xs) || 1;
  const dy = Math.max(...ys, 0) - Math.min(...ys, 0) || 1;
  const xMin = Math.min(...xs) - dx * 0.08,
    xMax = Math.max(...xs) + dx * 0.08;
  const yMin =
    (residualPlot ? Math.min(0, ...ys) : Math.min(...ys)) - dy * 0.12;
  const yMax =
    (residualPlot ? Math.max(0, ...ys) : Math.max(...ys)) + dy * 0.12;
  const px = (x) =>
    left + ((x - xMin) / (xMax - xMin)) * (width - left - right);
  const py = (y) =>
    top + ((yMax - y) / (yMax - yMin)) * (height - top - bottom);
  let grid = "";
  for (let i = 0; i <= 5; i += 1) {
    const value = yMin + ((yMax - yMin) * i) / 5,
      y = py(value);
    grid += `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="var(--line)"/>`;
    grid += `<text x="${left - 7}" y="${y + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${fmt(value)}</text>`;
  }
  const circles = c.points
    .map((p) => {
      const y = residualPlot ? p.residual : p.y;
      return `<circle cx="${px(p.x)}" cy="${py(y)}" r="5" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"><title>X ${fmt(p.x)}, ${residualPlot ? "residual" : "Y"} ${fmt(y)}</title></circle>`;
    })
    .join("");
  const line = residualPlot
    ? `<line x1="${left}" y1="${py(0)}" x2="${width - right}" y2="${py(0)}" stroke="var(--bad)" stroke-dasharray="5 4"/>`
    : `<line x1="${px(xMin)}" y1="${py(c.Ayx + c.Bxy * xMin)}" x2="${px(xMax)}" y2="${py(c.Ayx + c.Bxy * xMax)}" stroke="var(--bad)" stroke-width="2.5"/>`;
  $(selector).innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${residualPlot ? "Residuals plotted against X" : "Scatter plot of X and Y with regression line"}">
    <title>${residualPlot ? "Residual plot" : "Scatter plot with regression line"}</title>${grid}${line}${circles}
    <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="var(--muted)"/>
    <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="var(--muted)"/>
    <text x="${(width + left - right) / 2}" y="${height - 8}" text-anchor="middle" fill="var(--ink)" font-size="12">X</text>
    <text transform="translate(15 ${(height + top - bottom) / 2}) rotate(-90)" text-anchor="middle" fill="var(--ink)" font-size="12">${residualPlot ? "Residual (y − ŷ)" : "Y"}</text></svg>`;
}

function showSolution(c) {
  const f = fmt;
  $("#solution").innerHTML = `
    <li><b>Corrected sums.</b><br><span class="formula">Sxx = Σx² − (Σx)²/n = ${f(c.sumX2)} − (${f(c.sumX)})²/${c.n} = ${f(c.Sxx)}</span><br>
      <span class="formula">Sxy = Σxy − (ΣxΣy)/n = ${f(c.sumXY)} − (${f(c.sumX)}·${f(c.sumY)})/${c.n} = ${f(c.Sxy)}</span></li>
    <li><b>Slope Bxy.</b><br><span class="formula">Bxy = (nΣxy − ΣxΣy)/(nΣx² − (Σx)²) = (${c.n}·${f(c.sumXY)} − ${f(c.sumX)}·${f(c.sumY)})/(${c.n}·${f(c.sumX2)} − (${f(c.sumX)})²) = ${f(c.Bxy)}</span></li>
    <li><b>Means and intercept.</b><br><span class="formula">x̄ = ${f(c.sumX)}/${c.n} = ${f(c.meanX)}; ȳ = ${f(c.sumY)}/${c.n} = ${f(c.meanY)}</span><br>
      <span class="formula">Ayx = ȳ − Bxy·x̄ = ${f(c.meanY)} − ${f(c.Bxy)}·${f(c.meanX)} = ${f(c.Ayx)}</span></li>
    <li><b>Equation.</b><br><span class="formula">ŷ = Ayx + Bxy·x = ${f(c.Ayx)} + ${f(c.Bxy)}x</span></li>
    <li><b>Correlation.</b><br><span class="formula">r = Sxy/√(Sxx·Syy) = ${f(c.Sxy)}/√(${f(c.Sxx)}·${f(c.Syy)}) = ${f(c.r)}; r² = ${f(c.r2)}</span></li>
    <li><b>Residual sum of squares.</b><br><span class="formula">SSE = Σ(y − ŷ)² = ${f(c.SSE)}${c.se === null ? "; Sy.x requires n ≥ 3." : `; Sy.x = √(SSE/(n−2)) = √(${f(c.SSE)}/(${c.n}−2)) = ${f(c.se)}.`}</span></li>`;
}

function predict(c) {
  const raw = $("#prediction").value,
    output = $("#predicted"),
    note = $("#extrapolation");
  if (raw === "" || !Number.isFinite(Number(raw))) {
    output.textContent = "—";
    $("#predictSentence").textContent = "";
    note.textContent = "Enter an X value to calculate its prediction.";
    return;
  }
  const x = Number(raw);
  output.textContent = fmt(c.Ayx + c.Bxy * x);
  const nm = names();
  $("#predictSentence").textContent = `When ${nm.x} = ${fmt(x)}, the predicted ${nm.y} is ${fmt(c.Ayx + c.Bxy * x)}.`;
  if (x < c.minX || x > c.maxX) {
    note.className = "error";
    note.textContent = `Warning: X is outside the observed range (${fmt(c.minX)} to ${fmt(c.maxX)}). This is extrapolation, so the estimate may be unreliable.`;
  } else {
    note.className = "hint";
    note.textContent = `Within the observed X range (${fmt(c.minX)} to ${fmt(c.maxX)}).`;
  }
}

function resultsText(c) {
  return `Simple Linear Regression
Bxy (slope): ${fmt(c.Bxy)}
Ayx (intercept): ${fmt(c.Ayx)}
Equation: ŷ = ${fmt(c.Ayx)} + ${fmt(c.Bxy)}x
Mean X: ${fmt(c.meanX)}
Mean Y: ${fmt(c.meanY)}
r: ${fmt(c.r)}
r²: ${fmt(c.r2)}
Sxx: ${fmt(c.Sxx)}
Syy (SSy): ${fmt(c.Syy)}
Sxy: ${fmt(c.Sxy)}
SSE: ${fmt(c.SSE)}
Sy.x: ${fmt(c.se)}
${correlationLabel(c.r)}

Interpretation
${interpretationText(c)}`;
}

function tableText(c) {
  const header = ["X", "Y", "X²", "Y²", "XY", "ŷ", "y − ŷ", "(y − ŷ)²"];
  const rows = c.points.map((p) =>
    [p.x, p.y, p.x2, p.y2, p.xy, p.yhat, p.residual, p.residual ** 2].map(fmt),
  );
  const totals = [
    c.sumX,
    c.sumY,
    c.sumX2,
    c.sumY2,
    c.sumXY,
    null,
    null,
    c.SSE,
  ].map((v) => (v === null ? "" : fmt(v)));
  return [header, ...rows, totals].map((row) => row.join("\t")).join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  $("#resultStatus").textContent = "Copied to clipboard.";
}

function downloadCsv(c) {
  const rows = [
    ["X", "Y", "X^2", "Y^2", "XY", "yhat", "residual", "residual_squared"],
    ...c.points.map((p) => [
      p.x,
      p.y,
      p.x2,
      p.y2,
      p.xy,
      p.yhat,
      p.residual,
      p.residual ** 2,
    ]),
    [c.sumX, c.sumY, c.sumX2, c.sumY2, c.sumXY, "", "", c.SSE],
  ];
  const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "regression-table.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parsePaste(text) {
  const lines = text
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim()),
    pairs = [];
  for (const line of lines) {
    const values = line
      .trim()
      .split(/[\t, ]+/)
      .filter(Boolean);
    if (
      values.length !== 2 ||
      values.some((value) => !Number.isFinite(Number(value)))
    ) {
      return {
        error: `Could not read “${line}”. Each line needs exactly two numeric values.`,
      };
    }
    pairs.push(values);
  }
  return { pairs };
}

$("#addRow").addEventListener("click", () => {
  addRow();
  rows.lastElementChild.querySelector("input").focus();
  update();
});
$("#loadExample").addEventListener("click", () => {
  rows.innerHTML = "";
  [
    [1, 2],
    [2, 4],
    [3, 5],
    [4, 4],
    [5, 5],
  ].forEach((pair) => addRow(...pair));
  update();
});
$("#clearAll").addEventListener("click", () => {
  rows.innerHTML = "";
  addRow();
  addRow();
  $("#pasteData").value = "";
  update();
});
$("#importPaste").addEventListener("click", () => {
  const parsed = parsePaste($("#pasteData").value);
  if (parsed.error) {
    $("#validation").className = "error";
    $("#validation").textContent = parsed.error;
    return;
  }
  if (!parsed.pairs.length) {
    $("#validation").className = "error";
    $("#validation").textContent = "Paste at least two lines of paired data.";
    return;
  }
  rows.innerHTML = "";
  parsed.pairs.forEach((pair) => addRow(pair[0], pair[1]));
  update();
});
$("#precision").addEventListener("change", update);
["#xName", "#yName"].forEach((selector) =>
  $(selector).addEventListener("input", () => {
    if (!lastCalc) return;
    fillInterpretation(lastCalc);
    if ($("#prediction")) predict(lastCalc);
  }),
);
rows.addEventListener("input", update);
rows.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.matches("input")) return;
  event.preventDefault();
  const inputs = [...rows.querySelectorAll("input")],
    next = inputs[inputs.indexOf(event.target) + 1];
  if (next) next.focus();
  else {
    addRow();
    rows.lastElementChild.querySelector("input").focus();
    update();
  }
});

addRow();
addRow();
update();
