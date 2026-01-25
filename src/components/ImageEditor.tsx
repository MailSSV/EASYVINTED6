import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Wand2,
  X,
  Palette,
  Store,
  User,
  Shirt,
  Undo2,
  Redo2,
  RotateCcw,
  Check,
  Move,
  Info,
  Plus,
  Replace,
  SplitSquareHorizontal
} from 'lucide-react';
import { editProductImage } from '../lib/geminiService';
import { compressImage, formatFileSize } from '../lib/imageCompression';

interface ImageEditorProps {
  imageUrl: string;
  allPhotos: string[];
  currentPhotoIndex: number;
  onImageEdited: (newImageDataUrl: string) => void;
  onAddAsNewPhoto?: (newImageDataUrl: string) => void;
  onClose: () => void;
  onPhotoSelect?: (index: number) => void;
}

/**
 * ✅ Global prompt add-on to ensure “vrai iPhone / pas pro” everywhere,
 * including the ImageEditor quick actions AND custom instructions.
 * Note: geminiService.editProductImage already enforces similar constraints,
 * but we also reinforce them here to fight model “studio drift”.
 */
const UGC_IPHONE_STYLE = `
STYLE GLOBAL (STRICT - VINTED FRIENDLY):
- Must look like a casual iPhone photo taken by a real person (UGC), NOT a professional studio/catalog photo.
- Natural ambient light (window light or indoor warm light). No softbox, no glossy studio lighting.
- Slight imperfections REQUIRED: not perfectly centered, not perfectly straight, slightly imperfect framing.
- Slight softness or mild motion blur acceptable; subtle sensor grain/noise; avoid over-sharpening and HDR/glow.
- Background must be everyday and non-idealized (room, wall, door, hallway, bathroom, wardrobe), not “seamless”.
- Never make it look like a brand campaign: avoid perfect symmetry, perfect gradients, perfect props.

CRITICAL:
- Preserve product details perfectly (logos, labels, text, textures, patterns, colors). No distortions.
- Avoid any “AI look”: no plastic skin, no over-smoothing, no weird artifacts.
`.trim();

/**
 * ✅ Background prompt rewritten to avoid “studio white seamless” defaults.
 * Still aims for readability but in a realistic everyday context.
 */
const SMART_BACKGROUND_PROMPT = `
Analyze the garment (color, material, style) and how it is presented (on hanger, flatlay, etc.) in the image, then change the background strictly following these rules.

GOAL:
- Make the item readable and attractive for Vinted, BUT keep it looking like a real casual iPhone photo (NOT pro).

BACKGROUND RULES (REAL-LIFE, NOT STUDIO):
1. **Light / white clothing**: Use a light neutral REAL surface (off-white wall, light beige wall, pale concrete, light wood table) with subtle imperfections/texture so it doesn’t disappear.
2. **Dark clothing (black, navy, charcoal)**: Use a brighter everyday background (off-white wall, light door, light sheet/bedspread). Keep it believable, not seamless.
3. **Natural textiles (linen, wool, organic)**: Use light wood table, beige wall, linen fabric, kraft paper — but keep it casual (slight wrinkles/imperfections ok).
4. **Streetwear / Sport**: Use a neutral everyday background (simple wall, door, hallway) with subtle texture. NOT an editorial set.
5. **Elegant pieces (dresses, suits)**: Use a simple neutral interior context (plain wall, door, wardrobe) with natural light, not staged props.
6. **Photos on hanger/rack**: Keep a normal wall/door/wardrobe background. Preserve the vertical silhouette clearly.
7. **Flatlay photos**: Use realistic supports like a bedspread, duvet, wooden table, matte board — but avoid “perfect studio flatlay”.

CONFLICT RESOLUTION (priority):
1) Presentation type (hanger vs flatlay)
2) Style (streetwear/elegant)
3) Color (light vs dark)
4) Material

DEFAULT IF UNSURE:
- A plain off-white wall or door with soft natural shadows (NOT a white studio seamless).

ABSOLUTE:
- Preserve the garment perfectly. Labels/logos/text must remain readable and unchanged.
- Keep realism: consistent shadows, no fake glow, no “perfect product shot” vibe.

${UGC_IPHONE_STYLE}
`.trim();

/**
 * ✅ Action prompts rewritten to be UGC iPhone / “pas pro” by default.
 */
