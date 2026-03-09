import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { LogIn, UserPlus, Chrome, Languages } from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { translations, Language } from '../i18n';

interface AuthProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Auth: React.FC<AuthProps> = ({ language, onLanguageChange }) => {
  const t = translations[language];
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 bg-slate-50 ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="absolute top-6 right-6">
        <button 
          onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
        >
          <Languages size={16} />
          {language === 'en' ? 'العربية' : 'English'}
        </button>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-xl border border-slate-100 mb-6 overflow-hidden">
            <Logo size={80} />
          </div>
          <h1 className="font-display text-4xl font-black text-primary tracking-tight">{t.appName}</h1>
          <p className="text-slate-500 text-sm mt-3 font-medium">{t.tagline}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Email Address</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 rounded-xl text-rose-500 text-xs font-medium border border-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-sm hover:bg-primary-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? t.processing : isLogin ? <><LogIn size={18} /> {language === 'en' ? 'Sign In' : 'تسجيل الدخول'}</> : <><UserPlus size={18} /> {language === 'en' ? 'Create Account' : 'إنشاء حساب'}</>}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px bg-slate-100 flex-1" />
          <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">{language === 'en' ? 'or' : 'أو'}</span>
          <div className="h-px bg-slate-100 flex-1" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full mt-8 py-4 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Chrome size={18} />
          {language === 'en' ? 'Continue with Google' : 'المتابعة باستخدام جوجل'}
        </button>

        <p className="mt-10 text-center text-sm text-slate-500">
          {isLogin ? (language === 'en' ? "New here?" : "جديد هنا؟") : (language === 'en' ? "Already a member?" : "عضو بالفعل؟")}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-bold hover:underline ml-1"
          >
            {isLogin ? (language === 'en' ? 'Create Account' : 'إنشاء حساب') : (language === 'en' ? 'Sign In' : 'تسجيل الدخول')}
          </button>
        </p>
      </motion.div>
    </div>
  );
};
