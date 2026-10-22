# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/scortes5/garmin-connect-mcp/security/advisories/new)
instead. You will get an answer within a few days.

Never include real Garmin tokens, passwords, exported `.fit`/`.gpx` files or
personal activity data in a report. Made-up data is enough to reproduce a bug.

## What this project protects

- Garmin OAuth tokens (`~/.garminconnect/`, `~/.garminconnect_base64`) — written `0600`
- Credentials file (`~/.garminconnect.env`) — `0600`; the password is only stored with `auth --save-password`
- Exported activity files — `0600` in `$GARMIN_EXPORT_DIR`
- Location — GPS is excluded from activity streams unless explicitly requested
- Account internals — OAuth scopes and profile image URLs are stripped from responses

## Out of scope

- Anything an MCP client or model does with data after the server returns it
- Garmin Connect's own availability, rate limits or API changes
