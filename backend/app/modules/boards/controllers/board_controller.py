from flask import request
from app.modules.boards.services.board_service import BoardService
from app.modules.boards.utils.serializers import (
    serialize_asset,
    serialize_board_detail,
    serialize_board_summary,
)
from app.shared.responses import success_response
from app.shared.validators import clean_string


class BoardController:
    @staticmethod
    def list_boards():
        boards = BoardService.list_active_boards()
        data = [serialize_board_summary(b) for b in boards]
        return success_response(data, "Active boards retrieved successfully.", count=len(data))

    @staticmethod
    def get_board(board_id: int):
        board = BoardService.get_board(board_id)
        return success_response(serialize_board_detail(board), "Board retrieved successfully.")

    @staticmethod
    def list_assets():
        search = clean_string(request.args.get("search"), "search", max_length=100)
        assets = BoardService.list_asset_codes(search=search or None)
        data = [serialize_asset(a) for a in assets]
        return success_response(data, "Asset codes retrieved successfully.", count=len(data))
