import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, AlertCircle, Info, Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { analyzeDefects, DefectAnalysis } from '../lib/geminiService';

interface DefectDetectorProps {
  imageBase64: string;
  mimeType: string;
  onAnalysisComplete?: (analysis: DefectAnalysis) => void;
  onConditionDetected?: (condition: string) => void;
}

const SEVERITY_CONFIG = {
  minor: {
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Mineur',
    icon: Info,
  },
  moderate: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    label: 'Modere',
    icon: AlertCircle,
  },
  severe: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Important',
    icon: AlertTriangle,
  },
};

export function DefectDetector({ imageBase64, mimeType, onAnalysisComplete, onConditionDetected }: DefectDetectorProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DefectAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [copiedDisclosure, setCopiedDisclosure] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await analyzeDefects(imageBase64, mimeType);
      setAnalysis(result);
      onAnalysisComplete?.(result);
      onConditionDetected?.(result.estimatedCondition);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDisclosure = () => {
    if (analysis?.suggestedDisclosure) {
      navigator.clipboard.writeText(analysis.suggestedDisclosure);
      setCopiedDisclosure(true);
      setTimeout(() => setCopiedDisclosure(false), 2000);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-600';
    if (score >= 6) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 8) return 'from-emerald-500 to-emerald-600';
    if (score >= 6) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  };

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      new_with_tags: 'Neuf avec etiquette',
      new_without_tags: 'Neuf sans etiquette',
      very_good: 'Tres bon etat',
      good: 'Bon etat',
      satisfactory: 'Etat satisfaisant',
    };
    return labels[condition] || condition;
  };

  if (!analysis && !loading) {
    return (
      <button
        onClick={handleAnalyze}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group"
      >
        <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span>Detecteur de defauts IA</span>
        <Sparkles className="w-4 h-4 opacity-70" />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
        <div className="flex items-center justify-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            <Search className="w-5 h-5 text-amber-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <p className="font-semibold text-amber-800">Analyse en cours...</p>
            <p className="text-sm text-amber-600">Detection des defauts et imperfections</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={handleAnalyze}
          className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Reessayer
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  const totalImpact = analysis.defects.reduce((sum, d) => sum + d.impactOnPrice, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Analyse des defauts</h3>
              <p className="text-sm text-white/80">
                {analysis.defects.length === 0
                  ? 'Aucun defaut detecte'
                  : `${analysis.defects.length} defaut${analysis.defects.length > 1 ? 's' : ''} detecte${analysis.defects.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${analysis.overallConditionScore >= 8 ? 'text-white' : 'text-white/90'}`}>
              {analysis.overallConditionScore}/10
            </div>
            <div className="text-xs text-white/70">Score etat</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getScoreGradient(analysis.overallConditionScore)}`} />
          <span className="font-medium text-gray-800">
            Etat estime : {getConditionLabel(analysis.estimatedCondition)}
          </span>
          {analysis.defects.length === 0 && (
            <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />
          )}
        </div>

        {analysis.defects.length > 0 && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <span className="font-medium text-gray-700">Details des defauts</span>
              {showDetails ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {showDetails && (
              <div className="space-y-3">
                {analysis.defects.map((defect, idx) => {
                  const config = SEVERITY_CONFIG[defect.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.minor;
                  const Icon = config.icon;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${config.border} ${config.bg}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white/50 ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold ${config.color}`}>
                              {defect.type}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {defect.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-gray-500">
                              Localisation : <span className="font-medium text-gray-700">{defect.location}</span>
                            </span>
                            <span className="text-red-600 font-medium">
                              Impact prix : {defect.impactOnPrice}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {totalImpact < 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700">
                      <strong>Impact total sur le prix :</strong> {totalImpact}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {analysis.recommendations.length > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Conseils pour la vente
            </h4>
            <ul className="space-y-1.5">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">-</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.suggestedDisclosure && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Texte suggere pour l'annonce
              </h4>
              <button
                onClick={handleCopyDisclosure}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
              >
                {copiedDisclosure ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copie
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-emerald-700 italic">
              "{analysis.suggestedDisclosure}"
            </p>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
        >
          Relancer l'analyse
        </button>
      </div>
    </div>
  );
}
