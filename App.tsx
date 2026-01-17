
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  Share2,
  ReceiptText,
  ArrowRight,
  QrCode,
  Copy,
  Check,
  Loader2,
  History,
  ChevronRight,
  Pencil,
  X,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { Participant, Expense } from './types';
import { supabase } from './supabaseClient';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 11);
};

const App: React.FC = () => {
  // --- State ---
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recentEvents, setRecentEvents] = useState<{id: string, name: string}[]>([]);
  
  // Participant Editing State
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPix, setEditPix] = useState('');

  // Form states
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendPix, setNewFriendPix] = useState('');
  const [payerId, setPayerId] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');

  // --- Sync Logic ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      loadEvent(id);
    }
    loadHistory();
  }, []);

  const addToHistory = (id: string, name: string) => {
    try {
      const historyStr = localStorage.getItem('ratatah_history');
      const history = historyStr ? JSON.parse(historyStr) : [];
      const newEntry = { id, name };
      const filtered = history.filter((item: any) => item && item.id !== id);
      const updated = [newEntry, ...filtered].slice(0, 10);
      localStorage.setItem('ratatah_history', JSON.stringify(updated));
      setRecentEvents(updated);
    } catch (e) {
      console.error("Error updating history", e);
    }
  };

  const removeFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Remover este rolê do seu histórico local?")) return;
    try {
      const historyStr = localStorage.getItem('ratatah_history');
      const history = historyStr ? JSON.parse(historyStr) : [];
      const updated = history.filter((item: any) => item && item.id !== id);
      localStorage.setItem('ratatah_history', JSON.stringify(updated));
      setRecentEvents(updated);
    } catch (err) {
      console.error("Error removing from history", err);
    }
  };

  const loadHistory = async () => {
    try {
      const historyStr = localStorage.getItem('ratatah_history');
      const localHistory = historyStr ? JSON.parse(historyStr) : [];
      setRecentEvents(Array.isArray(localHistory) ? localHistory : []);
      
      if (Array.isArray(localHistory) && localHistory.length > 0) {
        const ids = localHistory.map((h: any) => h?.id).filter(Boolean);
        if (ids.length > 0) {
          const { data } = await supabase.from('events').select('id, name').in('id', ids);
          if (data) {
            const validatedHistory = localHistory.map((lh: any) => {
              const remote = data.find(d => d.id === lh.id);
              return remote ? { id: remote.id, name: remote.name } : lh;
            });
            setRecentEvents(validatedHistory);
            localStorage.setItem('ratatah_history', JSON.stringify(validatedHistory));
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao carregar histórico local ou remoto.');
    }
  };

  const loadEvent = async (id: string) => {
    setIsLoading(true);
    try {
      const { data: event, error: evError } = await supabase.from('events').select('*').eq('id', id).single();
      if (evError || !event) throw new Error("Evento não encontrado");

      const { data: parts } = await supabase.from('participants').select('*').eq('event_id', id);
      const { data: exps } = await supabase.from('expenses').select('*').eq('event_id', id);

      setEventId(id);
      setEventName(event.name);
      setParticipants(parts || []);
      setExpenses((exps || []).map(e => ({
        id: e.id,
        participantId: e.participant_id,
        amount: e.amount,
        description: e.description,
        date: new Date(e.created_at).getTime()
      })));
      
      addToHistory(id, event.name);
    } catch (err: any) {
      console.error('Erro ao carregar evento:', err);
      alert("Evento não encontrado ou erro de conexão.");
      window.history.replaceState({}, '', window.location.pathname);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToCloud = async () => {
    if (!eventName.trim()) return alert("Dê um nome ao seu rolê antes de salvar!");
    setIsSaving(true);
    
    try {
      let currentId = eventId;
      if (!currentId) {
        const { data, error } = await supabase.from('events').insert({ name: eventName }).select().single();
        if (error) throw error;
        currentId = data.id;
        setEventId(currentId);
        window.history.replaceState({}, '', `?id=${currentId}`);
      } else {
        await supabase.from('events').update({ name: eventName }).eq('id', currentId);
      }

      await supabase.from('participants').delete().eq('event_id', currentId);
      if (participants.length > 0) {
        const partsToInsert = participants.map(p => ({
          event_id: currentId,
          name: p.name,
          pix_key: p.pixKey
        }));
        const { data: insertedParts } = await supabase.from('participants').insert(partsToInsert).select();
        
        if (insertedParts) {
          await supabase.from('expenses').delete().eq('event_id', currentId);
          if (expenses.length > 0) {
            const expsToInsert = expenses.map(e => {
              const localPayer = participants.find(p => p.id === e.participantId);
              const dbPayer = insertedParts.find(p => p.name === localPayer?.name);
              return {
                event_id: currentId,
                participant_id: dbPayer?.id,
                amount: e.amount,
                description: e.description
              };
            });
            await supabase.from('expenses').insert(expsToInsert);
          }
          await loadEvent(currentId!);
        }
      } else {
        addToHistory(currentId!, eventName);
      }
      setCopiedId('saved');
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      alert(`Erro ao salvar: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (p: Participant) => {
    setEditingParticipantId(p.id);
    setEditName(p.name);
    setEditPix(p.pixKey || '');
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    setParticipants(participants.map(p => 
      p.id === editingParticipantId ? { ...p, name: editName, pixKey: editPix } : p
    ));
    setEditingParticipantId(null);
  };

  const handleShare = () => {
    if (!eventId) return alert("Salve o evento primeiro para gerar um link!");
    navigator.clipboard.writeText(window.location.href);
    setCopiedId('link');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteExpense = (id: string) => {
    if (confirm("Deseja excluir esta despesa?")) {
      setExpenses(prev => prev.filter(x => x.id !== id));
    }
  };

  // --- Calculations ---
  const totalAmount = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amount, 0), [expenses]);
  const perPerson = useMemo(() => participants.length > 0 ? totalAmount / participants.length : 0, [totalAmount, participants]);

  const settlements = useMemo(() => {
    if (participants.length < 2) return [];
    const balances = participants.map(p => {
      const paid = expenses.filter(e => e.participantId === p.id).reduce((acc, curr) => acc + curr.amount, 0);
      return { id: p.id, name: p.name, pix: p.pixKey, net: paid - perPerson };
    });
    const debtors = balances.filter(b => b.net < -0.01).sort((a, b) => a.net - b.net).map(d => ({ ...d, net: Math.abs(d.net) }));
    const creditors = balances.filter(b => b.net > 0.01).sort((a, b) => b.net - a.net).map(c => ({ ...c }));
    const transactions: any[] = [];
    let dIdx = 0, cIdx = 0;
    const dCopy = debtors.map(d => ({...d})), cCopy = creditors.map(c => ({...c}));
    while (dIdx < dCopy.length && cIdx < cCopy.length) {
      const amountToPay = Math.min(dCopy[dIdx].net, cCopy[cIdx].net);
      transactions.push({ id: `t-${dIdx}-${cIdx}`, from: dCopy[dIdx].name, to: cCopy[dIdx].name, amount: amountToPay, pix: cCopy[cIdx].pix });
      dCopy[dIdx].net -= amountToPay; cCopy[cIdx].net -= amountToPay;
      if (dCopy[dIdx].net < 0.01) dIdx++; if (cCopy[cIdx].net < 0.01) cIdx++;
    }
    return transactions;
  }, [participants, expenses, perPerson]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] gap-4">
        <Loader2 className="w-10 h-10 text-[#FF5C00] animate-spin" />
        <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Carregando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-6xl mx-auto text-slate-100 font-sans">
      {/* App Bar */}
      <header className="flex items-center justify-between py-8 border-b border-slate-900 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#FF5C00] to-[#FF8A00] rounded-2xl flex items-center justify-center shadow-xl shadow-orange-950/40">
            <ReceiptText className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter leading-none uppercase italic">RATATAH</h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mt-1">RACHA-CONTA PRO</span>
          </div>
        </div>
        
        <div className="flex gap-3">
          {eventId && (
            <button 
              onClick={handleShare}
              className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 transition-all flex items-center gap-2 font-bold text-xs"
            >
              {copiedId === 'link' ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedId === 'link' ? 'COPIADO' : 'LINK'}</span>
            </button>
          )}
          <button 
            onClick={() => { if(confirm("Deseja iniciar um novo rolê e limpar tudo?")) window.location.href = window.location.pathname; }}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-red-400 transition-all"
            title="Reiniciar"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hero: Nome do Rolê */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 rounded-[40px] p-8 md:p-14 border border-slate-800 shadow-2xl mb-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <label className="text-xs md:text-sm font-black text-[#FF5C00] uppercase tracking-[0.4em] mb-4 block opacity-80">
            NOME DO ROLÊ
          </label>
          <input 
            type="text" 
            placeholder="Ex: CHURRASCO DO SÁBADO"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="text-5xl md:text-8xl font-black text-white placeholder-slate-500 outline-none w-full border-none focus:ring-0 p-0 bg-transparent tracking-tighter uppercase leading-tight"
          />
        </div>
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Data Entry */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Step 1: Participants */}
          <section className="bg-slate-900/40 rounded-[32px] p-8 border border-slate-800/60 backdrop-blur-sm">
            <header className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-slate-400 flex items-center gap-3 uppercase tracking-[0.2em]">
                <Users className="w-5 h-5 text-[#FF5C00]" /> 1. Galera
              </h2>
              <span className="text-[10px] font-bold px-3 py-1 bg-slate-950 rounded-full text-slate-500 border border-slate-800">
                {participants.length} PESSOAS
              </span>
            </header>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input 
                  type="text" 
                  placeholder="Nome do amigo" 
                  value={newFriendName} 
                  onChange={(e) => setNewFriendName(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" 
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Pix (opcional)" 
                    value={newFriendPix} 
                    onChange={(e) => setNewFriendPix(e.target.value)} 
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" 
                  />
                  <button 
                    onClick={() => { 
                      if(!newFriendName.trim()) return; 
                      setParticipants([...participants, { id: generateId(), name: newFriendName, pixKey: newFriendPix }]); 
                      setNewFriendName(''); 
                      setNewFriendPix(''); 
                    }} 
                    className="w-14 bg-white text-slate-950 rounded-2xl flex items-center justify-center hover:bg-slate-200 shadow-lg transition-all active:scale-95 shrink-0"
                  >
                    <Plus strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {participants.map(p => (
                  <div key={p.id} className="group flex flex-col gap-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-800 hover:border-slate-600 transition-all">
                    {editingParticipantId === p.id ? (
                      <div className="space-y-2 w-full">
                        <input 
                          autoFocus
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                          placeholder="Nome"
                        />
                        <input 
                          type="text" 
                          value={editPix} 
                          onChange={(e) => setEditPix(e.target.value)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/20"
                          placeholder="Chave Pix"
                        />
                        <div className="flex gap-2 justify-end pt-1">
                          <button onClick={() => setEditingParticipantId(null)} className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                          <button onClick={saveEdit} className="p-2 text-emerald-500 hover:text-emerald-400 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="min-w-0 pr-4">
                          <p className="font-bold text-slate-200 truncate">{p.name}</p>
                          {p.pixKey && <p className="text-[10px] text-slate-500 font-mono truncate uppercase">{p.pixKey}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditing(p)} className="p-2 text-slate-700 hover:text-orange-500 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setParticipants(participants.filter(x => x.id !== p.id))} className="p-2 text-slate-700 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Step 2: Expenses */}
          <section className="bg-slate-900/40 rounded-[32px] p-8 border border-slate-800/60 backdrop-blur-sm">
            <header className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-slate-400 flex items-center gap-3 uppercase tracking-[0.2em]">
                <DollarSign className="w-5 h-5 text-[#FF5C00]" /> 2. Gastos
              </h2>
              <span className="text-[10px] font-bold px-3 py-1 bg-slate-950 rounded-full text-slate-500 border border-slate-800">
                {expenses.length} ITENS
              </span>
            </header>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select 
                  value={payerId} 
                  onChange={(e) => setPayerId(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
                >
                  <option value="" disabled>Quem pagou?</option>
                  {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500 font-black text-sm">R$</span>
                   <input 
                    type="text" 
                    placeholder="0,00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white font-black outline-none focus:ring-2 focus:ring-orange-500/20" 
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="O que foi comprado? (Ex: Cerveja, Carne...)" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-orange-500/20" 
                />
                <button 
                  onClick={() => { 
                    const val = parseFloat(amount.replace(',','.')); 
                    if(!payerId || isNaN(val)) return; 
                    setExpenses([{ id: generateId(), participantId: payerId, amount: val, description, date: Date.now() }, ...expenses]); 
                    setAmount(''); 
                    setDescription(''); 
                  }} 
                  className="w-14 bg-white text-slate-950 rounded-2xl flex items-center justify-center hover:bg-slate-200 shadow-lg transition-all active:scale-95 shrink-0"
                >
                  <Plus strokeWidth={3} />
                </button>
              </div>
            </div>
            
            <div className="mt-8 space-y-3">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-5 bg-slate-950/40 rounded-2xl border border-slate-800/50 group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-orange-500 text-xs">
                      {participants.find(p => p.id === exp.participantId)?.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-orange-500 uppercase tracking-widest">{participants.find(p => p.id === exp.participantId)?.name}</p>
                      <p className="font-bold text-slate-300">{exp.description || 'Gasto sem nome'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-white">{formatBRL(exp.amount)}</span>
                    <button onClick={() => deleteExpense(exp.id)} className="text-slate-700 hover:text-red-500 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-slate-900">
              <button 
                onClick={handleSaveToCloud}
                disabled={isSaving}
                className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.3em] transition-all shadow-2xl ${copiedId === 'saved' ? 'bg-emerald-600' : 'bg-[#FF5C00]'} text-white disabled:opacity-50`}
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (copiedId === 'saved' ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />)}
                {isSaving ? 'SALVANDO...' : (copiedId === 'saved' ? 'SALVO!' : 'SALVAR')}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Results & History */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Section 3: Result Summary */}
          <section className="bg-slate-950 rounded-[40px] p-8 border border-slate-900 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full blur-[60px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
             
             <h2 className="text-[10px] font-black text-[#FF5C00] uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
               <TrendingUp className="w-4 h-4" /> 3. Fechamento
             </h2>

             <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Custo Total</span>
                  <p className="text-2xl font-black text-white">{formatBRL(totalAmount)}</p>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Cada um paga</span>
                  <p className="text-2xl font-black text-orange-500">{formatBRL(perPerson)}</p>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Como acertar:</h3>
                  {settlements.length > 0 && <QrCode className="w-4 h-4 text-orange-500 opacity-50" />}
                </div>

                {settlements.length === 0 ? (
                  <div className="py-12 text-center bg-slate-900/20 border-2 border-dashed border-slate-900 rounded-[32px]">
                    <p className="text-slate-600 text-xs font-bold uppercase italic tracking-widest">Nada pendente ainda...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settlements.map((s: any) => (
                      <div key={s.id} className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800/80 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-white text-sm">{s.from}</span>
                            <ArrowRight className="w-4 h-4 text-orange-500" />
                            <span className="font-black text-white text-sm">{s.to}</span>
                          </div>
                          <span className="font-black text-xl text-orange-500">{formatBRL(s.amount)}</span>
                        </div>
                        
                        {s.pix && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-slate-800 flex items-center justify-between group cursor-default">
                              <span className="text-[10px] font-mono text-slate-500 truncate mr-2">{s.pix}</span>
                              <Wallet className="w-3 h-3 text-slate-700 group-hover:text-orange-500 transition-colors" />
                            </div>
                            <button 
                              onClick={() => { 
                                navigator.clipboard.writeText(s.pix); 
                                setCopiedId(s.id); 
                                setTimeout(() => setCopiedId(null), 2000); 
                              }} 
                              className={`p-3 rounded-xl transition-all shadow-lg ${copiedId === s.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-[#FF5C00] hover:text-white'}`}
                            >
                              {copiedId === s.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </section>

          {/* Recent History Card */}
          {recentEvents.length > 0 && (
            <section className="bg-slate-900/20 rounded-[40px] p-8 border border-slate-900">
              <h2 className="text-[10px] font-black text-slate-500 flex items-center gap-3 mb-6 uppercase tracking-[0.3em]">
                <History className="w-5 h-5 text-slate-700" /> Histórico Local
              </h2>
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-2 group">
                    <button 
                      onClick={() => { window.history.replaceState({}, '', `?id=${event.id}`); loadEvent(event.id); }} 
                      className={`flex-1 flex items-center justify-between p-5 rounded-2xl transition-all border ${eventId === event.id ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-950 border-slate-900 hover:border-slate-800'}`}
                    >
                      <div className="flex flex-col items-start overflow-hidden text-left pr-4">
                        <span className={`font-black truncate text-sm uppercase ${eventId === event.id ? 'text-orange-500' : 'text-slate-200'}`}>{event.name}</span>
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">ID: {event.id?.split('-')[0]}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${eventId === event.id ? 'text-orange-500' : 'text-slate-800'}`} />
                    </button>
                    <button 
                      onClick={(e) => removeFromHistory(e, event.id)}
                      className="p-5 bg-slate-950 border border-slate-900 rounded-2xl text-slate-800 hover:text-red-500 transition-all shadow-sm"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="mt-20 text-center pb-12">
        <div className="space-y-2">
           <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">
             RATATAH V1.0
           </p>
           <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">
             FEITO COM CERVEJA E PARAFUSO
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
