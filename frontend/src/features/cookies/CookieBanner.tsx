import React, { useState } from 'react';
import { useCookieStore } from './cookie-store';
import { Modal } from '../../shared/components/Modal';
import { Toggle } from '../../shared/components/Toggle';

export const CookieBanner: React.FC = () => {
  const {
    hasConsent,
    preferences,
    isModalOpen,
    acceptAll,
    acceptNecessaryOnly,
    openModal,
    closeModal,
    setConsent,
  } = useCookieStore();

  const [localDrafts, setLocalDrafts] = useState(preferences.drafts);
  const [localAnalytics, setLocalAnalytics] = useState(preferences.analytics);

  const handleOpenModal = () => {
    setLocalDrafts(preferences.drafts);
    setLocalAnalytics(preferences.analytics);
    openModal();
  };

  const handleSaveModal = () => {
    setConsent({ drafts: localDrafts, analytics: localAnalytics });
  };

  return (
    <>
      {/* Banner flotante */}
      {!hasConsent ? (
        <aside
          role="region"
          aria-label="Aviso de cookies"
          className="animate-toast-in fixed bottom-4 left-4 z-40 box-border w-[calc(100%-2rem)] rounded-[28px] bg-forest p-6 font-sans text-white shadow-[0_24px_50px_-20px_rgba(0,0,0,0.7)] sm:bottom-8 sm:left-8 sm:w-[420px]"
        >
          <div className="font-heading font-extrabold text-xl sm:text-[22px] tracking-tight">
            Cookies, sin letra pequeña 🍪
          </div>
          <p className="mt-2 mb-4 text-sm text-[#C9D8D5] leading-relaxed">
            Usamos cookies necesarias para que Trazo funcione y, si quieres, otras para recordar tus
            planes y mejorar tu experiencia.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={acceptAll}
              className="flex-1 min-h-[46px] rounded-full font-bold text-sm bg-orange text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_0_#10262A] active:translate-y-0 transition-all"
            >
              Aceptar todas
            </button>
            <button
              type="button"
              onClick={acceptNecessaryOnly}
              className="flex-1 min-h-[46px] rounded-full font-bold text-sm bg-transparent text-white border border-white/40 cursor-pointer hover:bg-white/10 transition-colors"
            >
              Solo necesarias
            </button>
          </div>
          <div className="mt-3 text-xs text-[#C9D8D5]">
            <button
              type="button"
              onClick={handleOpenModal}
              className="text-teal underline cursor-pointer hover:text-white"
            >
              Personalizar
            </button>
          </div>
        </aside>
      ) : null}

      {/* Modal de Personalización de Preferencias */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          <span>
            Tu privacidad,{' '}
            <span className="bg-gold text-forest rounded-xl px-2 py-0.5 inline-block">
              tus reglas
            </span>
          </span>
        }
      >
        <p className="text-sm text-muted -mt-2 mb-5 leading-relaxed">
          Elige qué podemos recordar. Puedes cambiarlo cuando quieras.
        </p>

        <div className="flex flex-col gap-2">
          {/* Necesarias */}
          <div className="flex items-center justify-between py-3.5 border-t border-divider">
            <div>
              <b className="text-forest text-sm">Necesarias</b>
              <div className="text-xs text-muted mt-0.5">Sesión y seguridad. Siempre activas.</div>
            </div>
            <Toggle checked disabled aria-label="Cookies necesarias" />
          </div>

          {/* Borradores */}
          <div className="flex items-center justify-between py-3.5 border-t border-divider">
            <div>
              <b className="text-forest text-sm">Borradores y preferencias</b>
              <div className="text-xs text-muted mt-0.5">Recordamos tus planes sin guardar.</div>
            </div>
            <Toggle
              checked={localDrafts}
              onChange={setLocalDrafts}
              aria-label="Recordar borradores"
            />
          </div>

          {/* Analítica */}
          <div className="flex items-center justify-between py-3.5 border-t border-divider">
            <div>
              <b className="text-forest text-sm">Analítica</b>
              <div className="text-xs text-muted mt-0.5">
                Nos ayuda a mejorar Trazo, de forma anónima.
              </div>
            </div>
            <Toggle
              checked={localAnalytics}
              onChange={setLocalAnalytics}
              aria-label="Permitir analítica"
            />
          </div>
        </div>

        <div className="flex gap-2.5 mt-6 flex-wrap">
          <button
            type="button"
            onClick={handleSaveModal}
            className="flex-1 min-h-[48px] rounded-full font-bold text-sm bg-forest text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_0_#FF6B3D] active:translate-y-0 transition-all"
          >
            Guardar preferencias
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="px-5 min-h-[48px] rounded-full font-bold text-sm bg-transparent text-forest border border-border cursor-pointer hover:bg-mint-light transition-colors"
          >
            Aceptar todas
          </button>
        </div>
      </Modal>
    </>
  );
};
