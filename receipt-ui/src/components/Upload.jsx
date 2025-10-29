import { useState, useRef } from "react";

export default function Upload() {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr("");
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch(`${API}/api/receipts`, { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Upload failed (${r.status})`);
      setFile(null);
      window.dispatchEvent(new Event("receipts:refresh"));
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onFileChange(e) {
    setFile(e.target.files?.[0] || null);
    setErr("");
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  }

  const label = file ? file.name : "Choose a file (PDF)";
  const sub = file ? "Ready to upload" : "You can also drag & drop";

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`w-full cursor-pointer rounded-3xl border-2 px-5 py-6 shadow-sm transition 
          ${dragOver ? "border-indigo-400 bg-indigo-50/50" : "border-dashed border-gray-300 bg-white"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white grid place-items-center text-2xl">
              📄
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{label}</div>
              <div className="text-xs text-gray-600">{sub}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {file && !busy && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="rounded-xl border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={!file || busy}
              onClick={(e) => e.stopPropagation()}
              className={`rounded-xl px-4 py-2 text-sm text-white transition ${
                !file || busy ? "bg-gray-300" : "bg-gray-900 hover:opacity-90"
              }`}
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">❌ {err}</p>}
    </form>
  );
}
