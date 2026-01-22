import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, X, Check, Volume2, VolumeX, Minimize2, Maximize2, GripVertical, Send } from 'lucide-react';
import { Article } from '../types/article';
import { getStructuredCoachAdvice, Suggestion, generateSpeech } from '../lib/geminiService';
import { supabase } from '../lib/supabase';

interface VirtualAgentProps {
  article: Partial<Article>;
  activePhoto?: string;
  onApplySuggestion?: (field: string, value: string | number) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: Suggestion[];
}

interface Position {
  x: number;
  y: number;
}

const decode = (pcm: ArrayBuffer): Float32Array => {
  const view = new DataView(pcm);
  const samples = new Float32Array(pcm.byteLength / 2);

  for (let i = 0; i < samples.length; i++) {
    const int16 = view.getInt16(i * 2, true);
    samples[i] = int16 / 32768.0;
  }

  return samples;
};

const decodeAudioData = async (pcm: ArrayBuffer): Promise<AudioBuffer> => {
  const audioContext = new AudioContext({ sampleRate: 24000 });
  const samples = decode(pcm);
  const audioBuffer = audioContext.createBuffer(1, samples.length, 24000);

  audioBuffer.getChannelData(0).set(samples);

  return audioBuffer;
};

const VirtualAgent: React.FC<VirtualAgentProps> = ({ article, activePhoto, onApplySuggestion }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [userQuestion, setUserQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis Kelly ta coach de vente IA. Je peux analyser ton annonce et te donner des conseils pour vendre plus rapidement. Tu peux aussi me poser des questions sur ton article ! 💬\n\nClique sur 'Analyser l'annonce' pour une analyse complete, ou pose-moi directement une question ci-dessous.",
      timestamp: Date.now()
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !position) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      setPosition({
        x: position.x + deltaX,
        y: position.y + deltaY
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, dragStart]);

  const speak = async (text: string) => {
    if (!voiceEnabled) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }

    try {
      setIsSpeaking(true);

      const cleanText = text.replace(/\*\*/g, '').replace(/\n/g, ' ');

      const pcmData = await generateSpeech(cleanText);
      const audioBuffer = await decodeAudioData(pcmData);

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setIsSpeaking(false);
        audioSourceRef.current = null;
      };

      audioSourceRef.current = source;
      source.start(0);
    } catch (error) {
      console.error('Error playing speech:', error);
      setIsSpeaking(false);
    }
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);

    if (!newState) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      setIsSpeaking(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: "Analyse mon annonce, Baby !", timestamp: Date.now() }]);

    try {
      const advice = await getStructuredCoachAdvice(article, activePhoto);
      const message = {
        role: 'assistant' as const,
        content: advice.generalAdvice,
        timestamp: Date.now(),
        suggestions: advice.suggestions
      };
      setMessages(prev => [...prev, message]);
      setHasAnalysis(true);

      speak(advice.generalAdvice);
    } catch (e) {
      const errorMessage = "Désolé, j'ai eu un souci technique. Réessayez ?";
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage, timestamp: Date.now() }]);
      speak(errorMessage);
    }
    setLoading(false);
  };

  const handleAskQuestion = async () => {
    const question = userQuestion.trim();
    if (!question) return;

    setUserQuestion('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: Date.now() }]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kelly-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            question,
            articleContext: {
              title: article.title,
              description: article.description,
              brand: article.brand,
              size: article.size,
              price: article.price,
              condition: article.condition,
              color: article.color,
              material: article.material,
              season: article.season,
              photos: article.photos || [],
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      }

      const result = await response.json();
      const answerMessage = {
        role: 'assistant' as const,
        content: result.answer,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, answerMessage]);
      speak(result.answer);
    } catch (error) {
      console.error('Error asking question:', error);
      const errorMessage = "Désolée, je n'ai pas pu répondre. Peux-tu reformuler ta question ?";
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage, timestamp: Date.now() }]);
      speak(errorMessage);
    }
    setLoading(false);
  };

  const handleApply = () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.suggestions && onApplySuggestion) {
      lastMessage.suggestions.forEach(suggestion => {
        if (isSuggestionApplied(suggestion)) {
          onApplySuggestion(suggestion.field, suggestion.suggestedValue);
        }
      });
    }
    handleClose();
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    const suggestionKey = `${suggestion.field}-${suggestion.suggestedValue}`;
    setAppliedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionKey)) {
        newSet.delete(suggestionKey);
      } else {
        newSet.add(suggestionKey);
      }
      return newSet;
    });
  };

  const isSuggestionApplied = (suggestion: Suggestion) => {
    return appliedSuggestions.has(`${suggestion.field}-${suggestion.suggestedValue}`);
  };

  const handleClose = () => {
    setIsOpen(false);
    setHasAnalysis(false);
    setIsMinimized(false);
    setPosition(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth < 640) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });

    if (!position && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: rect.top });
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      {/* Bouton déclencheur avec transition d'opacité inverse */}
      {!isMinimized && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[70] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 rounded-[24px] shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.4)] backdrop-blur-lg hover:scale-105 active:scale-95 flex items-center gap-2 group border border-white/20 transition-all duration-500 ${
            isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'
          }`}
        >
          <div className="relative">
            <Bot size={24} className="drop-shadow-sm" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white shadow-sm"></span>
            </span>
          </div>
          <span className="font-semibold pr-1 group-hover:block hidden animate-in slide-in-from-right-2 duration-300 text-shadow">Ma Coach IA</span>
        </button>
      )}

      {/* Version minimisée */}
      {isMinimized && (
        <button
          onClick={toggleMinimize}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[70] bg-white/90 backdrop-blur-xl px-5 py-4 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] transition-all duration-500 flex items-center gap-3 group animate-in slide-in-from-bottom-4 hover:scale-105 active:scale-95 border border-emerald-100"
        >
          <div className="relative">
            <img
              src="/kelly-avatar.png"
              alt="Kelly"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-400/40 shadow-sm"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full hidden items-center justify-center shadow-sm">
              <Bot size={22} className="text-white" />
            </div>
            {hasAnalysis && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-sm"></span>
              </span>
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="font-bold text-sm text-emerald-600">Kelly</span>
            <span className="text-[11px] text-gray-600">
              {hasAnalysis ? 'Analyse disponible' : 'Prête à analyser'}
            </span>
          </div>
          <Maximize2 size={16} className="text-emerald-500 group-hover:scale-110 transition-transform duration-300" />
        </button>
      )}

      {/* Fenêtre de chat avec transitions fluides */}
      {isOpen && (
        <>
          <div
            className={`fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm transition-all duration-500 ${
              isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={handleClose}
          />
          <div
            ref={containerRef}
            className={`z-[71] max-w-[calc(100vw-2rem)] sm:w-[420px] h-[620px] max-h-[85vh] bg-white/95 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-white/40 flex flex-col overflow-hidden transition-all duration-500 ${
              position
                ? 'fixed'
                : 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
            } ${
              isOpen
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-20 scale-90 opacity-0 pointer-events-none'
            }`}
            style={position ? { left: `${position.x}px`, top: `${position.y}px` } : {}}
            onClick={(e) => e.stopPropagation()}
          >
      <div
        className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-5 flex justify-between items-center text-white sm:cursor-move select-none relative overflow-hidden"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
        <div className="flex items-center gap-3 pointer-events-none relative z-10">
          <div className="relative">
            <img
              src="/kelly-avatar.png"
              alt="Kelly"
              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/40 shadow-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-11 h-11 bg-white/20 rounded-full hidden items-center justify-center backdrop-blur-sm">
              <Bot size={22} className="text-white" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-1.5 drop-shadow-sm">
              Kelly
              <GripVertical size={14} className="text-white/60 hidden sm:block" />
            </h3>
            <p className="text-[11px] text-white/90 flex items-center gap-1.5 drop-shadow-sm">
              <span className={`w-2 h-2 rounded-full shadow-sm ${isSpeaking ? 'bg-yellow-300 animate-pulse' : 'bg-white'}`}></span>
              {isSpeaking ? 'Parle...' : 'En ligne'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto relative z-10">
          <button
            onClick={toggleVoice}
            className={`p-2.5 rounded-2xl transition-all duration-300 active:scale-90 ${
              voiceEnabled
                ? 'bg-white/25 text-white hover:bg-white/35 shadow-lg'
                : 'text-white/70 hover:text-white hover:bg-white/15'
            }`}
            title={voiceEnabled ? 'Désactiver la voix' : 'Activer la voix'}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={toggleMinimize}
            className="sm:hidden p-2.5 rounded-2xl text-white/70 hover:text-white hover:bg-white/15 transition-all duration-300 active:scale-90"
            title="Réduire"
          >
            <Minimize2 size={18} />
          </button>
          <button
            onClick={handleClose}
            className="p-2.5 rounded-2xl text-white/70 hover:text-white hover:bg-white/15 transition-all duration-300 active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-emerald-50/50 to-white/80 backdrop-blur-sm" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-500`}>
            <div
              className={`max-w-[85%] rounded-[20px] p-4 text-sm leading-relaxed transition-all duration-300 hover:scale-[1.02] ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)] rounded-br-md'
                  : 'bg-white/80 backdrop-blur-xl text-gray-800 border border-emerald-100/50 shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-bl-md'
              }`}
            >
              <div className="flex items-start gap-2">
                {msg.role === 'assistant' && voiceEnabled && (
                  <button
                    onClick={() => speak(msg.content)}
                    className="flex-shrink-0 mt-0.5 p-1.5 hover:bg-emerald-50 rounded-xl transition-all duration-300 active:scale-90"
                    title="Écouter ce message"
                  >
                    <Volume2 size={15} className="text-emerald-600" />
                  </button>
                )}
                <div className="flex-1 whitespace-pre-wrap font-sans">
                  {msg.content.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
                  )}
                </div>
              </div>

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-emerald-100/50 pt-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Cochez les suggestions à appliquer :</p>
                  {msg.suggestions.map((suggestion, sidx) => {
                    const isApplied = isSuggestionApplied(suggestion);
                    const fieldLabels: Record<string, string> = {
                      title: 'Titre',
                      description: 'Description',
                      price: 'Prix',
                      brand: 'Marque',
                      size: 'Taille',
                      color: 'Couleur',
                      material: 'Matière',
                      condition: 'État'
                    };

                    return (
                      <div key={sidx} className="bg-gradient-to-br from-white to-emerald-50/30 border border-emerald-100/60 rounded-[16px] p-3.5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => handleApplySuggestion(suggestion)}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300 active:scale-90 ${
                              isApplied
                                ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                : 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
                            }`}
                          >
                            {isApplied && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-emerald-700 mb-1">
                              {fieldLabels[suggestion.field as keyof typeof fieldLabels] || suggestion.field}
                            </p>
                            <p className="text-xs text-gray-600 mb-2.5 line-clamp-2">
                              {suggestion.reason}
                            </p>
                            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-2.5 border border-emerald-100/50 shadow-sm">
                              <p className="text-xs text-emerald-700 font-semibold break-words">
                                {suggestion.suggestedValue}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white/80 backdrop-blur-xl border border-emerald-100/50 rounded-[20px] rounded-bl-md p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce shadow-sm"></div>
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s] shadow-sm"></div>
              <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s] shadow-sm"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 bg-gradient-to-t from-white via-white to-white/80 backdrop-blur-xl border-t border-emerald-100/50 space-y-3">
        {hasAnalysis && appliedSuggestions.size > 0 && (
          <button
            onClick={handleApply}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-[18px] shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_30px_rgba(16,185,129,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group active:scale-95"
          >
            <Check size={19} className="group-hover:scale-110 transition-transform duration-300" />
            Appliquer ({appliedSuggestions.size} sélectionnée{appliedSuggestions.size > 1 ? 's' : ''})
          </button>
        )}

        {!hasAnalysis && (
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-[18px] shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_30px_rgba(16,185,129,0.4)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group active:scale-95"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Réflexion en cours...
              </span>
            ) : (
              <>
                <Sparkles size={19} className="group-hover:rotate-12 group-hover:text-yellow-200 transition-all duration-300" />
                Analyser l'annonce
              </>
            )}
          </button>
        )}

        <div className="flex gap-2.5">
          <input
            ref={inputRef}
            type="text"
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleAskQuestion();
              }
            }}
            placeholder="Pose ta question à Kelly..."
            disabled={loading}
            className="flex-1 px-4 py-3.5 bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-[18px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm transition-all duration-300 placeholder:text-gray-400"
          />
          <button
            onClick={handleAskQuestion}
            disabled={loading || !userQuestion.trim()}
            className="px-5 py-3.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-[18px] shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_30px_rgba(16,185,129,0.4)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-90"
          >
            <Send size={18} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-500 font-medium">
          Kelly peut dire des trucs chelous. Vérifiez toujours ses conseils.
        </p>
      </div>
          </div>
        </>
      )}
    </>
  );
};

export default VirtualAgent;
