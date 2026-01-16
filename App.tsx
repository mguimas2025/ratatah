
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Github, 
  Save, 
  Share2,
  Clock
} from 'lucide-react';
import { Participant, Expense, AppState } from './types';

const STORAGE_KEY = 'ratatah_app_state';

const App: React.FC = () => {
  // --- State ---
  const [eventName, setEventName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
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
    const state: AppState = { eventName, participants, expenses };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [eventName, participants, expenses]);

  // --- Handlers ---
  const handleAddParticipant = () => {
    if (!newFriendName.trim()) return;
    const newParticipant: Participant = {
      id: crypto.randomUUID(),
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
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!payerId || isNaN(numericAmount) || numericAmount <= 0) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      participantId: payerId,
      amount: numericAmount,
      description: description.trim() || 'Sem descrição',
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
    if (confirm("Tem certeza que deseja resetar todos os dados?")) {
      setEventName('');
      setParticipants([]);
      setExpenses([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleShare = () => {
    alert("Função de compartilhamento em desenvolvimento!");
  };

  // --- Calculations ---
  const totalAmount = useMemo(() => 
    expenses.reduce((acc, curr) => acc + curr.amount, 0)
  , [expenses]);

  const perPerson = useMemo(() => 
    participants.length > 0 ? totalAmount / participants.length : 0
  , [totalAmount, participants]);

  // Format currency
  const formatBRL = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#FF5C00] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
            <Clock className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">RATATAH</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
              Local Storage Mode
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Github className="w-4 h-4" />
            Repo
          </button>
          <button 
            onClick={handleReset}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        
        {/* Row 1: Event Name Card */}
        <div className="lg:col-span-12 bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-[#FF5C00] uppercase tracking-wider mb-2 block">
              Nome do Evento
            </label>
            <input 
              type="text" 
              placeholder="Ex: Churrasco de Domingo"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="text-3xl md:text-4xl font-bold text-slate-900 placeholder-slate-200 outline-none w-full border-none focus:ring-0 p-0"
            />
          </div>
          <button 
            className="flex items-center justify-center gap-3 px-8 py-5 bg-[#0B1120] text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 whitespace-nowrap"
            onClick={() => alert('Dados salvos automaticamente!')}
          >
            <Save className="w-5 h-5" />
            Salvar no Navegador
          </button>
        </div>

        {/* Row 2: Participants Card */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 h-fit">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-wide">
              <Users className="w-5 h-5 text-[#FF5C00]" />
              1. Participantes
            </h2>
            
            <div className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="Nome do amigo"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-900 font-medium placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
              />
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Chave Pix (opcional)"
                  value={newFriendPix}
                  onChange={(e) => setNewFriendPix(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-900 font-medium placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
                />
                <button 
                  onClick={handleAddParticipant}
                  className="w-14 h-14 bg-[#FF5C00] text-white rounded-2xl flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg shadow-orange-100 shrink-0"
                >
                  <Plus className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Participants List */}
            {participants.length > 0 && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
                {participants.map(p => (
                  <div key={p.id} className="group flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-transparent hover:border-orange-200 transition-all">
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-slate-800 truncate">{p.name}</span>
                      {p.pixKey && <span className="text-[10px] text-slate-400 truncate uppercase font-semibold">PIX: {p.pixKey}</span>}
                    </div>
                    <button 
                      onClick={() => handleRemoveParticipant(p.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Registration Card */}
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 h-fit">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-wide">
              <DollarSign className="w-5 h-5 text-[#FF5C00]" />
              2. Registro de Gastos
            </h2>

            <div className="space-y-4">
              <select 
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-900 font-medium appearance-none focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
              >
                <option value="" disabled>Quem pagou?</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative md:w-1/3">
                  <span className="absolute left-5 top-3 text-[10px] font-black text-[#FF5C00]">R$</span>
                  <input 
                    type="text" 
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 pt-7 pb-3 text-slate-900 font-bold placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="O que foi pago?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegisterExpense()}
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-900 font-medium placeholder-slate-300 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>

              <button 
                onClick={handleRegisterExpense}
                disabled={!payerId || !amount}
                className="w-full bg-[#0B1120] text-white rounded-2xl py-5 font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-100"
              >
                Registrar Conta
              </button>
            </div>

            {/* Expenses List */}
            {expenses.length > 0 && (
              <div className="mt-8 space-y-3">
                {expenses.map(exp => {
                  const payer = participants.find(p => p.id === exp.participantId);
                  return (
                    <div key={exp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{payer?.name || 'Desconhecido'}</span>
                        <span className="font-semibold text-slate-800">{exp.description}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-slate-900">{formatBRL(exp.amount)}</span>
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

        {/* Row 2: Right Column (Summary) */}
        <div className="lg:col-span-5">
          <section className="bg-[#0B1120] rounded-[48px] p-8 md:p-10 shadow-2xl shadow-slate-300 text-white sticky top-6 overflow-hidden min-h-[400px]">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-slate-800 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#FF5C00]">
                  3. Fechamento
                </h2>
                <button 
                  onClick={handleShare}
                  className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
                >
                  <Share2 className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] backdrop-blur-md">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Total Geral
                  </span>
                  <div className="text-xl md:text-2xl font-black">
                    {formatBRL(totalAmount)}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] backdrop-blur-md">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Por Amigo
                  </span>
                  <div className="text-xl md:text-2xl font-black">
                    {formatBRL(perPerson)}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Resumo de Débitos
                </h3>
                {participants.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                    <span className="text-slate-500 text-sm font-medium">Adicione participantes para ver o fechamento</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participants.map(p => {
                      const paid = expenses.filter(e => e.participantId === p.id).reduce((acc, curr) => acc + curr.amount, 0);
                      const balance = paid - perPerson;
                      const isNegative = balance < 0;

                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <span className="font-bold text-slate-300">{p.name}</span>
                          <div className={`font-black ${isNegative ? 'text-red-400' : balance > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {isNegative ? '-' : balance > 0 ? '+' : ''} {formatBRL(Math.abs(balance))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-12 text-center text-slate-300 text-xs font-medium uppercase tracking-widest pb-10">
        Desenvolvido com ❤️ usando Gemini SDK & React
      </footer>
    </div>
  );
};

export default App;
