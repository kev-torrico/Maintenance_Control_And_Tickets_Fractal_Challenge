from websockets import socketio

@socketio.on("connect")
def handle_connect():
    pass


def emit_ticket_moved(payload: dict):
    """Broadcasts ticket position/status updates to connected board clients."""
    socketio.emit("ticket_updated", payload)