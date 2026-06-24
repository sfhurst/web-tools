/* ==========================================================================
   MODULE 1: RECORD HOURS (PAY PERIOD) TOOL
   ========================================================================== */
(function () {
  const TOOL_BUTTON_ID = "open-hours";
  const CLOSE_BUTTON_ID = "hours-close";
  const EXPORT_BUTTON_ID = "hours-export";
  const MODAL_ID = "modal-hours";
  const LIST_CONTAINER_ID = "hours-list";
  const LOCAL_STORAGE_KEY = "hoursData";

  const anchor = new Date(2026, 4, 11); // May 11, 2026

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  }

  function getPayPeriodStart(today) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceAnchor = Math.floor((today - anchor) / msPerDay);
    const periodsSinceAnchor = Math.floor(daysSinceAnchor / 14);
    return new Date(anchor.getTime() + periodsSinceAnchor * 14 * msPerDay);
  }

  function getWeekdays(start) {
    const days = [];
    let d = new Date(start);
    for (let i = 0; i < 14; i++) {
      const day = d.getDay();
      if (day >= 1 && day <= 5) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  function shortDate(d) {
    return d.getMonth() + 1 + "/" + d.getDate();
  }

  function loadHours() {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function saveHours(obj) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
  }

  function downloadTextFile(text, filename) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeListen(TOOL_BUTTON_ID, "click", () => {
      const today = new Date();
      const start = getPayPeriodStart(today);
      const weekdays = getWeekdays(start);
      const stored = loadHours();

      const list = document.getElementById(LIST_CONTAINER_ID);
      if (!list) return;
      list.innerHTML = "";

      let focusField = null;

      weekdays.forEach((d, index) => {
        const iso = d.toISOString().split("T")[0];

        if (index === 5) {
          const divider = document.createElement("div");
          divider.className = "week-divider";
          list.appendChild(divider);
        }

        const dateLabel = document.createElement("div");
        dateLabel.className = "hours-date";
        dateLabel.textContent = shortDate(d);

        const input = document.createElement("input");
        input.className = "hours-input";
        input.type = "text";
        input.value = stored[iso] ?? "";
        input.dataset.iso = iso;

        input.addEventListener("input", () => {
          const hoursData = loadHours();
          hoursData[input.dataset.iso] = input.value.trim() || null;
          saveHours(hoursData);
        });

        if (d.toDateString() === today.toDateString()) {
          focusField = input;
        }

        list.appendChild(dateLabel);
        list.appendChild(input);
      });

      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.remove("hidden");
      if (focusField) focusField.focus();
    });

    safeListen(CLOSE_BUTTON_ID, "click", () => {
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
    });

    safeListen(EXPORT_BUTTON_ID, "click", () => {
      const today = new Date();
      const start = getPayPeriodStart(today);
      const weekdays = getWeekdays(start);
      const stored = loadHours();

      let fileContent = `PAY PERIOD HOURS REPORT\n`;
      fileContent += `Generated: ${today.toISOString().split("T")[0]}\n`;
      fileContent += `==========================================\n\n`;

      weekdays.forEach((d, index) => {
        if (index === 5) fileContent += `------------------------------------------\n`;
        const iso = d.toISOString().split("T")[0];
        const readableDate = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const hoursLogged = stored[iso] || "0";
        fileContent += `${readableDate.padEnd(20, " ")}: ${hoursLogged} hrs\n`;
      });

      downloadTextFile(fileContent, `Hours_Report_${today.toISOString().split("T")[0]}.txt`);
    });
  });
})();

/* ==========================================================================
   MODULE 2: FOLDER BUILDER TOOL
   ========================================================================== */
