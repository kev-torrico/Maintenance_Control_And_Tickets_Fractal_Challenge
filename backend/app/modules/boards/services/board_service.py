from app.modules.boards.models.asset_code_model import AssetCode
from app.modules.boards.models.board_model import Board
from app.shared.exceptions import NotFoundException
from config.database import db

class BoardService:
    @staticmethod
    def list_active_boards():
        return Board.query.filter(Board.status == "ACTIVE").order_by(Board.id.asc()).all()

    @staticmethod
    def get_board(board_id: int) -> Board:
        """Board with lists (ORDER BY position) and nested tickets (ORDER BY position).

        Ordering and eager loading are declared on the model relationships.
        """
        board = db.session.get(Board, board_id)
        if board is None:
            raise NotFoundException(f"Board with id {board_id} not found.")
        return board

    @staticmethod
    def list_asset_codes(search: str = None):
        query = AssetCode.query
        if search:
            query = query.filter(AssetCode.name.ilike(f"%{search}%"))
        return query.order_by(AssetCode.name.asc()).all()