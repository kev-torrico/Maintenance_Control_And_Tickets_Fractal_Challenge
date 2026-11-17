from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.modules.auth.models.user_model import User, UserBoard
from app.modules.boards.models.board_model import Board
from app.shared.exceptions import BadRequestException, NotFoundException
from config.database import db

DEFAULT_BOARD_ID = 1


class AuthService:
    @staticmethod
    def list_users(role: str = None):
        query = User.query.order_by(User.full_name.asc(), User.id.asc())
        if role:
            query = query.filter(User.board_memberships.any(UserBoard.role == role))
        return query.all()

    @staticmethod
    def get_user_by_email(email: str) -> User:
        user = User.query.filter(func.lower(User.email) == email.lower()).first()
        if user is None:
            raise NotFoundException(f"No user registered with email '{email}'.")
        return user

    @staticmethod
    def register_user(full_name: str, email: str, role: str) -> User:
        if User.query.filter(func.lower(User.email) == email.lower()).first():
            raise BadRequestException(f"A user with email '{email}' already exists.")

        board = db.session.get(Board, DEFAULT_BOARD_ID)
        if board is None or board.status != "ACTIVE":
            raise NotFoundException("Default active board (id=1) does not exist.")

        user = User(full_name=full_name, email=email)
        user.board_memberships.append(UserBoard(board_id=board.id, role=role))
        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise BadRequestException(f"A user with email '{email}' already exists.")
        return user
