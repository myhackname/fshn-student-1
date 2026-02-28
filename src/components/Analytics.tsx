import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, BookOpen, Clock, Target, 
  Award, Calendar, ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function Analytics({ user, token }: { user: any, token: string }) {
  const [studentData, setStudentData] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (user.role === 'STUDENT') {
        const res = await fetch('/api/analytics/student/me', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        setStudentData(data);
      } else {
        const res = await fetch('/api/analytics/class', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        setClassData(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">📊 Analitika e Performancës</h2>
        <p className="text-slate-500">Ndjekja e progresit dhe rezultateve në kohë reale</p>
      </div>

      {user.role === 'STUDENT' ? (
        <div className="space-y-8">
          {/* Student Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Mesatarja Totale</p>
              <p className="text-3xl font-bold text-slate-900">
                {studentData?.logs?.length > 0 
                  ? (studentData.logs.reduce((acc: number, curr: any) => acc + (curr.max_score > 0 ? (curr.score / curr.max_score) : 0), 0) / studentData.logs.length * 100).toFixed(1)
                  : '0'}%
              </p>
              <div className="mt-2 flex items-center text-xs text-green-600">
                <ArrowUpRight size={14} className="mr-1" /> +2.4% këtë muaj
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Detyra të Dorëzuara</p>
              <p className="text-3xl font-bold text-slate-900">
                {studentData?.logs?.filter((l: any) => l.type === 'ASSIGNMENT').length || 0}
              </p>
              <div className="mt-2 text-xs text-slate-500">Nga 12 detyra totale</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Pjesëmarrja</p>
              <p className="text-3xl font-bold text-slate-900">
                {studentData?.attendance?.find((a: any) => a.status === 'PRESENT')?.count || 0}
              </p>
              <div className="mt-2 text-xs text-slate-500">Ditë të pranishme</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Pikë të Fitura</p>
              <p className="text-3xl font-bold text-blue-600">
                {studentData?.logs?.reduce((acc: number, curr: any) => acc + curr.score, 0).toFixed(0)}
              </p>
              <div className="mt-2 text-xs text-slate-500">Pikë totale kumulative</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-8">Progresi i Performancës</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={studentData?.logs?.map((l: any, i: number) => ({ 
                    name: `P${i+1}`, 
                    score: l.max_score > 0 ? (l.score / l.max_score * 100) : 0 
                  }))}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-8">Shpërndarja sipas Kategorisë</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Teste', value: studentData?.logs?.filter((l: any) => l.type === 'TEST').length || 0 },
                    { name: 'Detyra', value: studentData?.logs?.filter((l: any) => l.type === 'ASSIGNMENT').length || 0 },
                    { name: 'Pjesëmarrje', value: studentData?.attendance?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {[0, 1, 2].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#2563eb', '#10b981', '#f59e0b'][index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Teacher Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-6">
              <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
                <Users size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Nxënësit me Progres</p>
                <p className="text-3xl font-bold text-slate-900">{classData?.topImprovers?.length || 0}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp size={12} className="mr-1" /> +12% këtë semestër
                </p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-6">
              <div className="p-4 bg-green-100 text-green-600 rounded-2xl">
                <Target size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Mesatarja e Klasës</p>
                <p className="text-3xl font-bold text-slate-900">
                  {(classData?.classProgress?.reduce((acc: number, curr: any) => acc + (curr.avg_perf || 0), 0) / (classData?.classProgress?.length || 1) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">Bazuar në të gjitha aktivitetet</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-6">
              <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl">
                <Award size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Performanca e Lartë</p>
                <p className="text-3xl font-bold text-slate-900">85%</p>
                <p className="text-xs text-slate-500 mt-1">Nxënës mbi mesataren</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Class Progress Chart */}
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-8">Zhvillimi i Klasës Gjatë Muajve</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={classData?.classProgress?.map((p: any) => ({ month: p.month, perf: p.avg_perf * 100 }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="perf" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Improvers List */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Nxënësit me Progres</h3>
              <div className="space-y-6">
                {classData?.topImprovers?.map((student: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold">
                        {student.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{student.name}</p>
                        <p className="text-xs text-slate-500">Performanca: {(student.avg_perf * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="flex items-center text-green-600">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                ))}
                {(!classData?.topImprovers || classData.topImprovers.length === 0) && (
                  <p className="text-center text-slate-400 italic text-sm py-8">Ende nuk ka të dhëna të mjaftueshme.</p>
                )}
              </div>
              <button className="w-full mt-8 p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                Shiko Raportin e Plotë
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
