import React, { useState } from 'react';
import { Share2, UserCheck, LogOut, Copy, Check, User, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { translations, Language } from '../i18n';

interface SettingsProps {
  treeId: string;
  onJoinTree: (newTreeId: string) => void;
  onClose: () => void;
  language: Language;
}

export const Settings: React.FC<SettingsProps> = ({ treeId, onJoinTree, onClose, language }) => {
  const t = translations[language];
  const [newTreeId, setNewTreeId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(treeId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="font-bold text-slate-900">{t.settings}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
          {/* Profile Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <User size={18} />
              <h3 className="text-[10px] uppercase tracking-widest font-bold">{t.yourAccount}</h3>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">
                {auth.currentUser?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{auth.currentUser?.email}</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">{language === 'en' ? 'Family Member' : 'فرد من العائلة'}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Share Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Share2 size={18} />
              <h3 className="text-[10px] uppercase tracking-widest font-bold">{t.shareTree}</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{t.shareDescription}</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-600 truncate flex items-center">
                {treeId}
              </div>
              <button 
                onClick={handleCopy}
                className="p-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Join Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <UserCheck size={18} />
              <h3 className="text-[10px] uppercase tracking-widest font-bold">{t.joinTree}</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{t.joinDescription}</p>
            <div className="flex gap-2">
              <input 
                type="text"
                value={newTreeId}
                onChange={(e) => setNewTreeId(e.target.value)}
                placeholder={t.treeId}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
              <button 
                onClick={() => onJoinTree(newTreeId)}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-all shadow-lg shadow-slate-900/20"
              >
                {t.join}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => signOut(auth)}
              className="w-full py-4 rounded-xl border border-rose-100 text-rose-500 font-bold text-xs hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              {t.signOut}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
