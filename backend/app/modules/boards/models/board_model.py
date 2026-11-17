from config.database import db

BOARD_STATUSES = ("ACTIVE", "INACTIVE")

class Board(db.Model):
    __tablename__ = "board"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(150), nullable=False)
    status = db.Column(db.Enum(*BOARD_STATUSES, name="board_status"), nullable=False, default="ACTIVE")
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    lists = db.relationship(
        "BoardList",
        back_populates="board",
        order_by="BoardList.position",
        lazy="selectin",
    )

    def __repr__(self):
        return f"<Board {self.id} {self.title}>"
