# Garmin Connect MCP Server

![Garmin Connect MCP Server](docs/heading.png)

A Model Context Protocol (MCP) server for Garmin Connect integration. Access your activities, health data, training metrics, and more through Claude and other LLMs.

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Fork of [eddmann/garmin-connect-mcp](https://github.com/eddmann/garmin-connect-mcp)** (MIT, © Edd Mann).
> This fork fixes tools that were calling non-existent Garmin methods, adds raw-data tools
> for building dashboards (activity time-series, thresholds/FTP, FIT export), and hardens how
> credentials and personal data are handled. See [What this fork changes](#what-this-fork-changes).

## What this fork changes

**Fixes (these tools failed or silently returned nothing upstream)**

- `get_training_effect` – Garmin has no such endpoint; now read from the activity itself (aerobic/anaerobic TE, label, training load, HR time in zones)
- `get_performance_metrics` – fitness age always came back `null` (wrong method name); failures per metric are now reported in `analysis.errors` instead of hidden
- `manage_workouts` `get` action – called a non-existent method
- `get_activity_social` – removed: the Garmin library exposes no social endpoint, so it could never work
- `garmin://training/readiness` resource – returned generic daily stats; now returns training readiness, morning readiness, Body Battery, HRV and training status
- Accurate km/mile splits now locate columns via Garmin's metric descriptors instead of hard-coded positions

**New tools**

| Tool                     | Description                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `get_activity_streams`   | Chart-ready time-series (HR, power, pace/speed, cadence, elevation, temperature), downsampled   |
| `get_fitness_thresholds` | Lactate threshold, cycling FTP, race predictions and running tolerance                          |
| `export_activity_file`   | Save the original `.fit` (or GPX/TCX/CSV) to a local folder – includes fields Garmin's partner API strips |

**Privacy & reliability**

- Password is **not stored by default**: `auth` uses it once to mint OAuth tokens (opt in with `auth --save-password`); it is read with a hidden prompt
- Server runs on saved tokens alone; credential files and token exports are written `0600`
- GPS coordinates are excluded from streams unless explicitly requested (start/end points reveal where you live)
- OAuth scopes (`userRoles`) and profile-photo URLs are stripped from every response
- One login per server process instead of one per tool call (fewer requests, fewer rate-limit/bot challenges); the session is dropped and re-created on auth errors
- `garminconnect` upgraded to 0.3.19 (curl_cffi-based login that survives Garmin's 2026 Cloudflare changes)

## Overview

This MCP server provides 24 tools to interact with your Garmin Connect account, organized into 8 categories:

- Activities (2 tools) - Query activities and view detailed metrics
- Raw Performance Data (3 tools) - Time-series streams, thresholds/FTP, FIT export
- Analysis (2 tools) - Compare activities and find similar workouts
- Health & Wellness (4 tools) - Access health metrics, sleep, heart rate, and activity data
- Training (3 tools) - Analyze training periods and performance trends
- User Profile (1 tool) - Access profile, statistics, and personal records
- Challenges & Goals (2 tools) - Track goals, PRs, badges, and challenges
- Devices & Gear (2 tools) - Manage devices and equipment
- Weight Management (2 tools) - Track weight data
- Other (3 tools) - Workouts, manual data entry, women's health tracking

Additionally, the server provides:

- 3 MCP Resources - Athlete profile, training readiness, and daily health for ongoing context
- 6 MCP Prompts - Templates for common queries (training analysis, sleep quality, readiness checks, activity analysis, run comparison, health summary)

## Prerequisites

- [uv](https://github.com/astral-sh/uv) (the package requires Python 3.12+, which uv can manage), OR
- Docker

## Installation & Setup

### How Authentication Works

1. Credential Authentication - Run the setup command to save credentials
2. MFA Support - If MFA is enabled, the setup command prompts for your code
3. Token Storage - OAuth tokens saved to `~/.garminconnect/` and automatically refreshed
4. Persistence - Tokens persist across runs (UV on host, Docker requires volume mount)

### Option 1: Using uvx

```bash
uvx --from git+https://github.com/scortes5/garmin-connect-mcp garmin-connect-mcp auth
```

This prompts for your email and password (hidden), completes Garmin authentication (including MFA)
and saves OAuth tokens under `~/.garminconnect/`. Only the email is written to
`~/.garminconnect.env` (mode `0600`); the password is discarded once tokens exist.

Add `--save-password` if you want the server to be able to log in again by itself when the
tokens are revoked (it is then stored in `~/.garminconnect.env`, mode `0600`).

### Option 2: Using Docker

```bash
# Build the image locally
git clone https://github.com/scortes5/garmin-connect-mcp && cd garmin-connect-mcp
docker build -t garmin-connect-mcp:latest .
```

Then configure credentials using one of these methods:

#### Interactive Setup

```bash
# Create the env file first (Docker will create it as a directory if it doesn't exist)
touch garmin-connect-mcp.env

# Run the setup script and persist generated tokens
docker run -it --rm \
  -v "/ABSOLUTE/PATH/TO/garmin-connect-mcp.env:/app/.env" \
  -v "/ABSOLUTE/PATH/TO/.garminconnect-docker:/root/.garminconnect" \
  garmin-connect-mcp:latest \
  auth
```

This will prompt for your credentials, complete Garmin authentication, and save credentials to
`garmin-connect-mcp.env`. If you have MFA enabled, enter the code during this setup step.

#### Manual Setup

Create a `garmin-connect-mcp.env` file manually in your current directory:

```bash
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password
```

#### MFA Support for Docker

If you have MFA enabled on your Garmin account:

- Run the interactive setup command with `-it` so you can enter your MFA code
- The MCP server should then use saved tokens and should not prompt during runtime
- **Important**: Without token persistence, you'll need to authenticate again on every container restart
- **Recommended**: Mount the token directory as a volume during setup and server runs to persist tokens

To persist tokens across Docker runs, create a directory for tokens and mount it:

```bash
# Create token directory on host
mkdir -p ~/.garminconnect-docker

# Then use this directory in your Docker configuration (see Claude Desktop Configuration below)
```

## Claude Desktop Configuration

Add to your configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Using uvx

After running the `auth` command above, configure Claude Desktop to start this fork:

```json
{
  "mcpServers": {
    "garmin": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/scortes5/garmin-connect-mcp", "garmin-connect-mcp"]
    }
  }
}
```

### Using Local Source

For development, run from a local checkout:

```bash
cd garmin-connect-mcp
uv sync
uv run garmin-connect-mcp auth
```

```json
{
  "mcpServers": {
    "garmin": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/ABSOLUTE/PATH/TO/garmin-connect-mcp",
        "garmin-connect-mcp"
      ]
    }
  }
}
```

### Using Docker

#### Without Token Persistence (MFA required on every restart)

```json
{
  "mcpServers": {
    "garmin": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/ABSOLUTE/PATH/TO/garmin-connect-mcp.env:/app/.env",
        "garmin-connect-mcp:latest"
      ]
    }
  }
}
```

#### With Token Persistence (Recommended for MFA users)

```json
{
  "mcpServers": {
    "garmin": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/ABSOLUTE/PATH/TO/garmin-connect-mcp.env:/app/.env",
        "-v",
        "/ABSOLUTE/PATH/TO/.garminconnect-docker:/root/.garminconnect",
        "garmin-connect-mcp:latest"
      ]
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/.garminconnect-docker` with the absolute path to your token directory. On Windows, use something like `C:\\Users\\YOUR_USERNAME\\.garminconnect-docker`.

## Usage

Ask Claude to interact with your Garmin data using natural language. The server provides tools, resources, and prompt templates to help you get started.

### Quick Start with MCP Prompts

Use built-in prompt templates for common queries (available via prompt suggestions in Claude):

- `analyze_recent_training` - Analyze my training over the past 30 days
- `sleep_quality_report` - Analyze sleep quality with recommendations
- `training_readiness_check` - Check if I'm ready to train hard today
- `activity_deep_dive` - Deep dive into a specific activity
- `compare_recent_runs` - Compare recent runs to track progress
- `health_summary` - Show comprehensive health overview

### Activities

```
"Show me my runs from the last 30 days"
"Get details for my half marathon yesterday including splits and heart rate zones"
"Chart heart rate and power for my last ride"
"Export the original FIT file of yesterday's long run"
```

### Training Analysis

```
"Analyze my training over the past 30 days"
"Compare my last three 10K runs"
"Find runs similar to my tempo workout from last week"
```

### Health & Wellness

```
"How did I sleep last night?"
"What's my Body Battery level today?"
"Show me my stress levels and recovery status"
"Am I ready to train hard today?"
```

_Note: The athlete profile resource (`garmin://athlete/profile`) and daily health resource (`garmin://health/today`) automatically provide ongoing context._

### Performance Metrics

```
"What's my VO2 max trend?"
"Show me my training readiness and recent stats"
```

_Note: List-returning tools use cursor-based pagination with default limits (10 items for activities, 7 for health data)._

## Available Tools

### Activities (2 tools)

| Tool                   | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `query_activities`     | Query activities with pagination (by ID, date range, or specific date) |
| `get_activity_details` | Get comprehensive activity details (splits, weather, HR zones, gear)   |

### Raw Performance Data (3 tools)

| Tool                     | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `get_activity_streams`   | Downsampled time-series columns; GPS only with `include_gps=true`           |
| `get_fitness_thresholds` | Lactate threshold, cycling FTP, race predictions, running tolerance         |
| `export_activity_file`   | Write `.fit`/`.gpx`/`.tcx`/`.csv` to `$GARMIN_EXPORT_DIR` (`~/GarminExports`) |

### Analysis (2 tools)

| Tool                      | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `compare_activities`      | Compare 2-5 activities side-by-side             |
| `find_similar_activities` | Find activities similar to a reference activity |

### Health & Wellness (4 tools)

| Tool                     | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `query_health_summary`   | Query daily health summaries with pagination (stats, readiness, Body Battery) |
| `query_sleep_data`       | Query sleep data with stages, scores, and HRV                                 |
| `query_heart_rate_data`  | Query heart rate data with resting HR                                         |
| `query_activity_metrics` | Query activity metrics (steps, stress, respiration, SpO2, etc.)               |

### Training (3 tools)

| Tool                      | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `analyze_training_period` | Analyze training over a time period with insights                   |
| `get_performance_metrics` | Get performance metrics (VO2 max, hill score, endurance, HRV, etc.) |
| `get_training_effect`     | Get training effect and progress summary                            |

### User Profile (1 tool)

| Tool               | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `get_user_profile` | Get comprehensive athlete profile with stats and PRs |

### Challenges & Goals (2 tools)

| Tool                      | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `query_goals_and_records` | Query goals, personal records, and race predictions |
| `query_challenges`        | Query challenges and badges (by status and type)    |

### Devices & Gear (2 tools)

| Tool            | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `query_devices` | Query device information (with settings, solar data, alarms) |
| `query_gear`    | Query gear and equipment (with defaults and usage stats)     |

### Weight Management (2 tools)

| Tool                 | Description                         |
| -------------------- | ----------------------------------- |
| `query_weight_data`  | Query weight data for date or range |
| `manage_weight_data` | Add or delete weight entries        |

### Other (3 tools)

| Tool                  | Description                                      |
| --------------------- | ------------------------------------------------ |
| `manage_workouts`     | Workout management (list, get, download, upload) |
| `log_health_data`     | Log body composition, blood pressure, hydration  |
| `query_womens_health` | Query pregnancy and menstrual cycle data         |

## MCP Resources

Resources provide ongoing context to the LLM without requiring explicit tool calls:

| Resource                      | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `garmin://athlete/profile`    | Athlete profile with stats, zones, and PRs         |
| `garmin://training/readiness` | Current training readiness and Body Battery        |
| `garmin://health/today`       | Today's health snapshot (steps, sleep, stress, HR) |

## MCP Prompts

Prompt templates for common queries (accessible via prompt suggestion in Claude):

| Prompt                     | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `analyze_recent_training`  | Analyze training over a specified period            |
| `sleep_quality_report`     | Sleep quality analysis with recommendations         |
| `training_readiness_check` | Check if ready to train hard today                  |
| `activity_deep_dive`       | Deep dive into a specific activity with all metrics |
| `compare_recent_runs`      | Compare recent runs to identify trends              |
| `health_summary`           | Comprehensive health overview                       |

## License

MIT License - see [LICENSE](LICENSE) file for details

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Garmin Ltd. or any of its affiliates. All product names, logos, and brands are property of their respective owners.
