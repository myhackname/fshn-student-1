import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  MessageSquare, 
  Settings, 
  LogOut, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Award,
  BookOpen,
  HelpCircle,
  Calendar as CalendarIcon,
  Menu,
  Monitor,
  X,
  Bell
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { User, Role } from './types';
import { COLORS } from './constants';
import Attendance from './components/Attendance';
import Tests from './components/Tests';
import Chat from './components/Chat';
import Analytics from './components/Analytics';
import Assignments from './components/Assignments';
import LiveQuestions from './components/LiveQuestions';
import ScreenShare from './components/ScreenShare';
import Calendar from './components/Calendar';

import { auth, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { useLocation, useSearchParams } from 'react-router-dom';

// --- Contexts ---
const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
} | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Components ---

const Sidebar = ({ role }: { role: Role }) => {
  const { logout } = useAuth();
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Pjesëmarrja', path: '/attendance' },
    { icon: CalendarIcon, label: 'Kalendari', path: '/calendar' },
    { icon: FileText, label: 'Teste', path: '/tests' },
    { icon: BookOpen, label: 'Detyra', path: '/assignments' },
    { icon: HelpCircle, label: 'Pyetje Live', path: '/live-questions' },
    { icon: Monitor, label: 'Screen Share', path: '/screen-share' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: TrendingUp, label: 'Analitika', path: '/analytics' },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-blue-400">FSHN ANALISTIKE</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={logout}
          className="flex items-center space-x-3 p-3 w-full rounded-lg hover:bg-red-900/20 text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span>Dil</span>
        </button>
      </div>
    </div>
  );
};

