import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, SquarePen, Send, Calendar, Copy, Trash2, Tag, ExternalLink, CheckCircle, DollarSign } from 'lucide-react';
import { ArticleStatus } from '../../types/article';

interface QuickActionsMenuProps {
  articleId: string;
  status: ArticleStatus;
  hasVintedUrl?: boolean;
  vintedUrl?: string;
  onView: () => void;
  onEdit: () => void;
  onPublish?: () => void;
  onSchedule?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGenerateLabel?: () => void;
  onMarkSold?: () => void;
  onChangeStatus?: (status: ArticleStatus) => void;
}

export function QuickActionsMenu({
  articleId,
  status,
  hasVintedUrl,
  vintedUrl,
  onView,
  onEdit,
  onPublish,
  onSchedule,
  onDuplicate,
  onDelete,
  onGenerateLabel,
  onMarkSold,
  onChangeStatus,
}: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const canPublish = status === 'ready' || status === 'scheduled';
  const canSchedule = status === 'draft' || status === 'ready';
  const canMarkSold = status === 'published';
  const isPublished = status === 'published';
  const isSold = status === 'sold' || status === 'vendu_en_lot';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Actions rapides"
      >
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px] z-50">
          <button
            onClick={() => handleAction(onView)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4 text-gray-500" />
            <span>Voir les détails</span>
          </button>

          {!isSold && (
            <button
              onClick={() => handleAction(onEdit)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <SquarePen className="w-4 h-4 text-gray-500" />
              <span>Modifier</span>
            </button>
          )}

          {canPublish && onPublish && (
            <>
              <div className="h-px bg-gray-100 my-1" />
              <button
                onClick={() => handleAction(onPublish)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors font-medium"
              >
                <Send className="w-4 h-4" />
                <span>Publier maintenant</span>
              </button>
            </>
          )}

          {canSchedule && onSchedule && (
            <button
              onClick={() => handleAction(onSchedule)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Planifier</span>
            </button>
          )}

          {canMarkSold && onMarkSold && (
            <button
              onClick={() => handleAction(onMarkSold)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              <span>Marquer vendu</span>
            </button>
          )}

          <div className="h-px bg-gray-100 my-1" />

          <button
            onClick={() => handleAction(onDuplicate)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-4 h-4 text-gray-500" />
            <span>Dupliquer</span>
          </button>

          {onGenerateLabel && (
            <button
              onClick={() => handleAction(onGenerateLabel)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Tag className="w-4 h-4 text-gray-500" />
              <span>Générer étiquette</span>
            </button>
          )}

          {isPublished && hasVintedUrl && vintedUrl && (
            <a
              href={vintedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Voir sur Vinted</span>
            </a>
          )}

          {onChangeStatus && !isSold && (
            <>
              <div className="h-px bg-gray-100 my-1" />
              <div className="px-2 py-1.5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">
                  Changer le statut
                </div>
                {status !== 'ready' && (
                  <button
                    onClick={() => handleAction(() => onChangeStatus('ready'))}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>Marquer prêt</span>
                  </button>
                )}
                {status !== 'draft' && (
                  <button
                    onClick={() => handleAction(() => onChangeStatus('draft'))}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-gray-500" />
                    <span>Repasser en brouillon</span>
                  </button>
                )}
              </div>
            </>
          )}

          <div className="h-px bg-gray-100 my-1" />

          <button
            onClick={() => handleAction(onDelete)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer</span>
          </button>
        </div>
      )}
    </div>
  );
}
