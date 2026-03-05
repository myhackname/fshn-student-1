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
  Bell,
  Eye,
  EyeOff,
  Search,
  Plus,
  ChevronRight,
  Download,
  Video,
  Mic,
  MicOff,
  VideoOff,
  ScreenShare as ScreenShareIcon
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
import Library from './components/Library';
import Classroom from './components/Classroom';

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

import MotionLogo from './components/MotionLogo';

const Sidebar = ({ role }: { role: Role }) => {
  const { logout } = useAuth();
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Klasa', path: '/classroom' },
    { icon: CheckCircle, label: 'Pjesëmarrja', path: '/attendance' },
    { icon: CalendarIcon, label: 'Kalendari', path: '/calendar' },
    { icon: BookOpen, label: 'Libraria', path: '/library' },
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
        <h1 className="text-xl font-bold tracking-tight text-blue-400">DIGITAL STUDENT FSHN</h1>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Platforma Studentore</p>
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
  const [showVerifiedMessage, setShowVerifiedMessage] = useState(false);

  useEffect(() => {
    if (user && user.email_verified && !user.email_verified_shown) {
      setShowVerifiedMessage(true);
      
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowVerifiedMessage(false);
      }, 10000);

      // Mark as shown in backend
      fetch('/api/user/mark-verified-shown', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(() => refreshUser());

      return () => clearTimeout(timer);
    }
  }, [user, token, refreshUser]);

  return (
    <>
      <AnimatePresence>
        {showVerifiedMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-white/20 backdrop-blur-md"
          >
            <CheckCircle size={20} />
            <span className="font-bold">Email i verifikuar me sukses!</span>
            <button onClick={() => setShowVerifiedMessage(false)} className="ml-4 hover:opacity-70">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
            <Link to="/profile" className="flex items-center space-x-3 group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-end space-x-1">
                  <span>{user?.name} {user?.surname}</span>
                  {user?.email_verified && (
                    <span className="text-blue-500" title={user.role === 'STUDENT' ? 'Verified Student' : 'Verified Teacher'}>
                      <CheckCircle size={14} fill="currentColor" className="text-white" />
                    </span>
                  )}
                  {user?.role === 'STUDENT' && (user as any).class_status === 'CONFIRMED' && (
                    <span className="text-green-500" title="I Verifikuar në Klasë">
                      <CheckCircle size={14} fill="currentColor" className="text-white" />
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  {user?.role === 'STUDENT' ? `Student | Klasa ${user.program}` : 'Mësues'}
                </p>
              </div>
              <div className="relative">
                <MotionLogo size="md" />
                {user?.email_verified && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white">
                    <CheckCircle size={10} />
                  </div>
                )}
              </div>
            </Link>
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
    </>
  );
};

// --- Pages ---

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setError(`Serveri u përgjigj me gabim.`);
      }
    } catch (err) {
      setError('Gabim në lidhje me serverin.');
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
          navigate('/register', { state: { email: user.email, name: user.displayName } });
        } else {
          setError(data.error || 'Gabim gjatë hyrjes me Google');
        }
      } else {
        setError('Serveri u përgjigj me një format të gabuar.');
      }
    } catch (err: any) {
      setError('Gabim gjatë hyrjes me Google: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <iframe 
          src="https://streamable.com/e/jsx1ll?autoplay=1&muted=1&loop=1&controls=0" 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77vh] h-[56.25vw] min-w-full min-h-full border-none"
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
      <div className="absolute inset-0 bg-slate-900/50 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-transparent rounded-2xl p-8 relative z-10 border border-white/10 backdrop-blur-[2px]"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-tight">DIGITAL STUDENT FSHN</h1>
        <p className="text-center text-slate-300 font-medium mb-8">Platforma Studentore</p>
        
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="emri@fshn.edu.al"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Fjalëkalimi</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Duke hyrë...' : 'Hyr'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/forgot-password" size="sm" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            Keni harruar fjalëkalimin?
          </Link>
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-transparent text-slate-400">Ose vazhdoni me</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center space-x-3 p-3 border border-white/20 rounded-lg font-medium hover:bg-white/5 transition-colors text-white"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span>Hyni me Google</span>
        </button>

        <p className="mt-6 text-center text-sm text-slate-400">
          Nuk keni llogari? <Link to="/register" className="text-blue-400 font-medium hover:text-blue-300">Regjistrohuni</Link>
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <iframe 
          src="https://streamable.com/e/jsx1ll?autoplay=1&muted=1&loop=1&controls=0" 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77vh] h-[56.25vw] min-w-full min-h-full border-none"
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
      <div className="absolute inset-0 bg-slate-900/50 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-transparent rounded-2xl p-8 relative z-10 border border-white/10 backdrop-blur-[2px]"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-2">Harruat Fjalëkalimin?</h1>
        <p className="text-center text-slate-300 mb-8">Shkruani email-in tuaj për të marrë linkun e rivendosjes</p>
        
        {message && <div className="bg-green-500/20 text-green-200 p-3 rounded-lg mb-6 text-sm border border-green-500/30 backdrop-blur-sm">{message}</div>}
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="emri@fshn.edu.al"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Duke dërguar...' : 'Dërgo Linkun'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          U kujtuat? <Link to="/login" className="text-blue-400 font-medium hover:text-blue-300">Kthehu te hyrja</Link>
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <iframe 
          src="https://streamable.com/e/jsx1ll?autoplay=1&muted=1&loop=1&controls=0" 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77vh] h-[56.25vw] min-w-full min-h-full border-none"
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
      <div className="absolute inset-0 bg-slate-900/50 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-transparent rounded-2xl p-8 relative z-10 border border-white/10 backdrop-blur-[2px]"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-2">Rivendos Fjalëkalimin</h1>
        <p className="text-center text-slate-300 mb-8">Shkruani fjalëkalimin tuaj të ri</p>
        
        {message && <div className="bg-green-500/20 text-green-200 p-3 rounded-lg mb-6 text-sm border border-green-500/30 backdrop-blur-sm">{message} (Duke ju ridrejtuar...)</div>}
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Fjalëkalimi i Ri</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Konfirmo Fjalëkalimin</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
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
    surname: '',
    email: location.state?.email || '',
    password: '',
    role: 'STUDENT' as Role,
    program: 'BIOLOGJI',
    year: 'VITI 1 BACHELORE',
    group_name: 'A',
    study_type: 'BACHELOR',
    phone: '',
    is_president: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [hasAdmin, setHasAdmin] = useState(false);

  useEffect(() => {
    if (formData.role === 'STUDENT') {
      checkAdminStatus();
    }
  }, [formData.program, formData.year, formData.study_type, formData.group_name, formData.role]);

  const checkAdminStatus = async () => {
    try {
      const params = new URLSearchParams({
        program: formData.program,
        year: formData.year,
        study_type: formData.study_type,
        group_name: formData.group_name
      });
      const res = await fetch(`/api/auth/check-class-admin?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHasAdmin(data.hasAdmin);
        if (data.hasAdmin) {
          setFormData(prev => ({ ...prev, is_president: false }));
        }
      }
    } catch (e) {
      console.error("Error checking admin status:", e);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <iframe 
          src="https://streamable.com/e/jsx1ll?autoplay=1&muted=1&loop=1&controls=0" 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77vh] h-[56.25vw] min-w-full min-h-full border-none"
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
      <div className="absolute inset-0 bg-slate-900/50 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-transparent rounded-2xl p-8 relative z-10 border border-white/10 backdrop-blur-[2px]"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-tight">Regjistrimi</h1>
        <p className="text-center text-slate-300 font-medium mb-8">DIGITAL STUDENT FSHN</p>
        
        {location.state?.email && (
          <div className="bg-blue-500/20 text-blue-200 p-3 rounded-lg mb-6 text-sm border border-blue-500/30 backdrop-blur-sm">
            Ju jeni lidhur me Google ({location.state.email}).
          </div>
        )}
        
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30 backdrop-blur-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Emri</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Mbiemri</label>
              <input 
                type="text" 
                value={formData.surname}
                onChange={(e) => setFormData({...formData, surname: e.target.value})}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500 ${location.state?.email ? 'opacity-50 cursor-not-allowed' : ''}`}
              required
              readOnly={!!location.state?.email}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Fjalëkalimi</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Roli</label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
            >
              <option value="STUDENT" className="bg-slate-900">Student</option>
              <option value="TEACHER" className="bg-slate-900">Mësues</option>
            </select>
          </div>
          {formData.role === 'STUDENT' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Dega</label>
                <select 
                  value={formData.program}
                  onChange={(e) => setFormData({...formData, program: e.target.value})}
                  className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                >
                  {programs.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Viti</label>
                  <select 
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                    className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                  >
                    {years.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Grupi</label>
                  <select 
                    value={formData.group_name}
                    onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                    className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                  >
                    {["A", "B", "C"].map(g => <option key={g} value={g} className="bg-slate-900">{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Lloji i Studimit</label>
                <select 
                  value={formData.study_type}
                  onChange={(e) => setFormData({...formData, study_type: e.target.value})}
                  className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                >
                  <option value="BACHELOR" className="bg-slate-900">Bachelor</option>
                  <option value="MASTER" className="bg-slate-900">Master</option>
                </select>
              </div>
              {!hasAdmin && (
                <div className="flex items-center space-x-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <input 
                    type="checkbox" 
                    id="is_president"
                    checked={formData.is_president}
                    onChange={(e) => setFormData({...formData, is_president: e.target.checked})}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-white/20 rounded bg-white/5"
                  />
                  <label htmlFor="is_president" className="text-sm font-bold text-blue-400 cursor-pointer">
                    President i Klasës (Admin)
                  </label>
                </div>
              )}
            </>
          )}
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            Regjistrohu
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Keni llogari? <Link to="/login" className="text-blue-400 font-bold hover:text-blue-300">Hyni këtu</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ProfilePage = () => {
  const { user, token, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    surname: user?.surname || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    group_name: user?.group_name || 'A',
    study_type: user?.study_type || 'BACHELOR'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await refreshUser();
        setMessage('Profili u përditësua me sukses!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 mb-12">
          <div className="relative">
            <MotionLogo size="xl" />
            {user?.email_verified && (
              <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-full border-4 border-white shadow-lg">
                <Award size={24} />
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-3 mb-2">
              <h2 className="text-3xl font-bold text-slate-900">{user?.name} {user?.surname}</h2>
              <div className="flex flex-wrap gap-2">
                {user?.email_verified && (
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                    <CheckCircle size={12} />
                    <span>{user.role === 'STUDENT' ? 'Verified Student' : 'Verified Teacher'}</span>
                  </span>
                )}
                {user?.role === 'STUDENT' && (user as any).class_status === 'CONFIRMED' && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                    <CheckCircle size={12} />
                    <span>I Verifikuar në Klasë</span>
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-500 mb-6">{user?.email}</p>
            
            {!user?.email_verified && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3 text-amber-700">
                  <Clock size={20} />
                  <span className="text-sm font-medium">Ju tashmë jeni regjistruar – Verifiko emailin</span>
                </div>
                <button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const res = await fetch('/api/auth/verify-email', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (res.ok) {
                        setMessage('Email-i u verifikua me sukses!');
                        refreshUser();
                      }
                    } catch (e) { console.error(e); }
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Duke verifikuar...' : 'Verifiko Tani'}
                </button>
              </div>
            )}
            
            {message && <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-100">{message}</div>}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Përditëso Profilin</h3>
        
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Emri</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mbiemri</label>
                <input 
                  type="text" 
                  value={formData.surname}
                  onChange={(e) => setFormData({...formData, surname: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email (Nuk mund të ndryshohet)</label>
              <div className="flex space-x-2">
                <input 
                  type="email" 
                  value={user?.email}
                  disabled
                  className="flex-1 p-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 outline-none cursor-not-allowed"
                />
                {!user?.email_verified && (
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch('/api/user/verify-email', {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                          await refreshUser();
                          setMessage('Emaili u verifikua me sukses!');
                          setTimeout(() => setMessage(''), 3000);
                        }
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all"
                  >
                    Verifiko
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Telefon</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="+355..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bio</label>
              <textarea 
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                placeholder="Tregoni diçka për veten..."
              />
            </div>

            {user?.role === 'STUDENT' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Grupi</label>
                  <select 
                    value={formData.group_name}
                    onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="A">Grupi A</option>
                    <option value="B">Grupi B</option>
                    <option value="C">Grupi C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Lloji i Studimit</label>
                  <select 
                    value={formData.study_type}
                    onChange={(e) => setFormData({...formData, study_type: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="BACHELOR">Bachelor</option>
                    <option value="MASTER">Master</option>
                  </select>
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {loading ? 'Duke ruajtur...' : 'Ruaj Ndryshimet'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const PendingApproval = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={40} className="text-blue-600 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Duke pritur për miratim</h2>
        <p className="text-slate-500 mb-8">
          Kërkesa juaj për t'u bashkuar me klasën është dërguar. Ju lutem prisni që administratori i klasës t'ju pranojë.
        </p>
        <button 
          onClick={logout}
          className="w-full p-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
        >
          Dil dhe provo më vonë
        </button>
      </div>
    </div>
  );
};

const RejectedView = () => {
  const { token, refreshUser, logout } = useAuth();
  const [formData, setFormData] = useState({
    program: 'SHKENCA KOMPJUTERIKE',
    year: 'VITI 1',
    group_name: 'A',
    study_type: 'BACHELOR'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/student/change-classroom', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await refreshUser();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <X size={40} className="text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Kërkesa u refuzua</h2>
        <p className="text-slate-500 mb-8 text-center">
          Ju nuk jeni pranuar në këtë klasë. Ju lutem zgjidhni një klasë tjetër ose kontaktoni administratorin.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dega</label>
            <select 
              value={formData.program}
              onChange={(e) => setFormData({...formData, program: e.target.value})}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="SHKENCA KOMPJUTERIKE">Shkenca Kompjuterike</option>
              <option value="TIK">TIK</option>
              <option value="MATEMATIKE">Matematikë</option>
              <option value="FIZIKE">Fizikë</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Viti</label>
              <select 
                value={formData.year}
                onChange={(e) => setFormData({...formData, year: e.target.value})}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                <option value="VITI 1">Viti 1</option>
                <option value="VITI 2">Viti 2</option>
                <option value="VITI 3">Viti 3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Grupi</label>
              <select 
                value={formData.group_name}
                onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                <option value="A">Grupi A</option>
                <option value="B">Grupi B</option>
                <option value="C">Grupi C</option>
              </select>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {loading ? 'Duke dërguar...' : 'Dërgo Kërkesë të Re'}
          </button>
          
          <button 
            type="button"
            onClick={logout}
            className="w-full p-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
          >
            Dil
          </button>
        </form>
      </div>
    </div>
  );
};

const Progress3D = ({ value, label, color }: { value: number, label: string, color: string, key?: any }) => {
  const height = Math.max(10, value);
  return (
    <div className="flex flex-col items-center group">
      <div className="relative w-12 h-48 flex items-end justify-center perspective-1000">
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: `${height}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`relative w-8 transform-style-3d transition-all duration-500`}
        >
          <div className={`absolute inset-0 ${color} border-r border-black/10 shadow-inner z-20`}></div>
          <div className={`absolute -top-3 left-0 w-8 h-3 ${color} brightness-125 origin-bottom transform -rotate-x-90 z-30`}></div>
          <div className={`absolute top-0 -right-3 w-3 h-full ${color} brightness-75 origin-left transform rotate-y-90 z-10`}></div>
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-40">
            {value.toFixed(1)}%
          </div>
        </motion.div>
      </div>
      <p className="mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  );
};

const Dashboard = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [currentLecture, setCurrentLecture] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
    if (user?.role === 'TEACHER') {
      fetchCurrentLecture();
    } else {
      fetchStudentClassStatus();
    }
    fetchPendingStudents();
  }, []);

  const fetchCurrentLecture = async () => {
    try {
      const res = await fetch('/api/teacher/current-lecture', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCurrentLecture(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchStudentClassStatus = async () => {
    try {
      const res = await fetch('/api/student/class-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCurrentLecture(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleLectureStatus = async (status: string) => {
    try {
      const res = await fetch('/api/teacher/lecture-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scheduleId: currentLecture.id, status })
      });
      if (res.ok) fetchCurrentLecture();
    } catch (e) { console.error(e); }
  };

  const fetchPendingStudents = async () => {
    try {
      const res = await fetch('/api/admin/pending-members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setPendingStudents(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleApprove = async (memberId: number, status: string) => {
    try {
      const res = await fetch('/api/admin/approve-member', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId, status })
      });
      if (res.ok) fetchPendingStudents();
    } catch (e) { console.error(e); }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/analytics/student/me', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setStats(data);
      
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
      {/* Email Verification Banner */}
      {!user?.email_verified && (
        <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex items-center space-x-3 text-green-700 font-medium">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <p>Ju tashmë jeni regjistruar, të lutem verifiko emailin.</p>
        </div>
      )}

      {/* User Info Banner */}
      <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">Përshëndetje, {user?.name}!</h2>
          <p className="text-blue-100 opacity-90">
            {user?.role === 'STUDENT' 
              ? `${user?.program} • ${user?.year}` 
              : 'Paneli i Menaxhimit të Mësuesit'}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
      </div>

      {/* Teacher Lecture Options */}
      {user?.role === 'TEACHER' && currentLecture && (
        <div className="mb-8 bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-1">Leksioni Aktual</p>
              <h3 className="text-2xl font-bold">{currentLecture.subject} - {currentLecture.class_name}</h3>
              <p className="text-blue-100">{currentLecture.start_time} - {currentLecture.end_time}</p>
              {currentLecture.current_status && (
                <div className="mt-2 inline-block px-3 py-1 bg-white/20 rounded-lg text-xs font-bold">
                  Statusi: {currentLecture.current_status === 'OPEN' ? 'Hapur' : currentLecture.current_status === 'SOON' ? 'Vjen Së Shpejti' : 'Nuk vjen sot'}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => handleLectureStatus('OPEN')}
                className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-all"
              >
                1. Hap Klasën
              </button>
              <button 
                onClick={() => handleLectureStatus('SOON')}
                className="px-6 py-3 bg-blue-500 text-white border border-blue-400 rounded-2xl font-bold hover:bg-blue-400 transition-all"
              >
                2. Vij Së Shpejti
              </button>
              <button 
                onClick={() => handleLectureStatus('NOT_COMING')}
                className="px-6 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
              >
                3. Nuk Vij Sot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Lecture Status */}
      {user?.role === 'STUDENT' && currentLecture && (
        <div className={`mb-8 rounded-3xl p-8 text-white shadow-xl ${
          currentLecture.status === 'OPEN' ? 'bg-emerald-500 shadow-emerald-100' :
          currentLecture.status === 'SOON' ? 'bg-amber-500 shadow-amber-100' :
          currentLecture.status === 'NOT_COMING' ? 'bg-red-500 shadow-red-100' :
          'bg-slate-800 shadow-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-bold uppercase tracking-wider mb-1">Statusi i Mësimit</p>
              <h3 className="text-2xl font-bold">{currentLecture.subject}</h3>
              <p className="text-white/80">Mësuesi: {currentLecture.teacher_name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">
                {currentLecture.status === 'OPEN' ? 'LIVE' :
                 currentLecture.status === 'SOON' ? 'SË SHPEJTI' :
                 currentLecture.status === 'NOT_COMING' ? 'ANULUAR' : 'PRITJE'}
              </p>
              <p className="text-sm opacity-80">{currentLecture.start_time} - {currentLecture.end_time}</p>
            </div>
          </div>
        </div>
      )}

      {pendingStudents.length > 0 && (
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
                <div className="flex items-center space-x-4 mb-4">
                  <MotionLogo size="sm" />
                  <div>
                    <p className="font-bold text-slate-900">{student.name} {student.surname}</p>
                    <p className="text-xs text-slate-500">{student.email}</p>
                    <p className="text-xs font-medium text-amber-700 bg-amber-100 inline-block px-2 py-1 rounded mt-1">
                      {student.class_name}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApprove(student.id, 'CONFIRMED')}
                    className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-all"
                  >
                    Prano
                  </button>
                  <button 
                    onClick={() => handleApprove(student.id, 'REFUSED')}
                    className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-200 transition-all"
                  >
                    Refuzo
                  </button>
                </div>
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
            <h3 className="text-xl font-bold text-slate-900">Përmbledhje e Performancës (3D)</h3>
            <Link to="/analytics" className="text-blue-600 text-sm font-bold hover:underline">Shiko të gjitha</Link>
          </div>
          <div className="flex justify-around items-end h-64 pb-4">
            {(() => {
              const data = [
                { name: 'Teste', value: (stats?.logs?.filter((l: any) => l.type === 'TEST').reduce((acc: number, curr: any) => acc + (curr.score/curr.max_score), 0) / (stats?.logs?.filter((l: any) => l.type === 'TEST').length || 1)) * 100 },
                { name: 'Detyra', value: (stats?.logs?.filter((l: any) => l.type === 'ASSIGNMENT').reduce((acc: number, curr: any) => acc + (curr.score/curr.max_score), 0) / (stats?.logs?.filter((l: any) => l.type === 'ASSIGNMENT').length || 1)) * 100 },
                { name: 'Pjesëmarrje', value: (stats?.attendance?.find((a: any) => a.status === 'PRESENT')?.count || 0) / 20 * 100 }
              ];
              return data.map((d, i) => {
                let color = 'bg-green-500';
                if (d.value < 50) color = 'bg-red-500';
                else if (d.value < 80) color = 'bg-orange-500';
                return <Progress3D key={i} value={d.value} label={d.name} color={color} />;
              });
            })()}
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
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const s = io();
    s.on('study_session_start', async (data: any) => {
      // Check if student belongs to this class
      if (user?.role === 'STUDENT' && data.classId) {
        try {
          const res = await fetch('/api/classes/my', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const myClasses = await res.json();
          if (myClasses.some((c: any) => c.id === data.classId)) {
            navigate('/attendance');
          }
        } catch (e) { console.error(e); }
      }
    });
    return () => { s.disconnect(); };
  }, [user, navigate, token]);

  if (!user) return <Navigate to="/login" />;

  // Approval logic
  if (user.role === 'STUDENT' && !user.is_class_admin) {
    if ((user as any).class_status === 'PENDING') return <PendingApproval />;
    if ((user as any).class_status === 'REFUSED') return <RejectedView />;
    if (!user.is_confirmed) return <PendingApproval />;
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Klasa', path: '/classroom' },
    { icon: CheckCircle, label: 'Pjesëmarrja', path: '/attendance' },
    { icon: CalendarIcon, label: 'Kalendari', path: '/calendar' },
    { icon: BookOpen, label: 'Libraria', path: '/library' },
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
          <Route path="/classroom" element={<Layout><Classroom user={user} token={token || ''} /></Layout>} />
          <Route path="/library" element={<Layout><Library user={user} token={token || ''} /></Layout>} />
          <Route path="/analytics" element={<Layout><Analytics user={user} token={token || ''} /></Layout>} />
          <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}
