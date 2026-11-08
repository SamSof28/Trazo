import React from 'react';

export type IconName =
  | 'activity'
  | 'alert'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUpRight'
  | 'boat'
  | 'briefcase'
  | 'bus'
  | 'calendar'
  | 'camera'
  | 'car'
  | 'check'
  | 'checkCircle'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'city'
  | 'clock'
  | 'close'
  | 'coffee'
  | 'compass'
  | 'copy'
  | 'download'
  | 'edit'
  | 'external'
  | 'eye'
  | 'eyeOff'
  | 'grid'
  | 'heart'
  | 'hotel'
  | 'info'
  | 'leaf'
  | 'list'
  | 'loader'
  | 'lock'
  | 'logout'
  | 'mail'
  | 'map'
  | 'menu'
  | 'minus'
  | 'mountain'
  | 'music'
  | 'phone'
  | 'pin'
  | 'plane'
  | 'plus'
  | 'refresh'
  | 'route'
  | 'save'
  | 'search'
  | 'send'
  | 'settings'
  | 'shield'
  | 'sparkles'
  | 'star'
  | 'sun'
  | 'swap'
  | 'train'
  | 'trash'
  | 'user'
  | 'users'
  | 'wallet'
  | 'xCircle';

const paths: Record<IconName, React.ReactNode> = {
  activity: (
    <>
      <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" />
      <path d="M12 6v12" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 18l-6-6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17L17 7M8 7h9v9" />,
  boat: (
    <>
      <path d="M3 15l2 5h14l2-5" />
      <path d="M6 15l1-5h10l1 5" />
      <path d="M12 10V4l4 3-4 3z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="3" />
      <path d="M4 10h16M8 21v-4M16 21v-4" />
      <circle cx="8" cy="14" r=".5" />
      <circle cx="16" cy="14" r=".5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h3l2-3h6l2 3h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  car: (
    <>
      <path d="M5 16l1.5-5h11L19 16" />
      <rect x="3" y="16" width="18" height="4" rx="2" />
      <circle cx="7" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  city: <path d="M3 21h18M5 21V9l5-3v15M10 21V4l5 3v14M15 21V10l4 2v9" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: <path d="M5 5l14 14M19 5L5 19" />,
  coffee: (
    <>
      <path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z" />
      <path d="M17 9h2a3 3 0 010 6h-2M4 22h14" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" />
    </>
  ),
  download: <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4 11.5-11.5z" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: <path d="M17.9 17.9A10 10 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015-5.9M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.2 3.2M14.1 14.1a3 3 0 01-4.2-4.2M2 2l20 20" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  heart: <path d="M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />,
  hotel: (
    <>
      <path d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 21c0-8 5-14 16-16-2 11-8 16-16 16z" />
      <path d="M5 21c3-6 7-9 12-11" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  loader: <path d="M12 3a9 9 0 109 9" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  logout: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  map: (
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <path d="M5 12h14" />,
  mountain: <path d="M3 20l7-12 4 6 2-3 5 9H3z" />,
  music: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </>
  ),
  phone: <path d="M5 3h4l2 5-3 2a14 14 0 006 6l2-3 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z" />,
  pin: (
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  plane: (
    <>
      <path d="M2 16l20-6-20-6 4 6-4 6z" />
      <path d="M6 10h8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />,
  route: (
    <>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 004-4V9" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v15H5V3z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
  sparkles: (
    <>
      <path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </>
  ),
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  train: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14M9 21l-2-4M15 21l2-4" />
      <circle cx="9" cy="14" r=".5" />
      <circle cx="15" cy="14" r=".5" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20" />
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M17 4.5a3.5 3.5 0 010 7M21 20v-1.5a4 4 0 00-3-3.87" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14h2" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
};

export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
    {...props}
  >
    {paths[name]}
  </svg>
);
