from config.database import db

TICKET_PRIORITIES = ("LOW", "MEDIUM", "HIGH")

class Ticket(db.Model):
    __tablename__ = "ticket"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(250))
    position = db.Column(db.Integer, nullable=False, default=1)
    priority = db.Column(db.Enum(*TICKET_PRIORITIES, name="ticket_priority"), nullable=False, default="MEDIUM")
    status = db.Column(db.String(50), nullable=False, default="PENDING")
    diagnosis = db.Column(db.Text)
    assigned_to = db.Column(db.Integer, db.ForeignKey("app_user.id", ondelete="SET NULL"))
    asset_code_id = db.Column(db.Integer, db.ForeignKey("asset_code.id", ondelete="RESTRICT"), nullable=False)
    list_id = db.Column(db.Integer, db.ForeignKey("board_list.id", ondelete="RESTRICT"), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    updated_at = db.Column(
        db.TIMESTAMP,
        server_default=db.func.current_timestamp(),
        server_onupdate=db.func.current_timestamp(),
    )
    asset_code = db.relationship("AssetCode", lazy="joined")
    assigned_user = db.relationship("User", lazy="joined")
    list = db.relationship("BoardList", back_populates="tickets", lazy="joined")
    history = db.relationship(
        "TicketHistory",
        back_populates="ticket",
        order_by="(TicketHistory.created_at, TicketHistory.id)",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self):
        return f"<Ticket {self.id} {self.status}>"