"""Middleware for Garmin Connect MCP server.

This module provides middleware components that run before tool execution.
"""

from collections.abc import Callable
from typing import Any

from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware, MiddlewareContext

from .auth import can_authenticate, load_config
from .client import GarminClientWrapper, get_cached_client


class ConfigMiddleware(Middleware):
    """Middleware that initializes Garmin client for all tool calls.

    This middleware:
    1. Loads the Garmin config from environment variables
    2. Checks that saved tokens or credentials are available
    3. Reuses one authenticated Garmin client for the whole server process
    4. Injects the client into the context state for tools to access via ctx.get_state("client")
    5. Raises ToolError if authentication fails
    """

    async def on_call_tool(self, context: MiddlewareContext, call_next: Callable[..., Any]):
        """Initialize Garmin client before every tool call."""
        # Load and validate configuration
        config = load_config()

        if not can_authenticate(config):
            raise ToolError(
                "Garmin is not authenticated. "
                "Please run 'garmin-connect-mcp auth' to set up authentication."
            )

        # Initialize Garmin client
        client = get_cached_client(config)
        if client is None:
            raise ToolError(
                "Failed to initialize Garmin client. "
                "Please run 'garmin-connect-mcp auth' to authenticate interactively. "
                "If the problem persists, check your Garmin credentials."
            )

        client_wrapper = GarminClientWrapper(client)

        # Inject client into context state for tools to access
        if context.fastmcp_context:
            await context.fastmcp_context.set_state(
                "client",
                client_wrapper,
                serializable=False,
            )

        # Continue to the tool execution
        return await call_next(context)
