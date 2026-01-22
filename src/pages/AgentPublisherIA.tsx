import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Play, CheckCircle2, File as FileEdit, ChevronRight, Copy, ExternalLink, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

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

type WorkflowStep = 1 | 2 | 3 | 4 | 5;

const WORKFLOW_STEPS = [
  { step: 1, label: "Start Run", key: "Start" },
  { step: 2, label: "Copy All Data", key: "Copy" },
  { step: 3, label: "Paste Vinted URL", key: "Paste URL" },
  { step: 4, label: "Update Status", key: "Update Status" },
  { step: 5, label: "Finish", key: "Finish" },
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


export default function AgentPublisherIA() {
  const sessionId = useMemo(() => ensureSessionId(), []);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [mobileView, setMobileView] = useState<"queue" | "workflow">("workflow");
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
      const articlesSelect = "id,user_id,title,description,price,brand,size,condition,color,material,status,photos,sale_notes,created_at,vinted_url,scheduled_for";
      const lotsSelect = "id,user_id,name,description,category_id,season,price,original_total_price,discount_percentage,photos,status,sale_notes,created_at,vinted_url,scheduled_for";

      // Get today's date at end of day (23:59:59)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayIso = today.toISOString();

      const [
        articlesReady,
        articlesScheduled,
        articlesProcessing,
        lotsReady,
        lotsScheduled,
        lotsProcessing
      ] = await Promise.all([
        // Articles with status 'ready' (no date condition)
        supabase.from("articles").select(articlesSelect).eq("status", "ready").order("created_at", { ascending: true }),
        // Articles with status 'scheduled' and scheduled_for <= today
        supabase.from("articles").select(articlesSelect).eq("status", "scheduled").lte("scheduled_for", todayIso).order("created_at", { ascending: true }),
        // Articles with status 'processing' (no date condition)
        supabase.from("articles").select(articlesSelect).eq("status", "processing").order("created_at", { ascending: true }),
        // Lots with status 'ready' (no date condition)
        supabase.from("lots").select(lotsSelect).eq("status", "ready").order("created_at", { ascending: true }),
        // Lots with status 'scheduled' and scheduled_for <= today
        supabase.from("lots").select(lotsSelect).eq("status", "scheduled").lte("scheduled_for", todayIso).order("created_at", { ascending: true }),
        // Lots with status 'processing' (no date condition)
        supabase.from("lots").select(lotsSelect).eq("status", "processing").order("created_at", { ascending: true })
      ]);

      const allArticlesData = [
        ...(articlesReady.data ?? []),
        ...(articlesScheduled.data ?? []),
        ...(articlesProcessing.data ?? [])
      ];

      const allLotsData = [
        ...(lotsReady.data ?? []),
        ...(lotsScheduled.data ?? []),
        ...(lotsProcessing.data ?? [])
      ];

      const articles: UnifiedItem[] = (allArticlesData as ArticleRow[]).map((a) => ({
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

      const lots: UnifiedItem[] = (allLotsData as LotRow[]).map((l) => ({
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

      // Sort by oldest to recent (FIFO - ascending)
      const unified = [...articles, ...lots].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
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
      if (key === "1") { e.preventDefault(); handleCopyAllData(); }
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

    setItems((prev) => prev.map((item, idx) =>
      idx === selectedIndex ? { ...item, status: "processing", sale_notes: newNotes } : item
    ));

    await fetchItems();
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
      setCurrentStep(3);
    }
  }

  async function handleSaveUrl(url: string) {
    if (!selectedItem) return;
    const table = selectedItem.itemType === "article" ? "articles" : "lots";
    const { error } = await supabase.from(table).update({ vinted_url: url || null }).eq("id", selectedItem.id);
    if (!error) {
      setItems((prev) => prev.map((item, idx) => idx === selectedIndex ? { ...item, vinted_url: url || null } : item));
      if (isValidUrl(url) && currentStep === 3) setCurrentStep(4);
      showToast("URL SAVED");
    }
  }

  async function handleMarkDraft() {
    if (!selectedItem || !isValidUrl(selectedItem.vinted_url)) return;
    const table = selectedItem.itemType === "article" ? "articles" : "lots";
    const { error } = await supabase.from(table).update({ status: "vinted_draft" }).eq("id", selectedItem.id);
    if (!error) {
      showToast("MARKED AS DRAFT");
      setCurrentStep(5);
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
      setCurrentStep(5);
      await fetchItems();
      setTimeout(() => handleNextItem(), 800);
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
    <div id="agent-container" className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {toast && (
        <div id="agent-toast" className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 sm:px-6 sm:py-3 rounded-xl bg-slate-900 text-white text-sm sm:text-lg font-bold shadow-2xl">
          {toast}
        </div>
      )}

      {/* Mobile Tabs */}
      <div className="lg:hidden sticky top-0 z-20 bg-white border-b flex">
        <button
          onClick={() => setMobileView("queue")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            mobileView === "queue"
              ? "bg-slate-800 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Items Queue ({items.length})
        </button>
        <button
          onClick={() => setMobileView("workflow")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            mobileView === "workflow"
              ? "bg-slate-800 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Workflow
        </button>
      </div>

      <aside id="agent-item-list" className={`w-full lg:w-80 bg-white lg:border-r flex flex-col ${
        mobileView === "queue" ? "flex" : "hidden lg:flex"
      }`}>
        <div className="p-3 lg:p-4 border-b bg-slate-50">
          <h2 className="font-bold text-slate-800 text-sm lg:text-base">Items Queue</h2>
          <p id="agent-queue-count" className="text-xs lg:text-sm text-slate-600">{items.length} items ready/processing</p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-180px)] lg:max-h-none">
          {loading ? (
            <div className="p-3 lg:p-4 text-slate-500 text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-3 lg:p-4 text-slate-500 text-sm">No items to process</div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                id={`agent-item-${idx}`}
                data-item-id={item.id}
                data-item-status={item.status}
                onClick={() => {
                  selectItem(idx);
                  setMobileView("workflow");
                }}
                className={`w-full text-left p-3 lg:p-4 border-b transition-colors ${
                  idx === selectedIndex
                    ? "bg-slate-800 text-white"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 lg:gap-3">
                  <span className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold ${
                    idx === selectedIndex ? "bg-white text-slate-800" : "bg-slate-200 text-slate-700"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs lg:text-sm font-medium truncate ${idx === selectedIndex ? "text-white" : "text-slate-800"}`}>
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
                  {idx === selectedIndex && <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-3 lg:p-4 border-t bg-slate-50">
          <button
            id="agent-btn-refresh"
            onClick={() => fetchItems()}
            className="w-full py-2 lg:py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors text-sm lg:text-base"
          >
            Refresh List
          </button>
        </div>
      </aside>

      <main className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto ${
        mobileView === "workflow" ? "block" : "hidden lg:block"
      }`}>
        {!selectedItem ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500 text-base lg:text-xl">Select an item from the queue</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4 lg:space-y-6">
            <div id="agent-workflow-steps" className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border">
              <h2 className="text-base lg:text-lg font-bold text-slate-800 mb-3 lg:mb-4">Workflow Progress</h2>
              <div className="flex items-center justify-between">
                {WORKFLOW_STEPS.map((step, idx) => (
                  <div key={step.step} className="flex items-center">
                    <div className={`w-7 h-7 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold transition-all ${
                      currentStep > step.step
                        ? "bg-emerald-500 text-white"
                        : currentStep === step.step
                        ? "bg-slate-800 text-white ring-2 lg:ring-4 ring-slate-300"
                        : "bg-slate-200 text-slate-500"
                    }`}>
                      {currentStep > step.step ? <CheckCircle2 className="w-3 h-3 lg:w-5 lg:h-5" /> : step.step}
                    </div>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <div className={`w-4 lg:w-8 h-1 mx-0.5 lg:mx-1 ${currentStep > step.step ? "bg-emerald-500" : "bg-slate-200"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 lg:mt-3 px-0.5 lg:px-1">
                {WORKFLOW_STEPS.map((step) => (
                  <div key={step.step} className="text-center flex-1">
                    <p className={`text-[10px] lg:text-xs font-medium ${currentStep === step.step ? "text-slate-800" : "text-slate-500"}`}>
                      {step.key}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div id="agent-action-panel" className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border space-y-3 lg:space-y-4">
              <button
                id="agent-btn-start-run"
                onClick={handleStartRun}
                disabled={selectedItem.status !== "ready"}
                className={`w-full py-4 lg:py-5 rounded-xl text-base lg:text-xl font-bold flex items-center justify-center gap-2 lg:gap-3 transition-all ${
                  selectedItem.status === "ready"
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                } ${currentStep === 1 ? "ring-2 lg:ring-4 ring-slate-300" : ""}`}
              >
                <Play className="w-4 h-4 lg:w-6 lg:h-6" />
                STEP 1: START RUN
              </button>

              <button
                id="agent-btn-copy-all-data"
                onClick={handleCopyAllData}
                className={`w-full py-4 lg:py-5 rounded-xl text-base lg:text-xl font-bold flex items-center justify-center gap-2 lg:gap-3 transition-all bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg ${currentStep === 2 ? "ring-2 lg:ring-4 ring-blue-300" : ""}`}
              >
                <Copy className="w-4 h-4 lg:w-6 lg:h-6" />
                STEP 2: COPY ITEM DATA
              </button>

              <div className={`p-3 lg:p-4 rounded-xl border-2 transition-all ${currentStep === 3 ? "border-slate-800 bg-slate-50" : "border-slate-200"}`}>
                <label className="text-xs lg:text-sm font-medium text-slate-700 block mb-2">
                  STEP 3: PASTE VINTED URL
                </label>
                <div className="flex gap-2 lg:gap-3">
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
                    className="flex-1 px-3 py-3 lg:px-4 lg:py-4 text-sm lg:text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-800"
                  />
                  {isValidUrl(selectedItem.vinted_url) && (
                    <a
                      id="agent-link-vinted"
                      href={selectedItem.vinted_url ?? ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-3 lg:px-4 lg:py-4 bg-slate-100 rounded-xl hover:bg-slate-200 flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 lg:w-5 lg:h-5" />
                    </a>
                  )}
                </div>
              </div>

              <div className={`p-3 lg:p-4 rounded-xl border-2 transition-all ${currentStep === 4 ? "border-slate-800 bg-slate-50" : "border-slate-200"}`}>
                <div className="text-xs lg:text-sm font-semibold text-slate-700 mb-2 lg:mb-3 tracking-wide">
                  STEP 4: UPDATE STATUS
                </div>
                <div className="grid grid-cols-2 gap-3 lg:gap-4">
                  <button
                    id="agent-btn-mark-draft"
                    onClick={handleMarkDraft}
                    disabled={!isValidUrl(selectedItem.vinted_url)}
                    className={`py-4 lg:py-5 rounded-xl text-sm lg:text-lg font-bold flex items-center justify-center gap-2 transition-all ${
                      isValidUrl(selectedItem.vinted_url)
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-slate-50 text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <FileEdit className="w-4 h-4 lg:w-5 lg:h-5" />
                    <span className="hidden sm:inline">MARK</span> DRAFT
                  </button>

                  <button
                    id="agent-btn-mark-published"
                    onClick={handleMarkPublished}
                    disabled={!isValidUrl(selectedItem.vinted_url)}
                    className={`py-4 lg:py-5 rounded-xl text-sm lg:text-lg font-bold flex items-center justify-center gap-2 transition-all ${
                      isValidUrl(selectedItem.vinted_url)
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-slate-50 text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5" />
                    PUBLISH
                  </button>
                </div>
              </div>

              <button
                id="agent-btn-next"
                onClick={handleNextItem}
                disabled={selectedIndex >= items.length - 1}
                className="w-full py-3 lg:py-4 rounded-xl text-base lg:text-lg font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                NEXT ITEM
                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>

            <div id="agent-error-panel" className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border">
              <h2 className="text-base lg:text-lg font-bold text-slate-800 mb-3 lg:mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-red-500" />
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
                className="w-full py-3 lg:py-4 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors text-sm lg:text-base"
              >
                MARK AS ERROR
              </button>
            </div>

            
          </div>
        )}
      </main>
    </div>
  );
}