const ACTION_PROMPTS = {
  PLACE: `
Action: Place (Real-life).
Place the product in a believable everyday setting to showcase it for Vinted (not a catalog).
Examples: near a plain door, on a bedspread, on a simple wooden table, in front of a wardrobe, on a hanger against a wall.

Rules:
- Keep it realistic and casual (UGC iPhone look). Slight imperfections in framing and angle are OK.
- Natural ambient lighting only. No studio feel.
- Preserve product details perfectly (logos, text, shapes, textures). No distortions.
- Keep the background simple but real (not seamless, not a perfect gradient).

${UGC_IPHONE_STYLE}
`.trim(),

  FOLD: `
Action: Fold (Real-life).
Fold the garment naturally like a real person would for a Vinted photo and place it on a realistic support:
wooden table, bedspread, duvet, simple fabric, matte board, shelf.

Rules:
- Fold should look natural, not “retail perfect”.
- Keep it UGC iPhone-like (not too sharp, not perfectly centered).
- Natural ambient light, soft shadows, no studio glow.
- Preserve product details perfectly (logos/text/labels). No distortions.

${UGC_IPHONE_STYLE}
`.trim(),

  TRY_ON: `
Action: Real-Life Try-On (UGC).
Show the garment worn or held by a REAL person (adult / teen / child depending on garment size/style),
in an everyday place (bathroom mirror, hallway, bedroom, near a door/wardrobe).

STRICT PRIVACY / VINTED RULE:
- NEVER show the full face.
  - Preferred: mirror selfie with the phone covering the face OR crop from neck down OR face outside frame.
  - If any face appears, it must be obscured and not identifiable.

Rules:
- No “fashion model” vibe. Normal body proportions. Natural posture.
- Must look like a quick iPhone photo: slight tilt, imperfect framing, mild softness/grain allowed.
- Natural ambient light only. No studio lighting.
- Garment fit/drape must be realistic and physically accurate.
- Preserve garment details perfectly (logos, patterns, textures, colors). No distortions.

${UGC_IPHONE_STYLE}
`.trim()
};

