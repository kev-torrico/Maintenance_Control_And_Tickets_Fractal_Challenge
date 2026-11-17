from config.database import db

class BoardList(db.Model):
    __tablename__ = "board_list"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100), nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey("board.id", ondelete="CASCADE"), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    board = db.relationship("Board", back_populates="lists")
    tickets = db.relationship(
        "Ticket",
        back_populates="list",
        order_by="(Ticket.position, Ticket.id)",
        lazy="selectin",
    )

    @property
    def status_key(self) -> str:
        """Workflow status represented by this list (mirrors the SP's UPPER(TRIM(title)))."""
        return (self.title or "").strip().upper()

    def __repr__(self):
        return f"<BoardList {self.id} {self.title}>"
