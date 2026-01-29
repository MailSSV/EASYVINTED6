import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, AlertCircle, Eye, Search, ChevronLeft, ChevronRight, ChevronDown, ArrowUp, ArrowDown, Send, ExternalLink, Package, ShoppingBag, SquarePen, Upload, X, LayoutGrid, List, Calendar, Clock, User, Tag, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminArticleRow, AdminLotRow, FamilyMember } from '../types/adminGrid';
import { Toast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AdminDetailDrawer } from '../components/admin/AdminDetailDrawer';
import { BulkActionsBar } from '../components/admin/BulkActionsBar';
import { BulkScheduleModal } from '../components/admin/BulkScheduleModal';
import { ArticleFormDrawer } from '../components/admin/ArticleFormDrawer';
import LotBuilder from '../components/LotBuilder';
import { ArticleIndicators } from '../components/admin/ArticleIndicators';
import { LazyImage } from '../components/ui/LazyImage';
import { supabase } from '../lib/supabase';

const SEASON_OPTIONS = ['undefined', 'spring', 'summer', 'autumn', 'winter', 'all'];
const STATUS_OPTIONS = ['draft', 'ready', 'scheduled', 'published', 'vinted_draft', 'sold', 'processing', 'error'];
const CONDITION_OPTIONS = ['new_with_tags', 'new_without_tags', 'very_good', 'good', 'satisfactory'];
const ITEMS_PER_PAGE = 10;

interface UnifiedItem {
  id: string;
  type: 'article' | 'lot';
  title: string;
  brand?: string;
  size?: string;
  condition?: string;
  color?: string;
  material?: string;
  price: number | null;
  status: string;
  photos: string[] | null;
  created_at?: string;
  season?: string | null;
  scheduled_for?: string | null;
  seller_id?: string | null;
  sold_at?: string | null;
  sold_price?: number | null;
  net_profit?: number | null;
  reference_number?: string | null;
  vinted_url?: string | null;
  article_count?: number;
  rawData: AdminArticleRow | AdminLotRow;
}

interface UnifiedEditState {
  rowId: string;
  field: string;
  originalValue: any;
  isDirty: boolean;
  isSaving: boolean;
}

interface AdminItem {
  id: string;
  type: 'article' | 'lot';
  title: string;
  brand?: string;
  price: number;
  status: string;
  photos: string[];
  created_at: string;
  season?: string;
  scheduled_for?: string;
  seller_id?: string;
  seller_name?: string;
  published_at?: string;
  sold_at?: string;
  sold_price?: number;
  net_profit?: number;
  reference_number?: string;
  lot_article_count?: number;
  description?: string;
  suggested_period?: string;
  vinted_url?: string;
  fees?: number;
  shipping_cost?: number;
  buyer_name?: string;
  sale_notes?: string;
  size?: string;
  color?: string;
  material?: string;
  condition?: string;
  original_total_price?: number;
  discount_percentage?: number;
  articles?: { id: string; title: string; brand?: string; price: number; photos: string[]; size?: string; }[];
  seo_keywords?: string[];
  hashtags?: string[];
  search_terms?: string[];
  ai_confidence_score?: number;
}

