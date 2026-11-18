import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { addDays, timeLabel, todayISO } from '../domain/dates';
import { clamp, formatMl, progressPct } from '../domain/health';
import { waterTotal } from '../domain/selectors';
import { WaterScene } from '../three/WaterScene';
import { Icon } from '../components/Icon';
import { Button, Card, CardHead, EmptyState, Field, ScreenHead, Sheet, Stat } from '../components/ui';
import { WeeklyBars } from '../components/charts';

const PRESETS = [200, 250, 300, 400, 500, 750];

export function HydrationScreen() {
  const { goals, logs, actions } = useApp();
  const { toast } = useToast();
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState('350');

  const today = todayISO();
  const water = useMemo(() => waterTotal(logs, today), [logs, today]);
  const entries = useMemo(
    () =>
      logs
        .filter((log): log is Extract<typeof log, { kind: 'water' }> => log.kind === 'water' && log.date === today)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [logs, today],
  );
  const remaining = Math.max(0, goals.waterMl - water);
  const pct = progressPct(water, goals.waterMl);

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      const value = waterTotal(logs, date);
      const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '');
      return { label, value, muted: value === 0 };
    });
  }, [logs, today]);

  const avg7 = useMemo(() => {
    const total = Array.from({ length: 7 }, (_, index) => waterTotal(logs, addDays(today, index - 6))).reduce((acc, value) => acc + value, 0);
    return total / 7;
  }, [logs, today]);

  const daysMet = week.filter((day) => day.value >= goals.waterMl).length;

  const add = async (ml: number, label?: string) => {
    await actions.addWater(ml, label ?? (ml >= 500 ? 'Garrafa' : 'Copo'));
    toast(`+${ml} ml registrados`, 'success');
  };

  return (
    <>
      <ScreenHead
        eyebrow="Hidratação"
        title="Água do dia"
        subtitle={`Meta de ${formatMl(goals.waterMl)} · ${pct}% concluído`}
        actions={
          <Button variant="primary" icon="droplet" onClick={() => void add(250)}>
            + 250 ml
          </Button>
        }
      />

      <div className="grid-2">
        <Card glow style={{ paddingBottom: 18 }}>
          <div className="water-scene">
            <WaterScene fill={water / Math.max(1, goals.waterMl)} />
            <div className="water-scene__readout">
              <div className="water-readout">
                <div className="water-scene__value">{formatMl(water)}</div>
                <div className="water-scene__label">de {formatMl(goals.waterMl)} · {pct}%</div>
              </div>
            </div>
          </div>
          <div className="water-grid" style={{ marginTop: 14 }}>
            {PRESETS.map((ml) => (
              <button type="button" className="water-btn" key={ml} onClick={() => void add(ml)}>
                <b>{ml >= 1000 ? `${ml / 1000}L` : ml}</b>
                <span>
                  <Icon name="droplet" /> ml
                </span>
              </button>
            ))}
            <button type="button" className="water-btn" onClick={() => setCustomOpen(true)}>
              <b>
                <Icon name="plus" size={16} />
              </b>
              <span>Outro</span>
            </button>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Resumo" icon="target" />
            <div className="stat-grid">
              <Stat label="Restante" value={remaining > 0 ? formatMl(remaining) : 'Meta!'} hint={remaining > 0 ? 'até a meta de hoje' : 'parabéns pela constância'} />
              <Stat label="Registros" value={entries.length} hint="copos e garrafas" />
              <Stat label="Média 7 dias" value={formatMl(Math.round(avg7))} hint={`${daysMet}/7 dias na meta`} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="between small" style={{ marginBottom: 6 }}>
                <span className="muted">Progresso de hoje</span>
                <span className="num strong">{pct}%</span>
              </div>
              <div className="macro-track">
                <span style={{ width: `${Math.min(100, pct)}%`, background: 'linear-gradient(90deg, #2f9fc4, var(--cyan))' }} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Hidratação na semana" icon="chart" sub="Últimos 7 dias" />
            <WeeklyBars data={week} goal={goals.waterMl} color="var(--cyan)" ariaLabel="Água consumida nos últimos sete dias" formatValue={(value) => formatMl(value)} />
          </Card>
        </div>
      </div>

      <Card>
        <CardHead
          title="Registros de hoje"
          icon="clock"
          sub={entries.length ? `${entries.length} registros · ${formatMl(water)}` : 'Nenhum registro'}
          action={
            entries.length ? (
              <button type="button" className="card-link" onClick={() => setCustomOpen(true)}>
                <Icon name="plus" /> Adicionar
              </button>
            ) : undefined
          }
        />
        {entries.length ? (
          <div className="log-list">
            {entries.map((entry) => (
              <div className="log-item" key={entry.id}>
                <span className="log-item__icon log-item__icon--cyan">
                  <Icon name="droplet" />
                </span>
                <div className="log-item__body">
                  <div className="log-item__title">{entry.label ?? 'Água'}</div>
                  <div className="log-item__meta">{timeLabel(entry.createdAt)}</div>
                </div>
                <div className="log-item__value">{entry.ml} ml</div>
                <button type="button" className="log-item__del" onClick={() => void actions.deleteLog(entry.id)} aria-label="Remover registro">
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="droplet"
            title="Comece a se hidratar"
            hint="Use os botões acima ou registre um volume personalizado."
            action={
              <Button variant="primary" icon="plus" onClick={() => void add(250)}>
                Registrar 250 ml
              </Button>
            }
          />
        )}
      </Card>

      <Card flat>
        <div className="row tiny muted" style={{ gap: 8 }}>
          <Icon name="info" size={14} />
          A recomendação padrão é de 35 ml por kg de peso corporal. Ajuste a meta em Ajustes se seu médico ou nutricionista indicar outro volume.
        </div>
      </Card>

      <Sheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Registrar água"
        subtitle="Informe o volume que você bebeu"
        icon="droplet"
        footer={
          <>
            <Button variant="soft" onClick={() => setCustomOpen(false)} block>
              Cancelar
            </Button>
            <Button
              variant="primary"
              block
              onClick={() => {
                const value = clamp(Number(customMl) || 0, 10, 3000);
                void add(value, 'Volume personalizado');
                setCustomOpen(false);
              }}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <Field label="Volume (ml)" htmlFor="custom-water">
          <div className="input-suffix">
            <input
              id="custom-water"
              className="input input--lg"
              type="number"
              inputMode="numeric"
              value={customMl}
              onChange={(event) => setCustomMl(event.target.value)}
              style={{ textAlign: 'left' }}
            />
            <span>ml</span>
          </div>
        </Field>
        <div className="portion-chips">
          {PRESETS.map((ml) => (
            <button type="button" key={ml} className={`cat-pill${Number(customMl) === ml ? ' is-active' : ''}`} onClick={() => setCustomMl(String(ml))}>
              {ml} ml
            </button>
          ))}
        </div>
        <p className="field__hint">Dica: cadastre o volume da sua garrafa para registrar em um toque.</p>
      </Sheet>
    </>
  );
}
