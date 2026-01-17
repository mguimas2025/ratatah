
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
  Cloud,
  History,
  ChevronRight,
  Pencil,
  X,
  AlertCircle
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
      alert("Evento não encontrado ou erro de conexão. Iniciando novo rolê.");
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
      const msg = err?.message || "Erro desconhecido";
      alert(`Erro ao sincronizar: ${msg}. Verifique a conexão ou as variáveis do Supabase.`);
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
      transactions.push({ id: `t-${dIdx}-${cIdx}`, from: dCopy[dIdx].name, to: cCopy[cIdx].name, amount: amountToPay, pix: cCopy[cIdx].pix });
      dCopy[dIdx].net -= amountToPay; cCopy[cIdx].net -= amountToPay;
      if (dCopy[dIdx].net < 0.01) dIdx++; if (cCopy[cIdx].net < 0.01) cIdx++;
    }
    return transactions;
  }, [participants, expenses, perPerson]);

  const formatBRL = (val: number) => {
    if (typeof val !== 'number') return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] gap-4">
        <Loader2 className="w-10 h-10 text-[#FF5C00] animate-spin" />
        <p className="font-black text-slate-500 uppercase tracking-widest text-[10px]">Carregando Rolê...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 max-w-5xl mx-auto text-slate-100">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FF5C00] rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-950/20">
            <ReceiptText className="text-white w-6 h-6 md:w-7 md:h-7" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none uppercase">RATATAH</h1>
            <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-1">
              O RACHA CONTA DA GALERA
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {eventId && (
            <button 
              onClick={handleShare}
              className="p-2.5 md:p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 transition-all flex items-center gap-2 font-bold text-[10px]"
            >
              {copiedId === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedId === 'link' ? 'LINK COPIADO' : 'COMPARTILHAR'}</span>
            </button>
          )}
          <button 
            onClick={() => { if(confirm("Limpar tudo?")) window.location.href = window.location.pathname; }}
            className="p-2.5 md:p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-red-400 transition-all shadow-sm"
            title="Reiniciar"
          >
            <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        {/* Header Name Card - Enhanced Visual Weight */}
        <div className="lg:col-span-12 bg-slate-900/50 rounded-3xl p-6 md:p-10 border border-slate-800 shadow-inner">
          <label className="text-[11px] md:text-xs font-black text-[#FF5C00] uppercase tracking-[0.3em] mb-3 block">Nome do Rolê</label>
          <input 
            type="text" 
            placeholder="Ex: Resenha de Sexta"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="text-4xl md:text-7xl font-black text-white placeholder-slate-800 outline-none w-full border-none focus:ring-0 p-0 bg-transparent tracking-tighter"
          />
        </div>

        <div className="lg:col-span-7 space-y-5 md:space-y-6">
          {/* Section 1: Participants */}
          <section className="bg-slate-900/40 rounded-[32px] p-6 md:p-8 border border-slate-800">
            <h2 className="text-[10px] font-black text-slate-400 flex items-center gap-2 mb-6 uppercase tracking-[0.15em]">
              <Users className="w-4 h-4 text-[#FF5C00]" /> 1. Quem está no grupo?
            </h2>
            <div className="flex flex-col gap-3">
              <input type="text" placeholder="Nome do amigo" value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-3.5 text-white font-semibold focus:ring-1 focus:ring-orange-500/30 outline-none text-sm" />
              <div className="flex gap-3 items-stretch h-[50px]">
                <input type="text" placeholder="Chave Pix (opcional)" value={newFriendPix} onChange={(e) => setNewFriendPix(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-5 py-3.5 text-white font-semibold focus:ring-1 focus:ring-orange-500/30 outline-none text-sm" />
                <button onClick={() => { if(!newFriendName) return; setParticipants([...participants, { id: generateId(), name: newFriendName, pixKey: newFriendPix }]); setNewFriendName(''); setNewFriendPix(''); }} className="w-12 bg-[#FF5C00] text-white rounded-xl flex items-center justify-center hover:bg-orange-600 shrink-0 transition-transform active:scale-95"><Plus className="w-6 h-6" strokeWidth={3} /></button>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {participants.map(p => (
                <div key={p.id} className="group relative bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 hover:border-orange-500/30 transition-all">
                  {editingParticipantId === p.id ? (
                    <div className="flex flex-col gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-slate-900 px-3 py-1.5 rounded-lg text-sm font-bold border-none ring-1 ring-slate-800 text-white outline-none" placeholder="Nome" />
                      <input value={editPix} onChange={e => setEditPix(e.target.value)} className="bg-slate-900 px-3 py-1.5 rounded-lg text-[10px] border-none ring-1 ring-slate-800 text-slate-400 outline-none" placeholder="Pix" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={saveEdit} className="bg-emerald-600 text-white p-1.5 rounded-md flex-1 text-[9px] font-black">SALVAR</button>
                        <button onClick={() => setEditingParticipantId(null)} className="bg-slate-800 text-slate-400 p-1.5 rounded-md text-[9px] font-black"><X className="w-3 h-3 mx-auto"/></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col overflow-hidden pr-12 text-left">
                        <span className="font-bold text-slate-200 truncate text-sm">{p.name}</span>
                        {p.pixKey && <span className="text-[9px] text-slate-500 truncate font-bold uppercase tracking-tight">PIX: {p.pixKey}</span>}
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(p)} className="p-1.5 bg-slate-900 rounded-lg text-slate-500 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setParticipants(participants.filter(x => x.id !== p.id))} className="p-1.5 bg-slate-900 rounded-lg text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Expenses */}
          <section className="bg-slate-900/40 rounded-[32px] p-6 md:p-8 border border-slate-800">
            <h2 className="text-[10px] font-black text-slate-400 flex items-center gap-2 mb-6 uppercase tracking-[0.15em]">
              <DollarSign className="w-4 h-4 text-[#FF5C00]" /> 2. O que foi pago?
            </h2>
            <div className="space-y-3">
              <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-3.5 text-white font-bold appearance-none focus:ring-1 focus:ring-orange-500/30 cursor-pointer outline-none text-sm">
                <option value="" disabled className="bg-slate-950">Quem pagou?</option>
                {participants.map(p => <option key={p.id} value={p.id} className="bg-slate-950">{p.name}</option>)}
              </select>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative sm:w-1/3">
                  <span className="absolute left-5 top-3.5 text-[9px] font-black text-[#FF5C00] uppercase">R$</span>
                  <input type="text" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 pt-7 pb-2 text-white font-black focus:ring-1 focus:ring-orange-500/30 outline-none text-base" />
                </div>
                <input type="text" placeholder="O que foi comprado?" value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-5 py-3.5 text-white font-semibold focus:ring-1 focus:ring-orange-500/30 outline-none text-sm" />
              </div>
              <button onClick={() => { const val = parseFloat(amount.replace(',','.')); if(!payerId || isNaN(val)) return; setExpenses([{ id: generateId(), participantId: payerId, amount: val, description, date: Date.now() }, ...expenses]); setAmount(''); setDescription(''); }} className="w-full bg-white text-slate-950 rounded-xl py-4 font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform">Adicionar Despesa</button>
            </div>
            
            <div className="mt-8 space-y-2">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-4 bg-slate-950/30 rounded-xl border border-slate-800/50 group hover:border-slate-600 transition-colors">
                  <div className="flex flex-col min-w-0 pr-4 text-left">
                    <span className="text-[8px] font-black text-[#FF5C00] uppercase tracking-widest truncate">{participants.find(p => p.id === exp.participantId)?.name || '---'}</span>
                    <span className="font-bold text-slate-200 text-xs truncate">{exp.description || 'Despesa'}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-black text-white text-sm">{formatBRL(exp.amount)}</span>
                    <button 
                      onClick={() => deleteExpense(exp.id)} 
                      className="text-slate-700 hover:text-red-500 p-1.5 transition-colors"
                      title="Excluir despesa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/50">
              <button 
                onClick={handleSaveToCloud}
                disabled={isSaving}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${copiedId === 'saved' ? 'bg-emerald-600' : 'bg-[#FF5C00]'} text-white shadow-xl shadow-orange-950/10 disabled:opacity-50`}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (copiedId === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
                {isSaving ? 'SALVANDO...' : (copiedId === 'saved' ? 'SALVO!' : 'SALVAR')}
              </button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-5 md:space-y-6">
          {/* Section 3: Result Summary */}
          <section className="bg-slate-950 rounded-[40px] p-7 md:p-9 shadow-2xl border border-slate-900 text-white overflow-hidden flex flex-col relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500 rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col h-full">
              <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FF5C00] mb-8">3. Fechamento</h2>
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-slate-900/40 border border-slate-800/50 p-5 rounded-2xl">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Total</span>
                  <div className="text-xl font-black">{formatBRL(totalAmount)}</div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/50 p-5 rounded-2xl">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Cada um</span>
                  <div className="text-xl font-black">{formatBRL(perPerson)}</div>
                </div>
              </div>

              <div className="space-y-6 text-left">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FF5C00] flex items-center gap-2"><QrCode className="w-3.5 h-3.5" /> Acertos</h3>
                {settlements.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-800 rounded-2xl">
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Tudo equilibrado!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((s: any) => (
                      <div key={s.id} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-300 truncate max-w-[80px]">{s.from}</span>
                            <ArrowRight className="w-3 h-3 text-[#FF5C00] shrink-0" />
                            <span className="font-bold text-slate-300 truncate max-w-[80px]">{s.to}</span>
                          </div>
                          <span className="font-black text-white text-sm">{formatBRL(s.amount)}</span>
                        </div>
                        {s.pix && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-black px-2.5 py-2 rounded-lg border border-slate-800 overflow-hidden">
                              <span className="text-[8px] font-mono text-slate-500 truncate">{s.pix}</span>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(s.pix); setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000); }} className={`p-2 rounded-lg transition-all ${copiedId === s.id ? 'bg-emerald-600' : 'bg-slate-800'} text-white`}>
                              {copiedId === s.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Recent History Card - Permanent Trash Icon */}
          {recentEvents.length > 0 && (
            <section className="bg-slate-900/30 rounded-[32px] p-6 md:p-8 border border-slate-800">
              <h2 className="text-[10px] font-black text-slate-500 flex items-center gap-2 mb-5 uppercase tracking-[0.15em]">
                <History className="w-4 h-4 text-slate-600" /> Meus Rolês Recentes
              </h2>
              <div className="flex flex-col gap-2">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-2 w-full">
                    <button 
                      onClick={() => { window.history.replaceState({}, '', `?id=${event.id}`); loadEvent(event.id); }} 
                      className={`flex-1 flex items-center justify-between p-3.5 rounded-xl transition-all border ${eventId === event.id ? 'bg-[#FF5C00]/10 border-[#FF5C00]/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                    >
                      <div className="flex flex-col items-start overflow-hidden text-left pr-4">
                        <span className={`font-bold truncate text-xs ${eventId === event.id ? 'text-[#FF5C00]' : 'text-slate-300'}`}>{event.name}</span>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">ID: {event.id?.split('-')[0] || '---'}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${eventId === event.id ? 'text-[#FF5C00]' : 'text-slate-700'}`} />
                    </button>
                    <button 
                      onClick={(e) => removeFromHistory(e, event.id)}
                      className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-600 hover:text-red-500 transition-colors shrink-0"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <footer className="mt-12 text-center text-slate-700 text-[9px] font-black uppercase tracking-[0.3em] pb-8">CRIADO À BASE DE CERVEJA E PARAFUSO</footer>
    </div>
  );
};

export default App;
