import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const dimensions =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
      ? 'w-11 h-11 rounded-xl'
      : 'w-9 h-9 rounded-xl';

  return (
    <div
      className={`${dimensions} bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-sm flex items-center justify-center shrink-0 border border-blue-500/40 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[70%] h-[70%]"
      >
        {/* Main & Secondary Pyramids (Al-Ahram) */}
        <path
          d="M5 26.5L15.2 9.5L25.4 26.5H5Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
        <path
          d="M17.5 26.5L24.5 14.5L31.5 26.5H17.5Z"
          fill="#7DD3FC"
          fillOpacity="0.9"
        />
        {/* Clean Water & Shine Arc */}
        <path
          d="M7.5 29.2C13 27.6 23 27.6 28.5 29.2"
          stroke="#BAE6FD"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* Gleam Spark */}
        <circle cx="25.5" cy="9.5" r="2" fill="#E0F2FE" />
      </svg>
    </div>
  );
};
