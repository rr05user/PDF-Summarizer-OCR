import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";

import Upload from "./components/Upload";
import ReceiptsList from "./components/ReceiptsList";
import ReceiptDetail from "./components/ReceiptDetail";

/* ---------- Small UI helpers ---------- */
function Header({ status }) {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500" />
          <h1 className="text-xl font-bold tracking-tight">Receipt Summarizer</h1>
        </div>
        <span className="text-xs rounded-full border px-3 py-1 bg-white text-gray-700">
          Status: {status}
        </span>
      </div>
    </header>
  );
}

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-gray-900">
      <section className="mx-auto max-w-6xl px-4 py-10">{children}</section>
    </main>
  );
}

function SectionTitle({ title }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500" />
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  );
}

function Feature({ title, body, icon }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow transition">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-medium">{title}</div>
      <div className="text-sm text-gray-600 mt-1">{body}</div>
    </div>
  );
}

function ToolbarBack() {
  const { pathname } = useLocation();
  const onDetail = pathname.startsWith("/receipts/");
  if (!onDetail) return null;
  return (
    <div className="mb-4">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Back to list
      </Link>
    </div>
  );
}

/* ---------- Pages ---------- */
function HomePage() {
  return (
    <>
      {/* Main card */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        {/* Upload row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6 md:p-8 border-b">
          <Upload />
          <div className="text-xs text-gray-600">
            Tip: Use the search box to filter by merchant or filename.
          </div>
        </div>

        {/* List */}
        <div className="p-6 md:p-8">
          <SectionTitle title="Receipts" />
          <ReceiptsList />
        </div>
      </div>

      {/* Product intro */}
      <div className="mt-12 overflow-hidden rounded-3xl border bg-white">
        <div className="p-8 md:p-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            AI summaries for faster expense reviews
          </h2>
          <p className="mt-2 text-gray-600 max-w-3xl">
            Upload a receipt PDF and get a clean, human-readable summary—plus quick access
            to raw text and structured metadata. Perfect for expense tracking, audits, and inbox zero.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Feature
              title="1. Upload"
              body="Choose any PDF. We handle multipage receipts and keep files local to this server."
              icon="📄"
            />
            <Feature
              title="2. OCR"
              body="Google Vision extracts high-quality text, even from low-contrast scans."
              icon="🔎"
            />
            <Feature
              title="3. Summarize"
              body="LLM condenses the essentials—merchant, date, totals—into a clear digest."
              icon="✨"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2 text-sm hover:opacity-90"
            >
              Try it with a receipt
            </Link>
            <span className="text-xs text-gray-500">
              Your data stays on this server. Delete uploads anytime.
            </span>
          </div>
        </div>
      </div>

      {/* About the builder */}
      <div className="mt-12 overflow-hidden rounded-3xl border bg-white">
        <div className="p-8 md:p-12 bg-gradient-to-br from-sky-50 via-white to-indigo-50">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">About the builder</h2>
          <p className="mt-2 text-gray-600 max-w-3xl">
            <span className="font-medium">Rahul Ravi</span> — Computer Engineering (B.S.), Texas A&amp;M University, Junior.
            Passionate about applied AI, embedded systems, and full-stack apps that turn messy inputs into insight.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-2xl">🎯</div>
              <div className="mt-2 font-medium">Focus</div>
              <div className="text-sm text-gray-600">OCR, LLMs, and clean UX for everyday tasks.</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-2xl">🧠</div>
              <div className="mt-2 font-medium">Strengths</div>
              <div className="text-sm text-gray-600">Python/Flask, React, Tailwind, and data pipelines.</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-2xl">🚀</div>
              <div className="mt-2 font-medium">Goal</div>
              <div className="text-sm text-gray-600">Ship reliable tools that make reviews painless.</div>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-10 text-center text-sm text-gray-500">
        Built with Flask, React, Vite &amp; Tailwind.
      </footer>
    </>
  );
}

export default function App() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
    fetch(`${url}/api/health`)
      .then((r) => r.json())
      .then((d) => setStatus(d.ok ? `API OK (${d.time})` : "API not OK"))
      .catch(() => setStatus("API unreachable"));
  }, []);

  return (
    <BrowserRouter>
      <Header status={status} />
      <Shell>
        <ToolbarBack />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/receipts/:id" element={<ReceiptDetail />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
