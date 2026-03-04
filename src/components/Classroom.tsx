import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Search, Mail, Phone, MessageSquare, CheckCircle, Clock } from 'lucide-react';
import MotionLogo from './MotionLogo';
import { io, Socket } from 'socket.io-client';

export default function Classroom({ user, token }: { user: any, token: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    fetchMembers();
    const s = io();
    setSocket(s);
    s.emit('join', { id: user.id, name: user.name, role: user.role });

    s.on('user_status', (onlineUsers: any[]) => {
      const onlineIds = new Set(onlineUsers.map(u => u.id));
      setMembers(prev => prev.map(m => ({
        ...m,
        isOnline: onlineIds.has(m.id)
      })));
    });

    return () => { s.disconnect(); };
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/class/members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(m => 
    `${m.name} ${m.surname}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">🏫 Klasa Ime</h2>
          <p className="text-slate-500">{user.program} • {user.year} • Grupi {user.group_name}</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Kërko shokët e klasës..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <motion.div 
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="relative">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-bold text-xl overflow-hidden">
                    {member.profile_photo ? (
                      <img src={member.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.name.charAt(0)
                    )}
                  </div>
                  {member.isOnline && (
                    <div className="absolute -right-1 -bottom-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                    <MessageSquare size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                    <Phone size={18} />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {member.name} {member.surname}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  {member.role === 'TEACHER' ? 'Mësues i Lëndës' : 'Student'}
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-600">
                    <Mail size={14} className="mr-2 opacity-40" />
                    <span className="truncate">{member.email || 'student@fshn.edu.al'}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <CheckCircle size={14} className="mr-2 opacity-40 text-green-500" />
                    <span>I Verifikuar</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <Clock size={12} className="mr-1" />
                  {member.isOnline ? 'Aktiv Tani' : 'Jashtë Linje'}
                </div>
                <button className="text-xs font-bold text-blue-600 hover:underline">
                  Shiko Profilin
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filteredMembers.length === 0 && !loading && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <Users size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500">Nuk u gjet asnjë anëtar me këtë emër.</p>
        </div>
      )}
    </div>
  );
}
