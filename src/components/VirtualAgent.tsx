import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, X, Check, Volume2, VolumeX, GripVertical, Send } from 'lucide-react';
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
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('virtualAgentPosition');
    return saved ? JSON.parse(saved) : { bottom: 96, right: 16 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
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
  const panelRef = useRef<HTMLDivElement>(null);
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

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging || !panelRef.current) return;

      const deltaX = dragStart.x - e.clientX;
      const deltaY = dragStart.y - e.clientY;

      const panelWidth = panelRef.current.offsetWidth;
      const panelHeight = panelRef.current.offsetHeight;

      const maxRight = window.innerWidth - panelWidth - 16;
      const maxBottom = window.innerHeight - panelHeight - 16;

      let newRight = position.right + deltaX;
      let newBottom = position.bottom + deltaY;

      newRight = Math.max(16, Math.min(newRight, maxRight));
      newBottom = Math.max(16, Math.min(newBottom, maxBottom));

      setPosition({ right: newRight, bottom: newBottom });
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleDragEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem('virtualAgentPosition', JSON.stringify(position));
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, dragStart, position]);

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
    setIsMinimizing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsMinimizing(false);
    }, 400);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[70] bg-white/95 backdrop-blur-xl px-5 py-4 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] transition-all duration-500 flex items-center gap-3 group animate-in slide-in-from-bottom-4 hover:scale-105 active:scale-95 border border-emerald-100"
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
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-300 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-fuchsia-400"></span>
          </span>
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold text-sm text-emerald-600">Kelly Coach</span>
          <span className="text-[11px] text-gray-600">
            Prete a t'aider
          </span>
        </div>
      </button>
    );
  }

  return (
    <>
      <div
        ref={panelRef}
        className="fixed z-[60] w-[420px] max-w-[calc(100vw-2rem)] transition-none"
        style={{
          bottom: `${position.bottom}px`,
          right: `${position.right}px`,
          cursor: isDragging ? 'grabbing' : 'auto'
        }}
      >
      <div className={`bg-white/95 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-white/40 flex flex-col overflow-hidden h-[620px] max-h-[85vh] ${isMinimizing ? 'animate-kelly-minimize' : 'animate-kelly-expand'}`}>
      <div
        className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-5 text-white cursor-move select-none relative overflow-hidden"
        onMouseDown={handleDragStart}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
        <div className="flex items-center justify-between w-full relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/kelly-avatar.png"
                alt="Kelly"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-9 h-9 bg-white/20 rounded-full hidden items-center justify-center backdrop-blur-sm">
                <Bot size={22} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSpeaking ? 'bg-blue-300' : 'bg-fuchsia-300'} opacity-60`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isSpeaking ? 'bg-blue-400' : 'bg-fuchsia-400'}`}></span>
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Kelly Coach</h3>
              <p className="text-[10px] text-white/70">
                {isSpeaking ? 'Parle...' : 'Prete a t\'aider'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleVoice}
              className={`p-1.5 rounded-lg transition-colors ${
                voiceEnabled
                  ? 'bg-white/25 text-white hover:bg-white/35'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title={voiceEnabled ? 'Desactiver la voix' : 'Activer la voix'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onMouseDown={handleDragStart}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-grab active:cursor-grabbing"
              title="Deplacer"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
      </div>
    </>
  );
};

export default VirtualAgent;
