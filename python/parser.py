def parse_command(text: str):
    text = text.lower()

    if "pause" in text:
        return {"action": "pause"}

    if "resume" in text:
        return {"action": "resume"}

    if "stop" in text:
        return {"action": "stop"}

    if "shuffle" in text:
        return {"action": "shuffle"}

    if "randomize the vibe" in text:
        return {"action": "vibe"}

    if "random" in text:
        return {"action": "random"}

    if "next" in text:
        return {"action": "next"}

    if "previous" in text:
        return {"action": "previous"}

    if "play" in text:
        song = text.replace("play", "").strip()
        return {"action": "play", "song": song}

    return {"action": "unknown"}
