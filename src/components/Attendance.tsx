import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, UserCheck, Users, Play, Square, Clock, AlertCircle, Calendar } from 'lucide-react';
import MotionLogo from './MotionLogo';
import { io, Socket } from 'socket.io-client';

export default function Attendance({ user, token }: { user: any, token: string }) {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(60);
  const [classId, setClassId] = useState<number | ''>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveSession();
    if (user.role === 'TEACHER') fetchClasses();
    
    const s = io();
    setSocket(s);
    s.emit('join', { id: user.id, name: user.name, role: user.role });

    s.on('study_session_start', (data: any) => {
      fetchActiveSession();
    });

    s.on('study_session_warning', (data: any) => {
      setWarning(data.message);
      setTimeout(() => setWarning(null), 10000);
    });

    s.on('study_session_end', (data: any) => {
      setActiveSession(null);
      setTimeLeft(null);
      if (data.auto) {
        alert("Ora përfundoi automatikisht.");
      }
    });

    s.on('presence_confirmed', (data: any) => {
      setActiveSession((prev: any) => {
        if (!prev || prev.id !== data.sessionId) return prev;
        return {
          ...prev,
          presence: [...(prev.presence || []), { userId: data.userId, userName: data.userName, is_verified: 0 }]
        };
      });
    });

    s.on('presence_verified', (data: any) => {
      setActiveSession((prev: any) => {
        if (!prev || prev.id !== data.sessionId) return prev;
        return {
          ...prev,
          presence: prev.presence.map((p: any) => p.userId === data.userId ? { ...p, is_verified: 1 } : p)
        };
      });
    });

    return () => { s.disconnect(); };
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession && activeSession.status === 'ACTIVE') {
      const startTime = new Date(activeSession.created_at).getTime();
      const endTime = startTime + activeSession.duration * 60 * 1000;
      
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(diff);
        if (diff === 0) {
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setClasses(data);
      } else {
        console.error("Expected array for classes, got:", data);
        setClasses([]);
      }
    } catch (e) { 
      console.error(e);
      setClasses([]);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const res = await fetch('/api/study/active', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setActiveSession(data);
    } catch (e) { console.error(e); }
  };

  const startSession = async () => {
    if (!classId || !subject) return alert("Plotësoni të gjitha fushat");
    setLoading(true);
    try {
      await fetch('/api/study/start', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ classId, subject, duration })
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const endSession = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await fetch('/api/study/end', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: activeSession.id })
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const confirmPresence = async () => {
    try {
      await fetch('/api/study/confirm', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: activeSession.id })
      });
    } catch (e) { console.error(e); }
  };

  const verifyPresence = async (userId: number) => {
    try {
      await fetch('/api/study/verify', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: activeSession.id, userId })
      });
    } catch (e) { console.error(e); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-8">
      {warning && (
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-20 right-4 z-50 bg-orange-500 text-white p-4 rounded-2xl shadow-xl flex items-center space-x-3"
        >
          <Clock className="animate-pulse" />
          <span className="font-bold">{warning}</span>
        </motion.div>
      )}

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Prezenca Digjitale</h2>
            <p className="text-slate-500">
              {activeSession 
                ? `Mësimi: ${activeSession.subject} (${activeSession.teacherName || 'Ju'})` 
                : 'Nuk ka asnjë sesion mësimi aktiv për momentin.'}
            </p>
          </div>
          
          {activeSession && timeLeft !== null && (
            <div className="flex items-center space-x-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
              <Clock size={20} className={timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-blue-500'} />
              <span className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-slate-700'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>

        {user.role === 'TEACHER' ? (
          !activeSession ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Klasa</label>
                <select 
                  value={classId}
                  onChange={(e) => setClassId(Number(e.target.value))}
                  className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Zgjidh Klasën</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lënda</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="P.sh. Analitika"
                  className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Kohëzgjatja (min)</label>
                <input 
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button 
                onClick={startSession}
                disabled={loading}
                className="bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center space-x-2"
              >
                <Users size={20} />
                <span>Fillo Mësimin</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={endSession}
              disabled={loading}
              className="w-full bg-red-600 text-white p-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center space-x-2"
            >
              <XCircle size={20} />
              <span>Mbyll Mësimin Manualisht</span>
            </button>
          )
        ) : (
          activeSession && !activeSession.presence?.find((p: any) => p.userId === user.id) && (
            <button 
              onClick={confirmPresence}
              className="w-full bg-green-600 text-white p-4 rounded-2xl font-bold hover:bg-green-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-100"
            >
              <UserCheck size={20} />
              <span>Konfirmo Prezencën (Vetëm 1 herë)</span>
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-8">Pjesëmarrësit në Sesion</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!activeSession?.presence || activeSession.presence.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-2xl">
                Nuk ka ende studentë të konfirmuar.
              </div>
            ) : (
              activeSession.presence.map((p: any) => (
                <div key={p.userId} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
                  <div className="flex items-center space-x-3">
                    <MotionLogo size="sm" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.userName}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {p.is_verified ? 'I Verifikuar' : 'Në Pritje'}
                      </p>
                    </div>
                  </div>
                  {user.role === 'TEACHER' && !p.is_verified && (
                    <button 
                      onClick={() => verifyPresence(p.userId)}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {p.is_verified && <CheckCircle size={20} className="text-green-500" />}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Statistikat e Pjesëmarrjes</h3>
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Pjesëmarrja Ditore</p>
              <div className="flex items-end space-x-2">
                <span className="text-2xl font-bold text-slate-900">88%</span>
                <span className="text-green-500 text-xs font-medium mb-1">+2% nga dje</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full mt-3">
                <div className="bg-green-500 h-2 rounded-full w-[88%]"></div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Pjesëmarrja Mujore</p>
              <div className="flex items-end space-x-2">
                <span className="text-2xl font-bold text-slate-900">92%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full mt-3">
                <div className="bg-blue-500 h-2 rounded-full w-[92%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
