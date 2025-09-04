# PDF-Summarizer-OCR 🧾📄

This project extracts and summarizes content from PDF receipts using OCR and a LLaMA-based language model.

---

## 🔍 Features

- 📷 Extracts text from scanned PDF receipts using Google Vision OCR
- 🤖 Summarizes the content using Hugging Face Transformers (LLaMA model)
- 🌐 Flask web app interface for uploading PDFs and viewing summaries
- 🛠️ Designed to support cloud deployment (Google Cloud + Hugging Face + OpenAI routes)

---

## 🚀 Setup Instructions

```bash
git clone https://github.com/rr05user/PDF-Summarizer-OCR.git
cd PDF-Summarizer-OCR

# Set up environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Add your Google credentials JSON and .env file
touch .env  # Add OPENAI_API_KEY and GOOGLE_CREDENTIALS_PATH here

# Run the app
python app.py
