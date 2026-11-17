from config.database import db

class TicketHistory(db.Model):
    __tablename__ = "ticket_history"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey("ticket.id", ondelete="CASCADE"), nullable=False)
    previous_status = db.Column(db.String(50))
    new_status = db.Column(db.String(50), nullable=False)
    comment = db.Column(db.String(250), nullable=False)
    changed_by = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    ticket = db.relationship("Ticket", back_populates="history")

    def __repr__(self):
        return f"<TicketHistory {self.id} ticket={self.ticket_id} {self.previous_status}->{self.new_status}>"