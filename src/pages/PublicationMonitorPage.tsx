import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, CheckCircle, Clock, AlertTriangle, ExternalLink, Eye, FileText, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { LazyImage } from '../components/ui/LazyImage';
import { useImageUrl } from '../hooks/useImageUrls';

interface MonitorArticle {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  photos: string[];
  vinted_url: string | null;
  published_at: string | null;
  sale_notes: string | null;
  created_at: string;
  updated_at: string;
  reference_number: string | null;
  brand: string | null;
}

interface Stats {
  total: number;
  published: number;
  vinted_draft: number;
  error: number;
  needsIntervention: number;
  successRate: number;
}

type FilterStatus = 'all' | 'published' | 'vinted_draft' | 'error';

function ArticleThumbnail({ photoPath, title }: { photoPath: string | undefined; title: string }) {
  const imageUrl = useImageUrl(photoPath);

  if (!imageUrl) {
    return (
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
        <Package className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  return (
    <LazyImage
      src={imageUrl}
      alt={title}
      className="w-12 h-12 rounded-lg object-cover ring-1 ring-gray-200"
      fallback={
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
          <Package className="w-5 h-5 text-gray-400" />
        </div>
      }
    />
  );
}

export function PublicationMonitorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [articles, setArticles] = useState<MonitorArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedArticle, setSelectedArticle] = useState<MonitorArticle | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchArticles();
    }
  }, [user]);

  const fetchArticles = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['published', 'vinted_draft', 'error'])
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setToast({
        type: 'error',
        text: 'Erreur lors du chargement des publications',
      });
    } finally {
      setLoading(false);
    }
  };

  const stats: Stats = useMemo(() => {
    const total = articles.length;
    const published = articles.filter(a => a.status === 'published').length;
    const vinted_draft = articles.filter(a => a.status === 'vinted_draft').length;
    const error = articles.filter(a => a.status === 'error').length;

    const needsIntervention = articles.filter(a => {
      if (a.status === 'error') return true;
      if (a.status === 'vinted_draft' && a.sale_notes?.includes('[ERROR]')) return true;
      return false;
    }).length;

    const successRate = total > 0 ? (published / total) * 100 : 0;

    return { total, published, vinted_draft, error, needsIntervention, successRate };
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (filter === 'all') return articles;
    return articles.filter(a => a.status === filter);
  }, [articles, filter]);

  const extractErrorFromNotes = (notes: string | null): string | null => {
    if (!notes) return null;
    const errorMatch = notes.match(/\[ERROR:([^\]]+)\]/);
    return errorMatch ? errorMatch[1].trim() : null;
  };

  const getStatusBadge = (article: MonitorArticle) => {
    if (article.status === 'published') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Publié
        </span>
      );
    }
    if (article.status === 'vinted_draft') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
          <Clock className="w-3 h-3 mr-1" />
          Brouillon Vinted
        </span>
      );
    }
    if (article.status === 'error') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Erreur
        </span>
      );
    }
    return null;
  };

  const handleRetry = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({
          status: 'ready',
          sale_notes: null
        })
        .eq('id', articleId);

      if (error) throw error;

      setToast({ type: 'success', text: 'Article remis en file d\'attente' });
      await fetchArticles();
    } catch (error) {
      console.error('Error retrying:', error);
      setToast({ type: 'error', text: 'Erreur lors de la remise en file' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Chargement du monitoring...</p>
      </div>
    );
  }

  return (
    <>
      {toast && <Toast message={toast.text} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Monitoring des Publications</h1>
              <p className="text-sm text-gray-600 mt-1">
                Suivi des publications automatiques Vinted
              </p>
            </div>
          </div>
          <Button onClick={fetchArticles} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Brouillons Vinted</p>
                <p className="text-2xl font-bold text-violet-600 mt-1">{stats.vinted_draft}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-violet-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              En attente sur Vinted
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Publications réussies</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.published}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Taux: {stats.successRate.toFixed(1)}%
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Erreurs</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.error}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Publications échouées
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Intervention requise</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.needsIntervention}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Action manuelle nécessaire
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filtrer:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tous ({stats.total})
            </button>
            <button
              onClick={() => setFilter('vinted_draft')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'vinted_draft'
                  ? 'bg-violet-600 text-white'
                  : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
              }`}
            >
              Brouillons Vinted ({stats.vinted_draft})
            </button>
            <button
              onClick={() => setFilter('published')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'published'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              Publiés ({stats.published})
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Erreurs ({stats.error})
            </button>
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun article</h3>
            <p className="text-slate-500">
              {filter === 'all'
                ? 'Aucune publication en cours ou terminée'
                : `Aucun article avec le statut "${filter}"`
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Photo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Article
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lien Vinted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Erreur
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredArticles.map((article) => {
                    const errorMsg = extractErrorFromNotes(article.sale_notes);
                    return (
                      <tr key={article.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <ArticleThumbnail
                            photoPath={article.photos && article.photos.length > 0 ? article.photos[0] : undefined}
                            title={article.title}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            Réf: {article.reference_number || article.id.substring(0, 8)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {article.brand} • {article.price?.toFixed(2)}€
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(article)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {article.published_at ? (
                            <div>
                              <div className="font-medium">
                                {new Date(article.published_at).toLocaleDateString('fr-FR')}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(article.published_at).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">
                              Mis à jour: {new Date(article.updated_at).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {article.vinted_url ? (
                            <a
                              href={article.vinted_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Voir
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {errorMsg ? (
                            <div className="text-xs text-red-600 max-w-xs truncate" title={errorMsg}>
                              {errorMsg}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedArticle(article);
                                setShowDetailModal(true);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {article.status === 'error' && (
                              <button
                                onClick={() => handleRetry(article.id)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                Republier
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showDetailModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedArticle.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Référence: {selectedArticle.reference_number || selectedArticle.id}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Statut actuel</h3>
                {getStatusBadge(selectedArticle)}
              </div>

              {selectedArticle.vinted_url && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Lien Vinted</h3>
                  <a
                    href={selectedArticle.vinted_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 break-all"
                  >
                    {selectedArticle.vinted_url}
                  </a>
                </div>
              )}

              {selectedArticle.published_at && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Date de publication</h3>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedArticle.published_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              )}

              {selectedArticle.sale_notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Historique & Logs</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedArticle.sale_notes}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Marque</h3>
                  <p className="text-sm text-gray-900">{selectedArticle.brand || '-'}</p>
                </div>
              </div>

              {selectedArticle.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                  <p className="text-sm text-gray-600">{selectedArticle.description}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              {selectedArticle.status === 'error' && (
                <Button
                  onClick={() => {
                    handleRetry(selectedArticle.id);
                    setShowDetailModal(false);
                  }}
                >
                  Republier cet article
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
