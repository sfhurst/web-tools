(function () {
  /* -------------------------------
      UTILITIES & HELPERS
  --------------------------------*/

  function safeListen(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(event, callback);
    }
  }

  function toDMS(decimal, isLat) {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);

    const hemi = isLat ? (decimal >= 0 ? "N" : "S") : decimal >= 0 ? "E" : "W";

    return `${deg}°${min}'${sec}"${hemi}`;
  }

  function buildExcelHyperlink(latDec, lonDec, latDMS, lonDMS) {
    const url = `https://www.google.com/maps/place/$${encodeURIComponent(latDMS)}+${encodeURIComponent(lonDMS)}/@${latDec},${lonDec},17z`;
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

      const latDMS = toDMS(lat, true);
      const lonDMS = toDMS(lon, false);

      results.push(buildExcelHyperlink(lat, lon, latDMS, lonDMS));
    }

    return results.join("\n");
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.getElementById("hidden-output");
      if (ta) {
        ta.value = text;
        ta.select();
        document.execCommand("copy");
      }
    }
  }

  /* -------------------------------
      HOURS TOOL LOGIC
  --------------------------------*/

  const anchor = new Date(2026, 4, 11); // May 11, 2026

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

  async function loadHours() {
    const raw = localStorage.getItem("hoursData");
    return raw ? JSON.parse(raw) : {};
  }

  async function saveHours(obj) {
    localStorage.setItem("hoursData", JSON.stringify(obj));
  }

  /* -------------------------------
      FOLDER BUILDER TOOL LOGIC
  --------------------------------*/

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

  /* -------------------------------
     ROUTE OPTIMIZER ENGINE
  --------------------------------*/

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

  /* -------------------------------
      DAILY LOG TOOL LOGIC
  --------------------------------*/

  // Operational shifts: 6 AM to 5 PM
  const START_HOUR = 6;
  const TOTAL_HOURS = 12;

  function getLogHoursArray() {
    const hours = [];
    for (let i = 0; i < TOTAL_HOURS; i++) {
      const currentHour = (START_HOUR + i) % 24;
      const ampm = currentHour >= 12 ? "PM" : "AM";
      const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
      hours.push(`${displayHour}:00 ${ampm}`);
    }
    return hours;
  }

  async function loadDailyLog(dateStr) {
    const raw = localStorage.getItem(`dailyLog_${dateStr}`);
    return raw ? JSON.parse(raw) : {};
  }

  async function saveDailyLog(dateStr, data) {
    localStorage.setItem(`dailyLog_${dateStr}`, JSON.stringify(data));
  }

  /* -------------------------------
     DOM READY EVENT ATTACHMENTS
  --------------------------------*/

  document.addEventListener("DOMContentLoaded", () => {
    /* MAP LINKS TOOL */
    safeListen("open-maplinks", "click", () => {
      const ta = document.getElementById("coords-input");
      if (ta) ta.value = "";
      const modal = document.getElementById("modal-maplinks");
      if (modal) modal.classList.remove("hidden");
      setTimeout(() => {
        if (ta) ta.focus();
      }, 50);
    });

    safeListen("modal-cancel", "click", () => {
      const modal = document.getElementById("modal-maplinks");
      if (modal) modal.classList.add("hidden");
    });

    safeListen("modal-generate", "click", async () => {
      const inputEl = document.getElementById("coords-input");
      if (inputEl) {
        const result = processInput(inputEl.value);
        await copyToClipboard(result);
        const modal = document.getElementById("modal-maplinks");
        if (modal) modal.classList.add("hidden");
        alert("Map links copied to clipboard.");
      }
    });

    /* HOURS TOOL INTERACTION (With Autosave & Export) */
    safeListen("open-hours", "click", async () => {
      const today = new Date();
      const start = getPayPeriodStart(today);
      const weekdays = getWeekdays(start);
      const stored = await loadHours();

      const list = document.getElementById("hours-list");
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

        // Dynamic keyup autosave listener
        input.addEventListener("input", async () => {
          const hoursData = await loadHours();
          hoursData[input.dataset.iso] = input.value.trim() || null;
          await saveHours(hoursData);
        });

        if (d.toDateString() === today.toDateString()) {
          focusField = input;
        }

        list.appendChild(dateLabel);
        list.appendChild(input);
      });

      const modal = document.getElementById("modal-hours");
      if (modal) modal.classList.remove("hidden");
      if (focusField) focusField.focus();
    });

    safeListen("hours-cancel", "click", () => {
      const modal = document.getElementById("modal-hours");
      if (modal) modal.classList.add("hidden");
    });

    safeListen("hours-export", "click", async () => {
      const today = new Date();
      const start = getPayPeriodStart(today);
      const weekdays = getWeekdays(start);
      const stored = await loadHours();

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

      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, `Hours_Report_${today.toISOString().split("T")[0]}.txt`);
    });

    /* FOLDER BUILDER TOOL */
    safeListen("open-folderbuilder", "click", () => {
      const ta = document.getElementById("folderbuilder-input");
      if (ta) ta.value = "";
      const out = document.getElementById("folderbuilder-output");
      if (out) out.textContent = "";
      const modal = document.getElementById("modal-folderbuilder");
      if (modal) modal.classList.remove("hidden");
      setTimeout(() => {
        if (ta) ta.focus();
      }, 50);
    });

    safeListen("folderbuilder-cancel", "click", () => {
      const modal = document.getElementById("modal-folderbuilder");
      if (modal) modal.classList.add("hidden");
    });

    safeListen("folderbuilder-generate", "click", async () => {
      const rawEl = document.getElementById("folderbuilder-input");
      const output = document.getElementById("folderbuilder-output");
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
        const modal = document.getElementById("modal-folderbuilder");
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

    /* ROUTE OPTIMIZER TOOL */
    safeListen("open-routeoptimizer", "click", () => {
      const ta = document.getElementById("routeoptimizer-input");
      if (ta) ta.value = "";
      const modal = document.getElementById("modal-routeoptimizer");
      if (modal) modal.classList.remove("hidden");
      setTimeout(() => {
        if (ta) ta.focus();
      }, 50);
    });

    safeListen("routeoptimizer-cancel", "click", () => {
      const modal = document.getElementById("modal-routeoptimizer");
      if (modal) modal.classList.add("hidden");
    });

    safeListen("routeoptimizer-generate", "click", async () => {
      const inputEl = document.getElementById("routeoptimizer-input");
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

      const btn = document.getElementById("routeoptimizer-generate");
      if (btn) btn.innerText = "Optimizing Route...";

      const optimizedCoords = await getOSRMOptimizedOrder(coords);
      const url = buildGoogleMapsURL(optimizedCoords);

      if (btn) btn.innerText = "Generate Route";

      if (!url) {
        alert("Unable to build route.");
        return;
      }

      const modal = document.getElementById("modal-routeoptimizer");
      if (modal) modal.classList.add("hidden");
      window.open(url, "_blank");
    });

    /* DAILY LOG TOOL INTERACTION (With Autosave & Export) */
    safeListen("open-dailylog", "click", async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const hoursLabels = getLogHoursArray();
      const storedData = await loadDailyLog(todayStr);

      const container = document.getElementById("dailylog-container");
      if (!container) return;
      container.innerHTML = "";

      hoursLabels.forEach(hourLabel => {
        const row = document.createElement("div");
        row.className = "log-hour-row";

        const label = document.createElement("div");
        label.className = "log-time-label";
        label.textContent = hourLabel;
        row.appendChild(label);

        const quarters = ["00", "15", "30", "45"];
        quarters.forEach(q => {
          const input = document.createElement("input");
          input.type = "text";
          input.className = "quarter-input";
          input.dataset.hour = hourLabel;
          input.dataset.quarter = q;
          input.placeholder = `:${q}`;

          const lookupKey = `${hourLabel}_${q}`;
          input.value = storedData[lookupKey] ?? "";

          // Inline dynamic keystroke autosave engine
          input.addEventListener("input", async () => {
            const freshStoredData = await loadDailyLog(todayStr);
            const val = input.value.trim();

            if (val) {
              freshStoredData[lookupKey] = val;
            } else {
              delete freshStoredData[lookupKey];
            }
            await saveDailyLog(todayStr, freshStoredData);
          });

          row.appendChild(input);
        });

        container.appendChild(row);
      });

      const modal = document.getElementById("modal-dailylog");
      if (modal) modal.classList.remove("hidden");
    });

    safeListen("dailylog-cancel", "click", () => {
      const modal = document.getElementById("modal-dailylog");
      if (modal) modal.classList.add("hidden");
    });

    safeListen("dailylog-export", "click", () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const inputs = document.querySelectorAll(".quarter-input");

      let fileContent = `DAILY LOG REPORT - DATE: ${todayStr}\n`;
      fileContent += `==========================================\n\n`;

      let lastHour = "";
      inputs.forEach(input => {
        const hour = input.dataset.hour;
        const quarter = input.dataset.quarter;
        const note = input.value.trim() || "---";

        if (hour !== lastHour) {
          if (lastHour !== "") fileContent += `\n`;
          fileContent += `--- ${hour} ---------\n`;
          lastHour = hour;
        }

        const timeFormatted = hour.replace(" ", `:${quarter} `);
        fileContent += `  [${timeFormatted.padEnd(11, " ")}] ${note}\n`;
      });

      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, `Daily_Log_${todayStr}.txt`);
    });
  });
})();
