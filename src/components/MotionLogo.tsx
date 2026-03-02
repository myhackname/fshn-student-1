import React from 'react';

const MotionLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };
  
  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden border-2 border-white shadow-md relative bg-slate-100 flex-shrink-0`}>
      {/* To use a local file "forever", upload logo-loop.mp4 to /public and use a <video> tag */}
      <iframe 
        src="https://streamable.com/e/0n9o2f?autoplay=1&muted=1&loop=1&controls=0" 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] border-none pointer-events-none"
        allow="autoplay; fullscreen"
      ></iframe>
    </div>
  );
};

export default MotionLogo;
