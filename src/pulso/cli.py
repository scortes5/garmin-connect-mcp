"""Command-line entry point for Garmin Connect MCP."""

import sys

USAGE = """\
Usage:
  pulso                            run the MCP server on stdio
  pulso auth [--save-password]     sign in to Garmin Connect
  pulso dashboard [options]        sync your history and open the dashboard
                                   (see: pulso dashboard --help)"""


def main() -> None:
    """Run the MCP server or a supported subcommand."""
    args = sys.argv[1:]

    if not args:
        from .server import main as server_main

        server_main()
        return

    if args[0] == "auth" and set(args[1:]) <= {"--save-password"}:
        from .scripts.setup_auth import main as auth_main

        auth_main(save_password="--save-password" in args)
        return

    if args[0] == "dashboard":
        from .dashboard.cli import main as dashboard_main

        dashboard_main(args[1:])
        return

    if args[0] in {"-h", "--help", "help"}:
        print(USAGE)
        return

    print(f"Unknown command: {args[0]}", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
