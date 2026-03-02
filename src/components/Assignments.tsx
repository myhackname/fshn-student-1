import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Calendar, Plus, Send, FileText, User, 
  Clock, CheckCircle, Upload, File, BarChart2, 
  AlertCircle, TrendingUp, Check, X, Download, Eye
} from 'lucide-react';
import MotionLogo from './MotionLogo';
import { Assignment, Submission } from '../types';

export default function Assignments({ user, token }: { user: any, token: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submissionContent, setSubmissionContent] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [newAssignment, setNewAssignment] = useState({ 
    title: '', 
    description: '', 
    deadline: '', 
    materials: '',
    maxPoints: 100,
    submissionType: 'BOTH' as 'FILE' | 'TEXT' | 'BOTH',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
    program: 'BIOLOGJI',
    year: 'VITI 1 BACHELORE',
    group_name: 'A'
  });
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [view, setView] = useState<'LIST' | 'ANALYTICS'>('LIST');
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchAssignments();
    if (user.role === 'STUDENT') fetchMySubmissions();
  }, []);

  const fetchMySubmissions = async () => {
    const res = await fetch('/api/my-submissions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMySubmissions(data);
  };

  const fetchAssignments = async () => {
    const res = await fetch('/api/assignments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setAssignments(data);
  };

  const fetchSubmissions = async (assignmentId: number) => {
    const res = await fetch(`/api/assignments/${assignmentId}/submissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setSubmissions(data);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newAssignment)
    });
    if (res.ok) {
      setShowCreateModal(false);
      setNewAssignment({ 
        title: '', description: '', deadline: '', materials: '', 
        maxPoints: 100, submissionType: 'BOTH', status: 'DRAFT',
        program: 'BIOLOGJI', year: 'VITI 1 BACHELORE', group_name: 'A'
      });
      fetchAssignments();
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    const formData = new FormData();
    formData.append('content', submissionContent);
    if (submissionFile) {
      formData.append('file', submissionFile);
    }

    const res = await fetch(`/api/assignments/${selectedAssignment.id}/submit`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (res.ok) {
      setSubmissionContent('');
      setSubmissionFile(null);
      setSelectedAssignment(null);
      alert('Detyra u dorëzua me sukses!');
      if (user.role === 'STUDENT') fetchMySubmissions();
    }
  };

  const handleGradeSubmission = async (subId: number, points: number, feedback: string, grade: number) => {
    const res = await fetch(`/api/submissions/${subId}/grade`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ points, feedback, grade })
    });
    if (res.ok && selectedAssignment) {
      fetchSubmissions(selectedAssignment.id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">📚 Detyra</h2>
          <p className="text-slate-500">Menaxhimi intuitiv i detyrave dhe dorëzimeve</p>
        </div>
        <div className="flex space-x-3">
          {user.role === 'TEACHER' && (
            <>
              <button 
                onClick={() => setView(view === 'LIST' ? 'ANALYTICS' : 'LIST')}
                className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 flex items-center space-x-2 shadow-sm"
              >
                <BarChart2 size={20} />
                <span>{view === 'LIST' ? 'Analitika' : 'Lista'}</span>
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center space-x-2 shadow-lg shadow-blue-100"
              >
                <Plus size={20} />
                <span>Krijo Detyrë të Re</span>
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'LIST' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              {assignments.map((assignment) => (
                <div 
                  key={assignment.id}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-bold text-slate-900">{assignment.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            assignment.status === 'PUBLISHED' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {assignment.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">Pikët: <span className="font-bold text-slate-700">{assignment.max_points}</span> • Lloji: {assignment.submission_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Afati</p>
                      <div className="flex items-center space-x-1 text-orange-600 font-semibold">
                        <Calendar size={14} />
                        <span className="text-sm">{new Date(assignment.deadline).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">{assignment.description}</p>
                  
                  {assignment.materials && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Materiale Bashkëngjitur</p>
                      <div className="flex items-center space-x-2 text-blue-600">
                        <FileText size={16} />
                        <a href="#" className="text-sm font-medium hover:underline">{assignment.materials}</a>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-slate-400">Krijuar: {new Date(assignment.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex space-x-3">
                      {user.role === 'TEACHER' ? (
                        <button 
                          onClick={() => {
                            setSelectedAssignment(assignment);
                            fetchSubmissions(assignment.id);
                          }}
                          className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition-all flex items-center space-x-2"
                        >
                          <Eye size={16} />
                          <span>Shiko Dorëzimet</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => setSelectedAssignment(assignment)}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-all flex items-center space-x-2 shadow-lg shadow-blue-100"
                        >
                          <Send size={16} />
                          <span>Dorëzo Detyrën</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Statusi i Detyrave</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                        <CheckCircle size={18} />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Të Dorëzuara</span>
                    </div>
                    <span className="font-bold text-slate-900">{mySubmissions.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Clock size={18} />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Në Pritje</span>
                    </div>
                    <span className="font-bold text-slate-900">{assignments.length - mySubmissions.length}</span>
                  </div>
                </div>
              </div>

              {user.role === 'STUDENT' && mySubmissions.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Vlerësimet e Fundit</h4>
                  <div className="space-y-3">
                    {mySubmissions.filter(s => s.status === 'GRADED').map(sub => (
                      <div key={sub.id} className="p-4 rounded-xl border border-slate-100 bg-blue-50/30">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-bold text-slate-900 truncate flex-1 mr-2">{sub.assignment_title}</p>
                          <span className="text-xs font-bold text-blue-600">{sub.points} Pikë</span>
                        </div>
                        {sub.feedback && <p className="text-[10px] text-slate-500 italic line-clamp-2">"{sub.feedback}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="analytics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Placeholder for Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900">Mesatarja e Klasës</h4>
                </div>
                <p className="text-3xl font-bold text-slate-900">84.5%</p>
                <p className="text-xs text-green-600 mt-2 flex items-center">
                  <TrendingUp size={12} className="mr-1" /> +5% nga muaji i kaluar
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                    <Check size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900">Dorëzimet në Kohë</h4>
                </div>
                <p className="text-3xl font-bold text-slate-900">92%</p>
                <p className="text-xs text-slate-500 mt-2">Bazuar në 150 dorëzime</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <AlertCircle size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900">Vonesat</h4>
                </div>
                <p className="text-3xl font-bold text-slate-900">8%</p>
                <p className="text-xs text-red-600 mt-2">12 nxënës me vonesa</p>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Progresi Mujor i Klasës</h3>
              <div className="h-64 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
                <p className="text-slate-400 italic">Grafiku i progresit do të shfaqet këtu (Recharts/D3)</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Assignment Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-slate-900">➕ Krijo Detyrë të Re</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateAssignment} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Titulli i Detyrës</label>
                    <input 
                      type="text" 
                      value={newAssignment.title}
                      onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Psh: Analiza e Regresionit"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Përshkrimi</label>
                    <textarea 
                      value={newAssignment.description}
                      onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 transition-all"
                      placeholder="Shpjegoni detajet e detyrës..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Afati i Dorëzimit</label>
                    <input 
                      type="datetime-local" 
                      value={newAssignment.deadline}
                      onChange={(e) => setNewAssignment({...newAssignment, deadline: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pikët Maksimale</label>
                    <input 
                      type="number" 
                      value={newAssignment.maxPoints}
                      onChange={(e) => setNewAssignment({...newAssignment, maxPoints: parseInt(e.target.value)})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Mënyra e Dorëzimit</label>
                    <select 
                      value={newAssignment.submissionType}
                      onChange={(e) => setNewAssignment({...newAssignment, submissionType: e.target.value as any})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="BOTH">Të dyja (File & Tekst)</option>
                      <option value="FILE">Vetëm File</option>
                      <option value="TEXT">Vetëm Tekst</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Dega</label>
                    <select 
                      value={newAssignment.program}
                      onChange={(e) => setNewAssignment({...newAssignment, program: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
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
                    <label className="block text-sm font-bold text-slate-700 mb-2">Viti</label>
                    <select 
                      value={newAssignment.year}
                      onChange={(e) => setNewAssignment({...newAssignment, year: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="VITI 1 BACHELORE">VITI 1 BACHELORE</option>
                      <option value="VITI 2 BACHELORE">VITI 2 BACHELORE</option>
                      <option value="VITI 3 BACHELORE">VITI 3 BACHELORE</option>
                      <option value="VITI 1 MASTER">VITI 1 MASTER</option>
                      <option value="VITI 2 MASTER">VITI 2 MASTER</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Grupi</label>
                    <select 
                      value={newAssignment.group_name}
                      onChange={(e) => setNewAssignment({...newAssignment, group_name: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="A">Grupi A</option>
                      <option value="B">Grupi B</option>
                      <option value="C">Grupi C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Statusi Fillestar</label>
                    <select 
                      value={newAssignment.status}
                      onChange={(e) => setNewAssignment({...newAssignment, status: e.target.value as any})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Publiko Menjëherë</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Materiale / Linke (PDF, Dokumente)</label>
                    <input 
                      type="text" 
                      value={newAssignment.materials}
                      onChange={(e) => setNewAssignment({...newAssignment, materials: e.target.value})}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Psh: https://link-to-pdf.com ose emri i dokumentit"
                    />
                  </div>
                </div>
                <div className="flex space-x-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all border border-slate-200"
                  >
                    Anulo
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    Krijo Detyrën
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Submit/View Submissions Modal */}
      <AnimatePresence>
        {selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {user.role === 'TEACHER' ? `Dorëzimet: ${selectedAssignment.title}` : `Dorëzo: ${selectedAssignment.title}`}
                  </h3>
                  <p className="text-sm text-slate-500">Afati: {new Date(selectedAssignment.deadline).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedAssignment(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              {user.role === 'TEACHER' ? (
                <div className="space-y-8">
                  {/* Assignment Specific Analytics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Mesatarja</p>
                      <p className="text-xl font-bold text-blue-900">
                        {submissions.filter(s => s.status === 'GRADED').length > 0 
                          ? (submissions.filter(s => s.status === 'GRADED').reduce((acc, curr) => acc + (curr.points || 0), 0) / submissions.filter(s => s.status === 'GRADED').length).toFixed(1)
                          : '0'}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                      <p className="text-[10px] font-bold text-green-400 uppercase mb-1">Dorëzime</p>
                      <p className="text-xl font-bold text-green-900">{submissions.length}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Vonesa</p>
                      <p className="text-xl font-bold text-red-900">{submissions.filter(s => s.is_late).length}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                  {submissions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText size={32} />
                      </div>
                      <p className="text-slate-500 italic">Ende nuk ka dorëzime për këtë detyrë.</p>
                    </div>
                  ) : (
                    submissions.map((sub) => (
                      <div key={sub.id} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <MotionLogo size="sm" />
                            <div>
                              <p className="font-bold text-slate-900">{sub.student_name}</p>
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] text-slate-400">{new Date(sub.submitted_at).toLocaleString()}</span>
                                {sub.is_late && <span className="text-[10px] font-bold text-red-500 uppercase">Me Vonesë</span>}
                              </div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                            sub.status === 'GRADED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {sub.status}
                          </div>
                        </div>

                        {sub.content && (
                          <div className="bg-white p-4 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {sub.content}
                          </div>
                        )}
                        
                        {sub.file_path && (
                          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100">
                            <div className="flex items-center space-x-3">
                              <File size={20} className="text-blue-600" />
                              <span className="text-sm font-medium text-slate-700">Dokumenti i Ngarkuar</span>
                            </div>
                            <a 
                              href={sub.file_path} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-bold text-sm"
                            >
                              <Download size={16} />
                              <span>Shkarko</span>
                            </a>
                          </div>
                        )}
                        
                        <div className="pt-4 border-t border-slate-200">
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            handleGradeSubmission(
                              sub.id, 
                              parseInt(formData.get('points') as string), 
                              formData.get('feedback') as string,
                              parseInt(formData.get('grade') as string)
                            );
                          }} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="md:col-span-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pikët (Max {selectedAssignment.max_points})</label>
                              <input 
                                type="number" 
                                name="points"
                                defaultValue={sub.points || ''}
                                max={selectedAssignment.max_points}
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="0"
                                required
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nota (4-10)</label>
                              <select 
                                name="grade"
                                defaultValue={sub.grade || 5}
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                                required
                              >
                                {[4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Feedback / Koment</label>
                              <input 
                                type="text" 
                                name="feedback"
                                defaultValue={sub.feedback || ''}
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Shkruani feedback..."
                              />
                            </div>
                            <div className="md:col-span-1 flex items-end">
                              <button 
                                type="submit"
                                className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm flex items-center justify-center space-x-2"
                              >
                                <Check size={16} />
                                <span>Ruaj</span>
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h4 className="font-bold text-blue-900 mb-2">Udhëzime për Dorëzim</h4>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      Kjo detyrë pranon {selectedAssignment.submission_type === 'BOTH' ? 'të dyja formatet (tekst dhe skedar)' : selectedAssignment.submission_type === 'FILE' ? 'vetëm skedarë' : 'vetëm tekst'}. 
                      Ju lutem sigurohuni që dorëzimi juaj të jetë i plotë përpara se të klikoni butonin "Dorëzo Tani".
                    </p>
                  </div>

                  <form onSubmit={handleSubmitAssignment} className="space-y-6">
                    {(selectedAssignment.submission_type === 'TEXT' || selectedAssignment.submission_type === 'BOTH') && (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Përgjigja juaj me shkrim</label>
                        <textarea 
                          value={submissionContent}
                          onChange={(e) => setSubmissionContent(e.target.value)}
                          className="w-full p-6 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-48 text-slate-700 leading-relaxed transition-all"
                          placeholder="Shkruani përgjigjen tuaj këtu..."
                          required={selectedAssignment.submission_type === 'TEXT'}
                        />
                      </div>
                    )}
                    
                    {(selectedAssignment.submission_type === 'FILE' || selectedAssignment.submission_type === 'BOTH') && (
                      <div className="relative group">
                        <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center space-y-4 group-hover:border-blue-400 transition-all">
                          <div className="p-4 bg-white rounded-2xl shadow-sm">
                            <Upload size={32} className="text-blue-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">Ngarko Skedar</p>
                            <p className="text-sm text-slate-500 mt-1">PDF, Word, Excel, ZIP ose Imazh</p>
                          </div>
                          <input 
                            type="file" 
                            onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            required={selectedAssignment.submission_type === 'FILE'}
                          />
                        </div>
                        {submissionFile && (
                          <div className="mt-4 flex items-center justify-between bg-blue-600 text-white p-4 rounded-2xl shadow-lg animate-in slide-in-from-top-2">
                            <div className="flex items-center space-x-3">
                              <File size={20} />
                              <span className="text-sm font-bold truncate max-w-[200px]">{submissionFile.name}</span>
                            </div>
                            <button onClick={() => setSubmissionFile(null)} className="p-1 hover:bg-white/20 rounded-full">
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center space-x-3 shadow-xl shadow-blue-100"
                    >
                      <Send size={24} />
                      <span className="text-lg">Dorëzo Tani</span>
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
