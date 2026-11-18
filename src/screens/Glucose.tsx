import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { GLUCOSE_CONTEXTS, type GlucoseContext } from '../db/types';
import { addDays, formatDateShort, relativeDayLabel, timeLabel, todayISO } from '../domain/dates';
import { glucoseStats, glucoseStatus } from '../domain/health';
import { glucoseSeries, lastGlucose } from '../domain/selectors';
import { GlucoseScene } from '../three/GlucoseScene';
import { Icon } from '../components/Icon';
import { Button, Card, CardHead, Chip, EmptyState, ScreenHead, Stat } from '../components/ui';
import { StackedBar } from '../components/charts';
import { AddGlucoseSheet } from '../components/AddSheets';

export function GlucoseScreen() {
  const { profile, logs, actions } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const low = profile?.glucoseLow ?? 70;
  const high = profile?.glucoseHigh ?? 180;
  const readings = useMemo(() => glucoseSeries(logs, 14), [logs]);
  const weekReadings = useMemo(() => readings.filter((reading) => reading.date >= addDays(todayISO(), -6)), [readings]);
  const last = useMemo(() => lastGlucose(logs), [logs]);
  const stats = useMemo(() => glucoseStats(weekReadings.map((reading) => reading.mgdl), low, high), [weekReadings, low, high]);
  const status = last ? glucoseStatus(last.mgdl, low, high) : null;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof readings>();
    for (const reading of [...readings].reverse()) {
      const list = map.get(reading.date) ?? [];
      list.push(reading);
      map.set(reading.date, list);
    }
    return [...map.entries()].slice(0, 10);
  }, [readings]);

  const contextLabel = (context: GlucoseContext) => GLUCOSE_CONTEXTS.find((item) => item.id === context)?.label ?? context;
  const toneFor = (tone: string) => (tone === 'range' ? 'mint' : tone === 'low' || tone === 'high' ? 'amber' : 'rose');

  return (
    <>
      <ScreenHead
        eyebrow="Glicemia"
        title="Tempo na meta"
        subtitle={`Alvo ${low}–${high} mg/dL · ${stats.count} leituras em 7 dias`}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
            Registrar leitura
          </Button>
        }
      />

      <div className="grid-2">
        <Card glow style={{ overflow: 'hidden' }}>
          <CardHead
            title="Última leitura"
            icon="activity"
            action={
              last ? (
                <span className="tiny muted">
                  {timeLabel(last.createdAt)} · {relativeDayLabel(last.date)}
                </span>
              ) : undefined
            }
          />
          <div className="glucose-hero">
            <div>
              <div className="glucose-value" style={{ color: status?.color }}>
                {last ? last.mgdl : '—'}
                <small>mg/dL</small>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                {status ? <Chip tone={toneFor(status.tone) as 'mint' | 'amber' | 'rose'}>{status.label}</Chip> : null}
                {last ? <Chip>{contextLabel(last.context)}</Chip> : null}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div className="stat__label">Média 7 dias</div>
              <div className="stat__value" style={{ fontSize: '1.5rem' }}>
                {stats.count ? Math.round(stats.avg) : '—'}
                <small>mg/dL</small>
              </div>
              <div className="stat__hint">GMI {stats.count ? stats.gmi.toFixed(1) : '—'}%</div>
            </div>
          </div>

          <div className="glucose-scene">
            <GlucoseScene values={weekReadings.map((reading) => reading.mgdl)} low={low} high={high} />
            {!weekReadings.length ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <EmptyState icon="activity" title="Sem leituras na semana" hint="Registre para visualizar a curva em 3D." />
              </div>
            ) : null}
          </div>
          <div className="chart-legend" style={{ justifyContent: 'space-between' }}>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: 'var(--mint)' }} /> Na meta
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: 'var(--amber)' }} /> Acima
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: 'var(--rose)' }} /> Muito alta / baixa
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: 'rgba(47,224,176,.2)' }} /> Faixa-alvo
            </span>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Tempo na meta" icon="target" sub="Últimos 7 dias" />
            <StackedBar
              ariaLabel="Distribuição do tempo na meta"
              parts={[
                { label: 'Baixa', value: stats.low + stats.veryLow, color: '#ff9f6b' },
                { label: 'Na meta', value: stats.inRange, color: '#2fe0b0' },
                { label: 'Alta', value: stats.high + stats.veryHigh, color: '#ffc65c' },
              ]}
            />
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <Stat label="Mínima" value={stats.count ? stats.min : '—'} unit="mg/dL" hint="7 dias" />
              <Stat label="Máxima" value={stats.count ? stats.max : '—'} unit="mg/dL" hint="7 dias" />
              <Stat label="Variabilidade" value={stats.count ? `${Math.round(stats.cv)}` : '—'} unit="%" hint="CV — ideal < 36%" />
            </div>
          </Card>

          <Card>
            <CardHead title="Contexto das leituras" icon="pie" />
            <div className="stack" style={{ gap: 10 }}>
              {GLUCOSE_CONTEXTS.map((context) => {
                const list = weekReadings.filter((reading) => reading.context === context.id);
                if (!list.length) return null;
                const avg = list.reduce((acc, reading) => acc + reading.mgdl, 0) / list.length;
                return (
                  <div key={context.id} className="between">
                    <span className="small muted">{context.label}</span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="num strong" style={{ fontSize: '.86rem' }}>
                        {Math.round(avg)} mg/dL
                      </span>
                      <span className="badge badge--cyan">{list.length}×</span>
                    </span>
                  </div>
                );
              })}
              {!weekReadings.length ? <p className="tiny muted">Sem leituras nos últimos 7 dias.</p> : null}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHead title="Leituras recentes" icon="clock" sub="Últimos 14 dias" action={<Button size="sm" variant="soft" icon="plus" onClick={() => setOpen(true)}>Nova</Button>} />
        {grouped.length ? (
          <div className="stack" style={{ gap: 18 }}>
            {grouped.map(([date, dayReadings]) => (
              <div key={date}>
                <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                  <span className="small strong">{relativeDayLabel(date)}</span>
                  <span className="tiny muted">{formatDateShort(date)}</span>
                  <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                    {dayReadings.length} leitura{dayReadings.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="log-list">
                  {dayReadings.map((reading) => {
                    const readingStatus = glucoseStatus(reading.mgdl, low, high);
                    return (
                      <div className="log-item" key={reading.id}>
                        <span
                          className={`log-item__icon log-item__icon--${readingStatus.tone === 'range' ? 'mint' : readingStatus.tone === 'high' ? 'amber' : 'rose'}`}
                        >
                          <Icon name="activity" />
                        </span>
                        <div className="log-item__body">
                          <div className="log-item__title">
                            {reading.mgdl} mg/dL <span className="tiny muted">· {readingStatus.label}</span>
                          </div>
                          <div className="log-item__meta">
                            {timeLabel(reading.createdAt)} · {contextLabel(reading.context)}
                            {reading.note ? ` · ${reading.note}` : ''}
                          </div>
                        </div>
                        <button type="button" className="log-item__del" onClick={() => void actions.deleteLog(reading.id)} aria-label="Remover leitura">
                          <Icon name="trash" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="activity"
            title="Nenhuma leitura registrada"
            hint="Registre glicemias em jejum, antes e depois das refeições para ver o tempo na meta."
            action={
              <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
                Primeira leitura
              </Button>
            }
          />
        )}
      </Card>

      <Card flat>
        <div className="row tiny muted" style={{ gap: 8, alignItems: 'flex-start' }}>
          <Icon name="info" size={14} />
          <span>
            GMI (Índice de Gestão da Glicemia) estima a hemoglobina glicada a partir da média das leituras — é uma referência, não um exame.
            As metas padrão (70–180 mg/dL) devem ser personalizadas com sua equipe de saúde.
          </span>
        </div>
      </Card>

      <AddGlucoseSheet
        open={open}
        onClose={() => setOpen(false)}
        onAdd={async (value, context, note) => {
          await actions.addGlucose(value, context, note);
          toast(`Leitura de ${value} mg/dL salva`, 'success');
        }}
      />
    </>
  );
}
