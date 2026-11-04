import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'draft' | 'saved' | 'published' | 'archived' | 'admin' | 'advisor' | 'neutral' | 'active' | 'featured';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
}) => {
  const variantClasses = {
    draft: 'bg-gold text-forest',
    saved: 'bg-forest text-white',
    published: 'bg-teal text-forest',
    archived: 'bg-border text-muted',
    admin: 'bg-orange/15 text-orange-dark font-bold',
    advisor: 'bg-mint-light text-forest font-bold',
    neutral: 'bg-mint-light text-forest',
    active: 'bg-teal text-forest font-bold',
    featured: 'bg-gold text-forest font-bold',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-sans text-[11px] font-bold uppercase tracking-wider
        rounded-full px-2.5 py-1 select-none
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};
