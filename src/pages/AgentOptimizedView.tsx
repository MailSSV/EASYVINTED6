import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Play,
  CheckCircle2,
  FileEdit,
  ChevronRight,
  Copy,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ArticleRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number | null;
  brand: string | null;
  size: string | null;
  condition: string | null;
  color: string | null;
  material: string | null;
  status: string | null;
  photos: unknown;
  created_at: string;
  vinted_url: string | null;
  sale_notes: string | null;
};

type LotRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category_id: number | null;
  season: string | null;
  price: number | null;
  original_total_price: number | null;
  discount_percentage: number | null;
  photos: unknown;
  status: string | null;
  created_at: string;
  vinted_url: string | null;
  sale_notes: string | null;
};

type ItemType = "article" | "lot";

type UnifiedItem = {
  id: string;
  itemType: ItemType;
  title: string;
  description: string | null;
  price: number | null;
  status: string | null;
  photos: unknown;
  created_at: string;
  vinted_url: string | null;
  sale_notes: string | null;
  rawData: ArticleRow | LotRow;
};

type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const WORKFLOW_STEPS = [
  { step: 1, label: "Start Run", key: "s" },
  { step: 2, label: "Copy Title", key: "1" },
  { step: 3, label: "Copy Description", key: "2" },
  { step: 4, label: "Copy Price", key: "3" },
  { step: 5, label: "Copy Photos", key: "4" },
  { step: 6, label: "Paste Vinted URL", key: "u" },
  { step: 7, label: "Mark Published", key: "p" },
];

function nowIso() {
  return new Date().toISOString();
}

