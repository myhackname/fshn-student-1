import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, User, CheckCircle, XCircle, Play, Send, Award, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../App';

interface LiveQuestion {
  id: number;
  content: string;
  student_id: number;
  student_name: string;
  status: 'PENDING' | 'CONFIRMED' | 'ANSWERED' | 'GRADED';
  score?: number;
  answer?: string;
}

export default function LiveQuestions() {
  const { user, apiFetch } = useAuth();
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [activeQuestion, setActiveQuestion] = useState<LiveQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(100);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchQuestions();
    const socket = io();
    socket.on('new_live_question', (q) => {
      setQuestions(prev => [q, ...prev]);
      if (q.student_id === user.id) {
        setActiveQuestion(q);
      }
    });
    socket.on('live_question_update', (q) => {
      setQuestions(prev => prev.map(item => item.id === q.id ? q : item));
      if (activeQuestion?.id === q.id) {
        setActiveQuestion(q);
      }
    });
    return () => { socket.disconnect(); };
  }, []);

  const fetchQuestions = async () => {
    try {
      const data = await apiFetch('/api/live-questions');
      setQuestions(data);
      const active = data.find((q: any) => q.status !== 'GRADED' && (user.role === 'TEACHER' || q.student_id === user.id));
      if (active) setActiveQuestion(active);
    } catch (e) { console.error(e); }
  };

  const createQuestion = async () => {
    if (!newQuestion) return;
    setLoading(true);
    try {
      await apiFetch('/api/live-questions', {
        method: 'POST',
        body: JSON.stringify({ content: newQuestion })
      });
      setNewQuestion('');
      fetchQuestions();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const confirmPresence = async () => {
    try {
      await apiFetch(`/api/live-questions/${activeQuestion?.id}/confirm`, {
        method: 'POST'
      });
    } catch (e) { console.error(e); }
  };

  const submitAnswer = async () => {
    try {
      await apiFetch(`/api/live-questions/${activeQuestion?.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer })
      });
      setAnswer('');
    } catch (e) { console.error(e); }
  };

  const gradeAnswer = async () => {
    try {
      await apiFetch(`/api/live-questions/${activeQuestion?.id}/grade`, {
        method: 'POST',
        body: JSON.stringify({ score })
      });
      setActiveQuestion(null);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">🎯 Pyetje Live</h2>
          <p className="text-slate-500">Sistemi zgjedh automatikisht një student për t'u përgjigjur</p>
        </div>
      </div>

      {user.role === 'TEACHER' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <label className="block text-sm font-bold text-slate-700 mb-2">Krijo Pyetje të Re</label>
          <div className="flex space-x-4">
            <input 
              type="text" 
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Shkruani pyetjen këtu..."
              className="flex-1 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button 
              onClick={createQuestion}
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center space-x-2 shadow-lg shadow-blue-100"
            >
              <Play size={20} />
              <span>Fillo</span>
            </button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeQuestion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <HelpCircle size={120} />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-3">
                <span className="bg-blue-500/20 text-blue-400 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Pyetje Aktive
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-400 text-xs">Studenti i zgjedhur: <span className="text-white font-bold">{activeQuestion.student_name}</span></span>
              </div>

              <h3 className="text-3xl font-bold leading-tight">{activeQuestion.content}</h3>

              {user.id === activeQuestion.student_id && (
                <div className="pt-6 space-y-4">
                  {activeQuestion.status === 'PENDING' && (
                    <button 
                      onClick={confirmPresence}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all"
                    >
                      Konfirmo Prezencën
                    </button>
                  )}
                  {activeQuestion.status === 'CONFIRMED' && (
                    <div className="space-y-4">
                      <textarea 
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Shkruani përgjigjen tuaj..."
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 h-32"
                      />
                      <button 
                        onClick={submitAnswer}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-2"
                      >
                        <Send size={20} />
                        <span>Dërgo Përgjigjen</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {user.role === 'TEACHER' && activeQuestion.status === 'ANSWERED' && (
                <div className="pt-6 bg-slate-800/50 p-6 rounded-3xl space-y-4">
                  <p className="text-sm font-bold text-slate-400 uppercase">Përgjigja e Studentit</p>
                  <p className="text-lg italic text-slate-200">"{activeQuestion.answer}"</p>
                  <div className="flex items-center space-x-4 pt-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Vlerësimi (1-100)</label>
                      <input 
                        type="number" 
                        value={score}
                        onChange={(e) => setScore(parseInt(e.target.value))}
                        className="w-full bg-slate-700 border border-slate-600 p-3 rounded-xl text-white outline-none"
                      />
                    </div>
                    <button 
                      onClick={gradeAnswer}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold h-[52px] mt-6 transition-all"
                    >
                      Vlerëso
                    </button>
                  </div>
                </div>
              )}

              {activeQuestion.status === 'PENDING' && user.role === 'TEACHER' && (
                <div className="flex items-center space-x-2 text-amber-400 text-sm animate-pulse">
                  <Clock size={16} />
                  <span>Duke pritur konfirmimin nga studenti...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-bold text-slate-900">Historia e Pyetjeve</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {questions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 italic">Nuk ka pyetje të mëparshme.</div>
          ) : (
            questions.map(q => (
              <div key={q.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${q.status === 'GRADED' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    {q.status === 'GRADED' ? <Award size={20} /> : <HelpCircle size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{q.content}</p>
                    <p className="text-xs text-slate-500">{q.student_name} • {new Date(q.id).toLocaleDateString()}</p>
                  </div>
                </div>
                {q.status === 'GRADED' && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{q.score} pikë</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Vlerësuar</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