export function ImageEditor({
  imageUrl,
  allPhotos,
  currentPhotoIndex,
  onImageEdited,
  onAddAsNewPhoto,
  onClose,
  onPhotoSelect
}: ImageEditorProps) {
  const [instruction, setInstruction] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditHistory([imageUrl]);
    setHistoryIndex(0);
  }, [imageUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    };

    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInfo]);

  const currentImage = editHistory[historyIndex] || imageUrl;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < editHistory.length - 1;
  const hasEdited = historyIndex > 0;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentImage]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const handleWheelEvent = (e: WheelEvent) => {
      if (zoom === 1 && e.deltaY > 0) return;

      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.25;

      setZoom(prev => {
        const newZoom = Math.min(Math.max(prev + delta, 1), 5);
        if (newZoom === 1) setPan({ x: 0, y: 0 });
        return newZoom;
      });
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, [zoom]);

  /**
   * ✅ Ensure EVERY edit gets “UGC iPhone / pas pro”
   * including custom user prompts (we append constraints).
   */
  const buildFinalPrompt = (rawPrompt: string) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed) return trimmed;

    // If user asks explicitly for something that sounds like studio,
    // the appended constraints will steer it back to believable UGC.
    return `${trimmed}\n\n${UGC_IPHONE_STYLE}`;
  };

  const handleEdit = async (customPrompt?: string) => {
    const rawPrompt = typeof customPrompt === 'string' ? customPrompt : instruction;

    if (!rawPrompt.trim()) {
      setError('Veuillez entrer une instruction');
      return;
    }

    const promptToUse = buildFinalPrompt(rawPrompt);

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(currentImage);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type;

      const editedImageBase64 = await editProductImage(base64, mimeType, promptToUse);

      const editedImageDataUrl = `data:${mimeType};base64,${editedImageBase64}`;

      const responseEdited = await fetch(editedImageDataUrl);
      const editedBlob = await responseEdited.blob();
      const tempFile = new File([editedBlob], 'edited-image.jpg', { type: 'image/jpeg' });

      const compressionResult = await compressImage(tempFile);
      console.log(
        `Compressed edited image: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(
          compressionResult.compressedSize
        )} (${compressionResult.compressionRatio.toFixed(1)}% reduction)`
      );

      const compressedBlob = compressionResult.file;
      const compressedDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressedBlob);
      });

      setEditHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(compressedDataUrl);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);

      if (typeof customPrompt !== 'string') {
        setInstruction('');
      }
    } catch (err) {
      console.error('Error editing image:', err);

      let errorMessage = "Erreur lors de l'édition de l'image";

      if (err instanceof Error) {
        if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
          errorMessage =
            "Quota Gemini dépassé. Le modèle de génération d'images Gemini nécessite un compte avec facturation activée. Veuillez activer la facturation sur console.cloud.google.com ou utiliser une clé API avec crédit disponible.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleUndo = () => {
    if (canUndo) setHistoryIndex(prev => prev - 1);
  };

  const handleRedo = () => {
    if (canRedo) setHistoryIndex(prev => prev + 1);
  };

  const handleReset = () => {
    setEditHistory([imageUrl]);
    setHistoryIndex(0);
    setError(null);
    setShowComparison(false);
  };

  const handleAddAsNew = () => {
    if (onAddAsNewPhoto && hasEdited) {
      onAddAsNewPhoto(currentImage);
      onClose();
    }
  };

  const handleReplace = () => {
    onImageEdited(currentImage);
    onClose();
  };

  const handleComparisonDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!comparisonRef.current) return;
    const rect = comparisonRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setComparisonPosition(x);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[80] overflow-y-auto">
      <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl sm:rounded-t-2xl z-[100]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate"> Studio Magik-AI</h2>
              <p className="text-xs sm:text-sm text-slate-500 truncate">By AXS Design</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div ref={infoRef} className="relative hidden lg:block">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 text-sm font-medium shadow-sm hover:shadow-md"
              >
                <Info size={18} />
                <span>{showInfo ? 'Masquer' : 'Infos'}</span>
              </button>

              {showInfo && (
                <div className="absolute top-full right-0 mt-2 w-96 bg-white border-2 border-blue-300 rounded-xl p-5 shadow-2xl z-[200] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 bg-blue-100 rounded-lg p-2">
                      <Sparkles className="text-blue-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-slate-900 font-bold text-base mb-2">
                        Studio Magik-AI - By AXS Design
                      </h3>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        Décrivez les modifications que vous souhaitez apporter pour mettre en valeur votre article et laissez Studio Magik-AI les réaliser.
                        <br />
                        <br />
                        ⚠️ Tous les rendus sont volontairement “vrai iPhone / pas pro” (UGC), car Vinted n’aime pas les photos trop parfaites.
                        <br />
                        <br />
                        Tips : pour “Porté”, le visage est toujours masqué/coupé (selfie miroir téléphone devant).
                      </p>
                    </div>
                    <button
                      onClick={() => setShowInfo(false)}
                      className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-lg p-1"
                      title="Fermer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 relative">
          {/* Colonne gauche */}
          <div className="flex flex-col space-y-4 relative z-0 h-full">
            <div
              ref={imageContainerRef}
              className="flex-1 min-h-[400px] bg-slate-100 rounded-xl overflow-hidden relative select-none z-0"
            >
              {showComparison && hasEdited ? (
                <div
                  ref={comparisonRef}
                  className="absolute inset-0 cursor-ew-resize"
                  onMouseMove={handleComparisonDrag}
                  onClick={handleComparisonDrag}
                >
                  <div className="absolute inset-0">
                    <img src={currentImage} alt="Image editee" className="w-full h-full object-contain" />
                  </div>
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - comparisonPosition}% 0 0)` }}
                  >
                    <img src={imageUrl} alt="Image originale" className="w-full h-full object-contain" />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                    style={{ left: `${comparisonPosition}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <SplitSquareHorizontal size={18} className="text-slate-600" />
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 bg-slate-900/80 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                    Avant
                  </div>
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                    Apres
                  </div>
                </div>
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center overflow-hidden"
                  style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                >
                  <img
                    src={currentImage}
                    alt="Image a editer"
                    draggable={false}
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transition: isDragging
                        ? 'none'
                        : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    }}
                    className={`w-full h-full object-contain origin-center ${
                      processing ? 'opacity-50 blur-sm' : ''
                    }`}
                  />
                </div>
              )}

              {!showComparison && zoom > 1 && (
                <div
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-[5] px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-white/20 flex items-center gap-2 pointer-events-none transition-all duration-300 ${
                    isDragging
                      ? 'bg-blue-600/90 text-white shadow-blue-500/20 scale-105'
                      : 'bg-white/80 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Move size={14} className={isDragging ? 'animate-pulse' : ''} />
                  <span className="text-xs font-semibold tracking-wide">
                    {isDragging ? 'Deplacement' : 'Glisser pour deplacer'}
                  </span>
                </div>
              )}

              {!showComparison && hasEdited && !processing && (
                <div className="absolute top-3 left-3 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 z-[5]">
                  <Check className="w-3.5 h-3.5" />
                  <span>Editee ({historyIndex} modif.)</span>
                </div>
              )}

             

              {processing && (
                <div className="absolute inset-0 flex items-center justify-center z-[10]">
                  <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="font-semibold text-slate-900">Edition en cours...</span>
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 right-3 flex items-center gap-2 z-[5]">
                {hasEdited && (
                  <button
                    type="button"
                    onClick={() => setShowComparison(!showComparison)}
                    className={`p-2.5 rounded-lg transition-all shadow-lg ${
                      showComparison
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-white/95 backdrop-blur-sm text-slate-700 hover:bg-white border border-slate-200'
                    }`}
                    title="Comparer avant/apres"
                  >
                    <SplitSquareHorizontal className="w-5 h-5" />
                  </button>
                )}

                <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className={`p-2 rounded-md transition-all ${
                      canUndo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title="Annuler"
                  >
                    <Undo2 size={18} />
                  </button>
                  <div className="w-px h-5 bg-slate-300 mx-0.5"></div>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={`p-2 rounded-md transition-all ${
                      canRedo ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title="Refaire"
                  >
                    <Redo2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            {allPhotos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {allPhotos.map((photo, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onPhotoSelect && onPhotoSelect(index)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentPhotoIndex
                        ? 'border-blue-600 ring-2 ring-blue-200'
                        : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite */}
          <div className="space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                AI Magic Editor
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleEdit(SMART_BACKGROUND_PROMPT)}
                  disabled={processing}
                  className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md group"
                >
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform duration-200">
                    <Palette size={20} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 text-center">Fond optimisé</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEdit(ACTION_PROMPTS.PLACE)}
                  disabled={processing}
                  className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md group"
                >
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform duration-200">
                    <Store size={20} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Mis en Situation</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEdit(ACTION_PROMPTS.TRY_ON)}
                  disabled={processing}
                  className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md group"
                >
                  <div className="p-2 bg-pink-50 text-pink-600 rounded-lg group-hover:scale-110 transition-transform duration-200">
                    <User size={20} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Porté</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEdit(ACTION_PROMPTS.FOLD)}
                  disabled={processing}
                  className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md group"
                >
                  <div className="p-2 bg-violet-50 text-violet-600 rounded-lg group-hover:scale-110 transition-transform duration-200">
                    <Shirt size={20} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Plier</span>
                </button>
              </div>
            </div>

            <div className="relative flex items-center gap-2 mb-4">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ou personnalisé</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Instruction personnalisée
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={`Ex: Mets l'article porté en selfie miroir (téléphone devant le visage), dans un couloir ou salle de bain, lumière naturelle...`}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/60 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                disabled={processing}
              />
              <p className="mt-2 text-xs text-slate-500">
                Rendu “vrai iPhone / pas pro” appliqué automatiquement (anti studio, anti catalogue).
              </p>
            </div>

            <div className="flex gap-3">
              {hasEdited && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={processing}
                  className="px-4 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Reinitialiser a l'image originale"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleEdit()}
                disabled={processing || !instruction.trim()}
                className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Edition...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Editer</span>
                  </>
                )}
              </button>
            </div>

            {hasEdited && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm font-medium text-emerald-800 mb-3">
                  Image editee avec succes ! Que souhaitez-vous faire ?
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleAddAsNew}
                    disabled={processing || !onAddAsNewPhoto}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title={!onAddAsNewPhoto ? 'Non disponible' : "Ajouter l'image editee comme nouvelle photo"}
                  >
                    <Plus className="w-5 h-5" />
                    <span>Ajouter comme nouvelle photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReplace}
                    disabled={processing}
                    className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Replace className="w-5 h-5" />
                    <span>Remplacer l'originale</span>
                  </button>
                </div>
              </div>
            )}

            {!hasEdited && (
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="w-full mt-4 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                <span>Fermer</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
