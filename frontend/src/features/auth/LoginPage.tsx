import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { loginSchema } from '@trazo/shared';
import { useAuthStore } from './store';
import { ApiError } from '../../shared/api/client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, status, login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si ya está autenticado, redirigir a inicio
  if (status === 'authenticated' && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    // Validación con Zod
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors: { email?: string; password?: string } = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as 'email' | 'password';
        if (field) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMsg('Correo o contraseña incorrectos.');
        } else if (err.status === 429) {
          setErrorMsg('Demasiados intentos. Por favor espera un minuto.');
        } else if (err.problem?.detail) {
          setErrorMsg(err.problem.detail);
        } else {
          setErrorMsg('Ocurrió un error al iniciar sesión. Inténtalo de nuevo.');
        }
      } else {
        setErrorMsg('No fue posible conectar con el servidor.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-forest flex items-center justify-center p-6 box-border">
      {/* Fondo decorativo con mapa y pines */}
      <div className="absolute inset-0 bg-mint filter blur-[3px]" aria-hidden="true">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <pattern id="dot-pattern" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.6" fill="#10262A" fillOpacity="0.1" />
            </pattern>
          </defs>
          <rect width="1440" height="900" fill="url(#dot-pattern)" />
          <path
            d="M0 0H900L840 90 760 170 660 230 560 200 440 240 320 200 160 170 0 130Z"
            fill="#F2F5F1"
          />
          <path
            d="M880 400L1010 420 1120 500 1140 610 1070 700 1010 830 960 900H880L860 700 850 520Z"
            fill="#F2F5F1"
          />
          <path
            d="M960 470C1100 300 900 240 700 250"
            stroke="#10262A"
            strokeOpacity="0.35"
            strokeWidth="3"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
        </svg>

        {/* Pines de precio decorativos */}
        <div className="absolute left-[62%] top-[44%] hidden sm:flex items-center gap-2 font-sans font-bold text-xs bg-white text-forest rounded-full py-1.5 px-3.5 shadow-sm">
          <i className="w-8 h-8 rounded-full bg-teal flex items-center justify-center not-italic font-normal">
            ✈
          </i>
          Cartagena · COP 2.844.000
        </div>
        <div className="absolute left-[20%] top-[30%] hidden sm:flex items-center gap-2 font-sans font-bold text-xs bg-white text-forest rounded-full py-1.5 px-3.5 shadow-sm">
          <i className="w-8 h-8 rounded-full bg-teal flex items-center justify-center not-italic font-normal">
            ✈
          </i>
          San Andrés · COP 4.120.000
        </div>
      </div>

      {/* Overlay oscuro semitransparente */}
      <div className="absolute inset-0 bg-forest/80" aria-hidden="true" />

      {/* Tarjeta del formulario de Login */}
      <div
        role="dialog"
        aria-labelledby="login-title"
        className="animate-pop relative box-border w-full max-w-[520px] rounded-modal bg-sand p-8 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65)] sm:p-10"
      >
        {/* Logo superior */}
        <div className="flex items-center justify-between">
          <span className="font-heading font-extrabold text-2xl flex items-center gap-2.5 text-forest tracking-tight">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <circle cx="17" cy="17" r="17" fill="#10262A" />
              <path
                d="M7 24C12 8 20 28 27 10"
                stroke="#FF6B3D"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="1 6"
              />
              <circle cx="27" cy="10" r="3" fill="#9ADBCB" />
            </svg>
            trazo
          </span>
        </div>

        {/* Título */}
        <h1
          id="login-title"
          className="font-heading font-extrabold text-4xl sm:text-[46px] leading-[1.05] mt-6 text-forest"
        >
          Qué bueno
          <br />
          <span className="bg-orange text-white rounded-2xl px-3 py-0.5 inline-block mt-1.5">
            verte de nuevo
          </span>
        </h1>

        {/* Tags de valor */}
        <div className="flex flex-wrap gap-2.5 mt-6">
          <span className="font-sans font-medium text-xs sm:text-sm rounded-full py-2 px-3.5 inline-flex items-center gap-2 bg-mint-light text-forest">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10262A"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18" />
            </svg>
            Catálogo real
          </span>
          <span className="font-sans font-medium text-xs sm:text-sm rounded-full py-2 px-3.5 inline-flex items-center gap-2 bg-mint-light text-forest">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10262A"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 13v-1a7 7 0 0114 0v1M5 13h3v5H5zM16 13h3v5h-3z" />
            </svg>
            Tu margen siempre privado
          </span>
          <span className="font-sans font-medium text-xs sm:text-sm rounded-full py-2 px-3.5 inline-flex items-center gap-2 bg-mint-light text-forest">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10262A"
              strokeWidth="2"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </svg>
            Planes seguros
          </span>
        </div>

        {/* Mensaje de error general si aplica */}
        {errorMsg ? (
          <div
            role="alert"
            className="mt-5 p-3 rounded-2xl bg-orange-dark/10 border border-orange-dark/30 text-orange-dark text-sm font-medium flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </div>
        ) : null}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-6" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="sr-only">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className={`
                w-full box-border min-h-[52px] border-[1.5px] rounded-full bg-white px-5 text-base font-sans text-forest
                placeholder:text-muted/60 transition-colors
                focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2 focus-visible:border-forest
                ${fieldErrors.email ? 'border-orange-dark' : 'border-border'}
              `}
            />
            {fieldErrors.email ? (
              <p className="mt-1 ml-4 text-xs text-orange-dark font-medium">{fieldErrors.email}</p>
            ) : null}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <label htmlFor="login-password" className="sr-only">
                Contraseña
              </label>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className={`
                  w-full box-border min-h-[52px] border-[1.5px] rounded-full bg-white pl-5 pr-14 text-base font-sans text-forest
                  placeholder:text-muted/60 transition-colors
                  focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2 focus-visible:border-forest
                  ${fieldErrors.password ? 'border-orange-dark' : 'border-border'}
                `}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1.5 w-10 h-10 rounded-full border-0 bg-transparent flex items-center justify-center cursor-pointer text-forest hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
              >
                {showPassword ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-1 ml-4 text-xs text-orange-dark font-medium">{fieldErrors.password}</p>
            ) : null}
          </div>

          {/* Botón CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 font-sans font-bold text-base text-white bg-forest border-0 rounded-full min-h-[52px] w-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FF6B3D] active:translate-y-0 active:shadow-none focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Ingresando…</span>
              </>
            ) : (
              <span>Iniciar sesión</span>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Plataforma de asesores turísticos · Acceso administrado
        </p>
      </div>
    </div>
  );
};
