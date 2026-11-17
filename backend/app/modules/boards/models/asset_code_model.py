from config.database import db

class AssetCode(db.Model):
    __tablename__ = "asset_code"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

    def __repr__(self):
        return f"<AssetCode {self.id} {self.name}>"
