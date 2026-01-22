import { AlertCircle, CheckCircle, Image, FileText, Package } from 'lucide-react';

interface ArticleIndicatorsProps {
  title?: string;
  photos: string[] | null;
  brand?: string;
  size?: string;
  price?: number | null;
  status: string;
  compact?: boolean;
  condition?: string;
  color?: string;
}

export function ArticleIndicators({
  title,
  photos,
  brand,
  size,
  price,
  status,
  compact = false,
}: ArticleIndicatorsProps) {
  const photoCount = photos?.length || 0;
  const hasTitle = !!title && title.trim().length > 0;
  const hasPhotos = photoCount > 0;
  const hasPrice = price !== null && price !== undefined && price > 0;
  const hasBrand = !!brand && brand.trim().length > 0;
  const hasSize = !!size && size.trim().length > 0;

  const missingFields: string[] = [];
  if (!hasTitle) missingFields.push('titre');
  if (!hasPhotos) missingFields.push('photos');
  if (!hasPrice) missingFields.push('prix');
  if (!hasBrand) missingFields.push('marque');
  if (!hasSize) missingFields.push('taille');

  const isComplete = missingFields.length === 0;
  const isReadyToPublish = isComplete && (status === 'ready' || status === 'scheduled');

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {photoCount > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
            <Image className="w-3 h-3" />
            {photoCount}
          </span>
        )}

        {isReadyToPublish && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">
            <CheckCircle className="w-3 h-3" />
            Complet
          </span>
        )}

        {!isComplete && status !== 'sold' && status !== 'vendu_en_lot' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium">
            <AlertCircle className="w-3 h-3" />
            Incomplet
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {photoCount > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
            <Image className="w-3.5 h-3.5" />
            <span>{photoCount} photo{photoCount > 1 ? 's' : ''}</span>
          </div>
        )}

        {hasTitle && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium">
            <FileText className="w-3.5 h-3.5" />
            <span>Titre</span>
          </div>
        )}

        {hasBrand && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium">
            <Package className="w-3.5 h-3.5" />
            <span>Marque</span>
          </div>
        )}
      </div>

      {isReadyToPublish && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
          <CheckCircle className="w-4 h-4" />
          <span>Complet</span>
        </div>
      )}

      {!isComplete && status !== 'sold' && status !== 'vendu_en_lot' && (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Article incomplet</span>
          </div>
          <div className="text-xs text-gray-600">
            Manquant: {missingFields.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
