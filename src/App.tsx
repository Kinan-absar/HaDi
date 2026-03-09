import React, { useState, useEffect } from 'react';
import { FamilyMember, Tribute } from './types';
import { FamilyTree } from './components/FamilyTree';
import { MemberForm } from './components/MemberForm';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Logo } from './components/Logo';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { Plus, Users, TreeDeciduous, Info, Edit2, Trash2, Heart, Baby, User, Settings as SettingsIcon, UserCheck, Share2, Check, Crosshair, X, Search, ChevronRight, Camera, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from './i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('hadi_language');
    return (saved as Language) || 'en';
  });
  const t = translations[language];

  useEffect(() => {
    localStorage.setItem('hadi_language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | undefined>(undefined);
  const [prefillData, setPrefillData] = useState<Partial<FamilyMember> | undefined>(undefined);
  const [addingRelativeType, setAddingRelativeType] = useState<'child' | 'sibling' | 'spouse' | 'father' | 'mother' | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [centerOnId, setCenterOnId] = useState<string | null>(null);
  const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [tributeContent, setTributeContent] = useState('');
  const [tributeType, setTributeType] = useState<'message' | 'flower' | 'candle'>('message');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentTreeId(userDoc.data().activeTreeId || user.uid);
        } else {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            activeTreeId: user.uid
          });
          setCurrentTreeId(user.uid);
        }
        (window as any).currentUserId = user.uid;
      }
      setUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !currentTreeId) {
      setMembers([]);
      return;
    }

    const q = query(collection(db, 'members'), where('treeId', '==', currentTreeId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as FamilyMember[];
      setMembers(membersData);

      // Fetch user emails for the map (with permission safety)
      const uniqueUserIds = Array.from(new Set(membersData.map(m => m.userId)));
      const newUserMap = { ...userMap };
      let updated = false;

      for (const uid of uniqueUserIds) {
        if (!newUserMap[uid]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              newUserMap[uid] = userDoc.data().email || 'Family Member';
              updated = true;
            }
          } catch (err) {
            // If we can't read other user profiles (common security rule), 
            // we'll rely on the userEmail stored on the member record
            console.warn(`Could not fetch profile for user ${uid}: Permissions denied.`);
            newUserMap[uid] = 'Family Member';
            updated = true;
          }
        }
      }
      if (updated) setUserMap(newUserMap);
    }, (error) => {
      console.error("Firestore subscription error:", error);
      if (error.message.includes("permissions")) {
        alert("Permission denied. Please ensure you have access to this family tree.");
      }
    });

    return unsubscribe;
  }, [user, currentTreeId]);

  const handlePostTribute = async (memberId: string) => {
    if (!user || !tributeContent.trim() || !currentTreeId) return;
    const newTribute: Tribute = {
      id: crypto.randomUUID(),
      memberId,
      treeId: currentTreeId,
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'Family Member',
      content: tributeContent,
      type: tributeType,
      createdAt: new Date().toISOString()
    };
    try {
      await updateDoc(doc(db, 'members', memberId), {
        tributes: arrayUnion(newTribute)
      });
      setTributeContent('');
      // Update local state for immediate feedback if needed, 
      // but onSnapshot should handle it
      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember({
          ...selectedMember,
          tributes: [...(selectedMember.tributes || []), newTribute]
        });
      }
    } catch (error) {
      console.error("Failed to post tribute:", error);
      alert("Failed to post tribute. Please check your permissions.");
    }
  };

  const handleJoinTree = async (newTreeId: string) => {
    if (!user || !newTreeId) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        activeTreeId: newTreeId
      });
      setCurrentTreeId(newTreeId);
      setIsSettingsOpen(false);
    } catch (error) {
      alert("Failed to join tree.");
    }
  };

  const handleClaimMember = async (memberId: string) => {
    if (!user) return;
    try {
      const previousMe = members.find(m => m.linkedUserId === user.uid);
      if (previousMe) {
        await updateDoc(doc(db, 'members', previousMe.id), { linkedUserId: null });
      }
      await updateDoc(doc(db, 'members', memberId), { linkedUserId: user.uid });
    } catch (error) {
      alert("Failed to claim member.");
    }
  };

  const handleSaveMember = async (member: FamilyMember) => {
    if (!user || !currentTreeId) return;

    const memberData = {
      ...member,
      userId: user.uid,
      userEmail: user.email,
      treeId: currentTreeId,
      updatedAt: new Date().toISOString()
    };

    try {
      let savedMemberId = editingMember?.id;
      
      if (editingMember) {
        const { id, ...data } = memberData;
        await updateDoc(doc(db, 'members', id), data);
        
        // If spouse changed, clear old spouse's connection
        if (editingMember.spouseId && editingMember.spouseId !== member.spouseId) {
          await updateDoc(doc(db, 'members', editingMember.spouseId), {
            spouseId: null
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'members'), memberData);
        savedMemberId = docRef.id;
      }

      // Reciprocal spouse update
      if (savedMemberId && member.spouseId) {
        await updateDoc(doc(db, 'members', member.spouseId), {
          spouseId: savedMemberId
        });
      }

      // Reciprocal sibling updates
      if (savedMemberId && member.siblingIds && member.siblingIds.length > 0) {
        for (const sibId of member.siblingIds) {
          const sib = members.find(m => m.id === sibId);
          if (sib) {
            const currentSibs = sib.siblingIds || [];
            if (!currentSibs.includes(savedMemberId)) {
              await updateDoc(doc(db, 'members', sibId), {
                siblingIds: [...currentSibs, savedMemberId]
              });
            }
          }
        }
      }

      // Clear old siblings if removed
      if (editingMember && editingMember.siblingIds) {
        const removedSibs = editingMember.siblingIds.filter(id => !member.siblingIds?.includes(id));
        for (const sibId of removedSibs) {
          const sib = members.find(m => m.id === sibId);
          if (sib) {
            await updateDoc(doc(db, 'members', sibId), {
              siblingIds: (sib.siblingIds || []).filter(id => id !== editingMember.id)
            });
          }
        }
      }

      if (selectedMember && savedMemberId) {
        if (addingRelativeType === 'father') {
          await updateDoc(doc(db, 'members', selectedMember.id), { fatherId: savedMemberId });
        } else if (addingRelativeType === 'mother') {
          await updateDoc(doc(db, 'members', selectedMember.id), { motherId: savedMemberId });
        }
      }

      setIsFormOpen(false);
      setEditingMember(undefined);
      setPrefillData(undefined);
      setAddingRelativeType(null);
    } catch (error) {
      console.error("Error saving member:", error);
    }
  };

  const handleAddRelative = (type: 'child' | 'sibling' | 'spouse' | 'father' | 'mother') => {
    if (!selectedMember) return;

    let prefill: Partial<FamilyMember> = {
      lastName: selectedMember.lastName
    };

    if (type === 'child') {
      if (selectedMember.gender === 'male') prefill.fatherId = selectedMember.id;
      if (selectedMember.gender === 'female') prefill.motherId = selectedMember.id;
      if (selectedMember.spouseId) {
        const spouse = getMemberById(selectedMember.spouseId);
        if (spouse?.gender === 'female') prefill.motherId = spouse.id;
        if (spouse?.gender === 'male') prefill.fatherId = spouse.id;
      }
    } else if (type === 'sibling') {
      prefill.fatherId = selectedMember.fatherId;
      prefill.motherId = selectedMember.motherId;
    } else if (type === 'spouse') {
      prefill.spouseId = selectedMember.id;
      prefill.lastName = '';
    } else if (type === 'father') {
      prefill.gender = 'male';
      if (selectedMember.motherId) prefill.spouseId = selectedMember.motherId;
    } else if (type === 'mother') {
      prefill.gender = 'female';
      if (selectedMember.fatherId) prefill.spouseId = selectedMember.fatherId;
    }

    setPrefillData(prefill);
    setAddingRelativeType(type);
    setEditingMember(undefined);
    setIsFormOpen(true);
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm('Remove this family member?')) {
      try {
        await deleteDoc(doc(db, 'members', id));
        setSelectedMember(null);
      } catch (error) {
        console.error("Error deleting member:", error);
      }
    }
  };

  const getMemberById = (id?: string) => members.find(m => m.id === id);
  const getChildren = (parentId: string) => members.filter(m => m.fatherId === parentId || m.motherId === parentId);

  const handleFindMe = () => {
    const me = members.find(m => m.linkedUserId === user?.uid);
    if (me) {
      setCenterOnId(me.id);
      setTimeout(() => setCenterOnId(null), 1000);
    } else {
      alert("Identify yourself first by selecting a member and clicking 'This is Me'.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth language={language} onLanguageChange={setLanguage} />;
  }

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
              <Logo size={48} />
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight text-primary">{t.appName}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="p-2 text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
              title={t.language}
            >
              <Languages size={20} />
              <span className="text-[10px] font-bold uppercase hidden sm:inline">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>
            <button 
              onClick={handleFindMe}
              className="p-2 text-slate-500 hover:text-primary transition-colors"
              title={t.findMe}
            >
              <Crosshair size={20} />
            </button>
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary/20 transition-all"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">{t.invite}</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-500 hover:text-primary transition-colors"
              title={t.settings}
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
        <AnimatePresence mode="wait">
          {view === 'tree' ? (
            <motion.div
              key="tree"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[calc(100vh-180px)] min-h-[500px] bg-[#fdfbf7] rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative"
            >
              <FamilyTree 
                members={members} 
                onMemberClick={setSelectedMember} 
                currentUserId={user?.uid} 
                centerOnId={centerOnId}
                language={language}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="relative">
                <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                <input 
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm`}
                />
              </div>

              {(Object.entries(
                members
                  .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()))
                  .reduce((acc, member) => {
                    const me = members.find(m => m.linkedUserId === user?.uid);
                    const spouse = me?.spouseId ? members.find(s => s.id === me.spouseId) : null;

                    const isMe = member.id === me?.id;
                    const myFather = me?.fatherId ? members.find(p => p.id === me.fatherId) : null;
                    const myMother = me?.motherId ? members.find(p => p.id === me.motherId) : null;
                    const isMyParent = (member.id === me?.fatherId || member.id === me?.motherId || 
                                       member.id === myFather?.spouseId || member.id === myMother?.spouseId);
                    const isMySibling = me?.siblingIds?.includes(member.id);

                    const isSpouse = member.id === spouse?.id;
                    const spouseFather = spouse?.fatherId ? members.find(p => p.id === spouse.fatherId) : null;
                    const spouseMother = spouse?.motherId ? members.find(p => p.id === spouse.motherId) : null;
                    const isSpouseParent = (member.id === spouse?.fatherId || member.id === spouse?.motherId ||
                                           member.id === spouseFather?.spouseId || member.id === spouseMother?.spouseId);
                    const isSpouseSibling = spouse?.siblingIds?.includes(member.id);

                    // Marcel logic: Child of me and my spouse
                    const isSharedChild = (member.fatherId && member.motherId && 
                                          ((member.fatherId === me?.id && member.motherId === spouse?.id) ||
                                           (member.motherId === me?.id && member.fatherId === spouse?.id)));

                    // 1. Shared Children (Marcel)
                    if (isSharedChild) {
                      const group = "Shared Members (Children)";
                      if (!acc[group]) acc[group] = [];
                      acc[group].push(member);
                      return acc;
                    }

                    // 2. Kinan's List (My Members)
                    if (isMe || isMyParent || isMySibling || isSpouse) {
                      const group = "My Members";
                      if (!acc[group]) acc[group] = [];
                      acc[group].push(member);
                    }

                    // 3. Hnen's List (Spouse's Members)
                    if (isSpouse || isSpouseParent || isSpouseSibling) {
                      const group = spouse ? `${spouse.firstName}'s Members` : "Spouse's Members";
                      if (!acc[group]) acc[group] = [];
                      // Avoid adding the same member twice to the SAME group, 
                      // but here they are different groups, so it's fine.
                      acc[group].push(member);
                    }

                    // 4. Others
                    if (!isMe && !isMyParent && !isMySibling && !isSpouse && !isSpouseParent && !isSpouseSibling && !isSharedChild) {
                      const creatorEmail = (member as any).userEmail || userMap[member.userId];
                      let creatorName = creatorEmail ? `${creatorEmail.split('@')[0].charAt(0).toUpperCase() + creatorEmail.split('@')[0].slice(1)}'s Members` : "Other Members";
                      if (!acc[creatorName]) acc[creatorName] = [];
                      acc[creatorName].push(member);
                    }

                    return acc;
                  }, {} as Record<string, FamilyMember[]>)
              ) as [string, FamilyMember[]][])
              .sort(([a], [b]) => {
                if (a === 'My Members') return -1;
                if (b === 'My Members') return 1;
                if (a === 'Shared Members (Children)') return -1;
                if (b === 'Shared Members (Children)') return 1;
                return a.localeCompare(b);
              })
              .map(([creator, creatorMembers]) => (
                <div key={creator} className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1 flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    {creator}
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {creatorMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => setSelectedMember(member)}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-primary/30 transition-all text-left shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <User size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 truncate text-sm">
                            {member.firstName} {member.lastName}
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            {member.birthDate || 'No birth date'}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 mb-8 px-6 text-center">
          <p className="text-xs text-slate-400 font-medium italic leading-relaxed max-w-xs mx-auto">
            {t.dedicatedTo}
          </p>
        </footer>
      </main>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center overflow-hidden"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users size={32} className="text-primary" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Invite Family</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Share this code with your family members so they can join and contribute to this tree.
              </p>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Your Family Tree Code</p>
                <p className="text-3xl font-black text-primary tracking-tighter font-mono">{currentTreeId?.slice(0, 8).toUpperCase()}</p>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(currentTreeId || '');
                    alert("Code copied to clipboard!");
                  }}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-dark transition-all"
                >
                  <Share2 size={18} />
                  Copy Full ID
                </button>
                <button 
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Member Details Modal/Drawer */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="font-bold text-slate-900">Member Details</h3>
                <button onClick={() => setSelectedMember(null)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 shadow-lg overflow-hidden">
                      {selectedMember.photoUrl ? (
                        <img src={selectedMember.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <User size={40} />
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setEditingMember(selectedMember);
                        setPrefillData(undefined);
                        setIsFormOpen(true);
                      }}
                      className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-all border-2 border-white"
                      title="Change Photo"
                    >
                      <Camera size={14} />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedMember.firstName} {selectedMember.lastName}</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mt-1">
                      {selectedMember.birthDate || 'Unknown'} {selectedMember.deathDate ? `— ${selectedMember.deathDate}` : ''} • {selectedMember.gender}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                      <Users size={10} /> Added by {selectedMember.userId === user.uid ? 'You' : ((selectedMember as any).userEmail || userMap[selectedMember.userId] || 'Family Member')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {selectedMember.linkedUserId !== user.uid ? (
                    <button 
                      onClick={() => handleClaimMember(selectedMember.id)}
                      className="flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-xl font-bold text-xs hover:bg-primary/20 transition-all"
                    >
                      <UserCheck size={16} />
                      This is Me
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs border border-emerald-100">
                      <Check size={16} />
                      You
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setEditingMember(selectedMember);
                      setPrefillData(undefined);
                      setIsFormOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Add Relatives</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleAddRelative('child')} className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 hover:text-primary transition-all">
                      <Plus size={16} />
                      <span className="text-[9px] font-bold">Child</span>
                    </button>
                    <button onClick={() => handleAddRelative('sibling')} className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 hover:text-primary transition-all">
                      <Plus size={16} />
                      <span className="text-[9px] font-bold">Sibling</span>
                    </button>
                    <button onClick={() => handleAddRelative('spouse')} className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 hover:text-primary transition-all">
                      <Plus size={16} />
                      <span className="text-[9px] font-bold">Spouse</span>
                    </button>
                  </div>
                </div>

                {selectedMember.bio && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Biography</h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                      "{selectedMember.bio}"
                    </p>
                  </div>
                )}

                {/* Memorial Wall Section */}
                {selectedMember.deathDate && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2">
                        <Heart size={12} className="text-rose-400" /> Memorial Wall
                      </h4>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                        {(selectedMember.tributes || []).length} Tributes
                      </span>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {(selectedMember.tributes || [])
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(tribute => (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={tribute.id} 
                            className="p-3 bg-slate-50 rounded-2xl border border-slate-100"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[10px] font-bold text-primary">{tribute.userName}</span>
                              <span className="text-[9px] text-slate-400">{new Date(tribute.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {tribute.type === 'flower' && '🪷 '}
                              {tribute.type === 'candle' && '🕯️ '}
                              {tribute.content}
                            </p>
                          </motion.div>
                        ))}
                      {(selectedMember.tributes || []).length === 0 && (
                        <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-[10px] text-slate-400 font-medium italic">No tributes yet. Be the first to leave a memory.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex gap-2">
                        {(['message', 'flower', 'candle'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => setTributeType(type)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                              tributeType === type 
                                ? 'bg-primary text-white shadow-md' 
                                : 'bg-white text-slate-400 border border-slate-200'
                            }`}
                          >
                            {type === 'message' && 'Message'}
                            {type === 'flower' && '🪷 Flower'}
                            {type === 'candle' && '🕯️ Candle'}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <textarea
                          value={tributeContent}
                          onChange={(e) => setTributeContent(e.target.value)}
                          placeholder={tributeType === 'message' ? "Share a memory or tribute..." : "Add a short note..."}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px] resize-none"
                        />
                        <button
                          onClick={() => handlePostTribute(selectedMember.id)}
                          disabled={!tributeContent.trim()}
                          className="absolute bottom-2 right-2 p-2 bg-primary text-white rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-400">Connections</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {/* Spouse */}
                    {selectedMember.spouseId && (
                      <button 
                        onClick={() => setSelectedMember(getMemberById(selectedMember.spouseId)!)}
                        className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          {getMemberById(selectedMember.spouseId)?.photoUrl ? (
                            <img src={getMemberById(selectedMember.spouseId)?.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <User size={16} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Heart size={10} className="text-rose-500 fill-rose-500" /> Spouse
                          </p>
                          <p className="text-sm font-bold text-slate-900">{getMemberById(selectedMember.spouseId)?.firstName} {getMemberById(selectedMember.spouseId)?.lastName}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </button>
                    )}

                    {/* Parents */}
                    {selectedMember.fatherId && (
                      <button 
                        onClick={() => setSelectedMember(getMemberById(selectedMember.fatherId)!)}
                        className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          {getMemberById(selectedMember.fatherId)?.photoUrl ? (
                            <img src={getMemberById(selectedMember.fatherId)?.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <User size={16} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest ${language === 'ar' ? 'text-right' : ''}`}>{t.father}</p>
                          <p className={`text-sm font-bold text-slate-900 ${language === 'ar' ? 'text-right' : ''}`}>{getMemberById(selectedMember.fatherId)?.firstName} {getMemberById(selectedMember.fatherId)?.lastName}</p>
                        </div>
                        <ChevronRight size={16} className={`text-slate-300 ${language === 'ar' ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {selectedMember.motherId && (
                      <button 
                        onClick={() => setSelectedMember(getMemberById(selectedMember.motherId)!)}
                        className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          {getMemberById(selectedMember.motherId)?.photoUrl ? (
                            <img src={getMemberById(selectedMember.motherId)?.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <User size={16} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest ${language === 'ar' ? 'text-right' : ''}`}>{t.mother}</p>
                          <p className={`text-sm font-bold text-slate-900 ${language === 'ar' ? 'text-right' : ''}`}>{getMemberById(selectedMember.motherId)?.firstName} {getMemberById(selectedMember.motherId)?.lastName}</p>
                        </div>
                        <ChevronRight size={16} className={`text-slate-300 ${language === 'ar' ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {/* Siblings */}
                    {members.filter(m => 
                      m.id !== selectedMember.id && 
                      (
                        (selectedMember.fatherId && m.fatherId === selectedMember.fatherId) || 
                        (selectedMember.motherId && m.motherId === selectedMember.motherId) ||
                        (selectedMember.siblingIds && selectedMember.siblingIds.includes(m.id))
                      )
                    ).map(sibling => {
                      const sharesFather = selectedMember.fatherId && sibling.fatherId === selectedMember.fatherId;
                      const sharesMother = selectedMember.motherId && sibling.motherId === selectedMember.motherId;
                      const isHalfSibling = (sharesFather && !sharesMother) || (!sharesFather && sharesMother);
                      
                      let label = sibling.gender === 'male' ? t.brothers : sibling.gender === 'female' ? t.sisters : t.sibling;
                      if (isHalfSibling && !(selectedMember.siblingIds && selectedMember.siblingIds.includes(sibling.id))) label = `${language === 'en' ? 'Half-' : 'نصف '}${label}`;
                      
                      return (
                        <button 
                          key={sibling.id}
                          onClick={() => setSelectedMember(sibling)}
                          className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all group"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                            {sibling.photoUrl ? (
                              <img src={sibling.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <User size={16} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest ${language === 'ar' ? 'text-right' : ''}`}>
                              {label}
                            </p>
                            <p className={`text-sm font-bold text-slate-900 ${language === 'ar' ? 'text-right' : ''}`}>{sibling.firstName} {sibling.lastName}</p>
                          </div>
                          <ChevronRight size={16} className={`text-slate-300 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </button>
                      );
                    })}

                    {/* Children */}
                    {getChildren(selectedMember.id).map(child => (
                      <button 
                        key={child.id}
                        onClick={() => setSelectedMember(child)}
                        className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          {child.photoUrl ? (
                            <img src={child.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <User size={16} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 ${language === 'ar' ? 'justify-end' : ''}`}>
                            <Baby size={10} /> {t.child}
                          </p>
                          <p className={`text-sm font-bold text-slate-900 ${language === 'ar' ? 'text-right' : ''}`}>{child.firstName} {child.lastName}</p>
                        </div>
                        <ChevronRight size={16} className={`text-slate-300 ${language === 'ar' ? 'rotate-180' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => handleDeleteMember(selectedMember.id)}
                  className="w-full py-3 text-rose-500 font-bold text-xs hover:bg-rose-50 rounded-xl transition-all"
                >
                  {language === 'en' ? 'Delete Member' : 'حذف الفرد'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 py-2 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setView('tree')}
          className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'tree' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Logo size={24} className={view === 'tree' ? 'text-primary' : 'text-slate-400'} />
          <span className="text-[10px] font-bold">{language === 'en' ? 'Tree' : 'الشجرة'}</span>
        </button>
        
        <button 
          onClick={() => {
            setEditingMember(undefined);
            setPrefillData(undefined);
            setIsFormOpen(true);
          }}
          className="w-12 h-12 bg-primary text-white rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center -translate-y-4 hover:scale-110 active:scale-95 transition-all"
        >
          <Plus size={24} strokeWidth={3} />
        </button>

        <button 
          onClick={() => setView('list')}
          className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'list' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Users size={20} />
          <span className="text-[10px] font-bold">{language === 'en' ? 'List' : 'القائمة'}</span>
        </button>
      </div>

      {isFormOpen && (
        <MemberForm 
          member={editingMember}
          prefill={prefillData}
          members={members}
          onSave={handleSaveMember}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingMember(undefined);
            setPrefillData(undefined);
            setAddingRelativeType(null);
          }}
          language={language}
        />
      )}

      {isSettingsOpen && currentTreeId && (
        <Settings 
          treeId={currentTreeId}
          onJoinTree={handleJoinTree}
          onClose={() => setIsSettingsOpen(false)}
          language={language}
        />
      )}
    </div>
  );
}
