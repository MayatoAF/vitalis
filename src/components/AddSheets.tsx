import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { FOOD_CATEGORIES } from '../db/foods';
import { MEAL_TYPES, type Food, type GlucoseContext, type MealItem, type MealType } from '../db/types';
import { GLUCOSE_CONTEXTS } from '../db/types';
import { calcBMI, bmiCategory, clamp, formatDecimal, glucoseStatus, idealWeightRange } from '../domain/health';
import { makeId, todayISO } from '../domain/dates';
import { Button, Field, Segmented, Sheet } from './ui';
import { Icon, type IconName } from './Icon';

/* ------------------------------- refeição ------------------------------- */

interface CartLine {
  key: string;
  food: Food;
  grams: number;
}

const scale = (food: Food, grams: number): MealItem => {
  const factor = grams / 100;
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    name: food.name,
    grams,
    kcal: Math.round(food.per100.kcal * factor),
    carbs: round1(food.per100.carbs * factor),
    protein: round1(food.per100.protein * factor),
    fat: round1(food.per100.fat * factor),
    fiber: round1(food.per100.fiber * factor),
  };
};

export function AddMealSheet({
  open,
  onClose,
  initialType = 'almoco',
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  initialType?: MealType;
  onAdd: (mealType: MealType, items: MealItem[], note?: string) => Promise<void>;
}) {
  const { foods, actions } = useApp();
  const { toast } = useToast();
  const [mealType, setMealType] = useState<MealType>(initialType);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mode, setMode] = useState<'buscar' | 'novo'>('buscar');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const [custom, setCustom] = useState({ name: '', grams: 100, kcal: '', carbs: '', protein: '', fat: '', fiber: '', save: true });

  useEffect(() => {
    if (!open) return;
    setMealType(initialType);
    setQuery('');
    setCategory('Todos');
    setCart([]);
    setMode('buscar');
    setNote('');
    setCustom({ name: '', grams: 100, kcal: '', carbs: '', protein: '', fat: '', fiber: '', save: true });
  }, [open, initialType]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return foods.filter((food) => {
      const matchesQuery = !normalized || food.name.toLowerCase().includes(normalized);
      const matchesCategory =
        category === 'Todos' ? true : category === 'Favoritos' ? Boolean(food.favorite) : food.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [foods, query, category]);

  const decimal = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const totals = useMemo(
    () =>
      cart.reduce(
        (acc, line) => {
          const item = scale(line.food, line.grams);
          return { kcal: acc.kcal + item.kcal, carbs: acc.carbs + item.carbs, protein: acc.protein + item.protein, fat: acc.fat + item.fat };
        },
        { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      ),
    [cart],
  );

  const addFood = (food: Food) => {
    const grams = food.portions[0]?.grams ?? 100;
    setCart((prev) => {
      const existing = prev.find((line) => line.food.id === food.id);
      if (existing) return prev.map((line) => (line.key === existing.key ? { ...line, grams: line.grams + grams } : line));
      return [...prev, { key: `${food.id}-${Date.now()}`, food, grams }];
    });
  };

  const updateGrams = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => (line.key === key ? { ...line, grams: clamp(line.grams + delta, 5, 2000) } : line))
        .filter((line) => line.grams > 0),
    );
  };

  const submit = async () => {
    if (!cart.length) return;
    setSaving(true);
    try {
      await onAdd(
        mealType,
        cart.map((line) => scale(line.food, line.grams)),
        note.trim() || undefined,
      );
      toast('Refeição registrada', 'success');
      onClose();
    } catch {
      toast('Não foi possível salvar a refeição', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addCustomFood = async () => {
    const name = custom.name.trim();
    const grams = clamp(Number(custom.grams) || 100, 1, 2000);
    if (!name) {
      toast('Dê um nome ao alimento', 'warning');
      return;
    }
    const food: Food = {
      id: `custom-${makeId()}`,
      name,
      category: 'Meus alimentos',
      per100: {
        kcal: Number(custom.kcal) || 0,
        carbs: Number(custom.carbs) || 0,
        protein: Number(custom.protein) || 0,
        fat: Number(custom.fat) || 0,
        fiber: Number(custom.fiber) || 0,
      },
      portions: [{ label: `1 porção (${grams} g)`, grams }],
      custom: true,
    };
    if (custom.save) {
      await actions.addCustomFood(food);
      toast('Alimento salvo na sua base', 'success');
    }
    setCart((prev) => [...prev, { key: `${food.id}-${Date.now()}`, food, grams }]);
    setMode('buscar');
    setCustom({ name: '', grams: 100, kcal: '', carbs: '', protein: '', fat: '', fiber: '', save: true });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Adicionar refeição"
      subtitle="Busque na base ou crie um alimento"
      icon="utensils"
      wide
      footer={
        <>
          <Button variant="soft" onClick={onClose} block>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!cart.length || saving} block>
            {saving ? 'Salvando…' : `Adicionar${cart.length ? ` (${cart.length})` : ''}`}
          </Button>
        </>
      }
    >
      <Segmented
        ariaLabel="Tipo de refeição"
        value={mealType}
        onChange={setMealType}
        options={MEAL_TYPES.map((type) => ({ value: type.id, label: type.label.replace('Café da manhã', 'Café').replace('Lanches', 'Lanche') }))}
      />

      {mode === 'buscar' ? (
        <>
          <div className="search-box">
            <Icon name="search" />
            <input
              className="input"
              type="search"
              placeholder="Buscar alimento"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar alimento"
            />
            {query ? (
              <button type="button" className="search-box__clear" onClick={() => setQuery('')} aria-label="Limpar busca">
                <Icon name="x" />
              </button>
            ) : null}
          </div>

          <div className="cat-row">
            {FOOD_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={`cat-pill${category === item ? ' is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="food-list">
            {filtered.length ? (
              filtered.map((food) => (
                <button type="button" className="food-row" key={food.id} onClick={() => addFood(food)}>
                  <span className={`log-item__icon${food.favorite ? ' log-item__icon--mint' : ''}`} style={{ width: 34, height: 34 }}>
                    <Icon name="bowl" size={16} />
                  </span>
                  <span className="food-row__body">
                    <span className="food-row__name">{food.name}</span>
                    <span className="food-row__meta">
                      {food.per100.kcal} kcal · {decimal(food.per100.carbs)} g carb · {decimal(food.per100.protein)} g prot
                    </span>
                  </span>
                  <span className="food-row__add" aria-hidden="true">
                    <Icon name="plus" />
                  </span>
                </button>
              ))
            ) : (
              <p className="empty" style={{ padding: '22px 8px' }}>
                Nenhum alimento encontrado. Crie um novo abaixo.
              </p>
            )}
          </div>

          <Button variant="soft" icon="plus" onClick={() => setMode('novo')} block>
            Criar alimento personalizado
          </Button>
        </>
      ) : (
        <div className="stack">
          <Field label="Nome do alimento" htmlFor="custom-name">
            <input
              id="custom-name"
              className="input"
              value={custom.name}
              onChange={(event) => setCustom({ ...custom, name: event.target.value })}
              placeholder="Ex.: Bolo de cenoura da vó"
            />
          </Field>
          <div className="field-row">
            <Field label="Porção (g)" htmlFor="custom-grams">
              <input
                id="custom-grams"
                className="input"
                type="number"
                inputMode="numeric"
                value={custom.grams}
                onChange={(event) => setCustom({ ...custom, grams: Number(event.target.value) })}
              />
            </Field>
            <Field label="Calorias (kcal)" htmlFor="custom-kcal">
              <input
                id="custom-kcal"
                className="input"
                type="number"
                inputMode="numeric"
                value={custom.kcal}
                onChange={(event) => setCustom({ ...custom, kcal: event.target.value })}
              />
            </Field>
          </div>
          <p className="field__hint">Informe os valores por 100 g do alimento.</p>
          <div className="field-row">
            <Field label="Carboidratos (g)" htmlFor="custom-carbs">
              <input
                id="custom-carbs"
                className="input"
                type="number"
                inputMode="decimal"
                value={custom.carbs}
                onChange={(event) => setCustom({ ...custom, carbs: event.target.value })}
              />
            </Field>
            <Field label="Proteínas (g)" htmlFor="custom-protein">
              <input
                id="custom-protein"
                className="input"
                type="number"
                inputMode="decimal"
                value={custom.protein}
                onChange={(event) => setCustom({ ...custom, protein: event.target.value })}
              />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Gorduras (g)" htmlFor="custom-fat">
              <input
                id="custom-fat"
                className="input"
                type="number"
                inputMode="decimal"
                value={custom.fat}
                onChange={(event) => setCustom({ ...custom, fat: event.target.value })}
              />
            </Field>
            <Field label="Fibras (g)" htmlFor="custom-fiber">
              <input
                id="custom-fiber"
                className="input"
                type="number"
                inputMode="decimal"
                value={custom.fiber}
                onChange={(event) => setCustom({ ...custom, fiber: event.target.value })}
              />
            </Field>
          </div>
          <label className="row" style={{ fontSize: '.82rem', color: 'var(--text-soft)' }}>
            <input
              type="checkbox"
              checked={custom.save}
              onChange={(event) => setCustom({ ...custom, save: event.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--mint)' }}
            />
            Salvar este alimento na minha base
          </label>
          <div className="row">
            <Button variant="ghost" onClick={() => setMode('buscar')} block>
              Voltar
            </Button>
            <Button variant="primary" icon="plus" onClick={() => void addCustomFood()} block>
              Adicionar à refeição
            </Button>
          </div>
        </div>
      )}

      {cart.length ? (
        <div className="stack">
          <div className="between">
            <h3 style={{ fontSize: '.82rem' }}>Nesta refeição</h3>
            <button type="button" className="card-link" onClick={() => setCart([])}>
              Limpar
            </button>
          </div>
          <div className="cart-list">
            {cart.map((line) => (
              <div className="cart-item" key={line.key}>
                <div className="cart-item__body">
                  <div className="cart-item__name">{line.food.name}</div>
                  <div className="cart-item__meta">{scale(line.food, line.grams).kcal} kcal</div>
                </div>
                <div className="cart-item__qty">
                  <button type="button" onClick={() => updateGrams(line.key, -10)} aria-label="Diminuir 10 gramas">
                    <Icon name="minus" size={13} />
                  </button>
                  <span>{line.grams} g</span>
                  <button type="button" onClick={() => updateGrams(line.key, 10)} aria-label="Aumentar 10 gramas">
                    <Icon name="plus" size={13} />
                  </button>
                </div>
                <button type="button" className="cart-item__remove" onClick={() => setCart((prev) => prev.filter((item) => item.key !== line.key))} aria-label="Remover item">
                  <Icon name="x" />
                </button>
              </div>
            ))}
          </div>
          <div className="totals-row">
            <span>Total da refeição</span>
            <b>{totals.kcal} kcal</b>
          </div>
          <div className="row tiny muted" style={{ gap: 14, flexWrap: 'wrap' }}>
            <span>Carboidratos {Math.round(totals.carbs)} g</span>
            <span>Proteínas {Math.round(totals.protein)} g</span>
            <span>Gorduras {Math.round(totals.fat)} g</span>
          </div>
          <Field label="Observação (opcional)" htmlFor="meal-note">
            <input id="meal-note" className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: almoço fora de casa" />
          </Field>
        </div>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------- glicemia ------------------------------- */

export function AddGlucoseSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (mgdl: number, context: GlucoseContext, note?: string) => Promise<void>;
}) {
  const { profile } = useApp();
  const { toast } = useToast();
  const [value, setValue] = useState('110');
  const [context, setContext] = useState<GlucoseContext>('jejum');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue('110');
    setContext('jejum');
    setNote('');
  }, [open]);

  const numeric = Number(value);
  const status = numeric > 0 ? glucoseStatus(numeric, profile?.glucoseLow ?? 70, profile?.glucoseHigh ?? 180) : null;

  const submit = async () => {
    if (!numeric || numeric < 20 || numeric > 600) {
      toast('Informe uma glicemia entre 20 e 600 mg/dL', 'warning');
      return;
    }
    setSaving(true);
    try {
      await onAdd(numeric, context, note.trim() || undefined);
      toast('Glicemia registrada', 'success');
      onClose();
    } catch {
      toast('Não foi possível salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar glicemia"
      subtitle="Capilar ou sensor, em mg/dL"
      icon="activity"
      footer={
        <>
          <Button variant="soft" onClick={onClose} block>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving} block>
            {saving ? 'Salvando…' : 'Salvar leitura'}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="stepper" style={{ width: '100%', maxWidth: 300 }}>
          <button type="button" onClick={() => setValue(String(clamp(Number(value) - 5, 20, 600)))} aria-label="Diminuir 5">
            <Icon name="minus" />
          </button>
          <input
            className="input"
            style={{ border: 0, background: 'none', fontSize: '1.8rem', fontWeight: 700 }}
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label="Glicemia em mg/dL"
          />
          <button type="button" onClick={() => setValue(String(clamp(Number(value) + 5, 20, 600)))} aria-label="Aumentar 5">
            <Icon name="plus" />
          </button>
        </div>
        {status ? (
          <span className={`chip chip--${status.tone === 'range' ? 'mint' : status.tone === 'high' ? 'amber' : 'rose'}`}>
            <span className="kpi__dot" style={{ background: status.color, color: status.color }} />
            {status.label}
          </span>
        ) : null}
      </div>

      <Field label="Momento da leitura">
        <div className="cat-row">
          {GLUCOSE_CONTEXTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`cat-pill${context === item.id ? ' is-active' : ''}`}
              onClick={() => setContext(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Observação (opcional)" htmlFor="glucose-note">
        <input id="glucose-note" className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: após caminhada" />
      </Field>

      <p className="disclaimer">
        <b>Importante:</b> registros ajudam a entender padrões, mas decisões de tratamento devem seguir a orientação da sua equipe de saúde.
      </p>
    </Sheet>
  );
}

/* --------------------------------- peso -------------------------------- */

export function AddWeightSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (kg: number) => Promise<void> }) {
  const { profile, logs } = useApp();
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const lastWeight = useMemo(() => {
    const weights = logs.filter((log) => log.kind === 'weight').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return weights[0]?.kind === 'weight' ? weights[0].kg : profile?.weightKg ?? 70;
  }, [logs, profile?.weightKg]);

  useEffect(() => {
    if (!open) return;
    setValue(String(lastWeight));
  }, [open, lastWeight]);

  const numeric = Number(value);
  const bmi = profile ? calcBMI(numeric, profile.heightCm) : 0;
  const ideal = profile ? idealWeightRange(profile.heightCm) : ([0, 0] as [number, number]);

  const submit = async () => {
    if (!numeric || numeric < 25 || numeric > 350) {
      toast('Informe um peso válido (kg)', 'warning');
      return;
    }
    setSaving(true);
    try {
      await onAdd(numeric);
      toast('Peso registrado', 'success');
      onClose();
    } catch {
      toast('Não foi possível salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar peso"
      subtitle="Uma vez por dia já ajuda a ver a tendência"
      icon="scale"
      footer={
        <>
          <Button variant="soft" onClick={onClose} block>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving} block>
            {saving ? 'Salvando…' : 'Salvar peso'}
          </Button>
        </>
      }
    >
      <Field label="Peso atual (kg)" htmlFor="weight-input">
        <div className="input-suffix">
          <input
            id="weight-input"
            className="input input--lg"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            style={{ textAlign: 'left' }}
          />
          <span>kg</span>
        </div>
      </Field>
      {bmi > 0 ? (
        <div className="goal-preview">
          <div>
            <div className="stat__label">IMC estimado</div>
            <div className="stat__value">{formatDecimal(bmi)}</div>
          </div>
          <div className="goal-preview__text">
            <b style={{ fontSize: '0.9rem' }}>{bmiCategory(bmi).label}</b>
            <p className="tiny muted">Faixa ideal pelo IMC: {formatDecimal(ideal[0])}–{formatDecimal(ideal[1])} kg</p>
          </div>
        </div>
      ) : null}
      <p className="field__hint">Pese-se no mesmo horário e condição para uma leitura mais consistente.</p>
    </Sheet>
  );
}

export type { IconName };
