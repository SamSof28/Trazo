import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { registerSchema } from '@trazo/shared';
import { ApiError } from '../../shared/api/client';
import { Logo } from '../../shared/components/Logo';
import { useAuthStore } from './store';

type RegisterField = 'name' | 'agency' | 'email' | 'password' | 'acceptTerms';

interface FieldErrors {
  name?: string;
  agency?: string;
  email?: string;
  password?: string;
  acceptTerms?: string;
}

function passwordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: 'Mínimo 12 caracteres' };

  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Débil', 'Débil', 'Media', 'Buena', 'Fuerte'];
  return { score, label: labels[score] ?? 'Fuerte' };
}

const fieldClass = (hasError: boolean): string => `
  w-full box-border min-h-[50px] border-[1.5px] rounded-full bg-white px-5 text-base font-sans text-forest
  placeholder:text-muted/60 transition-colors
  focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2 focus-visible:border-forest
  ${hasError ? 'border-orange-dark' : 'border-border'}
`;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, status, register } = useAuthStore();

  const [name, setName] = useState('');
  const [agency, setAgency] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  if (status === 'authenticated' && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const validation = registerSchema.safeParse({
      name,
      agency: agency || undefined,
      email,
      password,
      acceptTerms,
    });

    if (!validation.success) {
      const errors: FieldErrors = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as RegisterField | undefined;
        if (field && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await register(validation.data);
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setErrorMsg('Ya existe una cuenta con este correo. Inicia sesión para continuar.');
        } else if (error.status === 429) {
          setErrorMsg('Demasiados intentos de registro. Espera un minuto e inténtalo de nuevo.');
        } else if (error.problem?.errors?.length) {
          const errors: FieldErrors = {};
          for (const issue of error.problem.errors) {
            const field = issue.field as RegisterField;
            if (field && !errors[field]) errors[field] = issue.message;
          }
          setFieldErrors(errors);
          setErrorMsg('Revisa los campos marcados para continuar.');
        } else if (error.problem?.detail) {
          setErrorMsg(error.problem.detail);
        } else {
          setErrorMsg('No pudimos crear tu cuenta. Inténtalo de nuevo.');
        }
      } else {
        setErrorMsg('No fue posible conectar con el servidor.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthColor = (index: number): string => {
    if (strength.score === 0) return 'bg-divider';
    if (index < strength.score) {
      if (strength.score <= 2) return 'bg-orange';
      if (strength.score === 3) return 'bg-gold';
      return 'bg-teal';
    }
    return 'bg-divider';
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-forest flex items-center justify-center p-4 sm:p-6 box-border">
      <div className="absolute inset-0 bg-mint filter blur-[3px]" aria-hidden="true">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <pattern id="register-dot-pattern" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.6" fill="#10262A" fillOpacity="0.1" />
            </pattern>
          </defs>
          <rect width="1440" height="900" fill="url(#register-dot-pattern)" />
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

        <div className="absolute left-[64%] top-[46%] hidden sm:flex items-center gap-2 font-sans font-bold text-xs bg-white text-forest rounded-full py-1.5 px-3.5 shadow-sm">
          <i className="w-8 h-8 rounded-full bg-teal flex items-center justify-center not-italic font-normal">
            ✈
          </i>
          Cartagena · COP 2.844.000
        </div>
        <div className="absolute left-[16%] top-[28%] hidden sm:flex items-center gap-2 font-sans font-bold text-xs bg-white text-forest rounded-full py-1.5 px-3.5 shadow-sm">
          <i className="w-8 h-8 rounded-full bg-teal flex items-center justify-center not-italic font-normal">
            ✈
          </i>
          San Andrés · COP 4.120.000
        </div>
      </div>

      <div className="absolute inset-0 bg-forest/80" aria-hidden="true" />

      <div
        role="dialog"
        aria-labelledby="register-title"
        className="animate-pop relative box-border w-full max-w-[980px] overflow-hidden rounded-[36px] bg-sand shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65)] lg:flex"
      >
        <aside className="relative hidden w-[380px] flex-none flex-col overflow-hidden bg-forest p-9 text-white lg:flex">
          <Logo size={34} tone="light" />
          <h2 className="font-heading mt-9 text-[40px] font-extrabold leading-[1.05]">
            Empieza a <span className="italic text-orange">trazar</span> viajes que se venden.
          </h2>

          <div className="mt-8 flex flex-col gap-4">
            {[
              'Planes completos en menos de 30 segundos',
              'Hoteles y actividades reales del catálogo',
              'Tu margen, siempre privado',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-[15px] font-medium leading-snug">
                <i className="grid h-7 w-7 flex-none place-items-center rounded-full bg-teal not-italic font-bold text-forest">
                  ✓
                </i>
                {benefit}
              </div>
            ))}
          </div>

          <div className="relative mt-auto pt-8">
            <svg
              className="absolute -right-5 top-0"
              width="300"
              height="120"
              viewBox="0 0 300 120"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 100C80 120 120 20 200 50S280 20 310 0"
                stroke="#9ADBCB"
                strokeOpacity="0.6"
                strokeWidth="2.5"
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
            </svg>
            <div className="relative w-[210px] -rotate-[4deg] rounded-[22px] bg-gold p-4 text-forest shadow-[0_18px_34px_-16px_rgba(0,0,0,0.65)]">
              <p className="text-[15px] font-bold">Cartagena · 5 días</p>
              <p className="text-[13px] font-medium">Pareja · Playa · Cultura</p>
              <p className="font-heading mt-1.5 text-2xl font-extrabold">COP 2.162.000</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 p-6 sm:p-10">
          <div className="flex items-center justify-between lg:justify-end">
            <Logo size={28} className="lg:hidden" />
            <button
              type="button"
              aria-label="Cerrar registro"
              onClick={() => navigate('/login')}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-forest transition-colors hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
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
            </button>
          </div>

          <h1
            id="register-title"
            className="font-heading mt-2 text-4xl font-extrabold leading-[1.05] sm:text-[40px]"
          >
            Crea tu cuenta de{' '}
            <span className="inline-block rounded-[14px] bg-orange px-2.5 text-white">asesor</span>
          </h1>
          <p className="mt-3 text-[15px] text-muted">
            Toma menos de un minuto. Sin tarjeta de crédito.
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() =>
                setOauthNotice(
                  'El registro con Google estará disponible pronto. Por ahora crea tu cuenta con tu correo.',
                )
              }
              className="min-h-12 flex-1 cursor-pointer rounded-full border-[1.5px] border-border bg-white px-4 font-sans text-[15px] font-medium text-forest transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            >
              Registrarme con Google
            </button>
            <button
              type="button"
              onClick={() =>
                setOauthNotice(
                  'El registro con Facebook estará disponible pronto. Por ahora crea tu cuenta con tu correo.',
                )
              }
              className="min-h-12 flex-1 cursor-pointer rounded-full border-[1.5px] border-border bg-white px-4 font-sans text-[15px] font-medium text-forest transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            >
              Registrarme con Facebook
            </button>
          </div>

          {oauthNotice ? (
            <p role="status" className="mt-3 rounded-2xl bg-mint-light px-4 py-2.5 text-xs text-muted">
              {oauthNotice}
            </p>
          ) : null}

          <div className="mt-5 flex items-center gap-3.5 text-sm text-muted">
            <span className="h-px flex-1 bg-border" />
            o con tu correo
            <span className="h-px flex-1 bg-border" />
          </div>

          {errorMsg ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-2xl border border-orange-dark/30 bg-orange-dark/10 p-3 text-sm font-medium text-orange-dark"
            >
              <svg
                className="mt-0.5 flex-none"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5" noValidate>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px] flex-1">
                <label htmlFor="register-name" className="mb-1.5 ml-1.5 block text-[13px] font-bold">
                  Nombre completo
                </label>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="María Gómez"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
                  className={fieldClass(Boolean(fieldErrors.name))}
                />
                {fieldErrors.name ? (
                  <p id="register-name-error" className="ml-4 mt-1 text-xs font-medium text-orange-dark">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>

              <div className="min-w-[180px] flex-1">
                <label htmlFor="register-agency" className="mb-1.5 ml-1.5 block text-[13px] font-bold">
                  Agencia <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="register-agency"
                  type="text"
                  autoComplete="organization"
                  value={agency}
                  onChange={(event) => setAgency(event.target.value)}
                  placeholder="Viajes del Valle"
                  aria-invalid={Boolean(fieldErrors.agency)}
                  aria-describedby={fieldErrors.agency ? 'register-agency-error' : undefined}
                  className={fieldClass(Boolean(fieldErrors.agency))}
                />
                {fieldErrors.agency ? (
                  <p id="register-agency-error" className="ml-4 mt-1 text-xs font-medium text-orange-dark">
                    {fieldErrors.agency}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="mb-1.5 ml-1.5 block text-[13px] font-bold">
                Correo electrónico
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@agencia.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                className={fieldClass(Boolean(fieldErrors.email))}
              />
              {fieldErrors.email ? (
                <p id="register-email-error" className="ml-4 mt-1 text-xs font-medium text-orange-dark">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="register-password" className="mb-1.5 ml-1.5 block text-[13px] font-bold">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 12 caracteres"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby="register-password-help"
                  className={`${fieldClass(Boolean(fieldErrors.password))} pr-14`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1 grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-forest transition-colors hover:bg-mint-light focus-visible:outline-3 focus-visible:outline-orange"
                >
                  {showPassword ? (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-2.5 px-1.5">
                <div
                  className="flex flex-1 gap-1.5"
                  role="img"
                  aria-label={`Seguridad de la contraseña: ${strength.label}`}
                >
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-1.5 flex-1 rounded-full ${strengthColor(index)}`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold">{strength.label}</span>
              </div>
              <p id="register-password-help" className="ml-1.5 mt-1.5 text-xs text-muted">
                {fieldErrors.password ??
                  'Usa al menos 12 caracteres, una mayúscula y un número para hacerla más fuerte.'}
              </p>
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  aria-invalid={Boolean(fieldErrors.acceptTerms)}
                  aria-describedby={fieldErrors.acceptTerms ? 'register-terms-error' : undefined}
                  className="mt-0.5 h-[22px] w-[22px] flex-none accent-forest"
                />
                <span>
                  Acepto los{' '}
                  <span className="underline decoration-orange decoration-2 underline-offset-2">
                    términos de uso
                  </span>{' '}
                  y la{' '}
                  <span className="underline decoration-orange decoration-2 underline-offset-2">
                    política de privacidad
                  </span>{' '}
                  de Trazo.
                </span>
              </label>
              {fieldErrors.acceptTerms ? (
                <p id="register-terms-error" className="ml-8 mt-1 text-xs font-medium text-orange-dark">
                  {fieldErrors.acceptTerms}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-forest font-sans text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FF6B3D] active:translate-y-0 active:shadow-none focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Creando tu cuenta…</span>
                </>
              ) : (
                'Crear mi cuenta'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              className="font-bold text-forest underline decoration-orange decoration-2 underline-offset-4 hover:text-orange-dark focus-visible:outline-3 focus-visible:outline-orange focus-visible:outline-offset-2"
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
