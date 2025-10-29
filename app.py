from flask import Flask, render_template, request
import os
from extractor import extract_text_from_pdf
from summarizer import summarize_text
from dotenv import load_dotenv
load_dotenv(override=True)   # ensure .env is applied even if shell lacks exports


app = Flask(__name__)
print("GOOGLE_APPLICATION_CREDENTIALS =", os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/", methods=["GET", "POST"])
def index():
    summary = None
    if request.method == "POST":
        file = request.files["pdf"]
        path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(path)

        extracted_text = extract_text_from_pdf(path)
        summary = summarize_text(extracted_text)

    return render_template("index.html", summary=summary)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000,debug=True)
