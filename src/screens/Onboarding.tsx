import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { ACTIVITY_LABELS, DEFAULT_PROFILE, type ActivityLevel, type DiabetesType, type GoalKind, type Profile, type Sex } from '../db/types';
import { calcGoals, calcMetabolic, formatDecimal, idealWeightRange } from '../domain/health';
import { OrbScene } from '../three/OrbScene';
import { Icon } from '../components/Icon';
import { Button, Field, Logo } from '../components/ui';

const STEPS = 4;

export function OnboardingScreen() {
  const { profile, actions } = useApp();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [draft, setDraft] = useState<Profile>(() => ({
    ...DEFAULT_PROFILE,
    ...(profile ?? {}),
    onboarded: false,
    birthDate: profile?.birthDate ?? '',
    heightCm: profile?.heightCm ?? 168,
    weightKg: profile?.weightKg ?? 68,
  }));

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const auto = useMemo(
    () =>
      calcGoals({
        ...draft,
        calorieGoal: 0,
        waterGoalMl: 0,
        carbGoalG: 0,
        proteinGoalG: 0,
        fatGoalG: 0,
        fiberGoalG: 0,
      }),
    [draft],
  );
  const metabolic = useMemo(() => calcMetabolic(draft), [draft]);
  const ideal = useMemo(() => idealWeightRange(draft.heightCm), [draft.heightCm]);

  const canAdvance = step === 1 ? draft.heightCm >= 120 && draft.weightKg >= 25 : true;

  const finish = async () => {
    setBusy(true);
    try {
      await actions.saveProfile({ ...draft, name: draft.name.trim() || 'Você', onboarded: true });
      if (demo) {
        await actions.loadDemo();
        toast('Dados de exemplo carregados — explore à vontade', 'success');
      } else {
        toast('Tudo pronto! Comece registrando seu dia', 'success');
      }
    } catch {
      toast('Não foi possível concluir a configuração', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__scene">
        <OrbScene calories={0.7} water={0.55} glucose={0.85} />
      </div>

      <div className="onboarding__top">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand__mark">
            <Logo size={22} />
          </div>
          <div>
            <div className="brand__name">Vitalis</div>
            <div className="brand__tag">cuidado diário</div>
          </div>
        </div>
        <div className="steps" style={{ maxWidth: 160 }}>
          {Array.from({ length: STEPS }, (_, index) => (
            <span key={index} className={`step-dot${index <= step ? ' is-done' : ''}`} />
          ))}
        </div>
        <span className="steps-label">
          {step + 1}/{STEPS}
        </span>
      </div>

      <div className="onboarding__card">
        {step === 0 ? (
          <>
            <h1 className="onboarding__title">
              Seu dia, <em style={{ fontStyle: 'normal', color: 'var(--mint)' }}>em equilíbrio</em>
            </h1>
            <p className="onboarding__sub">
              Calorias, água, carboidratos e glicemia em um só lugar — offline, privado e feito para o seu ritmo.
            </p>
            <div className="onboarding__body">
              <Field label="Como podemos te chamar?" htmlFor="onb-name">
                <input id="onb-name" className="input" value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="Seu primeiro nome" autoComplete="given-name" />
              </Field>
              <div className="field-row">
                <Field label="Nascimento" htmlFor="onb-birth" hint="Para estimar o gasto energético">
                  <input id="onb-birth" className="input" type="date" value={draft.birthDate} onChange={(event) => set('birthDate', event.target.value)} />
                </Field>
                <Field label="Sexo biológico" hint="Usado no cálculo de calorias">
                  <div className="segmented">
                    {(
                      [
                        { value: 'f', label: 'Fem.' },
                        { value: 'm', label: 'Masc.' },
                        { value: 'o', label: 'Outro' },
                      ] as { value: Sex; label: string }[]
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`segmented__btn${draft.sex === option.value ? ' is-active' : ''}`}
                        onClick={() => set('sex', option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="onboarding__title">Seu corpo, suas metas</h1>
            <p className="onboarding__sub">Esses dados definem calorias e hidratação recomendadas.</p>
            <div className="onboarding__body">
              <div className="field-row">
                <Field label="Altura (cm)" htmlFor="onb-height">
                  <input id="onb-height" className="input" type="number" inputMode="numeric" value={draft.heightCm} onChange={(event) => set('heightCm', Number(event.target.value))} />
                </Field>
                <Field label="Peso (kg)" htmlFor="onb-weight">
                  <input id="onb-weight" className="input" type="number" inputMode="decimal" step="0.1" value={draft.weightKg} onChange={(event) => set('weightKg', Number(event.target.value))} />
                </Field>
              </div>
              <Field label="Nível de atividade" htmlFor="onb-activity" hint={ACTIVITY_LABELS[draft.activity].hint}>
                <select id="onb-activity" className="select" value={draft.activity} onChange={(event) => set('activity', event.target.value as ActivityLevel)}>
                  {Object.entries(ACTIVITY_LABELS).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label} — {item.hint}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="goal-preview">
                <div className="goal-preview__text">
                  <div className="stat__label">Gasto estimado</div>
                  <b>{metabolic.tdee.toLocaleString('pt-BR')} kcal</b>
                  <p className="tiny muted">Metabolismo basal de {metabolic.bmr} kcal</p>
                </div>
                <div className="goal-preview__text" style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div className="stat__label">Água sugerida</div>
                  <b>{auto.waterMl.toLocaleString('pt-BR')} ml</b>
                  <p className="tiny muted">35 ml por kg</p>
                </div>
              </div>
              <p className="tiny muted" style={{ marginTop: 2 }}>
                Peso saudável pelo IMC (18,5–24,9): <b style={{ color: 'var(--text-soft)' }}>{formatDecimal(ideal[0])}–{formatDecimal(ideal[1])} kg</b>
              </p>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="onboarding__title">Qual é o seu objetivo?</h1>
            <p className="onboarding__sub">Você pode ajustar tudo depois, sem pressa.</p>
            <div className="onboarding__body">
              <div className="grid-3" style={{ gap: 8 }}>
                {(
                  [
                    { value: 'perder', label: 'Perder peso', icon: 'arrowDown', hint: 'Déficit calórico' },
                    { value: 'manter', label: 'Manter', icon: 'target', hint: 'Equilíbrio' },
                    { value: 'ganhar', label: 'Ganhar massa', icon: 'arrowUp', hint: 'Superávit leve' },
                  ] as { value: GoalKind; label: string; icon: 'arrowDown' | 'target' | 'arrowUp'; hint: string }[]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="quick-action"
                    onClick={() => set('goal', option.value)}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 8,
                      borderColor: draft.goal === option.value ? 'rgba(47,224,176,.55)' : undefined,
                      background: draft.goal === option.value ? 'var(--mint-soft)' : undefined,
                    }}
                  >
                    <span className="quick-action__icon" style={{ width: 30, height: 30 }}>
                      <Icon name={option.icon} size={16} />
                    </span>
                    <span className="quick-action__text">
                      <b>{option.label}</b>
                      <span>{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              {draft.goal !== 'manter' ? (
                <Field label={`Ritmo: ${draft.rateKgWeek.toFixed(2)} kg por semana`} htmlFor="onb-rate">
                  <input
                    id="onb-rate"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={draft.rateKgWeek}
                    onChange={(event) => set('rateKgWeek', Number(event.target.value))}
                    style={{ width: '100%', accentColor: 'var(--mint)' }}
                  />
                </Field>
              ) : null}
              <Field label="Você acompanha diabetes?" htmlFor="onb-diabetes" hint="Isso habilita a contagem de carboidratos e a calculadora de bolus">
                <select id="onb-diabetes" className="select" value={draft.diabetes} onChange={(event) => set('diabetes', event.target.value as DiabetesType)}>
                  <option value="nenhum">Não / prefiro não informar</option>
                  <option value="tipo1">Sim, tipo 1</option>
                  <option value="tipo2">Sim, tipo 2</option>
                  <option value="prediabetes">Pré-diabetes</option>
                  <option value="gestacional">Diabetes gestacional</option>
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="onboarding__title">Tudo pronto, {draft.name.trim().split(' ')[0] || 'vamos lá'}</h1>
            <p className="onboarding__sub">Estas são as metas iniciais. Ajuste quando quiser em Ajustes.</p>
            <div className="onboarding__body">
              <div className="goal-preview" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div className="between">
                  <span className="row small muted" style={{ gap: 8 }}>
                    <Icon name="flame" size={16} /> Calorias por dia
                  </span>
                  <b style={{ fontSize: '1.2rem' }}>{auto.kcal.toLocaleString('pt-BR')} kcal</b>
                </div>
                <div className="between">
                  <span className="row small muted" style={{ gap: 8 }}>
                    <Icon name="droplet" size={16} /> Água por dia
                  </span>
                  <b style={{ fontSize: '1.2rem' }}>{(auto.waterMl / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</b>
                </div>
                <div className="between">
                  <span className="row small muted" style={{ gap: 8 }}>
                    <Icon name="molecule" size={16} /> Carboidratos
                  </span>
                  <b style={{ fontSize: '1.2rem' }}>{auto.carbs} g</b>
                </div>
                <div className="between">
                  <span className="row small muted" style={{ gap: 8 }}>
                    <Icon name="utensils" size={16} /> Proteínas
                  </span>
                  <b style={{ fontSize: '1.2rem' }}>{auto.protein} g</b>
                </div>
              </div>

              <label className="row" style={{ gap: 10, fontSize: '.82rem', color: 'var(--text-soft)', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(event) => setDemo(event.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--mint)' }}
                />
                <span>
                  Carregar 21 dias de dados de exemplo
                  <span className="tiny muted" style={{ display: 'block' }}>
                    Ótimo para explorar o app. Você pode apagar tudo depois em Ajustes.
                  </span>
                </span>
              </label>

              <p className="disclaimer">
                <b>Importante:</b> o Vitalis organiza seus registros e não substitui orientação médica. Metas de glicemia e doses de insulina devem ser definidas pela sua equipe de saúde.
              </p>
            </div>
          </>
        ) : null}

        <div className="onboarding__foot">
          {step > 0 ? (
            <Button variant="ghost" icon="chevronLeft" onClick={() => setStep((prev) => prev - 1)} disabled={busy}>
              Voltar
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS - 1 ? (
            <Button variant="primary" iconRight="chevronRight" onClick={() => setStep((prev) => prev + 1)} disabled={!canAdvance} style={{ marginLeft: 'auto' }}>
              Continuar
            </Button>
          ) : (
            <Button variant="primary" icon="check" onClick={() => void finish()} disabled={busy} style={{ marginLeft: 'auto' }}>
              {busy ? 'Preparando…' : 'Começar agora'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
