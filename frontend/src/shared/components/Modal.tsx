import React, { useEffect } from 'react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`
          w-full ${maxWidthClasses[maxWidth]} bg-sand rounded-modal p-8 md:p-10
          shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4)] relative overflow-hidden
          animate-in zoom-in-95 duration-200
        `}
      >
        <div className="flex items-center justify-between mb-6">
          {title ? (
            <div className="font-heading font-extrabold text-2xl md:text-3xl text-forest">
              {title}
            </div>
          ) : (
            <div />
          )}
          {showCloseButton ? (
            <Button
              type="button"
              variant="icon"
              aria-label="Cerrar"
              onClick={onClose}
              className="ml-auto"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </Button>
          ) : null}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
};
