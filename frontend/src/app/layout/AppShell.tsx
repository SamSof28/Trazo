import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store';
import { initials } from '../../shared/lib/format';
import { Icon } from '../../shared/components/Icon';
import { Logo } from '../../shared/components/Logo';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `rounded-full px-3.5 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-mint-light font-bold text-forest'
      : 'font-medium text-muted hover:bg-mint-light/70 hover:text-forest'
  }`;

export const AppShell: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const links = [
    { to: '/plans', label: 'Mis planes' },
    { to: '/catalog', label: 'Catálogo' },
    ...(user.role === 'ADMIN' ? [{ to: '/admin/users', label: 'Equipo' }] : []),
  ];

  return (
    <div className="min-h-dvh bg-sand text-forest">
      <a
        href="#contenido"
        className="sr-only z-[80] rounded-full bg-forest px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 border-b border-divider bg-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="Trazo, ir al inicio"
            className="rounded-full focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-4"
          >
            <Logo size={30} />
          </Link>

          <nav className="ml-5 hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/?mode=ia"
              className="hidden min-h-[38px] items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_0_#FF6B3D] focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3 sm:inline-flex"
            >
              <Icon name="sparkles" size={15} />
              Nuevo viaje
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent py-1 pl-1 pr-2 transition-colors hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 flex-none place-items-center rounded-full bg-teal text-[13px] font-bold text-forest"
                >
                  {initials(user.name)}
                </span>
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block max-w-[150px] truncate text-sm font-bold">{user.name}</span>
                  <span className="block text-[11px] text-muted">
                    {user.role === 'ADMIN' ? 'Administrador' : 'Asesor'}
                  </span>
                </span>
                <Icon
                  name="chevronDown"
                  size={15}
                  className={`hidden text-muted transition-transform lg:block ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  aria-label="Cuenta"
                  className="animate-pop absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-[22px] border border-divider bg-white p-2 shadow-[0_24px_50px_-24px_rgba(16,38,42,0.4)]"
                >
                  <div className="rounded-2xl bg-sand px-3 py-2.5">
                    <p className="truncate text-sm font-bold">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <Link
                    role="menuitem"
                    to="/plans"
                    className="mt-1 flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
                  >
                    <Icon name="grid" size={17} /> Mis planes
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-orange-dark transition-colors hover:bg-orange-dark/10 focus-visible:outline-3 focus-visible:outline-orange"
                  >
                    <Icon name="logout" size={17} /> Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-forest transition-colors hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange md:hidden"
            >
              <Icon name={mobileOpen ? 'close' : 'menu'} size={21} />
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav
            aria-label="Navegación móvil"
            className="animate-pop border-t border-divider bg-white px-4 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
              <Link
                to="/?mode=ia"
                className="mt-1 inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full bg-forest px-4 text-sm font-bold text-white"
              >
                <Icon name="sparkles" size={15} /> Nuevo viaje
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="mt-1 inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-orange-dark/40 bg-transparent px-4 text-sm font-bold text-orange-dark"
              >
                <Icon name="logout" size={16} /> Cerrar sesión
              </button>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="contenido">
        <Outlet />
      </main>
    </div>
  );
};
