import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Package, ShoppingBag, ExternalLink, Image, Clock, CheckCircle, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/ui/Toast';

interface PublisherArticle {
  id: string;
  title: string;
  description: string;
  brand: string;
  size: string;
  condition: string;
  color: string;
  material: string;
  price: number;
  photos: string[];
  vinted_url: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
}

interface PublisherLot {
  id: string;
  name: string;
  description: string;
  category_id: number;
  season: string;
  price: number;
  original_total_price: number;
  discount_percentage: number;
  cover_photo: string;
  photos: string[];
  vinted_url: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
}

declare global {
  interface Window {
    __EASYVINTED_READY_ARTICLES__?: EasyVintedReadyArticle[];
    __EASYVINTED_READY_LOTS__?: EasyVintedReadyLot[];
    __EASYVINTED_READY_ITEMS__?: EasyVintedReadyItem[];
    __EASYVINTED_READY_ITEMS_UPDATED_AT__?: string;
  }
}

type EasyVintedReadyArticle = {
  id: string;
  title: string;
  description: string;
  categoryPath: string;
  brand: string;
  size: string;
  condition: string;
  color: string;
  material: string;
  price: number;
  photoUrls: string[];
  status: 'ready';
};

type EasyVintedReadyLot = {
  id: string;
  title: string;
  description: string;
  categoryId: number;
  season: string;
  price: number;
  originalTotalPrice: number;
  discountPercentage: number;
  photoUrls: string[];
  status: 'ready';
};

type EasyVintedReadyItem = (EasyVintedReadyArticle | EasyVintedReadyLot) & {
  itemType: 'article' | 'lot';
  created_at: string;
};

type TabType = 'all' | 'articles' | 'lots';

type UnifiedItem = {
  id: string;
  itemType: 'article' | 'lot';
  title: string;
  description: string;
  price: number;
  photos: string[];
  status: string;
  scheduled_for: string | null;
  vinted_url: string;
  created_at: string;
  rawData: PublisherArticle | PublisherLot;
};

function getFirstPhotoUrl(photos: unknown): string | null {
  if (!photos) return null;
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const obj = first as Record<string, unknown>;
      return (obj.url ?? obj.publicUrl ?? obj.public_url ?? obj.path ?? null) as string | null;
    }
  }
  return null;
}

