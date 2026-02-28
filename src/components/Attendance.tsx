import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, UserCheck, Users } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export default function Attendance({ user, token }: { user: any, token: string }) {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveSession();
    const s = io();
    setSocket(s);
    s.emit('join', { id: user.id, name: user.name, role: user.role });

    s.on('study_session_start', (data: any) => {
      fetchActiveSession();
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

  const fetchActiveSession = async () => {
    try {
      const res = await fetch('/api/study/active', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setActiveSession(data);
    } catch (e) { console.error(e); }
  };

  const startSession = async () => {
    setLoading(true);
    try {
      await fetch('/api/study/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
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

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Prezenca Digjitale</h2>
          <p className="text-slate-500">
            {activeSession 
              ? `Mësimi është aktiv (ID: ${activeSession.id})` 
              : 'Nuk ka asnjë sesion mësimi aktiv për momentin.'}
          </p>
        </div>
        
        {user.role === 'TEACHER' ? (
          <button 
            onClick={startSession}
            disabled={loading || activeSession}
            className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center space-x-2 shadow-lg ${activeSession ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}
          >
            <Users size={20} />
            <span>Fillo Mësimin</span>
          </button>
        ) : (
          activeSession && !activeSession.presence?.find((p: any) => p.userId === user.id) && (
            <button 
              onClick={confirmPresence}
              className="bg-green-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-700 transition-all flex items-center space-x-2 shadow-lg shadow-green-100"
            >
              <UserCheck size={20} />
              <span>Konfirmo Prezencën</span>
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
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${p.is_verified ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {p.userName[0]}
                    </div>
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
