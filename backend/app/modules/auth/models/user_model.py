from config.database import db

USER_ROLES = ("REPORTER", "OPERATOR")


class User(db.Model):
    __tablename__ = "app_user"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    board_memberships = db.relationship(
        "UserBoard",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="UserBoard.board_id",
        lazy="selectin",
    )

    def __repr__(self):
        return f"<User {self.id} {self.email}>"


class UserBoard(db.Model):
    __tablename__ = "user_board"
    __table_args__ = (db.UniqueConstraint("user_id", "board_id", name="uq_user_board"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey("board.id", ondelete="CASCADE"), nullable=False)
    role = db.Column(db.Enum(*USER_ROLES, name="user_board_role"), nullable=False, default="OPERATOR")

    user = db.relationship("User", back_populates="board_memberships")
    board = db.relationship("Board")

    def __repr__(self):
        return f"<UserBoard user={self.user_id} board={self.board_id} role={self.role}>"
