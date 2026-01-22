import { useState } from 'react';
import { Mail, X, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function EmailVerificationBanner() {
  const { user, resendVerificationEmail } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.email_confirmed_at || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail();
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      console.error('Error resending verification email:', error);
    } finally {
      setSending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('emailVerificationBannerDismissed', 'true');
  };

  if (sessionStorage.getItem('emailVerificationBannerDismissed') === 'true') {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Vérifiez votre adresse email
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Un email de vérification vous a été envoyé. Consultez votre boîte de réception.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {sent ? (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                Email envoyé !
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={sending}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3 h-3" />
                {sending ? 'Envoi...' : 'Renvoyer'}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Masquer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
