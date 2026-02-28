import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Monitor, MonitorOff, Users, Play, Square } from 'lucide-react';

export default function ScreenShare({ user, token }: { user: any, token: string }) {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startSharing = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      setStream(mediaStream);
      setIsSharing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      mediaStream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopSharing = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsSharing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">🖥️ Ndarja e Ekranit</h2>
          <p className="text-slate-500">Ndaj ekranin tënd me klasën në kohë reale</p>
        </div>
        
        {user.role === 'TEACHER' && (
          <button 
            onClick={isSharing ? stopSharing : startSharing}
            className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center space-x-2 shadow-lg ${isSharing ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-100' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}
          >
            {isSharing ? <Square size={20} /> : <Play size={20} />}
            <span>{isSharing ? 'Ndalo Ndarjen' : 'Fillo Ndarjen'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 bg-slate-900 rounded-[2.5rem] aspect-video relative overflow-hidden shadow-2xl border-4 border-slate-800">
          {isSharing ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <Monitor size={80} className="opacity-20" />
              <p className="text-lg font-medium">Nuk ka asnjë transmetim aktiv</p>
            </div>
          )}
          
          {isSharing && (
            <div className="absolute bottom-6 left-6 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center space-x-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span>LIVE</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center">
              <Users className="mr-2 text-blue-600" size={20} /> Shikuesit
            </h3>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                    S
                  </div>
                  <span className="text-sm text-slate-600">Studenti {i}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-100">
            <h3 className="font-bold mb-2">Udhëzim</h3>
            <p className="text-sm text-blue-100 leading-relaxed">
              Vetëm mësuesit mund të fillojnë ndarjen e ekranit. Studentët do të shohin transmetimin automatikisht kur ai të jetë aktiv.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
