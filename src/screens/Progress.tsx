import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { addDays, formatDayMonth, todayISO } from '../domain/dates';
import { bmiCategory, calcBMI, clamp, formatDecimal, glucoseStats, idealWeightRange, streakDays } from '../domain/health';
import { daySummaries, glucoseSeries, latestWeight, uniqueDatesWithLogs, weightSeries } from '../domain/selectors';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, CardHead, Chip, EmptyState, ScreenHead, Stat } from '../components/ui';
import { LineChart, WeeklyBars } from '../components/charts';
import { AddWeightSheet } from '../components/AddSheets';

function bmiPosition(bmi: number): number {
  return clamp(((bmi - 15) / (40 - 15)) * 100, 2, 98);
}

export function ProgressScreen() {
  const { profile, goals, logs, actions } = useApp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const today = todayISO();

  const weights = useMemo(() => weightSeries(logs, 30), [logs]);
  const latest = useMemo(() => latestWeight(logs, profile?.weightKg ?? 0), [logs, profile?.weightKg]);
  const bmi = profile ? calcBMI(latest.kg, profile.heightCm) : 0;
  const category = bmiCategory(bmi);
  const ideal: [number, number] = profile ? idealWeightRange(profile.heightCm) : [0, 0];
  const inIdeal = ideal[1] > 0 && latest.kg >= ideal[0] && latest.kg <= ideal[1];
  const idealDelta = latest.kg < ideal[0] ? ideal[0] - latest.kg : latest.kg > ideal[1] ? latest.kg - ideal[1] : 0;
  const delta = weights.length > 1 ? weights[weights.length - 1].kg - weights[0].kg : 0;

  const summaries = useMemo(() => daySummaries(logs, 7), [logs]);
  const weekGlucose = useMemo(() => glucoseSeries(logs, 7), [logs]);
  const stats = useMemo(() => glucoseStats(weekGlucose.map((reading) => reading.mgdl), profile?.glucoseLow, profile?.glucoseHigh), [weekGlucose, profile]);
  const streak = useMemo(() => streakDays(uniqueDatesWithLogs(logs), today), [logs, today]);
  const waterDays = summaries.filter((summary) => summary.water >= (goals.waterMl > 0 ? goals.waterMl : Infinity)).length;
  const loggedMeals = summaries.reduce((acc, summary) => acc + (summary.kcal > 0 ? 1 : 0), 0);

  const weightChart = useMemo(() => {
    const points = weights.slice(-30);
    const labels = points.map((point) => formatDayMonth(point.date));
    return { values: points.map((point) => point.kg), labels };
  }, [weights]);

  const weightHistory = useMemo(
    () =>
      logs
        .filter((log): log is Extract<typeof log, { kind: 'weight' }> => log.kind === 'weight')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [logs],
  );

  const waterWeek = summaries.map((summary) => ({
    label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${summary.date}T12:00:00`)).replace('.', ''),
    value: summary.water,
    muted: summary.water === 0,
  }));

  const achievements: { icon: IconName; title: string; hint: string; done: boolean }[] = [
    { icon: 'flame', title: 'Constância', hint: '3 dias seguidos de registro', done: streak >= 3 },
    { icon: 'droplet', title: 'Semana hidratada', hint: '5 dias batendo a meta de água', done: waterDays >= 5 },
    { icon: 'activity', title: 'Olhar atento', hint: '5 leituras de glicemia na semana', done: weekGlucose.length >= 5 },
    { icon: 'utensils', title: 'Diário em dia', hint: '5 dias com refeições registradas', done: loggedMeals >= 5 },
  ];

  return (
    <>
      <ScreenHead
        eyebrow="Progresso"
        title="Sua evolução"
        subtitle={`Acompanhamento dos últimos 30 dias · ${profile?.name ? profile.name.split(' ')[0] : 'você'}`}
        actions={
          <Button variant="primary" icon="scale" onClick={() => setOpen(true)}>
            Registrar peso
          </Button>
        }
      />

      <div className="grid-2">
        <Card>
          <CardHead
            title="Peso"
            icon="scale"
            sub={latest.date ? `Última pesagem em ${formatDayMonth(latest.date)}` : 'Nenhuma pesagem registrada'}
            action={
              weights.length > 1 ? (
                <span className={`weight-delta ${delta <= 0 ? 'weight-delta--down' : 'weight-delta--up'}`}>
                  <Icon name={delta <= 0 ? 'arrowDown' : 'arrowUp'} />
                  {formatDecimal(Math.abs(delta))} kg
                </span>
              ) : undefined
            }
          />
          <div className="row" style={{ gap: 18, alignItems: 'flex-end', marginBottom: 10 }}>
            <div>
              <div className="num" style={{ fontSize: '2.6rem', fontWeight: 700, lineHeight: 1 }}>
                {formatDecimal(latest.kg)}
                <span style={{ fontSize: '.95rem', color: 'var(--muted)', marginLeft: 4 }}>kg</span>
              </div>
              <div className="tiny muted">atual</div>
            </div>
            <div className="row" style={{ gap: 14, marginBottom: 4 }}>
              <div>
                <div className="stat__label">IMC</div>
                <div className="num strong" style={{ fontSize: '1.1rem' }}>
                  {formatDecimal(bmi)}
                </div>
              </div>
              <Chip tone={category.tone === 'mint' ? 'mint' : category.tone === 'cyan' ? 'cyan' : category.tone === 'amber' ? 'amber' : 'rose'}>{category.label}</Chip>
            </div>
          </div>

          <div className="bmi-scale" aria-hidden="true">
            <span className="bmi-scale__marker" style={{ left: `${bmiPosition(bmi)}%` }} />
          </div>
          <div className="between tiny muted">
            <span>15</span>
            <span>18,5</span>
            <span>25</span>
            <span>30</span>
            <span>40</span>
          </div>

          <div className="ideal-row">
            <div>
              <div className="stat__label">Peso ideal (IMC 18,5–24,9)</div>
              <div className="small strong">
                {ideal[1] > 0 ? `${formatDecimal(ideal[0])}–${formatDecimal(ideal[1])} kg` : 'Informe sua altura em Ajustes'}
              </div>
            </div>
            {ideal[1] > 0 ? (
              <Chip tone={inIdeal ? 'mint' : 'amber'}>
                {inIdeal ? 'Dentro da faixa' : `${formatDecimal(idealDelta)} kg ${latest.kg < ideal[0] ? 'abaixo' : 'acima'}`}
              </Chip>
            ) : null}
          </div>

          {weights.length > 1 ? (
            <div style={{ marginTop: 16 }}>
              <LineChart
                values={weightChart.values}
                labels={weightChart.labels}
                height={150}
                color="var(--violet)"
                unit=" kg"
                ariaLabel="Evolução do peso nos últimos 30 dias"
              />
            </div>
          ) : (
            <EmptyState
              icon="trend"
              title="Poucos dados para a curva"
              hint="Registre o peso por alguns dias para ver a tendência."
              action={
                <Button size="sm" variant="soft" icon="scale" onClick={() => setOpen(true)}>
                  Registrar peso
                </Button>
              }
            />
          )}
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Resumo da semana" icon="chart" sub="Média dos últimos 7 dias" />
            <div className="stat-grid">
              <Stat label="Calorias/dia" value={Math.round(summaries.reduce((acc, day) => acc + day.kcal, 0) / 7)} unit="kcal" hint={`meta ${goals.kcal}`} />
              <Stat label="Água/dia" value={(summaries.reduce((acc, day) => acc + day.water, 0) / 7 / 1000).toFixed(1)} unit="L" hint={`meta ${(goals.waterMl / 1000).toFixed(1)} L`} />
              <Stat label="Tempo na meta" value={stats.count ? `${Math.round(stats.inRange)}` : '—'} unit="%" hint={`${stats.count} leituras`} />
              <Stat label="Sequência" value={streak} unit="dias" hint="registrando sem falhar" />
              <Stat label="Dias com refeição" value={loggedMeals} unit="/7" hint="diário preenchido" />
              <Stat label="Média glicêmica" value={stats.count ? Math.round(stats.avg) : '—'} unit="mg/dL" hint="últimos 7 dias" />
            </div>
          </Card>

          <Card>
            <CardHead title="Hidratação na semana" icon="droplet" />
            <WeeklyBars data={waterWeek} goal={goals.waterMl} color="var(--cyan)" ariaLabel="Hidratação dos últimos sete dias" formatValue={(value) => `${Math.round(value)} ml`} />
          </Card>
        </div>
      </div>

      <Card>
        <CardHead title="Conquistas" icon="sparkles" sub="Pequenos marcos que mostram constância" />
        <div className="grid-3" style={{ gap: 10 }}>
          {achievements.map((achievement) => (
            <div
              key={achievement.title}
              className="row"
              style={{
                gap: 10,
                padding: '12px 13px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: achievement.done ? 'var(--mint-soft)' : 'var(--surface-2)',
                opacity: achievement.done ? 1 : 0.6,
              }}
            >
              <span className={`log-item__icon ${achievement.done ? 'log-item__icon--mint' : ''}`} style={{ width: 32, height: 32 }}>
                <Icon name={achievement.done ? 'check' : achievement.icon} size={15} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="small strong">{achievement.title}</div>
                <div className="tiny muted">{achievement.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Histórico de peso" icon="clock" sub={`${weights.length} pesagens nos últimos 30 dias`} />
        {weightHistory.length ? (
          <div className="log-list">
            {weightHistory.map((log) => (
              <div className="log-item" key={log.id}>
                <span className="log-item__icon log-item__icon--violet">
                  <Icon name="scale" />
                </span>
                <div className="log-item__body">
                  <div className="log-item__title">{formatDecimal(log.kg)} kg</div>
                  <div className="log-item__meta">{formatDayMonth(log.date)}</div>
                </div>
                <button
                  type="button"
                  className="log-item__del"
                  onClick={() => {
                    void actions.deleteLog(log.id);
                    toast('Pesagem removida');
                  }}
                  aria-label="Remover pesagem"
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="scale" title="Sem histórico ainda" hint="Registre seu peso para acompanhar a evolução." />
        )}
      </Card>

      <Card flat>
        <div className="row tiny muted" style={{ gap: 8, alignItems: 'flex-start' }}>
          <Icon name="info" size={14} />
          IMC é uma referência populacional e não considera composição corporal. Para metas de peso, considere também acompanhamento profissional.
        </div>
      </Card>

      <AddWeightSheet
        open={open}
        onClose={() => setOpen(false)}
        onAdd={async (kg) => {
          await actions.addWeight(kg);
        }}
      />
    </>
  );
}
