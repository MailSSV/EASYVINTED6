import { X, Trash2, Calendar, User, Sun, CheckCircle, Clock, Send, Copy } from 'lucide-react';
import { ArticleStatus, Season } from '../../types/article';
import { useState } from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkStatusChange: (status: ArticleStatus) => void;
  onBulkSellerChange: (sellerId: string | null) => void;
  onBulkSeasonChange: (season: Season) => void;
  onBulkSchedule: () => void;
  onBulkDuplicate: () => void;
  familyMembers: Array<{ id: string; name: string }>;
}

const STATUS_OPTIONS: Array<{ value: ArticleStatus; label: string; icon: React.ReactNode }> = [
  { value: 'draft', label: 'Brouillon', icon: <CheckCircle className="w-3 h-3" /> },
  { value: 'ready', label: 'Prêt', icon: <CheckCircle className="w-3 h-3" /> },
  { value: 'scheduled', label: 'Planifié', icon: <Clock className="w-3 h-3" /> },
  { value: 'published', label: 'Publié', icon: <Send className="w-3 h-3" /> },
];

const SEASON_OPTIONS: Array<{ value: Season; label: string }> = [
  { value: 'spring', label: 'Printemps' },
  { value: 'summer', label: 'Été' },
  { value: 'autumn', label: 'Automne' },
  { value: 'winter', label: 'Hiver' },
  { value: 'all-seasons', label: 'Toutes saisons' },
];

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkStatusChange,
  onBulkSellerChange,
  onBulkSeasonChange,
  onBulkSchedule,
  onBulkDuplicate,
  familyMembers,
}: BulkActionsBarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSellerMenu, setShowSellerMenu] = useState(false);
  const [showSeasonMenu, setShowSeasonMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
              {selectedCount}
            </div>
            <span className="text-sm font-medium">
              {selectedCount} article{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                Statut
              </button>
              {showStatusMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onBulkStatusChange(option.value);
                        setShowStatusMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSellerMenu(!showSellerMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
              >
                <User className="w-4 h-4" />
                Vendeur
              </button>
              {showSellerMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px] max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      onBulkSellerChange(null);
                      setShowSellerMenu(false);
                    }}
                    className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                  >
                    Non assigné
                  </button>
                  {familyMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        onBulkSellerChange(member.id);
                        setShowSellerMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSeasonMenu(!showSeasonMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Sun className="w-4 h-4" />
                Saison
              </button>
              {showSeasonMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]">
                  {SEASON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onBulkSeasonChange(option.value);
                        setShowSeasonMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onBulkSchedule}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
              <Calendar className="w-4 h-4" />
              Planifier
            </button>

            <button
              onClick={onBulkDuplicate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium"
            >
              <Copy className="w-4 h-4" />
              Dupliquer
            </button>

            <button
              onClick={onBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <button
            onClick={onClearSelection}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title="Annuler la sélection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
