import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, Users, Clock, CheckCircle, AlertCircle, 
  Play, Pause, Send, Eye, BarChart2, ChevronRight, 
  Trash2, Save, Check, X, ArrowLeft, Timer
} from 'lucide-react';
import MotionLogo from './MotionLogo';
import { Test, Question, TestAttempt, TestAnswer } from '../types';
import { io, Socket } from 'socket.io-client';

import { jsPDF } from 'jspdf';

export default function Tests({ user, token }: { user: any, token: string }) {
  // ... existing state ...

  const generatePDF = (result: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59); // slate-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("FSHN STUDENT - REZULTATET", 20, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Studenti: ${result.student_name || user.name}`, 20, 55);
    doc.text(`Testi: ${result.title || selectedTest?.title}`, 20, 65);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, 75);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 80, 190, 80);
    
    doc.setFontSize(16);
    doc.text("Përmbledhja e Vlerësimit", 20, 95);
    
    doc.setFontSize(12);
    doc.text(`Pikët Totale: ${result.total_score} / ${result.total_points}`, 20, 110);
    doc.text(`Përqindja: ${((result.total_score / result.total_points) * 100).toFixed(1)}%`, 20, 120);
    if (result.grade) {
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text(`NOTA PËRFUNDIMTARE: ${result.grade}`, 20, 135);
      doc.setTextColor(0, 0, 0);
    }
    
    if (result.feedback) {
      doc.setFontSize(12);
      doc.text("Feedback i Mësuesit:", 20, 150);
      doc.setFont("helvetica", "italic");
      doc.text(result.feedback, 25, 160, { maxWidth: 160 });
    }
    
    doc.save(`Rezultati_${result.title || 'Test'}.pdf`);
  };
  const [tests, setTests] = useState<Test[]>([]);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'TAKE' | 'MONITOR' | 'GRADE' | 'RESULTS' | 'ADD_QUESTIONS'>('LIST');
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<TestAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [gradingData, setGradingData] = useState<{ attempt: TestAttempt, answers: TestAnswer[] } | null>(null);
  const [studentResults, setStudentResults] = useState<TestAttempt[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io();
    setSocket(s);
    fetchTests();
    if (user.role === 'STUDENT') fetchStudentResults();
    return () => { s.disconnect(); };
  }, []);

  const fetchAnalytics = async () => {
    if (!selectedTest) return;
    const res = await fetch(`/api/tests/${selectedTest.id}/analytics`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setAnalytics(data);
  };

  const fetchStudentResults = async () => {
    const res = await fetch('/api/student/results', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setStudentResults(data);
  };

  useEffect(() => {
    if (socket) {
      socket.on('student_joined_test', (data) => {
        if (selectedTest?.id === data.testId) fetchMonitoring();
      });
      socket.on('student_submitted_test', (data) => {
        if (selectedTest?.id === data.testId) fetchMonitoring();
      });
      socket.on('test_distributed', () => {
        fetchTests();
      });
    }
  }, [socket, selectedTest]);

  const fetchTests = async () => {
    const res = await fetch('/api/tests', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setTests(data);
  };

  const fetchQuestions = async (testId: number) => {
    const res = await fetch(`/api/tests/${testId}/questions`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setQuestions(data);
  };

  const fetchMonitoring = async () => {
    if (!selectedTest) return;
    const res = await fetch(`/api/tests/${selectedTest.id}/monitoring`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setMonitoringData(data);
  };

  const handleCreateTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const testData = {
      title: formData.get('title'),
      description: formData.get('description'),
      duration: parseInt(formData.get('duration') as string),
      totalPoints: parseInt(formData.get('totalPoints') as string),
      testDate: formData.get('testDate'),
      program: formData.get('program'),
      year: formData.get('year'),
      group_name: formData.get('group_name')
    };

    const res = await fetch('/api/tests', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    if (res.ok) {
      fetchTests();
      setView('LIST');
    }
  };

  const handleAddQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTest) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const qData = {
      content: formData.get('content'),
      type: formData.get('type'),
      points: parseInt(formData.get('points') as string),
      correct_answer: formData.get('correct_answer'),
      options: formData.get('type') === 'MCQ' ? (formData.get('options') as string).split(',').map(o => o.trim()) : null
    };

    const res = await fetch(`/api/tests/${selectedTest.id}/questions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(qData)
    });
    if (res.ok) {
      fetchQuestions(selectedTest.id);
      form.reset();
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!selectedTest) return;
    if (!confirm("A jeni i sigurt që dëshironi të fshini këtë pyetje?")) return;
    
    const res = await fetch(`/api/questions/${qId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchQuestions(selectedTest.id);
    }
  };

  const handleUpdateStatus = async (testId: number, status: string) => {
    const res = await fetch(`/api/tests/${testId}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchTests();
  };

  const handleJoinTest = async (test: Test) => {
    const res = await fetch(`/api/tests/${test.id}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const attempt = await res.json();
    setCurrentAttempt(attempt);
    setSelectedTest(test);
    await fetchQuestions(test.id);
    setTimeLeft(test.duration * 60);
    setView('TAKE');
  };

  const handleSubmitTest = async () => {
    if (!currentAttempt) return;
    
    // Save final answers
    await fetch(`/api/attempts/${currentAttempt.id}/save`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: Object.entries(answers).map(([qid, text]) => ({ questionId: parseInt(qid), answerText: text })) })
    });

    // Submit
    const res = await fetch(`/api/attempts/${currentAttempt.id}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setView('LIST');
      alert('Testi u dorëzua me sukses!');
    }
  };

  const fetchGradingDetails = async (attemptId: number) => {
    const res = await fetch(`/api/attempts/${attemptId}/details`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setGradingData(data);
    setView('GRADE');
  };

  const handleGradeAttempt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gradingData) return;
    const formData = new FormData(e.currentTarget);
    const grades = gradingData.answers.map(ans => ({
      answerId: ans.id,
      points: parseInt(formData.get(`points_${ans.id}`) as string),
      isCorrect: formData.get(`correct_${ans.id}`) === 'on'
    }));

    const res = await fetch(`/api/attempts/${gradingData.attempt.id}/grade`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        grades, 
        feedback: formData.get('feedback'),
        finalGrade: parseInt(formData.get('finalGrade') as string)
      })
    });
    if (res.ok) {
      fetchMonitoring();
      setView('MONITOR');
    }
  };

  // Timer logic
  useEffect(() => {
    if (view === 'TAKE' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (view === 'TAKE' && timeLeft === 0) {
      handleSubmitTest();
    }
  }, [view, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Moduli i Testimit</h2>
          <p className="text-slate-500">Menaxhoni dhe zhvilloni provimet në kohë reale</p>
        </div>
        {user.role === 'TEACHER' && view === 'LIST' && (
          <button 
            onClick={() => setView('CREATE')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center space-x-2 shadow-lg shadow-blue-100"
          >
            <Plus size={20} />
            <span>Krijo Test të Ri</span>
          </button>
        )}
        {view !== 'LIST' && view !== 'TAKE' && (
          <button 
            onClick={() => setView('LIST')}
            className="text-slate-500 hover:text-slate-900 flex items-center space-x-2 font-medium"
          >
            <ArrowLeft size={20} />
            <span>Kthehu te Lista</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'LIST' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {tests.map(test => (
              <div key={test.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    test.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 
                    test.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {test.status}
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 text-xs">
                    <Clock size={14} />
                    <span>{test.duration} min</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{test.title}</h3>
                <p className="text-sm text-slate-500 mb-6 flex-1">{test.description}</p>
                
                <div className="space-y-3 pt-4 border-t border-slate-50">
                  {user.role === 'TEACHER' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { 
                          setSelectedTest(test); 
                          fetchQuestions(test.id); 
                          setView('MONITOR'); 
                          fetchMonitoring(); 
                          fetchAnalytics();
                        }}
                        className="bg-slate-900 text-white p-2 rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center justify-center space-x-1"
                      >
                        <Eye size={14} />
                        <span>Monitoro</span>
                      </button>
                      <button 
                        onClick={() => { 
                          setSelectedTest(test); 
                          fetchQuestions(test.id); 
                          setView('ADD_QUESTIONS'); 
                        }}
                        className="bg-blue-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center space-x-1"
                      >
                        <Plus size={14} />
                        <span>Shto Pyetje</span>
                      </button>
                      {test.status === 'DRAFT' ? (
                        <button 
                          onClick={() => handleUpdateStatus(test.id, 'ACTIVE')}
                          className="bg-blue-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center space-x-1"
                        >
                          <Play size={14} />
                          <span>Shpërndaj</span>
                        </button>
                      ) : test.status === 'ACTIVE' ? (
                        <button 
                          onClick={() => handleUpdateStatus(test.id, 'COMPLETED')}
                          className="bg-orange-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-orange-700 flex items-center justify-center space-x-1"
                        >
                          <Pause size={14} />
                          <span>Mbyll</span>
                        </button>
                      ) : test.status === 'COMPLETED' ? (
                        <button 
                          onClick={() => handleUpdateStatus(test.id, 'PUBLISHED')}
                          className="bg-green-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center space-x-1"
                        >
                          <CheckCircle size={14} />
                          <span>Publiko</span>
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button 
                      disabled={test.status !== 'ACTIVE'}
                      onClick={() => handleJoinTest(test)}
                      className={`w-full p-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                        test.status === 'ACTIVE' 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Play size={18} />
                      <span>Prano Testin</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {user.role === 'STUDENT' && studentResults.length > 0 && (
              <div className="col-span-full mt-12">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Rezultatet e Publikuara</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {studentResults.map(res => (
                    <div key={res.id} className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 bg-green-50/30">
                      <div className="flex justify-between items-start mb-4">
                        <div className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-bold uppercase">I Publikuar</div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-900">{res.total_score}<span className="text-sm text-slate-400">/{res.total_points}</span></div>
                          {res.grade && <div className="text-sm font-bold text-blue-600">Nota: {res.grade}</div>}
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1">{res.title}</h4>
                      <p className="text-xs text-slate-500 mb-4">Dorëzuar më: {new Date(res.end_time!).toLocaleDateString()}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => fetchGradingDetails(res.id)}
                          className="bg-white text-slate-900 border border-slate-200 p-2 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all"
                        >
                          Detajet
                        </button>
                        <button 
                          onClick={() => generatePDF(res)}
                          className="bg-blue-600 text-white p-2 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all"
                        >
                          Shkarko PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === 'ADD_QUESTIONS' && selectedTest && (
          <motion.div 
            key="add-questions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Shto Pyetje: {selectedTest.title}</h3>
                  <p className="text-slate-500">Mund të shtoni deri në 100 pyetje për këtë test.</p>
                </div>
                <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold">
                  {questions.length} / 100 Pyetje
                </div>
              </div>

              <form onSubmit={handleAddQuestion} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pyetja</label>
                    <textarea 
                      name="content" 
                      required 
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                      placeholder="Shkruani përmbajtjen e pyetjes..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Lloji i Pyetjes</label>
                      <select 
                        name="type" 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="MCQ">Me Alternativa (Studenti zgjedh)</option>
                        <option value="OPEN">Me Shkrim (Studenti shkruan përgjigjen)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Pikët (1-10)</label>
                      <input 
                        name="points" 
                        type="number" 
                        min="1" 
                        max="10" 
                        required 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Pikët për këtë pyetje"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Opsionet (Vetëm për MCQ, ndarë me presje)</label>
                    <input 
                      name="options" 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="p.sh: Python, Java, C++, Ruby"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Përgjigja e Saktë</label>
                    <input 
                      name="correct_answer" 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Shkruani përgjigjen e saktë për referencë"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={questions.length >= 100}
                  className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {questions.length >= 100 ? 'Keni arritur limitin prej 100 pyetjesh' : 'Shto Pyetjen në Test'}
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Pyetjet e Shtuara</h3>
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">Pyetja {idx + 1}</span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded uppercase">{q.type}</span>
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{q.points} Pikë</span>
                      </div>
                      <p className="text-slate-700 font-medium">{q.content}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="text-center text-slate-500 italic py-8">Ende nuk ka pyetje për këtë test.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {view === 'CREATE' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-2xl mx-auto"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-6">Krijo Test të Ri</h3>
            <form onSubmit={handleCreateTest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titulli</label>
                  <input name="title" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Përshkrimi</label>
                  <textarea name="description" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-24" />
                </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dega</label>
                    <select name="program" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="BIOLOGJI">BIOLOGJI</option>
                      <option value="BIOTEKNOLOGJI">BIOTEKNOLOGJI</option>
                      <option value="KIMI">KIMI</option>
                      <option value="KIMI INDUSTRIALE DHE MJEDISORE">KIMI INDUSTRIALE DHE MJEDISORE</option>
                      <option value="FIZIKE">FIZIKE</option>
                      <option value="FIZIKE DHE SHKENCA KOMPJUTERIKE">FIZIKE DHE SHKENCA KOMPJUTERIKE</option>
                      <option value="MATEMATIKE">MATEMATIKE</option>
                      <option value="MATEMATIKE INFORMATIK">MATEMATIKE INFORMATIK</option>
                      <option value="TEKNOLOGJI INFORMACIONI DHE KOMUNIKIMI">TEKNOLOGJI INFORMACIONI DHE KOMUNIKIMI</option>
                      <option value="STATISTIKE">STATISTIKE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Viti</label>
                    <select name="year" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="VITI 1 BACHELORE">VITI 1 BACHELORE</option>
                      <option value="VITI 2 BACHELORE">VITI 2 BACHELORE</option>
                      <option value="VITI 3 BACHELORE">VITI 3 BACHELORE</option>
                      <option value="VITI 1 MASTER">VITI 1 MASTER</option>
                      <option value="VITI 2 MASTER">VITI 2 MASTER</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grupi</label>
                    <select name="group_name" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="A">Grupi A</option>
                      <option value="B">Grupi B</option>
                      <option value="C">Grupi C</option>
                    </select>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input name="testDate" type="datetime-local" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kohëzgjatja (Minuta)</label>
                  <input name="duration" type="number" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pikët Totale</label>
                  <input name="totalPoints" type="number" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all mt-4">
                Ruaj si Draft
              </button>
            </form>
          </motion.div>
        )}

        {view === 'MONITOR' && selectedTest && (
          <motion.div 
            key="monitor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Pjesëmarrës</p>
                <p className="text-2xl font-bold text-slate-900">{monitoringData.length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Dorëzuar</p>
                <p className="text-2xl font-bold text-green-600">{monitoringData.filter(p => p.status === 'SUBMITTED' || p.status === 'GRADED').length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Mesatarja</p>
                <p className="text-2xl font-bold text-blue-600">{analytics?.averageScore?.toFixed(1) || '-'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Kalueshmëria</p>
                <p className="text-2xl font-bold text-orange-600">{analytics?.passRate?.toFixed(0) || '-'}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Monitoring List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Monitorimi Live: {selectedTest.title}</h3>
                  <div className="space-y-4">
                    {monitoringData.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-4">
                          <MotionLogo size="sm" />
                          <div>
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-500">Filluar: {new Date(p.start_time).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'SUBMITTED' ? 'bg-green-100 text-green-600' : 
                            p.status === 'STARTED' ? 'bg-blue-100 text-blue-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {p.status}
                          </div>
                          {p.status === 'SUBMITTED' && (
                            <button 
                              onClick={() => fetchGradingDetails(p.attempt_id)}
                              className="text-blue-600 font-bold text-sm hover:underline"
                            >
                              Vlerëso
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {monitoringData.length === 0 && (
                      <p className="text-center text-slate-500 py-8 italic">Ende nuk ka nxënës pjesëmarrës.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Question Management */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Shto Pyetje</h3>
                  <form onSubmit={handleAddQuestion} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pyetja</label>
                      <textarea name="content" required className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lloji</label>
                        <select name="type" className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none">
                          <option value="MCQ">Alternativa</option>
                          <option value="OPEN">Hapur</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pikët</label>
                        <input name="points" type="number" required className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Opsionet (për MCQ, ndarë me presje)</label>
                      <input name="options" className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none" placeholder="A, B, C, D" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Përgjigja e Saktë</label>
                      <input name="correct_answer" className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm">
                      Shto Pyetjen
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Pyetjet e Shtuara ({questions.length})</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {questions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-blue-600">{q.points} Pikë</span>
                          <span className="text-slate-400 uppercase">{q.type}</span>
                        </div>
                        <p className="text-slate-700 line-clamp-2">{q.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'TAKE' && selectedTest && (
          <motion.div 
            key="take"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            {/* Sticky Timer */}
            <div className="sticky top-4 z-30 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-blue-100 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Timer size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koha e Mbetur</p>
                  <p className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                    {formatTime(timeLeft)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { if(confirm('Jeni të sigurt që dëshironi të dorëzoni testin?')) handleSubmitTest(); }}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Përfundo Testin
              </button>
            </div>

            <div className="space-y-8 pb-20">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                      Pyetja {idx + 1} • {q.points} Pikë
                    </span>
                  </div>
                  <h4 className="text-xl font-medium text-slate-900 mb-8 leading-relaxed">{q.content}</h4>
                  
                  {q.type === 'MCQ' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {JSON.parse(q.options || '[]').map((opt: string, oIdx: number) => (
                        <button
                          key={oIdx}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center space-x-4 ${
                            answers[q.id] === opt 
                            ? 'border-blue-600 bg-blue-50 text-blue-700' 
                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            answers[q.id] === opt ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </div>
                          <span className="font-medium">{opt}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea 
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-blue-600 outline-none h-40 text-slate-700 leading-relaxed transition-all"
                      placeholder="Shkruani përgjigjen tuaj këtu..."
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {view === 'GRADE' && gradingData && (
          <motion.div 
            key="grade"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Vlerësimi: {gradingData.attempt.student_name}</h3>
                  <p className="text-slate-500">{gradingData.attempt.test_title}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statusi</p>
                  <p className="font-bold text-blue-600 uppercase">{gradingData.attempt.status}</p>
                </div>
              </div>

              <form onSubmit={handleGradeAttempt} className="space-y-12">
                {gradingData.answers.map((ans, idx) => (
                  <div key={ans.id} className="space-y-4 pb-8 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Pyetja {idx + 1} ({ans.max_points} Pikë)</span>
                      {ans.question_type === 'MCQ' && (
                        <span className={`text-xs font-bold px-2 py-1 rounded ${ans.answer_text === ans.correct_answer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {ans.answer_text === ans.correct_answer ? 'Auto: Saktë' : 'Auto: Gabim'}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-slate-900">{ans.question_text}</p>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Përgjigja e Nxënësit</p>
                      <p className="text-slate-700">{ans.answer_text || <span className="italic text-red-400">Nuk ka përgjigje</span>}</p>
                    </div>
                    {ans.correct_answer && (
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                        <p className="text-xs font-bold text-green-600 uppercase mb-2">Përgjigja e Saktë</p>
                        <p className="text-green-700">{ans.correct_answer}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-6 pt-2">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-bold text-slate-700">Pikët:</label>
                        <input 
                          type="number" 
                          name={`points_${ans.id}`}
                          defaultValue={ans.answer_text === ans.correct_answer ? ans.max_points : 0}
                          max={ans.max_points}
                          className="w-20 p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" name={`correct_${ans.id}`} defaultChecked={ans.answer_text === ans.correct_answer} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm font-medium text-slate-700">E Saktë</span>
                      </label>
                    </div>
                  </div>
                ))}

                <div className="space-y-6 pt-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Nota Përfundimtare (4-10)</label>
                      <select name="finalGrade" required className="w-full p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg">
                        {[4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Feedback i Përgjithshëm</label>
                      <textarea name="feedback" className="w-full p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 h-24" placeholder="Shkruani komentet tuaja këtu..." />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-lg">
                    Përfundo Vlerësimin & Publiko Rezultatin
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
