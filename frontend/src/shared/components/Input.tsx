import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hideLabel = false, error, helperText, rightElement, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className={
              hideLabel
                ? 'sr-only'
                : 'block font-sans font-bold text-xs text-forest ml-2 mb-1.5'
            }
          >
            {label}
          </label>
        ) : null}

        <div className="relative flex items-center">
          <input
            id={inputId}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`
              w-full min-h-[50px] rounded-full border-[1.5px] bg-white px-5 text-base text-forest
              placeholder:text-muted/60 transition-colors
              focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2 focus-visible:border-forest
              disabled:opacity-60 disabled:cursor-not-allowed
              ${error ? 'border-orange-dark' : 'border-border'}
              ${rightElement ? 'pr-14' : ''}
              ${className}
            `}
            {...props}
          />
          {rightElement ? (
            <div className="absolute right-2 flex items-center justify-center">
              {rightElement}
            </div>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} className="mt-1.5 ml-3 text-xs text-orange-dark font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1.5 ml-3 text-xs text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
