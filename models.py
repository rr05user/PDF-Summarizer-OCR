# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.sqlite import JSON

db = SQLAlchemy()

class Receipt(db.Model):
    __tablename__ = "receipts"

    id         = db.Column(db.Integer, primary_key=True)
    filename   = db.Column(db.String(512), nullable=False)
    merchant   = db.Column(db.String(256))
    date       = db.Column(db.String(64))
    subtotal   = db.Column(db.Float)
    tax        = db.Column(db.Float)
    total      = db.Column(db.Float)
    currency   = db.Column(db.String(16))
    text       = db.Column(db.Text)
    summary    = db.Column(db.Text)
    items      = db.Column(JSON)
    tags       = db.Column(JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Receipt {self.id}: {self.filename}>"

