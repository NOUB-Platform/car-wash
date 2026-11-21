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
      className={`${dimensions} bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white shadow-sm flex items-center justify-center shrink-0 border border-blue-400/40 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[74%] h-[74%]"
      >
        {/* Stylized 'P' for Perfect */}
        <path
          d="M10 27V9.5H19.2C23.2 9.5 25.8 11.8 25.8 15.3C25.8 18.8 23.2 21.1 19.2 21.1H14.2V27H10ZM14.2 17.5H18.8C20.5 17.5 21.6 16.6 21.6 15.3C21.6 14 20.5 13.1 18.8 13.1H14.2V17.5Z"
          fill="currentColor"
        />
        {/* Glossy Water & Car Shine Wave */}
        <path
          d="M7.5 29.8C13.5 27.9 22.8 27.9 28.8 29.8"
          stroke="#7DD3FC"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Shine Spark */}
        <path
          d="M27.5 7.5L28.4 9.6L30.5 10.5L28.4 11.4L27.5 13.5L26.6 11.4L24.5 10.5L26.6 9.6L27.5 7.5Z"
          fill="#BAE6FD"
        />
      </svg>
    </div>
  );
};