(function () {
  const TOOL_BUTTON_ID = "open-folderbuilder";
  const CANCEL_BUTTON_ID = "folderbuilder-cancel";
  const GENERATE_BUTTON_ID = "folderbuilder-generate";
  const MODAL_ID = "modal-folderbuilder";
  const INPUT_ID = "folderbuilder-input";
  const OUTPUT_ID = "folderbuilder-output";

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  }

  function sanitizeFolderName(name) {
    let cleaned = name.replace(/[^a-zA-Z0-9 _.-]/g, "_");
    cleaned = cleaned.replace(/^[ .]+|[ .]+$/g, "");
    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reserved.test(cleaned)) {
      cleaned = "_" + cleaned;
    }
    return cleaned || "_";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeListen(TOOL_BUTTON_ID, "click", () => {
      const ta = document.getElementById(INPUT_ID);
      if (ta) ta.value = "";
      const out = document.getElementById(OUTPUT_ID);
      if (out) out.textContent = "";
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.remove("hidden");
      setTimeout(() => {
        if (ta) ta.focus();
      }, 50);
    });

    safeListen(CANCEL_BUTTON_ID, "click", () => {
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
    });

    safeListen(GENERATE_BUTTON_ID, "click", async () => {
      const rawEl = document.getElementById(INPUT_ID);
      const output = document.getElementById(OUTPUT_ID);
      if (!rawEl || !output) return;

      const lines = rawEl.value
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length === 0) {
        output.textContent = "No valid lines found.";
        return;
      }

      if (typeof JSZip === "undefined") {
        output.textContent = "Error: JSZip library not loaded.";
        return;
      }

      const zip = new JSZip();
      lines.forEach(name => {
        const safeName = sanitizeFolderName(name);
        zip.folder(safeName);
      });

      output.textContent = "Building ZIP...";

      try {
        const blob = await zip.generateAsync({ type: "blob" });
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.classList.add("hidden");
        downloadBlob(blob, "folders.zip");

        setTimeout(() => {
          output.textContent = `Created ZIP with ${lines.length} folders.`;
        }, 300);
      } catch (e) {
        console.error(e);
        output.textContent = "Error generating ZIP.";
      }
    });
  });
})();

/* ==========================================================================
   MODULE 3: MAP LINKS TOOL (CLIPBOARD TEXT BOX GENERATOR)
   ========================================================================== */
(function () {
  const TOOL_BUTTON_ID = "open-maplinks";
  const CANCEL_BUTTON_ID = "modal-cancel";
  const GENERATE_BUTTON_ID = "modal-generate";
  const MODAL_ID = "modal-maplinks";
  const INPUT_ID = "coords-input";
  const HIDDEN_OUTPUT_ID = "hidden-output";

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  }

  function buildDirectMapFormula(latDec, lonDec) {
    const url = `https://www.google.com/maps/search/?api=1&query=${latDec},${lonDec}`;
    return `=HYPERLINK("${url}","Map")`;
  }

  function processInput(text) {
    const lines = text.trim().split(/\r?\n/);
    const results = [];
    for (const line of lines) {
      const nums = line.match(/-?\d+(\.\d+)?/g);
      if (!nums || nums.length < 2) continue;

      const lat = parseFloat(nums[0]);
      const lon = parseFloat(nums[1]);
      if (isNaN(lat) || isNaN(lon)) continue;

      results.push(buildDirectMapFormula(lat, lon));
    }
    return results.join("\n");
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.getElementById(HIDDEN_OUTPUT_ID);
      if (ta) {
        ta.value = text;
        ta.select();
        document.execCommand("copy");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeListen(TOOL_BUTTON_ID, "click", () => {
      const ta = document.getElementById(INPUT_ID);
      if (ta) ta.value = "";
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.remove("hidden");
      setTimeout(() => {
        if (ta) ta.focus();
      }, 50);
    });

    safeListen(CANCEL_BUTTON_ID, "click", () => {
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
    });

    safeListen(GENERATE_BUTTON_ID, "click", async () => {
      const inputEl = document.getElementById(INPUT_ID);
      if (inputEl) {
        const result = processInput(inputEl.value);
        await copyToClipboard(result);
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.classList.add("hidden");
        alert("Map hyperlinks copied to clipboard.");
      }
    });
  });
})();

/* ==========================================================================
   MODULE 4: ROUTE OPTIMIZER TOOL
   ========================================================================== */
