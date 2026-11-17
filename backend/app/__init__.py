import os
from flask import Flask, jsonify
from flask_cors import CORS
from flasgger import Swagger
from config.settings import Config
from config.database import db, migrate
from websockets import socketio
from app.shared.error_handlers import register_error_handlers

OPENAPI_SPEC_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "swagger_docs", "openapi.yaml")
)
SWAGGER_CONFIG = {
    "openapi": "3.0.3",
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec_1",
            "route": "/apispec_1.json",
            # `openapi.yaml` is the single source of truth: do not harvest route docstrings.
            "rule_filter": lambda _rule: False,
            "definition_filter": lambda _definition: False,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app)
    Swagger(app, config=SWAGGER_CONFIG, template_file=OPENAPI_SPEC_PATH)

    register_error_handlers(app)

    from app import models as _models

    @app.get("/api/v1/health")
    def health_check():
        return jsonify({"status": "ok", "service": "maintenance-tickets-api"}), 200

    from app.modules.auth.routes.auth_routes import auth_bp
    from app.modules.boards.routes.board_routes import board_bp
    from app.modules.tickets.routes.ticket_routes import ticket_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(board_bp, url_prefix="/api/v1/boards")
    app.register_blueprint(ticket_bp, url_prefix="/api/v1/tickets")

    return app