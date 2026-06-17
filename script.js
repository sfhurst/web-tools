(function () {
  /* -------------------------------
     MAP LINKS TOOL
  --------------------------------*/

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
    const url = `https://www.google.com/maps/place/${encodeURIComponent(latDMS)}+${encodeURIComponent(lonDMS)}/@${latDec},${lonDec},17z`;
    return `=HYPERLINK("${url}","Map")`;
  }

  function processInput(text) {
    const lines = text.trim().split(/\r?\n/);
    const results = [];

    for (const line of lines) {
      // Extract first two numbers (lat/lon) from the line
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
      ta.value = text;
      ta.select();
      document.execCommand("copy");
    }
  }

  /* -------------------------------
     HOURS TOOL
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
     FOLDER BUILDER TOOL
  --------------------------------*/

  function sanitizeFolderName(name) {
    // Replace illegal characters with underscore
    let cleaned = name.replace(/[^a-zA-Z0-9 _.-]/g, "_");

    // Trim spaces and periods from ends (Windows restriction)
    cleaned = cleaned.replace(/^[ .]+|[ .]+$/g, "");

    // Prevent reserved Windows names
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
     DOM READY
  --------------------------------*/

  document.addEventListener("DOMContentLoaded", () => {
    /* MAP LINKS */
    document.getElementById("open-maplinks").addEventListener("click", () => {
      const ta = document.getElementById("coords-input");
      ta.value = "";
      document.getElementById("modal-maplinks").classList.remove("hidden");
      setTimeout(() => ta.focus(), 50);
    });

    document.getElementById("modal-cancel").addEventListener("click", () => {
      document.getElementById("modal-maplinks").classList.add("hidden");
    });

    document.getElementById("modal-generate").addEventListener("click", async () => {
      const result = processInput(document.getElementById("coords-input").value);
      await copyToClipboard(result);
      document.getElementById("modal-maplinks").classList.add("hidden");
      alert("Map links copied to clipboard.");
    });

    /* HOURS TOOL */
    document.getElementById("open-hours").addEventListener("click", async () => {
      const today = new Date();
      const start = getPayPeriodStart(today);
      const weekdays = getWeekdays(start);
      const stored = await loadHours();

      const list = document.getElementById("hours-list");
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

        if (d.toDateString() === today.toDateString()) {
          focusField = input;
        }

        list.appendChild(dateLabel);
        list.appendChild(input);
      });

      document.getElementById("modal-hours").classList.remove("hidden");
      if (focusField) focusField.focus();
    });

    document.getElementById("hours-cancel").addEventListener("click", () => {
      document.getElementById("modal-hours").classList.add("hidden");
    });

    document.getElementById("hours-save").addEventListener("click", async () => {
      const today = new Date();
      const start = getPayPeriodStart(today);
      const weekdays = getWeekdays(start);

      const inputs = document.querySelectorAll(".hours-input");
      const stored = {};

      inputs.forEach((input, i) => {
        const d = weekdays[i];
        const iso = d.toISOString().split("T")[0];
        stored[iso] = input.value.trim() || null;
      });

      await saveHours(stored);

      document.getElementById("modal-hours").classList.add("hidden");
      alert("Hours saved.");
    });

    /* FOLDER BUILDER TOOL */
    document.getElementById("open-folderbuilder").addEventListener("click", () => {
      const ta = document.getElementById("folderbuilder-input");
      ta.value = "";
      document.getElementById("folderbuilder-output").textContent = "";
      document.getElementById("modal-folderbuilder").classList.remove("hidden");
      setTimeout(() => ta.focus(), 50);
    });

    document.getElementById("folderbuilder-cancel").addEventListener("click", () => {
      document.getElementById("modal-folderbuilder").classList.add("hidden");
    });

    document.getElementById("folderbuilder-generate").addEventListener("click", async () => {
      const raw = document.getElementById("folderbuilder-input").value || "";
      const output = document.getElementById("folderbuilder-output");

      const lines = raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length === 0) {
        output.textContent = "No valid lines found.";
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

        document.getElementById("modal-folderbuilder").classList.add("hidden");

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
