# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-10-22

The project is now **Pulso**: the repository is `scortes5/pulso` (GitHub redirects the old `scortes5/garmin-connect-mcp` URL), the Python package is `pulso` and the command is `pulso` (`pulso auth`, `pulso dashboard`, …).

### Breaking

- The `garmin-connect-mcp` command is now `pulso`, and the module `garmin_connect_mcp` is now `pulso`. Update MCP client configurations (`"command": "pulso"` or `uvx --from git+https://github.com/scortes5/pulso pulso`) and re-run `pulso dashboard install-app` on macOS so Pulso.app launches the new module. Garmin tokens (`~/.garminconnect`) and dashboard data (`~/.garmin-dashboard`) stay where they are.

### Added

- **Strava** in the dashboard: connect from the app (*Connect Strava* card) or with `garmin-connect-mcp dashboard strava` using your own Strava API application. It syncs after Garmin on every open: your heart-rate and power zones and the time in them per activity, running best efforts with PR ranks, per-km splits, segments, laps, relative effort, kudos, device, gear and gear mileage, plus activities recorded outside Garmin. Garmin uploads are enriched, never counted twice. Downloads stay under Strava's rate limits and resume on the next sync; maps, coordinates and identity are stripped before caching. `--disconnect` forgets the tokens
- A filter bar for every view: period presets (30/90 days, 12 months, this year, each year, all), any custom date range, sports and source (Garmin/Strava)
- Click-through side panel on every number, card, chart bar, zone, calendar day, record, finding and table row: its history by day, week or month (chosen period or all history), and the exact rows it was computed from, with CSV export. Activities show every Garmin and Strava field, zones, a power curve against your best of the period, splits, segments, laps and best efforts; any value opens how it varied across that sport
- **Data** tab: every dataset as a table (daily metrics, activities, zones, best efforts, splits, segments, laps, best power, VO₂ max, weight, endurance, gear) with column picker, search, data dictionary and CSV download
- Training: Strava heart-rate and power zones, best running times and gear cards; Recovery: breathing, pulse ox, relative effort and endurance score cards
- `make dashboard/strava`; the demo includes a simulated Strava account

### Changed

- Findings are recomputed in the page for the selected period instead of only the precomputed scopes
- The sport filter in the Activities tab moved to the global filter bar

## [1.3.0] - 2026-10-22

### Changed

- `garmin-connect-mcp dashboard` now opens the dashboard as a local app: the page loads instantly from the cache and syncs with Garmin in the background, with live progress in the top bar, then refreshes itself with the new data. The old write-a-file behaviour is `--static` (or `--output FILE`); `--serve` is accepted but no longer needed
- First run shows a progress screen per data source instead of an empty page; sync failures (e.g. expired login) are shown in a banner while saved data stays visible
- The local server no longer shuts down while a sync is running
- Cache files are written atomically
- The app is now called **Pulso**, with its own icon (`assets/icon.svg` → `icon.icns`) in the macOS bundle, page header and favicon
- Dashboard redesigned for readability: five sections instead of eight (Summary, Training, Recovery & sleep, Year by year, Activities); a headline sentence and a "How are you doing lately?" check against your own normal range; findings written as plain sentences instead of r/ρ/p values; one explanation line per metric; no dual-axis charts, no correlation matrix, no CTL/ATL/TSB/ACWR jargon; a colour-vision-safe palette with separate light and dark steps
- `--window` opens it as a standalone app window (Chrome, Edge or Brave) with a private browser profile; the macOS app uses it

## [1.2.0] - 2026-10-22

### Added

- `garmin-connect-mcp dashboard`: downloads your whole Garmin history into a private local cache and opens a self-contained HTML dashboard (overview, training, recovery, sleep, fitness, year-over-year, correlations, activities) with a period selector for the last 12 months, each year or all history
- Incremental sync: past windows are cached once; only the last 7 days and new data are fetched again
- Correlation engine: matrix of 18 daily metrics plus 24 lagged hypotheses (e.g. training load → next-night HRV) with Pearson r, Spearman ρ, p-value and quartile comparisons, per year
- `dashboard --serve`: local server bound to 127.0.0.1 with an in-page sync button and idle shutdown
- `dashboard install-app`: double-clickable macOS app
- `dashboard --demo`: synthetic data through the real pipeline, no account needed
- Spanish/English UI, light/dark theme, works offline (Chart.js 4.4.1 vendored, MIT)
- `docs/ARCHITECTURE.md`

### Fixed

- `__version__` now matches the package version

## [1.1.0] - 2026-10-22

Fork of eddmann/garmin-connect-mcp maintained at scortes5/garmin-connect-mcp.

### Added

- `get_activity_streams`: chart-ready, downsampled activity time-series; GPS opt-in
- `get_fitness_thresholds`: lactate threshold, cycling FTP, race predictions, running tolerance
- `export_activity_file`: save original FIT (or GPX/TCX/CSV) locally with `0600` permissions
- `auth --save-password` flag

### Changed

- Password is no longer stored by default and is read with a hidden prompt
- Server runs with saved tokens only; credential/token files written `0600`
- One Garmin login per server process instead of per tool call; reset on auth errors
- `userRoles` and profile image URLs stripped from all responses
- `garmin://training/readiness` returns real readiness, Body Battery, HRV and training status
- `get_performance_metrics` reports per-metric failures in `analysis.errors`
- Splits resolve time-series columns from metric descriptors
- Require `garminconnect>=0.3.19`

### Fixed

- `get_training_effect` called a non-existent method; now derived from the activity
- Fitness age always `null` (wrong method name)
- `manage_workouts` `get` action called a non-existent method

### Removed

- `get_activity_social`: no backing Garmin endpoint; it always errored
- PyPI/GHCR release workflow (belongs to upstream)

## [1.0.1] - 2026-05-19

### Changed

- Document published `uvx garmin-connect-mcp` usage as the primary setup path
- Simplify Claude Desktop configuration for published `uvx` usage
- Store interactive setup credentials in `~/.garminconnect.env` by default

## [1.0.0] - 2026-05-19

### Added

- Initial Garmin Connect MCP server release
- Garmin Connect activity, health, training, profile, device, gear, weight, workout, and women's health tools
- MCP resources for athlete profile, training readiness, and daily health context
- MCP prompts for training analysis, sleep quality, readiness checks, activity analysis, run comparison, and health summaries
- `garmin-connect-mcp` server entrypoint
- `garmin-connect-mcp auth` interactive authentication setup with MFA token persistence
- Docker image support via GitHub Container Registry

[1.2.0]: https://github.com/scortes5/pulso/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/scortes5/pulso/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/eddmann/garmin-connect-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/eddmann/garmin-connect-mcp/releases/tag/v1.0.0
