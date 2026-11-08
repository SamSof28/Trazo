import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, Role } from '@trazo/shared';
import { errorMessage } from '../../shared/api/client';
import { createUser, listUsers } from '../../shared/api/users';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { Input } from '../../shared/components/Input';
import { Modal } from '../../shared/components/Modal';
import { toast } from '../../shared/components/Toast';
import { formatDateTime, initials } from '../../shared/lib/format';
import { useAuthStore } from '../auth/store';

type RoleFilter = 'ALL' | Role;

const roleLabel: Record<Role, string> = {
  ADMIN: 'Administrador',
  ADVISOR: 'Asesor',
};

const roleFilters: Array<{ value: RoleFilter; label: string }> = [
  { value: 'ALL', label: 'Todo el equipo' },
  { value: 'ADVISOR', label: 'Asesores' },
  { value: 'ADMIN', label: 'Administradores' },
];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'ADVISOR' as Role,
};

const avatarTones = [
  'bg-teal text-forest',
  'bg-gold text-forest',
  'bg-mint text-forest',
  'bg-forest text-white',
];

function toneFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % avatarTones.length;
  return avatarTones[hash] ?? avatarTones[0];
}

const StatCard: React.FC<{ label: string; value: number; icon: 'grid' | 'shield' | 'briefcase' | 'checkCircle' }> = ({
  label,
  value,
  icon,
}) => (
  <div className="flex items-center gap-3 rounded-[20px] border border-divider bg-white px-4 py-3.5">
    <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-mint-light text-forest">
      <Icon name={icon} size={18} />
    </span>
    <div>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="font-heading text-xl font-extrabold leading-tight">{value}</p>
    </div>
  </div>
);

