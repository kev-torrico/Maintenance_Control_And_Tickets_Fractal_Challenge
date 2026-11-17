from flask import jsonify

def success_response(data=None, message: str = "OK", status_code: int = 200, **extra):
    body = {"success": True, "message": message, "data": data}
    body.update(extra)
    return jsonify(body), status_code

def error_response(error: str, message: str, status_code: int, details=None):
    body = {"success": False, "error": error, "message": message}
    if details is not None:
        body["details"] = details
    return jsonify(body), status_code