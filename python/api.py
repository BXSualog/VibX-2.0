from fastapi import FastAPI
from pydantic import BaseModel

from parser import parse_command
from commands import execute_command

app = FastAPI(title="Vyze", description="Local offline assistant stub for VibX 2.0 Phase 6")


class CommandRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"ok": True, "assistant": "Vyze", "offline": True}


@app.post("/command")
def command(body: CommandRequest):
    intent = parse_command(body.text)
    return execute_command(intent)
