import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { usePwa } from '../pwa/pwa';
import { MEAL_TYPES, type MealType } from '../db/types';
import { formatDateLong, timeLabel } from '../domain/dates';
import { formatDecimal, formatKcal, formatMl, glucoseStatus, progressPct } from '../domain/health';
import { glucoseSeries, lastGlucose, logsOfDate, mealsByType, mealsOfDate, mealsTotals, waterTotal } from '../domain/selectors';
import { OrbScene } from '../three/OrbScene';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, CardHead, Chip, EmptyState, ProgressRing } from '../components/ui';
import { AddGlucoseSheet, AddMealSheet, AddWeightSheet } from '../components/AddSheets';
import { LineChart } from '../components/charts';
import type { Route } from '../state/useHashRoute';
import { navigate } from '../state/useHashRoute';

const ICON_BY_KIND: Record<string, IconName> = {
  meal: 'utensils',
  water: 'droplet',
  glucose: 'activity',
  weight: 'scale',
  insulin: 'syringe',
};

const TONE_BY_KIND: Record<string, string> = {
  meal: 'amber',
  water: 'cyan',
  glucose: 'mint',
  weight: 'violet',
  insulin: 'rose',
};

function mealTypeLabel(type: MealType): string {
  return MEAL_TYPES.find((item) => item.id === type)?.label ?? type;
}

