from werkzeug.exceptions import HTTPException
from app.shared.exceptions import (
    AppException,
    BadRequestException,
    BusinessRuleException,
    NotFoundException,
)
from app.shared.responses import error_response

def register_error_handlers(app):
    def _handle_app_exception(error: AppException):
        return error_response(error.error, error.message, error.status_code, error.details)

    @app.errorhandler(BusinessRuleException)
    def handle_business_rule_exception(error):
        """State Machine / business rule violations -> HTTP 422."""
        return _handle_app_exception(error)

    @app.errorhandler(NotFoundException)
    def handle_not_found_exception(error):
        return _handle_app_exception(error)

    @app.errorhandler(BadRequestException)
    def handle_bad_request_exception(error):
        return _handle_app_exception(error)

    @app.errorhandler(AppException)
    def handle_app_exception(error):
        return _handle_app_exception(error)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        message = error.description
        if error.code == 400 and "JSON" in (message or ""):
            message = "Request body must be valid JSON."
        return error_response(error.name, message, error.code)

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        app.logger.exception("Unhandled server exception: %s", error)
        return error_response(
            "Internal Server Error",
            "An unexpected error occurred while processing the request.",
            500,
        )