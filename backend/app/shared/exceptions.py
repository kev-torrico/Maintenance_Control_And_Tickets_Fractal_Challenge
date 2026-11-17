class AppException(Exception):
    """Base class for all expected (client/business) application errors."""

    status_code = 500
    error = "Internal Server Error"

    def __init__(self, message: str, details=None):
        super().__init__(message)
        self.message = message
        self.details = details

class BadRequestException(AppException):
    """Missing required fields, invalid JSON, or malformed parameters (HTTP 400)."""

    status_code = 400
    error = "Bad Request"

class ForbiddenException(AppException):
    """The acting user lacks the role required for the operation (HTTP 403)."""

    status_code = 403
    error = "Forbidden"

class NotFoundException(AppException):
    """Requested resource does not exist (HTTP 404)."""

    status_code = 404
    error = "Not Found"

class BusinessRuleException(AppException):
    """Business rule or State Machine violation (HTTP 422)."""

    status_code = 422
    error = "Unprocessable Entity"