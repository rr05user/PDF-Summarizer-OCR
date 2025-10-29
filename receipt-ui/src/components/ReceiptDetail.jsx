import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";

// ReceiptDetail.jsx — Phase 3c (edit + actions + preview + delete + tab-in-URL)

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export default function ReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const initialTab = searchParams.get("tab") || "summary"; // summary | text | meta
  const [tab, setTab] = useState(initialTab);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ summary: "", text: "", metadata: {} });
  const [saving, setSaving] = useState(false);

  // Action state
  const [actionBusy, setActionBusy] = useState({ ocr: false, summarize: false });

  // Delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { pushToast, Toasts } = useToasts();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setErr("");
    fetch(`${API}/api/receipts/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        if (cancel) return;
        const createdAt = j.created_at || j.createdAt || null;
        const updatedAt = j.updated_at || j.updatedAt || null;
        const fileName = j.filename || j.fileName || null;
        const metadata =
          j.metadata ??
          {
            filename: fileName,
            merchant: j.merchant ?? null,
            date: j.date ?? null,
            subtotal: j.subtotal ?? null,
            tax: j.tax ?? null,
            total: j.total ?? null,
            currency: j.currency ?? null,
            tags: Array.isArray(j.tags) ? j.tags : j.tags ? [j.tags] : [],
          };
        const normalized = {
          id: j.id ?? id,
          summary: j.summary ?? "",
          text: j.text ?? "",
          metadata,
          createdAt,
          updatedAt,
          fileName,
          source: j.source ?? null,
        };
        setData(normalized);
        setDraft({
          summary: normalized.summary,
          text: normalized.text,
          metadata: { ...normalized.metadata },
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!cancel) {
          setErr(e.message || "Failed to load");
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  // keep tab in URL (?tab=summary|text|meta)
  useEffect(() => {
    const cur = searchParams.get("tab");
    if (cur !== tab) {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", tab);
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const metaPairs = useMemo(() => {
    if (!draft?.metadata) return [];
    const obj = draft.metadata;
    return Object.keys(obj).map((k) => ({ key: k, value: obj[k] }));
  }, [draft]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const m1 = JSON.stringify(data.metadata ?? {});
    const m2 = JSON.stringify(draft.metadata ?? {});
    return (
      (data.summary ?? "") !== (draft.summary ?? "") ||
      (data.text ?? "") !== (draft.text ?? "") ||
      m1 !== m2
    );
  }, [data, draft]);

  // Keyboard shortcuts while editing
  useEffect(() => {
    function onKey(e) {
      if (!editMode) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode]); // deps reduced to avoid stale closures; save/cancel are stable enough

  const copyPayload = useMemo(() => {
    if (!data) return "";
    if (tab === "summary") return (editMode ? draft.summary : data.summary) || "";
    if (tab === "text") return (editMode ? draft.text : data.text) || "";
    try {
      return JSON.stringify(editMode ? draft.metadata : data.metadata, null, 2);
    } catch {
      return "";
    }
  }, [tab, data, draft, editMode]);

  const handleEditToggle = () => setEditMode((v) => !v);

  const handleCancel = useCallback(() => {
    if (!data) return;
    setDraft({ summary: data.summary, text: data.text, metadata: { ...data.metadata } });
    setEditMode(false);
    pushToast({ type: "info", msg: "Changes discarded" });
  }, [data, pushToast]);

  const handleSave = useCallback(async () => {
    if (!data || !dirty || saving) return;
    setSaving(true);
    const optimisticPrev = data;
    const next = {
      ...data,
      summary: draft.summary,
      text: draft.text,
      metadata: draft.metadata,
    };
    setData(next);
    try {
      let r = await fetch(`${API}/api/receipts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: draft.summary,
          text: draft.text,
          metadata: draft.metadata,
        }),
      });
      if (r.status === 405) {
        // Fallback if PATCH is blocked
        r = await fetch(`${API}/api/receipts/${data.id}?_method=PATCH`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-HTTP-Method-Override": "PATCH",
          },
          body: JSON.stringify({
            summary: draft.summary,
            text: draft.text,
            metadata: draft.metadata,
          }),
        });
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${r.status}`);
      }
      const j = await r.json().catch(() => ({}));
      setData((cur) => ({
        ...cur,
        updatedAt: j.updated_at || j.updatedAt || cur.updatedAt,
      }));
      setEditMode(false);
      pushToast({ type: "success", msg: "Saved" });
    } catch (e) {
      setData(optimisticPrev);
      pushToast({ type: "error", msg: `Save failed: ${e.message || e}` });
    } finally {
      setSaving(false);
    }
  }, [API, data, draft, dirty, saving, pushToast]);

  async function runAction(which) {
    if (!data) return;
    setActionBusy((s) => ({ ...s, [which]: true }));
    try {
      const r = await fetch(`${API}/api/receipts/${data.id}/${which}`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${r.status}`);
      }
      const j = await r.json().catch(() => ({}));
      setData((cur) => ({
        ...cur,
        summary: j.summary ?? cur.summary,
        text: j.text ?? cur.text,
        metadata: j.metadata ?? cur.metadata,
        updatedAt: j.updated_at || j.updatedAt || cur.updatedAt,
      }));
      setDraft((d) => ({
        ...d,
        summary: j.summary ?? d.summary,
        text: j.text ?? d.text,
        metadata: j.metadata ?? d.metadata,
      }));
      pushToast({
        type: "success",
        msg: which === "ocr" ? "OCR re-run complete" : "Summarizer complete",
      });
    } catch (e) {
      pushToast({ type: "error", msg: `${which} failed: ${e.message || e}` });
    } finally {
      setActionBusy((s) => ({ ...s, [which]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ← Back
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Receipt <span className="text-gray-500">#{id}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ActionMenu
            onOCR={() => runAction("ocr")}
            onSummarize={() => runAction("summarize")}
            busy={actionBusy}
          />
          {data?.fileName && (
            <a
              href={`${API}/uploads/${encodeURIComponent(data.fileName)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Preview PDF
            </a>
          )}
          <CopyButton text={copyPayload} label={`Copy ${labelForTab(tab)}`} />
          {!editMode ? (
            <button
              onClick={handleEditToggle}
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Edit
            </button>
          ) : (
            <div className="inline-flex gap-2">
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className={`rounded-xl px-3 py-1.5 text-sm text-white ${
                  !dirty || saving ? "bg-gray-300" : "bg-gray-900 hover:opacity-90"
                }`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancel}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 border-red-300"
          >
            Delete
          </button>
        </div>
      </header>

      <section className="mb-3">
        <Tabs active={tab} onChange={setTab} />
      </section>

      {loading ? (
        <Card>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-5/6 rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
        </Card>
      ) : err ? (
        <Card>
          <p className="text-red-600">Failed to load: {err}</p>
          <p className="text-sm text-gray-500 mt-1">
            Ensure the backend is running and the ID exists.
          </p>
          <div className="mt-3">
            <Link to="/" className="text-sm text-blue-600 hover:underline">
              ← Back to list
            </Link>
          </div>
        </Card>
      ) : !data ? (
        <Card>
          <p>No data.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {tab === "summary" && (
            <Card>
              <SectionHeader
                title="AI Summary"
                right={<span className="text-xs text-gray-500">{editMode ? "Editing" : "Read-only"}</span>}
              />
              {editMode ? (
                <textarea
                  value={draft.summary}
                  onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                  className="mt-2 w-full min-h-[160px] rounded-xl border p-3 text-sm"
                  placeholder="Type a concise summary…"
                />
              ) : data.summary ? (
                <pre className="whitespace-pre-wrap text-sm leading-6">{data.summary}</pre>
              ) : (
                <EmptyState title="No summary yet" subtitle="Use Re-run Summarizer to generate one." />
              )}
            </Card>
          )}

          {tab === "text" && (
            <Card>
              <SectionHeader
                title="Extracted Text"
                right={<span className="text-xs text-gray-500">{editMode ? "Editing" : "Read-only"}</span>}
              />
              {editMode ? (
                <textarea
                  value={draft.text}
                  onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                  className="mt-2 w-full min-h-[200px] rounded-xl border p-3 text-sm"
                  placeholder="Paste or adjust OCR text…"
                />
              ) : data.text ? (
                <pre className="whitespace-pre-wrap text-sm leading-6">{data.text}</pre>
              ) : (
                <EmptyState title="No OCR text" subtitle="Use Re-run OCR to populate this." />
              )}
            </Card>
          )}

          {tab === "meta" && (
            <Card>
              <SectionHeader
                title="Metadata"
                right={<span className="text-xs text-gray-500">{editMode ? "Editing" : "Read-only"}</span>}
              />

              {!editMode ? (
                metaPairs.length ? (
                  <dl className="divide-y">
                    {metaPairs.map(({ key, value }) => (
                      <div key={key} className="grid grid-cols-3 gap-2 py-3">
                        <dt className="col-span-1 text-sm font-medium text-gray-600 break-words">{key}</dt>
                        <dd className="col-span-2 text-sm text-gray-900 whitespace-pre-wrap break-words">
                          {renderMetaValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <EmptyState
                    title="No metadata"
                    subtitle="Fields like merchant, total, date, etc. will appear here."
                  />
                )
              ) : (
                <div className="space-y-3">
                  <MetaRow
                    label="merchant"
                    value={draft.metadata.merchant}
                    onChange={(v) => setDraft((d) => ({ ...d, metadata: { ...d.metadata, merchant: v } }))}
                  />
                  <MetaRow
                    label="date"
                    value={draft.metadata.date}
                    onChange={(v) => setDraft((d) => ({ ...d, metadata: { ...d.metadata, date: v } }))}
                  />
                  <MetaRow
                    label="subtotal"
                    value={numOrEmpty(draft.metadata.subtotal)}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, metadata: { ...d.metadata, subtotal: emptyToNum(v) } }))
                    }
                  />
                  <MetaRow
                    label="tax"
                    value={numOrEmpty(draft.metadata.tax)}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, metadata: { ...d.metadata, tax: emptyToNum(v) } }))
                    }
                  />
                  <MetaRow
                    label="total"
                    value={numOrEmpty(draft.metadata.total)}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, metadata: { ...d.metadata, total: emptyToNum(v) } }))
                    }
                  />
                  <MetaRow
                    label="currency"
                    value={draft.metadata.currency}
                    onChange={(v) => setDraft((d) => ({ ...d, metadata: { ...d.metadata, currency: v } }))}
                  />
                  <MetaRow
                    label="tags (comma-separated)"
                    value={(draft.metadata.tags || []).join(", ")}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        metadata: {
                          ...d.metadata,
                          tags: v
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />

                  {/* Advanced JSON editor */}
                  <div className="pt-3">
                    <label className="text-xs font-medium text-gray-600">Advanced (JSON)</label>
                    <textarea
                      className="mt-1 w-full min-h-[140px] rounded-xl border p-3 text-sm font-mono"
                      value={safeJSONStringify(draft.metadata)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || "{}");
                          setDraft((d) => ({ ...d, metadata: parsed }));
                        } catch {
                          // ignore malformed while typing
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Edit arbitrary fields; malformed JSON is ignored until valid.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}

          <footer className="text-xs text-gray-500">
            {data?.updatedAt ? (
              <span>Updated {new Date(data.updatedAt).toLocaleString()}</span>
            ) : data?.createdAt ? (
              <span>Created {new Date(data.createdAt).toLocaleString()}</span>
            ) : null}
            {data?.source && <span className="ml-2">• Source: {data.source}</span>}
            {data?.fileName && <span className="ml-2">• File: {data.fileName}</span>}
          </footer>

          <div className="pt-2">
            <Link to="/" className="inline-block text-sm text-blue-600 hover:underline">
              ← Back to list
            </Link>
          </div>
        </div>
      )}

      <Toasts />

      {showDelete && (
        <ConfirmModal
          title="Delete receipt?"
          body="This will remove the record and its uploaded file. This action cannot be undone."
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          cancelLabel="Cancel"
          onCancel={() => !deleting && setShowDelete(false)}
          onConfirm={async () => {
            if (!data) return;
            setDeleting(true);
            try {
              const r = await fetch(`${API}/api/receipts/${data.id}`, { method: "DELETE" });
              if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j?.error || `HTTP ${r.status}`);
              }
              pushToast({ type: "success", msg: "Deleted" });
              navigate("/");
            } catch (e) {
              pushToast({ type: "error", msg: `Delete failed: ${e.message || e}` });
              setDeleting(false);
            }
          }}
        />
      )}
    </div>
  );
}

/* UI components */
function Tabs({ active, onChange }) {
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "text", label: "Raw Text" },
    { id: "meta", label: "Metadata" },
  ];
  return (
    <div role="tablist" aria-label="Receipt detail tabs" className="inline-flex rounded-2xl border p-1 bg-white">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${t.id}`}
            onClick={() => onChange(t.id)}
            className={
              "px-3 sm:px-4 py-1.5 text-sm rounded-xl transition " +
              (isActive ? "bg-gray-900 text-white shadow" : "text-gray-700 hover:bg-gray-50")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children }) {
  return <div className="rounded-2xl border bg-white p-4 sm:p-6 shadow-sm">{children}</div>;
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center py-10">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm text-gray-500">{title}</div>
      {right}
    </div>
  );
}

function labelForTab(tab) {
  if (tab === "summary") return "summary";
  if (tab === "text") return "raw text";
  return "metadata";
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  async function handleCopy() {
    try {
      setErr("");
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setErr("Clipboard not available");
    }
  }
  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={handleCopy} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
        {copied ? "Copied!" : label}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

function ActionMenu({ onOCR, onSummarize, busy }) {
  return (
    <div className="inline-flex gap-2">
      <button
        onClick={onOCR}
        disabled={busy.ocr}
        className={`rounded-xl border px-3 py-1.5 text-sm ${
          busy.ocr ? "opacity-60 cursor-wait" : "hover:bg-gray-50"
        }`}
      >
        {busy.ocr ? "Re-running OCR…" : "Re-run OCR"}
      </button>
      <button
        onClick={onSummarize}
        disabled={busy.summarize}
        className={`rounded-xl border px-3 py-1.5 text-sm ${
          busy.summarize ? "opacity-60 cursor-wait" : "hover:bg-gray-50"
        }`}
      >
        {busy.summarize ? "Summarizing…" : "Re-run Summarizer"}
      </button>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel = "OK", cancelLabel = "Cancel", onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-5 text-sm text-gray-700 whitespace-pre-wrap">{body}</div>
        <div className="p-4 flex justify-end gap-2 border-t">
          <button onClick={onCancel} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="rounded-xl px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-center">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      <input
        className="col-span-2 px-3 py-2 rounded-xl border text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function renderMetaValue(v) {
  if (Array.isArray(v)) return v.join(", ");
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function numOrEmpty(n) {
  return n === null || n === undefined ? "" : String(n);
}
function emptyToNum(s) {
  const t = String(s).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}
function safeJSONStringify(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

/* Tiny toast system */
function useToasts() {
  const [items, setItems] = useState([]); // { id, type, msg }
  const pushToast = useCallback(({ type = "info", msg }) => {
    const id = Math.random().toString(36).slice(2);
    setItems((cur) => [...cur, { id, type, msg }]);
    setTimeout(() => {
      setItems((cur) => cur.filter((t) => t.id !== id));
    }, 2600);
  }, []);
  function Toasts() {
    return (
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border px-3 py-2 text-sm shadow bg-white ${
              t.type === "error" ? "border-red-300" : t.type === "success" ? "border-green-300" : "border-gray-200"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    );
  }
  return { pushToast, Toasts };
}