export const AdminUsersPage: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: listUsers,
  });

  const users = usersQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (!term) return true;
      return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    });
  }, [users, roleFilter, search]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === 'ADMIN').length,
      advisors: users.filter((user) => user.role === 'ADVISOR').length,
      active: users.filter((user) => user.isActive).length,
    }),
    [users],
  );

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      toast.success(`${user.name} ya puede entrar a Trazo.`);
      setCreateOpen(false);
      setForm(emptyForm);
      setFormError(null);
      setFieldErrors({});
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const closeCreate = () => {
    if (createMutation.isPending) return;
    setCreateOpen(false);
    setFormError(null);
    setFieldErrors({});
  };

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = 'Escribe el nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Escribe un email válido.';
    if (form.password.length < 12) errors.password = 'Usa al menos 12 caracteres.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setFormError(null);
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-dark">
            Administración
          </p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold leading-none sm:text-5xl">
            El equipo de la agencia
          </h1>
          <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">
            Crea accesos para tus asesores. Cada asesor ve solo sus planes; los administradores
            gestionan el catálogo y todo el equipo.
          </p>
        </div>
        <Button variant="cta" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={17} /> Invitar al equipo
        </Button>
      </header>

      <section
        aria-label="Resumen del equipo"
        className="animate-rise-delayed mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard label="Personas" value={stats.total} icon="grid" />
        <StatCard label="Asesores" value={stats.advisors} icon="briefcase" />
        <StatCard label="Administradores" value={stats.admins} icon="shield" />
        <StatCard label="Accesos activos" value={stats.active} icon="checkCircle" />
      </section>

      <section aria-label="Filtros del equipo" className="mt-8 rounded-[24px] border border-divider bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar personas</span>
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o email…"
              className="min-h-[46px] w-full rounded-full border border-border bg-sand pl-11 pr-4 text-sm text-forest outline-none transition-colors placeholder:text-muted/70 focus:border-teal focus:bg-white"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {roleFilters.map((filter) => {
              const active = roleFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoleFilter(filter.value)}
                  className={`min-h-[38px] cursor-pointer rounded-full px-3.5 text-xs font-bold transition-colors focus-visible:outline-3 focus-visible:outline-orange ${
                    active
                      ? 'bg-forest text-white'
                      : 'bg-sand text-muted hover:bg-mint-light hover:text-forest'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {usersQuery.isLoading ? (
            'Cargando equipo…'
          ) : (
            <>
              <span className="font-bold text-forest">{filtered.length}</span>{' '}
              {filtered.length === 1 ? 'persona' : 'personas'}
            </>
          )}
        </p>
        {usersQuery.isFetching && !usersQuery.isLoading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Icon name="loader" size={14} className="animate-spin" /> Actualizando
          </span>
        ) : null}
      </div>

      {usersQuery.isError ? (
        <div className="mt-4 rounded-[24px] border border-orange-dark/25 bg-white p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange/15 text-orange-dark">
            <Icon name="alert" size={22} />
          </span>
          <h2 className="mt-3 font-heading text-xl font-extrabold">No pudimos cargar el equipo</h2>
          <p className="mt-1 text-sm text-muted">{errorMessage(usersQuery.error)}</p>
          <Button className="mt-4" variant="outline" onClick={() => void usersQuery.refetch()}>
            <Icon name="refresh" size={16} /> Reintentar
          </Button>
        </div>
      ) : usersQuery.isLoading ? (
        <div className="mt-4 overflow-hidden rounded-[26px] border border-divider bg-white">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-divider p-4 last:border-0">
              <div className="h-11 w-11 animate-pulse rounded-full bg-divider" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/5 animate-pulse rounded-full bg-divider" />
                <div className="h-3 w-3/5 animate-pulse rounded-full bg-divider" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-[28px] border border-divider bg-white px-6 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-mint-light text-forest">
            <Icon name="search" size={24} />
          </span>
          <h2 className="mt-4 font-heading text-2xl font-extrabold">Sin coincidencias</h2>
          <p className="mt-1 text-sm text-muted">Prueba con otro nombre, email o rol.</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              setSearch('');
              setRoleFilter('ALL');
            }}
          >
            <Icon name="close" size={16} /> Limpiar filtros
          </Button>
        </div>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-[26px] border border-divider bg-white">
          {filtered.map((user) => (
            <TeamRow key={user.id} user={user} isCurrent={user.id === currentUser?.id} />
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-[20px] border border-border bg-mint-light/60 p-4 text-sm leading-relaxed text-forest">
        <Icon name="shield" size={19} className="mt-0.5 flex-none" />
        <p>
          Por seguridad, las contraseñas se guardan cifradas y nunca se muestran. Comparte el acceso
          inicial por un canal privado y pide cambiarla al primer ingreso.
        </p>
      </div>

      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title="Nueva persona en el equipo"
        maxWidth="md"
      >
        <form onSubmit={submitCreate} className="space-y-4" noValidate>
          <Input
            label="Nombre completo"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Camila Restrepo"
            autoComplete="name"
            error={fieldErrors.name}
            required
          />
          <Input
            label="Email de trabajo"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="camila@agencia.co"
            autoComplete="email"
            error={fieldErrors.email}
            required
          />
          <Input
            label="Contraseña temporal"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Mínimo 12 caracteres"
            autoComplete="new-password"
            error={fieldErrors.password}
            helperText="La persona podrá cambiarla después del primer ingreso."
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted transition-colors hover:bg-mint-light hover:text-forest focus-visible:outline-3 focus-visible:outline-orange"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
              </button>
            }
            required
          />

          <fieldset>
            <legend className="ml-2 mb-1.5 font-sans text-xs font-bold text-forest">Rol</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['ADVISOR', 'ADMIN'] as const).map((role) => {
                const active = form.role === role;
                return (
                  <label
                    key={role}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-[16px] border-[1.5px] p-3 transition-colors ${
                      active ? 'border-forest bg-mint-light' : 'border-border bg-white hover:border-teal'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={active}
                      onChange={() => setForm((current) => ({ ...current, role }))}
                      className="mt-1 h-4 w-4 accent-[#10262A]"
                    />
                    <span>
                      <span className="block text-sm font-bold">{roleLabel[role]}</span>
                      <span className="block text-xs leading-snug text-muted">
                        {role === 'ADMIN'
                          ? 'Catálogo, equipo y todos los planes.'
                          : 'Solo sus propios viajes.'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {formError ? (
            <div role="alert" className="flex items-start gap-2 rounded-[16px] bg-orange/10 p-3 text-sm text-orange-dark">
              <Icon name="alert" size={17} className="mt-0.5 flex-none" />
              <p>{formError}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={closeCreate} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              <Icon name="plus" size={16} /> Crear acceso
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const TeamRow: React.FC<{ user: PublicUser; isCurrent: boolean }> = ({ user, isCurrent }) => (
  <li className="grid gap-3 border-b border-divider p-4 last:border-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center sm:px-5">
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={`grid h-11 w-11 flex-none place-items-center rounded-full text-sm font-bold ${toneFor(user.id)}`}
      >
        {initials(user.name)}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
          <span className="truncate">{user.name}</span>
          {isCurrent ? (
            <span className="flex-none rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest">
              Tú
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 pl-14 sm:pl-0">
      <Badge variant={user.role === 'ADMIN' ? 'admin' : 'advisor'}>{roleLabel[user.role]}</Badge>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          user.isActive ? 'bg-mint-light text-forest' : 'bg-divider text-muted'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-forest' : 'bg-muted'}`}
        />
        {user.isActive ? 'Activo' : 'Inactivo'}
      </span>
    </div>

    <div className="pl-14 text-xs text-muted sm:pl-0 sm:text-right">
      <p>
        {user.lastLoginAt ? `Último ingreso ${formatDateTime(user.lastLoginAt)}` : 'Aún no ha ingresado'}
      </p>
      <p className="mt-0.5 text-muted/70">Alta {formatDateTime(user.createdAt)}</p>
    </div>
  </li>
);
