import React, { useState } from 'react';
import { User, Sparkles, Download, RefreshCw, AlertCircle, X, Maximize2 } from 'lucide-react';
import { generateVirtualTryOn } from '../lib/geminiService';

interface VirtualTryOnProps {
  imageBase64: string;
  mimeType: string;
  onImageGenerated?: (base64: string) => void;
}

type Gender = 'female' | 'male' | 'neutral';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'female', label: 'Femme', icon: '♀' },
  { value: 'male', label: 'Homme', icon: '♂' },
  { value: 'neutral', label: 'Neutre', icon: '⚧' },
];

export function VirtualTryOn({ imageBase64, mimeType, onImageGenerated }: VirtualTryOnProps) {
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender>('female');
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generateVirtualTryOn(imageBase64, mimeType, selectedGender);
      setGeneratedImage(result);
      onImageGenerated?.(result);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la generation');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = `essayage-virtuel-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerate = () => {
    setGeneratedImage(null);
    handleGenerate();
  };

  if (!generatedImage && !loading) {
    return (
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-200 p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <User className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Essayage Virtuel IA</h3>
          <p className="text-sm text-gray-600 mt-1">
            Visualisez ce vetement porte par un mannequin
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choisir le type de mannequin
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedGender(option.value)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selectedGender === option.value
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-rose-300'
                }`}
              >
                <div className="text-2xl mb-1">{option.icon}</div>
                <div className="text-xs font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span>Generer l'essayage virtuel</span>
        </button>

        <p className="text-xs text-center text-gray-500 mt-3">
          La generation peut prendre 10-20 secondes
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-200 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative mb-4">
            <div className="w-20 h-20 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <User className="w-8 h-8 text-rose-500" />
            </div>
          </div>
          <p className="font-semibold text-rose-800 mb-1">Generation en cours...</p>
          <p className="text-sm text-rose-600">L'IA cree votre mannequin virtuel</p>
          <div className="mt-4 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Essayage Virtuel</h3>
                <p className="text-sm text-white/80">
                  Mannequin {GENDER_OPTIONS.find(o => o.value === selectedGender)?.label.toLowerCase()}
                </p>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-white/60" />
          </div>
        </div>

        <div className="p-4">
          <div className="relative group rounded-xl overflow-hidden bg-gray-100">
            <img
              src={`data:image/png;base64,${generatedImage}`}
              alt="Essayage virtuel"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button
                onClick={() => setShowFullscreen(true)}
                className="p-3 bg-white/90 backdrop-blur rounded-xl shadow-lg hover:bg-white transition-colors"
              >
                <Maximize2 className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              Telecharger
            </button>
            <button
              onClick={handleRegenerate}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerer
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Changer de mannequin
            </label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedGender(option.value);
                    handleRegenerate();
                  }}
                  className={`flex-1 p-2 rounded-lg text-sm font-medium transition-all ${
                    selectedGender === option.value
                      ? 'bg-rose-100 text-rose-700 border-2 border-rose-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showFullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            onClick={() => setShowFullscreen(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={`data:image/png;base64,${generatedImage}`}
            alt="Essayage virtuel plein ecran"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
          >
            <Download className="w-5 h-5" />
            Telecharger l'image
          </button>
        </div>
      )}
    </>
  );
}
