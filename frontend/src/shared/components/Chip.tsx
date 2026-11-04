import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'default' | 'mint' | 'gold' | 'dark';
}

export const Chip: React.FC<ChipProps> = ({
  children,
  active = false,
  variant = 'default',
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 font-sans text-sm rounded-full px-4 py-2 min-h-[40px] cursor-pointer transition-all duration-200 select-none border-[1.5px] focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    default: active
      ? 'bg-teal border-teal text-forest font-bold shadow-xs'
      : 'bg-white border-border text-forest font-medium hover:bg-mint hover:-translate-y-0.5 hover:-rotate-1',
    mint: 'bg-mint-light border-mint text-forest font-medium hover:bg-mint hover:-translate-y-0.5',
    gold: 'bg-gold border-gold text-forest font-bold hover:-translate-y-0.5',
    dark: 'bg-forest border-forest text-white font-bold hover:bg-forest/90',
  };

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
