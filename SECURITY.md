# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/scortes5/pulso/security/advisories/new)
instead. You will get an answer within a few days.

Never include real Garmin tokens, passwords, exported `.fit`/`.gpx` files or
personal activity data in a report. Made-up data is enough to reproduce a bug.

## What this project protects

- Garmin OAuth tokens (`~/.garminconnect/`, `~/.garminconnect_base64`) — written `0600`
- Credentials file (`~/.garminconnect.env`) — `0600`; the password is only stored with `auth --save-password`
- Exported activity files — `0600` in `$GARMIN_EXPORT_DIR`
- Dashboard data (`~/.garmin-dashboard/`) — folders `0700`, files `0600`; identity, maps and coordinates are stripped from Garmin and Strava activities before they are written
- Strava tokens and your Strava API client secret (`~/.garmin-dashboard/strava.json`) — `0600`; the OAuth `state` is checked on the callback, and the local app only accepts requests addressed to `127.0.0.1`
- Location — GPS is excluded from activity streams unless explicitly requested
- Account internals — OAuth scopes and profile image URLs are stripped from responses

## Out of scope

- Anything an MCP client or model does with data after the server returns it
- Garmin Connect's own availability, rate limits or API changes
