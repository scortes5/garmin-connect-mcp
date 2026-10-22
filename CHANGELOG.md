# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/scortes5/garmin-connect-mcp/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/eddmann/garmin-connect-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/eddmann/garmin-connect-mcp/releases/tag/v1.0.0
