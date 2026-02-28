import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, User, Hash, Search, MoreVertical } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

export default function Chat({ user, token }: { user: any, token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatType, setChatType] = useState<'CLASS' | 'SCHOOL'>('CLASS');
  const scrollRef = useRef<HTMLDivElement>(null);

  const BANNED_WORDS = ['budalla', 'idiot', 'pis', 'rrugaç', 'shëmtuar']; // Simplified list

  useEffect(() => {
    fetchMessages();
    const s = io();
    setSocket(s);
    s.emit('join', { id: user.id, name: user.name, role: user.role });

    s.on('new_message', (msg: any) => {
      if (msg.chatType === chatType) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => { s.disconnect(); };
  }, [user, chatType]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat/messages?type=${chatType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
    } catch (e) { console.error(e); }
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
      senderName: user.name,
      content: filteredContent,
      chatType: chatType,
      timestamp: new Date().toISOString()
    };

    socket.emit('send_message', msg);
    setInput('');
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Kërko biseda..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Kanalet</h4>
            <button 
              onClick={() => setChatType('CLASS')}
              className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${chatType === 'CLASS' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Hash size={18} />
              <span>Klasa {user.program}</span>
            </button>
            <button 
              onClick={() => setChatType('SCHOOL')}
              className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${chatType === 'SCHOOL' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Hash size={18} />
              <span>FSHN School Chat</span>
            </button>
          </div>
          <div className="p-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Bisedat Private</h4>
            {[1, 2, 3].map((_, i) => (
              <button key={i} className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs">
                  M
                </div>
                <span className="text-sm text-slate-700">Mësuesi i Lëndës</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Hash size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{chatType === 'CLASS' ? `Klasa ${user.program}` : 'FSHN School Chat'}</h3>
              <p className="text-xs text-green-500 font-medium">Aktiv tani</p>
            </div>
          </div>
          <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <MoreVertical size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.senderId === user.id ? 'order-1' : 'order-2'}`}>
                <div className={`p-4 rounded-2xl shadow-sm ${
                  msg.senderId === user.id 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                }`}>
                  {msg.senderId !== user.id && (
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">{msg.senderName}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
                <p className={`text-[10px] text-slate-400 mt-1 ${msg.senderId === user.id ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-100">
          <form onSubmit={sendMessage} className="flex items-center space-x-4">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Shkruani një mesazh..."
              className="flex-1 p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
