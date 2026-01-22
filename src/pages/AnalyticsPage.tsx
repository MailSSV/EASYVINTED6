import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  Package,
  ShoppingBag,
  Sparkles,
  AlertTriangle,
  Users,
  Trophy,
  Medal,
  Award,
  Search,
  FileText,
  Clock,
  Send,
  DollarSign,
  Layers,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { AdminDetailDrawer } from "../components/admin/AdminDetailDrawer";
import { Toast } from "../components/ui/Toast";
import { ArticleFormDrawer } from "../components/admin/ArticleFormDrawer";
import { ArticleSoldModal } from "../components/ArticleSoldModal";
import { LotSoldModal } from "../components/LotSoldModal";
import { ArticleStatusModal } from "../components/ArticleStatusModal";
import { ArticleStatus } from "../types/article";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { LazyImage } from "../components/ui/LazyImage";
import { useImageUrl } from "../hooks/useImageUrls";

type TimeRange = "7d" | "30d" | "90d" | "all";
type DateMode = "sold" | "created"; // extensible: "published"
type SortMode = "profit" | "revenue" | "conversion" | "sales";

type ItemStatus =
  | "draft"
  | "ready"
  | "processing"
  | "published"
  | "scheduled"
  | "sold"
  | "vendu_en_lot"
  | "error"
  | string;

type BaseItem = {
  id: string;
  user_id: string;
  created_at: string;

  // seller
  seller_id?: string | null;

  // status
  status: ItemStatus;

  // money
  sold_at?: string | null;
  sold_price?: string | number | null;
  fees?: string | number | null;
  shipping_cost?: string | number | null;
  net_profit?: string | number | null;

  // product
  title?: string | null;
  brand?: string | null;
  photos?: any;
  price?: string | number | null;
  season?: string | null;
  scheduled_for?: string | null;
  published_at?: string | null;
  reference_number?: string | null;
};

type ArticleRow = BaseItem & {
  // articles table fields you have (partial)
  platform?: string | null;
};

type LotRow = BaseItem & {
  // lots table fields (partial)
  name?: string | null;
  platform?: string | null;
};

type UnifiedItem = (ArticleRow | LotRow) & {
  kind: "article" | "lot";
};

interface SellerStats {
  id: string;
  name: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
  conversionRate: number; // sold / published
  itemsPublished: number;
  itemsSold: number;
}

interface Metrics {
  totalItems: number;
  totalArticles: number;
  totalLots: number;

  // pipeline counts (creation-based)
  draft: number;
  ready: number;
  processing: number;
  vinted_draft: number;
  publishedLike: number; // published+scheduled+sold+vendu_en_lot
  sold: number; // sold items + sold lots
  error: number;

  // sales metrics (sold-based, but we allow dateMode to drive scope)
  soldTransactions: number; // sold items + sold lots
  totalRevenue: number;
  totalFees: number;
  totalShipping: number;
  totalNetProfit: number;
  avgSalePrice: number;
  conversionRate: number; // soldTransactions / publishedLike (same scope)
}

const nfCurrency = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const nfNumber = new Intl.NumberFormat("fr-FR");
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function toNumber(v: any) {
  const n = typeof v === "number" ? v : parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function formatDateFR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit" });
}

function getItemTitle(item: UnifiedItem): string {
  if (item.kind === "lot") {
    return (item as LotRow).name || "Sans titre";
  }
  return item.title || "Sans titre";
}

function getRangeDays(r: TimeRange) {
  if (r === "7d") return 7;
  if (r === "30d") return 30;
  if (r === "90d") return 90;
  return null;
}