(function () {
  const TOOL_BUTTON_ID = "open-routeoptimizer";
  const CANCEL_BUTTON_ID = "routeoptimizer-cancel";
  const GENERATE_BUTTON_ID = "routeoptimizer-generate";
  const MODAL_ID = "modal-routeoptimizer";
  const INPUT_ID = "routeoptimizer-input";

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  }

  function buildGoogleMapsURL(sortedCoords) {
    if (sortedCoords.length < 2) return null;
    const originObj = sortedCoords[0];
    const origin = `${originObj.lat},${originObj.lon}`;
    const destinationObj = sortedCoords[sortedCoords.length - 1];
    const destination = `${destinationObj.lat},${destinationObj.lon}`;

    let waypointsParam = "";
    if (sortedCoords.length > 2) {
      const waypointParts = sortedCoords
        .slice(1, -1)
        .map(c => `${c.lat},${c.lon}`)
        .join("|");
      waypointsParam = `&waypoints=${encodeURIComponent(waypointParts)}`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`;
  }

  async function getOSRMOptimizedOrder(coords) {
    if (coords.length <= 2) return coords;
    const coordString = coords.map(c => `${c.lon},${c.lat}`).join(";");
    const url = `https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&roundtrip=false`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.code !== "Ok" || !data.waypoints) {
        console.warn("OSRM returned an error, falling back to original order.");
        return coords;
      }
      const sortedWaypoints = data.waypoints.map((wp, index) => ({ ...wp, inputIndex: index })).sort((a, b) => a.waypoint_index - b.waypoint_index);

      return sortedWaypoints.map(wp => coords[wp.inputIndex]);
    } catch (error) {
      console.error("OSRM optimization network failure, using fallback:", error);
      return coords;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeListen(TOOL_BUTTON_ID, "click", () => {
      const ta = document.getElementById(INPUT_ID);
      if (ta) ta.value = "";
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.remove("hidden");
      setTimeout(() => {
        if (ta) ta.focus();
      }, 50);
    });

    safeListen(CANCEL_BUTTON_ID, "click", () => {
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
    });

    safeListen(GENERATE_BUTTON_ID, "click", async () => {
      const inputEl = document.getElementById(INPUT_ID);
      if (!inputEl) return;

      const lines = inputEl.value
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .slice(0, 10);

      const coords = [];
      for (const line of lines) {
        const nums = line.match(/-?\d+(\.\d+)?/g);
        if (!nums || nums.length < 2) continue;
        const lat = parseFloat(nums[0]);
        const lon = parseFloat(nums[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          coords.push({ lat, lon });
        }
      }

      if (coords.length < 2) {
        alert("Need at least two valid coordinate pairs to build a route.");
        return;
      }

      const btn = document.getElementById(GENERATE_BUTTON_ID);
      if (btn) btn.innerText = "Optimizing Route...";

      const optimizedCoords = await getOSRMOptimizedOrder(coords);
      const url = buildGoogleMapsURL(optimizedCoords);

      if (btn) btn.innerText = "Generate Route";

      if (!url) {
        alert("Unable to build route.");
        return;
      }

      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
      window.open(url, "_blank");
    });
  });
})();

/* ==========================================================================
   MODULE 5: ASSET RECONCILIATION TOOL
   ========================================================================== */
(function () {
  const TOOL_BUTTON_ID = "open-reconciler";
  const CANCEL_BUTTON_ID = "reconciler-cancel";
  const GENERATE_BUTTON_ID = "reconciler-generate";
  const MODAL_ID = "modal-reconciler";
  const OLD_FILE_ID = "reconciler-old-file";
  const NEW_FILE_ID = "reconciler-new-file";
  const SUMMARY_ID = "reconciler-summary";

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  }

  function normalizeAssetKey(val) {
    if (val === undefined || val === null) return "";
    let str = String(val).trim();
    return str.replace(/^0+/, "");
  }

  function normalizeAssetName(val) {
    if (val === undefined || val === null) return "";
    let str = String(val).toLowerCase();
    str = str.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return str;
  }

  // Strips single (=) or double (==) HYPERLINK formula wrappers down to the raw URL string path cleanly
  function cleanRawUrlString(val) {
    if (!val) return "";
    let clean = String(val).trim();
    if (clean.toUpperCase().startsWith("==HYPERLINK(") || clean.toUpperCase().startsWith("=HYPERLINK(")) {
      let matches = clean.match(/={1,2}HYPERLINK\(\s*["']([^"']+)["']/i);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
    return clean;
  }

  function cloneCellObject(cellObj) {
    if (!cellObj) return null;
    let clone = {};
    for (let key in cellObj) {
      if (cellObj.hasOwnProperty(key)) {
        if (key === "l" && cellObj.l) {
          clone.l = { ...cellObj.l };
        } else {
          clone[key] = cellObj[key];
        }
      }
    }
    return clone;
  }

  function buildExplicitCellSheet(rowsGrid) {
    let ws = {};
    let maxR = -1;
    let maxC = -1;

    for (let r = 0; r < rowsGrid.length; r++) {
      let row = rowsGrid[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== null && row[c] !== undefined) {
          let cellRef = XLSX.utils.encode_cell({ r: r, c: c });
          if (typeof row[c] === "object" && row[c] !== null && (row[c].v !== undefined || row[c].f !== undefined)) {
            ws[cellRef] = cloneCellObject(row[c]);
          } else {
            ws[cellRef] = { v: row[c], t: typeof row[c] === "number" ? "n" : "s" };
          }
          if (r > maxR) maxR = r;
          if (c > maxC) maxC = c;
        }
      }
    }
    if (maxR > -1 && maxC > -1) {
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    } else {
      ws["!ref"] = "A1:A1";
    }
    return ws;
  }

  // NEW SANITISATION ENGINE: Scans, isolates, and repairs error text strings in memory BEFORE structural mapping begins
  function preProcessSanitizeSheetLinks(sheet) {
    if (!sheet || !sheet["!ref"]) return;
    const range = XLSX.utils.decode_range(sheet["!ref"]);

    // Step A: Scan header row to identify which column is the Hyperlink column
    let hyperlinkColIdx = -1;
    for (let c = 0; c <= range.e.c; c++) {
      let cellRef = XLSX.utils.encode_cell({ r: 0, c: c });
      let cell = sheet[cellRef];
      if (cell && cell.v) {
        let cleanHeader = String(cell.v)
          .toLowerCase()
          .replace(/[^a-z]/g, "");
        if (cleanHeader === "hyperlink") {
          hyperlinkColIdx = c;
          break;
        }
      }
    }

    // Step B: If found, forcefully extract and overwrite the error state cell objects with raw, clean URL paths
    if (hyperlinkColIdx !== -1) {
      for (let r = 1; r <= range.e.r; r++) {
        let cellRef = XLSX.utils.encode_cell({ r: r, c: hyperlinkColIdx });
        let cell = sheet[cellRef];
        if (cell) {
          let extractedUrl = "";
          if (cell.f) extractedUrl = cleanRawUrlString(cell.f);
          if (!extractedUrl && cell.v) extractedUrl = cleanRawUrlString(cell.v);
          if (!extractedUrl && cell.w) extractedUrl = cleanRawUrlString(cell.w);

          if (extractedUrl) {
            sheet[cellRef] = { t: "s", v: extractedUrl, w: extractedUrl };
          }
        }
      }
    }
  }

  function extractSheetDetailsAndRows(workbook) {
    let bestSheetName = null;
    let bestColumnIndex = -1;
    let nameColumnIndex = -1;
    let hyperlinkColumnIndex = -1;
    let maxRowsCount = -1;
    let rawObjectsGrid = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // Run the pre-processor repair directly onto the raw sheet object structure
      preProcessSanitizeSheetLinks(sheet);

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      if (rows.length === 0) continue;

      const headers = rows[0];
      let targetColIdx = -1;
      let tempNameColIdx = -1;
      let tempHyperlinkColIdx = -1;
      let highestHeaderScore = 0;

      for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;

        let headerText = typeof headers[i] === "object" ? String(headers[i].v) : String(headers[i]);
        let cleanHeader = headerText.toLowerCase().replace(/[^a-z]/g, "");

        if (cleanHeader === "hyperlink") {
          tempHyperlinkColIdx = i;
          continue;
        }
        if (cleanHeader.includes("name") || cleanHeader.includes("desig")) {
          tempNameColIdx = i;
          continue;
        }

        let score = 0;
        if (cleanHeader === "assetnumber" || cleanHeader === "assetid" || cleanHeader === "structurenumber" || cleanHeader === "assetno") {
          score = 3;
        } else if (cleanHeader.includes("asset") && (cleanHeader.includes("num") || cleanHeader.includes("id") || cleanHeader.includes("no"))) {
          score = 2;
        } else if (cleanHeader.includes("asset") || cleanHeader.includes("structure")) {
          score = 1;
        }

        if (score > highestHeaderScore) {
          highestHeaderScore = score;
          targetColIdx = i;
        }
      }

      if (targetColIdx !== -1 && rows.length > maxRowsCount) {
        maxRowsCount = rows.length;
        bestSheetName = sheetName;
        bestColumnIndex = targetColIdx;
        nameColumnIndex = tempNameColIdx;
        hyperlinkColumnIndex = tempHyperlinkColIdx;

        const range = XLSX.utils.decode_range(sheet["!ref"]);
        rawObjectsGrid = [];

        for (let r = 0; r <= range.e.r; r++) {
          let rowArray = [];
          for (let c = 0; c <= range.e.c; c++) {
            let cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            rowArray.push(sheet[cellRef] || null);
          }
          rawObjectsGrid.push(rowArray);
        }
      }
    }

    let keysMap = new Map();
    if (bestSheetName !== null && rawObjectsGrid.length > 1) {
      for (let r = 1; r < rawObjectsGrid.length; r++) {
        const cellObj = rawObjectsGrid[r][bestColumnIndex];
        const val = cellObj ? cellObj.v : "";
        const normalized = normalizeAssetKey(val);
        if (normalized) {
          keysMap.set(normalized, rawObjectsGrid[r]);
        }
      }
    }

    return {
      sheetName: bestSheetName,
      colIndex: bestColumnIndex,
      nameColIndex: nameColumnIndex,
      hyperlinkColIndex: hyperlinkColumnIndex,
      rows: rawObjectsGrid,
      keysMap: keysMap,
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeListen(TOOL_BUTTON_ID, "click", () => {
      const oldF = document.getElementById(OLD_FILE_ID);
      const newF = document.getElementById(NEW_FILE_ID);
      const summ = document.getElementById(SUMMARY_ID);
      if (oldF) oldF.value = "";
      if (newF) newF.value = "";
      if (summ) {
        summ.classList.add("hidden");
        summ.className = "reconciler-summary-box";
        summ.innerHTML = "";
      }
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.remove("hidden");
    });

    safeListen(CANCEL_BUTTON_ID, "click", () => {
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
    });

    safeListen(GENERATE_BUTTON_ID, "click", async () => {
      const oldFileEl = document.getElementById(OLD_FILE_ID);
      const newFileEl = document.getElementById(NEW_FILE_ID);
      const summaryEl = document.getElementById(SUMMARY_ID);

      if (!oldFileEl?.files[0] || !newFileEl?.files[0]) {
        alert("Please select both an old and a new spreadsheet file.");
        return;
      }

      if (!summaryEl) return;
      summaryEl.classList.remove("hidden");
      summaryEl.className = "reconciler-summary-box";
      summaryEl.innerText = "Analyzing asset lists and applying cross-workbook formula updates...";

      try {
        const oldFile = oldFileEl.files[0];
        const newFile = newFileEl.files[0];

        const readWorkbook = file =>
          new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(XLSX.read(e.target.result, { type: "binary", cellFormula: true }));
            reader.readAsBinaryString(file);
          });

        const oldWorkbook = await readWorkbook(oldFile);
        const newWorkbook = await readWorkbook(newFile);

        const oldData = extractSheetDetailsAndRows(oldWorkbook);
        const newData = extractSheetDetailsAndRows(newWorkbook);

        if (!oldData.sheetName || oldData.keysMap.size === 0) {
          summaryEl.className = "reconciler-summary-box error";
          summaryEl.innerText = "Error: Asset index missing in Old list.";
          return;
        }
        if (!newData.sheetName || newData.keysMap.size === 0) {
          summaryEl.className = "reconciler-summary-box error";
          summaryEl.innerText = "Error: Asset index missing in New list.";
          return;
        }

        const headerRowObjects = oldData.rows[0];

        const activeRows = [headerRowObjects];
        const updatedNameRows = [headerRowObjects];
        const archivedRows = [headerRowObjects];
        const newRows = [newData.rows[0]];

        let unchangedCount = 0;
        let updatedCount = 0;
        let archivedCount = 0;
        let newCount = 0;

        const hasNameColumns = oldData.nameColIndex !== -1 && newData.nameColIndex !== -1;

        // 1. Process Sheets 1-3: Absolute Mirror Copying
        for (let r = 1; r < oldData.rows.length; r++) {
          const rowObjects = oldData.rows[r];
          const cellObj = rowObjects[oldData.colIndex];
          const val = cellObj ? cellObj.v : "";
          const normalized = normalizeAssetKey(val);

          if (!normalized) continue;

          let preservedRowCells = rowObjects.map(obj => (obj ? cloneCellObject(obj) : null));

          if (newData.keysMap.has(normalized)) {
            let nameChanged = false;

            if (hasNameColumns) {
              const oldNameClean = normalizeAssetName(rowObjects[oldData.nameColIndex] ? rowObjects[oldData.nameColIndex].v : "");
              const newMatchedRowObjects = newData.keysMap.get(normalized);
              const newNameClean = normalizeAssetName(newMatchedRowObjects[newData.nameColIndex] ? newMatchedRowObjects[newData.nameColIndex].v : "");

              if (oldNameClean !== newNameClean) {
                nameChanged = true;
              }
            }

            if (nameChanged) {
              updatedNameRows.push(preservedRowCells);
              updatedCount++;
            } else {
              activeRows.push(preservedRowCells);
              unchangedCount++;
            }
          } else {
            archivedRows.push(preservedRowCells);
            archivedCount++;
          }
        }

        // 2. Process Sheet 4: Extracts clean target strings from pre-sanitized memory array
        for (let r = 1; r < newData.rows.length; r++) {
          const rowObjects = newData.rows[r];
          const cellObj = rowObjects[newData.colIndex];
          const val = cellObj ? cellObj.v : "";
          const normalized = normalizeAssetKey(val);

          if (!normalized) continue;

          if (!oldData.keysMap.has(normalized)) {
            let modifiedRowCells = rowObjects.map(obj => (obj ? cloneCellObject(obj) : null));

            if (newData.hyperlinkColIndex !== -1 && newData.nameColIndex !== -1) {
              const rawHyperlinkCell = rowObjects[newData.hyperlinkColIndex];
              let urlString = rawHyperlinkCell ? String(rawHyperlinkCell.v).trim() : "";

              const nameCell = rowObjects[newData.nameColIndex];
              const displayName = nameCell ? String(nameCell.v).trim() : "";

              if (urlString && displayName) {
                modifiedRowCells[newData.nameColIndex] = {
                  t: "s",
                  v: displayName,
                  f: `HYPERLINK("${urlString}","${displayName}")`,
                };
              }
            }
            newRows.push(modifiedRowCells);
            newCount++;
          }
        }

        const totalMatched = unchangedCount + updatedCount;
        const matchRate = oldData.keysMap.size > 0 ? (totalMatched / oldData.keysMap.size) * 100 : 0;

        if (matchRate < 80) {
          summaryEl.className = "reconciler-summary-box error";
          summaryEl.innerHTML = `<strong>Aborted: Low Integrity Linkage.</strong><br/> Match rate: ${matchRate.toFixed(1)}%`;
          return;
        }

        const outWorkbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(outWorkbook, buildExplicitCellSheet(activeRows), "Active_Unchanged");
        XLSX.utils.book_append_sheet(outWorkbook, buildExplicitCellSheet(updatedNameRows), "Updated_Names");
        XLSX.utils.book_append_sheet(outWorkbook, buildExplicitCellSheet(archivedRows), "Archived_Assets");
        XLSX.utils.book_append_sheet(outWorkbook, buildExplicitCellSheet(newRows), "New_Assets");

        XLSX.writeFile(outWorkbook, `Reconciled_Inventory_${oldFile.name}`);

        summaryEl.innerHTML = `<strong>Data Processed Successfully!</strong><br/>
          <span style="font-size: 11px; color: #555;">
            • Old Sheet: ${oldData.rows.length - 1} data rows evaluated<br/>
            • New Sheet: ${newData.rows.length - 1} data rows evaluated
          </span><br/>
          <hr style="border: 0; border-top: 1px solid #c2e0d1; margin: 6px 0;"/>
          • <strong>Active Unchanged:</strong> ${unchangedCount} records<br/>
          • <strong>Rehab Name Changes:</strong> ${updatedCount} records<br/>
          • <strong>Archived Assets:</strong> ${archivedCount} records<br/>
          • <strong>New Assets Bound:</strong> ${newCount} records<br/>
          • <strong>Inventory Alignment:</strong> ${matchRate.toFixed(1)}% Match`;
      } catch (err) {
        console.error(err);
        summaryEl.className = "reconciler-summary-box error";
        summaryEl.innerText = "An error occurred compiling the multi-tab asset sheet.";
      }
    });
  });
})();

/* ==========================================================================
   MODULE 6: EXCEL LINK INJECTOR TOOL
   ========================================================================== */
(function () {
  const TOOL_BUTTON_ID = "open-injector";
  const CANCEL_BUTTON_ID = "injector-cancel";
  const GENERATE_BUTTON_ID = "injector-generate";
  const MODAL_ID = "modal-injector";
  const FILE_INPUT_ID = "injector-file";
  const SUMMARY_ID = "injector-summary";

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  }

  function isValidLatitude(num) {
    return !isNaN(num) && num >= -90 && num <= 90 && num !== 0;
  }
  function isValidLongitude(num) {
    return !isNaN(num) && num >= -180 && num <= 180 && num !== 0;
  }

  function buildCleanMapFormula(latDec, lonDec) {
    return `HYPERLINK("https://www.google.com/maps/search/?api=1&query=${latDec},${lonDec}","Map")`;
  }

  function parseCoordinatesFromString(str) {
    if (!str) return null;
    const nums = String(str).match(/-?\d+(\.\d+)/g);
    if (!nums || nums.length < 2) return null;
    const lat = parseFloat(nums[0]);
    const lon = parseFloat(nums[1]);
    if (isValidLatitude(lat) && isValidLongitude(lon)) {
      return { lat, lon };
    }
    return null;
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeListen(TOOL_BUTTON_ID, "click", () => {
      const fileEl = document.getElementById(FILE_INPUT_ID);
      const summ = document.getElementById(SUMMARY_ID);
      if (fileEl) fileEl.value = "";
      if (summ) {
        summ.classList.add("hidden");
        summ.className = "reconciler-summary-box";
        summ.innerHTML = "";
      }
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.remove("hidden");
    });

    safeListen(CANCEL_BUTTON_ID, "click", () => {
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.classList.add("hidden");
    });

    safeListen(GENERATE_BUTTON_ID, "click", async () => {
      const fileEl = document.getElementById(FILE_INPUT_ID);
      const summaryEl = document.getElementById(SUMMARY_ID);

      if (!fileEl?.files[0]) {
        alert("Please select a target spreadsheet workbook.");
        return;
      }

      if (!summaryEl) return;
      summaryEl.classList.remove("hidden");
      summaryEl.className = "reconciler-summary-box";
      summaryEl.innerText = "Scanning workbook grid arrays for spatial telemetry patterns...";

      try {
        const file = fileEl.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const outWorkbook = XLSX.utils.book_new();
          let totalLinksGenerated = 0;

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rows.length === 0) {
              XLSX.utils.book_append_sheet(outWorkbook, sheet, sheetName);
              continue;
            }

            const headers = rows[0] || [];
            let latColIdx = -1;
            let lonColIdx = -1;
            let singleCombinedColIdx = -1;

            for (let i = 0; i < headers.length; i++) {
              if (!headers[i]) continue;
              const hClean = String(headers[i])
                .toLowerCase()
                .replace(/[^a-z0-9/]/g, "");

              if (hClean.includes("lat/long") || hClean.includes("latlong") || hClean.includes("gps") || hClean.includes("coordinate")) {
                singleCombinedColIdx = i;
                break;
              }
              if (hClean.includes("lat") || hClean.includes("ycoord")) {
                latColIdx = i;
              }
              if (hClean.includes("long") || hClean.includes("lon") || hClean.includes("xcoord")) {
                lonColIdx = i;
              }
            }

            if (singleCombinedColIdx === -1 && (latColIdx === -1 || lonColIdx === -1)) {
              for (let c = 0; c < headers.length; c++) {
                let physicalSampleCount = 0;
                for (let r = 1; r < Math.min(rows.length, 6); r++) {
                  if (rows[r] && rows[r][c] !== undefined) {
                    const parsed = parseCoordinatesFromString(rows[r][c]);
                    if (parsed) physicalSampleCount++;
                  }
                }
                if (physicalSampleCount >= 2) {
                  singleCombinedColIdx = c;
                  break;
                }
              }
            }

            const transformedRows = [];
            const updatedHeaders = [...headers];
            let insertTargetIdx = headers.length;

            if (singleCombinedColIdx !== -1) {
              insertTargetIdx = singleCombinedColIdx + 1;
            } else if (latColIdx !== -1 || lonColIdx !== -1) {
              insertTargetIdx = Math.max(latColIdx, lonColIdx) + 1;
            }

            updatedHeaders.splice(insertTargetIdx, 0, "Map Links");
            transformedRows.push(updatedHeaders);

            for (let r = 1; r < rows.length; r++) {
              const row = rows[r] || [];
              if (row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
                transformedRows.push([]);
                continue;
              }

              const expandedRow = [...row];
              let cellValueOrFormula = "";

              if (singleCombinedColIdx !== -1 && row[singleCombinedColIdx] !== undefined) {
                const geoCoords = parseCoordinatesFromString(row[singleCombinedColIdx]);
                if (geoCoords) {
                  const fText = buildCleanMapFormula(geoCoords.lat, geoCoords.lon);
                  cellValueOrFormula = { f: fText };
                  totalLinksGenerated++;
                }
              } else {
                const rawLat = latColIdx !== -1 ? parseFloat(row[latColIdx]) : NaN;
                const rawLon = lonColIdx !== -1 ? parseFloat(row[lonColIdx]) : NaN;

                if (isValidLatitude(rawLat) && isValidLongitude(rawLon)) {
                  const fText = buildCleanMapFormula(rawLat, rawLon);
                  cellValueOrFormula = { f: fText };
                  totalLinksGenerated++;
                }
              }

              expandedRow.splice(insertTargetIdx, 0, cellValueOrFormula);
              transformedRows.push(expandedRow);
            }

            const outSheet = XLSX.utils.aoa_to_sheet(transformedRows);
            XLSX.utils.book_append_sheet(outWorkbook, outSheet, sheetName);
          }

          XLSX.writeFile(outWorkbook, `Injected_Maps_${file.name}`);

          summaryEl.innerHTML = `<strong>Map Links Injected Successfully!</strong><br/>
            • Total links generated: <strong>${totalLinksGenerated} records</strong><br/>
            <span style="font-size: 11px; color: #555;">Processed across all workbook worksheets successfully.</span>`;
        };

        reader.readAsBinaryString(file);
      } catch (err) {
        console.error(err);
        summaryEl.className = "reconciler-summary-box error";
        summaryEl.innerText = "An infrastructure processing exception hit the uploader stream.";
      }
    });
  });
})();
