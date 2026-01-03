# PDF-Summarizer-OCR (Receipt Summarizer)

Full-stack receipt/PDF summarizer: upload a PDF → OCR extracts text (Google Vision) → an LLM generates a concise summary → results are stored and browsable via an API + React UI.

> **Note:** This repo does **not** include any private datasets or Google credentials. Use your own service account key via environment variables.

---

## Demo Features

- ✅ PDF upload  
- ✅ OCR extraction (Google Cloud Vision + pdf2image)  
- ✅ LLM summarization (Transformers / LLaMA pipeline)  
- ✅ REST API (Flask)  
- ✅ SQLite persistence (`receipts.db`)  
- ✅ React + Vite + Tailwind UI (upload + list + detail views)  
- ✅ CORS enabled for local dev  

---

## 📂 Project Background

### Backend (root)

- **app_api.py**  
  Main Flask REST API. Handles routes like `/api/receipts`, runs OCR + summarization, and saves results into SQLite via SQLAlchemy.

- **app.py**  
  Legacy Flask entrypoint for server-rendered HTML (`templates/`). Mostly kept for reference if you are using the React UI.

- **extractor.py**  
  OCR pipeline. Converts PDFs into images (pdf2image) and extracts text using Google Cloud Vision.

- **summarizer.py**  
  LLM summarization pipeline. Takes OCR text and produces a concise summary using Hugging Face Transformers (LLaMA-based model).

- **models.py**  
  SQLAlchemy models and DB initialization. Defines the `Receipt` table schema (filename, merchant, totals, text, summary, tags, timestamps, etc.).

- **requirements.txt**  
  Python dependencies for the backend (Flask, Google Vision client libs, pdf2image, transformers, torch, SQLAlchemy, etc.).

- **start.sh**  
  Convenience start script (often used for deployment/Docker).

- **.gitignore**  
  Prevents committing `venv/`, `__pycache__/`, `uploads/`, DB files, credentials, etc.

- **uploads/**  
  Directory where uploaded PDFs are stored locally during development. Should remain ignored in git.

- **templates/**  
  Flask template UI (HTML form). Not needed once the React UI is used.

---

### Frontend (`receipt-ui/`)

- **receipt-ui/**  
  React + Vite + Tailwind frontend.

**Key files:**

- **receipt-ui/src/App.jsx**  
  Main UI layout (status, upload, list, detail views).

- **receipt-ui/src/components/Upload.jsx**  
  Upload form that POSTs PDFs to `/api/receipts`.

- **receipt-ui/src/components/ReceiptsList.jsx**  
  Fetches and displays receipts from `GET /api/receipts`.

- **receipt-ui/src/components/ReceiptDetail.jsx** (if present)  
  Shows a selected receipt’s summary, raw text, and metadata via `GET /api/receipts/:id`.

- **receipt-ui/src/index.css**  
  Tailwind entry (Tailwind v4 import style).

- **receipt-ui/postcss.config.js**  
  PostCSS configuration enabling Tailwind.

- **receipt-ui/tailwind.config.js**  
  Tailwind configuration (content paths and theme).

- **receipt-ui/vite.config.js**  
  Vite configuration.

- **receipt-ui/package.json**  
  Frontend dependencies and scripts (`dev`, `build`, etc.).

---

## 🚀 Quick Start (Local Dev)

### 1) Backend (Flask API)

```bash
cd ~/receipt-summarizer
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt





