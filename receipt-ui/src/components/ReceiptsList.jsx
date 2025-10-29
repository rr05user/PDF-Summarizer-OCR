import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function ReceiptsList() {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function fetchRows(signal) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/receipts`, { signal });
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchRows(ctrl.signal);
    const onRefresh = () => fetchRows(ctrl.signal);
    window.addEventListener("receipts:refresh", onRefresh);
    return () => {
      ctrl.abort();
      window.removeEventListener("receipts:refresh", onRefresh);
    };
  }, [API]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        (r.merchant || "").toLowerCase().includes(term) ||
        (r.filename || "").toLowerCase().includes(term)
    );
  }, [rows, q]);

  return (
    <div>
      {/* Search */}
      <div className="mb-4 flex items-center justify-end">
        <input
          placeholder="Search by merchant/filename…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full md:w-96 px-4 py-2 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading receipts…</div>
      ) : filtered.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/receipts/${r.id}`}
              className="block rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium truncate max-w-[75%]">
                  {r.merchant || "Unknown merchant"}
                </div>
                <div className="text-sm text-gray-500">#{r.id}</div>
              </div>
              <div className="text-sm text-gray-600 mt-1 truncate">{r.filename}</div>
              <div className="text-xs text-gray-500 mt-1">
                {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
              </div>
              <div className="text-sm mt-2">
                <span className="text-gray-500">Total:</span>{" "}
                {formatMoney(r.total, r.currency)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-gray-50 to-white p-8 text-center">
      <p className="text-sm text-gray-700">No receipts yet.</p>
      <p className="text-xs text-gray-500 mt-1">Upload a PDF to see it here.</p>
    </div>
  );
}

function formatMoney(n, c = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c || "USD",
    }).format(n);
  } catch {
    return `$${n}`;
  }
}