export function AdminPublisherPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [articles, setArticles] = useState<PublisherArticle[]>([]);
  const [lots, setLots] = useState<PublisherLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get today's date at end of day (23:59:59)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayIso = today.toISOString();

      const [
        articlesReady,
        articlesScheduled,
        lotsReady,
        lotsScheduled
      ] = await Promise.all([
        // Articles with status 'ready' (no date condition)
        supabase
          .from('articles')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: true }),
        // Articles with status 'scheduled' and scheduled_for <= today
        supabase
          .from('articles')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .lte('scheduled_for', todayIso)
          .order('created_at', { ascending: true }),
        // Lots with status 'ready' (no date condition)
        supabase
          .from('lots')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: true }),
        // Lots with status 'scheduled' and scheduled_for <= today
        supabase
          .from('lots')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .lte('scheduled_for', todayIso)
          .order('created_at', { ascending: true })
      ]);

      if (articlesReady.error) throw articlesReady.error;
      if (articlesScheduled.error) throw articlesScheduled.error;
      if (lotsReady.error) throw lotsReady.error;
      if (lotsScheduled.error) throw lotsScheduled.error;

      // Combine results and sort by oldest to recent (FIFO - ascending)
      const allArticles = [
        ...(articlesReady.data || []),
        ...(articlesScheduled.data || [])
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const allLots = [
        ...(lotsReady.data || []),
        ...(lotsScheduled.data || [])
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setArticles(allArticles);
      setLots(allLots);
    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({
        type: 'error',
        text: 'Erreur lors du chargement des donnees',
      });
    } finally {
      setLoading(false);
    }
  };


  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const unified: UnifiedItem[] = [
      ...articles.map((a): UnifiedItem => ({
        id: a.id,
        itemType: 'article',
        title: a.title,
        description: a.description,
        price: a.price,
        photos: a.photos,
        status: a.status,
        scheduled_for: a.scheduled_for,
        vinted_url: a.vinted_url,
        created_at: a.created_at,
        rawData: a
      })),
      ...lots.map((l): UnifiedItem => ({
        id: l.id,
        itemType: 'lot',
        title: l.name,
        description: l.description,
        price: l.price,
        photos: l.photos,
        status: l.status,
        scheduled_for: l.scheduled_for,
        vinted_url: l.vinted_url,
        created_at: l.created_at,
        rawData: l
      }))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return unified;
  }, [articles, lots]);

  const exposedArticles: EasyVintedReadyArticle[] = useMemo(() => {
    const src = (articles ?? []).filter((a) => a.status === 'ready' || a.status === 'scheduled');

    return src.map((a) => ({
      id: String(a.id ?? ''),
      title: String(a.title ?? ''),
      description: String(a.description ?? ''),
      categoryPath: '-',
      brand: String(a.brand ?? ''),
      size: String(a.size ?? ''),
      condition: String(a.condition ?? ''),
      color: String(a.color ?? ''),
      material: String(a.material ?? ''),
      price: typeof a.price === 'number' && Number.isFinite(a.price) ? a.price : Number(a.price ?? 0) || 0,
      photoUrls: Array.isArray(a.photos)
        ? a.photos.map((u) => String(u).trim()).filter(Boolean)
        : [],
      status: 'ready',
    }));
  }, [articles]);

  const exposedLots: EasyVintedReadyLot[] = useMemo(() => {
    const src = (lots ?? []).filter((l) => l.status === 'ready' || l.status === 'scheduled');

    return src.map((l) => ({
      id: String(l.id ?? ''),
      title: String(l.name ?? ''),
      description: String(l.description ?? ''),
      categoryId: Number(l.category_id ?? 0),
      season: String(l.season ?? ''),
      price: typeof l.price === 'number' && Number.isFinite(l.price) ? l.price : Number(l.price ?? 0) || 0,
      originalTotalPrice: typeof l.original_total_price === 'number' ? l.original_total_price : 0,
      discountPercentage: typeof l.discount_percentage === 'number' ? l.discount_percentage : 0,
      photoUrls: Array.isArray(l.photos)
        ? l.photos.map((u) => String(u).trim()).filter(Boolean)
        : [],
      status: 'ready',
    }));
  }, [lots]);

  const exposedItems: EasyVintedReadyItem[] = useMemo(() => {
    return [
      ...exposedArticles.map((a): EasyVintedReadyItem => ({
        ...a,
        itemType: 'article' as const,
        created_at: articles.find(art => art.id === a.id)?.created_at || new Date().toISOString()
      })),
      ...exposedLots.map((l): EasyVintedReadyItem => ({
        ...l,
        itemType: 'lot' as const,
        created_at: lots.find(lot => lot.id === l.id)?.created_at || new Date().toISOString()
      }))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [exposedArticles, exposedLots, articles, lots]);

  useEffect(() => {
    window.__EASYVINTED_READY_ARTICLES__ = exposedArticles;
    window.__EASYVINTED_READY_LOTS__ = exposedLots;
    window.__EASYVINTED_READY_ITEMS__ = exposedItems;
    window.__EASYVINTED_READY_ITEMS_UPDATED_AT__ = new Date().toISOString();
  }, [exposedArticles, exposedLots, exposedItems]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return unifiedItems;
    return unifiedItems.filter(item => item.itemType === (activeTab === 'articles' ? 'article' : 'lot'));
  }, [unifiedItems, activeTab]);

  const handlePublish = (item: UnifiedItem) => {
    if (item.itemType === 'article') {
      navigate(`/articles/${item.id}/structure`);
    } else {
      navigate(`/lots/${item.id}/structure`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Chargement...</p>
      </div>
    );
  }

  return (
    <>
      {toast && <Toast message={toast.text} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Publisher</h1>
            <p className="text-slate-500 mt-1">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} pret{filteredItems.length !== 1 ? 's' : ''} a publier
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <ShoppingBag className="w-4 h-4 -ml-2" />
            Tous ({unifiedItems.length})
          </button>
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'articles'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Articles ({articles.length})
          </button>
          <button
            onClick={() => setActiveTab('lots')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'lots'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            Lots ({lots.length})
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun item a publier</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Il n'y a pas d'items avec le statut "Pret" ou "Planifie" pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const photoUrl = getFirstPhotoUrl(item.photos);
              const isScheduled = item.status === 'scheduled';

              return (
                <div
                  key={item.id}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300"
                >
                  <div className="relative aspect-square bg-slate-100">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-12 h-12 text-slate-300" />
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${
                        item.itemType === 'article'
                          ? 'bg-blue-500/90 text-white'
                          : 'bg-violet-500/90 text-white'
                      }`}>
                        {item.itemType === 'article' ? 'Article' : 'Lot'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${
                        isScheduled
                          ? 'bg-amber-500/90 text-white'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isScheduled ? (
                          <>
                            <Clock className="w-3 h-3" />
                            Planifie
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Pret
                          </>
                        )}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <button
                      onClick={() => handlePublish(item)}
                      className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-lg"
                    >
                      <Play className="w-5 h-5" fill="currentColor" />
                      Publier
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 truncate mb-1">
                      {item.title || 'Sans titre'}
                    </h3>

                    <p className="text-sm text-slate-500 line-clamp-2 mb-3 min-h-[2.5rem]">
                      {item.description || 'Pas de description'}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-emerald-600">
                        {item.price ? `${item.price.toFixed(2)} EUR` : '-'}
                      </span>

                      {item.vinted_url && (
                        <a
                          href={item.vinted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir sur Vinted"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {isScheduled && item.scheduled_for && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(item.scheduled_for).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
