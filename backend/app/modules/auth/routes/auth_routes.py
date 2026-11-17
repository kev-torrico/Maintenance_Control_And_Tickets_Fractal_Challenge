from flask import Blueprint
from app.modules.auth.controllers.auth_controller import AuthController

auth_bp = Blueprint("auth", __name__)

@auth_bp.get("/users")
def list_users():
    """List all registered users with their board roles (optional ?role=OPERATOR|REPORTER).

    OpenAPI: operationId `listUsers`.
    """
    return AuthController.list_users()

@auth_bp.post("/login")
def login():
    """Log in a user by email. 200 with user details or 404 if the email is unknown.

    OpenAPI: operationId `loginUser`.
    """
    return AuthController.login()

@auth_bp.post("/register")
def register():
    """Register a user and link it to the default active board (id=1). 201 or 400 on duplicate email.

    OpenAPI: operationId `registerUser`.
    """
    return AuthController.register()