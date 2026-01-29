import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, TrendingDown, Sun, Clock, AlertCircle, Package, X, ChevronRight, RefreshCw, Bell, Check, Loader2, Hash, Search, Minimize2 } from 'lucide-react';
import { generateProactiveInsights, ProactiveInsight, optimizeArticleSEO } from '../lib/geminiService';
import { generateLotTitleAndDescription } from '../lib/lotAnalysisService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Article } from '../types/article';
import { Toast } from './ui/Toast';

interface KellyProactiveProps {
  onNavigateToArticle?: (articleId: string) => void;
  onCreateBundle?: (articleIds: string[]) => void;
  onRefreshData?: () => void;
  isOpenFromHeader?: boolean;
  onToggleFromHeader?: () => void;
  onInsightsCountChange?: (count: number) => void;
}

const INSIGHT_CONFIG: Record<string, { icon: typeof TrendingDown; color: string; bg: string; border: string }> = {
  ready_to_publish: {
    icon: Sparkles,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  ready_to_list: {
    icon: Sparkles,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  price_drop: {
    icon: TrendingDown,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  seasonal: {
    icon: Sun,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  stale: {
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  incomplete: {
    icon: AlertCircle,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  opportunity: {
    icon: Sparkles,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  bundle: {
    icon: Package,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  seo_optimization: {
    icon: Search,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
};

const PRIORITY_BADGE: Record<string, { label: string; class: string }> = {
  high: { label: 'Urgent', class: 'bg-red-100 text-red-700' },
  medium: { label: 'Important', class: 'bg-amber-100 text-amber-700' },
  low: { label: 'Conseil', class: 'bg-gray-100 text-gray-700' },
};

interface ActionModalState {
  isOpen: boolean;
  insight: ProactiveInsight | null;
  articles: any[];
  loading: boolean;
  success: boolean;
}

export function KellyProactive({ onNavigateToArticle, onCreateBundle, onRefreshData, isOpenFromHeader, onToggleFromHeader, onInsightsCountChange }: KellyProactiveProps) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState>({
    isOpen: false,
    insight: null,
    articles: [],
    loading: false,
    success: false,
  });
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadInsights();
    }
  }, [user]);

  useEffect(() => {
    if (isOpenFromHeader !== undefined) {
      setExpanded(isOpenFromHeader);
    }
  }, [isOpenFromHeader]);

  const handleMinimize = () => {
    setIsMinimizing(true);
    setTimeout(() => {
      setExpanded(false);
      setIsMinimizing(false);
    }, 400);
  };

  const loadInsights = async (forceRefresh = false) => {
    if (!user || loading) return;

    setLoading(true);
    try {
      if (!forceRefresh) {
        const cachedInsights = await loadCachedInsights();
        if (cachedInsights && cachedInsights.length > 0) {
          setInsights(cachedInsights.filter(i => !dismissed.has(i.title)));
          setLastRefresh(new Date());
          setLoading(false);
          return;
        }
      }

      const [articlesResult, soldResult] = await Promise.all([
        supabase
          .from('articles')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['draft', 'ready', 'published', 'scheduled']),
        supabase
          .from('articles')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'sold'),
      ]);

      if (articlesResult.error) throw articlesResult.error;
      if (soldResult.error) throw soldResult.error;

      const currentMonth = new Date().getMonth() + 1;
      const generatedInsights = await generateProactiveInsights(
        articlesResult.data || [],
        soldResult.data || [],
        currentMonth
      );

      const enrichedInsights = await Promise.all(
        generatedInsights.map(async (insight) => {
          if (insight.articleIds && insight.articleIds.length > 0) {
            const { data: articles } = await supabase
              .from('articles')
              .select('title')
              .eq('user_id', user.id)
              .in('id', insight.articleIds);

            return {
              ...insight,
              articleTitles: articles?.map(a => a.title) || []
            };
          }
          return insight;
        })
      );

      await saveCachedInsights(enrichedInsights);

      setInsights(enrichedInsights.filter(i => !dismissed.has(i.title)));
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCachedInsights = async (): Promise<ProactiveInsight[] | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('kelly_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('cache_key', 'default')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading cached insights:', error);
        return null;
      }

      if (!data || data.length === 0) return null;

      const lastRefreshTime = new Date(data[0].last_refresh_at);
      const now = new Date();
      const minutesSinceRefresh = (now.getTime() - lastRefreshTime.getTime()) / (1000 * 60);

      if (minutesSinceRefresh > 30) {
        return null;
      }

      return data.map(insight => ({
        type: insight.type as any,
        priority: insight.priority as any,
        title: insight.title,
        message: insight.message,
        actionLabel: insight.action_label,
        articleIds: insight.article_ids,
        suggestedAction: insight.suggested_action,
      }));
    } catch (error) {
      console.error('Error loading cached insights:', error);
      return null;
    }
  };

  const saveCachedInsights = async (insights: ProactiveInsight[]) => {
    if (!user || insights.length === 0) return;

    try {
      await supabase
        .from('kelly_insights')
        .delete()
        .eq('user_id', user.id)
        .eq('cache_key', 'default');

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

      const insightsToInsert = insights.map(insight => ({
        user_id: user.id,
        type: insight.type,
        priority: insight.priority,
        title: insight.title,
        message: insight.message,
        action_label: insight.actionLabel,
        article_ids: insight.articleIds || [],
        suggested_action: insight.suggestedAction || null,
        status: 'active',
        cache_key: 'default',
        last_refresh_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }));

      const { error } = await supabase
        .from('kelly_insights')
        .insert(insightsToInsert);

      if (error) {
        console.error('Error saving cached insights:', error);
      }
    } catch (error) {
      console.error('Error saving cached insights:', error);
    }
  };

  const handleDismiss = (insight: ProactiveInsight) => {
    setDismissed(prev => new Set([...prev, insight.title]));
    setInsights(prev => prev.filter(i => i.title !== insight.title));
  };

  const loadArticlesForAction = async (articleIds: string[]) => {
    if (!user || !articleIds.length) return [];

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, price, brand, photos')
      .eq('user_id', user.id)
      .in('id', articleIds);

    if (error) {
      console.error('Error loading articles:', error);
      return [];
    }
    return data || [];
  };

  const executeAction = async (insight: ProactiveInsight) => {
    if (!user || !insight.articleIds?.length) return;

    setExecutingAction(insight.title);

    try {
      let shouldReloadInsights = false;

      switch (insight.type) {
        case 'ready_to_publish':
        case 'ready_to_list': {
          for (const articleId of insight.articleIds) {
            await supabase
              .from('articles')
              .update({ status: 'ready', updated_at: new Date().toISOString() })
              .eq('id', articleId)
              .eq('user_id', user.id);
          }

          handleDismiss(insight);
          onRefreshData?.();
          setToast({
            type: 'success',
            text: `${insight.articleIds.length} article${insight.articleIds.length > 1 ? 's passés' : ' passé'} en statut "Prêt" avec succès !`
          });
          shouldReloadInsights = true;
          break;
        }

        case 'price_drop': {
          const percentage = insight.suggestedAction?.value
            ? parseInt(insight.suggestedAction.value as string)
            : 10;

          const articles = await loadArticlesForAction(insight.articleIds);

          for (const article of articles) {
            const currentPrice = parseFloat(article.price) || 0;
            const newPrice = Math.round(currentPrice * (1 - percentage / 100));

            await supabase
              .from('articles')
              .update({ price: newPrice, updated_at: new Date().toISOString() })
              .eq('id', article.id)
              .eq('user_id', user.id);
          }

          handleDismiss(insight);
          onRefreshData?.();
          setToast({
            type: 'success',
            text: `Prix baissé de ${percentage}% sur ${articles.length} article${articles.length > 1 ? 's' : ''} !`
          });
          shouldReloadInsights = true;
          break;
        }

        case 'bundle': {
          if (!insight.articleIds || insight.articleIds.length < 2) break;

          const { data: fullArticles, error: articlesError } = await supabase
            .from('articles')
            .select('*')
            .eq('user_id', user.id)
            .in('id', insight.articleIds);

          if (articlesError || !fullArticles) {
            console.error('Error loading articles:', articlesError);
            break;
          }

          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('writing_style, default_seller_id')
            .eq('user_id', user.id)
            .single();

          const totalPrice = fullArticles.reduce((sum, article) => sum + (Number(article.price) || 0), 0);
          const discountPercentage = 15;
          const lotPrice = Math.round(totalPrice * (1 - discountPercentage / 100));

          const analysis = await generateLotTitleAndDescription(
            fullArticles as Article[],
            userProfile?.writing_style || undefined
          );

          const allPhotos = fullArticles.flatMap(article => article.photos || []);
          const coverPhoto = allPhotos[0] || null;

          const { data: newLot, error: lotError } = await supabase
            .from('lots')
            .insert({
              user_id: user.id,
              name: analysis.title,
              description: analysis.description,
              price: lotPrice,
              original_total_price: totalPrice,
              discount_percentage: discountPercentage,
              cover_photo: coverPhoto,
              photos: allPhotos,
              status: 'draft',
              seller_id: userProfile?.default_seller_id || null,
              seo_keywords: analysis.seo_keywords,
              hashtags: analysis.hashtags,
              search_terms: analysis.search_terms,
              ai_confidence_score: analysis.ai_confidence_score,
            })
            .select()
            .single();

          if (lotError || !newLot) {
            console.error('Error creating lot:', lotError);
            break;
          }

          const lotItems = insight.articleIds.map(articleId => ({
            lot_id: newLot.id,
            article_id: articleId,
          }));

          const { error: itemsError } = await supabase
            .from('lot_items')
            .insert(lotItems);

          if (itemsError) {
            console.error('Error creating lot items:', itemsError);
            await supabase.from('lots').delete().eq('id', newLot.id);
            break;
          }

          handleDismiss(insight);
          onRefreshData?.();
          window.dispatchEvent(new CustomEvent('kellyLotCreated', { detail: { lotId: newLot.id } }));
          setToast({
            type: 'success',
            text: `Lot créé avec succès : ${analysis.title}`
          });
          shouldReloadInsights = true;
          break;
        }

        case 'seasonal':
        case 'opportunity': {
          if (insight.articleIds?.[0] && onNavigateToArticle) {
            onNavigateToArticle(insight.articleIds[0]);
          }
          break;
        }

        case 'stale': {
          const percentage = 15;
          const articles = await loadArticlesForAction(insight.articleIds);

          for (const article of articles) {
            const currentPrice = parseFloat(article.price) || 0;
            const newPrice = Math.round(currentPrice * (1 - percentage / 100));

            await supabase
              .from('articles')
              .update({ price: newPrice, updated_at: new Date().toISOString() })
              .eq('id', article.id)
              .eq('user_id', user.id);
          }

          handleDismiss(insight);
          onRefreshData?.();
          setToast({
            type: 'success',
            text: `Prix baissé de ${percentage}% sur ${articles.length} article${articles.length > 1 ? 's inactifs' : ' inactif'} !`
          });
          shouldReloadInsights = true;
          break;
        }

        case 'seo_optimization': {
          if (!insight.articleIds || insight.articleIds.length === 0) break;

          let optimizedCount = 0;

          for (const articleId of insight.articleIds) {
            const { data: article } = await supabase
              .from('articles')
              .select('*')
              .eq('id', articleId)
              .eq('user_id', user.id)
              .single();

            if (!article) continue;

            const seoData = await optimizeArticleSEO(article);

            await supabase
              .from('articles')
              .update({
                seo_keywords: seoData.seo_keywords,
                hashtags: seoData.hashtags,
                search_terms: seoData.search_terms,
                updated_at: new Date().toISOString(),
              })
              .eq('id', articleId)
              .eq('user_id', user.id);

            optimizedCount++;
          }

          if (optimizedCount > 0) {
            handleDismiss(insight);
            onRefreshData?.();
            setToast({
              type: 'success',
              text: `SEO optimisé pour ${optimizedCount} article${optimizedCount > 1 ? 's' : ''} avec succès !`
            });
            shouldReloadInsights = true;
          }
          break;
        }

        case 'incomplete': {
          if (insight.articleIds?.[0] && onNavigateToArticle) {
            onNavigateToArticle(insight.articleIds[0]);
          }
          break;
        }

        default: {
          if (insight.articleIds?.[0] && onNavigateToArticle) {
            onNavigateToArticle(insight.articleIds[0]);
          }
        }
      }

      if (shouldReloadInsights) {
        setTimeout(() => {
          loadInsights(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setToast({
        type: 'error',
        text: 'Une erreur est survenue lors de l\'exécution de l\'action'
      });
    } finally {
      setExecutingAction(null);
    }
  };

  const handleAction = async (insight: ProactiveInsight) => {
    if (insight.type === 'price_drop' || insight.type === 'stale' || insight.type === 'ready_to_publish' || insight.type === 'ready_to_list' || insight.type === 'bundle' || insight.type === 'seo_optimization') {
      const articles = await loadArticlesForAction(insight.articleIds || []);
      setActionModal({
        isOpen: true,
        insight,
        articles,
        loading: false,
        success: false,
      });
    } else {
      executeAction(insight);
    }
  };

  const confirmAction = async () => {
    if (!actionModal.insight) return;

    setActionModal(prev => ({ ...prev, loading: true }));
    await executeAction(actionModal.insight);
    setActionModal(prev => ({ ...prev, loading: false, success: true }));

    setTimeout(() => {
      setActionModal({
        isOpen: false,
        insight: null,
        articles: [],
        loading: false,
        success: false,
      });
    }, 1500);
  };

  const visibleInsights = insights.filter(i => !dismissed.has(i.title));

  useEffect(() => {
    if (onInsightsCountChange) {
      onInsightsCountChange(visibleInsights.length);
    }
  }, [visibleInsights.length, onInsightsCountChange]);

  if (!expanded) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-24 right-4 sm:bottom-24 sm:right-6 z-[60] transition-all duration-500 ease-out w-[360px] max-w-[calc(100vw-2rem)]">
        {expanded && (
          <div className={`bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden ${isMinimizing ? 'animate-kelly-minimize' : 'animate-kelly-expand'}`}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img
                      src="/kelly-avatar.png"
                      alt="Kelly"
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Kelly a des conseils</h3>
                    <p className="text-[10px] text-white/70">
                      {visibleInsights.length} suggestion{visibleInsights.length > 1 ? 's' : ''} pour booster tes ventes
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => loadInsights(true)}
                    disabled={loading}
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Rafraichir"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleMinimize}
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Minimiser"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setExpanded(false);
                      onToggleFromHeader?.();
                    }}
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-3 space-y-2">
              {loading && visibleInsights.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">Kelly analyse ton dressing...</p>
                  </div>
                </div>
              ) : loading && visibleInsights.length > 0 ? (
                <>
                  {visibleInsights.map((insight, idx) => {
                    const config = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.opportunity;
                    const priority = PRIORITY_BADGE[insight.priority] || PRIORITY_BADGE.low;
                    const Icon = config.icon;
                    const isExecuting = executingAction === insight.title;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${config.border} ${config.bg} group hover:shadow-md transition-all`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-white/80 ${config.color} flex-shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.class}`}>
                                {priority.label}
                              </span>
                              {(insight.type === 'price_drop' || insight.type === 'stale' || insight.type === 'bundle' || insight.type === 'ready_to_publish' || insight.type === 'ready_to_list' || insight.type === 'seo_optimization') && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                  Action rapide
                                </span>
                              )}
                            </div>
                            {insight.articleTitles && insight.articleTitles.length > 0 && (
                              <div className="mb-1">
                                <p className="text-xs text-gray-500 font-medium">
                                  {insight.articleTitles.length === 1 ? (
                                    <span>{insight.articleTitles[0]}</span>
                                  ) : (
                                    <span>{insight.articleTitles.length} articles concernés</span>
                                  )}
                                </p>
                              </div>
                            )}
                            <h4 className={`font-semibold text-sm ${config.color} mb-1`}>
                              {insight.title}
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2">
                              {insight.message}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAction(insight)}
                                disabled={isExecuting}
                                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                                  insight.type === 'price_drop' || insight.type === 'stale' || insight.type === 'bundle' || insight.type === 'ready_to_publish' || insight.type === 'ready_to_list' || insight.type === 'seo_optimization'
                                    ? `${config.bg} ${config.color} border ${config.border} hover:shadow-sm`
                                    : `${config.color} hover:underline`
                                } disabled:opacity-50`}
                              >
                                {isExecuting ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    {insight.actionLabel}
                                    <ChevronRight className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDismiss(insight)}
                                className="ml-auto p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Ignorer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center py-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <p className="text-xs font-medium">Recherche de nouvelles suggestions...</p>
                    </div>
                  </div>
                </>
              ) : (
                visibleInsights.map((insight, idx) => {
                  const config = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.opportunity;
                  const priority = PRIORITY_BADGE[insight.priority] || PRIORITY_BADGE.low;
                  const Icon = config.icon;
                  const isExecuting = executingAction === insight.title;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border ${config.border} ${config.bg} group hover:shadow-md transition-all`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white/80 ${config.color} flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.class}`}>
                              {priority.label}
                            </span>
                            {(insight.type === 'price_drop' || insight.type === 'stale' || insight.type === 'bundle' || insight.type === 'ready_to_publish' || insight.type === 'ready_to_list' || insight.type === 'seo_optimization') && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                Action rapide
                              </span>
                            )}
                          </div>
                          {insight.articleTitles && insight.articleTitles.length > 0 && (
                            <div className="mb-1">
                              <p className="text-xs text-gray-500 font-medium">
                                {insight.articleTitles.length === 1 ? (
                                  <span>{insight.articleTitles[0]}</span>
                                ) : (
                                  <span>{insight.articleTitles.length} articles concernés</span>
                                )}
                              </p>
                            </div>
                          )}
                          <h4 className={`font-semibold text-sm ${config.color} mb-1`}>
                            {insight.title}
                          </h4>
                          <p className="text-xs text-gray-600 leading-relaxed mb-2">
                            {insight.message}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAction(insight)}
                              disabled={isExecuting}
                              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                                insight.type === 'price_drop' || insight.type === 'stale' || insight.type === 'bundle' || insight.type === 'ready_to_publish' || insight.type === 'ready_to_list' || insight.type === 'seo_optimization'
                                  ? `${config.bg} ${config.color} border ${config.border} hover:shadow-sm`
                                  : `${config.color} hover:underline`
                              } disabled:opacity-50`}
                            >
                              {isExecuting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  {insight.actionLabel}
                                  <ChevronRight className="w-3 h-3" />
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDismiss(insight)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Ignorer
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {lastRefresh && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center">
                  Mis a jour : {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {actionModal.isOpen && actionModal.insight && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">
              <h3 className="font-bold text-white text-lg">Confirmer l'action</h3>
              <p className="text-sm text-white/80">{actionModal.insight.title}</p>
            </div>

            <div className="p-5">
              {actionModal.success ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Action effectuee !</p>
                  <p className="text-sm text-gray-600">
                    {actionModal.insight?.type === 'ready_to_publish' || actionModal.insight?.type === 'ready_to_list'
                      ? 'Les articles sont maintenant prets'
                      : actionModal.insight?.type === 'bundle'
                      ? 'Le lot a ete cree avec succes'
                      : actionModal.insight?.type === 'seo_optimization'
                      ? 'Le referencement a ete optimise'
                      : 'Les prix ont ete mis a jour'}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {actionModal.insight.type === 'price_drop' || actionModal.insight.type === 'stale'
                      ? `Cette action va baisser le prix des articles suivants de ${actionModal.insight.suggestedAction?.value || 15}% :`
                      : actionModal.insight.type === 'ready_to_publish'
                      ? `Cette action va passer les articles suivants en statut "Pret" pour publication :`
                      : actionModal.insight.type === 'ready_to_list'
                      ? `Cette action va passer les articles suivants en statut "Pret" :`
                      : actionModal.insight.type === 'bundle'
                      ? `Cette action va creer automatiquement un lot avec les articles suivants (reduction de 15% appliquee) :`
                      : actionModal.insight.type === 'seo_optimization'
                      ? `Cette action va optimiser le referencement (mots-cles SEO, hashtags, termes de recherche) des articles suivants :`
                      : actionModal.insight.message}
                  </p>

                  {actionModal.articles.length > 0 && (
                    <>
                      <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                        {actionModal.articles.map((article) => {
                          const currentPrice = parseFloat(article.price) || 0;
                          const percentage = actionModal.insight?.suggestedAction?.value
                            ? parseInt(actionModal.insight.suggestedAction.value as string)
                            : 15;
                          const newPrice = Math.round(currentPrice * (1 - percentage / 100));
                          const isPriceAction = actionModal.insight?.type === 'price_drop' || actionModal.insight?.type === 'stale';
                          const isBundle = actionModal.insight?.type === 'bundle';

                          return (
                            <div key={article.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                              {article.photos?.[0] && (
                                <img
                                  src={article.photos[0]}
                                  alt={article.title}
                                  className="w-12 h-12 object-cover rounded-lg"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {article.title}
                                </p>
                                <p className="text-xs text-gray-500">{article.brand}</p>
                              </div>
                              <div className="text-right">
                                {isPriceAction ? (
                                  <>
                                    <p className="text-sm text-gray-400 line-through">{currentPrice} EUR</p>
                                    <p className="text-sm font-bold text-emerald-600">{newPrice} EUR</p>
                                  </>
                                ) : isBundle ? (
                                  <p className="text-sm text-gray-600">{currentPrice} EUR</p>
                                ) : (
                                  <p className="text-sm font-bold text-emerald-600">→ Pret</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {actionModal.insight?.type === 'bundle' && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">Total articles :</span>
                            <span className="font-medium text-gray-900">
                              {actionModal.articles.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0).toFixed(2)} EUR
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-emerald-700 font-semibold">Prix du lot (-15%) :</span>
                            <span className="font-bold text-emerald-700">
                              {Math.round(actionModal.articles.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0) * 0.85)} EUR
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setActionModal({ isOpen: false, insight: null, articles: [], loading: false, success: false })}
                      disabled={actionModal.loading}
                      className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={confirmAction}
                      disabled={actionModal.loading}
                      className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionModal.loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Application...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Appliquer
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          type={toast.type}
          text={toast.text}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
