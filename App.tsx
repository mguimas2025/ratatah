
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  Share2,
  Clock,
  ArrowRight,
  QrCode,
  Copy,
  Check,
  Loader2,
  Cloud
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
  }, []);

  const loadEvent = async (id: string) => {
    setIsLoading(true);
    try {
      const { data: event, error: evError } = await supabase.from('events').select('*').eq('id', id).single();
      if (evError || !event) throw new Error("Evento não encontrado");

      const { data: parts, error: pError } = await supabase.from('participants').select('*').eq('event_id', id);
      const { data: exps, error: exError } = await supabase.from('expenses').select('*').eq('event_id', id);

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
    } catch (err) {
      alert("Erro ao carregar evento. Criando um novo...");
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
      
      // 1. Upsert Event
      if (!currentId) {
        const { data, error } = await supabase.from('events').insert({ name: eventName }).select().single();
        if (error) throw error;
        currentId = data.id;
        setEventId(currentId);
        window.history.replaceState({}, '', `?id=${currentId}`);
      } else {
        await supabase.from('events').update({ name: eventName }).eq('id', currentId);
      }

      // 2. Sync Participants (Delete all and re-insert for simplicity in this version)
      await supabase.from('participants').delete().eq('event_id', currentId);
      if (participants.length > 0) {
        const partsToInsert = participants.map(p => ({
          event_id: currentId,
          name: p.name,
          pix_key: p.pixKey
        }));
        const { data: insertedParts } = await supabase.from('participants').insert(partsToInsert).select();
        
        // Re-mapear IDs locais para IDs do Supabase se necessário, 
        // mas aqui estamos simplificando: o App usa os IDs que vêm do banco após salvar.
        if (insertedParts) {
          // 3. Sync Expenses
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
          // Recarregar para garantir sincronia total de IDs
          await loadEvent(currentId!);
        }
      }
      
      setCopiedId('saved');
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar no servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = () => {
    if (!eventId) {
      alert("Salve o evento primeiro para gerar um link!");
      return;
    }
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedId('link');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Render logic (Same as before with small modifications) ---
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

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-12 h-12 text-[#FF5C00] animate-spin" />
        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Carregando Rolê...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between py-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#FF5C00] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
            <Clock className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">RATATAH</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></span>
              Racha-conta da galera
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {eventId && (
            <button 
              onClick={handleShare}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-xs"
            >
              {copiedId === 'link' ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
              {copiedId === 'link' ? 'LINK COPIADO' : 'COMPARTILHAR'}
            </button>
          )}
          <button 
            onClick={() => { if(confirm("Limpar tudo?")) window.location.href = window.location.pathname; }}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex-1">
            <label className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest mb-2 block">Nome do Rolê</label>
            <input 
              type="text" 
              placeholder="Ex: Resenha de Sexta"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="text-3xl md:text-4xl font-black text-slate-900 placeholder-slate-200 outline-none w-full border-none focus:ring-0 p-0 bg-transparent"
            />
          </div>
          <button 
            onClick={handleSaveToCloud}
            disabled={isSaving}
            className="flex items-center justify-center gap-3 px-8 py-5 bg-[#0B1120] text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 whitespace-nowrap disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
            {copiedId === 'saved' ? 'SALVO COM SUCESSO!' : 'SALVAR NA NUVEM'}
          </button>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {/* Participantes */}
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xs font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-[0.15em]">
              <Users className="w-5 h-5 text-[#FF5C00]" /> 1. Quem está no grupo?
            </h2>
            <div className="flex flex-col gap-4">
              <input type="text" placeholder="Nome do amigo" value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-semibold focus:ring-2 focus:ring-orange-100" />
              <div className="flex gap-3">
                <input type="text" placeholder="Chave Pix (opcional)" value={newFriendPix} onChange={(e) => setNewFriendPix(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-semibold focus:ring-2 focus:ring-orange-100" />
                <button onClick={() => { if(!newFriendName) return; setParticipants([...participants, { id: generateId(), name: newFriendName, pixKey: newFriendPix }]); setNewFriendName(''); setNewFriendPix(''); }} className="w-14 h-14 bg-[#FF5C00] text-white rounded-2xl flex items-center justify-center hover:bg-orange-600 shadow-lg shadow-orange-100 shrink-0"><Plus className="w-8 h-8" strokeWidth={3} /></button>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-transparent hover:border-orange-100 transition-all">
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-bold text-slate-800 truncate">{p.name}</span>
                    {p.pixKey && <span className="text-[10px] text-slate-400 truncate font-bold uppercase tracking-tighter">PIX: {p.pixKey}</span>}
                  </div>
                  <button onClick={() => setParticipants(participants.filter(x => x.id !== p.id))} className="text-slate-300 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Despesas */}
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xs font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-[0.15em]">
              <DollarSign className="w-5 h-5 text-[#FF5C00]" /> 2. O que foi pago?
            </h2>
            <div className="space-y-4">
              <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-bold appearance-none focus:ring-2 focus:ring-orange-100 cursor-pointer">
                <option value="" disabled>Selecione quem pagou</option>
                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative sm:w-1/3">
                  <span className="absolute left-6 top-3.5 text-[10px] font-black text-[#FF5C00] uppercase">R$</span>
                  <input type="text" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 pt-8 pb-3 text-slate-900 font-black focus:ring-2 focus:ring-orange-100" />
                </div>
                <input type="text" placeholder="Ex: Cerveja e Picanha" value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-semibold focus:ring-2 focus:ring-orange-100" />
              </div>
              <button 
                onClick={() => { const val = parseFloat(amount.replace(',','.')); if(!payerId || isNaN(val)) return; setExpenses([{ id: generateId(), participantId: payerId, amount: val, description, date: Date.now() }, ...expenses]); setAmount(''); setDescription(''); }}
                className="w-full bg-[#0B1120] text-white rounded-2xl py-5 font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-slate-100"
              >Adicionar Despesa</button>
            </div>
            <div className="mt-8 space-y-3">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest">{participants.find(p => p.id === exp.participantId)?.name || '---'}</span>
                    <span className="font-bold text-slate-800">{exp.description}</span>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="font-black text-slate-900 text-lg">{formatBRL(exp.amount)}</span>
                    <button onClick={() => setExpenses(expenses.filter(x => x.id !== exp.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5">
          <section className="bg-[#0B1120] rounded-[48px] p-8 md:p-10 shadow-2xl shadow-slate-400 text-white sticky top-6 overflow-hidden min-h-[500px] flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[#FF5C00]">3. Fechamento</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Total</span>
                  <div className="text-2xl font-black">{formatBRL(totalAmount)}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Cada um</span>
                  <div className="text-2xl font-black">{formatBRL(perPerson)}</div>
                </div>
              </div>
              <div className="flex-1 space-y-8">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-[#FF5C00] mb-5 flex items-center gap-2"><QrCode className="w-4 h-4" /> Sugestão de Pagamentos</h3>
                  {settlements.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                      <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Tudo certo!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {settlements.map((s: any) => (
                        <div key={s.id} className="bg-white/5 p-5 rounded-3xl border border-white/10 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-200">{s.from}</span>
                              <ArrowRight className="w-4 h-4 text-[#FF5C00]" />
                              <span className="font-bold text-slate-200">{s.to}</span>
                            </div>
                            <span className="font-black text-white text-lg">{formatBRL(s.amount)}</span>
                          </div>
                          {s.pix && (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <div className="flex-1 flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5 overflow-hidden">
                                <QrCode className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="text-[10px] font-mono text-slate-400 truncate">PIX: {s.pix}</span>
                              </div>
                              <button 
                                onClick={() => { navigator.clipboard.writeText(s.pix); setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000); }}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${copiedId === s.id ? 'bg-emerald-500' : 'bg-[#FF5C00]'} text-white`}
                              >
                                {copiedId === s.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedId === s.id ? 'COPIADO' : 'COPIAR PIX'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <footer className="mt-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] pb-10">Desenvolvido com ❤️ pela Ratatah Team</footer>
    </div>
  );
};

export default App;
