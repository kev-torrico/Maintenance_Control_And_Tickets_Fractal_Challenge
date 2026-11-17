from flask import request
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.utils.validators import (
    serialize_user,
    validate_login_payload,
    validate_register_payload,
    validate_role_filter,
)
from app.shared.responses import success_response
from app.shared.validators import get_json_body

class AuthController:
    @staticmethod
    def list_users():
        role = validate_role_filter(request.args.get("role"))
        users = AuthService.list_users(role=role)
        data = [serialize_user(u) for u in users]
        return success_response(data, "Users retrieved successfully.", count=len(data))

    @staticmethod
    def login():
        data = validate_login_payload(get_json_body(request))
        user = AuthService.get_user_by_email(data["email"])
        return success_response(serialize_user(user), "Login successful.")

    @staticmethod
    def register():
        data = validate_register_payload(get_json_body(request))
        user = AuthService.register_user(**data)
        return success_response(serialize_user(user), "User registered successfully.", 201)