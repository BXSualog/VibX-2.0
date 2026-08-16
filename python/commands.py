def execute_command(intent: dict) -> dict:
    """Translate a parsed intent into a playback command payload."""
    return {"ok": True, "intent": intent, "note": "Mobile app executes commands locally in Phase 1."}
