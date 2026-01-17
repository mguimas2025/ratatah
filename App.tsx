
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
  Wallet,
  Cloud,
  RefreshCw,
  Link
} from 'lucide-react';
import { Participant, Expense } from './types';
import { supabase } from './supabaseClient';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 11);
};

// Gera um código de sincronização amigável
const generateSyncToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem O, 0, I, 1 para evitar confusão
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) token += '-';
  }
  return token;
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
  
  // Sync States
  const [syncToken, setSyncToken] = useState<string>('');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [newSyncInput, setNewSyncInput] = useState('');

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

  // --- Initial Setup & Sync Token ---
  useEffect(() => {
    // Carregar ou gerar Token de Sincronização
    let token = localStorage.getItem('ratatah_sync_token');
    if (!token) {
      token = generateSyncToken();
      localStorage.setItem('ratatah_sync_token', token);
    }
    setSyncToken(token);

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      loadEvent(id);
    }
    loadHistory(token);
  }, []);

  const handleUpdateSyncToken = (newToken: string) => {
    if (!newToken || newToken.length < 4) return alert("Token inválido");
    const formatted = newToken.toUpperCase().trim();
    localStorage.setItem('ratatah_sync_token', formatted);
    setSyncToken(formatted);
    loadHistory(formatted);
    setShowSyncModal(false);
    setNewSyncInput('');
    alert("Dispositivo sincronizado! Seu histórico agora será carregado da nuvem.");
  };

  const loadHistory = async (token: string) => {
    try {
      // 1. Carrega histórico local
      const historyStr = localStorage.getItem('ratatah_history');
      let localHistory = historyStr ? JSON.parse(historyStr) : [];
      if (!Array.isArray(localHistory)) localHistory = [];

      // 2. Busca rolês no Supabase vinculados a este token
      // IMPORTANTE: Exige que a coluna sync_token exista na tabela events
      const { data: cloudEvents, error } = await supabase
        .from('events')
        .select('id, name')
        .eq('sync_token', token)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("Erro ao carregar histórico da nuvem. Verifique se a coluna 'sync_token' existe.");
      }

      // 3. Mescla Históricos (Prioridade para a nuvem)
      const merged = [...(cloudEvents || [])];
      localHistory.forEach((lh: any) => {
        if (!merged.find(m => m.id === lh.id)) {
          merged.push(lh);
        }
      });

      const finalHistory = merged.slice(0, 15);
      setRecentEvents(finalHistory);
      localStorage.setItem('ratatah_history', JSON.stringify(finalHistory));
    } catch (e) {
      console.warn('Falha ao sincronizar histórico.');
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
      
      // Ao abrir um rolê, garantimos que ele está no histórico
      const historyStr = localStorage.getItem('ratatah_history');
      const history = historyStr ? JSON.parse(historyStr) : [];
      const newEntry = { id, name: event.name };
      const filtered = history.filter((item: any) => item && item.id !== id);
      localStorage.setItem('ratatah_history', JSON.stringify([newEntry, ...filtered].slice(0, 15)));
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
      const eventPayload = { 
        name: eventName, 
        sync_token: syncToken // Salva o token do dispositivo atual para sincronização global
      };

      if (!currentId) {
        const { data, error } = await supabase.from('events').insert(eventPayload).select().single();
        if (error) throw error;
        currentId = data.id;
        setEventId(currentId);
        window.history.replaceState({}, '', `?id=${currentId}`);
      } else {
        await supabase.from('events').update(eventPayload).eq('id', currentId);
      }

      // Sincronizar Participantes
      await supabase.from('participants').delete().eq('event_id', currentId);
      if (participants.length > 0) {
        const partsToInsert = participants.map(p => ({
          event_id: currentId,
          name: p.name,
          pix_key: p.pixKey
        }));
        const { data: insertedParts, error: partsError } = await supabase.from('participants').insert(partsToInsert).select();
        
        if (partsError) throw partsError;

        if (insertedParts) {
          // Sincronizar Despesas
          await supabase.from('expenses').delete().eq('event_id', currentId);
          if (expenses.length > 0) {
            const expsToInsert = expenses.map(e => {
              const localPayer = participants.find(p => p.id === e.participantId);
              const dbPayer = insertedParts.find(p => p.name === localPayer?.name);
              if (!dbPayer) return null;
              return {
                event_id: currentId,
                participant_id: dbPayer.id,
                amount: e.amount,
                description: e.description
              };
            }).filter(Boolean);

            if (expsToInsert.length > 0) {
              const { error: expError } = await supabase.from('expenses').insert(expsToInsert);
              if (expError) throw expError;
            }
          }
        }
      } else {
        await supabase.from('expenses').delete().eq('event_id', currentId);
      }
      
      // Atualiza histórico local e nuvem
      await loadHistory(syncToken);
      
      setCopiedId('saved');
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      alert(`Erro ao salvar: ${err?.message || "Verifique se a coluna 'sync_token' existe na sua tabela 'events' no Supabase."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const removeFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Remover do histórico local? No banco de dados, o rolê continuará existindo.")) return;
    const historyStr = localStorage.getItem('ratatah_history');
    const history = historyStr ? JSON.parse(historyStr) : [];
    const updated = history.filter((item: any) => item && item.id !== id);
    localStorage.setItem('ratatah_history', JSON.stringify(updated));
    setRecentEvents(updated);
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

  const removeParticipant = (id: string) => {
    if (confirm("Remover participante? As despesas dele também sumirão.")) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      setExpenses(prev => prev.filter(e => e.participantId !== id));
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
        <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Acessando a nuvem...</p>
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
          <button 
            onClick={() => setShowSyncModal(true)}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-orange-500 transition-all"
            title="Sincronizar Dispositivos"
          >
            <Cloud className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => { if(confirm("Iniciar um novo rolê?")) window.location.href = window.location.pathname; }}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-red-400 transition-all"
            title="Limpar e Reiniciar"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hero: Nome do Rolê */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 rounded-[40px] p-8 md:p-14 border border-slate-800 shadow-2xl mb-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <label className="text-[10px] md:text-xs font-black text-[#FF5C00] uppercase tracking-[0.4em] mb-4 block opacity-80">
            NOME DO ROLÊ
          </label>
          <input 
            type="text" 
            placeholder="EX: CHURRASCO DO SÁBADO"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="text-4xl md:text-7xl font-black text-white placeholder-slate-800 outline-none w-full border-none focus:ring-0 p-0 bg-transparent tracking-tighter uppercase leading-tight"
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
                        <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-sm outline-none" placeholder="Nome" />
                        <input type="text" value={editPix} onChange={(e) => setEditPix(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-xs outline-none" placeholder="Chave Pix" />
                        <div className="flex gap-2 justify-end pt-1">
                          <button onClick={() => setEditingParticipantId(null)} className="p-2 text-slate-500"><X className="w-4 h-4" /></button>
                          <button onClick={saveEdit} className="p-2 text-emerald-500"><Check className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="min-w-0 pr-4">
                          <p className="font-bold text-slate-200 truncate">{p.name}</p>
                          {p.pixKey && <p className="text-[10px] text-slate-500 font-mono truncate uppercase">{p.pixKey}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditing(p)} className="p-2 text-slate-700 hover:text-orange-500"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => removeParticipant(p.id)} className="p-2 text-slate-700 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                  placeholder="O que foi comprado?" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-orange-500/20" 
                />
                <button 
                  onClick={() => { 
                    const cleanAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.');
                    const val = parseFloat(cleanAmount); 
                    if(!payerId) return alert("Quem pagou?");
                    if(isNaN(val) || val <= 0) return alert("Qual o valor?"); 
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
              {expenses.map(exp => {
                const p = participants.find(p => p.id === exp.participantId);
                if (!p) return null;
                return (
                  <div key={exp.id} className="flex items-center justify-between p-5 bg-slate-950/40 rounded-2xl border border-slate-800/50 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-orange-500 text-xs">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-orange-500 uppercase tracking-widest">{p.name}</p>
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
                );
              })}
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

          {/* History Section - Now with Cloud integration */}
          <section className="bg-slate-900/20 rounded-[40px] p-8 border border-slate-900">
            <header className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-slate-500 flex items-center gap-3 uppercase tracking-[0.3em]">
                <History className="w-5 h-5 text-slate-700" /> Histórico Sincronizado
              </h2>
              <button 
                onClick={() => loadHistory(syncToken)}
                className="p-2 text-slate-700 hover:text-orange-500 transition-colors"
                title="Atualizar Nuvem"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </header>
            
            {recentEvents.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-700 font-bold uppercase tracking-widest">Nenhum rolê encontrado.</p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-2 group">
                    <button 
                      onClick={() => { window.history.replaceState({}, '', `?id=${event.id}`); loadEvent(event.id); }} 
                      className={`flex-1 flex items-center justify-between p-5 rounded-2xl transition-all border ${eventId === event.id ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-950 border-slate-900 hover:border-slate-800'}`}
                    >
                      <div className="flex flex-col items-start overflow-hidden text-left pr-4">
                        <span className={`font-black truncate text-sm uppercase ${eventId === event.id ? 'text-orange-500' : 'text-slate-200'}`}>{event.name}</span>
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Nuvem ID: {event.id?.split('-')[0]}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${eventId === event.id ? 'text-orange-500' : 'text-slate-800'}`} />
                    </button>
                    <button 
                      onClick={(e) => removeFromHistory(e, event.id)}
                      className="p-5 bg-slate-950 border border-slate-900 rounded-2xl text-slate-800 hover:text-red-500 transition-all shadow-sm"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020617]/95 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-10 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full blur-[60px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
            
            <button onClick={() => setShowSyncModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white p-2">
              <X className="w-6 h-6" />
            </button>

            <div className="relative z-10">
              <Cloud className="w-12 h-12 text-orange-500 mb-6" />
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic mb-2">Sincronização Global</h2>
              <p className="text-slate-400 text-sm font-bold mb-8 leading-relaxed">Use o mesmo código em vários dispositivos para acessar seu histórico de qualquer lugar.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-[#FF5C00] uppercase tracking-[0.3em] mb-3 block">Seu Código Atual</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 font-mono text-xl text-white font-bold tracking-widest text-center">
                      {syncToken}
                    </div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(syncToken); setCopiedId('sync'); setTimeout(() => setCopiedId(null), 2000); }}
                      className={`p-4 rounded-2xl transition-all ${copiedId === 'sync' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      {copiedId === 'sync' ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">Conectar outro Código</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="XXXX-XXXX"
                      value={newSyncInput}
                      onChange={(e) => setNewSyncInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-mono text-center outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                    <button 
                      onClick={() => handleUpdateSyncToken(newSyncInput)}
                      className="bg-white text-slate-950 font-black px-6 py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs"
                    >
                      CONECTAR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-20 text-center pb-12">
        <div className="space-y-2">
           <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">
             RATATAH V2.0 CLOUD SYNC
           </p>
           <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">
             SUA CONTA, EM QUALQUER LUGAR
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
