import React from "react";

interface GlobeProps {
  onClick?: () => void;
  size?: number;
  className?: string;
}

const Globe: React.FC<GlobeProps> = ({ onClick, size = 40, className = "" }) => {
  return (
    <div 
      onClick={onClick}
      className={`cursor-pointer group relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <style>
        {`
          @keyframes earthRotate {
            0% { background-position: 0 0; }
            100% { background-position: 160px 0; }
          }
          @keyframes twinkling { 0%,100% { opacity:0.1; } 50% { opacity:1; } }
        `}
      </style>
      <div
        className="relative rounded-full overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.1),-2px_0_4px_#c3f4ff_inset,8px_1px_12px_#000_inset,-12px_-1px_17px_#c3f4ff99_inset,120px_0_22px_#00000066_inset,70px_0_19px_#000000aa_inset] transition-transform duration-500 group-hover:scale-110 active:scale-95"
        style={{
          width: size,
          height: size,
          backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/globe.jpeg')",
          backgroundSize: "200% 100%",
          backgroundPosition: "left",
          animation: "earthRotate 15s linear infinite",
        }}
      >
        {/* Sparkles */}
        <div className="absolute top-1/4 left-1/4 w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
        <div className="absolute top-1/2 right-1/4 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-75" />
      </div>
      
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export default Globe;
