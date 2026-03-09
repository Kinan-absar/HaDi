import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 24 }) => {
  return (
    <div 
      style={{ width: size, height: size }} 
      className={`flex items-center justify-center overflow-hidden ${className}`}
    >
      <img 
        src="https://i.ibb.co/yBnRcxx7/Gemini-Generated-Image-5ieseu5ieseu5ies.jpg" 
        alt="Logo" 
        className="w-full h-full object-contain scale-150 mix-blend-multiply"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