function Insight({ title, text }: { title: string; text: string }) {
  return (
    <div className="insight">
      <div className="insight__icon">
        <Icon name="sparkles" />
      </div>
      <div className="insight__body">
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}

function InstallBanner({ onDismiss }: { onDismiss: () => void }) {
  const { install } = usePwa();
  return (
    <div className="install-banner">
      <div className="install-banner__icon">
        <Icon name="install" />
      </div>
      <div className="install-banner__text">
        <b>Leve o Vitalis com você</b>
        <span>Instale na tela inicial e use sem internet.</span>
      </div>
      <Button size="sm" variant="primary" onClick={() => void install()}>
        Instalar
      </Button>
      <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dispensar" style={{ width: 36, height: 36 }}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

export function TodayScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { profile, logs, goals, today, actions } = useApp();
  const { toast } = useToast();
  const { canInstall } = usePwa();
  const [sheet, setSheet] = useState<'meal' | 'glucose' | 'weight' | null>(null);
  const [mealType, setMealType] = useState<MealType>('almoco');
  const [dismissedInstall, setDismissedInstall] = useState(() => localStorage.getItem('vitalis.install.dismissed') === '1');

  const meals = useMemo(() => mealsOfDate(logs, today), [logs, today]);
  const totals = useMemo(() => mealsTotals(meals), [meals]);
  const water = useMemo(() => waterTotal(logs, today), [logs, today]);
  const last = useMemo(() => lastGlucose(logs), [logs]);
  const weekGlucose = useMemo(() => glucoseSeries(logs, 7), [logs]);
  const dayLogs = useMemo(() => logsOfDate(logs, today), [logs, today]);
  const inRangeShare = useMemo(() => {
    if (!weekGlucose.length) return 0;
    const low = profile?.glucoseLow ?? 70;
    const high = profile?.glucoseHigh ?? 180;
    return weekGlucose.filter((reading) => reading.mgdl >= low && reading.mgdl <= high).length / weekGlucose.length;
  }, [weekGlucose, profile]);

  const remaining = goals.kcal - totals.kcal;
  const remainingWater = Math.max(0, goals.waterMl - water);
  const status = last ? glucoseStatus(last.mgdl, profile?.glucoseLow, profile?.glucoseHigh) : null;
  const firstName = profile?.name?.trim().split(' ')[0];

  const openMeal = (type: MealType) => {
    setMealType(type);
    setSheet('meal');
  };

  const quickWater = async (ml: number) => {
    await actions.addWater(ml, ml >= 400 ? 'Garrafa' : 'Copo');
    toast(`+${ml} ml de água`, 'success');
  };

  const insight = useMemo(() => {
    const hour = new Date().getHours();
    if (remaining < -50) {
      return { title: 'Meta calórica ultrapassada', text: `Você passou ${Math.abs(Math.round(remaining))} kcal da meta. Um jantar leve e uma caminhada ajudam a equilibrar o dia.` };
    }
    if (water < goals.waterMl * 0.5 && hour >= 14) {
      return { title: 'Hidratação em atraso', text: `Faltam ${formatMl(remainingWater)} para a meta de hoje. Deixe uma garrafa por perto e beba em pequenos goles.` };
    }
    if (totals.protein < goals.protein * 0.5 && hour >= 17) {
      return { title: 'Proteína abaixo do ideal', text: `Faltam ${Math.round(goals.protein - totals.protein)} g de proteína. Ovos, iogurte grego ou frango são boas escolhas.` };
    }
    if (last && last.mgdl > (profile?.glucoseHigh ?? 180)) {
      return { title: 'Glicemia acima da meta', text: 'Hidrate-se, evite carboidratos simples agora e siga o plano combinado com sua equipe de saúde.' };
    }
    if (totals.kcal > 0) {
      return { title: 'Dia sob controle', text: `Você já registrou ${meals.length} refeições e ${formatMl(water)} de água. Continue assim: constância vale mais que perfeição.` };
    }
    return { title: 'Comece pelo primeiro registro', text: 'Uma refeição, um copo de água ou uma glicemia já ativam o acompanhamento do seu dia.' };
  }, [remaining, water, goals, totals, last, meals.length, profile, remainingWater]);

  return (
    <>
      <section className="hero" aria-label="Resumo do dia">
        <div className="hero__canvas">
          <OrbScene calories={totals.kcal / Math.max(1, goals.kcal)} water={water / Math.max(1, goals.waterMl)} glucose={inRangeShare || 0.05} />
        </div>
        <div className="hero__veil" />
        <div className="hero__content">
          <span className="hero__badge">
            <Icon name="sparkles" /> {formatDateLong(today)}
          </span>
          <h1 className="hero__title">
            {remaining >= 0 ? (
              <>
                Faltam <em>{formatKcal(remaining)}</em> hoje
              </>
            ) : (
              <>
                Meta do dia <em>concluída</em>
              </>
            )}
          </h1>
          <p className="hero__sub">
            {Math.round(totals.kcal)} kcal de {goals.kcal} kcal · {formatMl(water)} de {formatMl(goals.waterMl)} de água
            {last ? ` · última glicemia ${last.mgdl} mg/dL` : ''}
          </p>
          <div className="hero__stats">
            <span className="hero-chip hero-chip--mint">
              <Icon name="activity" /> Na meta <b>{Math.round(inRangeShare * 100)}%</b>
            </span>
            <span className="hero-chip hero-chip--cyan">
              <Icon name="droplet" /> Água <b>{progressPct(water, goals.waterMl)}%</b>
            </span>
            <span className="hero-chip hero-chip--amber">
              <Icon name="flame" /> Calorias <b>{progressPct(totals.kcal, goals.kcal)}%</b>
            </span>
          </div>
        </div>
      </section>

      {canInstall && !dismissedInstall ? (
        <InstallBanner
          onDismiss={() => {
            localStorage.setItem('vitalis.install.dismissed', '1');
            setDismissedInstall(true);
          }}
        />
      ) : null}

      <div className="kpi-grid">
        <button type="button" className="kpi" onClick={() => onNavigate('nutrition')} style={{ textAlign: 'left' }}>
          <div className="kpi__top">
            <span className="kpi__icon">
              <Icon name="flame" />
            </span>
            Calorias
          </div>
          <div className="kpi__value">
            {Math.round(totals.kcal)} <small>kcal</small>
          </div>
          <div className="kpi__bar">
            <span style={{ width: `${Math.min(100, progressPct(totals.kcal, goals.kcal))}%` }} />
          </div>
          <div className="kpi__meta">
            <span className="kpi__dot" />
            {remaining >= 0 ? `${Math.round(remaining)} restantes` : `${Math.abs(Math.round(remaining))} acima da meta`}
          </div>
        </button>

        <button type="button" className="kpi kpi--cyan" onClick={() => onNavigate('hydration')} style={{ textAlign: 'left' }}>
          <div className="kpi__top">
            <span className="kpi__icon">
              <Icon name="droplet" />
            </span>
            Água
          </div>
          <div className="kpi__value">
            {formatMl(water)} <small>de {formatMl(goals.waterMl)}</small>
          </div>
          <div className="kpi__bar">
            <span style={{ width: `${Math.min(100, progressPct(water, goals.waterMl))}%` }} />
          </div>
          <div className="kpi__meta">
            <span className="kpi__dot" />
            {remainingWater > 0 ? `Faltam ${formatMl(remainingWater)}` : 'Meta atingida'}
          </div>
        </button>

        <button type="button" className="kpi kpi--violet" onClick={() => onNavigate('carbs')} style={{ textAlign: 'left' }}>
          <div className="kpi__top">
            <span className="kpi__icon">
              <Icon name="molecule" />
            </span>
            Carboidratos
          </div>
          <div className="kpi__value">
            {Math.round(totals.carbs)} <small>g de {goals.carbs} g</small>
          </div>
          <div className="kpi__bar">
            <span style={{ width: `${Math.min(100, progressPct(totals.carbs, goals.carbs))}%` }} />
          </div>
          <div className="kpi__meta">
            <span className="kpi__dot" />
            {Math.round(totals.protein)} g de proteína hoje
          </div>
        </button>

        <button type="button" className={`kpi ${status ? (status.tone === 'range' ? 'kpi--mint' : 'kpi--amber') : 'kpi--rose'}`} onClick={() => onNavigate('glucose')} style={{ textAlign: 'left' }}>
          <div className="kpi__top">
            <span className="kpi__icon">
              <Icon name="activity" />
            </span>
            Glicemia
          </div>
          <div className="kpi__value">
            {last ? last.mgdl : '—'} <small>mg/dL</small>
          </div>
          <div className="kpi__bar">
            <span style={{ width: `${Math.round(inRangeShare * 100)}%` }} />
          </div>
          <div className="kpi__meta">
            <span className="kpi__dot" />
            {status ? status.label : 'Sem leituras ainda'}
          </div>
        </button>
      </div>

      <div className="quick-actions">
        <button type="button" className="quick-action" onClick={() => openMeal('almoco')}>
          <span className="quick-action__icon">
            <Icon name="utensils" />
          </span>
          <span className="quick-action__text">
            <b>Refeição</b>
            <span>Café, almoço, jantar</span>
          </span>
        </button>
        <button type="button" className="quick-action quick-action--cyan" onClick={() => void quickWater(250)}>
          <span className="quick-action__icon">
            <Icon name="droplet" />
          </span>
          <span className="quick-action__text">
            <b>+ 250 ml</b>
            <span>Um copo de água</span>
          </span>
        </button>
        <button type="button" className="quick-action quick-action--amber" onClick={() => setSheet('glucose')}>
          <span className="quick-action__icon">
            <Icon name="activity" />
          </span>
          <span className="quick-action__text">
            <b>Glicemia</b>
            <span>Registrar leitura</span>
          </span>
        </button>
        <button type="button" className="quick-action quick-action--violet" onClick={() => setSheet('weight')}>
          <span className="quick-action__icon">
            <Icon name="scale" />
          </span>
          <span className="quick-action__text">
            <b>Peso</b>
            <span>Acompanhar tendência</span>
          </span>
        </button>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead
            title="Refeições de hoje"
            icon="utensils"
            sub={`${totals.kcal} kcal · ${Math.round(totals.carbs)} g de carboidratos`}
            action={
              <button type="button" className="card-link" onClick={() => onNavigate('nutrition')}>
                Ver diário <Icon name="chevronRight" />
              </button>
            }
          />
          <div className="stack" style={{ gap: 10 }}>
            {MEAL_TYPES.map((type) => {
              const typeMeals = mealsByType(meals, type.id);
              const typeTotals = mealsTotals(typeMeals);
              return (
                <div className="meal-block" key={type.id} style={{ padding: 12 }}>
                  <div className="meal-block__head">
                    <span className="meal-block__icon">
                      <Icon name={type.icon as IconName} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="meal-block__title">{type.label}</div>
                      <div className="meal-block__kcal">
                        {typeMeals.length ? `${typeTotals.kcal} kcal · ${Math.round(typeTotals.carbs)} g carb` : 'Sem registro'}
                      </div>
                    </div>
                    <button type="button" className="meal-block__add" onClick={() => openMeal(type.id)} aria-label={`Adicionar em ${type.label}`}>
                      <Icon name="plus" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Hidratação" icon="droplet" action={<button type="button" className="card-link" onClick={() => onNavigate('hydration')}>Detalhes <Icon name="chevronRight" /></button>} />
            <div className="row" style={{ gap: 16 }}>
              <ProgressRing value={water} max={goals.waterMl} size={104} stroke={9} color="var(--cyan)" color2="#2f9fc4" ariaLabel={`${progressPct(water, goals.waterMl)}% da meta de água`}>
                <span className="ring__value" style={{ fontSize: '1.2rem' }}>
                  {progressPct(water, goals.waterMl)}%
                </span>
              </ProgressRing>
              <div className="stack" style={{ gap: 8, flex: 1 }}>
                <div>
                  <div className="num strong" style={{ fontSize: '1.25rem' }}>
                    {formatMl(water)}
                  </div>
                  <div className="tiny muted">meta {formatMl(goals.waterMl)}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" variant="soft" onClick={() => void quickWater(250)}>
                    +250
                  </Button>
                  <Button size="sm" variant="soft" onClick={() => void quickWater(500)}>
                    +500
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Última glicemia"
              icon="activity"
              action={<button type="button" className="card-link" onClick={() => setSheet('glucose')}>Registrar <Icon name="plus" /></button>}
            />
            {last ? (
              <>
                <div className="between" style={{ alignItems: 'flex-start' }}>
                  <div className="glucose-value">
                    {last.mgdl}
                    <small>mg/dL</small>
                  </div>
                  {status ? <Chip tone={status.tone === 'range' ? 'mint' : status.tone === 'low' ? 'amber' : 'rose'}>{status.label}</Chip> : null}
                </div>
                <div className="row tiny muted" style={{ marginTop: 6 }}>
                  <Icon name="clock" size={13} /> {timeLabel(last.createdAt)} · {last.context === 'jejum' ? 'Jejum' : last.context === 'pos' ? 'Pós-refeição' : last.context === 'pre' ? 'Pré-refeição' : last.context === 'dormir' ? 'Antes de dormir' : 'Aleatório'}
                </div>
                {weekGlucose.length > 1 ? (
                  <div style={{ marginTop: 12 }}>
                    <LineChart
                      values={weekGlucose.map((reading) => reading.mgdl)}
                      labels={weekGlucose.map((reading) => `${reading.date.slice(8, 10)}/${reading.date.slice(5, 7)}`)}
                      height={96}
                      color="var(--mint)"
                      band={{ from: profile?.glucoseLow ?? 70, to: profile?.glucoseHigh ?? 180, color: 'rgba(47,224,176,.09)' }}
                      ariaLabel="Glicemias dos últimos sete dias"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon="activity"
                title="Nenhuma leitura hoje"
                hint="Registre a glicemia para acompanhar o tempo na meta."
                action={
                  <Button size="sm" variant="primary" icon="plus" onClick={() => setSheet('glucose')}>
                    Registrar agora
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      </div>

      <Insight title={insight.title} text={insight.text} />

      <Card>
        <CardHead
          title="Linha do tempo de hoje"
          icon="clock"
          sub={dayLogs.length ? `${dayLogs.length} registros` : 'Nada registrado ainda'}
        />
        {dayLogs.length ? (
          <div className="timeline">
            {[...dayLogs].reverse().map((log) => {
              const tone = TONE_BY_KIND[log.kind];
              let title = '';
              let desc = '';
              let value = '';
              let unit = '';

              if (log.kind === 'meal') {
                const totalsMeal = mealsTotals([log]);
                title = mealTypeLabel(log.mealType);
                desc = log.items.map((item) => item.name).join(' · ');
                value = `${totalsMeal.kcal}`;
                unit = 'kcal';
              } else if (log.kind === 'water') {
                title = log.label ?? 'Água';
                desc = 'Hidratação';
                value = `${log.ml}`;
                unit = 'ml';
              } else if (log.kind === 'glucose') {
                title = 'Glicemia';
                desc = log.context === 'jejum' ? 'Jejum' : log.context === 'pos' ? 'Pós-refeição' : log.context === 'pre' ? 'Pré-refeição' : log.context === 'dormir' ? 'Antes de dormir' : 'Aleatório';
                value = `${log.mgdl}`;
                unit = 'mg/dL';
              } else if (log.kind === 'weight') {
                title = 'Peso';
                desc = 'Pesagem';
                value = formatDecimal(log.kg);
                unit = 'kg';
              } else if (log.kind === 'insulin') {
                title = log.insulinType === 'basal' ? 'Insulina basal' : 'Insulina rápida';
                desc = 'Aplicação';
                value = `${log.units}`;
                unit = 'U';
              }

              return (
                <div className="timeline__item" key={log.id}>
                  <div className="timeline__rail">
                    <span className={`log-item__icon log-item__icon--${tone}`}>
                      <Icon name={ICON_BY_KIND[log.kind]} size={17} />
                    </span>
                  </div>
                  <div className="timeline__body">
                    <div className="timeline__time">{timeLabel(log.createdAt)}</div>
                    <div className="timeline__title">{title}</div>
                    <div className="timeline__desc">{desc}</div>
                  </div>
                  <div className="timeline__right">
                    <div className="log-item__value">
                      {value}
                      <small>{unit}</small>
                    </div>
                    <button
                      type="button"
                      className="log-item__del"
                      onClick={() => {
                        void actions.deleteLog(log.id);
                        toast('Registro removido');
                      }}
                      aria-label="Remover registro"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="sparkles" title="Seu dia começa aqui" hint="Registre uma refeição ou um copo de água para ver o acompanhamento." />
        )}
      </Card>

      <p className="footer-note">
        Vitalis é uma ferramenta de acompanhamento e não substitui orientação médica ou nutricional.
      </p>

      <AddMealSheet
        open={sheet === 'meal'}
        onClose={() => setSheet(null)}
        initialType={mealType}
        onAdd={async (type, items, note) => {
          await actions.addMeal(type, items, note);
        }}
      />
      <AddGlucoseSheet
        open={sheet === 'glucose'}
        onClose={() => setSheet(null)}
        onAdd={async (value, context, note) => {
          await actions.addGlucose(value, context, note);
        }}
      />
      <AddWeightSheet
        open={sheet === 'weight'}
        onClose={() => setSheet(null)}
        onAdd={async (kg) => {
          await actions.addWeight(kg);
        }}
      />
    </>
  );
}