function getCutoffDate(range: TimeRange, offsetPeriods = 0) {
  const days = getRangeDays(range);
  if (!days) return null;
  const now = new Date();
  // offsetPeriods = 1 => previous period
  const end = new Date(now.getTime() - offsetPeriods * days * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function inWindow(dateIso: string | null | undefined, start: Date, end: Date) {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  return d >= start && d < end;
}

function getThumbUrl(item: UnifiedItem): string | null {
  // Works with many shapes: string[], [{url}], json string, etc.
  const p = (item as any).photos;
  try {
    if (!p) return null;
    if (Array.isArray(p)) {
      const first = p[0];
      if (!first) return null;
      if (typeof first === "string") return first;
      if (typeof first === "object" && first.url) return first.url;
      return null;
    }
    if (typeof p === "string") {
      // might be JSON or a direct URL
      if (p.startsWith("http")) return p;
      const parsed = JSON.parse(p);
      if (Array.isArray(parsed) && parsed[0]) return typeof parsed[0] === "string" ? parsed[0] : parsed[0]?.url ?? null;
      return null;
    }
    if (typeof p === "object" && p.url) return p.url;
    return null;
  } catch {
    return null;
  }
}

function ItemThumbnail({ item }: { item: UnifiedItem }) {
  const photoPath = getThumbUrl(item);
  const imageUrl = useImageUrl(photoPath || undefined);

  if (!imageUrl) {
    return (
      <div className="w-10 h-10 rounded-xl bg-gray-100 ring-1 ring-gray-200 overflow-hidden flex items-center justify-center">
        <Package className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  return (
    <LazyImage
      src={imageUrl}
      alt={getItemTitle(item)}
      className="w-10 h-10 rounded-xl object-cover ring-1 ring-gray-200"
      fallback={
        <div className="w-10 h-10 rounded-xl bg-gray-100 ring-1 ring-gray-200 overflow-hidden flex items-center justify-center">
          <Package className="w-5 h-5 text-gray-400" />
        </div>
      }
    />
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 32;
  const pad = 2;

  const safe = values.length ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  const points = safe
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, safe.length - 1);
      const y = h - pad - ((v - min) * (h - pad * 2)) / range;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ children, tone = "gray" }: { children: any; tone?: "gray" | "slate" | "emerald" | "orange" | "red" | "blue" | "violet" | "teal" }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "teal"
      ? "bg-teal-50 text-teal-700 ring-teal-200"
      : tone === "orange"
      ? "bg-orange-50 text-orange-700 ring-orange-200"
      : tone === "red"
      ? "bg-red-50 text-red-700 ring-red-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : tone === "violet"
      ? "bg-violet-50 text-violet-700 ring-violet-200"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700 ring-slate-200"
      : "bg-gray-50 text-gray-700 ring-gray-200";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>{children}</span>;
}

function statusTone(status: ItemStatus): "gray" | "slate" | "emerald" | "orange" | "red" | "blue" | "violet" | "teal" {
  const s = String(status).toLowerCase();
  if (s === "sold") return "emerald";
  if (s === "vendu_en_lot") return "teal";
  if (s === "published") return "violet";
  if (s === "vinted_draft") return "violet";
  if (s === "scheduled") return "orange";
  if (s === "ready") return "blue";
  if (s === "processing") return "orange";
  if (s === "error") return "red";
  if (s === "draft") return "slate";
  return "gray";
}

function prettyStatus(status: ItemStatus) {
  const s = String(status).toLowerCase();
  const map: Record<string, string> = {
    draft: "Brouillon",
    ready: "Prêt",
    processing: "En cours",
    published: "Publié",
    scheduled: "Planifié",
    sold: "Vendu",
    vendu_en_lot: "Vendu en lot",
    error: "Erreur",
    vinted_draft: "Brouillon Vinted",
  };
  return map[s] ?? status;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; activeColor: string }> = {
  draft: { label: 'Brouillon', color: 'bg-slate-50 text-slate-600 border-slate-200', activeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
  ready: { label: 'Prêts', color: 'bg-blue-50 text-blue-600 border-blue-200', activeColor: 'bg-blue-100 text-blue-700 border-blue-200' },
  processing: { label: 'En cours', color: 'bg-orange-50 text-orange-600 border-orange-200', activeColor: 'bg-orange-100 text-orange-700 border-orange-200' },
  scheduled: { label: 'Planifiés', color: 'bg-orange-50 text-orange-600 border-orange-200', activeColor: 'bg-orange-100 text-orange-700 border-orange-200' },
  vinted_draft: { label: 'Brouillon Vinted', color: 'bg-violet-50 text-violet-600 border-violet-200', activeColor: 'bg-violet-100 text-violet-700 border-violet-200' },
  published: { label: 'Publiés', color: 'bg-violet-50 text-violet-600 border-violet-200', activeColor: 'bg-violet-100 text-violet-700 border-violet-200' },
  sold: { label: 'Vendus', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', activeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  vendu_en_lot: { label: 'Vendus en lot', color: 'bg-teal-50 text-teal-600 border-teal-200', activeColor: 'bg-teal-100 text-teal-700 border-teal-200' },
  error: { label: 'Erreurs', color: 'bg-red-50 text-red-600 border-red-200', activeColor: 'bg-red-100 text-red-700 border-red-200' },
  all: { label: 'Tous', color: 'bg-gray-50 text-gray-600 border-gray-200', activeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function renderStatusIcon(status: string) {
  const iconClass = 'w-3.5 h-3.5';
  switch (status) {
    case 'draft': return <FileText className={iconClass} />;
    case 'ready': return <CheckCircle2 className={iconClass} />;
    case 'scheduled': return <Clock className={iconClass} />;
    case 'vinted_draft': return <Send className={iconClass} />;
    case 'published': return <Send className={iconClass} />;
    case 'sold': return <DollarSign className={iconClass} />;
    case 'vendu_en_lot': return <Layers className={iconClass} />;
    case 'processing': return <Loader2 className={`${iconClass} animate-spin`} />;
    case 'error': return <AlertCircle className={iconClass} />;
    case 'all': return <Package className={iconClass} />;
    default: return null;
  }
}


function PeriodSelector({
  timeRange,
  setTimeRange,
}: {
  timeRange: TimeRange;
  setTimeRange: (v: TimeRange) => void;
}) {
  const opts: { key: TimeRange; label: string }[] = [
    { key: "7d", label: "7j" },
    { key: "30d", label: "30j" },
    { key: "90d", label: "90j" },
    { key: "all", label: "Tout" },
  ];
  return (
    <div className="inline-flex rounded-xl bg-white ring-1 ring-gray-200 shadow-sm p-1">
      {opts.map((o) => {
        const active = timeRange === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setTimeRange(o.key)}
            className={`px-3 py-2 text-sm font-semibold rounded-lg transition ${
              active ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DateModeSelector({
  dateMode,
  setDateMode,
}: {
  dateMode: DateMode;
  setDateMode: (v: DateMode) => void;
}) {
  const opts: { key: DateMode; label: string; hint: string; icon: any }[] = [
    {
      key: "created",
      label: "Créations",
      hint: "Filtre la période par date de création (created_at). Idéal pour production & backlog.",
      icon: CalendarDays,
    },
    {
      key: "sold",
      label: "Ventes",
      hint: "Filtre la période par date de vente (sold_at). Idéal pour CA & profit.",
      icon: CircleDollarSign,
    },
  ];

  return (
    <div className="inline-flex rounded-xl bg-white ring-1 ring-gray-200 shadow-sm p-1">
      {opts.map((o) => {
        const active = dateMode === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            onClick={() => setDateMode(o.key)}
            title={o.hint}
            className={`px-3 py-2 text-sm font-semibold rounded-lg transition inline-flex items-center gap-2 ${
              active ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DeltaPill({ current, previous, isMoney = false }: { current: number; previous: number; isMoney?: boolean }) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    // show neutral if previous not available
    return <span className="text-xs text-gray-500">—</span>;
  }
  const delta = (current - previous) / Math.abs(previous);
  const up = delta >= 0;
  const pct = Math.abs(delta) * 100;
  const tone = up ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200";
  const arrow = up ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ring-1 ${tone}`}>
      <span>{arrow}</span>
      <span>{pct.toFixed(0)}%</span>
      <span className="opacity-70">{isMoney ? "" : ""}</span>
    </span>
  );
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // UX state
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [dateMode, setDateMode] = useState<DateMode>("created");

  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<ItemStatus[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("profit");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<UnifiedItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editArticleId, setEditArticleId] = useState<string | undefined>(undefined);
  const [soldModalOpen, setSoldModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; type: 'article' | 'lot' } | null>(null);

  // data
  const [itemsAll, setItemsAll] = useState<UnifiedItem[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user) void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadAll() {
    if (!user) return;
    try {
      setLoading(true);

      const [articlesResult, lotsResult, membersResult] = await Promise.all([
        supabase.from("articles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("lots").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("family_members").select("id, name").eq("user_id", user.id),
      ]);

      if (articlesResult.error) throw articlesResult.error;
      if (lotsResult.error) throw lotsResult.error;
      if (membersResult.error) throw membersResult.error;

      const articles = (articlesResult.data || []) as ArticleRow[];
      const lots = (lotsResult.data || []) as LotRow[];
      const mem = (membersResult.data || []) as { id: string; name: string }[];

      const unified: UnifiedItem[] = [
        ...articles.map((a) => ({ ...a, kind: "article" as const })),
        ...lots.map((l) => ({ ...l, kind: "lot" as const })),
      ];

      // keep stable order (recent first by created_at)
      unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setMembers(mem);
      setItemsAll(unified);
    } catch (e) {
      console.error("Error loading analytics:", e);
    } finally {
      setLoading(false);
    }
  }

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.name));
    return m;
  }, [members]);

  // ---------- PERIOD SCOPES ----------
  const period = useMemo(() => getCutoffDate(timeRange, 0), [timeRange]);
  const prevPeriod = useMemo(() => getCutoffDate(timeRange, 1), [timeRange]);

  const dateField = (it: UnifiedItem) => {
    if (dateMode === "sold") return it.sold_at ?? null;
    return it.created_at ?? null;
  };

  const itemsInScope = useMemo(() => {
    if (!period) return itemsAll;
    const { start, end } = period;
    return itemsAll.filter((it) => inWindow(dateField(it), start, end));
  }, [itemsAll, period, dateMode]);

  const itemsInPrevScope = useMemo(() => {
    if (!prevPeriod) return [];
    const { start, end } = prevPeriod;
    return itemsAll.filter((it) => inWindow(dateField(it), start, end));
  }, [itemsAll, prevPeriod, dateMode]);

  // ---------- METRICS ----------
  const computeMetrics = (scope: UnifiedItem[]): Metrics => {
    const articles = scope.filter((x) => x.kind === "article");
    const lots = scope.filter((x) => x.kind === "lot");

    const soldArticles = articles.filter((a) => String(a.status).toLowerCase() === "sold" && a.sold_at);
    const soldLots = lots.filter((l) => String(l.status).toLowerCase() === "sold" && l.sold_at);

    const totalRevenue = [...soldArticles, ...soldLots].reduce((sum, x) => sum + toNumber(x.sold_price), 0);
    const totalFees = [...soldArticles, ...soldLots].reduce((sum, x) => sum + toNumber(x.fees), 0);
    const totalShipping = [...soldArticles, ...soldLots].reduce((sum, x) => sum + toNumber(x.shipping_cost), 0);
    const totalNetProfit = [...soldArticles, ...soldLots].reduce((sum, x) => sum + toNumber(x.net_profit), 0);

    // pipeline-like counts (within the SAME scope, regardless of dateMode)
    const s = (x: UnifiedItem) => String(x.status).toLowerCase();
    const draft = scope.filter((x) => s(x) === "draft").length;
    const ready = scope.filter((x) => s(x) === "ready").length;
    const processing = scope.filter((x) => s(x) === "processing").length;
    const vinted_draft = scope.filter((x) => s(x) === "vinted_draft").length;
    const sold = scope.filter((x) => s(x) === "sold").length;
    const error = scope.filter((x) => s(x) === "error").length;

    const publishedLike = scope.filter((x) => ["published", "scheduled", "sold", "vendu_en_lot"].includes(s(x))).length;

    const soldTransactions = soldArticles.length + soldLots.length;
    const avgSalePrice = soldTransactions > 0 ? totalRevenue / soldTransactions : 0;
    const conversionRate = publishedLike > 0 ? (soldTransactions / publishedLike) * 100 : 0;

    return {
      totalItems: scope.length,
      totalArticles: articles.length,
      totalLots: lots.length,

      draft,
      ready,
      processing,
      vinted_draft,
      publishedLike,
      sold,
      error,

      soldTransactions,
      totalRevenue,
      totalFees,
      totalShipping,
      totalNetProfit,
      avgSalePrice,
      conversionRate,
    };
  };

  const metrics = useMemo(() => computeMetrics(itemsInScope), [itemsInScope]);
  const metricsPrev = useMemo(() => computeMetrics(itemsInPrevScope), [itemsInPrevScope]);

  // ---------- STATUS CHIPS (fast filters) ----------
  const statusChips = useMemo(() => {
    const s = (x: UnifiedItem) => String(x.status).toLowerCase();

    const counts = {
      draft: itemsInScope.filter((x) => s(x) === "draft").length,
      ready: itemsInScope.filter((x) => s(x) === "ready").length,
      processing: itemsInScope.filter((x) => s(x) === "processing").length,
      vinted_draft: itemsInScope.filter((x) => s(x) === "vinted_draft").length,
      published: itemsInScope.filter((x) => s(x) === "published").length,
      scheduled: itemsInScope.filter((x) => s(x) === "scheduled").length,
      sold: itemsInScope.filter((x) => s(x) === "sold").length,
      vendu_en_lot: itemsInScope.filter((x) => s(x) === "vendu_en_lot").length,
      error: itemsInScope.filter((x) => s(x) === "error").length,
    };

    return [
      { key: "all" as const, label: "Tous", count: itemsInScope.length, tone: "gray" as const },
      { key: "draft" as const, label: "Brouillons", count: counts.draft, tone: "slate" as const },
      { key: "ready" as const, label: "Prêts", count: counts.ready, tone: "blue" as const },
      { key: "scheduled" as const, label: "Planifiés", count: counts.scheduled, tone: "orange" as const },
      { key: "vinted_draft" as const, label: "Brouillon Vinted", count: counts.vinted_draft, tone: "violet" as const },
      { key: "published" as const, label: "Publiés", count: counts.published, tone: "violet" as const },
      { key: "sold" as const, label: "Vendus", count: counts.sold, tone: "emerald" as const },
      { key: "vendu_en_lot" as const, label: "Vendus en lot", count: counts.vendu_en_lot, tone: "teal" as const },
      { key: "error" as const, label: "Erreurs", count: counts.error, tone: "red" as const },
    ];
  }, [itemsInScope]);

  // ---------- TABLE DATA ----------
  const filteredTableItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    const normStatus = (x: UnifiedItem) => String(x.status).toLowerCase();
    return itemsInScope
      .filter((it) => {
        if (statusFilters.length > 0) {
          const st = normStatus(it);
          const hasMatch = statusFilters.some((filter) => {
            const filterLower = String(filter).toLowerCase();
            return st === filterLower;
          });
          if (!hasMatch) return false;
        }
        if (!q) return true;

        const sellerName = it.seller_id ? memberNameById.get(it.seller_id) || "" : "";
        const hay = [
          getItemTitle(it),
          it.brand ?? "",
          sellerName,
          it.kind,
          it.status,
          it.reference_number ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      })
      .sort((a, b) => {
        if (dateMode === "sold") {
          const da = a.sold_at ? new Date(a.sold_at).getTime() : 0;
          const db = b.sold_at ? new Date(b.sold_at).getTime() : 0;
          return db - da;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [itemsInScope, search, statusFilters, memberNameById, dateMode]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilters, timeRange, dateMode]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTableItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredTableItems.slice(startIndex, endIndex);

  // ---------- SELLER STATS ----------
  const sellerStats = useMemo(() => {
    // Compute on the CURRENT scope, but conversion is sold/published-like in same scope.
    // You can switch to "created-only scope" if you prefer operational view.
    const scope = itemsInScope;

    const s = (x: UnifiedItem) => String(x.status).toLowerCase();
    const isPublishedLike = (x: UnifiedItem) => ["published", "scheduled", "sold", "vendu_en_lot"].includes(s(x));
    const isSold = (x: UnifiedItem) => s(x) === "sold" && x.sold_at;

    const map = new Map<string, SellerStats>();

    const ensure = (id: string, name: string) => {
      if (!map.has(id)) {
        map.set(id, {
          id,
          name,
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          averagePrice: 0,
          conversionRate: 0,
          itemsPublished: 0,
          itemsSold: 0,
        });
      }
      return map.get(id)!;
    };

    // seed known members (stable ordering)
    members.forEach((m) => ensure(m.id, m.name));

    // aggregate
    scope.forEach((it) => {
      const id = it.seller_id || "no-seller";
      const name = it.seller_id ? memberNameById.get(it.seller_id) || "—" : "Sans vendeur";

      const row = ensure(id, name);

      if (isPublishedLike(it)) row.itemsPublished += 1;
      if (isSold(it)) {
        row.itemsSold += 1;
        row.totalSales += 1;
        row.totalRevenue += toNumber(it.sold_price);
        row.totalProfit += toNumber(it.net_profit);
      }
    });

    // finalize
    const arr = Array.from(map.values()).map((x) => {
      const avg = x.totalSales > 0 ? x.totalRevenue / x.totalSales : 0;
      const conv = x.itemsPublished > 0 ? (x.itemsSold / x.itemsPublished) * 100 : 0;
      return { ...x, averagePrice: avg, conversionRate: conv };
    });

    // remove empty rows (optional, keep "Sans vendeur" if it has data)
    const cleaned = arr.filter((x) => x.itemsPublished > 0 || x.itemsSold > 0 || x.totalRevenue > 0);

    const sort = (a: SellerStats, b: SellerStats) => {
      if (sortMode === "profit") return b.totalProfit - a.totalProfit;
      if (sortMode === "revenue") return b.totalRevenue - a.totalRevenue;
      if (sortMode === "sales") return b.totalSales - a.totalSales;
      return b.conversionRate - a.conversionRate;
    };

    return cleaned.sort(sort);
  }, [itemsInScope, members, memberNameById, sortMode]);

  // ---------- SIMPLE TREND SERIES (sparkline) ----------
  const trendSeries = useMemo(() => {
    // lightweight trend: bucket by day for 14 points (or less)
    // uses current scope items, but measures depend on dateMode:
    // - sold mode: revenue per day of sold_at (sold items)
    // - created mode: items created per day
    const points = 14;
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const buckets = Array.from({ length: points }, (_, i) => {
      const start = new Date(now.getTime() - (points - i) * dayMs);
      const end = new Date(start.getTime() + dayMs);
      return { start, end };
    });

    if (dateMode === "sold") {
      return buckets.map(({ start, end }) => {
        const soldThatDay = itemsAll.filter((it) => {
          const st = String(it.status).toLowerCase();
          if (st !== "sold" || !it.sold_at) return false;
          return inWindow(it.sold_at, start, end);
        });
        return soldThatDay.reduce((sum, it) => sum + toNumber(it.sold_price), 0);
      });
    }

    return buckets.map(({ start, end }) => {
      const createdThatDay = itemsAll.filter((it) => inWindow(it.created_at, start, end));
      return createdThatDay.length;
    });
  }, [itemsAll, dateMode]);

  const insights = useMemo(() => {
    const sold = metrics.soldTransactions;
    const published = metrics.publishedLike;
    const error = metrics.error;

    const bestSeller = sellerStats[0];
    const bestSellerLine = bestSeller
      ? `${bestSeller.name} est #1 en ${
          sortMode === "profit" ? "bénéfice" : sortMode === "revenue" ? "CA" : sortMode === "sales" ? "ventes" : "conversion"
        }.`
      : "Pas assez de données vendeur sur la période.";

    const convLine =
      published > 0
        ? `Conversion : ${metrics.conversionRate.toFixed(1)}% (${sold} vendus / ${published} publiés).`
        : "Conversion : pas de base publiée sur la période.";

    const errLine = error > 0 ? `⚠️ ${error} élément(s) en erreur : clique “Erreurs” pour diagnostiquer.` : "✅ Aucun statut “Erreur” sur la période.";

    return [bestSellerLine, convLine, errLine];
  }, [metrics, sellerStats, sortMode]);

  function convertToAdminItem(it: UnifiedItem | null): any {
    if (!it) return null;
    return {
      id: it.id,
      user_id: it.user_id,
      type: it.kind,
      title: getItemTitle(it),
      brand: it.brand,
      price: it.price || 0,
      status: it.status,
      photos: it.photos || [],
      created_at: it.created_at,
      season: it.season,
      scheduled_for: it.scheduled_for,
      seller_id: it.seller_id,
      seller_name: it.seller_id ? memberNameById.get(it.seller_id) : undefined,
      published_at: it.published_at,
      sold_at: it.sold_at,
      sold_price: it.sold_price,
      reference_number: it.reference_number,
    };
  }

  function formatDate(date?: string): string {
    if (!date) return "—";
    return formatDateFR(date);
  }

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type });
  }

  function openItem(it: UnifiedItem) {
    setDrawerItem(it);
    setDrawerOpen(true);
  }

  const handleEdit = (item: any) => {
    if (item.type === 'article') {
      setDrawerOpen(false);
      setEditArticleId(item.id);
      setFormDrawerOpen(true);
    } else {
      navigate(`/lots/${item.id}/structure`);
    }
  };

  const handleFormDrawerClose = () => {
    setFormDrawerOpen(false);
    setEditArticleId(undefined);
  };

  const handleFormDrawerSaved = () => {
    loadAll();
    setFormDrawerOpen(false);
    setEditArticleId(undefined);
    showToast('Article enregistré avec succès', 'success');
  };

  const handlePublish = (item: any) => {
    if (item.type === 'article') {
      navigate(`/articles/${item.id}/structure`);
    } else if (item.type === 'lot') {
      navigate(`/lots/${item.id}/structure`);
    }
  };

  const handleMarkSold = (item: any) => {
    setDrawerItem(item);
    setDrawerOpen(false);
    setSoldModalOpen(true);
  };

  const handleStatusChange = (item: any) => {
    setDrawerItem(item);
    setDrawerOpen(false);
    setStatusModalOpen(true);
  };

  const handleDelete = async () => {
    if (!user || !deleteConfirm) return;

    try {
      const table = deleteConfirm.type === 'article' ? 'articles' : 'lots';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteConfirm.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadAll();
      setDrawerOpen(false);
      setDeleteConfirm(null);
      showToast(`${deleteConfirm.type === 'article' ? 'Article' : 'Lot'} supprimé avec succès`, 'success');
    } catch (error: any) {
      showToast('Erreur: ' + error.message, 'error');
    }
  };

  const handleSoldSave = async (saleData: any) => {
    if (!user || !drawerItem) return;

    try {
      const netProfit = saleData.soldPrice - saleData.fees - saleData.shippingCost;
      const table = drawerItem.kind === 'article' ? 'articles' : 'lots';

      const updateData: any = {
        status: 'sold',
        sold_price: saleData.soldPrice,
        sold_at: saleData.soldAt,
        fees: saleData.fees,
        shipping_cost: saleData.shippingCost,
        buyer_name: saleData.buyerName,
        sale_notes: saleData.notes,
        net_profit: netProfit,
        updated_at: new Date().toISOString(),
      };

      if (drawerItem.kind === 'article' && saleData.platform) {
        updateData.platform = saleData.platform;
      }

      if (saleData.sellerId) {
        updateData.seller_id = saleData.sellerId;
      }

      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', drawerItem.id)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      if (drawerItem.kind === 'lot') {
        const { data: lotItems, error: lotItemsError } = await supabase
          .from('lot_items')
          .select('article_id')
          .eq('lot_id', drawerItem.id);

        if (lotItemsError) throw lotItemsError;

        if (lotItems && lotItems.length > 0) {
          const { error: articlesError } = await supabase
            .from('articles')
            .update({
              status: 'vendu_en_lot',
              sold_lot_id: drawerItem.id,
              updated_at: new Date().toISOString()
            })
            .in('id', lotItems.map((item: any) => item.article_id));

          if (articlesError) throw articlesError;
        }
      }

      await loadAll();
      setSoldModalOpen(false);
      showToast('Vente enregistrée avec succès', 'success');
    } catch (error: any) {
      showToast('Erreur: ' + error.message, 'error');
    }
  };

  const handleStatusSave = async (newStatus: ArticleStatus) => {
    if (!user || !drawerItem) return;

    try {
      const table = drawerItem.kind === 'article' ? 'articles' : 'lots';
      const { error } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq('id', drawerItem.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadAll();
      setStatusModalOpen(false);
      showToast('Statut mis à jour avec succès', 'success');
    } catch (error: any) {
      showToast('Erreur: ' + error.message, 'error');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Type',
      'Titre',
      'Marque',
      'Vendeur',
      'Statut',
      'Prix',
      'Prix de vente',
      'Bénéfice net',
      'Date de création',
      'Date de vente'
    ];

    const rows = filteredTableItems.map((it) => {
      const sellerName = it.seller_id ? memberNameById.get(it.seller_id) || "Sans vendeur" : "Sans vendeur";
      const profit = toNumber(it.net_profit);
      const soldPrice = toNumber(it.sold_price);
      const price = toNumber(it.price);
      const isSold = String(it.status).toLowerCase() === "sold" || String(it.status).toLowerCase() === "vendu_en_lot";

      return [
        it.kind === 'article' ? 'Article' : 'Lot',
        `"${getItemTitle(it).replace(/"/g, '""')}"`,
        `"${(it.brand || '—').replace(/"/g, '""')}"`,
        `"${sellerName.replace(/"/g, '""')}"`,
        prettyStatus(it.status),
        price.toFixed(2),
        isSold ? soldPrice.toFixed(2) : '',
        isSold ? profit.toFixed(2) : '',
        formatDateFR(it.created_at),
        isSold && it.sold_at ? formatDateFR(it.sold_at) : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `statistiques_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Export réussi', 'success');
  };

  const pageSubtitle = useMemo(() => {
    const labelRange = timeRange === "7d" ? "7 derniers jours" : timeRange === "30d" ? "30 derniers jours" : timeRange === "90d" ? "90 derniers jours" : "Tout l'historique";
    const labelMode = dateMode === "sold" ? "par date de vente" : "par date de création";
    return `${labelRange} · ${labelMode}`;
  }, [timeRange, dateMode]);

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-10 w-56 bg-gray-100 rounded-lg animate-pulse mb-4" />
        <div className="h-6 w-72 bg-gray-100 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm animate-pulse" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-56 bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm animate-pulse lg:col-span-2" />
          <div className="h-56 bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
            <p className="text-sm text-gray-600 mt-1">
              {pageSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DateModeSelector dateMode={dateMode} setDateMode={setDateMode} />
            <PeriodSelector timeRange={timeRange} setTimeRange={setTimeRange} />

            <button
              onClick={() => {
                if (statusFilters.includes("error")) {
                  setStatusFilters(statusFilters.filter((f) => f !== "error"));
                } else {
                  setStatusFilters([...statusFilters, "error"]);
                }
              }}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ring-gray-200 shadow-sm text-sm font-semibold ${
                statusFilters.includes("error")
                  ? "bg-red-50 text-red-800 hover:bg-red-100"
                  : "bg-white text-gray-800 hover:bg-gray-50"
              }`}
              title="Filtrer sur les erreurs"
            >
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Erreurs
            </button>

            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ring-gray-200 shadow-sm text-sm font-semibold bg-white text-gray-800 hover:bg-gray-50"
              title="Exporter les données en CSV"
            >
              <Download className="w-4 h-4 text-gray-600" />
              Export des données
            </button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chiffre d'affaires</p>
              <p className="text-2xl font-black text-gray-900 mt-2">{nfCurrency.format(metrics.totalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Ventes (items sold)</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <DeltaPill current={metrics.totalRevenue} previous={metricsPrev.totalRevenue} isMoney />
              <div className="text-gray-700">
                <Sparkline values={trendSeries} />
              </div>
            </div>
          </div>
        </div>

        {/* Profit (hero) */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl ring-1 ring-emerald-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Bénéfice net</p>
              <p className="text-2xl font-black text-emerald-800 mt-2">{nfCurrency.format(metrics.totalNetProfit)}</p>
              <p className="text-xs text-emerald-700/80 mt-1">Après frais & livraison</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <DeltaPill current={metrics.totalNetProfit} previous={metricsPrev.totalNetProfit} isMoney />
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600 text-white shadow">
                <CircleDollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Sales */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Transactions vendues</p>
              <p className="text-2xl font-black text-gray-900 mt-2">{nfNumber.format(metrics.soldTransactions)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Prix moyen : <span className="font-bold text-gray-800">{nfCurrency.format(metrics.avgSalePrice)}</span>
              </p>
            </div>
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600 text-white shadow">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Conversion */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Conversion</p>
              <p className="text-2xl font-black text-gray-900 mt-2">{metrics.conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.soldTransactions} vendus / {metrics.publishedLike} publiés
              </p>
            </div>
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600 text-white shadow">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Analysis row */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Insights */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-bold text-gray-900">À retenir</h3>
          </div>
          <div className="mt-4 space-y-2">
            {insights.map((t, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                {t}
              </p>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 ring-1 ring-gray-200 p-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Données</p>
            <p className="text-sm text-gray-700 mt-1">
              Total : <span className="font-black">{metrics.totalItems}</span> · Articles :{" "}
              <span className="font-black">{metrics.totalArticles}</span> · Lots : <span className="font-black">{metrics.totalLots}</span>
            </p>
          </div>
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-bold text-gray-900">Pipeline</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">Répartition des statuts sur la période (selon le mode de date sélectionné).</p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 ring-1 ring-gray-200 px-3 py-2">
              <ArrowDownUp className="w-4 h-4 text-gray-700" />
              <span className="text-sm font-bold text-gray-800">
                {dateMode === "sold" ? "Mode ventes" : "Mode créations"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <button
              onClick={() => setStatusFilters(["draft"])}
              className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4 text-left hover:bg-slate-100 transition"
            >
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Brouillons</p>
              <p className="text-xl font-black text-slate-800 mt-1">{nfNumber.format(metrics.draft)}</p>
            </button>
            <button
              onClick={() => setStatusFilters(["ready"])}
              className="rounded-2xl bg-blue-50 ring-1 ring-blue-200 p-4 text-left hover:bg-blue-100 transition"
            >
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Prêts</p>
              <p className="text-xl font-black text-blue-900 mt-1">{nfNumber.format(metrics.ready)}</p>
            </button>

            <button
              onClick={() => setStatusFilters(["vinted_draft"])}
              className="rounded-2xl bg-violet-50 ring-1 ring-violet-200 p-4 text-left hover:bg-violet-100 transition"
            >
              <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider">Brouillon Vinted</p>
              <p className="text-xl font-black text-violet-900 mt-1">{nfNumber.format(metrics.vinted_draft)}</p>
            </button>

            <button
              onClick={() => setStatusFilters(["published"])}
              className="rounded-2xl bg-violet-50 ring-1 ring-violet-200 p-4 text-left hover:bg-violet-100 transition"
            >
              <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider">Publiés</p>
              <p className="text-xl font-black text-violet-900 mt-1">{nfNumber.format(metrics.publishedLike)}</p>
              <p className="text-[11px] text-violet-700/80 mt-1">inclut planifiés/vendus</p>
            </button>

            <button
              onClick={() => setStatusFilters(["sold"])}
              className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-left hover:bg-emerald-100 transition"
            >
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Vendus</p>
              <p className="text-xl font-black text-emerald-900 mt-1">{nfNumber.format(metrics.sold)}</p>
            </button>

            <button
              onClick={() => setStatusFilters(["error"])}
              className="rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-left hover:bg-red-100 transition"
            >
              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Erreurs</p>
              <p className="text-xl font-black text-red-900 mt-1">{nfNumber.format(metrics.error)}</p>
            </button>
          </div>

          {/* simple progress bar for conversion */}
          <div className="mt-6 rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-gray-900">Conversion</p>
              <p className="text-sm font-black text-gray-900">{metrics.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="mt-2 h-3 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, metrics.conversionRate))}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {metrics.soldTransactions} vendus / {metrics.publishedLike} publiés (dans la même période)
            </p>
          </div>
        </div>
      </div>

      {/* Sellers */}
      <div className="mt-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-700" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Vendeurs</h2>
              <p className="text-sm text-gray-600">Classement + performance. Un seul module. Zéro blabla.</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-gray-200 shadow-sm p-1">
            {(
              [
                ["profit", "Profit"],
                ["revenue", "CA"],
                ["conversion", "Conversion"],
                ["sales", "Ventes"],
              ] as [SortMode, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortMode(key)}
                className={`px-3 py-2 text-sm font-bold rounded-lg transition ${
                  sortMode === key ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-3">
            {sellerStats.slice(0, 8).map((s, idx) => {
              const progress = clamp01(s.conversionRate / 100);

              const rankConfig = {
                0: {
                  icon: Trophy,
                  iconBg: "bg-yellow-500",
                  iconColor: "text-white",
                  borderColor: "ring-yellow-500",
                  progressBg: "bg-yellow-500",
                  badge: "1",
                  badgeBg: "bg-yellow-500",
                },
                1: {
                  icon: Medal,
                  iconBg: "bg-gray-400",
                  iconColor: "text-white",
                  borderColor: "ring-gray-400",
                  progressBg: "bg-gray-400",
                  badge: "2",
                  badgeBg: "bg-gray-400",
                },
                2: {
                  icon: Award,
                  iconBg: "bg-orange-500",
                  iconColor: "text-white",
                  borderColor: "ring-orange-500",
                  progressBg: "bg-orange-500",
                  badge: "3",
                  badgeBg: "bg-orange-500",
                },
              }[idx] || {
                icon: null,
                iconBg: "bg-gray-100",
                iconColor: "text-gray-700",
                borderColor: "ring-gray-200",
                progressBg: "bg-emerald-600",
                badge: `${idx + 1}`,
                badgeBg: "bg-gray-200",
              };

              const Icon = rankConfig.icon;
              const isTop3 = idx < 3;

              return (
                <div
                  key={s.id}
                  className={`relative bg-white rounded-2xl ring-2 ${rankConfig.borderColor} shadow-sm p-4 sm:p-5 hover:shadow-md transition`}
                >
                  {isTop3 && (
                    <div className={`absolute -top-3 -right-3 w-8 h-8 ${rankConfig.badgeBg} text-white rounded-full flex items-center justify-center font-black text-sm shadow-lg`}>
                      {rankConfig.badge}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${rankConfig.iconBg} ${rankConfig.iconColor} shadow-sm`}
                      >
                        {Icon ? <Icon className="w-6 h-6" /> : <span className="text-sm">{rankConfig.badge}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500">
                          {s.itemsSold}/{s.itemsPublished} vendus · Prix moyen {nfCurrency.format(s.averagePrice)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">
                        {sortMode === "profit"
                          ? nfCurrency.format(s.totalProfit)
                          : sortMode === "revenue"
                          ? nfCurrency.format(s.totalRevenue)
                          : sortMode === "sales"
                          ? `${nfNumber.format(s.totalSales)} vente(s)`
                          : `${s.conversionRate.toFixed(0)}%`}
                      </p>
                     
                    </div>
                  </div>

                  <div className="mt-3 h-2.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full ${rankConfig.progressBg} rounded-full transition-all duration-500`} style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              );
            })}

            {sellerStats.length === 0 && (
              <div className="p-6 text-sm text-gray-600">Aucune donnée vendeur dans la période.</div>
            )}
          </div>
        </div>
      </div>

      {/* Détails Section with Table */}
      <div className="mt-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Détails</h2>
            <p className="text-sm text-gray-600">Consultez et filtrez tous vos articles et lots</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (titre, marque, référence…)"
                className="w-full sm:w-[340px] pl-9 pr-3 py-2 rounded-xl bg-white ring-1 ring-gray-200 shadow-sm text-sm font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {statusFilters.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 ring-1 ring-gray-200 text-sm font-semibold text-gray-800">
                <Filter className="w-4 h-4" />
                <span>{statusFilters.length} filtre{statusFilters.length > 1 ? 's' : ''} actif{statusFilters.length > 1 ? 's' : ''}</span>
                <button
                  onClick={() => setStatusFilters([])}
                  className="ml-1 hover:text-gray-600 transition"
                  title="Réinitialiser les filtres"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {statusChips.map((c) => {
            const active = c.key === "all"
              ? statusFilters.length === 0
              : statusFilters.includes(c.key as ItemStatus);

            const config = STATUS_CONFIG[c.key] || STATUS_CONFIG['all'];

            const handleClick = () => {
              if (c.key === "all") {
                setStatusFilters([]);
              } else {
                const filterKey = c.key as ItemStatus;
                if (statusFilters.includes(filterKey)) {
                  setStatusFilters(statusFilters.filter((f) => f !== filterKey));
                } else {
                  setStatusFilters([...statusFilters, filterKey]);
                }
              }
            };

            return (
              <button
                key={c.key}
                onClick={handleClick}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  active ? config.activeColor : config.color
                } hover:scale-105 active:scale-95`}
              >
                {renderStatusIcon(c.key)}
                <span>{c.label}</span>
                <span className="font-bold ml-1">{nfNumber.format(c.count)}</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="mt-4 bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-[980px] w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Item</th>
                  <th className="p-3">Vendeur</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map((it) => {
                  const sellerName = it.seller_id ? memberNameById.get(it.seller_id) || "—" : "Sans vendeur";
                  const profit = toNumber(it.net_profit);
                  const soldPrice = toNumber(it.sold_price);
                  const price = toNumber(it.price);
                  const isSold = String(it.status).toLowerCase() === "sold" || String(it.status).toLowerCase() === "vendu_en_lot";

                  return (
                    <tr key={`${it.kind}-${it.id}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => openItem(it)}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <ItemThumbnail item={it} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{getItemTitle(it)}</p>
                            <p className="text-xs text-gray-500">
                              {(it.brand || "—")}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-sm font-medium text-gray-800">{sellerName}</td>

                      <td className="p-3">
                        <Badge tone={statusTone(it.status)}>{prettyStatus(it.status)}</Badge>
                      </td>

                      <td className="p-3 text-xs text-gray-700">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-500">Créé: {formatDateFR(it.created_at)}</span>
                          {isSold && it.sold_at && (
                            <span className="text-emerald-700 font-semibold">Vendu: {formatDateFR(it.sold_at)}</span>
                          )}
                        </div>
                      </td>

                      <td className={`p-3 text-right text-sm font-black ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {isSold && profit !== 0 ? nfCurrency.format(profit) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {filteredTableItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-gray-600">
                      Aucun résultat. Essayez un autre filtre ou modifiez votre recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-gray-50 text-xs text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>
              Affichés : <span className="font-black text-gray-900">{startIndex + 1}</span> -{" "}
              <span className="font-black text-gray-900">{Math.min(endIndex, filteredTableItems.length)}</span> /{" "}
              <span className="font-black text-gray-900">{filteredTableItems.length}</span>
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 ring-1 ring-gray-200'
                  }`}
                >
                  Précédent
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                          currentPage === pageNum
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-white text-gray-700 hover:bg-gray-100 ring-1 ring-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 ring-1 ring-gray-200'
                  }`}
                >
                  Suivant
                </button>
              </div>
            )}

            <span className="inline-flex items-center gap-2">
              <Package className="w-4 h-4" />
              Cliquez sur une ligne pour ouvrir le détail
            </span>
          </div>
        </div>
      </div>

      <AdminDetailDrawer
        item={convertToAdminItem(drawerItem)}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerItem(null);
        }}
        onEdit={() => drawerItem && handleEdit(convertToAdminItem(drawerItem))}
        onPublish={() => drawerItem && handlePublish(convertToAdminItem(drawerItem))}
        onDuplicate={() => showToast('Duplication non disponible depuis les statistiques', 'error')}
        onSchedule={() => showToast('Planification non disponible depuis les statistiques', 'error')}
        onMarkSold={() => drawerItem && handleMarkSold(convertToAdminItem(drawerItem))}
        onDelete={() => {
          if (drawerItem) {
            const adminItem = convertToAdminItem(drawerItem);
            setDeleteConfirm({ id: adminItem.id, title: adminItem.title, type: adminItem.type });
          }
        }}
        onStatusChange={() => drawerItem && handleStatusChange(convertToAdminItem(drawerItem))}
        onLabelOpen={() => showToast('Génération d\'étiquette non disponible depuis les statistiques', 'error')}
        formatDate={formatDate}
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.text}
          onClose={() => setToast(null)}
        />
      )}

      {formDrawerOpen && (
        <ArticleFormDrawer
          isOpen={formDrawerOpen}
          onClose={handleFormDrawerClose}
          onSaved={handleFormDrawerSaved}
          articleId={editArticleId}
        />
      )}

      {soldModalOpen && drawerItem && (
        drawerItem.kind === 'lot' ? (
          <LotSoldModal
            isOpen={soldModalOpen}
            onClose={() => setSoldModalOpen(false)}
            onConfirm={handleSoldSave}
            lot={drawerItem as any}
          />
        ) : (
          <ArticleSoldModal
            isOpen={soldModalOpen}
            onClose={() => setSoldModalOpen(false)}
            onConfirm={handleSoldSave}
            article={drawerItem as any}
          />
        )
      )}

      {statusModalOpen && drawerItem && (
        <ArticleStatusModal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          onSave={handleStatusSave}
          currentStatus={drawerItem.status as ArticleStatus}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Supprimer cet élément ?"
          message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm.title}" ? Cette action est irréversible.`}
          confirmText="Supprimer"
          cancelText="Annuler"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
