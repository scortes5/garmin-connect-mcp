/* Pulso (Garmin dashboard) — single-file app. Data comes from window.GARMIN_DATA (see normalize.py).
 *
 * Design rules: every view answers one plain question; one y-axis per chart; colour follows the
 * entity (a sport keeps its colour everywhere); words over acronyms. */
(() => {
  "use strict";

  const RAW = window.GARMIN_DATA || {};
  const LIVE = !!window.GARMIN_LIVE;
  const AUTOSYNC = LIVE && !!window.GARMIN_AUTOSYNC;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const TODAY = iso(new Date());

  // ---------------------------------------------------------------- i18n
  const I18N = {
    es: {
      tabs: { overview: "Resumen", training: "Entrenamiento", health: "Recuperación y sueño", history: "Año a año", activities: "Actividades" },
      period: "Período", last365: "Últimos 12 meses", all: "Todo el historial",
      sync: "Sincronizar", syncing: "Sincronizando…", synced: "Datos actualizados", lastSync: "Sincronizado",
      acts: "actividades", yearsOfData: "años de datos", weekOf: "Semana del", latest: "Último valor", same: "igual", by: "Al",
      hlScope: { "365": "En los últimos 12 meses", current: (y) => `En lo que va de ${y}`, year: (y) => `En ${y}`, all: (y) => `Desde ${y}` },
      hlBody: (h, n, km) => `entrenaste <b>${h} horas</b> en <b>${n} actividades</b>${km ? ` y recorriste <b>${km} km</b>` : ""}`,
      hlDelta: (pct, more, prev) => `, <b>un ${pct} % ${more ? "más" : "menos"}</b> que ${prev}.`,
      prevLabel: { "365": "los 12 meses anteriores", year: (y) => `en ${y}`, current: (y) => `en el mismo período de ${y}` },
      vsPrev: { "365": "vs 12 meses anteriores", year: (y) => `vs ${y}` },
      kpi: { hours: "Horas de entrenamiento", acts: "Actividades", km: "Distancia", elev: "Desnivel acumulado" },
      nowTitle: "¿Cómo estás estos días?",
      nowSub: (d) => `Promedio de los 7 días hasta el ${d}, comparado con tus 8 semanas anteriores.`,
      normalRange: "Lo normal para ti", better: "Mejor que lo normal", worse: "Peor que lo normal", usual: "Normal",
      nowAllGood: "Todo está dentro de lo normal o mejor. Tu cuerpo se está recuperando bien.",
      nowOneBad: (n) => `Casi todo está normal; solo ${n} está peor que lo habitual.`,
      nowManyBad: (k) => `${k} indicadores están peor que lo habitual. Puede ser un buen momento para bajar la intensidad.`,
      nowNoData: "No hay datos de los últimos días. Sincroniza tu reloj con Garmin Connect.",
      weeklyTitle: "Tu entrenamiento semana a semana", weeklySub: "Horas de entrenamiento por semana, separadas por deporte.",
      weeklySubLong: "Horas de entrenamiento por mes, separadas por deporte.",
      findingsTitle: "Lo que dicen tus datos",
      findingsSub: "Patrones que se repiten en tu propio historial. Muestran lo que suele pasar junto, no prueban causa y efecto.",
      noFindings: "Todavía no hay suficientes días con datos en este período para encontrar patrones confiables.",
      clear: "Patrón claro", moderate: "Patrón moderado", basedOn: (n) => `Basado en ${n} días`,
      up: "sube", down: "baja",
      bySportTitle: "Por deporte", bySportSub: "Cuánto entrenaste en cada deporte en este período.",
      monthlyTitle: "Mes a mes", monthlySub: "Horas de entrenamiento por mes, separadas por deporte.",
      formTitle: "Forma física y fatiga",
      formSub: "La forma física sube cuando entrenas con constancia durante semanas. La fatiga refleja los últimos 7 días. Si la fatiga queda muy por encima de la forma, conviene descansar.",
      fitness: "Forma física", fatigue: "Fatiga",
      zonesTitle: "¿A qué intensidad entrenas?", zonesSub: "Tiempo total en cada zona de frecuencia cardiaca.",
      zones: [["Zona 1", "Muy suave"], ["Zona 2", "Suave · base aeróbica"], ["Zona 3", "Moderada"], ["Zona 4", "Fuerte · umbral"], ["Zona 5", "Máxima"]],
      calendarTitle: "Días de entrenamiento", calendarSub: "Cada cuadrado es un día; más oscuro, más minutos entrenados.",
      calLegend: ["Descanso", "< 45 min", "45–90 min", "90–150 min", "> 150 min"],
      recordsTitle: "Tus mejores marcas del período",
      rec: { km: "Mayor distancia", min: "Sesión más larga", elev: "Más desnivel", p1200: "Mejor potencia 20 min", p300: "Mejor potencia 5 min", run: "Carrera más larga", load: "Sesión más exigente", hrMax: "Pulso más alto" },
      shareOfTime: "% del tiempo",
      healthLead: "Cada tarjeta muestra el promedio del período, el cambio respecto al período anterior y la tendencia semana a semana.",
      sleepTitle: "Cómo duermes", sleepSub: "Horas promedio de cada fase del sueño por noche.",
      bed: "Te acuestas", wake: "Te levantas", regularity: "Regularidad al acostarte", nights7: "Noches de 7 h o más",
      regularityHint: "variación típica de un día a otro",
      stages: { deepH: "Profundo", remH: "REM", lightH: "Ligero", awakeH: "Despierto" },
      vo2: (s) => `VO₂ máx. (${s})`, vo2What: "Tu capacidad aeróbica estimada por Garmin. Más alta es mejor.",
      weight: "Peso", weightWhat: "Mediciones de peso registradas en Garmin.",
      cumTitle: "Año contra año", cumSub: "Total acumulado desde el 1 de enero. Cada línea es un año; así ves si vas por delante o por detrás.",
      cumMetrics: { hours: "Horas", km: "Distancia", elev: "Desnivel", acts: "Actividades" },
      otherYears: "Otros años", inProgress: "en curso",
      yearTitle: "Resumen por año", yearSub: "En negrita, el mejor año de cada columna.",
      search: "Buscar por nombre o lugar…", allSports: "Todos los deportes",
      date: "Fecha", activity: "Actividad", duration: "Duración", distance: "Distancia", elevation: "Desnivel", avgHr: "Pulso medio", power: "Potencia", load: "Carga",
      year: "Año", hours: "Horas", count: "Actividades", sport: "Deporte",
      prev: "Anterior", next: "Siguiente", of: "de",
      sports: { cycling: "Ciclismo", running: "Running", swimming: "Natación", walking: "Caminata", gym: "Gimnasio", other: "Otros" },
      weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
      noData: "Sin datos para este período.",
      privacy: "Tus datos se guardan solo en este computador.", syncWarnings: "avisos de sincronización",
      welcomeTitle: "Preparando Pulso", welcomeBody: "Descargando tu historial completo de Garmin Connect. La primera vez toma unos minutos; después solo se baja lo nuevo y se abre al instante.",
      preparing: "Preparando…", downloading: "Descargando", upToDate: "Al día", syncFailed: "No se pudo sincronizar",
      authHint: "Inicia sesión en Garmin desde una terminal con: garmin-connect-mcp auth", showingCached: "Mostrando los datos guardados.", refreshing: "Datos nuevos, actualizando…",
      sources: { daily_summaries: "Resumen diario", sleep: "Sueño", hrv: "HRV", readiness: "Disposición para entrenar", training_status: "Estado de entrenamiento", max_metrics: "VO₂ máx.", endurance: "Resistencia", body_composition: "Peso", activities: "Actividades" },
    },
    en: {
      tabs: { overview: "Summary", training: "Training", health: "Recovery & sleep", history: "Year by year", activities: "Activities" },
      period: "Period", last365: "Last 12 months", all: "All history",
      sync: "Sync", syncing: "Syncing…", synced: "Data updated", lastSync: "Synced",
      acts: "activities", yearsOfData: "years of data", weekOf: "Week of", latest: "Latest", same: "same", by: "By",
      hlScope: { "365": "In the last 12 months", current: (y) => `So far in ${y}`, year: (y) => `In ${y}`, all: (y) => `Since ${y}` },
      hlBody: (h, n, km) => `you trained <b>${h} hours</b> across <b>${n} activities</b>${km ? ` and covered <b>${km} km</b>` : ""}`,
      hlDelta: (pct, more, prev) => `, <b>${pct}% ${more ? "more" : "less"}</b> than ${prev}.`,
      prevLabel: { "365": "the 12 months before", year: (y) => `in ${y}`, current: (y) => `the same stretch of ${y}` },
      vsPrev: { "365": "vs previous 12 months", year: (y) => `vs ${y}` },
      kpi: { hours: "Training hours", acts: "Activities", km: "Distance", elev: "Elevation gain" },
      nowTitle: "How are you doing lately?",
      nowSub: (d) => `Average of the 7 days up to ${d}, compared with your previous 8 weeks.`,
      normalRange: "Normal for you", better: "Better than usual", worse: "Worse than usual", usual: "Normal",
      nowAllGood: "Everything is within your normal range or better. You are recovering well.",
      nowOneBad: (n) => `Almost everything is normal; only ${n} is worse than usual.`,
      nowManyBad: (k) => `${k} signals are worse than usual. It may be a good moment to ease off.`,
      nowNoData: "No data for the last few days. Sync your watch with Garmin Connect.",
      weeklyTitle: "Your training week by week", weeklySub: "Training hours per week, split by sport.",
      weeklySubLong: "Training hours per month, split by sport.",
      findingsTitle: "What your data says",
      findingsSub: "Patterns that repeat in your own history. They show what tends to happen together, not cause and effect.",
      noFindings: "Not enough days with data in this period to find reliable patterns yet.",
      clear: "Clear pattern", moderate: "Moderate pattern", basedOn: (n) => `Based on ${n} days`,
      up: "goes up", down: "goes down",
      bySportTitle: "By sport", bySportSub: "How much you trained in each sport in this period.",
      monthlyTitle: "Month by month", monthlySub: "Training hours per month, split by sport.",
      formTitle: "Fitness and fatigue",
      formSub: "Fitness rises when you train consistently for weeks. Fatigue reflects the last 7 days. When fatigue sits far above fitness, it is time to rest.",
      fitness: "Fitness", fatigue: "Fatigue",
      zonesTitle: "How hard do you train?", zonesSub: "Total time in each heart-rate zone.",
      zones: [["Zone 1", "Very easy"], ["Zone 2", "Easy · aerobic base"], ["Zone 3", "Moderate"], ["Zone 4", "Hard · threshold"], ["Zone 5", "Maximum"]],
      calendarTitle: "Training days", calendarSub: "Each square is a day; darker means more minutes trained.",
      calLegend: ["Rest", "< 45 min", "45–90 min", "90–150 min", "> 150 min"],
      recordsTitle: "Your best marks in this period",
      rec: { km: "Longest distance", min: "Longest session", elev: "Most climbing", p1200: "Best 20-min power", p300: "Best 5-min power", run: "Longest run", load: "Toughest session", hrMax: "Highest heart rate" },
      shareOfTime: "% of time",
      healthLead: "Each card shows the period average, the change from the previous period and the week-by-week trend.",
      sleepTitle: "How you sleep", sleepSub: "Average hours in each sleep stage per night.",
      bed: "Bedtime", wake: "Wake time", regularity: "Bedtime regularity", nights7: "Nights of 7 h or more",
      regularityHint: "typical night-to-night variation",
      stages: { deepH: "Deep", remH: "REM", lightH: "Light", awakeH: "Awake" },
      vo2: (s) => `VO₂ max (${s})`, vo2What: "Your aerobic capacity as estimated by Garmin. Higher is better.",
      weight: "Weight", weightWhat: "Weight measurements logged in Garmin.",
      cumTitle: "Year against year", cumSub: "Running total since 1 January. Each line is a year, so you can see whether you are ahead or behind.",
      cumMetrics: { hours: "Hours", km: "Distance", elev: "Elevation", acts: "Activities" },
      otherYears: "Other years", inProgress: "in progress",
      yearTitle: "Year summary", yearSub: "Bold marks the best year in each column.",
      search: "Search by name or place…", allSports: "All sports",
      date: "Date", activity: "Activity", duration: "Duration", distance: "Distance", elevation: "Elevation", avgHr: "Avg HR", power: "Power", load: "Load",
      year: "Year", hours: "Hours", count: "Activities", sport: "Sport",
      prev: "Previous", next: "Next", of: "of",
      sports: { cycling: "Cycling", running: "Running", swimming: "Swimming", walking: "Walking", gym: "Gym", other: "Other" },
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      noData: "No data for this period.",
      privacy: "Your data is stored only on this computer.", syncWarnings: "sync warnings",
      welcomeTitle: "Setting up Pulso", welcomeBody: "Downloading your full Garmin Connect history. The first time takes a few minutes; after that only new data is fetched and it opens instantly.",
      preparing: "Preparing…", downloading: "Downloading", upToDate: "Up to date", syncFailed: "Sync failed",
      authHint: "Sign in to Garmin from a terminal with: garmin-connect-mcp auth", showingCached: "Showing saved data.", refreshing: "New data, refreshing…",
      sources: { daily_summaries: "Daily summary", sleep: "Sleep", hrv: "HRV", readiness: "Training readiness", training_status: "Training status", max_metrics: "VO₂ max", endurance: "Endurance", body_composition: "Weight", activities: "Activities" },
    },
  };

  /**
   * Daily metrics in words: [label es, label en, unit, decimals, direction, what es, what en].
   * direction: +1 higher is better, -1 lower is better, 0 neither.
   */
  const METRICS = {
    hrv: ["HRV nocturna", "Overnight HRV", "ms", 0, 1, "Variación entre latidos mientras duermes. Más alta suele indicar mejor recuperación.", "Beat-to-beat variation while you sleep. Higher usually means better recovery."],
    rhr: ["Pulso en reposo", "Resting heart rate", "lpm|bpm", 0, -1, "Tus latidos por minuto en calma. Más bajo suele indicar mejor forma y descanso.", "Beats per minute at rest. Lower usually means better fitness and rest."],
    sleepH: ["Horas de sueño", "Sleep", "h", 1, 1, "Tiempo dormido por noche.", "Time asleep per night."],
    sleepScore: ["Calidad del sueño", "Sleep score", "/100", 0, 1, "Nota de Garmin para cada noche, de 0 a 100.", "Garmin's score for each night, 0 to 100."],
    bbMax: ["Energía al despertar", "Morning energy", "/100", 0, 1, "Body Battery más alto del día: tu energía disponible, de 0 a 100.", "Highest Body Battery of the day: your energy reserve, 0 to 100."],
    stress: ["Estrés", "Stress", "/100", 0, -1, "Estrés promedio del día según tu pulso, de 0 a 100. Más bajo es mejor.", "Average daily stress from your heart rate, 0 to 100. Lower is better."],
    readiness: ["Disposición para entrenar", "Training readiness", "/100", 0, 1, "Qué tan preparado está tu cuerpo para un entrenamiento fuerte, de 0 a 100.", "How ready your body is for a hard workout, 0 to 100."],
    steps: ["Pasos", "Steps", "", 0, 1, "Pasos por día.", "Steps per day."],
    deepH: ["Sueño profundo", "Deep sleep", "h", 1, 1],
  };

  const SPORTS = ["cycling", "running", "swimming", "walking", "gym", "other"];
  const SPORT_VAR = { cycling: "--s1", running: "--s2", swimming: "--s3", walking: "--s4", gym: "--s5", other: "--s6" };
  const SOURCE_ORDER = ["daily_summaries", "sleep", "hrv", "readiness", "training_status", "max_metrics", "endurance", "body_composition", "activities"];

  // ---------------------------------------------------------------- state
  const store = {
    get(k, d) { try { return localStorage.getItem("gd." + k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gd." + k, v); } catch { /* storage unavailable */ } },
  };
  const TABS = ["overview", "training", "health", "history", "activities"];
  const initialTab = (location.hash || "").slice(1) || store.get("tab", "overview");
  const state = {
    // ?lang=en|es wins (handy for links and screenshots), then the saved choice, then the browser.
    lang: new URLSearchParams(location.search).get("lang") || store.get("lang", (navigator.language || "es").startsWith("es") ? "es" : "en"),
    theme: store.get("theme", "auto"),
    scope: store.get("scope", "365"),
    tab: TABS.includes(initialTab) ? initialTab : "overview",
    actPage: 0, actSort: ["start", -1],
    cumMetric: "hours",
  };
  const t = () => I18N[state.lang];
  const es = () => state.lang === "es";
  const label = (m) => (METRICS[m] ? METRICS[m][es() ? 0 : 1] : m);
  const what = (m) => (METRICS[m] ? METRICS[m][es() ? 5 : 6] : "");
  const unit = (m) => {
    const u = METRICS[m] ? METRICS[m][2] : "";
    return u.includes("|") ? u.split("|")[es() ? 0 : 1] : u;
  };
  /** Unit shown next to a value: "/100" scores read better bare. */
  const shownUnit = (m) => (unit(m) === "/100" ? "" : unit(m));

  // ---------------------------------------------------------------- data
  const cols = RAW.days || { date: [] };
  const DAYS = (cols.date || []).map((date, i) => {
    const row = { date };
    for (const k of Object.keys(cols)) if (k !== "date") row[k] = cols[k][i];
    return row;
  });
  const HAS_DATA = DAYS.length > 0 || (RAW.activities || []).length > 0;
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
    return new Intl.NumberFormat(state.lang, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" }).format(v);
  };
  const clock = (h) => {
    if (h == null || Number.isNaN(h)) return "–";
    const x = ((h % 24) + 24) % 24;
    let hh = Math.floor(x), mm = Math.round((x - hh) * 60);
    if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const fmt = (m, v) => nf(v, METRICS[m] ? METRICS[m][3] : 1);
  const withUnit = (m, v) => `${fmt(m, v)}${shownUnit(m) ? " " + shownUnit(m) : ""}`;
  const dur = (min) => {
    if (min == null) return "–";
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
  };
  const vals = (rows, k) => rows.map((r) => r[k]).filter((v) => v != null && !Number.isNaN(v));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : null);
  const avgOf = (rows, k) => mean(vals(rows, k));
  const sumOf = (rows, k) => sum(vals(rows, k));
  const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(sum(a.map((v) => (v - m) ** 2)) / (a.length - 1)) : null; };
  const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
  const weekStart = (d) => addDays(d, -((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7));
  const monthKey = (d) => d.slice(0, 7);
  const dayLabel = (d) => `${+d.slice(8, 10)} ${t().months[+d.slice(5, 7) - 1]}`;
  const dayYearLabel = (d) => `${dayLabel(d)} ${d.slice(0, 4)}`;
  const monthLabel = (k) => `${t().months[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const sportColor = (s) => css(SPORT_VAR[s] || "--s6");
  const alpha = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // ---------------------------------------------------------------- period
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
  const isCurrentYear = (s) => s === TODAY.slice(0, 4);
  const vsPrevText = () => (state.scope === "all" ? "" : state.scope === "365" ? t().vsPrev["365"] : t().vsPrev.year(+state.scope - 1));
  const inR = (d, r) => d >= r[0] && d <= r[1];
  const daysIn = (r) => DAYS.filter((d) => inR(d.date, r));
  const actsIn = (r) => ACTS.filter((a) => inR(a.date, r));
  const WEEKLY = { key: weekStart, label: dayLabel, title: (k) => `${t().weekOf} ${dayYearLabel(k)}` };
  const MONTHLY = { key: monthKey, label: monthLabel, title: monthLabel };
  /** Weekly buckets for up to ~14 months, monthly beyond. */
  const bucketFor = (r) => (daysBetween(r[0], r[1]) > 430 ? MONTHLY : WEEKLY);
  function bucketKeys(r, key) {
    const keys = new Set();
    for (let d = r[0]; d <= r[1]; d = addDays(d, 1)) keys.add(key(d));
    return [...keys].sort();
  }

  // ---------------------------------------------------------------- charts
  const charts = {};
  function baseOptions() {
    const muted = css("--muted");
    return {
      responsive: true, maintainAspectRatio: false, animation: false, normalized: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false }, // legends are HTML, above the plot
        tooltip: {
          backgroundColor: css("--ink"), titleColor: css("--page"), bodyColor: css("--page"), footerColor: css("--page"),
          padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
        },
      },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 12 } }, grid: { display: false }, border: { color: css("--axis") } },
        y: { beginAtZero: true, ticks: { color: muted, maxTicksLimit: 5, font: { size: 12 } }, grid: { color: css("--grid") }, border: { display: false } },
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
    clearEmpty(id);
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(el, { ...config, options: deepMerge(baseOptions(), config.options || {}) });
  }
  function emptyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    const el = $(id);
    if (!el) return;
    el.getContext("2d").clearRect(0, 0, el.width, el.height);
    const wrap = el.parentElement;
    if (!wrap.querySelector(".empty")) wrap.insertAdjacentHTML("beforeend", `<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">${esc(t().noData)}</div>`);
  }
  function clearEmpty(id) { const el = $(id); if (el) el.parentElement.querySelectorAll(".empty").forEach((n) => n.remove()); }
  function dropCharts(prefix) { Object.keys(charts).filter((k) => k.startsWith(prefix)).forEach((k) => { charts[k].destroy(); delete charts[k]; }); }
  const line = (name, data, color, extra = {}) => ({
    type: "line", label: name, data, borderColor: color, backgroundColor: color, borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: css("--surface"),
    borderCapStyle: "round", borderJoinStyle: "round", tension: 0.3, spanGaps: false, ...extra,
  });
  const legend = (target, items) => {
    $(target).innerHTML = items.map(([name, color, kind]) => `<span><i class="${kind === "line" ? "line" : ""}" style="background:${color}"></i>${esc(name)}</span>`).join("");
  };
  /** Rounded top on the highest visible segment of each stack only; square elsewhere. */
  const stackTop = (ctx) => {
    const ds = ctx.chart.data.datasets;
    for (let i = ds.length - 1; i >= 0; i--) {
      if (!ctx.chart.isDatasetVisible(i)) continue;
      if ((ds[i].data[ctx.dataIndex] || 0) > 0) return i === ctx.datasetIndex ? { topLeft: 4, topRight: 4 } : 0;
    }
    return 0;
  };
  /** One segment of a stacked bar: thin, 2px surface gap above, rounded only at the top. */
  const stackBar = (name, data, color) => ({
    type: "bar", label: name, data, backgroundColor: color, stack: "s", borderRadius: stackTop, borderSkipped: false,
    borderColor: css("--surface"), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
    maxBarThickness: 24, categoryPercentage: 0.82, barPercentage: 0.92,
  });
  const hoursScales = (bucket) => ({
    x: { stacked: true, ticks: { callback(v) { return bucket.label(this.getLabelForValue(v)); } } },
    y: { stacked: true, ticks: { callback: (v) => `${v} h` } },
  });

  /** Stacked hours by sport per bucket (week or month). */
  function sportBars(id, legendId, acts, r, bucket = bucketFor(r)) {
    if (!acts.length) { $(legendId).innerHTML = ""; return emptyChart(id); }
    const keys = bucketKeys(r, bucket.key);
    const present = SPORTS.filter((s) => acts.some((a) => a.sport === s));
    const datasets = present.map((s) => {
      const per = new Map();
      for (const a of acts) if (a.sport === s) per.set(bucket.key(a.date), (per.get(bucket.key(a.date)) || 0) + (a.min || 0) / 60);
      return stackBar(t().sports[s], keys.map((k) => +(per.get(k) || 0).toFixed(2)), sportColor(s));
    });
    legend(legendId, present.map((s) => [t().sports[s], sportColor(s)]));
    chart(id, {
      data: { labels: keys, datasets },
      options: {
        plugins: {
          tooltip: {
            filter: (item) => item.raw > 0,
            callbacks: {
              title: (it) => bucket.title(it[0].label),
              label: (c) => `${c.dataset.label}: ${dur(c.raw * 60)}`,
              footer: (it) => (it.length > 1 ? `Total: ${dur(sum(it.map((i) => i.raw)) * 60)}` : ""),
            },
          },
        },
        scales: hoursScales(bucket),
      },
    });
  }

  /** Small trend line (weekly or monthly average) for one daily metric, with a light area wash. */
  function trendChart(id, rows, metric, r) {
    const bucket = bucketFor(r);
    const keys = bucketKeys(r, bucket.key);
    const groups = new Map();
    for (const d of rows) if (d[metric] != null) {
      const k = bucket.key(d.date);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(d[metric]);
    }
    if (!groups.size) return emptyChart(id);
    const data = keys.map((k) => (groups.has(k) ? +mean(groups.get(k)).toFixed(2) : null));
    const present = data.filter((v) => v != null);
    const lo = Math.min(...present), hi = Math.max(...present), pad = (hi - lo) * 0.25 || Math.abs(hi) * 0.05 || 1;
    const color = css("--s1");
    chart(id, {
      data: { labels: keys, datasets: [line(label(metric), data, color, { fill: true, backgroundColor: alpha(color, 0.1) })] },
      options: {
        plugins: { tooltip: { callbacks: { title: (it) => bucket.title(it[0].label), label: (c) => withUnit(metric, c.raw) } } },
        scales: {
          x: { ticks: { maxTicksLimit: 4, callback(v) { return monthLabel(this.getLabelForValue(v).slice(0, 7)); } } },
          y: { beginAtZero: false, suggestedMin: lo - pad, suggestedMax: hi + pad, ticks: { maxTicksLimit: 3, callback: (v) => fmt(metric, v) } },
        },
      },
    });
  }

  /** Inline SVG sparkline: de-emphasised line, accent end dot (a zero-length round-capped
   * line, so the stretched viewBox can't squash it into an ellipse). */
  function sparkline(values) {
    if (values.length < 2) return "";
    const max = Math.max(1, ...values);
    const xy = values.map((v, i) => [(i / (values.length - 1)) * 100, 32 - ((v || 0) / max) * 28]);
    const [lx, ly] = xy[xy.length - 1];
    return `<svg class="spark" viewBox="-3 0 106 36" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${css("--neutral")}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="${lx}" y1="${ly}" x2="${lx}" y2="${ly}" stroke="${css("--surface")}" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <line x1="${lx}" y1="${ly}" x2="${lx}" y2="${ly}" stroke="${css("--s1")}" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
  }

  /** "▲ 12 % vs 2025". direction: +1 up is good, -1 down is good, 0 neutral colour. */
  function deltaHtml(value, digits, unitText, direction, mode = "abs") {
    if (value == null || !Number.isFinite(value)) return '<div class="delta">&nbsp;</div>';
    const tiny = mode === "pct" ? Math.abs(value) < 1 : Math.abs(value) < Math.pow(10, -digits) / 2;
    const arrow = tiny ? "=" : value > 0 ? "▲" : "▼";
    const cls = tiny || !direction ? "" : (value > 0) === (direction > 0) ? "good" : "bad";
    const text = tiny ? t().same : `${nf(Math.abs(value), mode === "pct" ? 0 : digits)}${mode === "pct" ? " %" : unitText ? " " + unitText : ""}`;
    return `<div class="delta"><span class="${cls}">${arrow} ${text}</span> ${esc(vsPrevText())}</div>`;
  }

  // ---------------------------------------------------------------- shell
  function renderShell() {
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.theme = state.theme === "auto" ? "" : state.theme;
    $("lang-btn").textContent = es() ? "EN" : "ES";
    $("theme-btn").textContent = { auto: "◐", dark: "☾", light: "☀" }[state.theme];
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t()[el.dataset.i18n] ?? ""; });

    const scopes = [["365", t().last365], ...YEARS.slice().reverse().map((y) => [y, isCurrentYear(y) ? `${y} (${t().inProgress})` : y]), ["all", t().all]];
    $("scope").innerHTML = scopes.map(([k, v]) => `<option value="${k}" ${k === state.scope ? "selected" : ""}>${esc(v)}</option>`).join("");
    $("tabs").innerHTML = TABS.map((k) => `<button class="tab" data-tab="${k}" aria-selected="${k === state.tab}">${esc(t().tabs[k])}</button>`).join("");
    document.querySelectorAll("main > section").forEach((s) => s.classList.toggle("active", s.dataset.tab === state.tab));

    const last = RAW.lastSync && !LIVE ? new Date(RAW.lastSync) : null; // the app shows it in the sync pill
    $("sync-info").textContent = [
      last ? `${t().lastSync} ${last.toLocaleString(state.lang, { dateStyle: "medium", timeStyle: "short" })}` : "",
      HAS_DATA ? `${nf(daysBetween(FIRST, TODAY) / 365.25, 1)} ${t().yearsOfData} · ${nf(ACTS.length)} ${t().acts}` : "",
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

  // ---------------------------------------------------------------- overview
  const totals = (acts) => ({ acts: acts.length, hours: sumOf(acts, "min") / 60, km: sumOf(acts, "km"), elev: sumOf(acts, "elev") });

  function renderHeadline(cur, prev) {
    const tx = t(), s = state.scope;
    const intro = s === "365" ? tx.hlScope["365"] : s === "all" ? tx.hlScope.all(FIRST.slice(0, 4)) : isCurrentYear(s) ? tx.hlScope.current(s) : tx.hlScope.year(s);
    let html = `${intro}, ${tx.hlBody(nf(cur.hours), nf(cur.acts), cur.km >= 1 ? nf(cur.km) : "")}`;
    const pct = prev && prev.hours > 0 ? Math.round(((cur.hours - prev.hours) / prev.hours) * 100) : 0;
    if (Math.abs(pct) >= 1) {
      const prevText = s === "365" ? tx.prevLabel["365"] : isCurrentYear(s) ? tx.prevLabel.current(+s - 1) : tx.prevLabel.year(+s - 1);
      html += tx.hlDelta(nf(Math.abs(pct)), pct > 0, prevText);
    } else html += ".";
    $("headline").innerHTML = html;
  }

  function renderKpis(r, p) {
    const acts = actsIn(r), cur = totals(acts), prev = p ? totals(actsIn(p)) : null;
    const tx = t();
    const long = daysBetween(r[0], r[1]) > 800;
    const bucket = long ? (d) => d.slice(0, 4) : monthKey;
    const keys = long ? [...new Set(acts.map((a) => a.date.slice(0, 4)))].sort() : bucketKeys(r, monthKey);
    const series = (f) => keys.map((k) => sum(acts.filter((a) => bucket(a.date) === k).map(f)));
    const tile = (lbl, value, u, curV, prevV, spark) => `<div class="tile">
      <div class="label">${esc(lbl)}</div>
      <div class="value">${value}${u ? `<small>${esc(u)}</small>` : ""}</div>
      ${prev ? deltaHtml(prevV ? ((curV - prevV) / prevV) * 100 : null, 0, "", 0, "pct") : ""}
      ${sparkline(spark)}
    </div>`;
    $("kpis").innerHTML = [
      tile(tx.kpi.hours, nf(cur.hours), "h", cur.hours, prev && prev.hours, series((a) => (a.min || 0) / 60)),
      tile(tx.kpi.acts, nf(cur.acts), "", cur.acts, prev && prev.acts, series(() => 1)),
      tile(tx.kpi.km, nf(cur.km), "km", cur.km, prev && prev.km, series((a) => a.km || 0)),
      tile(tx.kpi.elev, nf(cur.elev), "m", cur.elev, prev && prev.elev, series((a) => a.elev || 0)),
    ].join("");
    renderHeadline(cur, prev);
  }

  /** Last 7 days vs the 8 weeks before, judged against your own day-to-day spread. */
  function renderNow() {
    const tx = t();
    const metrics = ["hrv", "rhr", "sleepH", "bbMax", "stress"];
    const recent = DAYS.filter((d) => d.date <= TODAY && metrics.some((m) => d[m] != null));
    const last = recent.length ? recent[recent.length - 1].date : null;
    const week = last ? daysIn([addDays(last, -6), last]) : [];
    const base = last ? daysIn([addDays(last, -62), addDays(last, -7)]) : [];
    const results = !last || daysBetween(last, TODAY) > 10 ? [] : metrics.map((m) => {
      const cur = avgOf(week, m), b = vals(base, m);
      if (cur == null || b.length < 14) return null;
      const bm = mean(b), spread = Math.max(sd(b) * 0.5, Math.abs(bm) * 0.02);
      const diff = (cur - bm) * METRICS[m][4];
      return { m, cur, lo: bm - spread, hi: bm + spread, status: diff > spread ? "good" : diff < -spread ? "bad" : "" };
    }).filter(Boolean);
    if (!results.length) {
      $("now-sub").textContent = "";
      $("now").innerHTML = `<div class="empty">${esc(tx.nowNoData)}</div>`;
      return;
    }
    const bad = results.filter((x) => x.status === "bad");
    const summary = !bad.length ? tx.nowAllGood : bad.length === 1 ? tx.nowOneBad(label(bad[0].m).toLowerCase()) : tx.nowManyBad(bad.length);
    $("now-sub").innerHTML = `${esc(tx.nowSub(dayYearLabel(last)))}<br><span class="now-summary">${esc(summary)}</span>`;
    $("now").innerHTML = results.map((x) => `<div class="now-item">
      <div class="name">${esc(label(x.m))}</div>
      <div class="val">${fmt(x.m, x.cur)}<small>${esc(shownUnit(x.m))}</small></div>
      <div class="normal">${esc(tx.normalRange)}: ${fmt(x.m, x.lo)}–${fmt(x.m, x.hi)}</div>
      <div class="status ${x.status}"><i></i>${esc(x.status === "good" ? tx.better : x.status === "bad" ? tx.worse : tx.usual)}</div>
    </div>`).join("");
  }

  // Findings: plain-language phrasing for each metric that appears in a hypothesis (analytics.PAIRS).
  const X_PHRASE = {
    es: {
      actLoad: ["Después de días de entrenamiento fuerte", "después de días suaves o de descanso"],
      imVig: ["Después de días con mucho esfuerzo intenso", "con poco esfuerzo intenso"],
      lastEnd: (h, l) => [`Cuando terminas de entrenar tarde (${h} o después)`, `cuando terminas antes de las ${l}`],
      stress: ["Después de días con estrés alto", "con estrés bajo"],
      steps: (h, l) => [`Después de días con muchos pasos (${h} o más)`, `con ${l} pasos o menos`],
      sleepScore: ["Cuando duermes bien", "cuando duermes mal"],
      sleepH: (h, l) => [`Cuando duermes ${h} h o más`, `con ${l} h o menos`],
      bedtime: (h, l) => [`Cuando te acuestas tarde (${h} o después)`, `antes de las ${l}`],
      hrv: ["Los días con HRV alta", "con HRV baja"],
      readiness: ["Los días con disposición alta", "con disposición baja"],
      tsb: ["Cuando estás descansado", "cuando acumulas fatiga"],
      acwr: ["Cuando subes la carga de golpe", "cuando la mantienes estable"],
      resp: ["Las noches con respiración más rápida", "con respiración más lenta"],
      skinTemp: ["Cuando sube la temperatura de tu piel", "cuando baja"],
    },
    en: {
      actLoad: ["After hard training days", "after easy or rest days"],
      imVig: ["After days with lots of hard effort", "with little hard effort"],
      lastEnd: (h, l) => [`When you finish training late (${h} or later)`, `when you finish before ${l}`],
      stress: ["After high-stress days", "after low-stress days"],
      steps: (h, l) => [`After days with many steps (${h}+)`, `with ${l} steps or fewer`],
      sleepScore: ["When you sleep well", "when you sleep badly"],
      sleepH: (h, l) => [`When you sleep ${h} h or more`, `with ${l} h or less`],
      bedtime: (h, l) => [`When you go to bed late (${h} or later)`, `before ${l}`],
      hrv: ["On days with high HRV", "with low HRV"],
      readiness: ["On days with high readiness", "with low readiness"],
      tsb: ["When you are rested", "when fatigue builds up"],
      acwr: ["When you ramp up load suddenly", "when you keep it steady"],
      resp: ["On nights with faster breathing", "with slower breathing"],
      skinTemp: ["When your skin temperature rises", "when it drops"],
    },
  };
  const Y_NOUN = {
    es: { hrv: "tu HRV nocturna", rhr: "tu pulso en reposo", sleepScore: "la calidad de tu sueño", readiness: "tu disposición para entrenar", bbCharged: "tu recarga nocturna de energía", bbMax: "tu energía al despertar", stress: "tu estrés", deepH: "tu sueño profundo", actLoad: "tu carga de entrenamiento" },
    en: { hrv: "your overnight HRV", rhr: "your resting heart rate", sleepScore: "your sleep score", readiness: "your training readiness", bbCharged: "your overnight energy recharge", bbMax: "your morning energy", stress: "your stress", deepH: "your deep sleep", actLoad: "your training load" },
  };

  function findingCard(p) {
    const tx = t(), L = state.lang;
    const cut = (v) => (p.x === "lastEnd" || p.x === "bedtime" ? clock(v) : p.x === "sleepH" ? nf(v, 1) : nf(v));
    const ph = X_PHRASE[L][p.x];
    const [hiText, loText] = typeof ph === "function" ? ph(cut(p.hiCut), cut(p.loCut)) : ph;
    const yv = (v) => (METRICS[p.y] ? withUnit(p.y, v) : nf(v));
    const max = Math.max(p.hiMean, p.loMean) || 1;
    const title = `${hiText}, ${Y_NOUN[L][p.y]} ${p.hiMean > p.loMean ? tx.up : tx.down}.`;
    return `<div class="finding">
      <h3>${esc(title)}</h3>
      <div class="compare">
        <div class="compare-row"><span>${esc(hiText)}</span><b>${esc(yv(p.hiMean))}</b><div class="bar-track"><i style="width:${(p.hiMean / max) * 100}%"></i></div></div>
        <div class="compare-row"><span>${esc(cap(loText))}</span><b>${esc(yv(p.loMean))}</b><div class="bar-track base"><i style="width:${(p.loMean / max) * 100}%"></i></div></div>
      </div>
      <div class="foot"><span class="pill ${Math.abs(p.r) >= 0.4 ? "strong" : ""}">${esc(Math.abs(p.r) >= 0.4 ? tx.clear : tx.moderate)}</span>${esc(tx.basedOn(nf(p.n)))}</div>
    </div>`;
  }

  function renderFindings() {
    const c = RAW.correlations;
    const sc = c && c.scopes ? c.scopes[state.scope] || c.scopes.all : null;
    const L = state.lang;
    const list = sc ? sc.pairs
      .filter((p) => p.p < 0.05 && Math.abs(p.r) >= 0.15 && p.n >= 30 && X_PHRASE[L][p.x] && Y_NOUN[L][p.y] && p.hiMean > 0 && p.loMean > 0)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 4) : [];
    $("findings").innerHTML = list.length ? list.map(findingCard).join("") : `<div class="card empty">${esc(t().noFindings)}</div>`;
  }

  function renderOverview() {
    const r = scopeRange();
    renderKpis(r, prevRange());
    renderNow();
    document.querySelector('[data-i18n="weeklySub"]').textContent = bucketFor(r) === MONTHLY ? t().weeklySubLong : t().weeklySub;
    sportBars("c-weekly", "weekly-legend", actsIn(r), r);
    renderFindings();
  }

  // ---------------------------------------------------------------- training
  function renderSportTable(acts) {
    const tx = t();
    const rows = SPORTS.map((s) => [s, acts.filter((a) => a.sport === s)]).filter(([, l]) => l.length);
    if (!rows.length) { $("sport-table").innerHTML = `<div class="empty">${esc(tx.noData)}</div>`; return; }
    const totalMin = sumOf(acts, "min") || 1;
    rows.sort((a, b) => sumOf(b[1], "min") - sumOf(a[1], "min"));
    $("sport-table").innerHTML = `<table><thead><tr><th>${tx.sport}</th><th>${tx.count}</th><th>${tx.hours}</th><th>${tx.distance}</th><th>${tx.elevation}</th><th class="left">${tx.shareOfTime}</th></tr></thead><tbody>${rows.map(([s, l]) => {
      const share = sumOf(l, "min") / totalMin;
      return `<tr><td><span class="dot" style="background:${sportColor(s)}"></span>${tx.sports[s]}</td><td>${nf(l.length)}</td><td>${nf(sumOf(l, "min") / 60)} h</td><td>${sumOf(l, "km") >= 1 ? nf(sumOf(l, "km")) + " km" : "–"}</td><td>${sumOf(l, "elev") >= 1 ? nf(sumOf(l, "elev")) + " m" : "–"}</td><td class="left"><span class="share"><i style="width:${Math.max(2, share * 120)}px;background:${sportColor(s)}"></i>${nf(share * 100)} %</span></td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function renderForm(r) {
    const rows = daysIn(r).filter((d) => d.ctl != null);
    if (!rows.length) { $("form-legend").innerHTML = ""; return emptyChart("c-form"); }
    // Weekly averages: daily values (fatigue above all) wiggle more than they inform.
    const byWeek = new Map();
    for (const d of rows) {
      const k = weekStart(d.date);
      if (!byWeek.has(k)) byWeek.set(k, []);
      byWeek.get(k).push(d);
    }
    const pts = [...byWeek].map(([k, l]) => ({ date: k, ctl: avgOf(l, "ctl"), atl: avgOf(l, "atl") }));
    const c1 = css("--s1"), c2 = css("--s2");
    legend("form-legend", [[t().fitness, c1, "line"], [t().fatigue, c2, "line"]]);
    chart("c-form", {
      data: { labels: pts.map((d) => d.date), datasets: [line(t().fitness, pts.map((d) => d.ctl), c1, { borderWidth: 2.5 }), line(t().fatigue, pts.map((d) => d.atl), c2)] },
      options: {
        plugins: { tooltip: { callbacks: { title: (it) => WEEKLY.title(it[0].label), label: (c) => `${c.dataset.label}: ${nf(c.raw)}` } } },
        scales: { x: { ticks: { maxTicksLimit: 6, callback(v) { return monthLabel(this.getLabelForValue(v).slice(0, 7)); } } } },
      },
    });
  }

  function renderZones(acts) {
    const tx = t();
    const zones = [0, 0, 0, 0, 0];
    for (const a of acts) (a.zones || []).forEach((m, i) => { if (i < 5) zones[i] += m || 0; });
    const total = sum(zones);
    if (!total) { $("zones").innerHTML = `<div class="empty">${esc(tx.noData)}</div>`; return; }
    const max = Math.max(...zones);
    $("zones").innerHTML = zones.map((m, i) => `<div class="zone">
      <div class="zname"><b>${esc(tx.zones[i][0])}</b><span>${esc(tx.zones[i][1])}</span></div>
      <div class="zbar"><i style="width:${(m / max) * 100}%;background:var(--z${i + 1})"></i></div>
      <div class="zval">${nf((m / total) * 100)} %<small>${nf(m / 60)} h</small></div>
    </div>`).join("");
  }

  function renderCalendar(r) {
    let [a, b] = r;
    if (daysBetween(a, b) > 371) a = addDays(b, -364);
    const start = weekStart(a);
    const weeks = Math.ceil((daysBetween(start, b) + 1) / 7);
    const minutes = new Map();
    for (const act of ACTS) if (inR(act.date, [a, b])) minutes.set(act.date, (minutes.get(act.date) || 0) + (act.min || 0));
    const fills = [css("--surface-2"), css("--z1"), css("--z2"), css("--z4"), css("--z5")];
    const level = (m) => (m <= 0 ? 0 : m < 45 ? 1 : m < 90 ? 2 : m < 150 ? 3 : 4);
    const cell = 13, gap = 3, top = 18, left = 30;
    let svg = "", lastMonth = -1, lastLabelWeek = -9;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        if (day < a || day > b) continue;
        const m = minutes.get(day) || 0;
        svg += `<rect x="${left + w * (cell + gap)}" y="${top + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${fills[level(m)]}"><title>${dayYearLabel(day)} · ${m ? dur(m) : t().calLegend[0]}</title></rect>`;
        const month = +day.slice(5, 7) - 1;
        if (month !== lastMonth) {
          if (w - lastLabelWeek >= 3) { svg += `<text x="${left + w * (cell + gap)}" y="11">${t().months[month]}</text>`; lastLabelWeek = w; }
          lastMonth = month;
        }
      }
    }
    [0, 2, 4].forEach((d) => { svg += `<text x="0" y="${top + d * (cell + gap) + 10}">${t().weekdays[d]}</text>`; });
    $("calendar").innerHTML = `<svg width="${left + weeks * (cell + gap)}" height="${top + 7 * (cell + gap)}" role="img">${svg}</svg>
      <div class="legend">${t().calLegend.map((l, i) => `<span><i style="background:${fills[i]}"></i>${esc(l)}</span>`).join("")}</div>`;
  }

  function renderRecords(acts) {
    const tx = t();
    const best = (list, key) => list.filter((a) => a[key] != null).sort((a, b) => b[key] - a[key])[0];
    const bestPower = (secs) => acts.filter((a) => a.power && a.power[secs]).sort((a, b) => b.power[secs] - a.power[secs])[0];
    const recs = [
      [tx.rec.km, best(acts, "km"), (a) => `${nf(a.km, 1)} km`],
      [tx.rec.min, best(acts, "min"), (a) => dur(a.min)],
      [tx.rec.elev, best(acts, "elev"), (a) => `${nf(a.elev)} m`],
      [tx.rec.p1200, bestPower("1200"), (a) => `${a.power["1200"]} W`],
      [tx.rec.p300, bestPower("300"), (a) => `${a.power["300"]} W`],
      [tx.rec.run, best(acts.filter((a) => a.sport === "running"), "km"), (a) => `${nf(a.km, 1)} km`],
      [tx.rec.load, best(acts, "load"), (a) => nf(a.load)],
      [tx.rec.hrMax, best(acts, "hrMax"), (a) => `${a.hrMax} ${unit("rhr")}`],
    ].filter(([, a]) => a);
    $("records").innerHTML = recs.length ? recs.map(([l, a, f]) => `<div class="record"><div class="label">${esc(l)}</div><div class="value">${esc(f(a))}</div><p class="sub" title="${esc(a.name)}">${esc(dayYearLabel(a.date))} · ${esc(a.name)}</p></div>`).join("") : `<div class="empty">${esc(tx.noData)}</div>`;
  }

  function renderTraining() {
    const r = scopeRange(), acts = actsIn(r);
    renderSportTable(acts);
    sportBars("c-monthly", "monthly-legend", acts, r, MONTHLY);
    renderForm(r);
    renderZones(acts);
    renderCalendar(r);
    renderRecords(acts);
  }

  // ---------------------------------------------------------------- health
  function metricCard(m, dr, dp, p) {
    const cur = avgOf(dr, m), prev = p ? avgOf(dp, m) : null;
    const u = shownUnit(m);
    const delta = p && cur != null && prev != null
      ? (m === "steps" ? deltaHtml(((cur - prev) / prev) * 100, 0, "", 1, "pct") : deltaHtml(cur - prev, METRICS[m][3], u, METRICS[m][4]))
      : '<div class="delta">&nbsp;</div>';
    return `<div class="metric">
      <h3>${esc(label(m))}</h3>
      <p class="what">${esc(what(m))}</p>
      <div class="value">${fmt(m, cur)}${u ? `<small>${esc(u)}</small>` : ""}</div>
      ${delta}
      <div class="chart small"><canvas id="c-h-${m}"></canvas></div>
    </div>`;
  }

  function renderSleep(r, dr) {
    const tx = t();
    const nights = dr.filter((d) => d.sleepH);
    const bed = vals(nights, "bedtime");
    const tile = (l, v, u, hint) => `<div class="tile"><div class="label">${esc(l)}</div><div class="value">${v}${u ? `<small>${esc(u)}</small>` : ""}</div>${hint ? `<div class="delta">${esc(hint)}</div>` : ""}</div>`;
    $("sleep-tiles").innerHTML = [
      tile(tx.bed, clock(mean(bed)), ""),
      tile(tx.wake, clock(avgOf(nights, "wake")), ""),
      tile(tx.regularity, bed.length > 2 ? `± ${nf(sd(bed) * 60)}` : "–", "min", tx.regularityHint),
      tile(tx.nights7, nights.length ? nf((nights.filter((d) => d.sleepH >= 7).length / nights.length) * 100) : "–", "%"),
    ].join("");
    if (!nights.length) { $("sleep-legend").innerHTML = ""; return emptyChart("c-sleep"); }
    const bucket = daysBetween(...r) > 120 ? MONTHLY : WEEKLY;
    const groups = new Map();
    for (const d of nights) {
      const k = bucket.key(d.date);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(d);
    }
    const keys = [...groups.keys()].sort();
    const stages = [["deepH", css("--z5")], ["remH", css("--z3")], ["lightH", css("--z1")], ["awakeH", css("--neutral")]];
    legend("sleep-legend", stages.map(([k, c]) => [tx.stages[k], c]));
    chart("c-sleep", {
      data: { labels: keys, datasets: stages.map(([k, c]) => stackBar(tx.stages[k], keys.map((g) => +(avgOf(groups.get(g), k) || 0).toFixed(2)), c)) },
      options: {
        plugins: { tooltip: { callbacks: { title: (it) => bucket.title(it[0].label), label: (c) => `${c.dataset.label}: ${dur(c.raw * 60)}`, footer: (it) => `Total: ${dur(sum(it.map((i) => i.raw)) * 60)}` } } },
        scales: hoursScales(bucket),
      },
    });
  }

  function renderBody(r) {
    const tx = t();
    const cards = [];
    const vo2 = (RAW.vo2 || []).filter((x) => inR(x.date, r));
    const vo2Sport = ["cycling", "running"].find((s) => vo2.some((x) => x.sport === s));
    const weight = (RAW.weight || []).filter((x) => inR(x.date, r));
    if (vo2Sport) cards.push(["vo2", tx.vo2(tx.sports[vo2Sport].toLowerCase()), tx.vo2What, vo2.filter((x) => x.sport === vo2Sport).map((x) => [x.date, x.value]), ""]);
    if (weight.length) cards.push(["weight", tx.weight, tx.weightWhat, weight.map((x) => [x.date, x.kg]), "kg"]);
    dropCharts("c-b-");
    $("body-cards").innerHTML = cards.map(([k, name, desc, pts, u]) => `<div class="metric">
      <h3>${esc(name)}</h3><p class="what">${esc(desc)}</p>
      <div class="value">${nf(pts[pts.length - 1][1], 1)}${u ? `<small>${u}</small>` : ""}</div>
      <div class="delta">${esc(tx.latest)} · ${esc(dayYearLabel(pts[pts.length - 1][0]))}</div>
      <div class="chart small"><canvas id="c-b-${k}"></canvas></div></div>`).join("");
    for (const [k, name, , pts, u] of cards) {
      const ys = pts.map((x) => x[1]);
      const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.3 || 1;
      chart(`c-b-${k}`, {
        data: { labels: pts.map((x) => x[0]), datasets: [line(name, ys, css("--s1"), { stepped: k === "vo2", tension: 0, pointRadius: pts.length < 40 ? 3 : 0 })] },
        options: {
          plugins: { tooltip: { callbacks: { title: (it) => dayYearLabel(it[0].label), label: (c) => `${nf(c.raw, 1)} ${u}` } } },
          scales: { x: { ticks: { maxTicksLimit: 4, callback(v) { return monthLabel(this.getLabelForValue(v).slice(0, 7)); } } }, y: { beginAtZero: false, suggestedMin: lo - pad, suggestedMax: hi + pad, ticks: { maxTicksLimit: 3 } } },
        },
      });
    }
  }

  function renderHealth() {
    const r = scopeRange(), p = prevRange();
    const dr = daysIn(r), dp = p ? daysIn(p) : [];
    const metrics = ["hrv", "rhr", "sleepH", "sleepScore", "bbMax", "stress", "readiness", "steps"].filter((m) => vals(dr, m).length);
    dropCharts("c-h-");
    $("health-cards").innerHTML = metrics.length ? metrics.map((m) => metricCard(m, dr, dp, p)).join("") : `<div class="card empty">${esc(t().noData)}</div>`;
    metrics.forEach((m) => trendChart(`c-h-${m}`, dr, m, r));
    renderSleep(r, dr);
    renderBody(r);
  }

  // ---------------------------------------------------------------- history
  function renderHistory() {
    const tx = t();
    $("cum-metric").innerHTML = Object.entries(tx.cumMetrics).map(([k, v]) => `<button data-cum="${k}" aria-selected="${k === state.cumMetric}">${esc(v)}</button>`).join("");
    const pick = { km: (a) => a.km || 0, hours: (a) => (a.min || 0) / 60, elev: (a) => a.elev || 0, acts: () => 1 }[state.cumMetric];
    const unitOf = { km: " km", hours: " h", elev: " m", acts: "" }[state.cumMetric];
    const focus = YEARS.includes(state.scope) ? state.scope : TODAY.slice(0, 4);

    if (YEARS.length && ACTS.length) {
      const doy = (d) => daysBetween(`${d.slice(0, 4)}-01-01`, d);
      const accent = css("--s1"), other = css("--neutral");
      // Emphasis: the year in focus in the accent colour, every other year as grey context.
      const datasets = YEARS.map((y) => {
        const perDay = new Array(366).fill(0);
        for (const a of ACTS) if (a.date.startsWith(y)) perDay[doy(a.date)] += pick(a);
        const lastDay = y === TODAY.slice(0, 4) ? doy(TODAY) : 365;
        let acc = 0;
        const data = perDay.map((v, d) => { acc += v; return d <= lastDay ? +acc.toFixed(1) : null; });
        const strong = y === focus;
        return line(y, data, strong ? accent : alpha(other, 0.75), { borderWidth: strong ? 3 : 1.5, tension: 0, order: strong ? 0 : 1 });
      });
      legend("cum-legend", [[focus, accent, "line"], [tx.otherYears, other, "line"]]);
      chart("c-cumulative", {
        data: { labels: Array.from({ length: 366 }, (_, i) => i), datasets },
        options: {
          plugins: { tooltip: {
            itemSort: (a, b) => (b.raw ?? -1) - (a.raw ?? -1),
            callbacks: {
              title: (it) => { const d = new Date(Date.UTC(2023, 0, 1 + +it[0].label)); return `${tx.by} ${d.getUTCDate()} ${tx.months[d.getUTCMonth()]}`; },
              label: (c) => `${c.dataset.label}: ${nf(c.raw)}${unitOf}`,
            },
          } },
          scales: {
            x: { ticks: { autoSkip: false, maxTicksLimit: 400, callback(v) { const d = new Date(Date.UTC(2023, 0, 1 + v)); return d.getUTCDate() === 1 ? tx.months[d.getUTCMonth()] : null; } } },
            y: { ticks: { callback: (v) => `${nf(v)}${unitOf}` } },
          },
        },
      });
    } else { $("cum-legend").innerHTML = ""; emptyChart("c-cumulative"); }

    // Year table, best value per column in bold; a year still in progress can't win a total.
    const colsDef = [
      [tx.count, (a) => a.length, 0, 1, "", true],
      [tx.hours, (a) => sumOf(a, "min") / 60, 0, 1, " h", true],
      [tx.distance, (a) => sumOf(a, "km"), 0, 1, " km", true],
      [tx.elevation, (a) => sumOf(a, "elev"), 0, 1, " m", true],
      [label("rhr"), (a, d) => avgOf(d, "rhr"), 0, -1, "", false],
      [label("hrv"), (a, d) => avgOf(d, "hrv"), 0, 1, "", false],
      [label("sleepH"), (a, d) => avgOf(d, "sleepH"), 1, 1, " h", false],
    ];
    const rows = YEARS.slice().reverse().map((y) => {
      const yr = [`${y}-01-01`, `${y}-12-31`];
      const a = actsIn(yr), d = daysIn(yr);
      return [y, colsDef.map(([, f]) => f(a, d))];
    });
    const bestRow = colsDef.map(([, , , dir, , total], i) => {
      const vs = rows.map(([y, v]) => (total && isCurrentYear(y) ? null : v[i]));
      const ok = vs.filter((v) => v != null && v > 0);
      if (ok.length < 2) return -1;
      // Compare as displayed: a tie (47 vs 47) has no winner.
      const shown = (v) => (v == null ? null : nf(v, colsDef[i][2]));
      const target = dir > 0 ? Math.max(...ok) : Math.min(...ok);
      return vs.filter((v) => shown(v) === shown(target)).length === 1 ? vs.indexOf(target) : -1;
    });
    $("year-table").innerHTML = rows.length ? `<table><thead><tr><th>${tx.year}</th>${colsDef.map(([h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(([y, v], ri) => `<tr><td>${y}${isCurrentYear(y) ? ` <span class="muted">(${tx.inProgress})</span>` : ""}</td>${v.map((x, i) => `<td class="${bestRow[i] === ri ? "best" : ""}">${x ? nf(x, colsDef[i][2]) + colsDef[i][4] : "–"}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="empty">${esc(tx.noData)}</div>`;
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
    const pageSize = 25, pages = Math.max(1, Math.ceil(list.length / pageSize));
    state.actPage = Math.min(state.actPage, pages - 1);
    const page = list.slice(state.actPage * pageSize, (state.actPage + 1) * pageSize);
    const colsDef = [["start", tx.date, "left"], ["name", tx.activity, "left"], ["min", tx.duration], ["km", tx.distance], ["elev", tx.elevation], ["hr", tx.avgHr], ["watts", tx.power], ["load", tx.load]];
    const arrow = (k) => (k === key ? (dir > 0 ? " ▲" : " ▼") : "");
    const when = (a) => new Date(a.date + "T12:00:00").toLocaleDateString(state.lang, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    $("act-count").textContent = `${nf(list.length)} ${tx.acts}`;
    $("act-table").innerHTML = list.length ? `<table><thead><tr>${colsDef.map(([k, l, cls]) => `<th class="sortable ${cls || ""}" data-sort="${k}">${esc(l)}${arrow(k)}</th>`).join("")}</tr></thead><tbody>${page.map((a) => `<tr>
      <td>${esc(when(a))}</td>
      <td class="name" title="${esc(a.name)}"><span class="dot" style="background:${sportColor(a.sport)}"></span>${esc(a.name)}${a.pr ? " 🏅" : ""}<span class="kind">${esc(tx.sports[a.sport] || "")}${a.place ? " · " + esc(a.place) : ""}</span></td>
      <td>${dur(a.min)}</td><td>${a.km ? nf(a.km, 1) + " km" : "–"}</td><td>${a.elev ? nf(a.elev) + " m" : "–"}</td>
      <td>${a.hr ? nf(a.hr) : "–"}</td><td>${a.watts ? a.watts + " W" : "–"}</td><td>${a.load ? nf(a.load) : "–"}</td>
    </tr>`).join("")}</tbody></table>` : `<div class="empty">${esc(tx.noData)}</div>`;
    $("act-pager").innerHTML = pages > 1 ? `<button class="btn" data-page="-1" ${state.actPage === 0 ? "disabled" : ""}>${tx.prev}</button><span class="muted">${state.actPage + 1} ${tx.of} ${pages}</span><button class="btn" data-page="1" ${state.actPage >= pages - 1 ? "disabled" : ""}>${tx.next}</button>` : "";
  }

  // ---------------------------------------------------------------- routing
  const RENDER = { overview: renderOverview, training: renderTraining, health: renderHealth, history: renderHistory, activities: renderActivities };
  function render() {
    renderShell();
    if (!HAS_DATA) {
      // First run of the app: a progress screen instead of empty charts.
      $("welcome").hidden = !LIVE;
      document.querySelector(".nav-row").hidden = !!LIVE;
      $("main").innerHTML = LIVE ? "" : `<div class="empty">${esc(t().noData)}</div>`;
      return;
    }
    RENDER[state.tab]();
  }

  function toast(msg, ms = 3000) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    if (ms) toast.timer = setTimeout(() => { el.hidden = true; }, ms);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-tab],[data-sort],[data-page],[data-cum]");
    if (!el) return;
    if (el.dataset.tab && el.classList.contains("tab")) { state.tab = el.dataset.tab; store.set("tab", state.tab); history.replaceState(null, "", "#" + state.tab); render(); window.scrollTo({ top: 0 }); }
    else if (el.dataset.sort) { const k = el.dataset.sort; state.actSort = [k, state.actSort[0] === k ? -state.actSort[1] : -1]; renderActivities(); }
    else if (el.dataset.page) { state.actPage += +el.dataset.page; renderActivities(); }
    else if (el.dataset.cum) { state.cumMetric = el.dataset.cum; renderHistory(); }
  });
  $("scope").addEventListener("change", (e) => { state.scope = e.target.value; store.set("scope", state.scope); state.actPage = 0; render(); });
  $("lang-btn").addEventListener("click", () => { state.lang = es() ? "en" : "es"; store.set("lang", state.lang); render(); });
  $("theme-btn").addEventListener("click", () => {
    state.theme = { auto: "dark", dark: "light", light: "auto" }[state.theme];
    store.set("theme", state.theme);
    render();
  });
  $("act-search").addEventListener("input", () => { state.actPage = 0; renderActivities(); });
  $("act-sport").addEventListener("change", () => { state.actPage = 0; renderActivities(); });
  window.addEventListener("hashchange", () => { const tab = location.hash.slice(1); if (RENDER[tab] && tab !== state.tab) { state.tab = tab; render(); } });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (state.theme === "auto") render(); });

  // ---------------------------------------------------------------- sync (app only)
  // The page asks the local server to sync on open, keeps showing cached data meanwhile and
  // reloads once new data has landed. The server skips automatic syncs right after one ran,
  // so that reload does not start another.
  const sync = { running: false, watched: false, status: null };

  function ago(when) {
    const s = (Date.now() - new Date(when)) / 1000;
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
