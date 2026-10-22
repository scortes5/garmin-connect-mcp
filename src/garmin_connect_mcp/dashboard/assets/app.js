/* Pulso (Garmin + Strava dashboard) — single-file app. Data comes from window.GARMIN_DATA (see normalize.py).
 *
 * Design rules: every view answers one plain question; one y-axis per chart; colour follows the
 * entity (a sport keeps its colour everywhere); words over acronyms. Every number can be clicked:
 * the side panel shows how it changed over time and the exact rows it was computed from. */
(() => {
  "use strict";

  const RAW = window.GARMIN_DATA || {};
  const LIVE = !!window.GARMIN_LIVE;
  const AUTOSYNC = LIVE && !!window.GARMIN_AUTOSYNC;
  const STRAVA = RAW.strava || null;
  const DEMO = !!RAW.demo;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const TODAY = iso(new Date());

  // ---------------------------------------------------------------- i18n
  const I18N = {
    es: {
      tabs: { overview: "Resumen", training: "Entrenamiento", health: "Recuperación y sueño", history: "Año a año", activities: "Actividades", data: "Datos" },
      period: "Período", sportsLabel: "Deportes", sourceLabel: "Fuente", resetFilters: "Quitar filtros",
      presets: { "30": "Últimos 30 días", "90": "Últimos 90 días", "365": "Últimos 12 meses", ytd: "Este año", all: "Todo el historial", custom: "Personalizado" },
      srcAll: "Todas", srcGarmin: "Garmin", srcStrava: "Strava",
      srcNames: { garmin: "Garmin", strava: "Strava", both: "Garmin + Strava" },
      sync: "Sincronizar", syncing: "Sincronizando…", synced: "Datos actualizados", lastSync: "Sincronizado",
      acts: "actividades", yearsOfData: "años de datos", weekOf: "Semana del", latest: "Último valor", same: "igual", by: "Al",
      hlScope: { "365": "En los últimos 12 meses", days: (n) => `En los últimos ${n} días`, current: (y) => `En lo que va de ${y}`, year: (y) => `En ${y}`, all: (y) => `Desde ${y}`, custom: (a, b) => `Entre el ${a} y el ${b}` },
      hlBody: (h, n, km) => `entrenaste <b>${h} horas</b> en <b>${n} actividades</b>${km ? ` y recorriste <b>${km} km</b>` : ""}`,
      hlDelta: (pct, more, prev) => `, <b>un ${pct} % ${more ? "más" : "menos"}</b> que ${prev}.`,
      prevLabel: { generic: "el período anterior", year: (y) => `en ${y}`, current: (y) => `en el mismo período de ${y}` },
      vsPrev: { generic: "vs período anterior", year: (y) => `vs ${y}` },
      kpi: { hours: "Horas de entrenamiento", acts: "Actividades", km: "Distancia", elev: "Desnivel acumulado" },
      nowTitle: "¿Cómo estás estos días?",
      nowSub: (d) => `Promedio de los 7 días hasta el ${d}, comparado con tus 8 semanas anteriores.`,
      normalRange: "Lo normal para ti", better: "Mejor que lo normal", worse: "Peor que lo normal", usual: "Normal",
      nowAllGood: "Todo está dentro de lo normal o mejor. Tu cuerpo se está recuperando bien.",
      nowOneBad: (n) => `Casi todo está normal; solo ${n} está peor que lo habitual.`,
      nowManyBad: (k) => `${k} indicadores están peor que lo habitual. Puede ser un buen momento para bajar la intensidad.`,
      nowNoData: "No hay datos de los últimos días. Sincroniza tu reloj con Garmin Connect.",
      weeklyTitle: "Tu entrenamiento semana a semana", weeklySub: "Horas de entrenamiento por semana, separadas por deporte. Toca una barra para ver esas actividades.",
      weeklySubLong: "Horas de entrenamiento por mes, separadas por deporte. Toca una barra para ver esas actividades.",
      findingsTitle: "Lo que dicen tus datos",
      findingsSub: "Patrones que se repiten en tu propio historial, calculados para el período elegido. Muestran lo que suele pasar junto, no prueban causa y efecto. Toca uno para ver cada día que lo respalda.",
      noFindings: "Todavía no hay suficientes días con datos en este período para encontrar patrones confiables.",
      clear: "Patrón claro", moderate: "Patrón moderado", basedOn: (n) => `Basado en ${n} días`,
      up: "sube", down: "baja",
      bySportTitle: "Por deporte", bySportSub: "Cuánto entrenaste en cada deporte en este período.",
      monthlyTitle: "Mes a mes", monthlySub: "Horas de entrenamiento por mes, separadas por deporte.",
      formTitle: "Forma física y fatiga",
      formSub: "La forma física sube cuando entrenas con constancia durante semanas. La fatiga refleja los últimos 7 días. Si la fatiga queda muy por encima de la forma, conviene descansar.",
      fitness: "Forma física", fatigue: "Fatiga",
      zonesTitle: "¿A qué intensidad entrenas?",
      zonesSub: { garmin: "Tiempo total en cada zona de frecuencia cardiaca, según Garmin.", stravaHr: "Tiempo en tus zonas de pulso configuradas en Strava.", stravaPwr: "Tiempo en tus zonas de potencia de Strava (según tu FTP)." },
      zoneSrc: { garmin: "Garmin", stravaHr: "Strava · pulso", stravaPwr: "Strava · potencia" },
      zones: [["Zona 1", "Muy suave"], ["Zona 2", "Suave · base aeróbica"], ["Zona 3", "Moderada"], ["Zona 4", "Fuerte · umbral"], ["Zona 5", "Máxima"]],
      powerZones: ["Recuperación", "Resistencia", "Tempo", "Umbral", "VO₂ máx.", "Anaeróbica", "Neuromuscular"],
      calendarTitle: "Días de entrenamiento", calendarSub: "Cada cuadrado es un día; más oscuro, más minutos entrenados. Toca un día para verlo completo.",
      calLegend: ["Descanso", "< 45 min", "45–90 min", "90–150 min", "> 150 min"],
      recordsTitle: "Tus mejores marcas del período",
      rec: { km: "Mayor distancia", min: "Sesión más larga", elev: "Más desnivel", p1200: "Mejor potencia 20 min", p300: "Mejor potencia 5 min", run: "Carrera más larga", load: "Sesión más exigente", hrMax: "Pulso más alto", relEffort: "Mayor esfuerzo relativo" },
      bestTitle: "Mejores tiempos corriendo", bestSub: "Tus mejores esfuerzos en cada distancia según Strava, en este período. Toca una distancia para ver cómo has progresado.",
      gearTitle: "Tu equipo", gearSub: "Bicicletas y zapatillas registradas en Strava: kilómetros totales y en este período.",
      shareOfTime: "% del tiempo",
      healthLead: "Cada tarjeta muestra el promedio del período, el cambio respecto al período anterior y la tendencia. Toca una tarjeta para ver cada día.",
      sleepTitle: "Cómo duermes", sleepSub: "Horas promedio de cada fase del sueño por noche.",
      bed: "Te acuestas", wake: "Te levantas", regularity: "Regularidad al acostarte", nights7: "Noches de 7 h o más",
      regularityHint: "variación típica de un día a otro",
      stages: { deepH: "Profundo", remH: "REM", lightH: "Ligero", awakeH: "Despierto" },
      vo2: (s) => `VO₂ máx. (${s})`, vo2What: "Tu capacidad aeróbica estimada por Garmin. Más alta es mejor.",
      weight: "Peso", weightWhat: "Mediciones de peso registradas en Garmin.",
      endurance: "Puntuación de resistencia", enduranceWhat: "Estimación semanal de Garmin de tu resistencia.",
      cumTitle: "Año contra año", cumSub: "Total acumulado desde el 1 de enero. Cada línea es un año; así ves si vas por delante o por detrás.",
      cumMetrics: { hours: "Horas", km: "Distancia", elev: "Desnivel", acts: "Actividades" },
      otherYears: "Otros años", inProgress: "en curso",
      yearTitle: "Resumen por año", yearSub: "En negrita, el mejor año de cada columna. Toca un año para ver sus actividades.",
      search: "Buscar por nombre, lugar o equipo…", allSports: "Todos",
      date: "Fecha", activity: "Actividad", duration: "Duración", distance: "Distancia", elevation: "Desnivel", avgHr: "Pulso medio", power: "Potencia", load: "Carga",
      year: "Año", hours: "Horas", count: "Actividades", sport: "Deporte", value: "Valor", time: "Tiempo", pace: "Ritmo", kmPeriod: "Km en el período", kmTotal: "Km totales",
      prev: "Anterior", next: "Siguiente", of: "de",
      sports: { cycling: "Ciclismo", running: "Running", swimming: "Natación", walking: "Caminata", gym: "Gimnasio", other: "Otros" },
      weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
      noData: "Sin datos para este período.",
      privacy: "Tus datos se guardan solo en este computador.", syncWarnings: "avisos de sincronización",
      welcomeTitle: "Preparando Pulso", welcomeBody: "Descargando tu historial completo. La primera vez toma unos minutos; después solo se baja lo nuevo y se abre al instante.",
      preparing: "Preparando…", downloading: "Descargando", upToDate: "Al día", syncFailed: "No se pudo sincronizar",
      authHint: "Inicia sesión en Garmin desde una terminal con: garmin-connect-mcp auth", showingCached: "Mostrando los datos guardados.", refreshing: "Datos nuevos, actualizando…",
      sources: { daily_summaries: "Resumen diario", sleep: "Sueño", hrv: "HRV", readiness: "Disposición para entrenar", training_status: "Estado de entrenamiento", max_metrics: "VO₂ máx.", endurance: "Resistencia", body_composition: "Peso", activities: "Actividades", strava: "Strava" },
      // panel
      panel: { metric: "Métrica diaria", acts: "Actividades", activity: "Actividad", field: "Dato de actividad", day: "Día", series: "Serie", finding: "Patrón", best: "Mejor esfuerzo", zone: "Zona", gear: "Equipo" },
      gran: { day: "Día", week: "Semana", month: "Mes" }, scopeFiltered: "Período elegido", scopeAll: "Todo el historial",
      stat: { avg: "Promedio", min: "Mínimo", max: "Máximo", last: "Último", n: "Días con dato", total: "Total", nActs: "Actividades", best: "Mejor" },
      usedData: "Datos usados", downloadCsv: "Descargar CSV", columns: "Columnas",
      measure: { hours: "Horas", km: "Distancia", elev: "Desnivel", acts: "Actividades", load: "Carga", relEffort: "Esfuerzo relativo" },
      allOfSport: (s) => `Ver todas las actividades de ${s.toLowerCase()}`,
      fields: "Todos los datos", fieldsHint: "Toca un dato para ver cómo ha variado en tus actividades.",
      hrZonesG: "Zonas de pulso (Garmin)", hrZonesS: "Zonas de pulso (Strava)", pwrZonesS: "Zonas de potencia (Strava)",
      powerCurve: "Curva de potencia", powerCurveSub: "Mejor potencia media para cada duración en esta actividad, comparada con tu mejor del período.",
      thisActivity: "Esta actividad", bestInPeriod: "Tu mejor del período",
      splits: "Parciales por kilómetro", segments: "Segmentos", laps: "Vueltas", bestEfforts: "Mejores esfuerzos", description: "Descripción",
      prRank: (n) => (n === 1 ? "🥇 Récord" : n === 2 ? "🥈 2.º mejor" : n === 3 ? "🥉 3.º mejor" : ""),
      dayMetrics: "Métricas del día", dayActs: "Actividades del día", noActs: "Sin actividades este día.",
      scatterSub: (n, r) => `${n} días · correlación ${r}. Cada punto es un día; la línea muestra la tendencia.`,
      lagNote: "El eje vertical es del día siguiente.",
      progression: "Mejor a la fecha", eachEffort: "Cada esfuerzo",
      // data tab
      dataLead: "Toda la información descargada, ordenada en tablas. Los filtros de arriba (fechas, deportes y fuente) también se aplican aquí. Elige columnas y descarga lo que ves como CSV.",
      dataSets: { days: "Métricas diarias", activities: "Actividades", zones: "Tiempo en zonas", best: "Mejores esfuerzos (Strava)", splits: "Parciales por km (Strava)", segments: "Segmentos (Strava)", laps: "Vueltas (Strava)", power: "Mejor potencia por duración", vo2: "VO₂ máx.", weight: "Peso", endurance: "Resistencia", gear: "Equipo (Strava)" },
      dataDesc: { days: "Una fila por día: actividad, pulso, estrés, energía, sueño, HRV y carga.", activities: "Una fila por actividad, con todo lo que entregan Garmin y Strava.", zones: "Minutos en cada zona por actividad y fuente.", best: "Cada mejor esfuerzo de carrera registrado por Strava.", splits: "Cada kilómetro de cada actividad con parciales.", segments: "Cada segmento de Strava recorrido.", laps: "Cada vuelta registrada.", power: "Mejor potencia media de cada actividad para 5 s … 60 min.", vo2: "Estimaciones de VO₂ máx. de Garmin.", weight: "Pesajes registrados en Garmin.", endurance: "Puntuación semanal de resistencia de Garmin.", gear: "Bicicletas y zapatillas de Strava." },
      dictTitle: "Diccionario de datos", dictSub: "Qué significa cada columna y en qué unidad está.",
      rows: "filas",
      // strava
      stravaConnectTitle: "Conecta Strava",
      stravaConnectBody: "Suma lo que solo Strava tiene: tus zonas de pulso y potencia, mejores tiempos en cada distancia, parciales por kilómetro, segmentos, esfuerzo relativo, kudos y el kilometraje de tu equipo. Las actividades que subiste desde otros dispositivos también aparecen.",
      stravaSteps: ["Abre strava.com/settings/api y crea una aplicación (cualquier nombre y sitio web). En «Authorization Callback Domain» escribe localhost.", "Copia aquí el Client ID y el Client Secret de esa aplicación.", "Autoriza a Pulso en Strava. Vuelves aquí y empieza la descarga."],
      clientId: "Client ID", clientSecret: "Client Secret", connect: "Conectar", notNow: "Ahora no", openStrava: "Abrir Strava",
      stravaCli: "Para conectar Strava, ejecuta en una terminal:", stravaConnected: "Strava conectado. Descargando tus datos…",
      stravaStatus: "Strava", stravaSummary: (n, d) => `${n} actividades descargadas, ${d} con todo el detalle.`,
      stravaPending: (n) => `Quedan ${n} actividades por completar; Strava limita las descargas, así que siguen en la próxima sincronización.`,
      disconnect: "Desconectar Strava", disconnected: "Strava desconectado.", ftp: "FTP", hrZonesLabel: "Zonas de pulso", powerZonesLabel: "Zonas de potencia",
      totals: { ride: "Ciclismo (total Strava)", run: "Running (total Strava)", swim: "Natación (total Strava)" },
    },
    en: {
      tabs: { overview: "Summary", training: "Training", health: "Recovery & sleep", history: "Year by year", activities: "Activities", data: "Data" },
      period: "Period", sportsLabel: "Sports", sourceLabel: "Source", resetFilters: "Clear filters",
      presets: { "30": "Last 30 days", "90": "Last 90 days", "365": "Last 12 months", ytd: "This year", all: "All history", custom: "Custom" },
      srcAll: "All", srcGarmin: "Garmin", srcStrava: "Strava",
      srcNames: { garmin: "Garmin", strava: "Strava", both: "Garmin + Strava" },
      sync: "Sync", syncing: "Syncing…", synced: "Data updated", lastSync: "Synced",
      acts: "activities", yearsOfData: "years of data", weekOf: "Week of", latest: "Latest", same: "same", by: "By",
      hlScope: { "365": "In the last 12 months", days: (n) => `In the last ${n} days`, current: (y) => `So far in ${y}`, year: (y) => `In ${y}`, all: (y) => `Since ${y}`, custom: (a, b) => `Between ${a} and ${b}` },
      hlBody: (h, n, km) => `you trained <b>${h} hours</b> across <b>${n} activities</b>${km ? ` and covered <b>${km} km</b>` : ""}`,
      hlDelta: (pct, more, prev) => `, <b>${pct}% ${more ? "more" : "less"}</b> than ${prev}.`,
      prevLabel: { generic: "the previous period", year: (y) => `in ${y}`, current: (y) => `the same stretch of ${y}` },
      vsPrev: { generic: "vs previous period", year: (y) => `vs ${y}` },
      kpi: { hours: "Training hours", acts: "Activities", km: "Distance", elev: "Elevation gain" },
      nowTitle: "How are you doing lately?",
      nowSub: (d) => `Average of the 7 days up to ${d}, compared with your previous 8 weeks.`,
      normalRange: "Normal for you", better: "Better than usual", worse: "Worse than usual", usual: "Normal",
      nowAllGood: "Everything is within your normal range or better. You are recovering well.",
      nowOneBad: (n) => `Almost everything is normal; only ${n} is worse than usual.`,
      nowManyBad: (k) => `${k} signals are worse than usual. It may be a good moment to ease off.`,
      nowNoData: "No data for the last few days. Sync your watch with Garmin Connect.",
      weeklyTitle: "Your training week by week", weeklySub: "Training hours per week, split by sport. Tap a bar to see those activities.",
      weeklySubLong: "Training hours per month, split by sport. Tap a bar to see those activities.",
      findingsTitle: "What your data says",
      findingsSub: "Patterns that repeat in your own history, computed for the chosen period. They show what tends to happen together, not cause and effect. Tap one to see every day behind it.",
      noFindings: "Not enough days with data in this period to find reliable patterns yet.",
      clear: "Clear pattern", moderate: "Moderate pattern", basedOn: (n) => `Based on ${n} days`,
      up: "goes up", down: "goes down",
      bySportTitle: "By sport", bySportSub: "How much you trained in each sport in this period.",
      monthlyTitle: "Month by month", monthlySub: "Training hours per month, split by sport.",
      formTitle: "Fitness and fatigue",
      formSub: "Fitness rises when you train consistently for weeks. Fatigue reflects the last 7 days. When fatigue sits far above fitness, it is time to rest.",
      fitness: "Fitness", fatigue: "Fatigue",
      zonesTitle: "How hard do you train?",
      zonesSub: { garmin: "Total time in each heart-rate zone, according to Garmin.", stravaHr: "Time in the heart-rate zones you set on Strava.", stravaPwr: "Time in your Strava power zones (from your FTP)." },
      zoneSrc: { garmin: "Garmin", stravaHr: "Strava · HR", stravaPwr: "Strava · power" },
      zones: [["Zone 1", "Very easy"], ["Zone 2", "Easy · aerobic base"], ["Zone 3", "Moderate"], ["Zone 4", "Hard · threshold"], ["Zone 5", "Maximum"]],
      powerZones: ["Recovery", "Endurance", "Tempo", "Threshold", "VO₂ max", "Anaerobic", "Neuromuscular"],
      calendarTitle: "Training days", calendarSub: "Each square is a day; darker means more minutes trained. Tap a day to see all of it.",
      calLegend: ["Rest", "< 45 min", "45–90 min", "90–150 min", "> 150 min"],
      recordsTitle: "Your best marks in this period",
      rec: { km: "Longest distance", min: "Longest session", elev: "Most climbing", p1200: "Best 20-min power", p300: "Best 5-min power", run: "Longest run", load: "Toughest session", hrMax: "Highest heart rate", relEffort: "Highest relative effort" },
      bestTitle: "Best running times", bestSub: "Your best effort at each distance according to Strava, in this period. Tap a distance to see your progress.",
      gearTitle: "Your gear", gearSub: "Bikes and shoes on Strava: total kilometres and in this period.",
      shareOfTime: "% of time",
      healthLead: "Each card shows the period average, the change from the previous period and the trend. Tap a card to see every day.",
      sleepTitle: "How you sleep", sleepSub: "Average hours in each sleep stage per night.",
      bed: "Bedtime", wake: "Wake time", regularity: "Bedtime regularity", nights7: "Nights of 7 h or more",
      regularityHint: "typical night-to-night variation",
      stages: { deepH: "Deep", remH: "REM", lightH: "Light", awakeH: "Awake" },
      vo2: (s) => `VO₂ max (${s})`, vo2What: "Your aerobic capacity as estimated by Garmin. Higher is better.",
      weight: "Weight", weightWhat: "Weight measurements logged in Garmin.",
      endurance: "Endurance score", enduranceWhat: "Garmin's weekly estimate of your endurance.",
      cumTitle: "Year against year", cumSub: "Running total since 1 January. Each line is a year, so you can see whether you are ahead or behind.",
      cumMetrics: { hours: "Hours", km: "Distance", elev: "Elevation", acts: "Activities" },
      otherYears: "Other years", inProgress: "in progress",
      yearTitle: "Year summary", yearSub: "Bold marks the best year in each column. Tap a year to see its activities.",
      search: "Search by name, place or gear…", allSports: "All",
      date: "Date", activity: "Activity", duration: "Duration", distance: "Distance", elevation: "Elevation", avgHr: "Avg HR", power: "Power", load: "Load",
      year: "Year", hours: "Hours", count: "Activities", sport: "Sport", value: "Value", time: "Time", pace: "Pace", kmPeriod: "Km in period", kmTotal: "Total km",
      prev: "Previous", next: "Next", of: "of",
      sports: { cycling: "Cycling", running: "Running", swimming: "Swimming", walking: "Walking", gym: "Gym", other: "Other" },
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      noData: "No data for this period.",
      privacy: "Your data is stored only on this computer.", syncWarnings: "sync warnings",
      welcomeTitle: "Setting up Pulso", welcomeBody: "Downloading your full history. The first time takes a few minutes; after that only new data is fetched and it opens instantly.",
      preparing: "Preparing…", downloading: "Downloading", upToDate: "Up to date", syncFailed: "Sync failed",
      authHint: "Sign in to Garmin from a terminal with: garmin-connect-mcp auth", showingCached: "Showing saved data.", refreshing: "New data, refreshing…",
      sources: { daily_summaries: "Daily summary", sleep: "Sleep", hrv: "HRV", readiness: "Training readiness", training_status: "Training status", max_metrics: "VO₂ max", endurance: "Endurance", body_composition: "Weight", activities: "Activities", strava: "Strava" },
      panel: { metric: "Daily metric", acts: "Activities", activity: "Activity", field: "Activity field", day: "Day", series: "Series", finding: "Pattern", best: "Best effort", zone: "Zone", gear: "Gear" },
      gran: { day: "Day", week: "Week", month: "Month" }, scopeFiltered: "Chosen period", scopeAll: "All history",
      stat: { avg: "Average", min: "Lowest", max: "Highest", last: "Latest", n: "Days with data", total: "Total", nActs: "Activities", best: "Best" },
      usedData: "Data used", downloadCsv: "Download CSV", columns: "Columns",
      measure: { hours: "Hours", km: "Distance", elev: "Elevation", acts: "Activities", load: "Load", relEffort: "Relative effort" },
      allOfSport: (s) => `See every ${s.toLowerCase()} activity`,
      fields: "All data", fieldsHint: "Tap a value to see how it has varied across your activities.",
      hrZonesG: "Heart-rate zones (Garmin)", hrZonesS: "Heart-rate zones (Strava)", pwrZonesS: "Power zones (Strava)",
      powerCurve: "Power curve", powerCurveSub: "Best average power for each duration in this activity, against your best in the period.",
      thisActivity: "This activity", bestInPeriod: "Your best in the period",
      splits: "Splits per kilometre", segments: "Segments", laps: "Laps", bestEfforts: "Best efforts", description: "Description",
      prRank: (n) => (n === 1 ? "🥇 PR" : n === 2 ? "🥈 2nd best" : n === 3 ? "🥉 3rd best" : ""),
      dayMetrics: "Metrics of the day", dayActs: "Activities that day", noActs: "No activities this day.",
      scatterSub: (n, r) => `${n} days · correlation ${r}. Each dot is a day; the line shows the trend.`,
      lagNote: "The vertical axis is the next day.",
      progression: "Best to date", eachEffort: "Each effort",
      dataLead: "Everything that was downloaded, in tidy tables. The filters above (dates, sports and source) apply here too. Pick columns and download what you see as CSV.",
      dataSets: { days: "Daily metrics", activities: "Activities", zones: "Time in zones", best: "Best efforts (Strava)", splits: "Splits per km (Strava)", segments: "Segments (Strava)", laps: "Laps (Strava)", power: "Best power by duration", vo2: "VO₂ max", weight: "Weight", endurance: "Endurance", gear: "Gear (Strava)" },
      dataDesc: { days: "One row per day: activity, heart rate, stress, energy, sleep, HRV and load.", activities: "One row per activity, with everything Garmin and Strava provide.", zones: "Minutes in each zone per activity and source.", best: "Every running best effort recorded by Strava.", splits: "Every kilometre of every activity with splits.", segments: "Every Strava segment ridden or run.", laps: "Every recorded lap.", power: "Best average power of each activity for 5 s … 60 min.", vo2: "Garmin VO₂ max estimates.", weight: "Weigh-ins logged in Garmin.", endurance: "Garmin weekly endurance score.", gear: "Bikes and shoes from Strava." },
      dictTitle: "Data dictionary", dictSub: "What each column means and its unit.",
      rows: "rows",
      stravaConnectTitle: "Connect Strava",
      stravaConnectBody: "Add what only Strava has: your heart-rate and power zones, best times at each distance, per-kilometre splits, segments, relative effort, kudos and gear mileage. Activities uploaded from other devices show up too.",
      stravaSteps: ["Open strava.com/settings/api and create an application (any name and website). Set “Authorization Callback Domain” to localhost.", "Paste that application's Client ID and Client Secret here.", "Authorize Pulso on Strava. You come back here and the download starts."],
      clientId: "Client ID", clientSecret: "Client Secret", connect: "Connect", notNow: "Not now", openStrava: "Open Strava",
      stravaCli: "To connect Strava, run in a terminal:", stravaConnected: "Strava connected. Downloading your data…",
      stravaStatus: "Strava", stravaSummary: (n, d) => `${n} activities downloaded, ${d} in full detail.`,
      stravaPending: (n) => `${n} activities still need their details; Strava limits downloads, so they continue on the next sync.`,
      disconnect: "Disconnect Strava", disconnected: "Strava disconnected.", ftp: "FTP", hrZonesLabel: "Heart-rate zones", powerZonesLabel: "Power zones",
      totals: { ride: "Cycling (Strava total)", run: "Running (Strava total)", swim: "Swimming (Strava total)" },
    },
  };

  /**
   * Every field in the dataset: [label es, label en, unit, decimals, direction, what es, what en, aggregate].
   * unit: "@clock" hour of day, "@dur" minutes shown as h/min, "@sec" seconds as time, "a|b" es|en.
   * direction: +1 higher is better, -1 lower is better, 0 neither. aggregate: "sum" adds up per week/month.
   */
  const F = {
    date: ["Fecha", "Date", "", 0, 0],
    // daily
    steps: ["Pasos", "Steps", "", 0, 1, "Pasos por día.", "Steps per day."],
    stepGoal: ["Meta de pasos", "Step goal", "", 0, 0],
    floors: ["Pisos subidos", "Floors climbed", "", 0, 1],
    kcal: ["Calorías totales", "Total calories", "kcal", 0, 0],
    kcalActive: ["Calorías activas", "Active calories", "kcal", 0, 1],
    imMod: ["Intensidad moderada", "Moderate intensity", "min", 0, 1, "Minutos de actividad moderada.", "Minutes of moderate activity.", "sum"],
    imVig: ["Intensidad vigorosa", "Vigorous intensity", "min", 0, 1, "Minutos de actividad vigorosa.", "Minutes of vigorous activity.", "sum"],
    rhr: ["Pulso en reposo", "Resting heart rate", "lpm|bpm", 0, -1, "Tus latidos por minuto en calma. Más bajo suele indicar mejor forma y descanso.", "Beats per minute at rest. Lower usually means better fitness and rest."],
    hrMin: ["Pulso mínimo", "Lowest heart rate", "lpm|bpm", 0, 0],
    hrMax: ["Pulso máximo", "Highest heart rate", "lpm|bpm", 0, 0],
    stress: ["Estrés", "Stress", "/100", 0, -1, "Estrés promedio del día según tu pulso, de 0 a 100. Más bajo es mejor.", "Average daily stress from your heart rate, 0 to 100. Lower is better."],
    stressMax: ["Estrés máximo", "Peak stress", "/100", 0, -1],
    stressHighMin: ["Tiempo con estrés alto", "Time in high stress", "min", 0, -1],
    stressRestMin: ["Tiempo en reposo", "Time at rest", "min", 0, 1],
    bbMax: ["Energía al despertar", "Morning energy", "/100", 0, 1, "Body Battery más alto del día: tu energía disponible, de 0 a 100.", "Highest Body Battery of the day: your energy reserve, 0 to 100."],
    bbMin: ["Energía más baja", "Lowest energy", "/100", 0, 1, "Body Battery más bajo del día.", "Lowest Body Battery of the day."],
    bbCharged: ["Energía recargada", "Energy recharged", "", 0, 1],
    bbDrained: ["Energía gastada", "Energy drained", "", 0, 0],
    resp: ["Respiración", "Breathing rate", "rpm|brpm", 1, 0, "Respiraciones por minuto en promedio.", "Average breaths per minute."],
    spo2: ["Oxígeno en sangre", "Pulse ox", "%", 0, 1],
    sleepScore: ["Calidad del sueño", "Sleep score", "/100", 0, 1, "Nota de Garmin para cada noche, de 0 a 100.", "Garmin's score for each night, 0 to 100."],
    sleepH: ["Horas de sueño", "Sleep", "h", 1, 1, "Tiempo dormido por noche.", "Time asleep per night."],
    deepH: ["Sueño profundo", "Deep sleep", "h", 1, 1],
    remH: ["Sueño REM", "REM sleep", "h", 1, 1],
    lightH: ["Sueño ligero", "Light sleep", "h", 1, 0],
    awakeH: ["Despierto en la noche", "Awake at night", "h", 1, -1],
    sleepNeedH: ["Sueño necesario", "Sleep need", "h", 1, 0],
    bedtime: ["Hora de acostarte", "Bedtime", "@clock", 0, 0, "Hora en que te dormiste.", "When you fell asleep."],
    wake: ["Hora de despertar", "Wake time", "@clock", 0, 0],
    skinTemp: ["Temperatura de la piel", "Skin temperature", "°C", 1, 0, "Diferencia respecto a tu temperatura habitual.", "Difference from your usual temperature."],
    bbSleep: ["Energía ganada durmiendo", "Energy gained asleep", "", 0, 1],
    hrv: ["HRV nocturna", "Overnight HRV", "ms", 0, 1, "Variación entre latidos mientras duermes. Más alta suele indicar mejor recuperación.", "Beat-to-beat variation while you sleep. Higher usually means better recovery."],
    hrvWeek: ["HRV 7 días", "7-day HRV", "ms", 0, 1],
    hrvLow: ["HRV normal (desde)", "Normal HRV (from)", "ms", 0, 0],
    hrvHigh: ["HRV normal (hasta)", "Normal HRV (to)", "ms", 0, 0],
    readiness: ["Disposición para entrenar", "Training readiness", "/100", 0, 1, "Qué tan preparado está tu cuerpo para un entrenamiento fuerte, de 0 a 100.", "How ready your body is for a hard workout, 0 to 100."],
    recoveryH: ["Tiempo de recuperación", "Recovery time", "h", 0, -1],
    acute: ["Carga aguda", "Acute load", "", 0, 0, "Carga de Garmin de los últimos 7 días.", "Garmin load over the last 7 days."],
    chronic: ["Carga crónica", "Chronic load", "", 0, 0, "Carga de Garmin de las últimas 4 semanas.", "Garmin load over the last 4 weeks."],
    acwr: ["Relación aguda:crónica", "Acute:chronic ratio", "", 2, 0],
    tStatus: ["Estado de entrenamiento (código)", "Training status (code)", "", 0, 0],
    actN: ["Actividades del día", "Activities that day", "", 0, 0, "", "", "sum"],
    actMin: ["Tiempo entrenado", "Time trained", "@dur", 0, 0, "Minutos de actividad registrados.", "Minutes of recorded activity.", "sum"],
    actKm: ["Distancia del día", "Distance that day", "km", 1, 0, "", "", "sum"],
    actElev: ["Desnivel del día", "Elevation that day", "m", 0, 0, "", "", "sum"],
    actLoad: ["Carga de entrenamiento", "Training load", "", 0, 0, "Suma de la carga de Garmin de tus actividades.", "Sum of the Garmin load of your activities.", "sum"],
    lastEnd: ["Hora en que terminaste de entrenar", "Last workout ended", "@clock", 0, 0],
    atl: ["Fatiga", "Fatigue", "", 0, 0, "Promedio ponderado de tu carga de los últimos 7 días.", "Weighted average of your load over the last 7 days."],
    ctl: ["Forma física", "Fitness", "", 0, 1, "Promedio ponderado de tu carga de las últimas 6 semanas.", "Weighted average of your load over the last 6 weeks."],
    tsb: ["Frescura", "Freshness", "", 0, 0, "Forma física menos fatiga. Negativa: estás cargado.", "Fitness minus fatigue. Negative: you are loaded."],
    relEffort: ["Esfuerzo relativo", "Relative effort", "", 0, 0, "Puntaje de Strava según el tiempo en cada zona de pulso.", "Strava's score from time in each heart-rate zone.", "sum"],
    // activities
    id: ["ID Garmin", "Garmin ID", "", 0, 0], start: ["Inicio", "Start", "", 0, 0], type: ["Tipo (Garmin)", "Type (Garmin)", "", 0, 0],
    sport: ["Deporte", "Sport", "", 0, 0], name: ["Nombre", "Name", "", 0, 0], place: ["Lugar", "Place", "", 0, 0],
    km: ["Distancia", "Distance", "km", 2, 1], min: ["Duración", "Duration", "@dur", 0, 0], movMin: ["Tiempo en movimiento", "Moving time", "@dur", 0, 0],
    elev: ["Desnivel", "Elevation gain", "m", 0, 1], kmh: ["Velocidad media", "Average speed", "km/h", 1, 1],
    hr: ["Pulso medio", "Average heart rate", "lpm|bpm", 0, 0], kcal_a: ["Calorías", "Calories", "kcal", 0, 0],
    watts: ["Potencia media", "Average power", "W", 0, 1], np: ["Potencia normalizada", "Normalised power", "W", 0, 1], wMax: ["Potencia máxima", "Max power", "W", 0, 1],
    tss: ["TSS", "TSS", "", 0, 0], if: ["Factor de intensidad", "Intensity factor", "", 2, 0],
    te: ["Efecto aeróbico", "Aerobic effect", "", 1, 0], ta: ["Efecto anaeróbico", "Anaerobic effect", "", 1, 0],
    load: ["Carga de entrenamiento", "Training load", "", 0, 0], label: ["Efecto principal", "Main effect", "", 0, 0],
    cad: ["Cadencia", "Cadence", "rpm|spm", 0, 0], vo2: ["VO₂ máx. estimado", "VO₂ max estimate", "", 0, 1], bb: ["Impacto en energía", "Body Battery impact", "", 0, 0],
    tMin: ["Temperatura mínima", "Min temperature", "°C", 0, 0], tMax: ["Temperatura máxima", "Max temperature", "°C", 0, 0],
    pr: ["Récord personal (Garmin)", "Personal record (Garmin)", "", 0, 0], end: ["Hora de término", "End time", "@clock", 0, 0],
    src: ["Fuente", "Source", "", 0, 0], sid: ["ID Strava", "Strava ID", "", 0, 0], sportType: ["Tipo (Strava)", "Type (Strava)", "", 0, 0],
    kudos: ["Kudos", "Kudos", "", 0, 1], achievements: ["Logros", "Achievements", "", 0, 1], prCount: ["Récords (Strava)", "PRs (Strava)", "", 0, 1], comments: ["Comentarios", "Comments", "", 0, 0],
    kj: ["Trabajo", "Work", "kJ", 0, 0], wAvgW: ["Potencia ponderada (Strava)", "Weighted power (Strava)", "W", 0, 1], maxKmh: ["Velocidad máxima", "Max speed", "km/h", 1, 1],
    elevHigh: ["Altitud máxima", "Highest point", "m", 0, 0], elevLow: ["Altitud mínima", "Lowest point", "m", 0, 0],
    gear: ["Equipo", "Gear", "", 0, 0], gearId: ["ID de equipo", "Gear ID", "", 0, 0], device: ["Dispositivo", "Device", "", 0, 0],
    rpe: ["Esfuerzo percibido", "Perceived exertion", "/10", 0, 0], desc: ["Descripción", "Description", "", 0, 0],
    commute: ["Traslado", "Commute", "", 0, 0], trainer: ["Rodillo o cinta", "Indoor trainer", "", 0, 0],
    // nested tables
    activity: ["Actividad", "Activity", "", 0, 0], effort: ["Distancia", "Distance", "", 0, 0], time: ["Tiempo", "Time", "@sec", 0, -1],
    pace: ["Ritmo", "Pace", "@pace", 0, -1], prRank: ["Récord", "PR rank", "", 0, 0], komRank: ["Posición KOM", "KOM rank", "", 0, 0],
    split: ["Km", "Km", "", 0, 0], segment: ["Segmento", "Segment", "", 0, 0], grade: ["Pendiente", "Grade", "%", 1, 0], lap: ["Vuelta", "Lap", "", 0, 0],
    zoneSrc: ["Zonas de", "Zones from", "", 0, 0], seconds: ["Duración del esfuerzo", "Effort duration", "@sec", 0, 0],
    value: ["Valor", "Value", "", 1, 0], kg: ["Peso", "Weight", "kg", 1, 0], fat: ["Grasa corporal", "Body fat", "%", 1, 0], bmi: ["IMC", "BMI", "", 1, 0],
    kind: ["Tipo", "Kind", "", 0, 0], kmTotal: ["Km totales (Strava)", "Total km (Strava)", "km", 0, 0], kmPeriod: ["Km en el período", "Km in period", "km", 0, 0],
    nActs: ["Actividades en el período", "Activities in period", "", 0, 0], primary: ["Principal", "Primary", "", 0, 0], retired: ["Retirado", "Retired", "", 0, 0],
  };
  for (let i = 1; i <= 7; i++) F[`z${i}`] = [`Zona ${i}`, `Zone ${i}`, "min", 1, 0];
  /** Activity "kcal" shares the daily key but means calories of the activity. */
  const fieldKey = (k, inActivity) => (inActivity && k === "kcal" ? "kcal_a" : k);

  const SPORTS = ["cycling", "running", "swimming", "walking", "gym", "other"];
  const SPORT_VAR = { cycling: "--s1", running: "--s2", swimming: "--s3", walking: "--s4", gym: "--s5", other: "--s6" };
  const SOURCE_ORDER = ["daily_summaries", "sleep", "hrv", "readiness", "training_status", "max_metrics", "endurance", "body_composition", "activities", ...(STRAVA || LIVE ? ["strava"] : [])];
  const BEST_ORDER = ["400m", "1/2 mile", "1k", "1 mile", "2 mile", "5k", "10k", "15k", "10 mile", "20k", "Half-Marathon", "30k", "Marathon"];
  const BEST_METERS = { "400m": 400, "1/2 mile": 805, "1k": 1000, "1 mile": 1609, "2 mile": 3219, "5k": 5000, "10k": 10000, "15k": 15000, "10 mile": 16093, "20k": 20000, "Half-Marathon": 21097, "30k": 30000, Marathon: 42195 };
  const POWER_SECS = ["5", "10", "30", "60", "120", "300", "600", "1200", "1800", "3600"];

  // ---------------------------------------------------------------- state
  const store = {
    get(k, d) { try { return localStorage.getItem("gd." + k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gd." + k, v); } catch { /* storage unavailable */ } },
  };
  const TABS = ["overview", "training", "health", "history", "activities", "data"];
  const initialTab = (location.hash || "").slice(1) || store.get("tab", "overview");
  const state = {
    // ?lang=en|es wins (handy for links and screenshots), then the saved choice, then the browser.
    lang: new URLSearchParams(location.search).get("lang") || store.get("lang", (navigator.language || "es").startsWith("es") ? "es" : "en"),
    theme: store.get("theme", "auto"),
    preset: store.get("preset", store.get("scope", "365")),
    from: store.get("from", ""), to: store.get("to", ""),
    sports: new Set(store.get("sports", "").split(",").filter((s) => SPORTS.includes(s))),
    src: store.get("src", "all"),
    tab: TABS.includes(initialTab) ? initialTab : "overview",
    cumMetric: "hours",
    zoneSrc: store.get("zoneSrc", "garmin"),
    dataSet: store.get("dataSet", "activities"),
  };
  const t = () => I18N[state.lang];
  const es = () => state.lang === "es";
  const fdef = (k) => F[k] || [k, k, "", 1, 0];
  const label = (k) => fdef(k)[es() ? 0 : 1];
  const what = (k) => fdef(k)[es() ? 5 : 6] || "";
  const unit = (k) => {
    const u = fdef(k)[2] || "";
    return u.includes("|") ? u.split("|")[es() ? 0 : 1] : u;
  };
  const digits = (k) => fdef(k)[3];
  const direction = (k) => fdef(k)[4] || 0;
  const aggOf = (k) => fdef(k)[7] || "avg";
  /** Unit shown next to a value: "/100" scores and formatted kinds read better bare. */
  const shownUnit = (k) => { const u = unit(k); return u === "/100" || u.startsWith("@") ? "" : u; };

  // ---------------------------------------------------------------- data
  const cols = RAW.days || { date: [] };
  const DAYS = (cols.date || []).map((date, i) => {
    const row = { date };
    for (const k of Object.keys(cols)) if (k !== "date") row[k] = cols[k][i];
    return row;
  });
  const DIDX = new Map(DAYS.map((d, i) => [d.date, i]));
  const HAS_DATA = DAYS.length > 0 || (RAW.activities || []).length > 0;
  const ACTS = (RAW.activities || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  const ACT_BY_ID = new Map(ACTS.map((a) => [String(a.id), a]));
  const YEARS = (RAW.years || []).slice().sort();
  const FIRST = [DAYS[0] && DAYS[0].date, ACTS[0] && ACTS[0].date].filter(Boolean).sort()[0] || TODAY;
  const HAS_SRC = ACTS.some((a) => a.src);
  const PRESETS = () => ["30", "90", "365", "ytd", ...YEARS.slice().reverse(), "all", "custom"];
  if (!PRESETS().includes(state.preset)) state.preset = "365";

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
  const dur = (min) => {
    if (min == null) return "–";
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
  };
  const secs = (s) => {
    if (s == null) return "–";
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
  };
  const paceOf = (secondsPerKm) => (secondsPerKm ? `${secs(secondsPerKm)} /km` : "–");
  /** Any field, formatted for reading, with its unit. */
  function fv(k, v) {
    if (v == null || v === "" || (typeof v === "number" && Number.isNaN(v))) return "–";
    if (typeof v === "boolean") return v ? "✓" : "–";
    if (k === "sport") return t().sports[v] || v;
    if (k === "src") return t().srcNames[v] || v;
    if (k === "kind") return v === "bike" ? "🚲" : "👟";
    if (k === "prRank") return t().prRank(v) || String(v);
    if (typeof v !== "number") return String(v);
    const u = unit(k);
    if (u === "@clock") return clock(v);
    if (u === "@dur") return dur(v);
    if (u === "@sec") return secs(v);
    if (u === "@pace") return paceOf(v);
    const shown = shownUnit(k);
    return `${nf(v, digits(k))}${shown ? (shown === "%" ? " %" : " " + shown) : ""}`;
  }
  const fmt = (k, v) => (unit(k).startsWith("@") ? fv(k, v) : nf(v, digits(k)));
  const withUnit = fv;
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
  const monthEnd = (k) => {
    const y = +k.slice(0, 4), m = +k.slice(5, 7);
    return addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
  };
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
  /** Attributes that make an element open the side panel with ``spec``. */
  const op = (spec) => ` data-open="${esc(JSON.stringify(spec))}" tabindex="0" role="button"`;

  // ---------------------------------------------------------------- filters
  function presetRange(p = state.preset) {
    if (p === "all") return [FIRST, TODAY];
    if (p === "365") return [addDays(TODAY, -364), TODAY];
    if (p === "30" || p === "90") return [addDays(TODAY, -(+p - 1)), TODAY];
    if (p === "ytd") return [`${TODAY.slice(0, 4)}-01-01`, TODAY];
    if (/^\d{4}$/.test(p)) return [`${p}-01-01`, `${p}-12-31` < TODAY ? `${p}-12-31` : TODAY];
    const a = state.from || addDays(TODAY, -364), b = state.to || TODAY;
    return a <= b ? [a, b] : [b, a];
  }
  const R = () => presetRange();
  const isYear = (p = state.preset) => /^\d{4}$/.test(p) || p === "ytd";
  const yearOf = (p = state.preset) => (p === "ytd" ? TODAY.slice(0, 4) : p);
  function prevRange() {
    if (state.preset === "all") return null;
    const [a, b] = R();
    if (isYear()) { const y = +yearOf() - 1; return [`${y}${a.slice(4)}`, `${y}${b.slice(4)}`]; }
    const len = daysBetween(a, b) + 1;
    return [addDays(a, -len), addDays(a, -1)];
  }
  const isCurrentYear = (s) => s === TODAY.slice(0, 4);
  const vsPrevText = () => (state.preset === "all" ? "" : isYear() ? t().vsPrev.year(+yearOf() - 1) : t().vsPrev.generic);
  const inR = (d, r) => d >= r[0] && d <= r[1];
  const daysIn = (r) => DAYS.filter((d) => inR(d.date, r));
  const srcOk = (a) => state.src === "all" || (state.src === "garmin" ? a.src !== "strava" : a.src === "strava" || a.src === "both");
  const sportOk = (a) => !state.sports.size || state.sports.has(a.sport);
  /** Activities in a range that pass the sport and source filters. */
  const actsIn = (r) => ACTS.filter((a) => inR(a.date, r) && sportOk(a) && srcOk(a));
  const filtersActive = () => state.sports.size > 0 || state.src !== "all";

  const DAILY = { key: (d) => d, label: dayLabel, title: dayYearLabel, end: (k) => k };
  const WEEKLY = { key: weekStart, label: dayLabel, title: (k) => `${t().weekOf} ${dayYearLabel(k)}`, end: (k) => addDays(k, 6) };
  const MONTHLY = { key: monthKey, label: monthLabel, title: monthLabel, end: (k) => monthEnd(k) };
  const GRAN = { day: DAILY, week: WEEKLY, month: MONTHLY };
  /** Weekly buckets for up to ~14 months, monthly beyond. */
  const bucketFor = (r) => (daysBetween(r[0], r[1]) > 430 ? MONTHLY : WEEKLY);
  const autoGran = (r) => (daysBetween(r[0], r[1]) <= 120 ? "day" : daysBetween(r[0], r[1]) <= 430 ? "week" : "month");
  function bucketKeys(r, key) {
    const keys = new Set();
    for (let d = r[0]; d <= r[1]; d = addDays(d, 1)) keys.add(key(d));
    return [...keys].sort();
  }

  // ---------------------------------------------------------------- statistics (findings)
  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 3) return null;
    const mx = mean(xs), my = mean(ys);
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }
  function erfc(x) { // Abramowitz & Stegun 7.1.26, x >= 0
    const k = 1 / (1 + 0.3275911 * x);
    return k * (0.254829592 + k * (-0.284496736 + k * (1.421413741 + k * (-1.453152027 + k * 1.061405429)))) * Math.exp(-x * x);
  }
  function pValue(r, n) { // same approximation as analytics.p_value
    if (n < 4 || Math.abs(r) >= 1) return Math.abs(r) >= 1 ? 0 : 1;
    const df = n - 2, tt = Math.abs(r) * Math.sqrt(df / (1 - r * r));
    const z = (tt * (1 - 1 / (4 * df))) / Math.sqrt(1 + (tt * tt) / (2 * df));
    return erfc(z / Math.SQRT2);
  }
  const quantile = (s, q) => { const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };
  function aligned(x, y, lag, r) {
    const out = [];
    for (const d of DAYS) {
      if (!inR(d.date, r) || d[x] == null) continue;
      const j = DIDX.get(lag ? addDays(d.date, lag) : d.date);
      if (j === undefined || DAYS[j][y] == null) continue;
      out.push({ date: d.date, ydate: DAYS[j].date, x: d[x], y: DAYS[j][y] });
    }
    return out;
  }
  function pairStats(x, y, lag, r) {
    const pts = aligned(x, y, lag, r);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), n = pts.length;
    const rr = pearson(xs, ys);
    if (rr == null || n < 20) return null;
    const s = xs.slice().sort((a, b) => a - b);
    const loCut = quantile(s, 0.25);
    let hiCut = quantile(s, 0.75), hi;
    const lo = pts.filter((p) => p.x <= loCut).map((p) => p.y);
    if (hiCut <= loCut) { // zero-inflated x (training load): "above the low group"
      const above = xs.filter((v) => v > loCut);
      hiCut = above.length ? Math.min(...above) : hiCut;
      hi = pts.filter((p) => p.x > loCut).map((p) => p.y);
    } else hi = pts.filter((p) => p.x >= hiCut).map((p) => p.y);
    const mx = mean(xs), my = mean(ys);
    const slope = sum(pts.map((p) => (p.x - mx) * (p.y - my))) / sum(xs.map((v) => (v - mx) ** 2));
    return { x, y, lag, r: rr, n, p: pValue(rr, n), loMean: mean(lo), hiMean: mean(hi), loCut, hiCut, slope, intercept: my - slope * mx, pts };
  }
  const PAIRS = (RAW.correlations && RAW.correlations.pairs) || [];

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
  /** Draw a chart; ``onPick(datasetIndex, index)`` makes its marks clickable. */
  function chart(id, config, onPick) {
    const el = $(id);
    if (!el || typeof Chart === "undefined") return;
    clearEmpty(id);
    if (charts[id]) charts[id].destroy();
    const options = deepMerge(baseOptions(), config.options || {});
    if (onPick) {
      options.onClick = (evt, _els, c) => {
        const hit = c.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true)[0] || c.getElementsAtEventForMode(evt, "index", { intersect: false }, true)[0];
        if (hit) onPick(hit.datasetIndex, hit.index);
      };
      options.onHover = (evt, els) => { evt.native.target.style.cursor = els.length ? "pointer" : "default"; };
    }
    charts[id] = new Chart(el, { ...config, options });
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
  const stackBar = (name, data, color, extra = {}) => ({
    type: "bar", label: name, data, backgroundColor: color, stack: "s", borderRadius: stackTop, borderSkipped: false,
    borderColor: css("--surface"), borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
    maxBarThickness: 24, categoryPercentage: 0.82, barPercentage: 0.92, ...extra,
  });
  const hoursScales = (bucket) => ({
    x: { stacked: true, ticks: { callback(v) { return bucket.label(this.getLabelForValue(v)); } } },
    y: { stacked: true, ticks: { callback: (v) => `${v} h` } },
  });

  /** Stacked hours by sport per bucket (week or month); a bar opens its activities. */
  function sportBars(id, legendId, acts, r, bucket = bucketFor(r)) {
    if (!acts.length) { $(legendId).innerHTML = ""; return emptyChart(id); }
    const keys = bucketKeys(r, bucket.key);
    const present = SPORTS.filter((s) => acts.some((a) => a.sport === s));
    const datasets = present.map((s) => {
      const per = new Map();
      for (const a of acts) if (a.sport === s) per.set(bucket.key(a.date), (per.get(bucket.key(a.date)) || 0) + (a.min || 0) / 60);
      return stackBar(t().sports[s], keys.map((k) => +(per.get(k) || 0).toFixed(2)), sportColor(s), { sport: s });
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
    }, (di, i) => {
      const k = keys[i], s = datasets[di] && datasets[di].sport;
      openPanel({ kind: "acts", from: k < r[0] ? r[0] : k, to: bucket.end(k) > r[1] ? r[1] : bucket.end(k), sport: s, title: t().sports[s] || "", bucket: bucket.title(k) }, false);
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
  function deltaHtml(value, dg, unitText, dir, mode = "abs") {
    if (value == null || !Number.isFinite(value)) return '<div class="delta">&nbsp;</div>';
    const tiny = mode === "pct" ? Math.abs(value) < 1 : Math.abs(value) < Math.pow(10, -dg) / 2;
    const arrow = tiny ? "=" : value > 0 ? "▲" : "▼";
    const cls = tiny || !dir ? "" : (value > 0) === (dir > 0) ? "good" : "bad";
    const text = tiny ? t().same : `${nf(Math.abs(value), mode === "pct" ? 0 : dg)}${mode === "pct" ? " %" : unitText ? " " + unitText : ""}`;
    return `<div class="delta"><span class="${cls}">${arrow} ${text}</span> ${esc(vsPrevText())}</div>`;
  }

  // ---------------------------------------------------------------- tables
  // A table keeps its own sort and page; rows open the panel through ``onRow``.
  const TABLES = {};
  function dataTable(el, id, rows, columns, opts = {}) {
    const prev = TABLES[id];
    TABLES[id] = {
      el, rows, columns, onRow: opts.onRow, pageSize: opts.pageSize || 25, page: 0,
      sort: prev && opts.keepSort !== false ? prev.sort : opts.sort || null,
    };
    drawTable(id);
  }
  const cellValue = (c, row) => (c.v ? c.v(row) : row[c.k]);
  function drawTable(id) {
    const tb = TABLES[id], tx = t();
    if (!tb.rows.length) { tb.el.innerHTML = `<div class="empty">${esc(tx.noData)}</div>`; return; }
    let rows = tb.rows;
    if (tb.sort) {
      const c = tb.columns.find((x) => x.k === tb.sort[0]);
      if (c) {
        const dir = tb.sort[1];
        rows = rows.slice().sort((a, b) => {
          const va = cellValue(c, a), vb = cellValue(c, b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
        });
      }
    }
    tb.sorted = rows;
    const pages = Math.max(1, Math.ceil(rows.length / tb.pageSize));
    tb.page = Math.min(tb.page, pages - 1);
    const start = tb.page * tb.pageSize;
    const page = rows.slice(start, start + tb.pageSize);
    const arrow = (k) => (tb.sort && tb.sort[0] === k ? (tb.sort[1] > 0 ? " ▲" : " ▼") : "");
    tb.el.innerHTML = `<table><thead><tr>${tb.columns.map((c) => `<th class="sortable ${c.cls || ""}" data-tsort="${id}|${esc(c.k)}" title="${esc(what(c.k))}">${esc(c.label || label(c.k))}${arrow(c.k)}</th>`).join("")}</tr></thead>
      <tbody>${page.map((row, i) => `<tr${tb.onRow ? ` class="clickable" data-trow="${id}|${start + i}" tabindex="0"` : ""}>${tb.columns.map((c) => `<td class="${c.cls || ""}">${c.f ? c.f(row) : esc(fv(c.k, row[c.k]))}</td>`).join("")}</tr>`).join("")}</tbody></table>
      ${pages > 1 ? `<div class="pager"><button class="btn" data-tpage="${id}|-1" ${tb.page === 0 ? "disabled" : ""}>${tx.prev}</button><span class="muted">${tb.page + 1} ${tx.of} ${pages}</span><button class="btn" data-tpage="${id}|1" ${tb.page >= pages - 1 ? "disabled" : ""}>${tx.next}</button></div>` : ""}`;
  }
  function downloadCsv(name, rows, columns) {
    const cell = (v) => {
      if (v == null) return "";
      if (typeof v === "object") v = JSON.stringify(v);
      const s = String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = columns.map((c) => cell(`${c.label || label(c.k)}${shownUnit(c.k) ? ` (${shownUnit(c.k)})` : ""}`)).join(",");
    const body = rows.map((r) => columns.map((c) => cell(cellValue(c, r))).join(",")).join("\n");
    const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pulso-${name}-${TODAY}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvButton = (id) => `<button class="btn small" data-csv="${id}">${esc(t().downloadCsv)}</button>`;
  /** Column sets reused across views. */
  const actCols = () => {
    const tx = t();
    const c = [
      { k: "start", label: tx.date, f: (a) => esc(new Date(a.date + "T12:00:00").toLocaleDateString(state.lang, { weekday: "short", day: "numeric", month: "short", year: "numeric" })) },
      { k: "name", label: tx.activity, cls: "name left", f: (a) => `<span class="dot" style="background:${sportColor(a.sport)}"></span>${esc(a.name)}${a.pr || a.prCount ? " 🏅" : ""}<span class="kind">${esc(tx.sports[a.sport] || "")}${a.place ? " · " + esc(a.place) : ""}${a.gear ? " · " + esc(a.gear) : ""}</span>` },
      { k: "min", label: tx.duration },
      { k: "km", label: tx.distance, f: (a) => (a.km ? `${nf(a.km, 1)} km` : "–") },
      { k: "elev", label: tx.elevation },
      { k: "hr", label: tx.avgHr },
      { k: "watts", label: tx.power },
      { k: "load", label: tx.load },
    ];
    if (STRAVA) c.push({ k: "relEffort", label: label("relEffort") });
    if (HAS_SRC) c.push({ k: "src", f: (a) => `<span class="badge ${a.src}">${esc(fv("src", a.src))}</span>` });
    return c;
  };
  const openAct = (a) => openPanel({ kind: "activity", id: String(a.id) });

  // ---------------------------------------------------------------- shell
  function renderShell() {
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.theme = state.theme === "auto" ? "" : state.theme;
    $("lang-btn").textContent = es() ? "EN" : "ES";
    $("theme-btn").textContent = { auto: "◐", dark: "☾", light: "☀" }[state.theme];
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t()[el.dataset.i18n] ?? ""; });
    $("tabs").innerHTML = TABS.map((k) => `<button class="tab" data-tab="${k}" aria-selected="${k === state.tab}">${esc(t().tabs[k])}</button>`).join("");
    document.querySelectorAll("main > section").forEach((s) => s.classList.toggle("active", s.dataset.tab === state.tab));
    renderFilters();

    const last = RAW.lastSync && !LIVE ? new Date(RAW.lastSync) : null; // the app shows it in the sync pill
    $("sync-info").textContent = [
      last ? `${t().lastSync} ${last.toLocaleString(state.lang, { dateStyle: "medium", timeStyle: "short" })}` : "",
      HAS_DATA ? `${nf(daysBetween(FIRST, TODAY) / 365.25, 1)} ${t().yearsOfData} · ${nf(ACTS.length)} ${t().acts}` : "",
      STRAVA && STRAVA.connected ? "Garmin + Strava" : "",
    ].filter(Boolean).join(" · ");

    $("sync-btn").hidden = !LIVE;
    $("sync-btn").textContent = sync.running ? t().syncing : t().sync;
    $("sync-btn").disabled = sync.running;
    renderSyncStatus();
    const errs = (RAW.syncErrors || []).concat((STRAVA && STRAVA.errors) || []);
    $("errors").textContent = errs.length ? `⚠ ${errs.length} ${t().syncWarnings}` : "";
    $("errors").title = errs.map((e) => `${e.source} ${e.window}: ${e.error}`).join("\n");
    $("act-search").placeholder = t().search;
    $("data-search").placeholder = t().search;
  }

  function renderFilters() {
    const tx = t();
    const presetName = (p) => (/^\d{4}$/.test(p) ? (isCurrentYear(p) ? `${p} (${tx.inProgress})` : p) : tx.presets[p]);
    $("preset").innerHTML = PRESETS().map((p) => `<option value="${p}" ${p === state.preset ? "selected" : ""}>${esc(presetName(p))}</option>`).join("");
    const [a, b] = R();
    $("from").value = a; $("to").value = b;
    $("from").min = $("to").min = FIRST; $("from").max = $("to").max = TODAY;
    const present = SPORTS.filter((s) => ACTS.some((x) => x.sport === s));
    $("sport-chips").setAttribute("aria-label", tx.sportsLabel);
    $("sport-chips").innerHTML = `<button class="chip" data-sport="" aria-pressed="${!state.sports.size}">${esc(tx.allSports)}</button>` + present.map((s) => `<button class="chip" data-sport="${s}" aria-pressed="${state.sports.has(s)}"><span class="dot" style="background:${sportColor(s)}"></span>${esc(tx.sports[s])}</button>`).join("");
    $("src-filter").hidden = !HAS_SRC;
    $("src").innerHTML = [["all", tx.srcAll], ["garmin", tx.srcGarmin], ["strava", tx.srcStrava]].map(([k, v]) => `<option value="${k}" ${k === state.src ? "selected" : ""}>${esc(v)}</option>`).join("");
    $("filters-reset").hidden = !filtersActive();
    $("filters").hidden = !HAS_DATA;
  }

  // ---------------------------------------------------------------- overview
  const totals = (acts) => ({ acts: acts.length, hours: sumOf(acts, "min") / 60, km: sumOf(acts, "km"), elev: sumOf(acts, "elev") });

  function renderHeadline(cur, prev) {
    const tx = t(), p = state.preset, [a, b] = R();
    const intro = p === "365" ? tx.hlScope["365"] : p === "30" || p === "90" ? tx.hlScope.days(p) : p === "all" ? tx.hlScope.all(FIRST.slice(0, 4))
      : isYear() ? (isCurrentYear(yearOf()) ? tx.hlScope.current(yearOf()) : tx.hlScope.year(p)) : tx.hlScope.custom(dayYearLabel(a), dayYearLabel(b));
    let html = `${intro}, ${tx.hlBody(nf(cur.hours), nf(cur.acts), cur.km >= 1 ? nf(cur.km) : "")}`;
    const pct = prev && prev.hours > 0 ? Math.round(((cur.hours - prev.hours) / prev.hours) * 100) : 0;
    if (Math.abs(pct) >= 1) {
      const prevText = isYear() ? (isCurrentYear(yearOf()) ? tx.prevLabel.current(+yearOf() - 1) : tx.prevLabel.year(+yearOf() - 1)) : tx.prevLabel.generic;
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
    const tile = (measure, lbl, value, u, curV, prevV, spark) => `<div class="tile clickable"${op({ kind: "acts", measure, title: lbl })}>
      <div class="label">${esc(lbl)}</div>
      <div class="value">${value}${u ? `<small>${esc(u)}</small>` : ""}</div>
      ${prev ? deltaHtml(prevV ? ((curV - prevV) / prevV) * 100 : null, 0, "", 0, "pct") : ""}
      ${sparkline(spark)}
    </div>`;
    $("kpis").innerHTML = [
      tile("hours", tx.kpi.hours, nf(cur.hours), "h", cur.hours, prev && prev.hours, series((a) => (a.min || 0) / 60)),
      tile("acts", tx.kpi.acts, nf(cur.acts), "", cur.acts, prev && prev.acts, series(() => 1)),
      tile("km", tx.kpi.km, nf(cur.km), "km", cur.km, prev && prev.km, series((a) => a.km || 0)),
      tile("elev", tx.kpi.elev, nf(cur.elev), "m", cur.elev, prev && prev.elev, series((a) => a.elev || 0)),
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
      const diff = (cur - bm) * direction(m);
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
    $("now").innerHTML = results.map((x) => `<div class="now-item clickable"${op({ kind: "metric", m: x.m, from: addDays(last, -62), to: last })}>
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
  function findingTexts(p) {
    const cut = (v) => (p.x === "lastEnd" || p.x === "bedtime" ? clock(v) : p.x === "sleepH" ? nf(v, 1) : nf(v));
    const ph = X_PHRASE[state.lang][p.x];
    const [hiText, loText] = typeof ph === "function" ? ph(cut(p.hiCut), cut(p.loCut)) : ph;
    return { hiText, loText, title: `${hiText}, ${Y_NOUN[state.lang][p.y]} ${p.hiMean > p.loMean ? t().up : t().down}.` };
  }
  function findingCard(p) {
    const tx = t();
    const { hiText, loText, title } = findingTexts(p);
    const yv = (v) => withUnit(p.y, v);
    const max = Math.max(p.hiMean, p.loMean) || 1;
    return `<div class="finding clickable"${op({ kind: "finding", x: p.x, y: p.y, lag: p.lag })}>
      <h3>${esc(title)}</h3>
      <div class="compare">
        <div class="compare-row"><span>${esc(hiText)}</span><b>${esc(yv(p.hiMean))}</b><div class="bar-track"><i style="width:${(p.hiMean / max) * 100}%"></i></div></div>
        <div class="compare-row"><span>${esc(cap(loText))}</span><b>${esc(yv(p.loMean))}</b><div class="bar-track base"><i style="width:${(p.loMean / max) * 100}%"></i></div></div>
      </div>
      <div class="foot"><span class="pill ${Math.abs(p.r) >= 0.4 ? "strong" : ""}">${esc(Math.abs(p.r) >= 0.4 ? tx.clear : tx.moderate)}</span>${esc(tx.basedOn(nf(p.n)))}</div>
    </div>`;
  }

  function renderFindings() {
    const L = state.lang, r = R();
    const list = PAIRS.filter(([x, y]) => X_PHRASE[L][x] && Y_NOUN[L][y])
      .map(([x, y, lag]) => pairStats(x, y, lag, r))
      .filter((p) => p && p.p < 0.05 && Math.abs(p.r) >= 0.15 && p.n >= 30 && p.hiMean > 0 && p.loMean > 0)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 4);
    $("findings").innerHTML = list.length ? list.map(findingCard).join("") : `<div class="card empty">${esc(t().noFindings)}</div>`;
  }

  function stravaForm() {
    const tx = t();
    return `<form class="strava-form" data-strava-form>
      <ol class="steps">${tx.stravaSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="form-row">
        <input class="input" name="client_id" inputmode="numeric" autocomplete="off" placeholder="${esc(tx.clientId)}" required>
        <input class="input" name="client_secret" type="password" autocomplete="off" placeholder="${esc(tx.clientSecret)}" required>
        <button class="btn primary" type="submit">${esc(tx.connect)}</button>
        <a class="btn ghost" href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer">${esc(tx.openStrava)} ↗</a>
      </div>
      <p class="form-error" hidden></p>
    </form>`;
  }

  function renderStravaConnect() {
    const el = $("strava-connect");
    const show = !DEMO && !(STRAVA && STRAVA.connected) && store.get("stravaHide", "") !== "1";
    el.hidden = !show;
    if (!show) return;
    const tx = t();
    el.innerHTML = `<div class="card-head"><div><h2>${esc(tx.stravaConnectTitle)}</h2><p class="sub">${esc(tx.stravaConnectBody)}</p></div>
      <button class="btn ghost" data-strava-hide>${esc(tx.notNow)}</button></div>
      ${LIVE ? stravaForm() : `<p class="sub">${esc(tx.stravaCli)}</p><pre class="code">garmin-connect-mcp dashboard strava</pre>`}`;
  }

  function renderOverview() {
    const r = R();
    renderKpis(r, prevRange());
    renderNow();
    $("weekly-sub").textContent = bucketFor(r) === MONTHLY ? t().weeklySubLong : t().weeklySub;
    sportBars("c-weekly", "weekly-legend", actsIn(r), r);
    renderStravaConnect();
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
      return `<tr class="clickable"${op({ kind: "acts", sport: s, title: tx.sports[s] })}><td><span class="dot" style="background:${sportColor(s)}"></span>${tx.sports[s]}</td><td>${nf(l.length)}</td><td>${nf(sumOf(l, "min") / 60)} h</td><td>${sumOf(l, "km") >= 1 ? nf(sumOf(l, "km")) + " km" : "–"}</td><td>${sumOf(l, "elev") >= 1 ? nf(sumOf(l, "elev")) + " m" : "–"}</td><td class="left"><span class="share"><i style="width:${Math.max(2, share * 120)}px;background:${sportColor(s)}"></i>${nf(share * 100)} %</span></td></tr>`;
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
    }, (di) => openPanel({ kind: "metric", m: di === 0 ? "ctl" : "atl" }, false));
  }

  /** Zone definitions for a source: [name, hint] per zone, and the minutes key on activities. */
  function zoneDefs(src) {
    const tx = t(), u = unit("rhr");
    const bound = (z, unitText) => (z[1] === -1 || z[1] == null ? `> ${z[0]} ${unitText}` : `${z[0]}–${z[1]} ${unitText}`);
    if (src === "stravaHr") return { key: "hrZonesS", names: ((STRAVA && STRAVA.hrZones) || []).map((z, i) => [`${es() ? "Zona" : "Zone"} ${i + 1}`, bound(z, u)]) };
    if (src === "stravaPwr") return { key: "pwrZonesS", names: ((STRAVA && STRAVA.powerZones) || []).map((z, i) => [`Z${i + 1} · ${tx.powerZones[i] || ""}`, bound(z, "W")]) };
    return { key: "zones", names: tx.zones };
  }
  function zoneSources() {
    return ["garmin", "stravaHr", "stravaPwr"].filter((s) => ACTS.some((a) => a[zoneDefs(s).key]));
  }

  function renderZones(acts) {
    const tx = t();
    const avail = zoneSources();
    if (!avail.includes(state.zoneSrc)) state.zoneSrc = avail[0] || "garmin";
    $("zone-src").innerHTML = avail.length > 1 ? avail.map((s) => `<button data-zsrc="${s}" aria-selected="${s === state.zoneSrc}">${esc(tx.zoneSrc[s])}</button>`).join("") : "";
    $("zones-sub").textContent = tx.zonesSub[state.zoneSrc];
    const { key, names } = zoneDefs(state.zoneSrc);
    const zones = names.map(() => 0);
    for (const a of acts) (a[key] || []).forEach((m, i) => { if (i < zones.length) zones[i] += m || 0; });
    const total = sum(zones);
    if (!total) { $("zones").innerHTML = `<div class="empty">${esc(tx.noData)}</div>`; return; }
    const max = Math.max(...zones);
    const color = (i) => `var(--z${Math.min(5, Math.round((i * 4) / Math.max(1, zones.length - 1)) + 1)})`;
    $("zones").innerHTML = zones.map((m, i) => `<div class="zone clickable"${op({ kind: "zone", src: state.zoneSrc, i })}>
      <div class="zname"><b>${esc(names[i][0])}</b><span>${esc(names[i][1])}</span></div>
      <div class="zbar"><i style="width:${(m / max) * 100}%;background:${color(i)}"></i></div>
      <div class="zval">${nf((m / total) * 100)} %<small>${nf(m / 60)} h</small></div>
    </div>`).join("");
  }

  function renderCalendar(r, acts) {
    let [a, b] = r;
    if (daysBetween(a, b) > 371) a = addDays(b, -364);
    const start = weekStart(a);
    const weeks = Math.ceil((daysBetween(start, b) + 1) / 7);
    const minutes = new Map();
    for (const act of acts) if (inR(act.date, [a, b])) minutes.set(act.date, (minutes.get(act.date) || 0) + (act.min || 0));
    const fills = [css("--surface-2"), css("--z1"), css("--z2"), css("--z4"), css("--z5")];
    const level = (m) => (m <= 0 ? 0 : m < 45 ? 1 : m < 90 ? 2 : m < 150 ? 3 : 4);
    const cell = 13, gap = 3, top = 18, left = 30;
    let svg = "", lastMonth = -1, lastLabelWeek = -9;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        if (day < a || day > b) continue;
        const m = minutes.get(day) || 0;
        svg += `<rect class="day" data-day="${day}" x="${left + w * (cell + gap)}" y="${top + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${fills[level(m)]}"><title>${dayYearLabel(day)} · ${m ? dur(m) : t().calLegend[0]}</title></rect>`;
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
    const bestPower = (s) => acts.filter((a) => a.power && a.power[s]).sort((a, b) => b.power[s] - a.power[s])[0];
    const recs = [
      [tx.rec.km, best(acts, "km"), (a) => `${nf(a.km, 1)} km`],
      [tx.rec.min, best(acts, "min"), (a) => dur(a.min)],
      [tx.rec.elev, best(acts, "elev"), (a) => `${nf(a.elev)} m`],
      [tx.rec.p1200, bestPower("1200"), (a) => `${a.power["1200"]} W`],
      [tx.rec.p300, bestPower("300"), (a) => `${a.power["300"]} W`],
      [tx.rec.run, best(acts.filter((a) => a.sport === "running"), "km"), (a) => `${nf(a.km, 1)} km`],
      [tx.rec.load, best(acts, "load"), (a) => nf(a.load)],
      [tx.rec.hrMax, best(acts, "hrMax"), (a) => `${a.hrMax} ${unit("rhr")}`],
      [tx.rec.relEffort, best(acts, "relEffort"), (a) => nf(a.relEffort)],
    ].filter(([, a]) => a);
    $("records").innerHTML = recs.length ? recs.map(([l, a, f]) => `<div class="record clickable"${op({ kind: "activity", id: String(a.id) })}><div class="label">${esc(l)}</div><div class="value">${esc(f(a))}</div><p class="sub" title="${esc(a.name)}">${esc(dayYearLabel(a.date))} · ${esc(a.name)}</p></div>`).join("") : `<div class="empty">${esc(tx.noData)}</div>`;
  }

  function renderBestEfforts(acts) {
    const tx = t();
    const rows = BEST_ORDER.map((name) => {
      const withIt = acts.filter((a) => a.best && a.best[name]);
      if (!withIt.length) return null;
      const top = withIt.reduce((x, y) => (y.best[name][0] < x.best[name][0] ? y : x));
      return { effort: name, time: top.best[name][0], pace: top.best[name][0] / (BEST_METERS[name] / 1000), date: top.date, activity: top.name, n: withIt.length };
    }).filter(Boolean);
    $("best-card").hidden = !rows.length;
    if (!rows.length) return;
    $("best-efforts").innerHTML = `<table><thead><tr><th>${esc(label("effort"))}</th><th>${esc(tx.time)}</th><th>${esc(tx.pace)}</th><th class="left">${esc(tx.date)}</th></tr></thead><tbody>${rows.map((r) => `<tr class="clickable"${op({ kind: "best", name: r.effort })}><td>${esc(r.effort)}</td><td><b>${secs(r.time)}</b></td><td>${paceOf(r.pace)}</td><td class="left">${esc(dayYearLabel(r.date))} <span class="muted">· ${esc(r.activity)}</span></td></tr>`).join("")}</tbody></table>`;
  }

  function gearRows(acts) {
    return ((STRAVA && STRAVA.gear) || []).map((g) => {
      const used = acts.filter((a) => a.gearId === g.id);
      return { ...g, kmTotal: g.km, kmPeriod: sumOf(used, "km"), nActs: used.length };
    });
  }
  function renderGear(acts) {
    const tx = t();
    const rows = gearRows(acts);
    $("gear-card").hidden = !rows.length;
    if (!rows.length) return;
    rows.sort((a, b) => b.kmPeriod - a.kmPeriod || b.kmTotal - a.kmTotal);
    $("gear").innerHTML = `<table><thead><tr><th>${esc(label("gear"))}</th><th>${esc(tx.kmPeriod)}</th><th>${esc(tx.count)}</th><th>${esc(tx.kmTotal)}</th></tr></thead><tbody>${rows.map((g) => `<tr class="clickable ${g.retired ? "muted" : ""}"${op({ kind: "gear", id: g.id })}><td>${g.kind === "bike" ? "🚲" : "👟"} ${esc(g.name)}${g.primary ? ' <span class="pill">★</span>' : ""}</td><td>${nf(g.kmPeriod)} km</td><td>${nf(g.nActs)}</td><td>${nf(g.kmTotal)} km</td></tr>`).join("")}</tbody></table>`;
  }

  function renderTraining() {
    const r = R(), acts = actsIn(r);
    renderSportTable(acts);
    sportBars("c-monthly", "monthly-legend", acts, r, MONTHLY);
    renderForm(r);
    renderZones(acts);
    renderCalendar(r, acts);
    renderRecords(acts);
    renderBestEfforts(acts);
    renderGear(acts);
    $("strava-training").hidden = $("best-card").hidden && $("gear-card").hidden;
  }

  // ---------------------------------------------------------------- health
  function metricCard(m, dr, dp, p) {
    const cur = avgOf(dr, m), prev = p ? avgOf(dp, m) : null;
    const u = shownUnit(m);
    const delta = p && cur != null && prev != null
      ? (m === "steps" ? deltaHtml(((cur - prev) / prev) * 100, 0, "", 1, "pct") : deltaHtml(cur - prev, digits(m), u, direction(m)))
      : '<div class="delta">&nbsp;</div>';
    return `<div class="metric clickable"${op({ kind: "metric", m })}>
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
    const tile = (l, v, u, hint, spec) => `<div class="tile clickable"${op(spec)}><div class="label">${esc(l)}</div><div class="value">${v}${u ? `<small>${esc(u)}</small>` : ""}</div>${hint ? `<div class="delta">${esc(hint)}</div>` : ""}</div>`;
    $("sleep-tiles").innerHTML = [
      tile(tx.bed, clock(mean(bed)), "", "", { kind: "metric", m: "bedtime" }),
      tile(tx.wake, clock(avgOf(nights, "wake")), "", "", { kind: "metric", m: "wake" }),
      tile(tx.regularity, bed.length > 2 ? `± ${nf(sd(bed) * 60)}` : "–", "min", tx.regularityHint, { kind: "metric", m: "bedtime" }),
      tile(tx.nights7, nights.length ? nf((nights.filter((d) => d.sleepH >= 7).length / nights.length) * 100) : "–", "%", "", { kind: "metric", m: "sleepH" }),
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
    }, (di, i) => openPanel({ kind: "metric", m: stages[di][0], from: keys[i] < r[0] ? r[0] : keys[i], to: bucket.end(keys[i]) > r[1] ? r[1] : bucket.end(keys[i]) }, false));
  }

  function seriesDef(name) {
    const tx = t();
    if (name === "vo2") {
      const sport = ["cycling", "running"].find((s) => (RAW.vo2 || []).some((x) => x.sport === s));
      return { title: tx.vo2((tx.sports[sport] || "").toLowerCase()), what: tx.vo2What, unit: "", rows: (RAW.vo2 || []).filter((x) => x.sport === sport), key: "value", stepped: true };
    }
    if (name === "weight") return { title: tx.weight, what: tx.weightWhat, unit: "kg", rows: RAW.weight || [], key: "kg" };
    return { title: tx.endurance, what: tx.enduranceWhat, unit: "", rows: RAW.endurance || [], key: "value" };
  }

  function renderBody(r) {
    const tx = t();
    const cards = ["vo2", "weight", "endurance"].map((k) => [k, seriesDef(k)]).map(([k, s]) => [k, s, s.rows.filter((x) => inR(x.date, r))]).filter(([, , pts]) => pts.length);
    dropCharts("c-b-");
    $("body-cards").innerHTML = cards.map(([k, s, pts]) => `<div class="metric clickable"${op({ kind: "series", name: k })}>
      <h3>${esc(s.title)}</h3><p class="what">${esc(s.what)}</p>
      <div class="value">${nf(pts[pts.length - 1][s.key], k === "endurance" ? 0 : 1)}${s.unit ? `<small>${s.unit}</small>` : ""}</div>
      <div class="delta">${esc(tx.latest)} · ${esc(dayYearLabel(pts[pts.length - 1].date))}</div>
      <div class="chart small"><canvas id="c-b-${k}"></canvas></div></div>`).join("");
    for (const [k, s, pts] of cards) {
      const ys = pts.map((x) => x[s.key]);
      const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.3 || 1;
      chart(`c-b-${k}`, {
        data: { labels: pts.map((x) => x.date), datasets: [line(s.title, ys, css("--s1"), { stepped: !!s.stepped, tension: 0, pointRadius: pts.length < 40 ? 3 : 0 })] },
        options: {
          plugins: { tooltip: { callbacks: { title: (it) => dayYearLabel(it[0].label), label: (c) => `${nf(c.raw, 1)} ${s.unit}` } } },
          scales: { x: { ticks: { maxTicksLimit: 4, callback(v) { return monthLabel(this.getLabelForValue(v).slice(0, 7)); } } }, y: { beginAtZero: false, suggestedMin: lo - pad, suggestedMax: hi + pad, ticks: { maxTicksLimit: 3 } } },
        },
      });
    }
    $("body-cards").hidden = !cards.length;
  }

  function renderHealth() {
    const r = R(), p = prevRange();
    const dr = daysIn(r), dp = p ? daysIn(p) : [];
    const metrics = ["hrv", "rhr", "sleepH", "sleepScore", "bbMax", "stress", "readiness", "steps", "resp", "spo2", "relEffort"].filter((m) => vals(dr, m).length);
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
    const focus = YEARS.includes(yearOf()) ? yearOf() : TODAY.slice(0, 4);
    const acts = ACTS.filter((a) => sportOk(a) && srcOk(a));

    if (YEARS.length && acts.length) {
      const doy = (d) => daysBetween(`${d.slice(0, 4)}-01-01`, d);
      const accent = css("--s1"), other = css("--neutral");
      // Emphasis: the year in focus in the accent colour, every other year as grey context.
      const datasets = YEARS.map((y) => {
        const perDay = new Array(366).fill(0);
        for (const a of acts) if (a.date.startsWith(y)) perDay[doy(a.date)] += pick(a);
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
      }, (di, i) => { const y = YEARS[di]; openPanel({ kind: "acts", from: `${y}-01-01`, to: addDays(`${y}-01-01`, i), title: y, bucket: `${tx.by} ${dayLabel(addDays(`${y}-01-01`, i))}` }, false); });
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
    $("year-table").innerHTML = rows.length ? `<table><thead><tr><th>${tx.year}</th>${colsDef.map(([h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(([y, v], ri) => `<tr class="clickable"${op({ kind: "acts", from: `${y}-01-01`, to: `${y}-12-31`, title: y })}><td>${y}${isCurrentYear(y) ? ` <span class="muted">(${tx.inProgress})</span>` : ""}</td>${v.map((x, i) => `<td class="${bestRow[i] === ri ? "best" : ""}">${x ? nf(x, colsDef[i][2]) + colsDef[i][4] : "–"}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="empty">${esc(tx.noData)}</div>`;
  }

  // ---------------------------------------------------------------- activities
  const matches = (a, q) => !q || `${a.name} ${a.type} ${a.place || ""} ${a.gear || ""} ${a.device || ""}`.toLowerCase().includes(q);
  function renderActivities() {
    const q = ($("act-search").value || "").toLowerCase();
    const list = actsIn(R()).filter((a) => matches(a, q));
    $("act-count").textContent = `${nf(list.length)} ${t().acts}`;
    dataTable($("act-table"), "acts", list, actCols(), { sort: ["start", -1], onRow: openAct });
  }

  // ---------------------------------------------------------------- data explorer
  const NESTED = new Set(["zones", "power", "best", "splits", "segs", "laps", "hrZonesS", "pwrZonesS", "desc"]);
  const ORDER = Object.keys(F);
  const keysOf = (rows, skip = new Set()) => {
    const seen = new Set();
    for (const r of rows) for (const k of Object.keys(r)) if (!skip.has(k)) seen.add(k);
    return [...seen].sort((a, b) => (ORDER.indexOf(a) + 1 || 999) - (ORDER.indexOf(b) + 1 || 999));
  };
  /** Data tab datasets: rows (already filtered), default columns and what a row opens. */
  function dataSets() {
    const r = R(), acts = actsIn(r);
    const perAct = (f) => acts.flatMap((a) => f(a).map((x) => ({ date: a.date, activity: a.name, sport: a.sport, ...x, _id: a.id })));
    const zoneSrcName = (s) => t().zoneSrc[s];
    const sets = {
      days: { rows: () => daysIn(r), cols: ["date", "steps", "rhr", "hrv", "sleepH", "sleepScore", "stress", "bbMax", "readiness", "actMin", "actLoad", "ctl", "atl"], open: (row) => ({ kind: "day", date: row.date }) },
      activities: { rows: () => acts.map((a) => Object.fromEntries(Object.entries(a).filter(([k]) => !NESTED.has(k)))), cols: ["start", "name", "sport", "min", "km", "elev", "kmh", "hr", "watts", "np", "load", "relEffort", "kudos", "gear", "src"], open: (row) => ({ kind: "activity", id: String(row.id) }), fieldKeys: true },
      zones: { rows: () => perAct((a) => ["garmin", "stravaHr", "stravaPwr"].map((s) => [s, a[zoneDefs(s).key]]).filter(([, z]) => z).map(([s, z]) => ({ zoneSrc: zoneSrcName(s), ...Object.fromEntries(z.map((m, i) => [`z${i + 1}`, m])) }))) },
      best: { rows: () => perAct((a) => Object.entries(a.best || {}).map(([name, [s, pr]]) => ({ effort: name, time: s, pace: BEST_METERS[name] ? s / (BEST_METERS[name] / 1000) : null, prRank: pr ?? null }))) },
      splits: { rows: () => perAct((a) => (a.splits || []).map((s) => ({ split: s.k, km: s.km, time: s.s, pace: s.km ? s.s / s.km : null, kmh: s.kmh, hr: s.hr, elev: s.elev }))) },
      segments: { rows: () => perAct((a) => (a.segs || []).map((s) => ({ segment: s.name, km: s.km, grade: s.grade, time: s.s, hr: s.hr, watts: s.w, prRank: s.pr ?? null, komRank: s.kom ?? null }))) },
      laps: { rows: () => perAct((a) => (a.laps || []).map((l, i) => ({ lap: i + 1, segment: l.name, km: l.km, time: l.s, kmh: l.kmh, hr: l.hr, watts: l.w }))) },
      power: { rows: () => perAct((a) => (a.power ? Object.entries(a.power).map(([s, w]) => ({ seconds: +s, watts: w })) : [])) },
      vo2: { rows: () => (RAW.vo2 || []).filter((x) => inR(x.date, r)) },
      weight: { rows: () => (RAW.weight || []).filter((x) => inR(x.date, r)) },
      endurance: { rows: () => (RAW.endurance || []).filter((x) => inR(x.date, r)) },
      gear: { rows: () => gearRows(acts).map(({ km, ...g }) => g), open: (row) => ({ kind: "gear", id: row.id }) },
    };
    for (const k of ["zones", "best", "splits", "segments", "laps", "power"]) sets[k].open = (row) => ({ kind: "activity", id: String(row._id) });
    return sets;
  }

  function renderData() {
    const tx = t();
    const sets = dataSets();
    const avail = Object.keys(sets).filter((k) => k === "days" || k === "activities" || sets[k].rows().length);
    if (!avail.includes(state.dataSet)) state.dataSet = "activities";
    $("data-set").innerHTML = avail.map((k) => `<option value="${k}" ${k === state.dataSet ? "selected" : ""}>${esc(tx.dataSets[k])}</option>`).join("");
    $("data-desc").textContent = tx.dataDesc[state.dataSet] || "";
    const set = sets[state.dataSet];
    const q = ($("data-search").value || "").toLowerCase();
    const all = set.rows();
    const rows = q ? all.filter((row) => Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(q))) : all;
    const keys = keysOf(all, new Set(["_id"]));
    const saved = store.get(`cols.${state.dataSet}`, "");
    let chosen = saved ? saved.split(",").filter((k) => keys.includes(k)) : (set.cols || keys).filter((k) => keys.includes(k));
    if (!chosen.length) chosen = keys.slice(0, 12);
    $("data-cols-menu").innerHTML = keys.map((k) => `<label><input type="checkbox" data-col="${esc(k)}" ${chosen.includes(k) ? "checked" : ""}> ${esc(label(fieldKey(k, set.fieldKeys)))}</label>`).join("");
    const columns = chosen.map((k) => ({ k: fieldKey(k, set.fieldKeys), v: (row) => row[k], f: (row) => esc(fv(fieldKey(k, set.fieldKeys), row[k])), cls: typeof (all.find((x) => x[k] != null) || {})[k] === "string" ? "left" : "" }));
    $("data-count").textContent = `${nf(rows.length)} ${tx.rows}`;
    TABLES.dataCsv = { rows, columns, name: state.dataSet };
    dataTable($("data-table"), "data", rows, columns, { pageSize: 50, sort: [columns[0] && columns[0].k, -1], keepSort: false, onRow: set.open ? (row) => openPanel(set.open(row)) : null });
    // dictionary of the columns in this dataset
    $("data-dict").innerHTML = `<table><thead><tr><th class="left">${esc(tx.columns)}</th><th class="left">Key</th><th class="left">${es() ? "Unidad" : "Unit"}</th><th class="left">${es() ? "Qué es" : "Meaning"}</th></tr></thead><tbody>${keys.map((k) => { const fk = fieldKey(k, set.fieldKeys); const u = unit(fk); return `<tr><td class="left">${esc(label(fk))}</td><td class="left"><code>${esc(k)}</code></td><td class="left">${esc(u === "@clock" ? "hh:mm" : u === "@dur" ? "h min" : u === "@sec" ? "m:ss" : u === "@pace" ? "m:ss /km" : u)}</td><td class="left wrap">${esc(what(fk))}</td></tr>`; }).join("")}</tbody></table>`;
    renderStravaStatus();
  }

  function renderStravaStatus() {
    const el = $("strava-status"), tx = t();
    el.hidden = DEMO && !STRAVA;
    if (el.hidden) return;
    if (!STRAVA || !STRAVA.connected) {
      el.innerHTML = `<h2>${esc(tx.stravaConnectTitle)}</h2><p class="sub">${esc(tx.stravaConnectBody)}</p>${LIVE ? stravaForm() : `<p class="sub">${esc(tx.stravaCli)}</p><pre class="code">garmin-connect-mcp dashboard strava</pre>`}`;
      return;
    }
    const z = (list, u) => (list || []).map((x, i) => `Z${i + 1} ${x[1] === -1 ? `> ${x[0]}` : `${x[0]}–${x[1]}`}`).join(" · ") + (list && list.length ? ` ${u}` : "");
    const totalsHtml = Object.entries(STRAVA.totals || {}).map(([k, v]) => `<div class="tile"><div class="label">${esc(tx.totals[k])}</div><div class="value">${nf(v.km)}<small>km</small></div><div class="delta">${nf(v.count)} ${esc(tx.acts)} · ${nf(v.h)} h${v.elev ? ` · ${nf(v.elev)} m` : ""}</div></div>`).join("");
    el.innerHTML = `<div class="card-head"><div><h2>${esc(tx.stravaStatus)}</h2>
      <p class="sub">${esc(tx.stravaSummary(nf(STRAVA.activities), nf(STRAVA.detailed)))}${STRAVA.pending ? " " + esc(tx.stravaPending(nf(STRAVA.pending))) : ""}</p></div>
      ${LIVE && !DEMO ? `<button class="btn ghost" data-strava-disconnect>${esc(tx.disconnect)}</button>` : ""}</div>
      ${totalsHtml ? `<div class="tiles four compact">${totalsHtml}</div>` : ""}
      <dl class="kv">${STRAVA.ftp ? `<dt>${esc(tx.ftp)}</dt><dd>${nf(STRAVA.ftp)} W</dd>` : ""}${STRAVA.hrZones ? `<dt>${esc(tx.hrZonesLabel)}</dt><dd>${esc(z(STRAVA.hrZones, unit("rhr")))}</dd>` : ""}${STRAVA.powerZones ? `<dt>${esc(tx.powerZonesLabel)}</dt><dd>${esc(z(STRAVA.powerZones, "W"))}</dd>` : ""}</dl>`;
  }

  // ---------------------------------------------------------------- side panel
  // A stack of specs: opening from inside the panel pushes (← goes back), from the page replaces.
  const panel = { stack: [] };
  function openPanel(spec, fromPanel) {
    if (!fromPanel) panel.stack = [];
    panel.stack.push(spec);
    showPanel();
  }
  function closePanel() {
    panel.stack = [];
    $("panel").hidden = true;
    $("scrim").hidden = true;
    document.body.classList.remove("panel-open");
    dropCharts("p-");
  }
  function showPanel() {
    const spec = panel.stack[panel.stack.length - 1];
    if (!spec) return closePanel();
    $("panel").hidden = false;
    $("scrim").hidden = false;
    document.body.classList.add("panel-open");
    $("panel-back").hidden = panel.stack.length < 2;
    dropCharts("p-");
    $("panel-kicker").textContent = t().panel[spec.kind] || "";
    $("panel-sub").textContent = "";
    $("panel-body").scrollTop = 0;
    (PANELS[spec.kind] || (() => {}))(spec);
  }
  const setHead = (title, sub) => { $("panel-title").textContent = title; $("panel-sub").textContent = sub || ""; };
  const body = (html) => { $("panel-body").innerHTML = html; };
  /** Segmented control bound to a key of the current spec. */
  const seg = (key, options, current) => `<div class="segmented">${options.map(([v, l]) => `<button data-pset="${key}|${esc(JSON.stringify(v))}" aria-selected="${v === current}">${esc(l)}</button>`).join("")}</div>`;
  const statTiles = (items) => `<div class="stats">${items.filter(Boolean).map(([l, v, hint, spec]) => `<div class="stat${spec ? " clickable" : ""}"${spec ? op(spec) : ""}><span>${esc(l)}</span><b>${v}</b>${hint ? `<small>${esc(hint)}</small>` : ""}</div>`).join("")}</div>`;
  const specRange = (spec) => (spec.whole ? [FIRST, TODAY] : spec.from ? [spec.from, spec.to || TODAY] : R());
  const scopeSeg = (spec) => seg("whole", [[false, spec.from ? `${dayYearLabel(spec.from)} – ${dayYearLabel(spec.to || TODAY)}` : t().scopeFiltered], [true, t().scopeAll]], !!spec.whole);
  const granSeg = (spec, r) => seg("gran", [["day", t().gran.day], ["week", t().gran.week], ["month", t().gran.month]], spec.gran || autoGran(r));

  /** Aggregate rows into buckets: values per key with sum or average. */
  function bucketize(rows, r, gran, value, agg) {
    const b = GRAN[gran];
    const keys = bucketKeys(r, b.key);
    const groups = new Map();
    for (const row of rows) {
      const v = value(row);
      if (v == null) continue;
      const k = b.key(row.date);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    }
    return { b, keys, data: keys.map((k) => (groups.has(k) ? +(agg === "sum" ? sum(groups.get(k)) : mean(groups.get(k))).toFixed(2) : agg === "sum" ? 0 : null)) };
  }
  function timeChart(id, name, series, format, opts = {}) {
    const { b, keys, data } = series;
    const present = data.filter((v) => v != null);
    if (!present.length) return emptyChart(id);
    const color = opts.color || css("--s1");
    const isBar = opts.bar;
    const ds = isBar
      ? { type: "bar", label: name, data, backgroundColor: color, borderRadius: 3, maxBarThickness: 18 }
      : line(name, data, color, { fill: true, backgroundColor: alpha(color, 0.08), tension: 0.25, spanGaps: true, pointRadius: present.length < 60 ? 2.5 : 0 });
    const lo = Math.min(...present), hi = Math.max(...present), pad = (hi - lo) * 0.15 || 1;
    chart(id, {
      data: { labels: keys, datasets: [ds] },
      options: {
        plugins: { tooltip: { callbacks: { title: (it) => b.title(it[0].label), label: (c) => format(c.raw) } } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, callback(v) { const k = this.getLabelForValue(v); return b === DAILY ? dayLabel(k) : monthLabel(k.slice(0, 7)); } } },
          y: isBar ? { ticks: { callback: (v) => format(v) } } : { beginAtZero: false, suggestedMin: lo - pad, suggestedMax: hi + pad, ticks: { callback: (v) => format(v) } },
        },
      },
    }, opts.onPick ? (di, i) => opts.onPick(keys[i], b) : null);
  }

  const PANELS = {
    /** A daily metric: how it moved and every day it came from. */
    metric(spec) {
      const tx = t(), m = spec.m, r = specRange(spec), gran = spec.gran || autoGran(r);
      const rows = daysIn(r).filter((d) => d[m] != null);
      setHead(label(m), what(m));
      if (!rows.length) return body(`${scopeSeg(spec)}<div class="empty">${esc(tx.noData)}</div>`);
      const valsM = rows.map((d) => d[m]);
      const minRow = rows.reduce((a, b) => (b[m] < a[m] ? b : a)), maxRow = rows.reduce((a, b) => (b[m] > a[m] ? b : a));
      const last = rows[rows.length - 1];
      body(`<div class="panel-controls">${scopeSeg(spec)}${granSeg(spec, r)}</div>
        ${statTiles([
          [aggOf(m) === "sum" ? tx.stat.total : tx.stat.avg, esc(fv(m, aggOf(m) === "sum" ? sum(valsM) : mean(valsM)))],
          [tx.stat.min, esc(fv(m, minRow[m])), dayYearLabel(minRow.date), { kind: "day", date: minRow.date }],
          [tx.stat.max, esc(fv(m, maxRow[m])), dayYearLabel(maxRow.date), { kind: "day", date: maxRow.date }],
          [tx.stat.last, esc(fv(m, last[m])), dayYearLabel(last.date), { kind: "day", date: last.date }],
          [tx.stat.n, nf(rows.length)],
        ])}
        <div class="chart"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-rows")}</div><div id="p-rows" class="table-wrap"></div>`);
      timeChart("p-chart", label(m), bucketize(rows, r, gran, (d) => d[m], aggOf(m)), (v) => fv(m, v), {
        bar: aggOf(m) === "sum",
        onPick: (k, b) => (b === DAILY ? openPanel({ kind: "day", date: k }, true) : openPanel({ kind: "metric", m, from: k, to: b.end(k), gran: "day" }, true)),
      });
      const related = { sleepH: ["deepH", "remH", "lightH", "awakeH", "sleepScore"], hrv: ["hrvWeek", "hrvLow", "hrvHigh"], ctl: ["atl", "tsb", "actLoad"], atl: ["ctl", "tsb", "actLoad"] }[m] || [];
      dataTable($("p-rows"), "p-rows", rows, [{ k: "date", f: (d) => esc(dayYearLabel(d.date)) }, { k: m }, ...related.map((k) => ({ k }))], { sort: ["date", -1], keepSort: false, onRow: (d) => openPanel({ kind: "day", date: d.date }, true) });
    },

    /** A set of activities (a sport, a week, a year, a KPI) with a measure over time. */
    acts(spec) {
      const tx = t(), r = specRange(spec);
      const measure = spec.measure || "hours";
      let list = ACTS.filter((a) => inR(a.date, r) && srcOk(a) && (spec.sport ? a.sport === spec.sport : sportOk(a)));
      if (spec.gear) list = list.filter((a) => a.gearId === spec.gear);
      const gran = spec.gran || autoGran(r);
      // A bar or day opened from a chart keeps its label only while that window is shown.
      const title = spec.title || tx.panel.acts;
      setHead(spec.bucket && !spec.whole ? `${title} · ${spec.bucket}` : title, `${dayYearLabel(r[0])} – ${dayYearLabel(r[1])}`);
      const pick = { hours: (a) => (a.min || 0) / 60, km: (a) => a.km || 0, elev: (a) => a.elev || 0, acts: () => 1, load: (a) => a.load || 0, relEffort: (a) => a.relEffort || 0 }[measure];
      const format = { hours: (v) => dur(v * 60), km: (v) => `${nf(v, 1)} km`, elev: (v) => `${nf(v)} m`, acts: (v) => nf(v), load: (v) => nf(v), relEffort: (v) => nf(v) }[measure];
      const measures = ["hours", "km", "elev", "acts", "load", ...(STRAVA ? ["relEffort"] : [])];
      body(`<div class="panel-controls">${scopeSeg(spec)}${granSeg(spec, r)}</div>
        ${statTiles([
          [tx.stat.nActs, nf(list.length)],
          [tx.kpi.hours, `${nf(sumOf(list, "min") / 60, 1)} h`],
          [tx.kpi.km, `${nf(sumOf(list, "km"))} km`],
          [tx.kpi.elev, `${nf(sumOf(list, "elev"))} m`],
          vals(list, "hr").length ? [tx.avgHr, `${nf(avgOf(list, "hr"))} ${unit("rhr")}`] : null,
        ])}
        <div class="panel-controls">${seg("measure", measures.map((k) => [k, tx.measure[k]]), measure)}</div>
        <div class="chart"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-acts")}</div><div id="p-acts" class="table-wrap"></div>`);
      timeChart("p-chart", tx.measure[measure], bucketize(list, r, gran, pick, "sum"), format, {
        bar: true, color: spec.sport ? sportColor(spec.sport) : css("--s1"),
        onPick: (k, b) => openPanel({ ...spec, from: k, to: b.end(k), gran: "day", whole: false, bucket: b.title(k) }, true),
      });
      dataTable($("p-acts"), "p-acts", list, actCols(), { sort: ["start", -1], keepSort: false, onRow: (a) => openPanel({ kind: "activity", id: String(a.id) }, true) });
    },

    /** One activity: every field, zones, power curve, splits, segments, best efforts. */
    activity(spec) {
      const tx = t(), a = ACT_BY_ID.get(spec.id);
      if (!a) return body(`<div class="empty">${esc(tx.noData)}</div>`);
      const when = new Date(a.date + "T12:00:00").toLocaleDateString(state.lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      setHead(a.name, `${cap(when)} · ${a.start.slice(11)}${a.place ? " · " + a.place : ""}`);
      const scalar = Object.keys(a).filter((k) => !NESTED.has(k) && !["name", "date", "start", "place"].includes(k) && a[k] != null && !(k === "id" && a.src === "strava"));
      scalar.sort((x, y) => (ORDER.indexOf(fieldKey(x, true)) + 1 || 999) - (ORDER.indexOf(fieldKey(y, true)) + 1 || 999));
      const kv = scalar.map((k) => {
        const fk = fieldKey(k, true);
        const numeric = typeof a[k] === "number" && !["id", "sid"].includes(k);
        return `<div class="kv-row${numeric ? " clickable" : ""}"${numeric ? op({ kind: "field", key: k, sport: a.sport, mark: String(a.id) }) : ""}><dt>${esc(label(fk))}</dt><dd>${esc(fv(fk, a[k]))}</dd></div>`;
      }).join("");
      const zoneBlock = (title, mins, names) => {
        if (!mins) return "";
        const total = sum(mins) || 1, max = Math.max(...mins) || 1;
        return `<div class="panel-section"><h3>${esc(title)}</h3></div><div class="zones compact">${mins.map((m, i) => `<div class="zone"><div class="zname"><b>${esc((names[i] || [`Z${i + 1}`])[0])}</b><span>${esc((names[i] || [])[1] || "")}</span></div><div class="zbar"><i style="width:${(m / max) * 100}%;background:var(--z${Math.min(5, Math.round((i * 4) / Math.max(1, mins.length - 1)) + 1)})"></i></div><div class="zval">${nf((m / total) * 100)} %<small>${esc(dur(m))}</small></div></div>`).join("")}</div>`;
      };
      const best = a.best ? BEST_ORDER.filter((n) => a.best[n]).map((n) => ({ effort: n, time: a.best[n][0], pace: a.best[n][0] / (BEST_METERS[n] / 1000), prRank: a.best[n][1] })) : [];
      body(`<div class="badges"><span class="badge"><span class="dot" style="background:${sportColor(a.sport)}"></span>${esc(tx.sports[a.sport] || a.sport)}</span>${a.src ? `<span class="badge ${a.src}">${esc(fv("src", a.src))}</span>` : ""}${a.pr ? '<span class="badge">🏅 PR</span>' : ""}${a.prCount ? `<span class="badge">🏆 ${a.prCount}</span>` : ""}${a.kudos ? `<span class="badge">👍 ${a.kudos}</span>` : ""}</div>
        ${a.desc ? `<p class="desc">${esc(a.desc)}</p>` : ""}
        <div class="panel-section"><h3>${esc(tx.fields)}</h3><span class="muted small">${esc(tx.fieldsHint)}</span></div>
        <dl class="kv-grid">${kv}</dl>
        ${zoneBlock(tx.hrZonesG, a.zones, tx.zones)}
        ${zoneBlock(tx.hrZonesS, a.hrZonesS, zoneDefs("stravaHr").names)}
        ${zoneBlock(tx.pwrZonesS, a.pwrZonesS, zoneDefs("stravaPwr").names)}
        ${a.power ? `<div class="panel-section"><h3>${esc(tx.powerCurve)}</h3></div><p class="sub">${esc(tx.powerCurveSub)}</p><div class="legend" id="p-power-legend"></div><div class="chart"><canvas id="p-power"></canvas></div>` : ""}
        ${best.length ? `<div class="panel-section"><h3>${esc(tx.bestEfforts)}</h3></div><div id="p-best" class="table-wrap"></div>` : ""}
        ${a.splits ? `<div class="panel-section"><h3>${esc(tx.splits)}</h3>${csvButton("p-splits")}</div><div class="chart"><canvas id="p-splits-chart"></canvas></div><div id="p-splits" class="table-wrap"></div>` : ""}
        ${a.segs ? `<div class="panel-section"><h3>${esc(tx.segments)}</h3></div><div id="p-segs" class="table-wrap"></div>` : ""}
        ${a.laps ? `<div class="panel-section"><h3>${esc(tx.laps)}</h3></div><div id="p-laps" class="table-wrap"></div>` : ""}
        <p><button class="btn"${op({ kind: "acts", sport: a.sport, whole: true, title: tx.sports[a.sport] })}>${esc(tx.allOfSport(tx.sports[a.sport] || a.sport))}</button></p>`);
      if (a.power) {
        const peers = actsIn(R()).filter((x) => x.power);
        const keys = POWER_SECS.filter((s) => a.power[s] || peers.some((x) => x.power[s]));
        const lbl = (s) => (+s < 60 ? `${s} s` : `${+s / 60} min`);
        const c1 = css("--s1"), c2 = css("--neutral");
        legend("p-power-legend", [[tx.thisActivity, c1], [tx.bestInPeriod, c2, "line"]]);
        chart("p-power", {
          data: { labels: keys.map(lbl), datasets: [
            { type: "bar", label: tx.thisActivity, data: keys.map((s) => a.power[s] ?? null), backgroundColor: c1, borderRadius: 3, maxBarThickness: 28 },
            line(tx.bestInPeriod, keys.map((s) => Math.max(0, ...peers.map((x) => x.power[s] || 0)) || null), c2, { tension: 0, pointRadius: 3 }),
          ] },
          options: { plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${nf(c.raw)} W` } } }, scales: { y: { ticks: { callback: (v) => `${v} W` } } } },
        });
      }
      if (best.length) dataTable($("p-best"), "p-best", best, [{ k: "effort" }, { k: "time" }, { k: "pace" }, { k: "prRank" }], { onRow: (row) => openPanel({ kind: "best", name: row.effort }, true) });
      if (a.splits) {
        const run = a.sport === "running" || a.sport === "walking";
        const splitRows = a.splits.map((s) => ({ split: s.k, km: s.km, time: s.s, pace: s.km ? s.s / s.km : null, kmh: s.kmh, hr: s.hr, elev: s.elev }));
        chart("p-splits-chart", {
          data: { labels: splitRows.map((s) => s.split), datasets: [{ type: "bar", label: run ? tx.pace : label("kmh"), data: splitRows.map((s) => (run ? s.pace : s.kmh)), backgroundColor: css("--s1"), borderRadius: 3, maxBarThickness: 18 }] },
          options: { plugins: { tooltip: { callbacks: { title: (it) => `Km ${it[0].label}`, label: (c) => (run ? paceOf(c.raw) : `${nf(c.raw, 1)} km/h`) } } }, scales: { y: { beginAtZero: !run, reverse: run, ticks: { callback: (v) => (run ? secs(v) : `${v}`) } } } },
        });
        dataTable($("p-splits"), "p-splits", splitRows, [{ k: "split" }, { k: "time" }, { k: run ? "pace" : "kmh" }, { k: "hr" }, { k: "elev" }], { pageSize: 50 });
      }
      if (a.segs) dataTable($("p-segs"), "p-segs", a.segs.map((s) => ({ segment: s.name, km: s.km, grade: s.grade, time: s.s, hr: s.hr, watts: s.w, prRank: s.pr ?? null })), [{ k: "segment", cls: "left" }, { k: "km" }, { k: "grade" }, { k: "time" }, { k: "hr" }, { k: "watts" }, { k: "prRank" }]);
      if (a.laps) dataTable($("p-laps"), "p-laps", a.laps.map((l, i) => ({ lap: i + 1, km: l.km, time: l.s, kmh: l.kmh, hr: l.hr, watts: l.w })), [{ k: "lap" }, { k: "km" }, { k: "time" }, { k: "kmh" }, { k: "hr" }, { k: "watts" }], { pageSize: 50 });
    },

    /** One activity field across every activity of that sport: does it trend? */
    field(spec) {
      const tx = t(), k = spec.key, fk = fieldKey(k, true), r = specRange(spec), gran = spec.gran || autoGran(r);
      const list = ACTS.filter((a) => inR(a.date, r) && a[k] != null && typeof a[k] === "number" && (!spec.sport || a.sport === spec.sport) && srcOk(a));
      setHead(`${label(fk)}${spec.sport ? " · " + tx.sports[spec.sport] : ""}`, what(fk));
      if (!list.length) return body(`${scopeSeg(spec)}<div class="empty">${esc(tx.noData)}</div>`);
      const valsK = list.map((a) => a[k]);
      const maxA = list.reduce((x, y) => (y[k] > x[k] ? y : x)), minA = list.reduce((x, y) => (y[k] < x[k] ? y : x));
      const marked = spec.mark && ACT_BY_ID.get(spec.mark);
      body(`<div class="panel-controls">${scopeSeg(spec)}${granSeg(spec, r)}</div>
        ${statTiles([
          marked && marked[k] != null ? [tx.thisActivity, esc(fv(fk, marked[k])), dayYearLabel(marked.date)] : null,
          [tx.stat.avg, esc(fv(fk, mean(valsK)))],
          [tx.stat.max, esc(fv(fk, maxA[k])), dayYearLabel(maxA.date), { kind: "activity", id: String(maxA.id) }],
          [tx.stat.min, esc(fv(fk, minA[k])), dayYearLabel(minA.date), { kind: "activity", id: String(minA.id) }],
          [tx.stat.nActs, nf(list.length)],
        ])}
        <div class="chart"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-rows")}</div><div id="p-rows" class="table-wrap"></div>`);
      timeChart("p-chart", label(fk), bucketize(list, r, gran, (a) => a[k], "avg"), (v) => fv(fk, v), { color: spec.sport ? sportColor(spec.sport) : css("--s1"), onPick: (key, b) => openPanel({ ...spec, from: key, to: b.end(key), gran: "day", whole: false }, true) });
      dataTable($("p-rows"), "p-rows", list, [{ k: "start", label: tx.date, f: (a) => esc(dayYearLabel(a.date)) }, { k: "name", label: tx.activity, cls: "left name", f: (a) => `${esc(a.name)}${marked && a === marked ? " ◀" : ""}` }, { k: fk, v: (a) => a[k], f: (a) => esc(fv(fk, a[k])) }], { sort: ["start", -1], keepSort: false, onRow: (a) => openPanel({ kind: "activity", id: String(a.id) }, true) });
    },

    /** One calendar day: every metric and every activity. */
    day(spec) {
      const tx = t(), d = DAYS[DIDX.get(spec.date)] || { date: spec.date };
      const when = new Date(spec.date + "T12:00:00").toLocaleDateString(state.lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      setHead(cap(when));
      const acts = ACTS.filter((a) => a.date === spec.date);
      const metrics = Object.keys(d).filter((k) => k !== "date" && d[k] != null).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      body(`<div class="panel-section"><h3>${esc(tx.dayActs)}</h3></div><div id="p-acts" class="table-wrap"></div>
        <div class="panel-section"><h3>${esc(tx.dayMetrics)}</h3><span class="muted small">${esc(tx.fieldsHint.replace(es() ? "tus actividades" : "your activities", es() ? "el tiempo" : "time"))}</span></div>
        <dl class="kv-grid">${metrics.map((k) => `<div class="kv-row clickable"${op({ kind: "metric", m: k, from: addDays(spec.date, -45), to: addDays(spec.date, 45) < TODAY ? addDays(spec.date, 45) : TODAY })}><dt>${esc(label(k))}</dt><dd>${esc(fv(k, d[k]))}</dd></div>`).join("") || `<div class="empty">${esc(tx.noData)}</div>`}</dl>`);
      if (acts.length) dataTable($("p-acts"), "p-acts", acts, actCols(), { onRow: (a) => openPanel({ kind: "activity", id: String(a.id) }, true) });
      else $("p-acts").innerHTML = `<div class="empty">${esc(tx.noActs)}</div>`;
    },

    /** VO₂ max, weight, endurance. */
    series(spec) {
      const tx = t(), s = seriesDef(spec.name), r = specRange(spec);
      const rows = s.rows.filter((x) => inR(x.date, r));
      setHead(s.title, s.what);
      const k = s.key;
      body(`<div class="panel-controls">${scopeSeg(spec)}</div>
        ${rows.length ? statTiles([[tx.stat.last, `${nf(rows[rows.length - 1][k], 1)} ${s.unit}`, dayYearLabel(rows[rows.length - 1].date)], [tx.stat.max, `${nf(Math.max(...rows.map((x) => x[k])), 1)} ${s.unit}`], [tx.stat.min, `${nf(Math.min(...rows.map((x) => x[k])), 1)} ${s.unit}`], [tx.stat.n, nf(rows.length)]]) : ""}
        <div class="chart"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-rows")}</div><div id="p-rows" class="table-wrap"></div>`);
      if (!rows.length) return emptyChart("p-chart");
      chart("p-chart", {
        data: { labels: rows.map((x) => x.date), datasets: [line(s.title, rows.map((x) => x[k]), css("--s1"), { stepped: !!s.stepped, tension: 0, pointRadius: rows.length < 80 ? 2.5 : 0 })] },
        options: { plugins: { tooltip: { callbacks: { title: (it) => dayYearLabel(it[0].label), label: (c) => `${nf(c.raw, 1)} ${s.unit}` } } }, scales: { x: { ticks: { maxTicksLimit: 6, callback(v) { return monthLabel(this.getLabelForValue(v).slice(0, 7)); } } }, y: { beginAtZero: false } } },
      });
      dataTable($("p-rows"), "p-rows", rows, keysOf(rows).map((c) => ({ k: c === "value" ? "value" : c })), { sort: ["date", -1], keepSort: false });
    },

    /** A finding: the scatter of every day behind it. */
    finding(spec) {
      const tx = t(), r = specRange(spec);
      const p = pairStats(spec.x, spec.y, spec.lag, r);
      if (!p) { setHead(`${label(spec.x)} → ${label(spec.y)}`); return body(`${scopeSeg(spec)}<div class="empty">${esc(tx.noFindings)}</div>`); }
      const { title } = findingTexts(p);
      setHead(title, tx.scatterSub(nf(p.n), nf(p.r, 2)) + (spec.lag ? " " + tx.lagNote : ""));
      body(`<div class="panel-controls">${scopeSeg(spec)}</div>
        ${statTiles([[label(spec.x), `${esc(fmt(spec.x, p.loCut))} → ${esc(fmt(spec.x, p.hiCut))}`], [`${label(spec.y)} ↑`, esc(fv(spec.y, Math.max(p.hiMean, p.loMean)))], [`${label(spec.y)} ↓`, esc(fv(spec.y, Math.min(p.hiMean, p.loMean)))], ["r", nf(p.r, 2)], ["p", p.p < 0.001 ? "< 0,001" : nf(p.p, 3)]])}
        <div class="chart tall"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-rows")}</div><div id="p-rows" class="table-wrap"></div>`);
      const xs = p.pts.map((q) => q.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const ys = p.pts.map((q) => q.y), y0 = Math.min(...ys), y1 = Math.max(...ys), yPad = (y1 - y0) * 0.06 || 1;
      chart("p-chart", {
        type: "scatter",
        data: { datasets: [
          { type: "scatter", label: tx.value, data: p.pts.map((q) => ({ x: q.x, y: q.y, date: q.date })), backgroundColor: alpha(css("--s1"), 0.45), pointRadius: 3, pointHoverRadius: 5 },
          { type: "line", label: "", data: [{ x: x0, y: p.intercept + p.slope * x0 }, { x: x1, y: p.intercept + p.slope * x1 }], borderColor: css("--s2"), borderWidth: 2, pointRadius: 0 },
        ] },
        options: {
          interaction: { mode: "nearest", intersect: true },
          plugins: { tooltip: { filter: (it) => it.datasetIndex === 0, callbacks: { title: (it) => dayYearLabel(it[0].raw.date), label: (c) => `${label(spec.x)}: ${fv(spec.x, c.raw.x)} · ${label(spec.y)}: ${fv(spec.y, c.raw.y)}` } } },
          scales: { x: { type: "linear", title: { display: true, text: label(spec.x), color: css("--muted") }, ticks: { callback: (v) => fmt(spec.x, v) } }, y: { beginAtZero: false, min: y0 - yPad, max: y1 + yPad, title: { display: true, text: label(spec.y), color: css("--muted") }, ticks: { callback: (v) => fmt(spec.y, v) } } },
        },
      }, (di, i) => { if (di === 0) openPanel({ kind: "day", date: p.pts[i].date }, true); });
      const rows = p.pts.map((q) => ({ date: q.date, [spec.x]: q.x, ydate: q.ydate, [`y_${spec.y}`]: q.y }));
      dataTable($("p-rows"), "p-rows", rows, [{ k: "date", f: (q) => esc(dayYearLabel(q.date)) }, { k: spec.x }, ...(spec.lag ? [{ k: "ydate", label: `${tx.date} (+${spec.lag})`, f: (q) => esc(dayYearLabel(q.ydate)) }] : []), { k: `y_${spec.y}`, label: label(spec.y), f: (q) => esc(fv(spec.y, q[`y_${spec.y}`])) }], { sort: ["date", -1], keepSort: false, onRow: (q) => openPanel({ kind: "day", date: q.date }, true) });
    },

    /** A running distance: every effort, and the best-to-date line. */
    best(spec) {
      const tx = t(), r = specRange(spec), name = spec.name;
      const list = ACTS.filter((a) => inR(a.date, r) && a.best && a.best[name] && srcOk(a));
      setHead(`${tx.bestEfforts} · ${name}`, "");
      if (!list.length) return body(`${scopeSeg(spec)}<div class="empty">${esc(tx.noData)}</div>`);
      const top = list.reduce((x, y) => (y.best[name][0] < x.best[name][0] ? y : x));
      body(`<div class="panel-controls">${scopeSeg(spec)}</div>
        ${statTiles([[tx.stat.best, secs(top.best[name][0]), dayYearLabel(top.date), { kind: "activity", id: String(top.id) }], [tx.pace, paceOf(top.best[name][0] / (BEST_METERS[name] / 1000))], [tx.stat.nActs, nf(list.length)]])}
        <div class="legend" id="p-legend"></div><div class="chart"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-rows")}</div><div id="p-rows" class="table-wrap"></div>`);
      let bestSoFar = Infinity;
      const prog = list.map((a) => (bestSoFar = Math.min(bestSoFar, a.best[name][0])));
      const c1 = css("--s2"), c2 = css("--s1");
      legend("p-legend", [[tx.eachEffort, c1], [tx.progression, c2, "line"]]);
      chart("p-chart", {
        data: { labels: list.map((a) => a.date), datasets: [
          { type: "scatter", label: tx.eachEffort, data: list.map((a) => a.best[name][0]), backgroundColor: alpha(c1, 0.6), pointRadius: 3.5 },
          line(tx.progression, prog, c2, { stepped: true, tension: 0 }),
        ] },
        options: { plugins: { tooltip: { callbacks: { title: (it) => dayYearLabel(it[0].label), label: (c) => `${c.dataset.label}: ${secs(c.raw)}` } } }, scales: { x: { ticks: { maxTicksLimit: 6, callback(v) { return monthLabel(this.getLabelForValue(v).slice(0, 7)); } } }, y: { beginAtZero: false, reverse: true, ticks: { callback: (v) => secs(v) } } } },
      }, (di, i) => openPanel({ kind: "activity", id: String(list[i].id) }, true));
      const rows = list.map((a) => ({ _id: a.id, date: a.date, activity: a.name, time: a.best[name][0], pace: a.best[name][0] / (BEST_METERS[name] / 1000), prRank: a.best[name][1] ?? null }));
      dataTable($("p-rows"), "p-rows", rows, [{ k: "date", f: (q) => esc(dayYearLabel(q.date)) }, { k: "activity", cls: "left" }, { k: "time" }, { k: "pace" }, { k: "prRank" }], { sort: ["time", 1], keepSort: false, onRow: (q) => openPanel({ kind: "activity", id: String(q._id) }, true) });
    },

    /** Time in one zone: when and in which activities. */
    zone(spec) {
      const tx = t(), r = specRange(spec), gran = spec.gran || autoGran(r);
      const { key, names } = zoneDefs(spec.src);
      const list = actsIn(r).filter((a) => a[key] && a[key][spec.i]);
      const minutes = (a) => a[key][spec.i];
      setHead(`${names[spec.i][0]} · ${names[spec.i][1]}`, tx.zonesSub[spec.src]);
      body(`<div class="panel-controls">${scopeSeg(spec)}${granSeg(spec, r)}</div>
        ${statTiles([[tx.stat.total, dur(sum(list.map(minutes)))], [tx.stat.nActs, nf(list.length)]])}
        <div class="chart"><canvas id="p-chart"></canvas></div>
        <div class="panel-section"><h3>${esc(tx.usedData)}</h3>${csvButton("p-rows")}</div><div id="p-rows" class="table-wrap"></div>`);
      timeChart("p-chart", names[spec.i][0], bucketize(list, r, gran, minutes, "sum"), (v) => dur(v), { bar: true });
      dataTable($("p-rows"), "p-rows", list, [{ k: "start", label: tx.date, f: (a) => esc(dayYearLabel(a.date)) }, { k: "name", label: tx.activity, cls: "left name" }, { k: "zmin", label: names[spec.i][0], v: minutes, f: (a) => esc(dur(minutes(a))) }, { k: "min", label: tx.duration }], { sort: ["zmin", -1], keepSort: false, onRow: (a) => openPanel({ kind: "activity", id: String(a.id) }, true) });
    },

    /** A bike or pair of shoes: kilometres over time and where they went. */
    gear(spec) {
      const g = ((STRAVA && STRAVA.gear) || []).find((x) => x.id === spec.id) || { name: spec.id };
      PANELS.acts({ ...spec, kind: "acts", gear: spec.id, measure: spec.measure || "km", title: `${g.kind === "bike" ? "🚲" : "👟"} ${g.name}` });
      $("panel-kicker").textContent = t().panel.gear;
    },
  };

  // ---------------------------------------------------------------- routing
  const RENDER = { overview: renderOverview, training: renderTraining, health: renderHealth, history: renderHistory, activities: renderActivities, data: renderData };
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
    if (panel.stack.length) showPanel();
  }

  function toast(msg, ms = 3000) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    if (ms) toast.timer = setTimeout(() => { el.hidden = true; }, ms);
  }

  function saveFilters() {
    store.set("preset", state.preset);
    store.set("from", state.from);
    store.set("to", state.to);
    store.set("sports", [...state.sports].join(","));
    store.set("src", state.src);
  }
  function filtersChanged() { saveFilters(); render(); }

  document.addEventListener("click", (e) => {
    const inPanel = !!e.target.closest("#panel");
    const opener = e.target.closest("[data-open]");
    if (opener) { openPanel(JSON.parse(opener.dataset.open), inPanel); return; }
    const day = e.target.closest("rect.day");
    if (day) { openPanel({ kind: "day", date: day.dataset.day }, inPanel); return; }
    const el = e.target.closest("[data-tab],[data-cum],[data-zsrc],[data-sport],[data-tsort],[data-tpage],[data-trow],[data-pset],[data-csv],[data-strava-hide],[data-strava-disconnect]");
    if (!el) return;
    const d = el.dataset;
    if (d.tab && el.classList.contains("tab")) { state.tab = d.tab; store.set("tab", state.tab); history.replaceState(null, "", "#" + state.tab); closePanel(); render(); window.scrollTo({ top: 0 }); }
    else if (d.cum) { state.cumMetric = d.cum; renderHistory(); }
    else if (d.zsrc) { state.zoneSrc = d.zsrc; store.set("zoneSrc", d.zsrc); renderTraining(); }
    else if (d.sport !== undefined) {
      if (!d.sport) state.sports.clear();
      else if (state.sports.has(d.sport)) state.sports.delete(d.sport);
      else state.sports.add(d.sport);
      filtersChanged();
    } else if (d.tsort) {
      const [id, k] = d.tsort.split("|"), tb = TABLES[id];
      tb.sort = [k, tb.sort && tb.sort[0] === k ? -tb.sort[1] : -1];
      tb.page = 0;
      drawTable(id);
    } else if (d.tpage) { const [id, n] = d.tpage.split("|"); TABLES[id].page += +n; drawTable(id); }
    else if (d.trow) { const [id, i] = d.trow.split("|"), tb = TABLES[id]; if (tb.onRow) tb.onRow(tb.sorted[+i]); }
    else if (d.pset) {
      const [k, v] = d.pset.split("|"), spec = panel.stack[panel.stack.length - 1];
      spec[k] = JSON.parse(v);
      showPanel();
    } else if (d.csv) {
      const tb = TABLES[d.csv];
      if (tb) downloadCsv(d.csv.replace(/^p-/, ""), tb.sorted || tb.rows, tb.columns);
    } else if (d.stravaHide !== undefined) { store.set("stravaHide", "1"); renderOverview(); }
    else if (d.stravaDisconnect !== undefined) {
      fetch("api/strava/disconnect", { method: "POST" }).then(() => { toast(t().disconnected); setTimeout(() => location.reload(), 600); });
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.stack.length) closePanel();
    if (e.key === "Enter" && e.target.matches && e.target.matches("[data-open],[data-trow]")) e.target.click();
  });
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-strava-form]");
    if (!form) return;
    e.preventDefault();
    const err = form.querySelector(".form-error");
    err.hidden = true;
    try {
      const res = await fetch("api/strava/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: form.client_id.value, client_secret: form.client_secret.value }) });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || res.statusText);
      location.href = out.url;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  $("panel-close").addEventListener("click", closePanel);
  $("scrim").addEventListener("click", closePanel);
  $("panel-back").addEventListener("click", () => { panel.stack.pop(); showPanel(); });
  $("preset").addEventListener("change", (e) => {
    state.preset = e.target.value;
    if (state.preset === "custom" && !state.from) { [state.from, state.to] = [$("from").value, $("to").value]; }
    filtersChanged();
  });
  const onDate = () => {
    state.preset = "custom";
    state.from = $("from").value || FIRST;
    state.to = $("to").value || TODAY;
    filtersChanged();
  };
  $("from").addEventListener("change", onDate);
  $("to").addEventListener("change", onDate);
  $("src").addEventListener("change", (e) => { state.src = e.target.value; filtersChanged(); });
  $("filters-reset").addEventListener("click", () => { state.sports.clear(); state.src = "all"; filtersChanged(); });
  $("lang-btn").addEventListener("click", () => { state.lang = es() ? "en" : "es"; store.set("lang", state.lang); render(); });
  $("theme-btn").addEventListener("click", () => {
    state.theme = { auto: "dark", dark: "light", light: "auto" }[state.theme];
    store.set("theme", state.theme);
    render();
  });
  $("act-search").addEventListener("input", renderActivities);
  $("data-set").addEventListener("change", (e) => { state.dataSet = e.target.value; store.set("dataSet", state.dataSet); renderData(); });
  $("data-search").addEventListener("input", renderData);
  $("data-cols-menu").addEventListener("change", () => {
    const chosen = [...$("data-cols-menu").querySelectorAll("input:checked")].map((i) => i.dataset.col);
    store.set(`cols.${state.dataSet}`, chosen.join(","));
    renderData();
    $("data-cols").open = true;
  });
  $("data-csv").addEventListener("click", () => { const d = TABLES.dataCsv; if (d) downloadCsv(d.name, (TABLES.data && TABLES.data.sorted) || d.rows, d.columns); });
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
      ? (st.total ? `${st.source === "strava" ? "Strava · " : ""}${tx.syncing} ${pct}%` : tx.preparing)
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
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || res.statusText);
      applyStatus(out);
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
  const params = new URLSearchParams(location.search);
  if (params.get("strava") === "connected") {
    toast(t().stravaConnected, 5000);
    params.delete("strava");
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "") + location.hash);
  }
  if (LIVE) {
    if (AUTOSYNC) startSync(true);
    else poll(); // show the last sync's result (and follow one already running)
  }
})();
