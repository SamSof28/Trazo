import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'cta' | 'outline' | 'danger-outline' | 'icon' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-sans font-bold cursor-pointer transition-all duration-200 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3';

  const sizeClasses = {
    sm: 'min-h-[36px] px-3.5 text-xs rounded-full gap-1.5',
    md: 'min-h-[46px] px-5 text-sm rounded-full gap-2',
    lg: 'min-h-[52px] px-7 text-base rounded-full gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-forest text-white border-0 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FF6B3D] active:translate-y-0 active:shadow-none',
    cta: 'bg-orange text-white border-0 hover:-translate-y-0.5 hover:shadow-[0_7px_0_#10262A] active:translate-y-0 active:shadow-none',
    outline:
      'bg-transparent text-forest border-[1.5px] border-border hover:bg-mint-light hover:border-forest active:bg-mint',
    'danger-outline':
      'bg-transparent text-orange-dark border-[1.5px] border-orange-dark hover:bg-orange-dark/10 active:bg-orange-dark/20',
    icon: 'w-10 h-10 p-0 rounded-full border-0 bg-transparent text-forest hover:bg-mint-light',
    ghost: 'bg-transparent text-forest border-0 hover:bg-mint-light',
  };

  const isIcon = variant === 'icon';

  return (
    <button
      className={`
        ${baseClasses}
        ${isIcon ? 'p-0 w-10 h-10 rounded-full' : sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};