function ensureSessionId(): string {
  const k = "easyvinted_agent_session_id";
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const sid = `agent_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  localStorage.setItem(k, sid);
  return sid;
}

function normalizePhotoUrls(photos: unknown): string[] {
  if (!photos) return [];
  if (Array.isArray(photos) && photos.every((p) => typeof p === "string")) {
    return photos as string[];
  }
  if (Array.isArray(photos) && photos.every((p) => p && typeof p === "object")) {
    const urls = (photos as Record<string, unknown>[])
      .map((p) => p.url ?? p.publicUrl ?? p.public_url ?? p.path ?? null)
      .filter(Boolean) as string[];
    return urls.filter((u: string) => /^https?:\/\//i.test(u));
  }
  if (typeof photos === "string") {
    return photos.split(";").map((s) => s.trim()).filter(Boolean);
  }
  if (typeof photos === "object" && photos !== null) {
    const candidate = (photos as Record<string, unknown>).urls ??
                      (photos as Record<string, unknown>).photos ??
                      (photos as Record<string, unknown>).items ?? null;
    if (Array.isArray(candidate)) return normalizePhotoUrls(candidate);
  }
  return [];
}

async function copyToClipboard(text: string) {
  const value = text ?? "";
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function appendNote(existing: string | null, line: string) {
  const base = (existing ?? "").trim();
  const sep = base.length ? "\n" : "";
  return `${base}${sep}${line}`.trim();
}

function lockTag(sessionId: string) {
  return `[AGENT_LOCKED_BY:${sessionId}]`;
}

function doneTag(sessionId: string) {
  return `[AGENT_DONE:${sessionId}:${nowIso()}]`;
}

function isValidUrl(url?: string | null) {
  return !!url && /^https?:\/\//i.test(url);
}

function sortByCreatedAtAsc(a: UnifiedItem, b: UnifiedItem) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function AgentOptimizedView() {
  const sessionId = useMemo(() => ensureSessionId(), []);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items[selectedIndex] ?? null;

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1500);
  }

  async function fetchItems() {
    setLoading(true);
    try {
      const articlesSelect = "id,user_id,title,description,price,brand,size,condition,color,material,status,photos,sale_notes,created_at,vinted_url";
      const lotsSelect = "id,user_id,name,description,category_id,season,price,original_total_price,discount_percentage,photos,status,sale_notes,created_at,vinted_url";

      const [aRes, lRes] = await Promise.all([
        supabase.from("articles").select(articlesSelect).in("status", ["ready", "processing"]).order("created_at", { ascending: true }),
        supabase.from("lots").select(lotsSelect).in("status", ["ready", "processing"]).order("created_at", { ascending: true }),
      ]);

      const articles: UnifiedItem[] = ((aRes.data ?? []) as ArticleRow[]).map((a) => ({
        id: a.id,
        itemType: "article",
        title: a.title,
        description: a.description,
        price: a.price,
        status: a.status,
        photos: a.photos,
        created_at: a.created_at,
        vinted_url: a.vinted_url,
        sale_notes: a.sale_notes,
        rawData: a,
      }));

      const lots: UnifiedItem[] = ((lRes.data ?? []) as LotRow[]).map((l) => ({
        id: l.id,
        itemType: "lot",
        title: l.name,
        description: l.description,
        price: l.price,
        status: l.status,
        photos: l.photos,
        created_at: l.created_at,
        vinted_url: l.vinted_url,
        sale_notes: l.sale_notes,
        rawData: l,
      }));

      const unified = [...articles, ...lots].sort(sortByCreatedAtAsc);
      setItems(unified);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      if (selectedItem.status === "processing") {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
    }
  }, [selectedItem?.id, selectedItem?.status]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const isTyping = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as HTMLElement & { isContentEditable?: boolean }).isContentEditable);
      if (isTyping) return;
      if (!selectedItem) return;

      const key = e.key.toLowerCase();
      if (key === "s") { e.preventDefault(); handleStartRun(); }
      if (key === "1") { e.preventDefault(); handleCopyTitle(); }
      if (key === "2") { e.preventDefault(); handleCopyDescription(); }
      if (key === "3") { e.preventDefault(); handleCopyPrice(); }
      if (key === "4") { e.preventDefault(); handleCopyPhotos(); }
      if (key === "5") { e.preventDefault(); handleCopyAllData(); }
      if (key === "u") { e.preventDefault(); urlInputRef.current?.focus(); }
      if (key === "d") { e.preventDefault(); handleMarkDraft(); }
      if (key === "p") { e.preventDefault(); handleMarkPublished(); }
      if (key === "n") { e.preventDefault(); handleNextItem(); }
      if (key === "arrowdown") { e.preventDefault(); handleNextItem(); }
      if (key === "arrowup") { e.preventDefault(); handlePrevItem(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItem, items, selectedIndex]);

  async function handleStartRun() {
    if (!selectedItem) {
      showToast("NO ITEM SELECTED");
      return;
    }

    if (selectedItem.status !== "ready") {
      showToast(`CANNOT START - STATUS IS ${selectedItem.status?.toUpperCase()}`);
      return;
    }

    const table = selectedItem.itemType === "article" ? "articles" : "lots";
    const tag = lockTag(sessionId);
    const newNotes = appendNote(selectedItem.sale_notes, `${tag} ${nowIso()}`);

    console.log(`[AGENT] Starting run for ${table} ${selectedItem.id}`);
    console.log(`[AGENT] Current status: ${selectedItem.status}`);

    const { data, error } = await supabase
      .from(table)
      .update({ status: "processing", sale_notes: newNotes })
      .eq("id", selectedItem.id)
      .eq("status", "ready")
      .select();

    if (error) {
      console.error("[AGENT] Update error:", error);
      showToast("ERROR STARTING RUN");
      return;
    }

    if (!data || data.length === 0) {
      console.warn("[AGENT] No rows updated - item may have been modified by another process");
      showToast("UPDATE FAILED - REFRESHING");
      await fetchItems();
      return;
    }

    console.log("[AGENT] Status updated to processing:", data);
    showToast("RUN STARTED ✓");
    setCurrentStep(2);

    // Update local state immediately
    setItems((prev) => prev.map((item, idx) =>
      idx === selectedIndex ? { ...item, status: "processing", sale_notes: newNotes } : item
    ));

    // Then refresh from database
    await fetchItems();
  }

  async function handleCopyTitle() {
    if (!selectedItem) return;
    const ok = await copyToClipboard(selectedItem.title ?? "");
    showToast(ok ? "TITLE COPIED" : "COPY FAILED");
    if (ok && currentStep === 2) setCurrentStep(3);
  }

  async function handleCopyDescription() {
    if (!selectedItem) return;
    const ok = await copyToClipboard(selectedItem.description ?? "");
    showToast(ok ? "DESCRIPTION COPIED" : "COPY FAILED");
    if (ok && currentStep === 3) setCurrentStep(4);
  }

  async function handleCopyPrice() {
    if (!selectedItem) return;
    const ok = await copyToClipboard(String(selectedItem.price ?? ""));
    showToast(ok ? "PRICE COPIED" : "COPY FAILED");
    if (ok && currentStep === 4) setCurrentStep(5);
  }

  async function handleCopyPhotos() {
    if (!selectedItem) return;
    const urls = normalizePhotoUrls(selectedItem.photos).slice(0, 5);
    const ok = await copyToClipboard(urls.join("\n"));
    showToast(ok ? "PHOTOS COPIED" : "COPY FAILED");
    if (ok && currentStep === 5) setCurrentStep(6);
  }

  async function handleCopyAllData() {
    if (!selectedItem) return;

    const rawData = selectedItem.rawData;
    const photos = normalizePhotoUrls(selectedItem.photos);

    let articleData: Record<string, unknown> = {
      article_id: selectedItem.id,
      status: selectedItem.status,
      type: selectedItem.itemType,
      core_fields: {
        title: selectedItem.title,
        description: selectedItem.description,
        price: {
          amount: selectedItem.price,
          currency: "EUR"
        }
      },
      media: {
        photos_count: photos.length,
        photos_urls: photos
      },
      vinted_mapping: {
        status: selectedItem.status,
        vinted_url: selectedItem.vinted_url,
        notes: selectedItem.sale_notes
      }
    };

    if (selectedItem.itemType === "article") {
      const article = rawData as ArticleRow;
      articleData.attributes = {
        brand: article.brand || null,
        size: article.size || null,
        condition: article.condition || null,
        color: article.color || null,
        material: article.material || null
      };
    } else {
      const lot = rawData as LotRow;
      articleData.attributes = {
        category_id: lot.category_id || null,
        season: lot.season || null,
        original_total_price: lot.original_total_price || null,
        discount_percentage: lot.discount_percentage || null
      };
    }

    const ok = await copyToClipboard(JSON.stringify(articleData, null, 2));
    showToast(ok ? "ALL DATA COPIED ✓" : "COPY FAILED");

    if (ok) {
      setCurrentStep(6);
    }
  }

  async function handleSaveUrl(url: string) {
    if (!selectedItem) return;
    const table = selectedItem.itemType === "article" ? "articles" : "lots";
    const { error } = await supabase.from(table).update({ vinted_url: url || null }).eq("id", selectedItem.id);
    if (!error) {
      setItems((prev) => prev.map((item, idx) => idx === selectedIndex ? { ...item, vinted_url: url || null } : item));
      if (isValidUrl(url) && currentStep === 6) setCurrentStep(7);
      showToast("URL SAVED");
    }
  }

  async function handleMarkDraft() {
    if (!selectedItem || !isValidUrl(selectedItem.vinted_url)) return;
    const table = selectedItem.itemType === "article" ? "articles" : "lots";
    const { error } = await supabase.from(table).update({ status: "vinted_draft" }).eq("id", selectedItem.id);
    if (!error) {
      showToast("MARKED AS DRAFT");
      await fetchItems();
    }
  }

  async function handleMarkPublished() {
    if (!selectedItem || !isValidUrl(selectedItem.vinted_url)) return;
    const table = selectedItem.itemType === "article" ? "articles" : "lots";
    const newNotes = appendNote(selectedItem.sale_notes, doneTag(sessionId));
    const { error } = await supabase.from(table).update({ status: "published", published_at: nowIso(), sale_notes: newNotes }).eq("id", selectedItem.id);
    if (!error) {
      showToast("PUBLISHED!");
      handleNextItem();
      await fetchItems();
    }
  }

  function handleNextItem() {
    if (selectedIndex < items.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setCurrentStep(1);
    }
  }

  function handlePrevItem() {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setCurrentStep(1);
    }
  }

  function selectItem(index: number) {
    setSelectedIndex(index);
    setCurrentStep(1);
  }

  const photos = selectedItem ? normalizePhotoUrls(selectedItem.photos).slice(0, 5) : [];

  return (
    <div id="agent-container" className="min-h-screen bg-slate-100 flex">
      {toast && (
        <div id="agent-toast" className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-slate-900 text-white text-lg font-bold shadow-2xl">
          {toast}
        </div>
      )}

      <aside id="agent-item-list" className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-bold text-slate-800">Items Queue</h2>
          <p id="agent-queue-count" className="text-sm text-slate-600">{items.length} items ready/processing</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-slate-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-slate-500">No items to process</div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                id={`agent-item-${idx}`}
                data-item-id={item.id}
                data-item-status={item.status}
                onClick={() => selectItem(idx)}
                className={`w-full text-left p-4 border-b transition-colors ${
                  idx === selectedIndex
                    ? "bg-slate-800 text-white"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === selectedIndex ? "bg-white text-slate-800" : "bg-slate-200 text-slate-700"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${idx === selectedIndex ? "text-white" : "text-slate-800"}`}>
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${
                        item.status === "processing" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                      }`} />
                      <span className={`text-xs ${idx === selectedIndex ? "text-slate-300" : "text-slate-500"}`}>
                        {item.status} | {item.itemType}
                      </span>
                    </div>
                  </div>
                  {idx === selectedIndex && <ChevronRight className="w-5 h-5" />}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-slate-50">
          <button
            id="agent-btn-refresh"
            onClick={() => fetchItems()}
            className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
          >
            Refresh List
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {!selectedItem ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500 text-xl">Select an item from the queue</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            <div id="agent-current-item" className="bg-white rounded-2xl p-6 shadow-sm border">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span id="agent-item-type" className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedItem.itemType === "article" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {selectedItem.itemType.toUpperCase()}
                    </span>
                    <span id="agent-status-badge" className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedItem.status === "processing" ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {selectedItem.status?.toUpperCase()}
                    </span>
                  </div>
                  <h1 id="agent-item-title" className="text-2xl font-bold text-slate-800 mt-3">
                    {selectedItem.title}
                  </h1>
                  <p id="agent-item-price" className="text-3xl font-bold text-emerald-600 mt-2">
                    {selectedItem.price} EUR
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Item {selectedIndex + 1} of {items.length}</p>
                </div>
              </div>
            </div>

            <div id="agent-workflow-steps" className="bg-white rounded-2xl p-6 shadow-sm border">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Workflow Progress</h2>
              <div className="flex items-center justify-between">
                {WORKFLOW_STEPS.map((step, idx) => (
                  <div key={step.step} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      currentStep > step.step
                        ? "bg-emerald-500 text-white"
                        : currentStep === step.step
                        ? "bg-slate-800 text-white ring-4 ring-slate-300"
                        : "bg-slate-200 text-slate-500"
                    }`}>
                      {currentStep > step.step ? <CheckCircle2 className="w-5 h-5" /> : step.step}
                    </div>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <div className={`w-8 h-1 mx-1 ${currentStep > step.step ? "bg-emerald-500" : "bg-slate-200"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {WORKFLOW_STEPS.map((step) => (
                  <div key={step.step} className="text-center w-10">
                    <p className={`text-xs ${currentStep === step.step ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                      {step.key}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div id="agent-action-panel" className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
              <button
                id="agent-btn-start-run"
                onClick={handleStartRun}
                disabled={selectedItem.status !== "ready"}
                className={`w-full py-5 rounded-xl text-xl font-bold flex items-center justify-center gap-3 transition-all ${
                  selectedItem.status === "ready"
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                } ${currentStep === 1 ? "ring-4 ring-slate-300" : ""}`}
              >
                <Play className="w-6 h-6" />
                STEP 1: START RUN (S)
              </button>

              <div className="grid grid-cols-2 gap-4">
                <button
                  id="agent-btn-copy-title"
                  onClick={handleCopyTitle}
                  className={`py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all bg-blue-50 text-blue-700 hover:bg-blue-100 ${
                    currentStep === 2 ? "ring-4 ring-blue-300" : ""
                  }`}
                >
                  <Copy className="w-5 h-5" />
                  COPY TITLE (1)
                </button>

                <button
                  id="agent-btn-copy-desc"
                  onClick={handleCopyDescription}
                  className={`py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all bg-blue-50 text-blue-700 hover:bg-blue-100 ${
                    currentStep === 3 ? "ring-4 ring-blue-300" : ""
                  }`}
                >
                  <Copy className="w-5 h-5" />
                  COPY DESC (2)
                </button>

                <button
                  id="agent-btn-copy-price"
                  onClick={handleCopyPrice}
                  className={`py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${
                    currentStep === 4 ? "ring-4 ring-emerald-300" : ""
                  }`}
                >
                  <Copy className="w-5 h-5" />
                  COPY PRICE (3)
                </button>

                <button
                  id="agent-btn-copy-photos"
                  onClick={handleCopyPhotos}
                  className={`py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all bg-amber-50 text-amber-700 hover:bg-amber-100 ${
                    currentStep === 5 ? "ring-4 ring-amber-300" : ""
                  }`}
                >
                  <Copy className="w-5 h-5" />
                  COPY PHOTOS (4)
                </button>
              </div>

              <button
                id="agent-btn-copy-all-data"
                onClick={handleCopyAllData}
                className="w-full py-5 rounded-xl text-xl font-bold flex items-center justify-center gap-3 transition-all bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg"
              >
                <Copy className="w-6 h-6" />
                COPY ALL DATA (5)
              </button>

              <div className={`p-4 rounded-xl border-2 transition-all ${currentStep === 6 ? "border-slate-800 bg-slate-50" : "border-slate-200"}`}>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  STEP 6: PASTE VINTED URL (U to focus)
                </label>
                <div className="flex gap-3">
                  <input
                    ref={urlInputRef}
                    id="agent-input-vinted-url"
                    type="text"
                    placeholder="https://www.vinted.fr/..."
                    value={selectedItem.vinted_url ?? ""}
                    onChange={(e) => {
                      const url = e.target.value;
                      setItems((prev) => prev.map((item, idx) => idx === selectedIndex ? { ...item, vinted_url: url } : item));
                    }}
                    onBlur={(e) => handleSaveUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveUrl((e.target as HTMLInputElement).value); }}
                    className="flex-1 px-4 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-800"
                  />
                  {isValidUrl(selectedItem.vinted_url) && (
                    <a
                      id="agent-link-vinted"
                      href={selectedItem.vinted_url ?? ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-4 bg-slate-100 rounded-xl hover:bg-slate-200 flex items-center"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  id="agent-btn-mark-draft"
                  onClick={handleMarkDraft}
                  disabled={!isValidUrl(selectedItem.vinted_url)}
                  className={`py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    isValidUrl(selectedItem.vinted_url)
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-slate-50 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  <FileEdit className="w-5 h-5" />
                  MARK DRAFT (D)
                </button>

                <button
                  id="agent-btn-mark-published"
                  onClick={handleMarkPublished}
                  disabled={!isValidUrl(selectedItem.vinted_url)}
                  className={`py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    isValidUrl(selectedItem.vinted_url)
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-slate-50 text-slate-300 cursor-not-allowed"
                  } ${currentStep === 7 ? "ring-4 ring-emerald-300" : ""}`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  PUBLISH (P)
                </button>
              </div>

              <button
                id="agent-btn-next"
                onClick={handleNextItem}
                disabled={selectedIndex >= items.length - 1}
                className="w-full py-4 rounded-xl text-lg font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                NEXT ITEM (N)
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div id="agent-data-preview" className="bg-white rounded-2xl p-6 shadow-sm border">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Data Preview</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Title</label>
                  <p id="agent-preview-title" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg">{selectedItem.title}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</label>
                  <p id="agent-preview-description" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedItem.description ?? "(empty)"}
                  </p>
                </div>

                {selectedItem.itemType === "article" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Marque</label>
                        <p id="agent-preview-brand" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg">
                          {(selectedItem.rawData as ArticleRow).brand || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Taille</label>
                        <p id="agent-preview-size" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg">
                          {(selectedItem.rawData as ArticleRow).size || "—"}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">État</label>
                        <p id="agent-preview-condition" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg">
                          {(selectedItem.rawData as ArticleRow).condition || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Couleur</label>
                        <p id="agent-preview-color" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg">
                          {(selectedItem.rawData as ArticleRow).color || "—"}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Matière</label>
                        <p id="agent-preview-material" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg">
                          {(selectedItem.rawData as ArticleRow).material || "—"}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Price</label>
                  <p id="agent-preview-price" className="text-slate-800 mt-1 p-3 bg-slate-50 rounded-lg font-mono">{selectedItem.price} EUR</p>
                </div>

                <div>
                  <button
                    onClick={() => setShowPhotos(!showPhotos)}
                    className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide hover:text-slate-700"
                  >
                    Photos ({photos.length})
                    {showPhotos ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showPhotos && (
                    <div id="agent-preview-photos" className="mt-2 space-y-2">
                      {photos.length === 0 ? (
                        <p className="text-slate-400 text-sm">(no photos)</p>
                      ) : (
                        photos.map((url, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                            <img src={url} alt={`Photo ${idx + 1}`} className="w-12 h-12 object-cover rounded" />
                            <p className="text-xs text-slate-600 font-mono truncate flex-1">{url}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div id="agent-error-panel" className="bg-white rounded-2xl p-6 shadow-sm border">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Report Error
              </h2>
              <button
                id="agent-btn-mark-error"
                onClick={async () => {
                  const table = selectedItem.itemType === "article" ? "articles" : "lots";
                  await supabase.from(table).update({ status: "error" }).eq("id", selectedItem.id);
                  showToast("MARKED AS ERROR");
                  await fetchItems();
                }}
                className="w-full py-4 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors"
              >
                MARK AS ERROR (E)
              </button>
            </div>

            <div id="agent-keyboard-help" className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-slate-500">
                <span className="font-medium">Keyboard:</span>{" "}
                S=Start | 1=Title | 2=Desc | 3=Price | 4=Photos | 5=All Data | U=URL | D=Draft | P=Publish | N=Next | Up/Down=Navigate
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
