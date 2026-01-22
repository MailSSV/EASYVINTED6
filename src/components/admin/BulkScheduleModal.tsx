import { X, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '../ui/Modal';

interface BulkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scheduledDate: string) => void;
  selectedCount: number;
}

export function BulkScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}: BulkScheduleModalProps) {
  const [scheduledDate, setScheduledDate] = useState('');

  const handleConfirm = () => {
    if (!scheduledDate) return;
    onConfirm(scheduledDate);
    setScheduledDate('');
    onClose();
  };

  const toDatetimeLocal = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const setQuickDate = (hoursFromNow: number) => {
    const date = new Date();
    date.setHours(date.getHours() + hoursFromNow);
    setScheduledDate(toDatetimeLocal(date));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Planifier la publication">
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Planification groupée</p>
            <p>
              Tous les {selectedCount} articles sélectionnés seront planifiés pour la même date et heure.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date et heure de publication
            </label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={toDatetimeLocal(new Date())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raccourcis
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuickDate(1)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-sm"
              >
                <Clock className="w-4 h-4" />
                Dans 1h
              </button>
              <button
                onClick={() => setQuickDate(3)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-sm"
              >
                <Clock className="w-4 h-4" />
                Dans 3h
              </button>
              <button
                onClick={() => setQuickDate(24)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-sm"
              >
                <Clock className="w-4 h-4" />
                Demain
              </button>
              <button
                onClick={() => setQuickDate(168)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-sm"
              >
                <Clock className="w-4 h-4" />
                Dans 7 jours
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!scheduledDate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Planifier {selectedCount} article{selectedCount > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
