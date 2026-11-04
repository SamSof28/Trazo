import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntakeStore } from './store';
import { fetchFeaturedDestinations } from '../../shared/api/client';
import type { DestinationDto } from '@trazo/shared';
import { Button } from '../../shared/components/Button';
import { Chip } from '../../shared/components/Chip';

const SUGGESTION_CHIPS = [
  'Viaje a Cartagena 5 días en pareja',
  'Escapada a Medellín para 2 amigos con gastronomía',
  'Aventura en el Eje Cafetero 4 días familiar',
  'Playa y relax en San Andrés fin de semana',
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { startIntake, isLoading, error, clearError } = useIntakeStore();

  const [prompt, setPrompt] = useState('');
  const [featuredDestinations, setFeaturedDestinations] = useState<DestinationDto[]>([]);

  useEffect(() => {
    fetchFeaturedDestinations()
      .then(setFeaturedDestinations)
      .catch(() => {
        // Silencioso si falla la carga inicial de catálogo
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    try {
      const tripRequest = await startIntake(prompt.trim());
      navigate(`/workspace/${tripRequest.id}`);
    } catch {
      // El error se gestiona en el store
    }
  };

  const handleSelectChip = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="min-h-screen bg-sand text-forest flex flex-col justify-between p-6 sm:p-12">
      {/* Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-forest text-white flex items-center justify-center font-heading font-black text-lg">
            T
          </span>
          <span className="font-heading font-bold text-xl tracking-tight text-forest">Trazo</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full flex flex-col items-center text-center my-auto py-10">
        <span className="inline-block bg-mint px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-forest mb-6">
          Diseñador inteligente de viajes
        </span>

        <h1 className="font-heading font-black text-4xl sm:text-6xl text-forest tracking-tight max-w-3xl leading-[1.1] mb-6">
          ¿A dónde trazamos tu próximo viaje?
        </h1>

        <p className="font-sans text-muted text-base sm:text-lg max-w-xl mb-10">
          Escribe tu idea de viaje con total libertad. Nuestra inteligencia estructurada organizará hoteles, actividades y presupuesto por ti.
        </p>

        {/* Super Prompt Box */}
        <form onSubmit={handleSubmit} className="w-full max-w-3xl relative mb-6">
          <div className="relative flex items-center bg-white rounded-3xl p-3 shadow-lg border-[1.5px] border-border focus-within:border-forest transition-all">
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (error) clearError();
              }}
              placeholder="Ej: Quiero un viaje a Cartagena de 5 días para 2 personas, nos gusta la playa y la buena comida..."
              rows={3}
              maxLength={2000}
              className="w-full bg-transparent text-forest placeholder:text-muted/60 text-base sm:text-lg p-3 outline-none resize-none font-sans"
              disabled={isLoading}
            />

            <div className="absolute right-4 bottom-4">
              <Button
                type="submit"
                variant="cta"
                size="md"
                disabled={!prompt.trim() || isLoading}
                isLoading={isLoading}
              >
                Empezar a planear
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-3 text-left px-4 text-sm font-medium text-orange-dark bg-orange/10 py-2 rounded-xl">
              {error}
            </div>
          )}
        </form>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1">Ideas:</span>
          {SUGGESTION_CHIPS.map((chipText) => (
            <Chip
              key={chipText}
              variant="default"
              onClick={() => handleSelectChip(chipText)}
              className="text-xs py-1.5 min-h-[34px]"
            >
              {chipText}
            </Chip>
          ))}
        </div>

        {/* Destinos destacados */}
        {featuredDestinations.length > 0 && (
          <div className="w-full text-left">
            <h2 className="font-heading font-extrabold text-xl text-forest mb-4">
              Destinos destacados en Colombia
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {featuredDestinations.map((dest) => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setPrompt(`Quiero viajar a ${dest.city}, Colombia`)}
                  className="group relative h-36 rounded-2xl overflow-hidden text-left p-4 flex flex-col justify-end bg-forest text-white transition-all hover:scale-[1.02] shadow-sm"
                >
                  {dest.heroImageUrl && (
                    <img
                      src={dest.heroImageUrl}
                      alt={dest.city}
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/30 to-transparent" />
                  <div className="relative z-10">
                    <span className="font-heading font-bold text-lg leading-tight block">
                      {dest.city}
                    </span>
                    <span className="text-xs text-mint font-medium">{dest.country}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-muted py-4">
        Trazo Travel Planner • Conectado con IA y catálogo inteligente
      </footer>
    </div>
  );
};
