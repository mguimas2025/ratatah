
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
  Check
} from 'lucide-react';
import { Participant, Expense, AppState } from './types';

const STORAGE_KEY = 'ratatah_app_state_v2';

// Helper for generating unique IDs safely
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const App: React.FC = () => {
  // --- State ---
  const [eventName, setEventName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Participant Input
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendPix, setNewFriendPix] = useState('');

  // Expense Input
  const [payerId, setPayerId] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');

  // --- Initialization ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: AppState = JSON.parse(saved);
        setEventName(parsed.eventName || '');
        setParticipants(parsed.participants || []);
        setExpenses(parsed.expenses || []);
      } catch (e) {
        console.error("Error loading state", e);
      }
    }
  }, []);

  // --- Auto-save to Local Storage ---
  useEffect(() => {
    if (participants.length > 0 || expenses.length > 0 || eventName) {
      const state: AppState = { eventName, participants, expenses };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [eventName, participants, expenses]);

  // --- Handlers ---
  const handleAddParticipant = () => {
    if (!newFriendName.trim()) return;
    const newParticipant: Participant = {
      id: generateId(),
      name: newFriendName.trim(),
      pixKey: newFriendPix.trim() || undefined
    };
    setParticipants(prev => [...prev, newParticipant]);
    setNewFriendName('');
    setNewFriendPix('');
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    setExpenses(prev => prev.filter(e => e.participantId !== id));
  };

  const handleRegisterExpense = () => {
    const val = amount.replace(',', '.');
    const numericAmount = parseFloat(val);
    if (!payerId || isNaN(numericAmount) || numericAmount <= 0) return;

    const newExpense: Expense = {
      id: generateId(),
      participantId: payerId,
      amount: numericAmount,
      description: description.trim() || 'Despesa Geral',
      date: Date.now()
    };

    setExpenses(prev => [newExpense, ...prev]);
    setAmount('');
    setDescription('');
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleReset = () => {
    if (confirm("Deseja mesmo limpar tudo e começar do zero?")) {
      setEventName('');
      setParticipants([]);
      setExpenses([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!navigator.clipboard) {
      alert("Seu navegador não suporta cópia automática. Chave: " + text);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // --- Calculations ---
  const totalAmount = useMemo(() => 
    expenses.reduce((acc, curr) => acc + curr.amount, 0)
  , [expenses]);

  const perPerson = useMemo(() => 
    participants.length > 0 ? totalAmount / participants.length : 0
  , [totalAmount, participants]);

  // --- Settlement Logic ---
  const settlements = useMemo(() => {
    if (participants.length < 2) return [];

    const balances = participants.map(p => {
      const paid = expenses
        .filter(e => e.participantId === p.id)
        .reduce((acc, curr) => acc + curr.amount, 0);
      return {
        id: p.id,
        name: p.name,
        pix: p.pixKey,
        net: paid - perPerson
      };
    });

    const debtors = balances
      .filter(b => b.net < -0.01)
      .sort((a, b) => a.net - b.net)
      .map(d => ({ ...d, net: Math.abs(d.net) }));
    
    const creditors = balances
      .filter(b => b.net > 0.01)
      .sort((a, b) => b.net - a.net)
      .map(c => ({ ...c }));

    const transactions: { id: string, from: string, to: string, amount: number, pix?: string }[] = [];
    let dIdx = 0;
    let cIdx = 0;

    const dCopy = debtors.map(d => ({...d}));
    const cCopy = creditors.map(c => ({...c}));

    while (dIdx < dCopy.length && cIdx < cCopy.length) {
      const amountToPay = Math.min(dCopy[dIdx].net, cCopy[cIdx].net);
      
      transactions.push({
        id: `t-${dIdx}-${cIdx}`,
        from: dCopy[dIdx].name,
        to: cCopy[cIdx].name,
        amount: amountToPay,
        pix: cCopy[cIdx].pix
      });

      dCopy[dIdx].net -= amountToPay;
      cCopy[cIdx].net -= amountToPay;

      if (dCopy[dIdx].net < 0.01) dIdx++;
      if (cCopy[cIdx].net < 0.01) cIdx++;
    }

    return transactions;
  }, [participants, expenses, perPerson]);

  const formatBRL = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Header */}
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
        
        <button 
          onClick={handleReset}
          className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
          title="Resetar tudo"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Title Card */}
        <div className="lg:col-span-12 bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex-1">
            <label className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest mb-2 block">
              Nome do Rolê
            </label>
            <input 
              type="text" 
              placeholder="Ex: Resenha de Sexta"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="text-3xl md:text-4xl font-black text-slate-900 placeholder-slate-200 outline-none w-full border-none focus:ring-0 p-0 bg-transparent"
            />
          </div>
          <button 
            className="flex items-center justify-center gap-3 px-8 py-5 bg-[#0B1120] text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 whitespace-nowrap"
            onClick={() => alert('Os dados são salvos automaticamente no seu navegador!')}
          >
            <Save className="w-5 h-5" />
            Dados Salvos
          </button>
        </div>

        {/* Input Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Participants */}
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xs font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-[0.15em]">
              <Users className="w-5 h-5 text-[#FF5C00]" />
              1. Quem está no grupo?
            </h2>
            
            <div className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="Nome do amigo"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-semibold placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
              />
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Chave Pix (opcional)"
                  value={newFriendPix}
                  onChange={(e) => setNewFriendPix(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-semibold placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
                />
                <button 
                  onClick={handleAddParticipant}
                  className="w-14 h-14 bg-[#FF5C00] text-white rounded-2xl flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg shadow-orange-100 shrink-0"
                >
                  <Plus className="w-8 h-8" strokeWidth={3} />
                </button>
              </div>
            </div>

            {participants.length > 0 && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-transparent hover:border-orange-100 transition-all group">
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-slate-800 truncate">{p.name}</span>
                      {p.pixKey && <span className="text-[10px] text-slate-400 truncate font-bold uppercase tracking-tighter">PIX: {p.pixKey}</span>}
                    </div>
                    <button 
                      onClick={() => handleRemoveParticipant(p.id)}
                      className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Expenses */}
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-xs font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-[0.15em]">
              <DollarSign className="w-5 h-5 text-[#FF5C00]" />
              2. O que foi pago?
            </h2>

            <div className="space-y-4">
              <select 
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-bold appearance-none focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
              >
                <option value="" disabled>Selecione quem pagou</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative sm:w-1/3">
                  <span className="absolute left-6 top-3.5 text-[10px] font-black text-[#FF5C00] uppercase">R$</span>
                  <input 
                    type="text" 
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 pt-8 pb-3 text-slate-900 font-black placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Ex: Cerveja e Picanha"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegisterExpense()}
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-semibold placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>

              <button 
                onClick={handleRegisterExpense}
                disabled={!payerId || !amount}
                className="w-full bg-[#0B1120] text-white rounded-2xl py-5 font-black uppercase tracking-[0.2em] text-sm hover:bg-slate-800 transition-all disabled:opacity-30 shadow-xl shadow-slate-100"
              >
                Adicionar Despesa
              </button>
            </div>

            {expenses.length > 0 && (
              <div className="mt-8 space-y-3">
                {expenses.map(exp => {
                  const payer = participants.find(p => p.id === exp.participantId);
                  return (
                    <div key={exp.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#FF5C00] uppercase tracking-widest">{payer?.name || '---'}</span>
                        <span className="font-bold text-slate-800">{exp.description}</span>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="font-black text-slate-900 text-lg">{formatBRL(exp.amount)}</span>
                        <button 
                          onClick={() => handleRemoveExpense(exp.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Closing Column */}
        <div className="lg:col-span-5">
          <section className="bg-[#0B1120] rounded-[48px] p-8 md:p-10 shadow-2xl shadow-slate-400 text-white sticky top-6 overflow-hidden min-h-[500px] flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[#FF5C00]">
                  3. Fechamento
                </h2>
                <Share2 className="w-5 h-5 text-slate-500" />
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
                {/* Transfers List */}
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-[#FF5C00] mb-5 flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    Sugestão de Pagamentos
                  </h3>
                  
                  {settlements.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                      <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Nenhuma pendência</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {settlements.map((s) => (
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
                              <div className="flex-1 flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl overflow-hidden border border-white/5">
                                <QrCode className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="text-[10px] font-mono text-slate-400 truncate">PIX: {s.pix}</span>
                              </div>
                              <button 
                                onClick={() => copyToClipboard(s.pix!, s.id)}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 ${
                                  copiedId === s.id 
                                  ? 'bg-emerald-500 text-white' 
                                  : 'bg-[#FF5C00] hover:bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                                }`}
                              >
                                {copiedId === s.id ? (
                                  <><Check className="w-3 h-3" /> COPIADO</>
                                ) : (
                                  <><Copy className="w-3 h-3" /> COPIAR PIX</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Balances */}
                <div className="pt-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                    Resumo de Saldos
                  </h3>
                  <div className="space-y-2">
                    {participants.map(p => {
                      const paid = expenses.filter(e => e.participantId === p.id).reduce((acc, curr) => acc + curr.amount, 0);
                      const balance = paid - perPerson;
                      const isNeg = balance < -0.01;
                      const isPos = balance > 0.01;

                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs px-1 border-b border-white/5 pb-2">
                          <span className="text-slate-400 font-bold">{p.name}</span>
                          <span className={`font-black ${isNeg ? 'text-red-400' : isPos ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {isNeg ? '-' : isPos ? '+' : ''} {formatBRL(Math.abs(balance))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] pb-10">
        Desenvolvido com ❤️ pela Ratatah Team
      </footer>
    </div>
  );
};

export default App;
