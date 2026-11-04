import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
}) => {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      name={name}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled && onChange) {
          onChange(!checked);
        }
      }}
      className={`
        relative inline-flex flex-none w-[52px] h-[30px] rounded-full transition-colors duration-200 cursor-pointer
        focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3
        disabled:opacity-60 disabled:cursor-not-allowed
        ${checked ? 'bg-forest' : 'bg-switch-off'}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          absolute top-1 left-1 w-[22px] h-[22px] rounded-full transition-transform duration-200
          ${checked ? 'translate-x-[22px] bg-orange' : 'translate-x-0 bg-white'}
        `}
      />
    </button>
  );
};
