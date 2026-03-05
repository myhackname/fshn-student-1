import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, MonitorOff, Users, Play, Square, 
  Video, VideoOff, ScreenShare as ScreenShareIcon,
  Smartphone, Camera, Wifi, WifiOff, AlertCircle,
  Check
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export default function ScreenShare({ user, token }: { user: any, token: string }) {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<'SCREEN' | 'CAMERA'>('SCREEN');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    const s = io();
    setSocket(s);
    s.emit('join', { id: user.id, name: user.name, role: user.role });

    // Fetch class ID
    fetch('/api/classes/my', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(classes => {
      if (classes && classes.length > 0) {
        setClassId(classes[0].id);
      }
    });

    // Student Listeners
    s.on('stream_available', (data) => {
      if (user.role === 'STUDENT') {
        setIsLive(true);
        setMode(data.type);
        // Auto-request stream
        s.emit('request_stream', { to: data.teacherId });
      }
    });

    s.on('stream_ended', () => {
      if (user.role === 'STUDENT') {
        setIsLive(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }
    });

    s.on('webrtc_offer', async (data) => {
      const pc = createPeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit('webrtc_answer', { to: data.from, answer });
    });

    s.on('webrtc_ice_candidate', async (data) => {
      const pc = peersRef.current.get(data.from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    // Teacher Listeners
    s.on('student_requested_stream', async (data) => {
      if (user.role === 'TEACHER' && streamRef.current) {
        const pc = createPeerConnection(data.from);
        streamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, streamRef.current!);
        });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('webrtc_offer', { to: data.from, offer });
        setViewersCount(prev => prev + 1);
      }
    });

    s.on('webrtc_answer', async (data) => {
      const pc = peersRef.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    return () => {
      s.disconnect();
      stopSharing();
    };
  }, []);

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection(iceServers);
    peersRef.current.set(targetId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', { to: targetId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (user.role === 'STUDENT' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        peersRef.current.delete(targetId);
        if (user.role === 'TEACHER') setViewersCount(prev => Math.max(0, prev - 1));
      }
    };

    return pc;
  };

  const startSharing = async (streamMode: 'SCREEN' | 'CAMERA') => {
    setError(null);
    try {
      let mediaStream: MediaStream;
      if (streamMode === 'SCREEN') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          const isIframe = window.self !== window.top;
          throw new Error(isIframe 
            ? "Ndarja e ekranit nuk lejohet brenda Preview. Ju lutem hapeni aplikacionin në një Tab të ri."
            : "Browseri juaj nuk mbështet ndarjen e ekranit.");
        }
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: true
        });
      } else {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Browseri juaj nuk mbështet aksesin në kamerë.");
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: true
        });
      }

      setStream(mediaStream);
      streamRef.current = mediaStream;
      setIsSharing(true);
      setMode(streamMode);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }
      
      if (socket && classId) {
        socket.emit('stream_started', { type: streamMode, classId });
      }

      mediaStream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err: any) {
      console.error("Error sharing:", err);
      let message = "Ndodhi një gabim gjatë fillimit të transmetimit.";
      
      if (err.name === 'NotAllowedError' || err.message?.includes('not allowed')) {
        const isIframe = window.self !== window.top;
        message = isIframe 
          ? "Aksesi u refuzua nga sistemi i sigurisë së Preview. Për të ndarë ekranin, ju lutem hapeni aplikacionin në një Tab të ri."
          : "Aksesi u refuzua. Sigurohuni që keni dhënë lejet e nevojshme në browser.";
      } else if (err.name === 'NotFoundError') {
        message = "Nuk u gjet asnjë pajisje (kamerë/ekran) për të ndarë.";
      } else if (err.message) {
        message = err.message;
      }
      
      setError(message);
    }
  };

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    streamRef.current = null;
    setIsSharing(false);
    setViewersCount(0);
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (socket && classId) {
      socket.emit('stream_stopped', { classId });
    }

    // Close all peer connections
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            {mode === 'SCREEN' ? <Monitor className="text-blue-600" /> : <Video className="text-purple-600" />}
            {mode === 'SCREEN' ? 'Ndarja e Ekranit' : 'Transmetim Live'}
          </h2>
          <p className="text-slate-500">
            {user.role === 'TEACHER' 
              ? 'Ndaj ekranin ose kamerën tënd me klasën në kohë reale' 
              : 'Shiko transmetimin live nga profesori juaj'}
          </p>
        </div>
        
        {user.role === 'TEACHER' && (
          <div className="flex flex-wrap gap-3">
            {!isSharing ? (
              <>
                <button 
                  onClick={() => startSharing('SCREEN')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center space-x-2 shadow-lg shadow-blue-100"
                >
                  <ScreenShareIcon size={20} />
                  <span>Ndaj Ekranin</span>
                </button>
                <button 
                  onClick={() => startSharing('CAMERA')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center space-x-2 shadow-lg shadow-purple-100"
                >
                  <Camera size={20} />
                  <span>Fillo Live (Kamera)</span>
                </button>
              </>
            ) : (
              <button 
                onClick={stopSharing}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center space-x-2 shadow-lg shadow-red-100"
              >
                <Square size={20} />
                <span>Ndalo Transmetimin</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle size={20} className="flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                Hap në Tab të ri
              </button>
            </motion.div>
          )}
          
          <div className="bg-slate-900 rounded-[2.5rem] aspect-video relative overflow-hidden shadow-2xl border-4 border-slate-800 group">
            {/* Video Element */}
            <video 
              ref={user.role === 'TEACHER' ? localVideoRef : remoteVideoRef} 
              autoPlay 
              playsInline 
              muted={user.role === 'TEACHER'} 
              className="w-full h-full object-contain"
            />

            {/* Overlay when not sharing/live */}
            {((user.role === 'TEACHER' && !isSharing) || (user.role === 'STUDENT' && !isLive)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-4 bg-slate-900/80 backdrop-blur-sm">
                <div className="p-6 bg-slate-800 rounded-full">
                  {user.role === 'TEACHER' ? <MonitorOff size={48} className="opacity-40" /> : <WifiOff size={48} className="opacity-40" />}
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">
                    {user.role === 'TEACHER' ? 'Gati për të filluar?' : 'Nuk ka asnjë transmetim aktiv'}
                  </p>
                  <p className="text-slate-400 mt-1">
                    {user.role === 'TEACHER' ? 'Zgjidhni një opsion më sipër për të filluar' : 'Ju do të njoftoheni kur profesori të fillojë'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Live Indicator */}
            {(isSharing || isLive) && (
              <div className="absolute top-6 left-6 flex items-center gap-3">
                <div className="bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center space-x-2 shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </div>
                <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold flex items-center space-x-2">
                  <Users size={14} />
                  <span>{viewersCount} Shikues</span>
                </div>
              </div>
            )}

            {/* Mobile Controls Overlay */}
            {isSharing && mode === 'CAMERA' && (
              <div className="absolute bottom-6 right-6 md:hidden">
                <div className="bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                  <Smartphone className="text-white" size={20} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="text-blue-600" size={20} /> 
              Statusi i Lidhjes
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-sm text-slate-500 font-medium">Serveri</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs font-bold text-slate-700">{socket?.connected ? 'Online' : 'Offline'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-sm text-slate-500 font-medium">Transmetimi</span>
                <span className="text-xs font-bold text-slate-700">
                  {isSharing || isLive ? (mode === 'SCREEN' ? 'Ekran' : 'Kamera') : 'Jo Aktiv'}
                </span>
              </div>
            </div>
          </div>

          {/* Guide Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-3">Përdorimi në Mobile</h3>
              <p className="text-sm text-blue-100 leading-relaxed mb-4">
                Profesorët mund të përdorin telefonin për të transmetuar live leksionin duke përdorur kamerën e pasme.
              </p>
              <div className="flex items-center gap-2 text-xs font-bold bg-white/10 w-fit px-3 py-1.5 rounded-full">
                <Check size={14} />
                <span>Optimizuar për 4G/5G</span>
              </div>
            </div>
            <Video className="absolute -bottom-4 -right-4 text-white/10 w-32 h-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
