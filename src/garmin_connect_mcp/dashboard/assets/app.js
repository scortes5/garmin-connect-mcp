/* Garmin Dashboard — single-file app. Data comes from window.GARMIN_DATA (see normalize.py). */
(() => {
  "use strict";

  const RAW = window.GARMIN_DATA || {};
  const LIVE = !!window.GARMIN_LIVE;
  const AUTOSYNC = LIVE && !!window.GARMIN_AUTOSYNC;
  const TODAY = new Date().toISOString().slice(0, 10);

  // ---------------------------------------------------------------- i18n
  const I18N = {
    es: {
      tabs: { overview: "Resumen", training: "Entrenamiento", recovery: "Recuperación", sleep: "Sueño", fitness: "Fitness y salud", years: "Años", correlations: "Correlaciones", activities: "Actividades" },
      all: "Todo", last365: "12 meses", sync: "Sincronizar", syncing: "Sincronizando…", synced: "Datos actualizados",
      lastSync: "Sincronizado", days: "días", acts: "actividades", vsPrev: "vs período anterior",
      insights: "Hallazgos en tus datos", calendar: "Calendario de entrenamiento (minutos/día)", weeklyHours: "Horas por semana y deporte",
      monthlyHours: "Horas por mes y deporte", sportMix: "Resumen por deporte",
      pmc: "Forma física, fatiga y frescura", pmcHint: "CTL = carga crónica (42 días), ATL = carga aguda (7 días), TSB = CTL − ATL. TSB negativo = acumulando fatiga; positivo = fresco.",
      acwrTitle: "Carga aguda vs crónica (Garmin)", acwrHint: "Ratio óptimo entre 0,8 y 1,5. Por sobre 1,5 aumenta el riesgo de sobrecarga.",
      zones: "Tiempo en zonas de FC", teScatter: "Efecto de entrenamiento aeróbico vs anaeróbico",
      powerCurve: "Curva de potencia por año", powerHint: "Mejor potencia media sostenida para cada duración.",
      records: "Récords del período",
      hrvTitle: "HRV nocturna", hrvHint: "Banda gris = tu rango basal equilibrado según Garmin.", rhrTitle: "Frecuencia cardiaca en reposo",
      bbTitle: "Body Battery (máx. y mín. diario)", stressTitle: "Estrés promedio diario", readinessTitle: "Disposición para entrenar", respTitle: "Respiración y SpO₂",
      stagesTitle: "Fases del sueño", sleepScoreTitle: "Puntaje de sueño", scheduleTitle: "Horario de sueño", scheduleHint: "Hora de acostarse y de despertar. Mientras más planas las líneas, más regular tu ritmo.",
      weekdayTitle: "Sueño por día de la semana", sleepVsLoad: "Carga de entrenamiento vs noche siguiente", sleepVsLoadHint: "Promedio de puntaje de sueño y HRV la noche después de días con distinta carga.",
      vo2Title: "VO₂ máx.", enduranceTitle: "Endurance score", stepsTitle: "Pasos diarios", imTitle: "Minutos de intensidad semanales", imHint: "Moderados + 2× vigorosos. Meta OMS: 150 por semana.",
      weightTitle: "Peso", kcalTitle: "Calorías diarias (promedio mensual)",
      cumulative: "Acumulado anual", yearTable: "Comparación entre años", monthHeat: "Horas de entrenamiento por mes",
      corrLead: "Correlaciones calculadas con tu propio historial. Muestran qué tiende a ocurrir junto, no causa y efecto. Solo se muestran relaciones con al menos 20 días de datos y p < 0,05.",
      matrix: "Matriz de correlación (mismo día)", matrixHint: "Pearson r. Naranjo = suben juntos, azul = cuando uno sube el otro baja. Haz clic en una celda para verla.",
      explore: "Explorar relación", sameDay: "mismo día", nextDay: "día siguiente",
      search: "Buscar actividad…", allSports: "Todos los deportes",
      privacy: "Generado localmente. Tus datos no salen de este computador.", syncWarnings: "avisos de sincronización",
      noData: "Sin datos para este período.", noInsights: "Aún no hay suficientes datos para encontrar relaciones significativas en este período.",
      positive: "positiva", negative: "negativa", weak: "débil", moderate: "moderada", strong: "fuerte",
      insightBody: (x, y, hiCut, loCut, hi, lo, next) => `Con ${x} alto (≥ ${hiCut}), ${y}${next ? " del día siguiente" : ""} promedia ${hi}; con ${x} bajo (≤ ${loCut}) promedia ${lo}.`,
      date: "Fecha", sport: "Deporte", name: "Nombre", distance: "Distancia", time: "Tiempo", elev: "Desnivel", hr: "FC", power: "Potencia", np: "NP", load: "Carga", te: "TE",
      year: "Año", count: "Cantidad", hours: "Horas", km: "km", avgHr: "FC prom.", avgPower: "Pot. prom.",
      prev: "Anterior", next: "Siguiente", of: "de",
      sports: { cycling: "Ciclismo", running: "Running", swimming: "Natación", walking: "Caminata", gym: "Gimnasio", other: "Otros" },
      weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
      rec: { km: "Mayor distancia", elev: "Mayor desnivel", min: "Más larga", load: "Mayor carga", p1200: "Mejor potencia 20 min", p300: "Mejor potencia 5 min", run: "Carrera más larga", hrMax: "FC máxima registrada" },
      kpi: { acts: "Actividades", hours: "Horas", km: "Distancia", elev: "Desnivel", load: "Carga total", deepPct: "Sueño profundo", remPct: "Sueño REM", consistency: "Regularidad al acostarse", nights7: "Noches ≥ 7 h", vo2: "VO₂ máx.", weight: "Peso" },
      cumMetrics: { km: "Distancia (km)", hours: "Horas", elev: "Desnivel (m)", acts: "Actividades", load: "Carga" },
      daily: "diario", avg7: "media 7 días", baseline: "rango basal", goal: "meta",
      bins: ["Descanso", "1–75", "75–150", "150–250", "250+"],
      corrUnits: "r", nPoints: "días", slope: "pendiente", topQ: "cuartil alto", lowQ: "cuartil bajo",
      welcomeTitle: "Preparando tu dashboard", welcomeBody: "Descargando tu historial completo de Garmin Connect. La primera vez toma unos minutos; después solo se baja lo nuevo y se abre al instante.",
      preparing: "Preparando…", downloading: "Descargando", upToDate: "Al día", updated: "Actualizado", syncFailed: "No se pudo sincronizar",
      authHint: "Inicia sesión en Garmin desde una terminal con: garmin-connect-mcp auth", showingCached: "Mostrando los datos guardados.", refreshing: "Datos nuevos, actualizando…",
      sources: { daily_summaries: "Resumen diario", sleep: "Sueño", hrv: "HRV", readiness: "Disposición para entrenar", training_status: "Estado de entrenamiento", max_metrics: "VO₂ máx.", endurance: "Endurance score", body_composition: "Peso", activities: "Actividades" },
    },
    en: {
      tabs: { overview: "Overview", training: "Training", recovery: "Recovery", sleep: "Sleep", fitness: "Fitness & health", years: "Years", correlations: "Correlations", activities: "Activities" },
      all: "All", last365: "12 months", sync: "Sync", syncing: "Syncing…", synced: "Data updated",
      lastSync: "Synced", days: "days", acts: "activities", vsPrev: "vs previous period",
      insights: "Findings in your data", calendar: "Training calendar (minutes/day)", weeklyHours: "Hours per week by sport",
      monthlyHours: "Hours per month by sport", sportMix: "By sport",
      pmc: "Fitness, fatigue and form", pmcHint: "CTL = chronic load (42 days), ATL = acute load (7 days), TSB = CTL − ATL. Negative TSB = building fatigue; positive = fresh.",
      acwrTitle: "Acute vs chronic load (Garmin)", acwrHint: "Sweet spot between 0.8 and 1.5. Above 1.5 the risk of overreaching rises.",
      zones: "Time in heart-rate zones", teScatter: "Aerobic vs anaerobic training effect",
      powerCurve: "Power curve by year", powerHint: "Best average power held for each duration.",
      records: "Records in this period",
      hrvTitle: "Overnight HRV", hrvHint: "Grey band = your balanced baseline according to Garmin.", rhrTitle: "Resting heart rate",
      bbTitle: "Body Battery (daily max and min)", stressTitle: "Average daily stress", readinessTitle: "Training readiness", respTitle: "Respiration and SpO₂",
      stagesTitle: "Sleep stages", sleepScoreTitle: "Sleep score", scheduleTitle: "Sleep schedule", scheduleHint: "Bedtime and wake time. Flatter lines mean a steadier rhythm.",
      weekdayTitle: "Sleep by weekday", sleepVsLoad: "Training load vs the next night", sleepVsLoadHint: "Average sleep score and HRV the night after days with different load.",
      vo2Title: "VO₂ max", enduranceTitle: "Endurance score", stepsTitle: "Daily steps", imTitle: "Weekly intensity minutes", imHint: "Moderate + 2× vigorous. WHO target: 150 per week.",
      weightTitle: "Weight", kcalTitle: "Daily calories (monthly average)",
      cumulative: "Year to date", yearTable: "Year over year", monthHeat: "Training hours per month",
      corrLead: "Correlations computed from your own history. They show what tends to happen together, not cause and effect. Only relationships with at least 20 days of data and p < 0.05 are shown.",
      matrix: "Correlation matrix (same day)", matrixHint: "Pearson r. Orange = rise together, blue = one rises as the other falls. Click a cell to explore it.",
      explore: "Explore a relationship", sameDay: "same day", nextDay: "next day",
      search: "Search activities…", allSports: "All sports",
      privacy: "Generated locally. Your data never leaves this computer.", syncWarnings: "sync warnings",
      noData: "No data for this period.", noInsights: "Not enough data yet to find significant relationships in this period.",
      positive: "positive", negative: "negative", weak: "weak", moderate: "moderate", strong: "strong",
      insightBody: (x, y, hiCut, loCut, hi, lo, next) => `With high ${x} (≥ ${hiCut}), ${next ? "next-day " : ""}${y} averages ${hi}; with low ${x} (≤ ${loCut}) it averages ${lo}.`,
      date: "Date", sport: "Sport", name: "Name", distance: "Distance", time: "Time", elev: "Elevation", hr: "HR", power: "Power", np: "NP", load: "Load", te: "TE",
      year: "Year", count: "Count", hours: "Hours", km: "km", avgHr: "Avg HR", avgPower: "Avg power",
      prev: "Previous", next: "Next", of: "of",
      sports: { cycling: "Cycling", running: "Running", swimming: "Swimming", walking: "Walking", gym: "Gym", other: "Other" },
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      rec: { km: "Longest distance", elev: "Most climbing", min: "Longest session", load: "Highest load", p1200: "Best 20-min power", p300: "Best 5-min power", run: "Longest run", hrMax: "Highest heart rate" },
      kpi: { acts: "Activities", hours: "Hours", km: "Distance", elev: "Elevation", load: "Total load", deepPct: "Deep sleep", remPct: "REM sleep", consistency: "Bedtime consistency", nights7: "Nights ≥ 7 h", vo2: "VO₂ max", weight: "Weight" },
      cumMetrics: { km: "Distance (km)", hours: "Hours", elev: "Elevation (m)", acts: "Activities", load: "Load" },
      daily: "daily", avg7: "7-day avg", baseline: "baseline", goal: "goal",
      bins: ["Rest", "1–75", "75–150", "150–250", "250+"],
      corrUnits: "r", nPoints: "days", slope: "slope", topQ: "top quartile", lowQ: "bottom quartile",
      welcomeTitle: "Setting up your dashboard", welcomeBody: "Downloading your full Garmin Connect history. The first time takes a few minutes; after that only new data is fetched and it opens instantly.",
      preparing: "Preparing…", downloading: "Downloading", upToDate: "Up to date", updated: "Updated", syncFailed: "Sync failed",
      authHint: "Sign in to Garmin from a terminal with: garmin-connect-mcp auth", showingCached: "Showing saved data.", refreshing: "New data, refreshing…",
      sources: { daily_summaries: "Daily summary", sleep: "Sleep", hrv: "HRV", readiness: "Training readiness", training_status: "Training status", max_metrics: "VO₂ max", endurance: "Endurance score", body_composition: "Weight", activities: "Activities" },
    },
  };

  // label es, label en, unit, decimals, direction (+1 higher is better, -1 lower is better, 0 neutral)
  const METRICS = {
    steps: ["Pasos", "Steps", "", 0, 1], floors: ["Pisos", "Floors", "", 0, 1],
    kcal: ["Calorías totales", "Total calories", "kcal", 0, 0], kcalActive: ["Calorías activas", "Active calories", "kcal", 0, 1],
    imMod: ["Min. moderados", "Moderate min", "min", 0, 1], imVig: ["Min. vigorosos", "Vigorous min", "min", 0, 1],
    rhr: ["FC en reposo", "Resting HR", "lpm|bpm", 0, -1], hrMin: ["FC mínima", "Min HR", "lpm|bpm", 0, 0], hrMax: ["FC máxima", "Max HR", "lpm|bpm", 0, 0],
    stress: ["Estrés", "Stress", "", 0, -1], stressMax: ["Estrés máx.", "Max stress", "", 0, -1],
    stressHighMin: ["Estrés alto", "High stress", "min", 0, -1], stressRestMin: ["Descanso", "Rest", "min", 0, 1],
    bbMax: ["Body Battery máx.", "Body Battery max", "", 0, 1], bbMin: ["Body Battery mín.", "Body Battery min", "", 0, 1],
    bbCharged: ["Body Battery recargada", "Body Battery charged", "", 0, 1], bbDrained: ["Body Battery gastada", "Body Battery drained", "", 0, 0],
    resp: ["Respiración", "Respiration", "rpm|brpm", 1, 0], spo2: ["SpO₂", "SpO₂", "%", 0, 1],
    sleepScore: ["Puntaje de sueño", "Sleep score", "", 0, 1], sleepH: ["Horas de sueño", "Sleep hours", "h", 1, 1],
    deepH: ["Sueño profundo", "Deep sleep", "h", 2, 1], remH: ["Sueño REM", "REM sleep", "h", 2, 1],
    lightH: ["Sueño ligero", "Light sleep", "h", 2, 0], awakeH: ["Despierto", "Awake", "h", 2, -1],
    sleepNeedH: ["Necesidad de sueño", "Sleep need", "h", 1, 0],
    bedtime: ["Hora de acostarse", "Bedtime", "clock", 2, 0], wake: ["Hora de despertar", "Wake time", "clock", 2, 0],
    skinTemp: ["Desviación temp. piel", "Skin temp deviation", "°C", 1, 0], bbSleep: ["Recarga nocturna", "Overnight recharge", "", 0, 1],
    hrv: ["HRV nocturna", "Overnight HRV", "ms", 0, 1], hrvWeek: ["HRV 7 días", "HRV 7-day", "ms", 0, 1],
    readiness: ["Disposición", "Readiness", "", 0, 1], recoveryH: ["Tiempo de recuperación", "Recovery time", "h", 0, -1],
    acute: ["Carga aguda", "Acute load", "", 0, 0], chronic: ["Carga crónica", "Chronic load", "", 0, 1], acwr: ["Ratio agudo:crónico", "Acute:chronic", "", 2, 0],
    actN: ["Actividades", "Activities", "", 0, 1], actMin: ["Minutos de actividad", "Activity minutes", "min", 0, 1],
    actKm: ["Distancia", "Distance", "km", 1, 1], actElev: ["Desnivel", "Elevation", "m", 0, 1], actLoad: ["Carga de entrenamiento", "Training load", "", 0, 0],
    lastEnd: ["Hora fin entrenamiento", "Workout end time", "clock", 2, 0],
    atl: ["Fatiga (ATL)", "Fatigue (ATL)", "", 0, 0], ctl: ["Forma física (CTL)", "Fitness (CTL)", "", 0, 1], tsb: ["Frescura (TSB)", "Form (TSB)", "", 0, 0],
  };

  const SPORT_COLORS = { cycling: "#f97316", running: "#3b82f6", swimming: "#06b6d4", walking: "#22c55e", gym: "#a855f7", other: "#94a3b8" };
  const YEAR_COLORS = ["#94a3b8", "#a855f7", "#06b6d4", "#22c55e", "#3b82f6", "#eab308", "#ec4899", "#f97316"];
  const C = { accent: "#f97316", blue: "#3b82f6", green: "#16a34a", red: "#dc2626", purple: "#a855f7", teal: "#06b6d4", yellow: "#eab308", grey: "#94a3b8" };
  const SPORTS = Object.keys(SPORT_COLORS);

  // ---------------------------------------------------------------- state
  const store = {
    get(k, d) { try { return localStorage.getItem("gd." + k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gd." + k, v); } catch { /* storage unavailable */ } },
  };
  const state = {
    // ?lang=en|es wins (handy for links and screenshots), then the saved choice, then the browser.
    lang: new URLSearchParams(location.search).get("lang") || store.get("lang", (navigator.language || "es").startsWith("es") ? "es" : "en"),
    theme: store.get("theme", "auto"),
    scope: store.get("scope", "365"),
    tab: (location.hash || "").slice(1) || store.get("tab", "overview"),
    actPage: 0, actSort: ["start", -1],
    pair: ["actLoad", 1, "hrv"],
    cumMetric: "km",
  };
  const t = () => I18N[state.lang];
  const label = (m) => (METRICS[m] ? METRICS[m][state.lang === "es" ? 0 : 1] : m);
  const unit = (m) => {
    const u = METRICS[m] ? METRICS[m][2] : "";
    return u.includes("|") ? u.split("|")[state.lang === "es" ? 0 : 1] : u;
  };

  // ---------------------------------------------------------------- data
  const cols = RAW.days || { date: [] };
  const DAYS = (cols.date || []).map((date, i) => {
    const row = { date };
    for (const k of Object.keys(cols)) if (k !== "date") row[k] = cols[k][i];
    return row;
  });
  const HAS_DATA = DAYS.length > 0 || (RAW.activities || []).length > 0;
  const DAY_INDEX = new Map(DAYS.map((d, i) => [d.date, i]));
  const ACTS = (RAW.activities || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  const YEARS = (RAW.years || []).slice().sort();
  const FIRST = [DAYS[0] && DAYS[0].date, ACTS[0] && ACTS[0].date].filter(Boolean).sort()[0] || TODAY;
  if (!["all", "365", ...YEARS].includes(state.scope)) state.scope = "365";

  // ---------------------------------------------------------------- utils
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const nf = (v, d = 0) => {
    if (v == null || Number.isNaN(v)) return "–";
    if (Math.abs(v) < 0.5 * 10 ** -d) v = 0; // no "-0"
    return new Intl.NumberFormat(state.lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  };
  const clock = (h) => {
    if (h == null || Number.isNaN(h)) return "–";
    const x = ((h % 24) + 24) % 24;
    let hh = Math.floor(x), mm = Math.round((x - hh) * 60);
    if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const fmtMetric = (m, v) => (unit(m) === "clock" ? clock(v) : nf(v, METRICS[m] ? METRICS[m][3] : 1));
  const dur = (min) => {
    if (min == null) return "–";
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  };
  const vals = (rows, k) => rows.map((r) => r[k]).filter((v) => v != null && !Number.isNaN(v));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : null);
  const avgOf = (rows, k) => mean(vals(rows, k));
  const sumOf = (rows, k) => sum(vals(rows, k));
  const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(sum(a.map((v) => (v - m) ** 2)) / (a.length - 1)) : null; };
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
  const weekStart = (iso) => { const d = new Date(iso + "T12:00:00Z"); const wd = (d.getUTCDay() + 6) % 7; return addDays(iso, -wd); };
  const weekday = (iso) => (new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7;
  const rolling = (arr, n = 7) => arr.map((_, i) => {
    const w = arr.slice(Math.max(0, i - n + 1), i + 1).filter((v) => v != null);
    return w.length >= Math.ceil(n / 2) ? +(sum(w) / w.length).toFixed(2) : null;
  });
  const alpha = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const shortDate = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${+d} ${t().months[+m - 1]}${state.scope === "all" || state.scope === "365" ? " " + y.slice(2) : ""}`;
  };

  function scopeRange(scope = state.scope) {
    if (scope === "all") return [FIRST, TODAY];
    if (scope === "365") return [addDays(TODAY, -364), TODAY];
    return [`${scope}-01-01`, `${scope}-12-31` < TODAY ? `${scope}-12-31` : TODAY];
  }
  function prevRange(scope = state.scope) {
    if (scope === "all") return null;
    const [a, b] = scopeRange(scope);
    if (scope === "365") return [addDays(a, -365), addDays(a, -1)];
    const y = +scope - 1;
    return [`${y}${a.slice(4)}`, `${y}${b.slice(4)}`];
  }
  const inR = (d, r) => d >= r[0] && d <= r[1];
  const daysIn = (r) => DAYS.filter((d) => inR(d.date, r));
  const actsIn = (r) => ACTS.filter((a) => inR(a.date, r));

  function correlationScope() {
    const c = RAW.correlations;
    return c && c.scopes ? c.scopes[state.scope] || c.scopes.all : null;
  }

  // ---------------------------------------------------------------- charts
  const charts = {};
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function baseOptions() {
    const muted = css("--muted"), grid = css("--grid");
    return {
      responsive: true, maintainAspectRatio: false, animation: false, normalized: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: muted, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: { backgroundColor: css("--text"), titleColor: css("--bg"), bodyColor: css("--bg"), padding: 10, cornerRadius: 8, boxPadding: 4 },
      },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } }, grid: { display: false }, border: { color: grid } },
        y: { ticks: { color: muted, font: { size: 11 } }, grid: { color: grid }, border: { display: false } },
      },
    };
  }
  function deepMerge(a, b) {
    for (const k of Object.keys(b || {})) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  function chart(id, config) {
    const el = $(id);
    if (!el || typeof Chart === "undefined") return;
    if (charts[id]) charts[id].destroy();
    const options = deepMerge(baseOptions(), config.options || {});
    charts[id] = new Chart(el, { ...config, options });
  }
  const line = (labelText, data, color, extra = {}) => ({ type: "line", label: labelText, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 3, tension: 0.25, spanGaps: true, ...extra });
  const faint = (labelText, data, color) => line(labelText, data, alpha(color, 0.35), { borderWidth: 1, tension: 0 });
  function emptyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    const el = $(id);
    if (!el) return;
    const ctx = el.getContext("2d");
    ctx.clearRect(0, 0, el.width, el.height);
    const wrap = el.parentElement;
    if (!wrap.querySelector(".empty")) wrap.insertAdjacentHTML("beforeend", `<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">${esc(t().noData)}</div>`);
  }
  function clearEmpty(id) { const el = $(id); if (el) el.parentElement.querySelectorAll(".empty").forEach((n) => n.remove()); }

  /** Daily series chart: faint daily values + bold 7-day average, optional baseline band. */
  function seriesChart(id, rows, metrics, opts = {}) {
    clearEmpty(id);
    if (!rows.length || metrics.every((m) => !vals(rows, m.key).length)) return emptyChart(id);
    const labels = rows.map((r) => r.date);
    const datasets = [];
    for (const m of metrics) {
      const data = rows.map((r) => r[m.key] ?? null);
      // No spanGaps: weeks without the watch should read as gaps, not as straight lines.
      if (m.raw) datasets.push(line(m.label || label(m.key), data, m.color, { yAxisID: m.axis || "y", borderWidth: 1.6, spanGaps: false }));
      else {
        datasets.push({ ...faint(`${m.label || label(m.key)} (${t().daily})`, data, m.color), yAxisID: m.axis || "y", spanGaps: false });
        datasets.push(line(`${m.label || label(m.key)} (${t().avg7})`, rolling(data), m.color, { yAxisID: m.axis || "y", spanGaps: false }));
      }
    }
    if (opts.band) {
      const [lo, hi] = opts.band;
      datasets.unshift(
        line(t().baseline, rows.map((r) => r[hi] ?? null), "transparent", { backgroundColor: alpha(C.grey, 0.18), fill: "+1", borderWidth: 0 }),
        line("", rows.map((r) => r[lo] ?? null), "transparent", { borderWidth: 0 }),
      );
    }
    chart(id, {
      data: { labels, datasets },
      options: {
        plugins: { legend: { labels: { filter: (item) => !!item.text } }, tooltip: { callbacks: { title: (items) => items[0] && shortDate(items[0].label) } } },
        scales: { x: { ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } }, ...(opts.scales || {}) },
      },
    });
  }

  // ---------------------------------------------------------------- shell
  function renderShell() {
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.theme = state.theme === "auto" ? "" : state.theme;
    $("lang-btn").textContent = state.lang === "es" ? "EN" : "ES";
    $("theme-btn").textContent = { auto: "◐", dark: "☾", light: "☀" }[state.theme];
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t()[el.dataset.i18n] ?? ""; });

    const scopes = [["365", t().last365], ...YEARS.slice().reverse().map((y) => [y, y]), ["all", t().all]];
    $("scopes").innerHTML = scopes.map(([k, v]) => `<button class="chip" role="tab" data-scope="${k}" aria-selected="${k === state.scope}">${esc(v)}</button>`).join("");

    $("tabs").innerHTML = Object.entries(t().tabs).map(([k, v]) => `<button class="tab" data-tab="${k}" aria-selected="${k === state.tab}">${esc(v)}</button>`).join("");
    document.querySelectorAll("main > section").forEach((s) => s.classList.toggle("active", s.dataset.tab === state.tab));

    const last = RAW.lastSync && !LIVE ? new Date(RAW.lastSync) : null; // the app shows it in the sync pill
    $("sync-info").textContent = [
      last ? `${t().lastSync} ${last.toLocaleString(state.lang, { dateStyle: "medium", timeStyle: "short" })}` : "",
      HAS_DATA ? `${nf(DAYS.length)} ${t().days} · ${nf(ACTS.length)} ${t().acts}` : "",
    ].filter(Boolean).join(" · ");

    $("sync-btn").hidden = !LIVE;
    $("sync-btn").textContent = sync.running ? t().syncing : t().sync;
    $("sync-btn").disabled = sync.running;
    renderSyncStatus();
    const errs = RAW.syncErrors || [];
    $("errors").textContent = errs.length ? `⚠ ${errs.length} ${t().syncWarnings}` : "";
    $("errors").title = errs.map((e) => `${e.source} ${e.window}: ${e.error}`).join("\n");
    $("act-search").placeholder = t().search;
  }

  // ---------------------------------------------------------------- KPIs
  /**
   * delta: {value, direction, mode: "pct" | "abs", digits, unit}. Colour follows whether the
   * change is good for that metric (lower resting HR is good, lower sleep is not).
   */
  function kpiCard(labelText, value, unitText, delta) {
    let d = "";
    if (delta && delta.value != null && Number.isFinite(delta.value)) {
      const { value: v, direction, mode = "pct", digits = 0, unit: u = "" } = delta;
      const tiny = mode === "pct" ? Math.abs(v) < 0.5 : Math.abs(v) < Math.pow(10, -digits) / 2;
      const cls = tiny || !direction ? "flat" : (v > 0) === (direction > 0) ? "good" : "bad";
      const text = `${v > 0 ? "+" : ""}${nf(v, mode === "pct" ? 0 : digits)}${mode === "pct" ? "%" : u ? " " + u : ""}`;
      d = `<div class="delta ${cls}" title="${esc(t().vsPrev)}">${text} ${state.lang === "es" ? "vs ant." : "vs prev."}</div>`;
    }
    return `<div class="kpi"><div class="label">${esc(labelText)}</div><div class="value">${value}<small>${esc(unitText || "")}</small></div>${d}</div>`;
  }
  const pct = (a, b) => (a != null && b ? ((a - b) / Math.abs(b)) * 100 : null);
  const diff = (a, b) => (a != null && b != null ? a - b : null);
  /** Change of a daily average vs the previous period: % for big counts, absolute otherwise. */
  function avgDelta(m, dr, dp, p) {
    if (!p || unit(m) === "clock") return null;
    const a = avgOf(dr, m), b = avgOf(dp, m);
    const asPct = ["steps", "kcal", "kcalActive", "floors"].includes(m);
    return { value: asPct ? pct(a, b) : diff(a, b), direction: METRICS[m][4], mode: asPct ? "pct" : "abs", digits: METRICS[m][3], unit: unit(m) };
  }

  function totals(acts) {
    return { acts: acts.length, hours: sumOf(acts, "min") / 60, km: sumOf(acts, "km"), elev: sumOf(acts, "elev"), load: sumOf(acts, "load") };
  }

  function latestIn(list, r, filter = () => true) {
    const rows = list.filter((x) => inR(x.date, r) && filter(x));
    return rows.length ? rows[rows.length - 1] : null;
  }

  function renderKpis() {
    const r = scopeRange(), p = prevRange();
    const cur = totals(actsIn(r)), prev = p ? totals(actsIn(p)) : null;
    const dr = daysIn(r), dp = p ? daysIn(p) : [];
    const K = t().kpi;
    const avgKpi = (m) => kpiCard(label(m), fmtMetric(m, avgOf(dr, m)), unit(m) === "clock" ? "" : unit(m), avgDelta(m, dr, dp, p));
    const vo2 = latestIn(RAW.vo2 || [], r, (x) => x.sport === "cycling") || latestIn(RAW.vo2 || [], r);
    const w = latestIn(RAW.weight || [], r);
    const html = [
      kpiCard(K.acts, nf(cur.acts), "", prev && { value: pct(cur.acts, prev.acts), direction: 1 }),
      kpiCard(K.hours, nf(cur.hours, 0), "h", prev && { value: pct(cur.hours, prev.hours), direction: 1 }),
      kpiCard(K.km, nf(cur.km, 0), "km", prev && { value: pct(cur.km, prev.km), direction: 1 }),
      kpiCard(K.elev, nf(cur.elev, 0), "m", prev && { value: pct(cur.elev, prev.elev), direction: 1 }),
      kpiCard(K.load, nf(cur.load, 0), "", prev && { value: pct(cur.load, prev.load), direction: 1 }),
      avgKpi("rhr"), avgKpi("hrv"), avgKpi("sleepScore"), avgKpi("sleepH"), avgKpi("steps"), avgKpi("stress"), avgKpi("bbMax"), avgKpi("readiness"),
      vo2 ? kpiCard(`${K.vo2} (${t().sports[vo2.sport]})`, nf(vo2.value, 1), "") : "",
      w ? kpiCard(K.weight, nf(w.kg, 1), "kg") : "",
    ];
    $("kpis").innerHTML = html.join("");
  }

  // ---------------------------------------------------------------- insights
  function strength(r) { const a = Math.abs(r); return a < 0.2 ? t().weak : a < 0.4 ? t().moderate : t().strong; }
  function significantPairs() {
    const sc = correlationScope();
    if (!sc) return [];
    return sc.pairs.filter((p) => p.p < 0.05 && Math.abs(p.r) >= 0.12).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }
  function insightCard(p) {
    const tx = t();
    const xs = label(p.x), ys = label(p.y);
    const body = tx.insightBody(xs, ys, `${fmtMetric(p.x, p.hiCut)}${unit(p.x) && unit(p.x) !== "clock" ? " " + unit(p.x) : ""}`, fmtMetric(p.x, p.loCut), `${fmtMetric(p.y, p.hiMean)}${unit(p.y) && unit(p.y) !== "clock" ? " " + unit(p.y) : ""}`, fmtMetric(p.y, p.loMean), p.lag === 1);
    const cls = p.r > 0 ? "pos" : "neg";
    return `<div class="insight" data-pair="${p.x}|${p.lag}|${p.y}">
      <div class="title">${esc(label(p.x))} → ${esc(label(p.y))}${p.lag ? ` <span class="muted">(${tx.nextDay})</span>` : ""}</div>
      <div class="body">${esc(body)}</div>
      <div class="meta"><span class="badge ${cls}">${esc(p.r > 0 ? tx.positive : tx.negative)} · ${esc(strength(p.r))}</span>r = ${nf(p.r, 2)} · ρ = ${nf(p.rho, 2)} · n = ${nf(p.n)} · p = ${p.p < 0.001 ? "<0.001" : nf(p.p, 3)}</div>
    </div>`;
  }
  function renderInsights(target, limit) {
    const list = significantPairs().slice(0, limit);
    $(target).innerHTML = list.length ? list.map(insightCard).join("") : `<div class="empty">${esc(t().noInsights)}</div>`;
  }

  // ---------------------------------------------------------------- overview
  function renderCalendar() {
    let [a, b] = scopeRange();
    if (daysBetween(a, b) > 371) a = addDays(b, -364);
    const start = weekStart(a);
    const weeks = Math.ceil((daysBetween(start, b) + 1) / 7);
    const minutes = new Map();
    for (const act of ACTS) if (inR(act.date, [a, b])) minutes.set(act.date, (minutes.get(act.date) || 0) + (act.min || 0));
    const sizes = [0, 20, 45, 90, 150];
    const level = (m) => (m <= 0 ? 0 : m < sizes[2] ? 1 : m < sizes[3] ? 2 : m < sizes[4] ? 3 : 4);
    const fills = [css("--surface-2"), alpha(C.accent, 0.3), alpha(C.accent, 0.55), alpha(C.accent, 0.8), C.accent];
    const cell = 12, gap = 3, top = 16, left = 28;
    let svg = "";
    let lastMonth = -1, lastLabelWeek = -9;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const iso = addDays(start, w * 7 + d);
        if (iso < a || iso > b) continue;
        const m = minutes.get(iso) || 0;
        svg += `<rect x="${left + w * (cell + gap)}" y="${top + d * (cell + gap)}" width="${cell}" height="${cell}" fill="${fills[level(m)]}"><title>${iso} · ${dur(m)}</title></rect>`;
        const month = +iso.slice(5, 7) - 1;
        if (month !== lastMonth) {
          // Skip a label that would collide with the previous one (partial first month).
          if (w - lastLabelWeek >= 3) { svg += `<text x="${left + w * (cell + gap)}" y="10">${t().months[month]}</text>`; lastLabelWeek = w; }
          lastMonth = month;
        }
      }
    }
    [0, 2, 4].forEach((d) => { svg += `<text x="0" y="${top + d * (cell + gap) + 10}">${t().weekdays[d]}</text>`; });
    const width = left + weeks * (cell + gap), height = top + 7 * (cell + gap);
    $("calendar").innerHTML = `<svg width="${width}" height="${height}" role="img">${svg}</svg>
      <div class="legend">0 ${fills.map((f) => `<i style="background:${f}"></i>`).join("")} ${sizes[4]}+ min</div>`;
  }

  function sportStack(id, acts, bucket, bucketLabel) {
    clearEmpty(id);
    if (!acts.length) return emptyChart(id);
    const keys = [...new Set(acts.map((a) => bucket(a.date)))].sort();
    const r = scopeRange();
    // Fill empty buckets so gaps in training show as gaps.
    if (keys.length) {
      const all = [];
      for (let d = r[0]; d <= r[1]; d = addDays(d, 1)) all.push(bucket(d));
      keys.splice(0, keys.length, ...[...new Set(all)].sort());
    }
    const datasets = SPORTS.map((s) => {
      const per = new Map();
      for (const a of acts) if (a.sport === s) per.set(bucket(a.date), (per.get(bucket(a.date)) || 0) + (a.min || 0) / 60);
      return { type: "bar", label: t().sports[s], data: keys.map((k) => +(per.get(k) || 0).toFixed(2)), backgroundColor: SPORT_COLORS[s], stack: "s", borderRadius: 2 };
    }).filter((ds) => ds.data.some((v) => v > 0));
    chart(id, {
      data: { labels: keys, datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        plugins: { tooltip: { callbacks: { title: (it) => bucketLabel(it[0].label), label: (c) => `${c.dataset.label}: ${dur(c.raw * 60)}` } } },
        scales: { x: { stacked: true, ticks: { callback(v) { return bucketLabel(this.getLabelForValue(v)); } } }, y: { stacked: true, title: { display: true, text: "h", color: css("--muted") } } },
      },
    });
  }
  const monthLabel = (k) => `${t().months[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`;

  function renderOverview() {
    renderKpis();
    renderInsights("insights", 6);
    renderCalendar();
    const acts = actsIn(scopeRange());
    const span = daysBetween(...scopeRange());
    if (span > 800) sportStack("c-weekly", acts, (d) => d.slice(0, 7), monthLabel);
    else sportStack("c-weekly", acts, weekStart, shortDate);
  }

  // ---------------------------------------------------------------- training
  function renderTraining() {
    const r = scopeRange();
    const acts = actsIn(r), rows = daysIn(r);
    sportStack("c-monthly", acts, (d) => d.slice(0, 7), monthLabel);

    // Sport table
    const bySport = SPORTS.map((s) => [s, acts.filter((a) => a.sport === s)]).filter(([, l]) => l.length);
    const tx = t();
    $("sport-table").innerHTML = bySport.length ? `<div class="table-wrap"><table><thead><tr><th>${tx.sport}</th><th>${tx.count}</th><th>${tx.hours}</th><th>${tx.km}</th><th>${tx.elev}</th><th>${tx.avgHr}</th><th>${tx.avgPower}</th><th>${tx.load}</th></tr></thead><tbody>${bySport.map(([s, l]) => `<tr><td><span class="dot" style="background:${SPORT_COLORS[s]}"></span>${tx.sports[s]}</td><td>${l.length}</td><td>${nf(sumOf(l, "min") / 60, 1)}</td><td>${nf(sumOf(l, "km"), 0)}</td><td>${nf(sumOf(l, "elev"), 0)}</td><td>${nf(avgOf(l, "hr"), 0)}</td><td>${nf(avgOf(l, "watts"), 0)}</td><td>${nf(sumOf(l, "load"), 0)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${tx.noData}</div>`;

    // PMC
    clearEmpty("c-pmc");
    if (rows.some((d) => d.ctl)) {
      chart("c-pmc", {
        data: {
          labels: rows.map((d) => d.date),
          datasets: [
            { type: "bar", label: label("tsb"), data: rows.map((d) => d.tsb), backgroundColor: rows.map((d) => alpha((d.tsb || 0) >= 0 ? C.green : C.red, 0.35)), yAxisID: "y", barPercentage: 1, categoryPercentage: 1 },
            line(label("ctl"), rows.map((d) => d.ctl), C.blue, { borderWidth: 2.5 }),
            line(label("atl"), rows.map((d) => d.atl), C.accent, { borderWidth: 1.5 }),
            { type: "bar", label: label("actLoad"), data: rows.map((d) => d.actLoad || null), backgroundColor: alpha(C.grey, 0.5), yAxisID: "y2", barPercentage: 0.6 },
          ],
        },
        options: {
          plugins: { tooltip: { callbacks: { title: (it) => shortDate(it[0].label) } } },
          scales: { x: { ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } }, y2: { position: "right", grid: { display: false }, ticks: { color: css("--muted") } } },
        },
      });
    } else emptyChart("c-pmc");

    // ACWR
    seriesChart("c-acwr", rows, [
      { key: "acute", color: C.accent, raw: true }, { key: "chronic", color: C.blue, raw: true },
      { key: "acwr", color: C.purple, raw: true, axis: "y2" },
    ], { scales: { y2: { position: "right", min: 0, max: 2.5, grid: { display: false }, ticks: { color: css("--muted") } } } });

    // Zones
    clearEmpty("c-zones");
    const zones = [0, 0, 0, 0, 0];
    for (const a of acts) (a.zones || []).forEach((m, i) => { zones[i] += m || 0; });
    if (sum(zones) > 0) {
      const total = sum(zones);
      chart("c-zones", {
        type: "bar",
        data: { labels: ["Z1", "Z2", "Z3", "Z4", "Z5"], datasets: [{ label: tx.hours, data: zones.map((m) => +(m / 60).toFixed(1)), backgroundColor: [C.grey, C.blue, C.green, C.accent, C.red], borderRadius: 6 }] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${dur(zones[c.dataIndex])} · ${nf((zones[c.dataIndex] / total) * 100, 0)}%` } } } },
      });
    } else emptyChart("c-zones");

    // Training effect scatter
    clearEmpty("c-te");
    const withTe = acts.filter((a) => a.te != null);
    if (withTe.length) {
      chart("c-te", {
        type: "scatter",
        data: { datasets: SPORTS.map((s) => ({ label: t().sports[s], data: withTe.filter((a) => a.sport === s).map((a) => ({ x: a.te, y: a.ta ?? 0, name: a.name, date: a.date })), backgroundColor: alpha(SPORT_COLORS[s], 0.65), pointRadius: 4 })).filter((d) => d.data.length) },
        options: {
          interaction: { mode: "nearest", intersect: true },
          plugins: { tooltip: { callbacks: { label: (c) => `${c.raw.date} · ${c.raw.name} · TE ${c.raw.x}/${c.raw.y}` } } },
          scales: { x: { min: 0, max: 5, title: { display: true, text: state.lang === "es" ? "Aeróbico" : "Aerobic", color: css("--muted") } }, y: { min: 0, max: 5, title: { display: true, text: state.lang === "es" ? "Anaeróbico" : "Anaerobic", color: css("--muted") } } },
        },
      });
    } else emptyChart("c-te");

    // Power curve per year
    clearEmpty("c-power");
    const durations = ["5", "10", "30", "60", "120", "300", "600", "1200", "1800", "3600"];
    const durLabel = (s) => (+s < 60 ? `${s}s` : `${+s / 60}m`);
    const powered = ACTS.filter((a) => a.power);
    if (powered.length) {
      const years = [...new Set(powered.map((a) => a.date.slice(0, 4)))].sort();
      chart("c-power", {
        type: "line",
        data: {
          labels: durations.map(durLabel),
          datasets: years.map((y, i) => {
            const best = durations.map((d) => Math.max(0, ...powered.filter((a) => a.date.startsWith(y)).map((a) => a.power[d] || 0)) || null);
            const highlight = state.scope === y || (state.scope !== "all" && state.scope !== "365" ? false : i === years.length - 1);
            return line(y, best, YEAR_COLORS[(YEAR_COLORS.length - years.length + i + YEAR_COLORS.length) % YEAR_COLORS.length], { borderWidth: highlight ? 3 : 1.5, pointRadius: 2, tension: 0.3 });
          }),
        },
        options: { scales: { y: { title: { display: true, text: "W", color: css("--muted") } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw ?? "–"} W` } } } },
      });
    } else emptyChart("c-power");

    // Records
    const best = (list, key) => list.filter((a) => a[key] != null).sort((a, b) => b[key] - a[key])[0];
    const bestPower = (secs) => acts.filter((a) => a.power && a.power[secs]).sort((a, b) => b.power[secs] - a.power[secs])[0];
    const recs = [
      [tx.rec.km, best(acts, "km"), (a) => `${nf(a.km, 1)} km`],
      [tx.rec.elev, best(acts, "elev"), (a) => `${nf(a.elev)} m`],
      [tx.rec.min, best(acts, "min"), (a) => dur(a.min)],
      [tx.rec.load, best(acts, "load"), (a) => nf(a.load)],
      [tx.rec.p1200, bestPower("1200"), (a) => `${a.power["1200"]} W`],
      [tx.rec.p300, bestPower("300"), (a) => `${a.power["300"]} W`],
      [tx.rec.run, best(acts.filter((a) => a.sport === "running"), "km"), (a) => `${nf(a.km, 1)} km`],
      [tx.rec.hrMax, best(acts, "hrMax"), (a) => `${a.hrMax} ${unit("rhr")}`],
    ].filter(([, a]) => a);
    $("records").innerHTML = recs.length ? recs.map(([l, a, f]) => `<div class="record"><div class="label">${esc(l)}</div><div class="value">${esc(f(a))}</div><div class="sub" title="${esc(a.name)}">${esc(a.date)} · ${esc(a.name)}</div></div>`).join("") : `<div class="empty">${tx.noData}</div>`;
  }

  // ---------------------------------------------------------------- recovery
  function avgKpiRow(target, metrics, extra = []) {
    const r = scopeRange(), p = prevRange();
    const dr = daysIn(r), dp = p ? daysIn(p) : [];
    $(target).innerHTML = metrics
      .map((m) => kpiCard(label(m), fmtMetric(m, avgOf(dr, m)), unit(m) === "clock" ? "" : unit(m), avgDelta(m, dr, dp, p)))
      .concat(extra).join("");
  }

  function renderRecovery() {
    const rows = daysIn(scopeRange());
    avgKpiRow("kpis-recovery", ["hrv", "rhr", "stress", "bbMax", "bbCharged", "readiness", "resp", "spo2"]);
    seriesChart("c-hrv", rows, [{ key: "hrv", color: C.purple }], { band: ["hrvLow", "hrvHigh"] });
    seriesChart("c-rhr", rows, [{ key: "rhr", color: C.red }]);
    seriesChart("c-bb", rows, [{ key: "bbMax", color: C.green }, { key: "bbMin", color: C.yellow }], { scales: { y: { min: 0, max: 100 } } });
    seriesChart("c-stress", rows, [{ key: "stress", color: C.accent }]);
    seriesChart("c-ready", rows, [{ key: "readiness", color: C.teal }], { scales: { y: { min: 0, max: 100 } } });
    seriesChart("c-resp", rows, [{ key: "resp", color: C.blue }, { key: "spo2", color: C.teal, axis: "y2" }], { scales: { y2: { position: "right", grid: { display: false }, ticks: { color: css("--muted") } } } });
  }

  // ---------------------------------------------------------------- sleep
  function renderSleep() {
    const rows = daysIn(scopeRange()).filter((d) => d.sleepH);
    const tx = t();
    const total = sumOf(rows, "sleepH");
    const bed = vals(rows, "bedtime");
    avgKpiRow("kpis-sleep", ["sleepH", "sleepScore", "bedtime", "wake"], [
      kpiCard(tx.kpi.deepPct, total ? nf((sumOf(rows, "deepH") / total) * 100, 0) : "–", "%"),
      kpiCard(tx.kpi.remPct, total ? nf((sumOf(rows, "remH") / total) * 100, 0) : "–", "%"),
      kpiCard(tx.kpi.consistency, bed.length > 2 ? `± ${nf(sd(bed) * 60, 0)}` : "–", "min"),
      kpiCard(tx.kpi.nights7, rows.length ? nf((rows.filter((d) => d.sleepH >= 7).length / rows.length) * 100, 0) : "–", "%"),
    ]);

    // Stages: daily for short ranges, weekly averages for long ones.
    clearEmpty("c-stages");
    if (rows.length) {
      const weekly = rows.length > 120;
      const groups = new Map();
      for (const d of rows) {
        const k = weekly ? weekStart(d.date) : d.date;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(d);
      }
      const keys = [...groups.keys()].sort();
      const stage = (k, color, name) => ({ type: "bar", label: name, data: keys.map((g) => +(avgOf(groups.get(g), k) || 0).toFixed(2)), backgroundColor: color, stack: "s", barPercentage: 0.95, categoryPercentage: 0.95 });
      chart("c-stages", {
        data: {
          labels: keys,
          datasets: [
            stage("deepH", "#1e40af", label("deepH")), stage("lightH", "#60a5fa", label("lightH")), stage("remH", "#a855f7", label("remH")), stage("awakeH", "#f472b6", label("awakeH")),
            line(label("sleepScore"), keys.map((g) => avgOf(groups.get(g), "sleepScore")), C.accent, { yAxisID: "y2" }),
          ],
        },
        options: {
          plugins: { tooltip: { callbacks: { title: (it) => shortDate(it[0].label), label: (c) => `${c.dataset.label}: ${c.dataset.yAxisID === "y2" ? nf(c.raw) : dur(c.raw * 60)}` } } },
          scales: { x: { stacked: true, ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } }, y: { stacked: true, title: { display: true, text: "h", color: css("--muted") } }, y2: { position: "right", min: 0, max: 100, grid: { display: false }, ticks: { color: css("--muted") } } },
        },
      });
    } else emptyChart("c-stages");

    seriesChart("c-sleepscore", daysIn(scopeRange()), [{ key: "sleepScore", color: C.purple }]);
    seriesChart("c-schedule", rows, [{ key: "bedtime", color: C.blue }, { key: "wake", color: C.yellow }], {
      scales: { y: { ticks: { callback: (v) => clock(v) } } },
    });
    if (charts["c-schedule"]) {
      charts["c-schedule"].options.plugins.tooltip.callbacks.label = (c) => `${c.dataset.label}: ${clock(c.raw)}`;
      charts["c-schedule"].update();
    }

    // Weekday profile
    clearEmpty("c-weekday");
    if (rows.length) {
      const by = [0, 1, 2, 3, 4, 5, 6].map((w) => rows.filter((d) => weekday(d.date) === w));
      chart("c-weekday", {
        data: {
          labels: tx.weekdays,
          datasets: [
            { type: "bar", label: label("sleepH"), data: by.map((l) => avgOf(l, "sleepH")), backgroundColor: alpha(C.blue, 0.7), borderRadius: 6 },
            line(label("sleepScore"), by.map((l) => avgOf(l, "sleepScore")), C.accent, { yAxisID: "y2", pointRadius: 3 }),
          ],
        },
        options: { scales: { y: { min: 0 }, y2: { position: "right", min: 0, max: 100, grid: { display: false }, ticks: { color: css("--muted") } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.dataset.yAxisID === "y2" ? nf(c.raw) : dur(c.raw * 60)}` } } } },
      });
    } else emptyChart("c-weekday");

    // Load bins -> next night
    clearEmpty("c-sleepload");
    const all = daysIn(scopeRange());
    const edges = [0, 1, 75, 150, 250, Infinity];
    const bins = tx.bins.map(() => ({ score: [], hrv: [] }));
    for (const d of all) {
      const next = DAYS[DAY_INDEX.get(addDays(d.date, 1))];
      if (!next) continue;
      const load = d.actLoad || 0;
      const i = load === 0 ? 0 : edges.findIndex((e, k) => load >= e && load < edges[k + 1]);
      if (i < 0) continue;
      if (next.sleepScore != null) bins[i].score.push(next.sleepScore);
      if (next.hrv != null) bins[i].hrv.push(next.hrv);
    }
    if (bins.some((b) => b.score.length)) {
      chart("c-sleepload", {
        data: {
          labels: tx.bins.map((b, i) => `${b} (${bins[i].score.length})`),
          datasets: [
            { type: "bar", label: label("sleepScore"), data: bins.map((b) => mean(b.score)), backgroundColor: alpha(C.purple, 0.7), borderRadius: 6 },
            { type: "bar", label: label("hrv"), data: bins.map((b) => mean(b.hrv)), backgroundColor: alpha(C.teal, 0.7), borderRadius: 6, yAxisID: "y2" },
          ],
        },
        options: { scales: { y: { min: 0, max: 100 }, y2: { position: "right", grid: { display: false }, ticks: { color: css("--muted") } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${nf(c.raw, 1)}` } } } },
      });
    } else emptyChart("c-sleepload");
  }

  // ---------------------------------------------------------------- fitness
  function renderFitness() {
    const r = scopeRange();
    const rows = daysIn(r);
    // VO2 max
    clearEmpty("c-vo2");
    const vo2 = (RAW.vo2 || []).filter((x) => inR(x.date, r));
    if (vo2.length) {
      const labels = [...new Set(vo2.map((x) => x.date))].sort();
      const ds = ["cycling", "running"].map((s) => {
        const m = new Map(vo2.filter((x) => x.sport === s).map((x) => [x.date, x.value]));
        return line(t().sports[s], labels.map((d) => m.get(d) ?? null), SPORT_COLORS[s], { pointRadius: 2, stepped: true });
      }).filter((d) => d.data.some((v) => v != null));
      chart("c-vo2", { data: { labels, datasets: ds }, options: { scales: { x: { ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } } } } });
    } else emptyChart("c-vo2");

    // Endurance
    clearEmpty("c-endurance");
    const end = (RAW.endurance || []).filter((x) => inR(x.date, r));
    if (end.length) chart("c-endurance", { data: { labels: end.map((x) => x.date), datasets: [line(t().enduranceTitle, end.map((x) => x.value), C.accent, { pointRadius: 2, fill: true, backgroundColor: alpha(C.accent, 0.12) })] }, options: { scales: { x: { ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } } } } });
    else emptyChart("c-endurance");

    seriesChart("c-steps", rows, [{ key: "steps", color: C.green }]);

    // Intensity minutes per week
    clearEmpty("c-im");
    const weeks = new Map();
    for (const d of rows) {
      const k = weekStart(d.date);
      weeks.set(k, (weeks.get(k) || 0) + (d.imMod || 0) + 2 * (d.imVig || 0));
    }
    if ([...weeks.values()].some((v) => v > 0)) {
      const keys = [...weeks.keys()].sort();
      chart("c-im", {
        data: { labels: keys, datasets: [
          { type: "bar", label: "min", data: keys.map((k) => weeks.get(k)), backgroundColor: keys.map((k) => alpha(weeks.get(k) >= 150 ? C.green : C.grey, 0.75)), borderRadius: 3 },
          line(t().goal, keys.map(() => 150), C.red, { borderDash: [5, 4], borderWidth: 1.5 }),
        ] },
        options: { scales: { x: { ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } } } },
      });
    } else emptyChart("c-im");

    // Weight
    clearEmpty("c-weight");
    const w = (RAW.weight || []).filter((x) => inR(x.date, r));
    if (w.length) chart("c-weight", { data: { labels: w.map((x) => x.date), datasets: [line("kg", w.map((x) => x.kg), C.blue, { pointRadius: 3 })] }, options: { scales: { x: { ticks: { callback(v) { return shortDate(this.getLabelForValue(v)); } } } } } });
    else emptyChart("c-weight");

    // Calories per month
    clearEmpty("c-kcal");
    const months = new Map();
    for (const d of rows) {
      if (d.kcal == null) continue;
      const k = d.date.slice(0, 7);
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(d);
    }
    if (months.size) {
      const keys = [...months.keys()].sort();
      chart("c-kcal", {
        data: { labels: keys, datasets: [
          { type: "bar", label: label("kcalActive"), data: keys.map((k) => Math.round(avgOf(months.get(k), "kcalActive") || 0)), backgroundColor: C.accent, stack: "k", borderRadius: 2 },
          { type: "bar", label: state.lang === "es" ? "Basal" : "Resting", data: keys.map((k) => Math.round((avgOf(months.get(k), "kcal") || 0) - (avgOf(months.get(k), "kcalActive") || 0))), backgroundColor: alpha(C.grey, 0.5), stack: "k", borderRadius: 2 },
        ] },
        options: { scales: { x: { stacked: true, ticks: { callback(v) { return monthLabel(this.getLabelForValue(v)); } } }, y: { stacked: true } } },
      });
    } else emptyChart("c-kcal");
  }

  // ---------------------------------------------------------------- years
  function renderYears() {
    const tx = t();
    const sel = $("cum-metric");
    sel.innerHTML = Object.entries(tx.cumMetrics).map(([k, v]) => `<option value="${k}" ${k === state.cumMetric ? "selected" : ""}>${esc(v)}</option>`).join("");
    const pick = { km: (a) => a.km || 0, hours: (a) => (a.min || 0) / 60, elev: (a) => a.elev || 0, acts: () => 1, load: (a) => a.load || 0 }[state.cumMetric];

    clearEmpty("c-cumulative");
    if (YEARS.length && ACTS.length) {
      const doy = (iso) => daysBetween(`${iso.slice(0, 4)}-01-01`, iso);
      const labels = Array.from({ length: 366 }, (_, i) => i);
      const datasets = YEARS.map((y, i) => {
        const perDay = new Array(366).fill(0);
        for (const a of ACTS) if (a.date.startsWith(y)) perDay[doy(a.date)] += pick(a);
        const lastDay = y === TODAY.slice(0, 4) ? doy(TODAY) : 365;
        let acc = 0;
        const data = perDay.map((v, d) => { acc += v; return d <= lastDay ? +acc.toFixed(1) : null; });
        const color = YEAR_COLORS[(YEAR_COLORS.length - YEARS.length + i + YEAR_COLORS.length) % YEAR_COLORS.length];
        const strong = state.scope === y || ((state.scope === "365" || state.scope === "all") && i === YEARS.length - 1);
        return line(y, data, color, { borderWidth: strong ? 3.2 : 1.6, tension: 0 });
      });
      chart("c-cumulative", {
        data: { labels, datasets },
        options: {
          plugins: { tooltip: { callbacks: { title: (it) => { const d = new Date(Date.UTC(2023, 0, 1 + +it[0].label)); return `${d.getUTCDate()} ${tx.months[d.getUTCMonth()]}`; }, label: (c) => `${c.dataset.label}: ${nf(c.raw, state.cumMetric === "hours" ? 1 : 0)}` } } },
          // One label per month start; autoSkip would land on arbitrary days and drop them.
          scales: { x: { ticks: { autoSkip: false, maxTicksLimit: 400, callback(v) { const d = new Date(Date.UTC(2023, 0, 1 + v)); return d.getUTCDate() === 1 ? tx.months[d.getUTCMonth()] : null; } } } },
        },
      });
    } else emptyChart("c-cumulative");

    // Year table
    const rows = YEARS.slice().reverse().map((y) => {
      const r = [`${y}-01-01`, `${y}-12-31`];
      const a = actsIn(r), d = daysIn(r);
      const vo2 = latestIn(RAW.vo2 || [], r, (x) => x.sport === "cycling") || latestIn(RAW.vo2 || [], r);
      return [y, a.length, nf(sumOf(a, "min") / 60, 0), nf(sumOf(a, "km"), 0), nf(sumOf(a, "elev"), 0), nf(sumOf(a, "load"), 0), nf(avgOf(d, "rhr"), 0), nf(avgOf(d, "hrv"), 0), nf(avgOf(d, "sleepScore"), 0), nf(avgOf(d, "sleepH"), 1), nf(avgOf(d, "steps"), 0), nf(avgOf(d, "stress"), 0), vo2 ? nf(vo2.value, 1) : "–"];
    });
    const heads = [tx.year, tx.kpi.acts, tx.hours, "km", `${tx.elev} (m)`, tx.load, label("rhr"), label("hrv"), label("sleepScore"), label("sleepH"), label("steps"), label("stress"), tx.kpi.vo2];
    $("year-table").innerHTML = `<table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

    // Month heat
    const hours = YEARS.map((y) => Array.from({ length: 12 }, (_, m) => sumOf(ACTS.filter((a) => a.date.slice(0, 7) === `${y}-${String(m + 1).padStart(2, "0")}`), "min") / 60));
    const max = Math.max(1, ...hours.flat());
    $("month-heat").innerHTML = `<table class="heat"><thead><tr><th>${tx.year}</th>${tx.months.map((m) => `<th>${m}</th>`).join("")}<th>Σ</th></tr></thead><tbody>${YEARS.slice().reverse().map((y) => {
      const row = hours[YEARS.indexOf(y)];
      return `<tr><td>${y}</td>${row.map((h) => `<td style="background:${alpha(C.accent, h ? 0.08 + 0.8 * (h / max) : 0)}">${h ? nf(h, 0) : ""}</td>`).join("")}<td><b>${nf(sum(row), 0)}</b></td></tr>`;
    }).join("")}</tbody></table>`;
  }

  // ---------------------------------------------------------------- correlations
  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 3) return null;
    const mx = mean(xs), my = mean(ys);
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }
  function alignPair(x, lag, y) {
    const pts = [];
    for (const d of daysIn(scopeRange())) {
      if (d[x] == null) continue;
      const target = lag ? DAYS[DAY_INDEX.get(addDays(d.date, lag))] : d;
      if (!target || target[y] == null) continue;
      pts.push({ x: d[x], y: target[y], date: d.date });
    }
    return pts;
  }

  function renderMatrix() {
    const c = RAW.correlations, sc = correlationScope();
    if (!c || !sc) { $("matrix").innerHTML = `<div class="empty">${t().noData}</div>`; return; }
    const ms = c.metrics;
    const color = (r) => (r == null ? "transparent" : alpha(r > 0 ? C.accent : C.blue, Math.min(0.9, Math.abs(r) * 1.2)));
    $("matrix").innerHTML = `<table class="matrix"><thead><tr><th></th>${ms.map((m) => `<th title="${esc(label(m))}">${esc(label(m))}</th>`).join("")}</tr></thead><tbody>${ms.map((a, i) => `<tr><th class="left">${esc(label(a))}</th>${ms.map((b, j) => {
      const r = sc.matrix[i][j];
      if (i === j) return `<td style="background:${css("--surface-2")}"></td>`;
      return `<td style="background:${color(r)}"><button data-pair="${a}|0|${b}" title="${esc(label(a))} × ${esc(label(b))}: r = ${r == null ? "–" : nf(r, 2)} (n=${sc.n[i][j]})">${r == null ? "" : nf(r, 1)}</button></td>`;
    }).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function renderPairPicker() {
    const keys = Object.keys(METRICS);
    const opts = (sel) => keys.map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(label(k))}</option>`).join("");
    $("px").innerHTML = opts(state.pair[0]);
    $("py").innerHTML = opts(state.pair[2]);
    $("plag").innerHTML = [0, 1].map((l) => `<option value="${l}" ${l === state.pair[1] ? "selected" : ""}>→ ${l ? t().nextDay : t().sameDay} →</option>`).join("");
  }

  function renderScatter() {
    const [x, lag, y] = state.pair;
    const pts = alignPair(x, lag, y);
    clearEmpty("c-scatter");
    if (pts.length < 3) { emptyChart("c-scatter"); $("pair-stats").innerHTML = ""; return; }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const r = pearson(xs, ys);
    const mx = mean(xs), my = mean(ys);
    const slope = sum(xs.map((v, i) => (v - mx) * (ys[i] - my))) / sum(xs.map((v) => (v - mx) ** 2));
    const lo = Math.min(...xs), hi = Math.max(...xs);
    chart("c-scatter", {
      type: "scatter",
      data: { datasets: [
        { label: `${label(x)} × ${label(y)}`, data: pts, backgroundColor: alpha(C.accent, 0.45), pointRadius: 3 },
        { type: "line", label: state.lang === "es" ? "Tendencia" : "Trend", data: [{ x: lo, y: my + slope * (lo - mx) }, { x: hi, y: my + slope * (hi - mx) }], borderColor: C.blue, borderWidth: 2, pointRadius: 0 },
      ] },
      options: {
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { callbacks: { label: (c) => (c.raw.date ? `${c.raw.date}: ${fmtMetric(x, c.raw.x)} → ${fmtMetric(y, c.raw.y)}` : "") } } },
        scales: {
          x: { type: "linear", title: { display: true, text: `${label(x)}${unit(x) && unit(x) !== "clock" ? ` (${unit(x)})` : ""}`, color: css("--muted") }, ticks: { callback: (v) => fmtMetric(x, v) } },
          y: { title: { display: true, text: `${label(y)}${lag ? ` (${t().nextDay})` : ""}`, color: css("--muted") }, ticks: { callback: (v) => fmtMetric(y, v) } },
        },
      },
    });
    const sorted = xs.slice().sort((a, b) => a - b);
    const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
    const loY = mean(pts.filter((p) => p.x <= q(0.25)).map((p) => p.y)), hiY = mean(pts.filter((p) => p.x >= q(0.75)).map((p) => p.y));
    $("pair-stats").innerHTML = [
      `r <b>${r == null ? "–" : nf(r, 2)}</b>`, `${t().nPoints} <b>${nf(pts.length)}</b>`, `${t().slope} <b>${nf(slope, 3)}</b>`,
      `${label(y)} · ${t().topQ} <b>${fmtMetric(y, hiY)}</b>`, `${t().lowQ} <b>${fmtMetric(y, loY)}</b>`,
    ].map((s) => `<span>${s}</span>`).join("");
  }

  function renderCorrelations() {
    renderInsights("corr-insights", 24);
    renderMatrix();
    renderPairPicker();
    renderScatter();
  }

  // ---------------------------------------------------------------- activities
  function renderActivities() {
    const tx = t();
    const sportSel = $("act-sport");
    const current = sportSel.value || "";
    sportSel.innerHTML = `<option value="">${tx.allSports}</option>` + SPORTS.filter((s) => ACTS.some((a) => a.sport === s)).map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${tx.sports[s]}</option>`).join("");
    const q = ($("act-search").value || "").toLowerCase();
    let list = actsIn(scopeRange()).filter((a) => (!current || a.sport === current) && (!q || `${a.name} ${a.type} ${a.place || ""}`.toLowerCase().includes(q)));
    const [key, dir] = state.actSort;
    list = list.slice().sort((a, b) => ((a[key] ?? -Infinity) > (b[key] ?? -Infinity) ? dir : -dir));
    const pageSize = 50, pages = Math.max(1, Math.ceil(list.length / pageSize));
    state.actPage = Math.min(state.actPage, pages - 1);
    const page = list.slice(state.actPage * pageSize, (state.actPage + 1) * pageSize);
    const colsDef = [["start", tx.date, "left"], ["name", tx.name, "left"], ["km", tx.distance], ["min", tx.time], ["elev", tx.elev], ["hr", tx.hr], ["watts", tx.power], ["np", tx.np], ["load", tx.load], ["te", tx.te]];
    const arrow = (k) => (k === key ? (dir > 0 ? " ▲" : " ▼") : "");
    $("act-count").textContent = `${nf(list.length)} ${tx.acts}`;
    $("act-table").innerHTML = list.length ? `<table><thead><tr>${colsDef.map(([k, l, cls]) => `<th class="sortable ${cls || ""}" data-sort="${k}">${esc(l)}${arrow(k)}</th>`).join("")}</tr></thead><tbody>${page.map((a) => `<tr>
      <td>${esc(a.start.replace("T", " "))}</td>
      <td class="name" title="${esc(a.name)}"><span class="dot" style="background:${SPORT_COLORS[a.sport]}"></span>${esc(a.name)}${a.pr ? " 🏅" : ""}</td>
      <td>${a.km ? nf(a.km, 1) + " km" : "–"}</td><td>${dur(a.min)}</td><td>${a.elev != null ? nf(a.elev) + " m" : "–"}</td>
      <td>${nf(a.hr)}</td><td>${a.watts ? a.watts + " W" : "–"}</td><td>${a.np ? a.np + " W" : "–"}</td><td>${nf(a.load)}</td><td>${a.te != null ? nf(a.te, 1) : "–"}</td>
    </tr>`).join("")}</tbody></table>` : `<div class="empty">${tx.noData}</div>`;
    $("act-pager").innerHTML = pages > 1 ? `<button class="btn" data-page="-1" ${state.actPage === 0 ? "disabled" : ""}>${tx.prev}</button><span class="muted">${state.actPage + 1} ${tx.of} ${pages}</span><button class="btn" data-page="1" ${state.actPage >= pages - 1 ? "disabled" : ""}>${tx.next}</button>` : "";
  }

  // ---------------------------------------------------------------- routing
  const RENDER = { overview: renderOverview, training: renderTraining, recovery: renderRecovery, sleep: renderSleep, fitness: renderFitness, years: renderYears, correlations: renderCorrelations, activities: renderActivities };
  function render() {
    renderShell();
    if (!HAS_DATA) {
      // First run of the app: a progress screen instead of empty charts.
      $("welcome").hidden = !LIVE;
      $("tabs").hidden = $("scopes").hidden = !!LIVE;
      $("main").innerHTML = LIVE ? "" : `<div class="empty">${esc(t().noData)}</div>`;
      return;
    }
    (RENDER[state.tab] || renderOverview)();
  }

  function toast(msg, ms = 3000) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    if (ms) toast.timer = setTimeout(() => { el.hidden = true; }, ms);
  }

  function openPair(spec) {
    const [x, lag, y] = spec.split("|");
    state.pair = [x, +lag, y];
    state.tab = "correlations";
    location.hash = "correlations";
    render();
    $("c-scatter").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-scope],[data-tab],[data-pair],[data-sort],[data-page]");
    if (!el) return;
    if (el.dataset.scope) { state.scope = el.dataset.scope; store.set("scope", state.scope); state.actPage = 0; render(); }
    else if (el.dataset.tab && el.classList.contains("tab")) { state.tab = el.dataset.tab; store.set("tab", state.tab); history.replaceState(null, "", "#" + state.tab); render(); window.scrollTo({ top: 0 }); }
    else if (el.dataset.pair) openPair(el.dataset.pair);
    else if (el.dataset.sort) { const k = el.dataset.sort; state.actSort = [k, state.actSort[0] === k ? -state.actSort[1] : -1]; renderActivities(); }
    else if (el.dataset.page) { state.actPage += +el.dataset.page; renderActivities(); }
  });
  $("lang-btn").addEventListener("click", () => { state.lang = state.lang === "es" ? "en" : "es"; store.set("lang", state.lang); render(); });
  $("theme-btn").addEventListener("click", () => {
    state.theme = { auto: "dark", dark: "light", light: "auto" }[state.theme];
    store.set("theme", state.theme);
    render();
  });
  $("cum-metric").addEventListener("change", (e) => { state.cumMetric = e.target.value; renderYears(); });
  ["px", "plag", "py"].forEach((id) => $(id).addEventListener("change", () => { state.pair = [$("px").value, +$("plag").value, $("py").value]; renderScatter(); }));
  $("act-search").addEventListener("input", () => { state.actPage = 0; renderActivities(); });
  $("act-sport").addEventListener("change", () => { state.actPage = 0; renderActivities(); });
  window.addEventListener("hashchange", () => { const tab = location.hash.slice(1); if (RENDER[tab] && tab !== state.tab) { state.tab = tab; render(); } });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (state.theme === "auto") render(); });

  // ---------------------------------------------------------------- sync (app only)
  // The page asks the local server to sync on open, keeps showing cached data meanwhile and
  // reloads once new data has landed. The server skips automatic syncs right after one ran,
  // so that reload does not start another.
  const sync = { running: false, watched: false, status: null };
  const SOURCE_ORDER = ["daily_summaries", "sleep", "hrv", "readiness", "training_status", "max_metrics", "endurance", "body_composition", "activities"];

  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    const rtf = new Intl.RelativeTimeFormat(state.lang, { numeric: "auto" });
    if (s < 60) return rtf.format(0, "second");
    if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
    if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
    return rtf.format(-Math.round(s / 86400), "day");
  }

  function renderSyncStatus() {
    if (!LIVE) return;
    const tx = t(), st = sync.status || {};
    const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
    const pill = $("sync-pill");
    pill.hidden = false;
    pill.dataset.state = sync.running ? "running" : st.state === "error" ? "error" : "ok";
    $("sync-text").textContent = sync.running
      ? (st.total ? `${tx.syncing} ${pct}%` : tx.preparing)
      : st.state === "error" ? tx.syncFailed
      : RAW.lastSync ? `${tx.upToDate} · ${ago(RAW.lastSync)}` : "";
    pill.title = RAW.lastSync ? `${tx.lastSync} ${new Date(RAW.lastSync).toLocaleString(state.lang, { dateStyle: "medium", timeStyle: "short" })}` : "";
    $("sync-bar").hidden = !sync.running;
    $("sync-bar").firstElementChild.style.width = `${st.total ? Math.max(2, pct) : 2}%`;

    const banner = $("banner");
    banner.hidden = !(st.state === "error" && !sync.running);
    if (!banner.hidden) {
      const auth = /auth|sign in|login|401|403/i.test(st.error || "");
      banner.innerHTML = `<b>${esc(tx.syncFailed)}.</b> ${esc(auth ? tx.authHint : st.error || "")}${HAS_DATA ? ` <span class="muted">${esc(tx.showingCached)}</span>` : ""}`;
    }

    if (!HAS_DATA) {
      $("welcome-bar").style.width = `${pct}%`;
      $("welcome-pct").textContent = st.total ? `${st.done} / ${st.total}` : "";
      $("welcome-step").textContent = sync.running ? (st.source ? `${tx.downloading} · ${tx.sources[st.source] || st.source}` : tx.preparing) : st.state === "error" ? tx.syncFailed : "";
      const at = SOURCE_ORDER.indexOf(st.source);
      $("welcome-sources").innerHTML = SOURCE_ORDER.map((k, i) => {
        const cls = !sync.running && st.state === "done" ? "done" : at < 0 ? "" : i < at ? "done" : i === at ? "active" : "";
        return `<li class="${cls}">${esc(tx.sources[k])}</li>`;
      }).join("");
    }
  }

  function syncFinished(st) {
    const fresh = st.state === "done" && st.result && st.result.fetched > 0;
    if (sync.watched && fresh) {
      toast(t().refreshing, 0);
      try { sessionStorage.setItem("gd.scroll", String(window.scrollY)); } catch { /* storage unavailable */ }
      setTimeout(() => location.reload(), 400);
    } else if (sync.watched && st.state === "done") toast(t().synced);
  }

  function applyStatus(st) {
    sync.status = st;
    const wasRunning = sync.running;
    sync.running = st.state === "running";
    if (sync.running) sync.watched = true;
    $("sync-btn").disabled = sync.running;
    $("sync-btn").textContent = sync.running ? t().syncing : t().sync;
    renderSyncStatus();
    if (sync.running) setTimeout(poll, 700);
    else if (wasRunning) syncFinished(st);
  }

  async function poll() {
    try {
      const res = await fetch("api/status", { cache: "no-store" });
      applyStatus(await res.json());
    } catch {
      setTimeout(poll, 2000); // server busy or restarting; try again
    }
  }

  async function startSync(auto) {
    try {
      const res = await fetch("api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto }) });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || res.statusText);
      applyStatus(body);
    } catch (err) {
      toast(`⚠ ${err.message}`, 8000);
    }
  }

  if (LIVE) {
    $("sync-btn").addEventListener("click", () => startSync(false));
    // Heartbeat: the local server shuts itself down a while after the last tab closes.
    const ping = () => fetch("api/ping", { method: "POST" }).catch(() => {});
    ping();
    setInterval(ping, 20000);
    // Keep "updated 3 minutes ago" honest while the tab stays open.
    setInterval(() => { if (!sync.running) renderSyncStatus(); }, 30000);
  }

  render();
  try {
    const y = sessionStorage.getItem("gd.scroll");
    if (y) { sessionStorage.removeItem("gd.scroll"); window.scrollTo(0, +y); }
  } catch { /* storage unavailable */ }
  if (LIVE) {
    if (AUTOSYNC) startSync(true);
    else poll(); // show the last sync's result (and follow one already running)
  }
})();