const Header = () => {
  const { user, logout, token, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/user/profile-photo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        await refreshUser();
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-0 md:left-64 z-10 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center space-x-4">
        <h2 className="text-sm md:text-lg font-semibold text-slate-800">Mirëseerdhe, {user?.name}</h2>
      </div>
      <div className="flex items-center space-x-2 md:space-x-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative hidden sm:block">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        
        <div className="flex items-center space-x-3 border-l border-slate-100 pl-4">
          <label className="relative cursor-pointer group">
            <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" disabled={uploading} />
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs md:text-base overflow-hidden border-2 border-transparent group-hover:border-blue-400 transition-all">
              {user?.profile_photo ? (
                <img src={user.profile_photo} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </label>
          <button 
            onClick={logout}
            className="flex items-center space-x-1 md:space-x-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs md:text-sm font-medium"
          >
            <LogOut size={16} />
            <span>Dil</span>
          </button>
        </div>
      </div>
    </header>
  );
};

// --- Pages ---

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      console.log("Login response status:", res.status);
      console.log("Login response headers:", Object.fromEntries(res.headers.entries()));
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (res.ok) {
          login(data.token, data.user);
          navigate('/');
        } else {
          setError(data.error || 'Gabim gjatë hyrjes');
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        setError(`Serveri u përgjigj me statusin ${res.status} dhe format të gabuar (Jo-JSON). Fillimi: ${text.substring(0, 50)}...`);
      }
    } catch (err) {
      console.error("Login fetch error:", err);
      setError('Gabim në lidhje me serverin. Ju lutem provoni përsëri.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email, 
          name: user.displayName,
          uid: user.uid
        }),
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (res.ok) {
          login(data.token, data.user);
          navigate('/');
        } else if (res.status === 404) {
          // Redirect to register with pre-filled data
          navigate('/register', { state: { email: user.email, name: user.displayName } });
        } else {
          setError(data.error || 'Gabim gjatë hyrjes me Google');
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response from firebase auth:", text);
        setError('Serveri u përgjigj me një format të gabuar. Ju lutem provoni përsëri.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Gabim gjatë hyrjes me Google: ' + err.message);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://i.ibb.co/zVR0s1DK/1695809497396.jpg")' }}
    >
      <div className="absolute inset-0 bg-slate-900/40"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/60 rounded-2xl shadow-2xl p-8 relative z-10 border border-white/20"
      >
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">STUDENTËT FSHN</h1>
        <p className="text-center text-slate-500 mb-8">Hyni në platformën tuaj analitike</p>
        
        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="emri@fshn.edu.al"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fjalëkalimi</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Duke hyrë...' : 'Hyr'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/forgot-password" size="sm" className="text-blue-600 hover:underline text-sm font-medium">
            Keni harruar fjalëkalimin?
          </Link>
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Ose vazhdoni me</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center space-x-3 p-3 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span>Hyni me Google</span>
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Nuk keni llogari? <Link to="/register" className="text-blue-600 font-medium">Regjistrohuni</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else {
          setError(data.error || 'Gabim gjatë kërkesës');
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response from forgot-password:", text);
        setError('Serveri u përgjigj me një format të gabuar.');
      }
    } catch (err) {
      setError('Gabim në lidhje me serverin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://i.ibb.co/zVR0s1DK/1695809497396.jpg")' }}
    >
      <div className="absolute inset-0 bg-slate-900/40"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/60 rounded-2xl shadow-2xl p-8 relative z-10 border border-white/20"
      >
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Harruat Fjalëkalimin?</h1>
        <p className="text-center text-slate-500 mb-8">Shkruani email-in tuaj për të marrë linkun e rivendosjes</p>
        
        {message && <div className="bg-green-50/80 text-green-600 p-3 rounded-lg mb-6 text-sm border border-green-100 backdrop-blur-sm">{message}</div>}
        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="emri@fshn.edu.al"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Duke dërguar...' : 'Dërgo Linkun'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          U kujtuat? <Link to="/login" className="text-blue-600 font-medium">Kthehu te hyrja</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('Fjalëkalimet nuk përputhen');
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setError(data.error || 'Gabim gjatë rivendosjes');
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response from reset-password:", text);
        setError('Serveri u përgjigj me një format të gabuar.');
      }
    } catch (err) {
      setError('Gabim në lidhje me serverin');
    } finally {
      setLoading(false);
    }
  };

  if (!token) return <Navigate to="/login" />;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://i.ibb.co/zVR0s1DK/1695809497396.jpg")' }}
    >
      <div className="absolute inset-0 bg-slate-900/40"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/60 rounded-2xl shadow-2xl p-8 relative z-10 border border-white/20"
      >
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Rivendos Fjalëkalimin</h1>
        <p className="text-center text-slate-500 mb-8">Shkruani fjalëkalimin tuaj të ri</p>
        
        {message && <div className="bg-green-50/80 text-green-600 p-3 rounded-lg mb-6 text-sm border border-green-100 backdrop-blur-sm">{message} (Duke ju ridrejtuar...)</div>}
        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fjalëkalimi i Ri</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmo Fjalëkalimin</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Duke ruajtur...' : 'Ruaj Fjalëkalimin'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: location.state?.name || '',
    email: location.state?.email || '',
    password: '',
    role: 'STUDENT' as Role,
    program: 'BIOLOGJI',
    year: 'VITI 1 BACHELORE'
  });
  const [error, setError] = useState('');

  const programs = [
    "BIOLOGJI", "BIOTEKNOLOGJI", "KIMI", "KIMI INDUSTRIALE DHE MJEDISORE",
    "FIZIKE", "FIZIKE DHE SHKENCA KOMPJUTERIKE", "MATEMATIKE",
    "MATEMATIKE INFORMATIK", "TEKNOLOGJI INFORMACIONI DHE KOMUNIKIMI", "STATISTIKE"
  ];

  const years = [
    "VITI 1 BACHELORE", "VITI 2 BACHELORE", "VITI 3 BACHELORE",
    "VITI 1 MASTER", "VITI 2 MASTER"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        if (res.ok) {
          navigate('/login');
        } else {
          const data = await res.json();
          setError(data.error || 'Gabim gjatë regjistrimit');
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response from register:", text);
        setError('Serveri u përgjigj me një format të gabuar.');
      }
    } catch (err) {
      setError('Gabim në lidhje me serverin');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://i.ibb.co/zVR0s1DK/1695809497396.jpg")' }}
    >
      <div className="absolute inset-0 bg-slate-900/40"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/60 rounded-2xl shadow-2xl p-8 relative z-10 border border-white/20"
      >
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Regjistrimi</h1>
        <p className="text-center text-slate-500 mb-8">Krijoni llogarinë tuaj të re</p>
        
        {location.state?.email && (
          <div className="bg-blue-50/80 text-blue-700 p-3 rounded-lg mb-6 text-sm border border-blue-100 backdrop-blur-sm">
            Ju jeni lidhur me Google ({location.state.email}). Ju lutem plotësoni të dhënat e mëposhtme për të përfunduar regjistrimin.
          </div>
        )}
        
        {error && <div className="bg-red-50/80 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Emri i Plotë</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none ${location.state?.email ? 'bg-slate-50 cursor-not-allowed' : ''}`}
              required
              readOnly={!!location.state?.email}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fjalëkalimi</label>
            <input 
              type="password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Roli</label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Mësues</option>
            </select>
          </div>
          {formData.role === 'STUDENT' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Programi</label>
                <select 
                  value={formData.program}
                  onChange={(e) => setFormData({...formData, program: e.target.value})}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Viti</label>
                <select 
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: e.target.value})}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Regjistrohu
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Keni llogari? <Link to="/login" className="text-blue-600 font-medium">Hyni këtu</Link>
        </p>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    if (user?.role === 'TEACHER') {
      fetchPendingStudents();
    }
  }, []);

  const fetchPendingStudents = async () => {
    try {
      const res = await fetch('/api/teacher/pending-students', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setPendingStudents(data);
    } catch (e) { console.error(e); }
  };

  const confirmStudent = async (studentId: number) => {
    try {
      const res = await fetch('/api/teacher/confirm-student', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId })
      });
      if (res.ok) {
        setPendingStudents(pendingStudents.filter(s => s.id !== studentId));
      }
    } catch (e) { console.error(e); }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/analytics/student/me', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setStats(data);
      
      // Mock recent activity for now
      setRecentActivity([
        { title: 'Detyra e re: Analiza e Regresionit', time: 'Para 1 ore', icon: BookOpen },
        { title: 'Testi i Kimisë u vlerësua', time: 'Para 3 orësh', icon: Award },
        { title: 'Mesazh i ri nga Prof. Arben', time: 'Dje', icon: MessageSquare },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const dashboardStats = [
    { label: 'Mesatarja', value: stats?.logs?.length > 0 ? (stats.logs.reduce((acc: any, curr: any) => acc + (curr.max_score > 0 ? (curr.score/curr.max_score) : 0), 0) / stats.logs.length * 10).toFixed(1) : '0', icon: Award, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Pjesëmarrja', value: stats?.attendance?.find((a: any) => a.status === 'PRESENT')?.count || '0', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Pikët Totale', value: stats?.logs?.reduce((acc: any, curr: any) => acc + curr.score, 0).toFixed(0) || '0', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Aktivitete', value: stats?.logs?.length || '0', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  return (
    <div className="space-y-8">
      {/* User Info Banner */}
      <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">Përshëndetje, {user?.name}!</h2>
          <p className="text-blue-100 opacity-90">
            {user?.role === 'STUDENT' 
              ? `${user.program} • ${user.year}` 
              : 'Paneli i Menaxhimit të Mësuesit'}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
      </div>

      {user?.role === 'TEACHER' && pendingStudents.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-amber-900 flex items-center">
              <Users className="mr-2" /> Studentë në Pritje të Konfirmimit
            </h3>
            <span className="bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
              {pendingStudents.length} kërkesa
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingStudents.map(student => (
              <div key={student.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex flex-col justify-between">
                <div>
                  <p className="font-bold text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-500 mb-2">{student.email}</p>
                  <p className="text-xs font-medium text-amber-700 bg-amber-100 inline-block px-2 py-1 rounded">
                    {student.program} • {student.year}
                  </p>
                </div>
                <button 
                  onClick={() => confirmStudent(student.id)}
                  className="mt-4 w-full bg-amber-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors"
                >
                  Konfirmo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900">Përmbledhje e Performancës</h3>
            <Link to="/analytics" className="text-blue-600 text-sm font-bold hover:underline">Shiko të gjitha</Link>
          </div>
          <div className="h-64 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 italic border border-dashed border-slate-200">
            Grafiku i performancës do të shfaqet në seksionin e Analitikës
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-8">Aktiviteti i Fundit</h3>
          <div className="space-y-6">
            {recentActivity.map((act, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
                  <act.icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{act.title}</p>
                  <p className="text-xs text-slate-500">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Pjesëmarrja', path: '/attendance' },
    { icon: CalendarIcon, label: 'Kalendari', path: '/calendar' },
    { icon: FileText, label: 'Teste', path: '/tests' },
    { icon: BookOpen, label: 'Detyra', path: '/assignments' },
    { icon: HelpCircle, label: 'Pyetje Live', path: '/live-questions' },
    { icon: Monitor, label: 'Screen Share', path: '/screen-share' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: TrendingUp, label: 'Analitika', path: '/analytics' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block">
        <Sidebar role={user.role} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 pt-24 p-4 md:p-8 pb-24 md:pb-8 md:ml-64">
          {children}
        </main>
      </div>

      {/* Bottom Nav - Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center h-16 px-2 z-50 overflow-x-auto">
        {menuItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className="flex flex-col items-center justify-center space-y-1 text-slate-400 hover:text-blue-600 transition-colors min-w-[64px]"
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

// --- App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/user/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser }}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/attendance" element={<Layout><Attendance user={user} token={token || ''} /></Layout>} />
          <Route path="/calendar" element={<Layout><Calendar user={user} token={token || ''} /></Layout>} />
          <Route path="/tests" element={<Layout><Tests user={user} token={token || ''} /></Layout>} />
          <Route path="/assignments" element={<Layout><Assignments user={user} token={token || ''} /></Layout>} />
          <Route path="/live-questions" element={<Layout><LiveQuestions user={user} token={token || ''} /></Layout>} />
          <Route path="/screen-share" element={<Layout><ScreenShare user={user} token={token || ''} /></Layout>} />
          <Route path="/chat" element={<Layout><Chat user={user} token={token || ''} /></Layout>} />
          <Route path="/analytics" element={<Layout><Analytics user={user} token={token || ''} /></Layout>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}
