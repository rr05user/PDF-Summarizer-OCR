import os
import uuid
from copy import deepcopy
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename  # ✅ safer filenames

from models import db, Receipt
from extractor import extract_text_from_pdf   # Google Vision + pdf2image
from summarizer import summarize_text         # your Llama pipeline

load_dotenv()

app = Flask(__name__)

# ✅ Ensure PATCH + JSON headers are allowed in CORS
CORS(app,
     origins=os.getenv("CORS_ORIGINS", "*"),
     supports_credentials=False,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"])

# -----------------------------
# Database configuration
# -----------------------------
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "SQLALCHEMY_DATABASE_URI",
    "sqlite:////root/receipt-summarizer/receipts.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
print("→ Initializing database and creating tables if missing...")
with app.app_context():
    db.create_all()
print("✅ Database init complete.")
# -----------------------------

UPLOADS = os.getenv("UPLOAD_FOLDER", "uploads")
os.makedirs(UPLOADS, exist_ok=True)

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def serialize_receipt(r, updated_at=None):
    payload = {
        "id": r.id,
        "filename": r.filename,
        "merchant": r.merchant,
        "date": r.date,
        "subtotal": r.subtotal,
        "tax": r.tax,
        "total": r.total,
        "currency": r.currency,
        "items": r.items,
        "tags": r.tags or [],
        "summary": r.summary,
        "text": r.text,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
    ua = getattr(r, "updated_at", None)
    if ua:
        payload["updated_at"] = ua.isoformat()
    elif updated_at is not None:
        payload["updated_at"] = updated_at.isoformat()
    return payload


def _unique_filename(name: str) -> str:
    base = secure_filename(name) or "upload.pdf"
    root, ext = os.path.splitext(base)
    return f"{root}-{uuid.uuid4().hex[:8]}{ext or '.pdf'}"


# ------------------------------------------------------------
# Health check
# ------------------------------------------------------------
@app.get("/api/health")
def health():
    return jsonify({"ok": True, "time": datetime.utcnow().isoformat()})


# ------------------------------------------------------------
# Upload + OCR + Summarize + save to DB
# ------------------------------------------------------------
@app.post("/api/receipts")
def create_receipt():
    if "file" not in request.files:
        return jsonify({"error": "missing 'file'"}), 400

    f = request.files["file"]
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "only PDFs are supported"}), 400

    filename = _unique_filename(f.filename)
    path = os.path.join(UPLOADS, filename)
    f.save(path)

    try:
        full_text = extract_text_from_pdf(path)
    except Exception as e:
        return jsonify({"error": f"OCR failed: {e}"}), 500

    try:
        summary = summarize_text(full_text or "")
    except Exception as e:
        return jsonify({"error": f"Summarizer failed: {e}"}), 500

    merchant = (full_text.splitlines()[0] or "").strip() if full_text else None

    rec = Receipt(
        filename=filename,
        merchant=merchant,
        date=None,
        subtotal=None,
        tax=None,
        total=None,
        currency="USD",
        text=full_text or "",
        summary=summary or "",
        items=None,
        tags=[]
    )
    db.session.add(rec)
    db.session.commit()

    return jsonify({"id": rec.id}), 201


# ------------------------------------------------------------
# List all receipts
# ------------------------------------------------------------
@app.get("/api/receipts")
def list_receipts():
    rows = Receipt.query.order_by(Receipt.created_at.desc()).all()
    return jsonify([
        {
            "id": r.id,
            "filename": r.filename,
            "merchant": r.merchant,
            "date": r.date,
            "total": r.total,
            "tags": r.tags or [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": (r.updated_at.isoformat() if getattr(r, "updated_at", None) else None),
        }
        for r in rows
    ])


# ------------------------------------------------------------
# Get one receipt by id
# ------------------------------------------------------------
@app.get("/api/receipts/<int:rid>")
def get_receipt(rid: int):
    r = Receipt.query.get_or_404(rid)
    return jsonify(serialize_receipt(r))


# ------------------------------------------------------------
# Edit (inline save)
# ------------------------------------------------------------
@app.route("/api/receipts/<int:rid>", methods=["PATCH"])
def patch_receipt(rid: int):
    r = Receipt.query.get_or_404(rid)
    body = request.get_json(silent=True) or {}

    if "summary" in body:
        r.summary = body["summary"] or ""
    if "text" in body:
        r.text = body["text"] or ""

    meta = body.get("metadata") or {}
    for col in ("merchant", "date", "subtotal", "tax", "total", "currency", "items", "tags"):
        if col in meta:
            val = meta[col]
            if col == "tags":
                if isinstance(val, str):
                    val = [t.strip() for t in val.split(",") if t.strip()]
                elif isinstance(val, list):
                    val = [str(t).strip() for t in val if str(t).strip()]
                else:
                    val = []
            setattr(r, col, val)

    db.session.commit()
    now = datetime.utcnow()
    return jsonify(serialize_receipt(r, updated_at=now)), 200


# ------------------------------------------------------------
# Re-run OCR (updates text only)
# ------------------------------------------------------------
@app.post("/api/receipts/<int:rid>/ocr")
def rerun_ocr(rid: int):
    r = Receipt.query.get_or_404(rid)
    path = os.path.join(UPLOADS, r.filename)
    if not os.path.exists(path):
        return jsonify({"error": f"file not found on server: {r.filename}"}), 404

    try:
        full_text = extract_text_from_pdf(path)
    except Exception as e:
        return jsonify({"error": f"OCR failed: {e}"}), 500

    r.text = full_text or ""
    db.session.commit()

    now = datetime.utcnow()
    return jsonify({"ok": True, "text": r.text, "updated_at": now.isoformat()}), 200


# ------------------------------------------------------------
# Re-run Summarizer (updates summary only)
# ------------------------------------------------------------
@app.post("/api/receipts/<int:rid>/summarize")
def rerun_summarize(rid: int):
    r = Receipt.query.get_or_404(rid)
    try:
        new_summary = summarize_text(r.text or "")
    except Exception as e:
        return jsonify({"error": f"Summarizer failed: {e}"}), 500

    r.summary = new_summary or ""
    db.session.commit()

    now = datetime.utcnow()
    return jsonify({"ok": True, "summary": r.summary, "updated_at": now.isoformat()}), 200


# ------------------------------------------------------------
# Serve uploaded PDFs
# ------------------------------------------------------------
@app.get("/uploads/<path:fname>")
def serve_upload(fname):
    safe = secure_filename(os.path.basename(fname))
    path = os.path.join(UPLOADS, safe)
    if not os.path.exists(path):
        return jsonify({"error": "file not found"}), 404
    return send_from_directory(UPLOADS, safe, as_attachment=False)


# ------------------------------------------------------------
# Delete a receipt (+ its file)
# ------------------------------------------------------------
@app.delete("/api/receipts/<int:rid>")
def delete_receipt(rid: int):
    r = Receipt.query.get_or_404(rid)
    file_path = os.path.join(UPLOADS, r.filename) if r.filename else None
    try:
        db.session.delete(r)
        db.session.commit()
    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
    return jsonify({"ok": True})


# ------------------------------------------------------------
# Errors
# ------------------------------------------------------------
@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "internal error", "detail": str(e)}), 500


# ------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
