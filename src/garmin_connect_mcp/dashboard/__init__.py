"""Local Garmin dashboard: sync your history, analyse it and render a self-contained HTML app.

The pipeline is ``sync`` (Garmin -> chunk cache) -> ``normalize`` (cache -> dataset) ->
``analytics`` (dataset -> correlations) -> ``render`` (dataset -> HTML). Every stage after
``sync`` works offline from the cache. See ``docs/ARCHITECTURE.md``.
"""
