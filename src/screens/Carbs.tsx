import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { MEAL_TYPES } from '../db/types';
import { todayISO } from '../domain/dates';
import { bolusSuggestion, progressPct } from '../domain/health';
import { lastGlucose, mealsOfDate, mealsTotals } from '../domain/selectors';
import { CarbsScene } from '../three/CarbsScene';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, CardHead, Chip, Field, ScreenHead, Stat } from '../components/ui';
import { MacroBar } from '../components/ui';

export function CarbsScreen() {
  const { profile, goals, logs, actions } = useApp();
  const { toast } = useToast();
  const [carbs, setCarbs] = useState('45');
  const [glucose, setGlucose] = useState('');
  const [icr, setIcr] = useState(String(profile?.icr ?? 10));
  const [isf, setIsf] = useState(String(profile?.isf ?? 50));
  const [target, setTarget] = useState(String(profile?.targetGlucose ?? 110));
  const [iob, setIob] = useState('0');
  const [logging, setLogging] = useState(false);

  const meals = useMemo(() => mealsOfDate(logs, todayISO()), [logs]);
  const totals = useMemo(() => mealsTotals(meals), [meals]);
  const todayCarbs = totals.carbs;
  const last = useMemo(() => lastGlucose(logs), [logs]);

  useEffect(() => {
    if (profile) {
      setIcr(String(profile.icr));
      setIsf(String(profile.isf));
      setTarget(String(profile.targetGlucose));
    }
  }, [profile]);

  useEffect(() => {
    if (last && !glucose) setGlucose(String(last.mgdl));
    // preenche apenas uma vez com a última leitura conhecida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  const result = useMemo(
    () =>
      bolusSuggestion({
        carbs: Number(carbs) || 0,
        icr: Number(icr) || 0,
        isf: Number(isf) || 0,
        currentGlucose: Number(glucose) || 0,
        targetGlucose: Number(target) || 110,
        iob: Number(iob) || 0,
      }),
    [carbs, icr, isf, glucose, target, iob],
  );

  const hasDiabetes = profile?.diabetes && profile.diabetes !== 'nenhum';

  const mealRows = MEAL_TYPES.map((type) => {
    const typeMeals = meals.filter((meal) => meal.mealType === type.id);
    const typeTotals = mealsTotals(typeMeals);
    const units = Number(icr) > 0 ? typeTotals.carbs / Number(icr) : 0;
    return { ...type, kcal: typeTotals.kcal, carbs: typeTotals.carbs, units, count: typeMeals.length };
  });

  const registerDose = async () => {
    if (!result.valid || result.total <= 0) return;
    setLogging(true);
    try {
      await actions.addInsulin(result.total, 'rapida');
      toast(`${result.total} U de insulina rápida registrada`, 'success');
    } catch {
      toast('Não foi possível registrar a dose', 'error');
    } finally {
      setLogging(false);
    }
  };

  return (
    <>
      <ScreenHead
        eyebrow="Contagem de carboidratos"
        title="Carboidratos e bolus"
        subtitle="Estime a dose a partir dos carboidratos e da glicemia atual"
      />

      <div className="grid-2">
        <Card glow style={{ overflow: 'hidden' }}>
          <CardHead title="Hoje" icon="molecule" sub={`${meals.length} refeições · meta ${goals.carbs} g`} />
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <div className="carbs-viz">
              <CarbsScene grams={todayCarbs} />
            </div>
            <div className="stack" style={{ gap: 10, flex: 1 }}>
              <div>
                <div className="num" style={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1 }}>
                  {Math.round(todayCarbs)}
                  <span style={{ fontSize: '.9rem', color: 'var(--muted)', marginLeft: 4 }}>g</span>
                </div>
                <div className="tiny muted">de {goals.carbs} g planejados</div>
              </div>
              <div className="macro-track">
                <span style={{ width: `${Math.min(100, progressPct(todayCarbs, goals.carbs))}%`, background: 'linear-gradient(90deg,#7c5cf0,var(--violet))' }} />
              </div>
              <div className="row tiny muted" style={{ gap: 10, flexWrap: 'wrap' }}>
                <span>Proteína {Math.round(totals.protein)} g</span>
                <span>Gordura {Math.round(totals.fat)} g</span>
              </div>
            </div>
          </div>

          <div className="stack" style={{ gap: 12, marginTop: 16 }}>
            <MacroBar label="Carboidratos" value={todayCarbs} goal={goals.carbs} tone="carbs" />
            <MacroBar label="Fibras" value={totals.fiber} goal={goals.fiber} tone="fiber" />
          </div>

          <div className="row tiny muted" style={{ marginTop: 14, gap: 6, alignItems: 'flex-start' }}>
            <Icon name="info" size={13} />
            Distribua os carboidratos ao longo do dia e prefira fontes integrais, com fibras.
          </div>
        </Card>

        <Card>
          <CardHead
            title="Calculadora de bolus"
            icon="syringe"
            sub={hasDiabetes ? `Relação 1U : ${icr} g · sensibilidade 1U : ${isf} mg/dL` : 'Ajuste os parâmetros do seu plano'}
            action={<Chip tone="amber">Estimativa</Chip>}
          />
          <div className="field-row">
            <Field label="Carboidratos (g)" htmlFor="bolus-carbs">
              <input id="bolus-carbs" className="input" type="number" inputMode="decimal" value={carbs} onChange={(event) => setCarbs(event.target.value)} />
            </Field>
            <Field label="Glicemia atual (mg/dL)" htmlFor="bolus-glucose">
              <input id="bolus-glucose" className="input" type="number" inputMode="numeric" value={glucose} onChange={(event) => setGlucose(event.target.value)} placeholder="Opcional" />
            </Field>
          </div>
          <div className="portion-chips" style={{ marginTop: -4 }}>
            {[15, 30, 45, 60, 75].map((value) => (
              <button type="button" key={value} className={`cat-pill${Number(carbs) === value ? ' is-active' : ''}`} onClick={() => setCarbs(String(value))}>
                {value} g
              </button>
            ))}
          </div>
          <div className="field-row" style={{ marginTop: 12 }}>
            <Field label="1 U cobre (g)" htmlFor="bolus-icr">
              <input id="bolus-icr" className="input" type="number" inputMode="decimal" value={icr} onChange={(event) => setIcr(event.target.value)} />
            </Field>
            <Field label="1 U baixa (mg/dL)" htmlFor="bolus-isf">
              <input id="bolus-isf" className="input" type="number" inputMode="decimal" value={isf} onChange={(event) => setIsf(event.target.value)} />
            </Field>
          </div>
          <div className="field-row" style={{ marginTop: 12 }}>
            <Field label="Glicemia alvo" htmlFor="bolus-target">
              <input id="bolus-target" className="input" type="number" inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} />
            </Field>
            <Field label="Insulina ativa (U)" htmlFor="bolus-iob" hint="Dose ainda em ação">
              <input id="bolus-iob" className="input" type="number" inputMode="decimal" value={iob} onChange={(event) => setIob(event.target.value)} />
            </Field>
          </div>

          <div className="goal-preview" style={{ marginTop: 16, borderColor: 'rgba(47,224,176,.24)' }}>
            <div style={{ flex: 1 }}>
              <div className="stat__label">Dose sugerida</div>
              <div className="stat__value" style={{ fontSize: '1.9rem', color: result.valid ? 'var(--mint)' : 'var(--muted)' }}>
                {result.valid ? result.total.toFixed(1).replace('.', ',') : '—'}
                <small>U</small>
              </div>
            </div>
            <div className="tiny muted" style={{ textAlign: 'right', lineHeight: 1.5 }}>
              <div>
                Refeição: {result.carbUnits.toFixed(1).replace('.', ',')} U
              </div>
              <div>
                Correção: {result.correctionUnits >= 0 ? '+' : ''}
                {result.correctionUnits.toFixed(1).replace('.', ',')} U
              </div>
              {Number(iob) > 0 ? <div>Insulina ativa: −{Number(iob).toFixed(1).replace('.', ',')} U</div> : null}
            </div>
          </div>

          {result.warning ? (
            <p className="disclaimer" style={{ marginTop: 12, borderColor: 'rgba(255,190,92,.4)' }}>
              <b>Atenção:</b> {result.warning}
            </p>
          ) : null}

          <Button variant="soft" icon="syringe" block onClick={() => void registerDose()} disabled={!result.valid || result.total <= 0 || logging} style={{ marginTop: 14 }}>
            {logging ? 'Registrando…' : 'Registrar esta dose'}
          </Button>

          <p className="disclaimer" style={{ marginTop: 12 }}>
            <b>Não é prescrição.</b> A calculadora é educativa e usa apenas os parâmetros informados. Confirme sempre a dose com sua equipe de saúde e as regras do seu plano de insulina.
          </p>
        </Card>
      </div>

      <Card>
        <CardHead title="Carboidratos por refeição" icon="utensils" sub="Com estimativa de bolus usando sua relação atual" />
        <div className="stack" style={{ gap: 4 }}>
          {mealRows.map((row) => (
            <div className="log-item" key={row.id}>
              <span className="log-item__icon log-item__icon--violet">
                <Icon name={row.icon as IconName} />
              </span>
              <div className="log-item__body">
                <div className="log-item__title">{row.label}</div>
                <div className="log-item__meta">
                  {row.count ? `${row.kcal} kcal · ${Math.round(row.carbs)} g de carboidrato` : 'Sem registro'}
                </div>
              </div>
              <div className="log-item__value">
                {row.count && Number(icr) > 0 ? `${row.units.toFixed(1).replace('.', ',')} U` : '—'}
                <small>bolus estimado</small>
              </div>
            </div>
          ))}
        </div>
        <div className="totals-row" style={{ marginTop: 14 }}>
          <span>Total do dia</span>
          <span className="row" style={{ gap: 16 }}>
            <b>{Math.round(todayCarbs)} g</b>
            <b style={{ color: 'var(--violet)' }}>{Number(icr) > 0 ? (todayCarbs / Number(icr)).toFixed(1).replace('.', ',') : '—'} U</b>
          </span>
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHead title="Como contar carboidratos" icon="book" />
          <ul className="stack" style={{ gap: 10 }}>
            {[
              'Pese os alimentos crus quando possível: a cocção muda o peso e concentra os nutrientes.',
              'Use rótulos: carboidratos totais menos fibras = carboidrato líquido, quando o plano pedir.',
              'Aprenda porções fixas: 1 colher de arroz ≈ 25 g, 1 pão francês ≈ 50 g, 1 fruta média ≈ 15–20 g de carboidrato.',
              'Registre a refeição no Vitalis: a soma por refeição já aparece pronta na tabela acima.',
            ].map((tip) => (
              <li key={tip} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span className="log-item__icon log-item__icon--mint" style={{ width: 26, height: 26, marginTop: 1 }}>
                  <Icon name="check" size={13} />
                </span>
                <span className="small soft">{tip}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHead title="Seus parâmetros" icon="settings" />
          <div className="stat-grid">
            <Stat label="Relação carbo/insulina" value={`1:${icr || '—'}`} hint="gramas por unidade" />
            <Stat label="Sensibilidade" value={isf || '—'} unit="mg/dL" hint="queda por unidade" />
            <Stat label="Alvo de correção" value={target || '—'} unit="mg/dL" hint="glicemia desejada" />
          </div>
          <p className="field__hint" style={{ marginTop: 12 }}>
            Esses valores vêm de Ajustes → Perfil clínico e podem ser atualizados a qualquer momento. Eles não substituem a prescrição médica.
          </p>
        </Card>
      </div>
    </>
  );
}
