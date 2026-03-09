import React, { useState } from 'react';
import { FamilyMember } from '../types';
import { X, Save, Camera, User, Calendar, Heart, BookOpen, Check } from 'lucide-react';
import { translations, Language } from '../i18n';

interface MemberFormProps {
  member?: FamilyMember;
  members: FamilyMember[];
  onSave: (member: FamilyMember) => void;
  onCancel: () => void;
  prefill?: Partial<FamilyMember>;
  language: Language;
}

export const MemberForm: React.FC<MemberFormProps> = ({ member, members, onSave, onCancel, prefill, language }) => {
  const t = translations[language];
  const [formData, setFormData] = useState<Partial<FamilyMember>>(
    member || {
      id: crypto.randomUUID(),
      firstName: '',
      lastName: prefill?.lastName || '',
      gender: 'male',
      birthDate: '',
      deathDate: '',
      fatherId: prefill?.fatherId || '',
      motherId: prefill?.motherId || '',
      spouseId: prefill?.spouseId || '',
      siblingIds: [],
      bio: '',
      ...prefill
    }
  );

  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingImage(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setFormData({ ...formData, photoUrl: compressedDataUrl });
          setIsProcessingImage(false);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as FamilyMember);
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="font-bold text-slate-900">
            {member ? t.editMember : t.addMember}
          </h2>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Photo Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
                {isProcessingImage ? (
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                ) : formData.photoUrl ? (
                  <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={40} className="text-slate-300" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-all">
                <Camera size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.profilePhoto}</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.firstName}</label>
                <input
                  required
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                  placeholder={t.firstName}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.lastName}</label>
                <input
                  required
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                  placeholder={t.lastName}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.gender}</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm appearance-none"
                >
                  <option value="male">{t.male}</option>
                  <option value="female">{t.female}</option>
                  <option value="other">{t.other}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.birthDate}</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.deathDate}</label>
                <input
                  type="date"
                  value={formData.deathDate}
                  onChange={e => setFormData({ ...formData, deathDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{t.familyConnections}</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.father}</label>
                  <select
                    value={formData.fatherId || ''}
                    onChange={e => setFormData({ ...formData, fatherId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none text-xs"
                  >
                    <option value="">{t.none}</option>
                    {members.filter(m => m.id !== formData.id && m.gender === 'male').map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.mother}</label>
                  <select
                    value={formData.motherId || ''}
                    onChange={e => setFormData({ ...formData, motherId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none text-xs"
                  >
                    <option value="">{t.none}</option>
                    {members.filter(m => m.id !== formData.id && m.gender === 'female').map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.spouse}</label>
                  <select
                    value={formData.spouseId || ''}
                    onChange={e => setFormData({ ...formData, spouseId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none text-xs"
                  >
                    <option value="">{t.none}</option>
                    {members.filter(m => m.id !== formData.id).map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.brothers}</label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-1">
                      {members
                        .filter(m => m.id !== formData.id && m.gender === 'male')
                        .map(m => {
                          const isSelected = formData.siblingIds?.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                const current = formData.siblingIds || [];
                                const next = isSelected 
                                  ? current.filter(id => id !== m.id)
                                  : [...current, m.id];
                                setFormData({ ...formData, siblingIds: next });
                              }}
                              className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-200 text-blue-600' 
                                  : 'bg-white border-slate-100 text-slate-600'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                              <span className="text-xs font-medium">{m.firstName} {m.lastName}</span>
                            </button>
                          );
                        })}
                      {members.filter(m => m.id !== formData.id && m.gender === 'male').length === 0 && (
                        <p className="text-[10px] text-slate-400 italic p-2">{t.none}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.sisters}</label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-1">
                      {members
                        .filter(m => m.id !== formData.id && m.gender === 'female')
                        .map(m => {
                          const isSelected = formData.siblingIds?.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                const current = formData.siblingIds || [];
                                const next = isSelected 
                                  ? current.filter(id => id !== m.id)
                                  : [...current, m.id];
                                setFormData({ ...formData, siblingIds: next });
                              }}
                              className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                                isSelected 
                                  ? 'bg-pink-50 border-pink-200 text-pink-600' 
                                  : 'bg-white border-slate-100 text-slate-600'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected ? 'bg-pink-500 border-pink-500' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                              <span className="text-xs font-medium">{m.firstName} {m.lastName}</span>
                            </button>
                          );
                        })}
                      {members.filter(m => m.id !== formData.id && m.gender === 'female').length === 0 && (
                        <p className="text-[10px] text-slate-400 italic p-2">{t.none}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">{t.biography}</label>
              <textarea
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] text-sm"
                placeholder={t.addNote}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
            <button
              type="submit"
              disabled={isProcessingImage}
              className="flex-1 bg-primary text-white py-4 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isProcessingImage ? t.processing : t.saveMember}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-4 rounded-xl border border-slate-200 font-bold text-sm text-slate-500 hover:bg-slate-50 transition-all"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
