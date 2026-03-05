import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Hash, Search, MoreVertical, MessageSquare } from 'lucide-react';
import MotionLogo from './MotionLogo';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

export default function Chat({ user, token }: { user: any, token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatType, setChatType] = useState<'CLASS' | 'SCHOOL'>('CLASS');
  const [classMembers, setClassMembers] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const BANNED_WORDS = ['budalla', 'idiot', 'pis', 'rrugaç', 'shëmtuar']; // Simplified list

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
    fetchClassMembers();
    const s = io();
    setSocket(s);
    s.emit('join', { id: user.id, name: user.name, role: user.role });

    s.on('new_message', (msg: any) => {
      if (msg.chatType === chatType) {
        setMessages(prev => [...prev, msg]);
      }
    });

    s.on('user_status', (onlineUsers: any[]) => {
      const onlineIds = new Set(onlineUsers.map(u => u.id));
      setClassMembers(prev => prev.map(m => ({
        ...m,
        isOnline: onlineIds.has(m.id)
      })));
    });

    return () => { s.disconnect(); };
  }, [user, chatType]);

  const fetchClassMembers = async () => {
    try {
      const res = await fetch('/api/class/members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setClassMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat/messages?type=${chatType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error(e);
      setMessages([]);
    }
  };

  const filterProfanity = (text: string) => {
    let filtered = text;
    BANNED_WORDS.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '***');
    });
    return filtered;
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const filteredContent = filterProfanity(input);

    const msg = {
      senderId: user.id,
      senderName: `${user.name} ${user.surname}`,
      content: filteredContent,
      chatType: chatType,
      timestamp: new Date().toISOString()
    };

    socket.emit('send_message', msg);
    setInput('');
  };

  return (
    <div className="h-[calc(100vh-13rem)] md:h-[calc(100vh-12rem)] flex bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <div className={`
        absolute md:relative inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col z-50 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            Bisedat
          </h3>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-xl">
            <Hash size={18} />
          </button>
        </div>
        
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Kërko..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 border border-transparent focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 px-2">Kanalet</h4>
            <button 
              onClick={() => { setChatType('CLASS'); setShowSidebar(false); }}
              className={`w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all ${chatType === 'CLASS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Hash size={18} className={chatType === 'CLASS' ? 'text-white' : 'text-slate-400'} />
              <span className="truncate">Klasa {user.program}</span>
            </button>
            <button 
              onClick={() => { setChatType('SCHOOL'); setShowSidebar(false); }}
              className={`w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all ${chatType === 'SCHOOL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Hash size={18} className={chatType === 'SCHOOL' ? 'text-white' : 'text-slate-400'} />
              <span className="truncate">FSHN Chat</span>
            </button>
          </div>

          <div className="p-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 px-2">Anëtarët</h4>
            <div className="space-y-1">
              {classMembers.map((member) => (
                <div key={member.id} className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs overflow-hidden border-2 border-white shadow-sm">
                        {member.profile_photo ? (
                          <img src={member.profile_photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          member.name.charAt(0)
                        )}
                      </div>
                      {member.isOnline && (
                        <div className="absolute -right-0.5 -bottom-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{member.name} {member.surname}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{member.role === 'TEACHER' ? 'Mësues' : 'Student'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/50 w-full min-w-0">
        <div className="p-4 md:p-5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3 min-w-0">
            <button 
              onClick={() => setShowSidebar(true)}
              className="md:hidden p-2.5 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <MoreVertical size={20} className="rotate-90" />
            </button>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hidden sm:block">
              <Hash size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate text-base md:text-lg">
                {chatType === 'CLASS' ? `Klasa ${user.program}` : 'FSHN School Chat'}
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aktiv tani</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
              <Search size={20} />
            </button>
            <button className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-60">
              <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
                <MessageSquare size={40} />
              </div>
              <p className="text-sm font-medium">Filloni një bisedë të re...</p>
            </div>
          )}
          
          {messages.map((msg, i) => {
            const isMe = msg.senderId === user.id;
            const showAvatar = i === 0 || messages[i-1].senderId !== msg.senderId;
            
            return (
              <div key={i} className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <div className="w-8 h-8 flex-shrink-0 mb-1">
                    {showAvatar ? (
                      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-500 font-bold text-[10px] overflow-hidden border border-slate-200 shadow-sm">
                        {msg.senderPhoto ? (
                          <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          msg.senderName?.charAt(0) || 'U'
                        )}
                      </div>
                    ) : <div className="w-8" />}
                  </div>
                )}
                
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                  {showAvatar && !isMe && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1">
                      {msg.senderName}
                    </span>
                  )}
                  <div className={`group relative p-3.5 md:p-4 rounded-2xl shadow-sm transition-all hover:shadow-md ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                  }`}>
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className={`text-[9px] font-bold text-slate-400 mt-1.5 px-1 uppercase tracking-tighter ${isMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {isMe && (
                  <div className="w-8 h-8 flex-shrink-0 mb-1">
                    {showAvatar ? (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-[10px] overflow-hidden border border-blue-200 shadow-sm">
                        {user.profile_photo ? (
                          <img src={user.profile_photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          user.name?.charAt(0) || 'U'
                        )}
                      </div>
                    ) : <div className="w-8" />}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 md:p-6 bg-white border-t border-slate-100">
          <form onSubmit={sendMessage} className="flex items-center gap-3">
            <div className="flex-1 relative group">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Shkruani një mesazh..."
                className="w-full p-4 md:p-5 bg-slate-50 rounded-[1.5rem] text-sm outline-none focus:ring-4 focus:ring-blue-500/10 border border-transparent focus:border-blue-500/30 transition-all pr-14"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-300 group-focus-within:text-blue-400 transition-colors">
                <Hash size={18} />
              </div>
            </div>
            <button 
              disabled={!input.trim()}
              className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-blue-600 text-white rounded-[1.5rem] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-40 disabled:shadow-none disabled:grayscale active:scale-95"
            >
              <Send size={24} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
