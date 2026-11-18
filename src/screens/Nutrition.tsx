import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { MEAL_TYPES, type MealType } from '../db/types';
import { addDays, timeLabel, todayISO } from '../domain/dates';
import { formatKcal, formatG, progressPct } from '../domain/health';
import { mealTotals, mealsByType, mealsOfDate, mealsTotals } from '../domain/selectors';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, CardHead, Chip, EmptyState, MacroBar, ProgressRing, ScreenHead } from '../components/ui';
import { AddMealSheet } from '../components/AddSheets';
import { WeeklyBars } from '../components/charts';
import { useMediaQuery } from '../state/useMediaQuery';

export function NutritionScreen() {
  const { profile, goals, logs, actions } = useApp();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>('almoco');
  const compact = useMediaQuery('(max-width: 480px)');

  const today = todayISO();
  const meals = useMemo(() => mealsOfDate(logs, today), [logs, today]);
  const totals = useMemo(() => mealsTotals(meals), [meals]);
  const remaining = goals.kcal - totals.kcal;

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      const dayMeals = logs.filter((log): log is Extract<typeof log, { kind: 'meal' }> => log.kind === 'meal' && log.date === date);
      const total = dayMeals.reduce((acc, meal) => acc + mealTotals(meal).kcal, 0);
      const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '');
      return { label, value: total, muted: total === 0 };
    });
  }, [logs, today]);

  const openAdd = (type: MealType) => {
    setMealType(type);
    setSheetOpen(true);
  };

  return (
    <>
      <ScreenHead
        eyebrow="Diário alimentar"
        title="Nutrição"
        subtitle={`${meals.length} refeições registradas hoje · ${formatKcal(totals.kcal)} de ${formatKcal(goals.kcal)}`}
        actions={
          <Button variant="primary" icon="plus" onClick={() => openAdd('almoco')}>
            Adicionar refeição
          </Button>
        }
      />

      <div className="grid-2">
        <Card glow>
          <CardHead title="Balanço do dia" icon="flame" sub={`Meta calculada a partir do seu perfil (${goals.tdee} kcal de gasto estimado)`} />
          <div className="row" style={{ gap: compact ? 14 : 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <ProgressRing
              value={totals.kcal}
              max={goals.kcal}
              size={compact ? 120 : 148}
              stroke={compact ? 9 : 11}
              color="var(--amber)"
              color2="#ff9f4a"
              ariaLabel={`${progressPct(totals.kcal, goals.kcal)}% da meta calórica`}
            >
              <span className="ring__value">{Math.round(totals.kcal)}</span>
              <span className="ring__label">de {goals.kcal} kcal</span>
            </ProgressRing>
            <div className="stack" style={{ gap: 10, flex: 1, minWidth: compact ? 0 : 180 }}>
              <div>
                <span className={`chip ${remaining >= 0 ? 'chip--mint' : 'chip--amber'}`}>
                  <Icon name={remaining >= 0 ? 'arrowDown' : 'arrowUp'} />
                  {remaining >= 0 ? `${Math.round(remaining)} kcal restantes` : `${Math.abs(Math.round(remaining))} kcal acima`}
                </span>
              </div>
              {compact ? (
                <p className="tiny muted">
                  Gasto estimado {goals.tdee} kcal · TMB {goals.bmr} kcal
                </p>
              ) : (
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                  <div className="stat" style={{ padding: '10px 12px' }}>
                    <div className="stat__label">Gasto estimado</div>
                    <div className="stat__value" style={{ fontSize: '1rem' }}>
                      {goals.tdee}
                      <small>kcal</small>
                    </div>
                  </div>
                  <div className="stat" style={{ padding: '10px 12px' }}>
                    <div className="stat__label">Taxa metabólica</div>
                    <div className="stat__value" style={{ fontSize: '1rem' }}>
                      {goals.bmr}
                      <small>kcal</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Macronutrientes"
            icon="pie"
            sub={`${Math.round(totals.protein)} g proteína · ${Math.round(totals.fat)} g gordura`}
          />
          <div className="macro-list">
            <MacroBar label="Carboidratos" value={totals.carbs} goal={goals.carbs} tone="carbs" />
            <MacroBar label="Proteínas" value={totals.protein} goal={goals.protein} tone="protein" />
            <MacroBar label="Gorduras" value={totals.fat} goal={goals.fat} tone="fat" />
            <MacroBar label="Fibras" value={totals.fiber} goal={goals.fiber} tone="fiber" />
          </div>
          <div className="row tiny muted" style={{ marginTop: 14, gap: 6 }}>
            <Icon name="info" size={13} />
            Valores de referência aproximados. Ajuste as metas em Ajustes.
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Distribuição por refeição"
          icon="chart"
          sub="Calorias de hoje em cada momento"
          action={<Chip tone="amber">{formatKcal(totals.kcal)}</Chip>}
        />
        <div className="stack" style={{ gap: 14 }}>
          {MEAL_TYPES.map((type) => {
            const typeMeals = mealsByType(meals, type.id);
            const typeTotals = mealsTotals(typeMeals);
            const pct = goals.kcal > 0 ? Math.min(100, (typeTotals.kcal / goals.kcal) * 100) : 0;
            return (
              <div key={type.id} className="row" style={{ gap: 12 }}>
                <span className="log-item__icon" style={{ width: 32, height: 32 }}>
                  <Icon name={type.icon as IconName} size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="small strong">{type.label}</span>
                    <span className="tiny muted num">{typeTotals.kcal} kcal · {Math.round(pct)}%</span>
                  </div>
                  <div className="macro-track">
                    <span style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #d99a2b, var(--amber))' }} />
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={() => openAdd(type.id)} aria-label={`Adicionar em ${type.label}`}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHead title="Calorias na semana" icon="calendar" sub="Últimos 7 dias" />
        <WeeklyBars data={week} goal={goals.kcal} color="var(--amber)" ariaLabel="Calorias dos últimos sete dias" formatValue={(value) => `${Math.round(value)} kcal`} />
        <div className="row tiny muted" style={{ marginTop: 10, gap: 6 }}>
          <Icon name="info" size={13} /> A linha tracejada representa sua meta diária de {goals.kcal} kcal.
        </div>
      </Card>

      <Card>
        <CardHead title="Diário de hoje" icon="book" sub="Toque no + para adicionar" />
        <div className="stack" style={{ gap: 10 }}>
          {MEAL_TYPES.map((type) => {
            const typeMeals = mealsByType(meals, type.id);
            const typeTotals = mealsTotals(typeMeals);
            return (
              <div className="meal-block" key={type.id}>
                <div className="meal-block__head">
                  <span className="meal-block__icon">
                    <Icon name={type.icon as IconName} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="meal-block__title">{type.label}</div>
                    <div className="meal-block__kcal">
                      {typeMeals.length ? `${typeTotals.kcal} kcal · ${Math.round(typeTotals.carbs)} g carboidratos` : type.hint}
                    </div>
                  </div>
                  <button type="button" className="meal-block__add" onClick={() => openAdd(type.id)} aria-label={`Adicionar em ${type.label}`}>
                    <Icon name="plus" />
                  </button>
                </div>
                {typeMeals.length ? (
                  <div className="meal-items">
                    {typeMeals.map((meal) => (
                      <div key={meal.id}>
                        {meal.items.map((item, index) => (
                          <div className="meal-item-row" key={`${meal.id}-${index}`}>
                            <span className="meal-item-row__name">{item.name}</span>
                            <span className="meal-item-row__g">{item.grams} g</span>
                            <span className="meal-item-row__kcal">{item.kcal} kcal</span>
                          </div>
                        ))}
                        <div className="row tiny muted" style={{ marginTop: 6, gap: 8 }}>
                          <span>{timeLabel(meal.createdAt)}</span>
                          {meal.note ? <span>· {meal.note}</span> : null}
                          <button
                            type="button"
                            className="log-item__del"
                            style={{ opacity: 0.65, marginLeft: 'auto' }}
                            onClick={() => {
                              void actions.deleteLog(meal.id);
                              toast('Refeição removida');
                            }}
                            aria-label="Remover refeição"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      {!meals.length ? (
        <Card>
          <EmptyState
            icon="utensils"
            title="Nenhuma refeição registrada hoje"
            hint="Busque em nossa base com mais de 100 alimentos ou crie o seu."
            action={
              <Button variant="primary" icon="plus" onClick={() => openAdd('cafe')}>
                Registrar primeira refeição
              </Button>
            }
          />
        </Card>
      ) : null}

      <Card flat>
        <div className="row tiny muted" style={{ gap: 8 }}>
          <Icon name="info" size={14} />
          As metas foram calculadas com a equação de Mifflin-St Jeor e podem ser ajustadas manualmente em Ajustes → Metas. Perfil:
          {profile ? ` ${profile.sex === 'm' ? 'masculino' : profile.sex === 'f' ? 'feminino' : 'outro'}, ${profile.heightCm} cm, ${profile.weightKg} kg.` : ''}
        </div>
      </Card>

      <AddMealSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialType={mealType}
        onAdd={async (type, items, note) => {
          await actions.addMeal(type, items, note);
        }}
      />
    </>
  );
}
