from flask import Blueprint
from app.modules.boards.controllers.board_controller import BoardController

board_bp = Blueprint("boards", __name__)

@board_bp.get("", strict_slashes=False)
def list_boards():
    """List all ACTIVE boards.

    OpenAPI: operationId `listBoards`.
    """
    return BoardController.list_boards()

@board_bp.get("/assets")
def list_assets():
    """List all registered asset codes (optional ?search=) for autocomplete/filtering.

    OpenAPI: operationId `listAssetCodes`.
    """
    return BoardController.list_assets()

@board_bp.get("/<int:board_id>")
def get_board(board_id: int):
    """Full board payload: ordered lists with nested, ordered tickets.

    OpenAPI: operationId `getBoard`.
    """
    return BoardController.get_board(board_id)