import React from 'react';

export interface LogoProps {
  size?: number;
  tone?: 'dark' | 'light';
  markOnly?: boolean;
  className?: string;
}

/**
 * Trazo mark: a dotted route crossing a circle with a mint destination pin.
 * The wordmark is lowercase and set in Bricolage Grotesque.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 30,
  tone = 'dark',
  markOnly = false,
  className = '',
}) => {
  const circle = tone === 'dark' ? '#10262A' : '#F2F5F1';
  const route = tone === 'dark' ? '#FF6B3D' : '#FF6B3D';
  const pin = tone === 'dark' ? '#9ADBCB' : '#FFD36B';
  const word = tone === 'dark' ? 'text-forest' : 'text-sand';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 34 34"
        fill="none"
        aria-hidden="true"
        className="flex-none"
      >
        <circle cx="17" cy="17" r="17" fill={circle} />
        <path
          d="M7 24C12 8 20 28 27 10"
          stroke={route}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 6"
        />
        <circle cx="27" cy="10" r="3" fill={pin} />
      </svg>
      {markOnly ? null : (
        <span className={`font-heading text-[1.35em] font-extrabold leading-none tracking-tight ${word}`}>
          trazo
        </span>
      )}
    </span>
  );
};