export default function AdminUnifiedGridPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [articles, setArticles] = useState<AdminArticleRow[]>([]);
  const [lots, setLots] = useState<AdminLotRow[]>([]);
  const [sellers, setSellers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<UnifiedEditState | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; type: 'article' | 'lot' } | null>(null);
  const [selectedItem, setSelectedItem] = useState<AdminItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());

  const [filters, setFilters] = useState({
    type: '',
    status: '',
    seller: '',
    season: '',
    search: ''
  });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [bulkScheduleModalOpen, setBulkScheduleModalOpen] = useState(false);
  const [articleFormOpen, setArticleFormOpen] = useState(false);
  const [lotBuilderOpen, setLotBuilderOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    const handleLotCreated = () => {
      loadData();
    };

    window.addEventListener('kellyLotCreated', handleLotCreated);

    return () => {
      window.removeEventListener('kellyLotCreated', handleLotCreated);
    };
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [articlesRes, lotsRes, sellersRes] = await Promise.all([
        supabase
          .from('articles')
          .select('id, user_id, title, description, brand, size, condition, color, material, season, seller_id, price, net_profit, scheduled_for, sold_at, status, sold_price, photos, reference_number, vinted_url, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('lots')
          .select('*, lot_items(count)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('family_members')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name')
      ]);

      if (articlesRes.error) throw articlesRes.error;
      if (lotsRes.error) throw lotsRes.error;
      if (sellersRes.error) throw sellersRes.error;

      const lotsWithCount = lotsRes.data.map(lot => ({
        ...lot,
        article_count: lot.lot_items?.[0]?.count || 0
      }));

      setArticles(articlesRes.data || []);
      setLots(lotsWithCount || []);
      setSellers(sellersRes.data || []);
    } catch (error: any) {
      showToast('Erreur de chargement: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const articleItems: UnifiedItem[] = articles.map(article => ({
      id: article.id,
      type: 'article' as const,
      title: article.title || '',
      brand: article.brand || undefined,
      size: article.size || undefined,
      condition: article.condition || undefined,
      color: article.color || undefined,
      material: article.material || undefined,
      price: article.price,
      status: article.status,
      photos: article.photos,
      created_at: article.created_at || undefined,
      season: article.season,
      scheduled_for: article.scheduled_for,
      seller_id: article.seller_id,
      sold_at: article.sold_at,
      sold_price: article.sold_price,
      net_profit: article.net_profit,
      reference_number: article.reference_number || undefined,
      vinted_url: article.vinted_url || undefined,
      rawData: article
    }));

    const lotItems: UnifiedItem[] = lots.map(lot => ({
      id: lot.id,
      type: 'lot' as const,
      title: lot.name,
      price: lot.price,
      status: lot.status,
      photos: lot.photos,
      created_at: lot.created_at || undefined,
      season: lot.season,
      scheduled_for: lot.scheduled_for,
      seller_id: lot.seller_id,
      sold_at: lot.sold_at,
      sold_price: lot.sold_price,
      net_profit: lot.net_profit,
      reference_number: lot.reference_number || undefined,
      vinted_url: lot.vinted_url || undefined,
      article_count: lot.article_count,
      rawData: lot
    }));

    return [...articleItems, ...lotItems];
  }, [articles, lots]);

  const filteredItems = useMemo(() => {
    let items = [...unifiedItems];

    if (filters.type) {
      items = items.filter(item => item.type === filters.type);
    }

    if (filters.status) {
      items = items.filter(item => item.status === filters.status);
    }

    if (filters.seller) {
      items = items.filter(item => item.seller_id === filters.seller);
    }

    if (filters.season) {
      items = items.filter(item => item.season === filters.season);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.brand?.toLowerCase().includes(searchLower) ||
        item.reference_number?.toLowerCase().includes(searchLower)
      );
    }

    if (sortColumn) {
      items.sort((a, b) => {
        const aVal = (a as any)[sortColumn];
        const bVal = (b as any)[sortColumn];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return items;
  }, [unifiedItems, filters, sortColumn, sortDirection]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toDatetimeLocal = (isoString: string | null): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fromDatetimeLocal = (localString: string): string | null => {
    if (!localString) return null;
    return new Date(localString).toISOString();
  };

  const startEdit = (rowId: string, field: string, originalValue: any) => {
    setEditState({
      rowId,
      field,
      originalValue,
      isDirty: false,
      isSaving: false
    });
  };

  const handleChange = (item: UnifiedItem, field: string, value: any) => {
    if (item.type === 'article') {
      setArticles(prev => prev.map(article =>
        article.id === item.id ? { ...article, [field]: value } : article
      ));
    } else {
      const lotField = field === 'title' ? 'name' : field;
      setLots(prev => prev.map(lot =>
        lot.id === item.id ? { ...lot, [lotField]: value } : lot
      ));
    }

    if (editState && editState.rowId === item.id && editState.field === field) {
      setEditState(prev => prev ? { ...prev, isDirty: true } : null);
    }
  };

  const saveCell = async (item: UnifiedItem, field: string) => {
    if (!editState || !editState.isDirty) {
      setEditState(null);
      return;
    }

    setEditState(prev => prev ? { ...prev, isSaving: true } : null);

    try {
      const table = item.type === 'article' ? 'articles' : 'lots';
      const dbField = item.type === 'lot' && field === 'title' ? 'name' : field;

      const currentItem = item.type === 'article'
        ? articles.find(a => a.id === item.id)
        : lots.find(l => l.id === item.id);

      if (!currentItem) {
        throw new Error('Item not found');
      }

      const updateValue = (currentItem as any)[dbField];

      const { error } = await supabase
        .from(table)
        .update({ [dbField]: updateValue })
        .eq('id', item.id);

      if (error) throw error;

      showToast('Modification enregistrée', 'success');
      setEditState(null);
    } catch (error: any) {
      showToast('Erreur: ' + error.message, 'error');
      if (item.type === 'article') {
        setArticles(prev => prev.map(article =>
          article.id === item.id
            ? { ...article, [field]: editState.originalValue }
            : article
        ));
      } else {
        const lotField = field === 'title' ? 'name' : field;
        setLots(prev => prev.map(lot =>
          lot.id === item.id
            ? { ...lot, [lotField]: editState.originalValue }
            : lot
        ));
      }
      setEditState(null);
    }
  };

  const cancelEdit = (item: UnifiedItem, field: string) => {
    if (editState) {
      if (item.type === 'article') {
        setArticles(prev => prev.map(article =>
          article.id === item.id
            ? { ...article, [field]: editState.originalValue }
            : article
        ));
      } else {
        const lotField = field === 'title' ? 'name' : field;
        setLots(prev => prev.map(lot =>
          lot.id === item.id
            ? { ...lot, [lotField]: editState.originalValue }
            : lot
        ));
      }
    }
    setEditState(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const table = deleteConfirm.type === 'article' ? 'articles' : 'lots';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      if (deleteConfirm.type === 'article') {
        setArticles(prev => prev.filter(a => a.id !== deleteConfirm.id));
      } else {
        setLots(prev => prev.filter(l => l.id !== deleteConfirm.id));
      }

      showToast(`${deleteConfirm.type === 'article' ? 'Article' : 'Lot'} supprimé`, 'success');
      setDeleteConfirm(null);
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteConfirm.id);
        return newSet;
      });
    } catch (error: any) {
      showToast('Erreur de suppression: ' + error.message, 'error');
    }
  };

  const handleBulkDelete = async () => {
    const itemsToDelete = Array.from(selectedItems);
    if (itemsToDelete.length === 0) return;

    try {
      const articleIds = itemsToDelete.filter(id =>
        articles.some(a => a.id === id)
      );
      const lotIds = itemsToDelete.filter(id =>
        lots.some(l => l.id === id)
      );

      const promises = [];
      if (articleIds.length > 0) {
        promises.push(
          supabase.from('articles').delete().in('id', articleIds)
        );
      }
      if (lotIds.length > 0) {
        promises.push(
          supabase.from('lots').delete().in('id', lotIds)
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      setArticles(prev => prev.filter(a => !articleIds.includes(a.id)));
      setLots(prev => prev.filter(l => !lotIds.includes(l.id)));
      setSelectedItems(new Set());
      showToast(`${itemsToDelete.length} élément(s) supprimé(s)`, 'success');
    } catch (error: any) {
      showToast('Erreur de suppression: ' + error.message, 'error');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    const itemsToUpdate = Array.from(selectedItems);
    if (itemsToUpdate.length === 0) return;

    try {
      const articleIds = itemsToUpdate.filter(id =>
        articles.some(a => a.id === id)
      );
      const lotIds = itemsToUpdate.filter(id =>
        lots.some(l => l.id === id)
      );

      const promises = [];
      if (articleIds.length > 0) {
        promises.push(
          supabase.from('articles').update({ status: newStatus }).in('id', articleIds)
        );
      }
      if (lotIds.length > 0) {
        promises.push(
          supabase.from('lots').update({ status: newStatus }).in('id', lotIds)
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      setArticles(prev => prev.map(a =>
        articleIds.includes(a.id) ? { ...a, status: newStatus } : a
      ));
      setLots(prev => prev.map(l =>
        lotIds.includes(l.id) ? { ...l, status: newStatus } : l
      ));

      showToast(`${itemsToUpdate.length} élément(s) mis à jour`, 'success');
      setSelectedItems(new Set());
    } catch (error: any) {
      showToast('Erreur de mise à jour: ' + error.message, 'error');
    }
  };

  const handleBulkSellerChange = async (sellerId: string | null) => {
    const itemsToUpdate = Array.from(selectedItems);
    if (itemsToUpdate.length === 0) return;

    try {
      const articleIds = itemsToUpdate.filter(id =>
        articles.some(a => a.id === id)
      );
      const lotIds = itemsToUpdate.filter(id =>
        lots.some(l => l.id === id)
      );

      const promises = [];
      if (articleIds.length > 0) {
        promises.push(
          supabase.from('articles').update({ seller_id: sellerId }).in('id', articleIds)
        );
      }
      if (lotIds.length > 0) {
        promises.push(
          supabase.from('lots').update({ seller_id: sellerId }).in('id', lotIds)
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      setArticles(prev => prev.map(a =>
        articleIds.includes(a.id) ? { ...a, seller_id: sellerId } : a
      ));
      setLots(prev => prev.map(l =>
        lotIds.includes(l.id) ? { ...l, seller_id: sellerId } : l
      ));

      showToast(`${itemsToUpdate.length} élément(s) mis à jour`, 'success');
      setSelectedItems(new Set());
    } catch (error: any) {
      showToast('Erreur de mise à jour: ' + error.message, 'error');
    }
  };

  const handleBulkSeasonChange = async (season: string) => {
    const itemsToUpdate = Array.from(selectedItems);
    if (itemsToUpdate.length === 0) return;

    try {
      const articleIds = itemsToUpdate.filter(id =>
        articles.some(a => a.id === id)
      );
      const lotIds = itemsToUpdate.filter(id =>
        lots.some(l => l.id === id)
      );

      const promises = [];
      if (articleIds.length > 0) {
        promises.push(
          supabase.from('articles').update({ season }).in('id', articleIds)
        );
      }
      if (lotIds.length > 0) {
        promises.push(
          supabase.from('lots').update({ season }).in('id', lotIds)
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      setArticles(prev => prev.map(a =>
        articleIds.includes(a.id) ? { ...a, season } : a
      ));
      setLots(prev => prev.map(l =>
        lotIds.includes(l.id) ? { ...l, season } : l
      ));

      showToast(`${itemsToUpdate.length} élément(s) mis à jour`, 'success');
      setSelectedItems(new Set());
    } catch (error: any) {
      showToast('Erreur de mise à jour: ' + error.message, 'error');
    }
  };

  const handleBulkDuplicate = async () => {
    const itemsToDuplicate = Array.from(selectedItems);
    if (itemsToDuplicate.length === 0) return;

    try {
      const articlesToDuplicate = itemsToDuplicate
        .map(id => articles.find(a => a.id === id))
        .filter(Boolean) as AdminArticleRow[];

      const lotsToDuplicate = itemsToDuplicate
        .map(id => lots.find(l => l.id === id))
        .filter(Boolean) as AdminLotRow[];

      const duplicatedArticles = [];
      const duplicatedLots = [];

      if (articlesToDuplicate.length > 0) {
        for (const article of articlesToDuplicate) {
          const { id, created_at, published_at, vinted_url, sold_at, sold_price, net_profit, fees, shipping_cost, buyer_name, sale_notes, reference_number, ...articleData } = article;

          const { data, error } = await supabase
            .from('articles')
            .insert({
              ...articleData,
              title: `${article.title} (Copie)`,
              status: 'draft',
              scheduled_for: null,
            })
            .select()
            .single();

          if (error) throw error;
          if (data) duplicatedArticles.push(data);
        }
      }

      if (lotsToDuplicate.length > 0) {
        for (const lot of lotsToDuplicate) {
          const { id, created_at, published_at, vinted_url, sold_at, sold_price, net_profit, reference_number, ...lotData } = lot;

          const { data: newLot, error: lotError } = await supabase
            .from('lots')
            .insert({
              ...lotData,
              name: `${lot.name} (Copie)`,
              status: 'draft',
              scheduled_for: null,
            })
            .select()
            .single();

          if (lotError) throw lotError;
          if (newLot) {
            const { data: lotItems, error: itemsError } = await supabase
              .from('lot_items')
              .select('article_id')
              .eq('lot_id', lot.id);

            if (itemsError) throw itemsError;

            if (lotItems && lotItems.length > 0) {
              const lotItemsToInsert = lotItems.map(item => ({
                lot_id: newLot.id,
                article_id: item.article_id
              }));

              const { error: insertError } = await supabase
                .from('lot_items')
                .insert(lotItemsToInsert);

              if (insertError) throw insertError;
            }

            duplicatedLots.push({
              ...newLot,
              article_count: lotItems?.length || 0
            });
          }
        }
      }

      await loadData();

      const totalDuplicated = duplicatedArticles.length + duplicatedLots.length;
      showToast(`${totalDuplicated} élément(s) dupliqué(s) avec succès`, 'success');
      setSelectedItems(new Set());
    } catch (error: any) {
      showToast('Erreur de duplication: ' + error.message, 'error');
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleViewDetails = async (item: UnifiedItem) => {
    try {
      if (item.type === 'article') {
        const { data: articleData, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', item.id)
          .maybeSingle();

        if (error) throw error;
        if (!articleData) return;

        const adminItem: AdminItem = {
          id: articleData.id,
          type: 'article',
          title: articleData.title,
          brand: articleData.brand,
          price: parseFloat(articleData.price),
          status: articleData.status,
          photos: articleData.photos || [],
          created_at: articleData.created_at,
          season: articleData.season,
          scheduled_for: articleData.scheduled_for,
          seller_id: articleData.seller_id,
          seller_name: sellers.find(s => s.id === articleData.seller_id)?.name,
          published_at: articleData.published_at,
          sold_at: articleData.sold_at,
          sold_price: articleData.sold_price,
          net_profit: articleData.net_profit,
          reference_number: articleData.reference_number,
          description: articleData.description,
          suggested_period: articleData.suggested_period,
          vinted_url: articleData.vinted_url,
          fees: articleData.fees,
          shipping_cost: articleData.shipping_cost,
          buyer_name: articleData.buyer_name,
          sale_notes: articleData.sale_notes,
          size: articleData.size,
          color: articleData.color,
          material: articleData.material,
          condition: articleData.condition,
          seo_keywords: articleData.seo_keywords,
          hashtags: articleData.hashtags,
          search_terms: articleData.search_terms,
          ai_confidence_score: articleData.ai_confidence_score
        };
        setSelectedItem(adminItem);
        setDrawerOpen(true);
      } else {
        const { data: lotData, error } = await supabase
          .from('lots')
          .select('*')
          .eq('id', item.id)
          .maybeSingle();

        if (error) throw error;
        if (!lotData) return;

        const { data: lotItems, error: itemsError } = await supabase
          .from('lot_items')
          .select('article_id, articles(id, title, brand, price, photos, size)')
          .eq('lot_id', item.id);

        if (itemsError) throw itemsError;

        const articles = lotItems?.map((li: any) => ({
          id: li.articles.id,
          title: li.articles.title,
          brand: li.articles.brand,
          price: parseFloat(li.articles.price),
          photos: li.articles.photos || [],
          size: li.articles.size
        })) || [];

        const adminItem: AdminItem = {
          id: lotData.id,
          type: 'lot',
          title: lotData.name,
          price: parseFloat(lotData.price),
          status: lotData.status,
          photos: lotData.photos || [],
          created_at: lotData.created_at,
          season: lotData.season,
          scheduled_for: lotData.scheduled_for,
          seller_id: lotData.seller_id,
          seller_name: sellers.find(s => s.id === lotData.seller_id)?.name,
          published_at: lotData.published_at,
          sold_at: lotData.sold_at,
          sold_price: lotData.sold_price,
          net_profit: lotData.net_profit,
          reference_number: lotData.reference_number,
          description: lotData.description,
          vinted_url: lotData.vinted_url,
          original_total_price: lotData.original_total_price,
          discount_percentage: lotData.discount_percentage,
          articles: articles,
          lot_article_count: articles.length,
          seo_keywords: lotData.seo_keywords,
          hashtags: lotData.hashtags,
          search_terms: lotData.search_terms,
          ai_confidence_score: lotData.ai_confidence_score
        };
        setSelectedItem(adminItem);
        setDrawerOpen(true);
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      showToast('Erreur lors du chargement des détails', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Brouillon' },
      ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Prêt' },
      scheduled: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Planifié' },
      published: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Publié' },
      sold: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Vendu' },
      vendu_en_lot: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Vendu en lot' },
      vinted_draft: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Brouillon Vinted' },
      reserved: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Réservé' },
      processing: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'En cours' },
      error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Erreur' }
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} shadow-sm`}>
        {config.label}
      </span>
    );
  };

  const getSeller = (sellerId: string | null | undefined) => {
    if (!sellerId) return '-';
    return sellers.find(s => s.id === sellerId)?.name || '-';
  };

  const getThumbnailUrl = (photos: string[] | null): string | null => {
    if (!photos || photos.length === 0) return null;
    const firstPhoto = photos[0];
    if (!firstPhoto) return null;

    if (firstPhoto.startsWith('http')) {
      return firstPhoto;
    }

    const { data } = supabase.storage.from('article-photos').getPublicUrl(firstPhoto);
    return data.publicUrl;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const canPublish = (item: UnifiedItem): boolean => {
    const hasTitle = !!item.title && item.title.trim().length > 0;
    const hasPhotos = item.photos && item.photos.length > 0;
    const hasPrice = item.price !== null && item.price !== undefined && item.price > 0;

    let isComplete = hasTitle && hasPhotos && hasPrice;

    if (item.type === 'article') {
      const hasBrand = !!item.brand && item.brand.trim().length > 0;
      const hasSize = !!item.size && item.size.trim().length > 0;
      isComplete = isComplete && hasBrand && hasSize;
    }

    const isReadyToPublish = isComplete && (item.status === 'ready' || item.status === 'scheduled');

    return isReadyToPublish;
  };

  const handlePublish = (item: UnifiedItem) => {
    if (item.type === 'article') {
      navigate(`/articles/${item.id}/structure`);
    } else {
      navigate(`/lots/${item.id}/structure`);
    }
  };

  const handleEdit = (item: AdminItem) => {
    setDrawerOpen(false);
    setEditItemId(item.id);
    if (item.type === 'article') {
      setArticleFormOpen(true);
    } else {
      setLotBuilderOpen(true);
    }
  };

  const handleDuplicate = () => {
    setToast({ message: 'Fonctionnalité de duplication disponible depuis la page principale', type: 'error' });
  };

  const handleSchedule = () => {
    if (selectedItem) {
      setSelectedItems(new Set([selectedItem.id]));
      setBulkScheduleModalOpen(true);
      setDrawerOpen(false);
    }
  };

  const handleMarkSold = () => {
    setToast({ message: 'Fonctionnalité de marquage vendu disponible depuis la page principale', type: 'error' });
  };

  const handleStatusChange = () => {
    setToast({ message: 'Fonctionnalité de changement de statut disponible depuis la page principale', type: 'error' });
  };

  const handleLabelOpen = () => {
    setToast({ message: 'Fonctionnalité d\'étiquette disponible depuis la page principale', type: 'error' });
  };

  const formatDateForDrawer = (date?: string) => {
    if (!date) return 'Non défini';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(paginatedItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const stats = useMemo(() => {
    const totalArticles = articles.length;
    const totalLots = lots.length;
    const draftArticles = articles.filter(a => a.status === 'draft').length;
    const draftLots = lots.filter(l => l.status === 'draft').length;
    const readyArticles = articles.filter(a => a.status === 'ready').length;
    const readyLots = lots.filter(l => l.status === 'ready').length;
    const scheduledArticles = articles.filter(a => a.status === 'scheduled').length;
    const scheduledLots = lots.filter(l => l.status === 'scheduled').length;
    const publishedArticles = articles.filter(a => a.status === 'published').length;
    const publishedLots = lots.filter(l => l.status === 'published').length;
    const soldArticles = articles.filter(a => a.status === 'sold' || a.status === 'vendu_en_lot').length;
    const soldLots = lots.filter(l => l.status === 'sold').length;

    const totalNetProfit = [
      ...articles.filter(a => a.net_profit != null).map(a => a.net_profit || 0),
      ...lots.filter(l => l.net_profit != null).map(l => l.net_profit || 0)
    ].reduce((sum, profit) => sum + profit, 0);

    return {
      total: totalArticles + totalLots,
      articles: totalArticles,
      lots: totalLots,
      drafts: draftArticles + draftLots,
      ready: readyArticles + readyLots,
      scheduled: scheduledArticles + scheduledLots,
      published: publishedArticles + publishedLots,
      sold: soldArticles + soldLots,
      soldArticles: soldArticles,
      soldLots: soldLots,
      netProfit: totalNetProfit
    };
  }, [articles, lots]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <LayoutGrid className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Administration du catalogue</h1>
              <p className="text-gray-600">Gérez tous vos articles et lots en un seul endroit</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm px-4 py-4 border border-gray-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-600">Total</div>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <Package className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.total}</div>
              <div className="text-xs text-gray-500">{stats.articles} articles · {stats.lots} lots</div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-sm px-4 py-4 border border-slate-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-slate-600">Brouillons</div>
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center group-hover:bg-slate-300 transition-colors">
                  <SquarePen className="w-4 h-4 text-slate-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-700">{stats.drafts}</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm px-4 py-4 border border-blue-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-blue-600">Prêt</div>
                <div className="w-8 h-8 rounded-lg bg-blue-200 flex items-center justify-center group-hover:bg-blue-300 transition-colors">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-700">{stats.ready}</div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm px-4 py-4 border border-orange-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-orange-600">Planifié</div>
                <div className="w-8 h-8 rounded-lg bg-orange-200 flex items-center justify-center group-hover:bg-orange-300 transition-colors">
                  <Calendar className="w-4 h-4 text-orange-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-orange-700">{stats.scheduled}</div>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl shadow-sm px-4 py-4 border border-violet-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-violet-600">Publié</div>
                <div className="w-8 h-8 rounded-lg bg-violet-200 flex items-center justify-center group-hover:bg-violet-300 transition-colors">
                  <Upload className="w-4 h-4 text-violet-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-violet-700">{stats.published}</div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm px-4 py-4 border border-teal-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-teal-600">Vendus</div>
                <div className="w-8 h-8 rounded-lg bg-teal-200 flex items-center justify-center group-hover:bg-teal-300 transition-colors">
                  <ShoppingBag className="w-4 h-4 text-teal-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-teal-700">{stats.sold}</div>
              <div className="text-xs text-teal-600">{stats.soldArticles} articles · {stats.soldLots} lots</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-sm px-4 py-4 border border-emerald-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-emerald-600">Bénéfices</div>
                <div className="w-8 h-8 rounded-lg bg-emerald-200 flex items-center justify-center group-hover:bg-emerald-300 transition-colors">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-emerald-700">{stats.netProfit.toFixed(2)}€</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border mb-4">
          <div className="p-4 border-b space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => {
                      setFilters({ ...filters, search: e.target.value });
                      setCurrentPage(1);
                    }}
                    placeholder="Rechercher par titre, marque, référence..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  {filters.search && (
                    <button
                      onClick={() => setFilters({ ...filters, search: '' })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                  {filteredItems.length} résultat{filteredItems.length > 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="Vue grille"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="Vue liste"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditItemId(undefined);
                    setArticleFormOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-md"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Nouvel article
                </button>
                <button
                  onClick={() => {
                    setEditItemId(undefined);
                    setLotBuilderOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all hover:shadow-md"
                >
                  <Package className="w-4 h-4" />
                  Nouveau lot
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(filters.type || filters.status || filters.seller || filters.season) && (
                <button
                  onClick={() => {
                    setFilters({ type: '', status: '', seller: '', season: '', search: filters.search });
                    setCurrentPage(1);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Réinitialiser les filtres
                </button>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filters.type}
                  onChange={(e) => {
                    setFilters({ ...filters, type: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-full text-xs font-medium hover:border-gray-400 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                >
                  <option value="">Type: Tous</option>
                  <option value="article">Articles</option>
                  <option value="lot">Lots</option>
                </select>

                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({ ...filters, status: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-full text-xs font-medium hover:border-gray-400 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                >
                  <option value="">Statut: Tous</option>
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>

                <select
                  value={filters.seller}
                  onChange={(e) => {
                    setFilters({ ...filters, seller: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-full text-xs font-medium hover:border-gray-400 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                >
                  <option value="">Vendeur: Tous</option>
                  {sellers.map(seller => (
                    <option key={seller.id} value={seller.id}>{seller.name}</option>
                  ))}
                </select>

                <select
                  value={filters.season}
                  onChange={(e) => {
                    setFilters({ ...filters, season: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-full text-xs font-medium hover:border-gray-400 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                >
                  <option value="">Saison: Toutes</option>
                  {SEASON_OPTIONS.map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedItems.size > 0 && (
            <BulkActionsBar
              selectedCount={selectedItems.size}
              onClearSelection={() => setSelectedItems(new Set())}
              onBulkDelete={handleBulkDelete}
              onBulkStatusChange={handleBulkStatusChange}
              onBulkSellerChange={handleBulkSellerChange}
              onBulkSeasonChange={handleBulkSeasonChange}
              onBulkSchedule={() => setBulkScheduleModalOpen(true)}
              onBulkDuplicate={handleBulkDuplicate}
              familyMembers={sellers}
            />
          )}

          {viewMode === 'grid' ? (
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : paginatedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-lg">Aucun élément trouvé</p>
                  <p className="text-gray-400 text-sm mt-1">Ajustez vos filtres ou créez un nouvel article</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedItems.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const thumbnailUrl = getThumbnailUrl(item.photos);

                    return (
                      <div
                        key={item.id}
                        className={`group relative bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-lg ${
                          isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="absolute top-3 left-3 z-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                            className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div
                          className="cursor-pointer"
                          onClick={() => handleViewDetails(item)}
                        >
                          <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
                            {thumbnailUrl ? (
                              <LazyImage
                                src={thumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                    {item.type === 'article' ? (
                                      <ShoppingBag className="w-12 h-12 text-gray-400" />
                                    ) : (
                                      <Package className="w-12 h-12 text-gray-400" />
                                    )}
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                {item.type === 'article' ? (
                                  <ShoppingBag className="w-12 h-12 text-gray-400" />
                                ) : (
                                  <Package className="w-12 h-12 text-gray-400" />
                                )}
                              </div>
                            )}

                            <div className="absolute top-3 right-3 flex gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm ${
                                item.type === 'article'
                                  ? 'bg-blue-500/90 text-white'
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              }`}>
                                {item.type === 'article' ? 'Article' : 'Lot'}
                              </span>
                            </div>

                            <div className="absolute bottom-3 left-3 right-3">
                              <ArticleIndicators
                                title={item.title}
                                photos={item.photos}
                                brand={item.brand}
                                size={item.size}
                                price={item.price}
                                status={item.status}
                                compact={true}
                              />
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                                {item.title}
                              </h3>
                              {getStatusBadge(item.status)}
                            </div>

                            <div className="space-y-2 text-sm text-gray-600">
                              {item.brand && (
                                <div className="flex items-center gap-2">
                                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate">{item.brand}</span>
                                </div>
                              )}

                              {item.size && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-xs">Taille:</span>
                                  <span className="font-medium">{item.size}</span>
                                </div>
                              )}

                              {item.seller_id && (
                                <div className="flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate">{getSeller(item.seller_id)}</span>
                                </div>
                              )}

                              {item.reference_number && (
                                <div className="text-xs text-gray-500">
                                  Réf: {item.reference_number}
                                </div>
                              )}

                              {item.type === 'lot' && item.article_count !== undefined && (
                                <div className="flex items-center gap-2 text-purple-600">
                                  <Package className="w-3.5 h-3.5" />
                                  <span className="font-medium">{item.article_count} article{item.article_count > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <div className="text-xl font-bold text-gray-900">
                                {item.price ? `${item.price}€` : '-'}
                              </div>

                              {item.scheduled_for && (
                                <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(item.scheduled_for)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(item);
                              }}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4 text-gray-700" />
                            </button>

                            {item.type === 'article' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditItemId(item.id);
                                  setArticleFormOpen(true);
                                }}
                                className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                                title="Éditer"
                              >
                                <SquarePen className="w-4 h-4 text-blue-700" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditItemId(item.id);
                                  setLotBuilderOpen(true);
                                }}
                                className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
                                title="Éditer"
                              >
                                <SquarePen className="w-4 h-4 text-purple-700" />
                              </button>
                            )}

                            {canPublish(item) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePublish(item);
                                }}
                                className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                                title="Publier sur Vinted"
                              >
                                <Upload className="w-4 h-4 text-green-700" />
                              </button>
                            )}

                            {item.vinted_url && (
                              <a
                                href={item.vinted_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                                title="Voir sur Vinted"
                              >
                                <ExternalLink className="w-4 h-4 text-emerald-700" />
                              </a>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ id: item.id, title: item.title, type: item.type });
                              }}
                              className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4 text-red-700" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedItems.has(item.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left w-16">Photo</th>
                  <th className="px-4 py-3 text-left w-20">
                    <button
                      onClick={() => handleSort('type')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Type
                      {sortColumn === 'type' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-32">Indicateurs</th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('title')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Titre
                      {sortColumn === 'title' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-32">Marque</th>
                  <th className="px-4 py-3 text-left w-24">Taille</th>
                  <th className="px-4 py-3 text-left w-28">État</th>
                  <th className="px-4 py-3 text-left w-24">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Prix
                      {sortColumn === 'price' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-32">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Statut
                      {sortColumn === 'status' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-28">Vendeur</th>
                  <th className="px-4 py-3 text-left w-24">Saison</th>
                  <th className="px-4 py-3 text-left w-28">Planifié</th>
                  <th className="px-4 py-3 text-left w-28">Vendu</th>
                  <th className="px-4 py-3 text-left w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                      Aucun élément trouvé
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const isEditing = editState?.rowId === item.id;
                    const isSelected = selectedItems.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {getThumbnailUrl(item.photos) ? (
                            <LazyImage
                              src={getThumbnailUrl(item.photos)!}
                              alt={item.title}
                              className="w-12 h-12 rounded object-cover"
                              fallback={
                                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                                </div>
                              }
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                              {item.type === 'article' ? (
                                <ShoppingBag className="w-5 h-5 text-gray-400" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            item.type === 'article' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {item.type === 'article' ? <ShoppingBag className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                            {item.type === 'article' ? 'Article' : 'Lot'}
                          </span>
                          {item.type === 'lot' && item.article_count !== undefined && (
                            <div className="text-xs text-gray-500 mt-1">{item.article_count} article{item.article_count > 1 ? 's' : ''}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ArticleIndicators
                            title={item.title}
                            photos={item.photos}
                            brand={item.brand}
                            size={item.size}
                            price={item.price}
                            status={item.status}
                            compact={true}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'title' ? (
                            <input
                              ref={el => el && inputRefs.current.set(`${item.id}-title`, el)}
                              type="text"
                              value={item.title || ''}
                              onChange={(e) => handleChange(item, 'title', e.target.value)}
                              onBlur={() => saveCell(item, 'title')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'title');
                                if (e.key === 'Escape') cancelEdit(item, 'title');
                              }}
                              className="w-full px-2 py-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <div>
                              <div
                                className="font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                onClick={() => startEdit(item.id, 'title', item.title)}
                              >
                                {item.title}
                              </div>
                              {item.reference_number && (
                                <div className="text-xs text-gray-500">Réf: {item.reference_number}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'brand' ? (
                            <input
                              ref={el => el && inputRefs.current.set(`${item.id}-brand`, el)}
                              type="text"
                              value={item.brand || ''}
                              onChange={(e) => handleChange(item, 'brand', e.target.value)}
                              onBlur={() => saveCell(item, 'brand')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'brand');
                                if (e.key === 'Escape') cancelEdit(item, 'brand');
                              }}
                              className="w-full px-2 py-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'brand', item.brand)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-gray-700"
                            >
                              {item.brand || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'size' ? (
                            <input
                              ref={el => el && inputRefs.current.set(`${item.id}-size`, el)}
                              type="text"
                              value={item.size || ''}
                              onChange={(e) => handleChange(item, 'size', e.target.value)}
                              onBlur={() => saveCell(item, 'size')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'size');
                                if (e.key === 'Escape') cancelEdit(item, 'size');
                              }}
                              className="w-full px-2 py-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'size', item.size)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-gray-700"
                            >
                              {item.size || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'condition' ? (
                            <select
                              ref={el => el && inputRefs.current.set(`${item.id}-condition`, el)}
                              value={item.condition || ''}
                              onChange={(e) => handleChange(item, 'condition', e.target.value)}
                              onBlur={() => saveCell(item, 'condition')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'condition');
                                if (e.key === 'Escape') cancelEdit(item, 'condition');
                              }}
                              className="px-2 py-1 border rounded text-sm"
                              autoFocus
                            >
                              <option value="">-</option>
                              {CONDITION_OPTIONS.map(condition => (
                                <option key={condition} value={condition}>{condition}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'condition', item.condition)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-gray-700"
                            >
                              {item.condition || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'price' ? (
                            <input
                              ref={el => el && inputRefs.current.set(`${item.id}-price`, el)}
                              type="number"
                              step="0.01"
                              value={item.price || ''}
                              onChange={(e) => handleChange(item, 'price', parseFloat(e.target.value) || null)}
                              onBlur={() => saveCell(item, 'price')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'price');
                                if (e.key === 'Escape') cancelEdit(item, 'price');
                              }}
                              className="w-20 px-2 py-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'price', item.price)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {item.price ? `${item.price}€` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'status' ? (
                            <select
                              ref={el => el && inputRefs.current.set(`${item.id}-status`, el)}
                              value={item.status}
                              onChange={(e) => handleChange(item, 'status', e.target.value)}
                              onBlur={() => saveCell(item, 'status')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'status');
                                if (e.key === 'Escape') cancelEdit(item, 'status');
                              }}
                              className="px-2 py-1 border rounded text-sm"
                              autoFocus
                            >
                              {STATUS_OPTIONS.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'status', item.status)}
                              className="cursor-pointer"
                            >
                              {getStatusBadge(item.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'seller_id' ? (
                            <select
                              ref={el => el && inputRefs.current.set(`${item.id}-seller_id`, el)}
                              value={item.seller_id || ''}
                              onChange={(e) => handleChange(item, 'seller_id', e.target.value || null)}
                              onBlur={() => saveCell(item, 'seller_id')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'seller_id');
                                if (e.key === 'Escape') cancelEdit(item, 'seller_id');
                              }}
                              className="px-2 py-1 border rounded text-sm"
                              autoFocus
                            >
                              <option value="">-</option>
                              {sellers.map(seller => (
                                <option key={seller.id} value={seller.id}>{seller.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'seller_id', item.seller_id)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-gray-700"
                            >
                              {getSeller(item.seller_id)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'season' ? (
                            <select
                              ref={el => el && inputRefs.current.set(`${item.id}-season`, el)}
                              value={item.season || ''}
                              onChange={(e) => handleChange(item, 'season', e.target.value || null)}
                              onBlur={() => saveCell(item, 'season')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'season');
                                if (e.key === 'Escape') cancelEdit(item, 'season');
                              }}
                              className="px-2 py-1 border rounded text-sm"
                              autoFocus
                            >
                              <option value="">-</option>
                              {SEASON_OPTIONS.map(season => (
                                <option key={season} value={season}>{season}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'season', item.season)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-gray-700"
                            >
                              {item.season || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing && editState.field === 'scheduled_for' ? (
                            <input
                              ref={el => el && inputRefs.current.set(`${item.id}-scheduled_for`, el)}
                              type="datetime-local"
                              value={toDatetimeLocal(item.scheduled_for || null)}
                              onChange={(e) => handleChange(item, 'scheduled_for', fromDatetimeLocal(e.target.value))}
                              onBlur={() => saveCell(item, 'scheduled_for')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(item, 'scheduled_for');
                                if (e.key === 'Escape') cancelEdit(item, 'scheduled_for');
                              }}
                              className="px-2 py-1 border rounded text-xs"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(item.id, 'scheduled_for', item.scheduled_for)}
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-gray-700 text-xs"
                            >
                              {formatDate(item.scheduled_for)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{formatDate(item.sold_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(item);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            {item.type === 'article' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditItemId(item.id);
                                  setArticleFormOpen(true);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Éditer"
                              >
                                <SquarePen className="w-4 h-4 text-blue-600" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditItemId(item.id);
                                  setLotBuilderOpen(true);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Éditer"
                              >
                                <SquarePen className="w-4 h-4 text-purple-600" />
                              </button>
                            )}
                            {canPublish(item) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePublish(item);
                                }}
                                className="p-1 hover:bg-green-100 rounded"
                                title="Publier sur Vinted"
                              >
                                <Upload className="w-4 h-4 text-green-600" />
                              </button>
                            )}
                            {item.vinted_url && (
                              <a
                                href={item.vinted_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Voir sur Vinted"
                              >
                                <ExternalLink className="w-4 h-4 text-green-600" />
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ id: item.id, title: item.title, type: item.type });
                              }}
                              className="p-1 hover:bg-red-100 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          )}

          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 font-medium">
                {filteredItems.length > 0 ? (
                  <>
                    Affichage de <span className="text-gray-900 font-semibold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> à{' '}
                    <span className="text-gray-900 font-semibold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> sur{' '}
                    <span className="text-gray-900 font-semibold">{filteredItems.length}</span> élément{filteredItems.length > 1 ? 's' : ''}
                  </>
                ) : (
                  <span>Aucun élément</span>
                )}
              </div>

              {selectedItems.size > 0 && (
                <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full font-medium">
                  {selectedItems.size} sélectionné{selectedItems.size > 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Premier
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
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
                      className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Dernier
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}

      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title={`Supprimer ${deleteConfirm.type === 'article' ? 'l\'article' : 'le lot'}`}
          message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm.title}" ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
          variant="danger"
        />
      )}

      {selectedItem && (
        <AdminDetailDrawer
          item={selectedItem}
          isOpen={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedItem(null);
          }}
          onEdit={() => selectedItem && handleEdit(selectedItem)}
          onPublish={() => {
            if (selectedItem) {
              if (selectedItem.type === 'article') {
                navigate(`/articles/${selectedItem.id}/structure`);
              } else {
                navigate(`/lots/${selectedItem.id}/structure`);
              }
            }
          }}
          onDuplicate={handleDuplicate}
          onSchedule={handleSchedule}
          onMarkSold={handleMarkSold}
          onDelete={() => {
            if (selectedItem) {
              setDeleteConfirm({ type: selectedItem.type, id: selectedItem.id, title: selectedItem.title });
              setDrawerOpen(false);
            }
          }}
          onStatusChange={handleStatusChange}
          onLabelOpen={handleLabelOpen}
          formatDate={formatDateForDrawer}
        />
      )}

      {bulkScheduleModalOpen && (
        <BulkScheduleModal
          selectedIds={Array.from(selectedItems)}
          onClose={() => setBulkScheduleModalOpen(false)}
          onSuccess={() => {
            setBulkScheduleModalOpen(false);
            setSelectedItems(new Set());
            loadData();
          }}
        />
      )}

      {articleFormOpen && (
        <ArticleFormDrawer
          articleId={editItemId}
          isOpen={articleFormOpen}
          onClose={() => {
            setArticleFormOpen(false);
            setEditItemId(undefined);
          }}
          onSaved={() => {
            setArticleFormOpen(false);
            setEditItemId(undefined);
            loadData();
          }}
        />
      )}

      {lotBuilderOpen && (
        <LotBuilder
          isOpen={lotBuilderOpen}
          onClose={() => {
            setLotBuilderOpen(false);
            setEditItemId(undefined);
          }}
          onSuccess={() => {
            setLotBuilderOpen(false);
            setEditItemId(undefined);
            loadData();
          }}
          existingLotId={editItemId}
        />
      )}
    </div>
  );
}
