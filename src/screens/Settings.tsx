import { useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { usePwa } from '../pwa/pwa';
import { ACTIVITY_LABELS, DEFAULT_PROFILE, type ActivityLevel, type DiabetesType, type GoalKind, type Profile, type Sex } from '../db/types';
import { calcGoals, calcMetabolic, formatDecimal, idealWeightRange } from '../domain/health';
import { downloadBackup, downloadCsv, parseBackupText } from '../domain/backup';
import { Icon } from '../components/Icon';
import { Button, Card, CardHead, Field, ScreenHead, Segmented } from '../components/ui';
import { navigate } from '../state/useHashRoute';
import { db } from '../db/db';

export function SettingsScreen() {
  const { profile, goals, logs, foods, storageMode, actions } = useApp();
  const { toast } = useToast();
  const { canInstall, install, installed, offline, secureContext } = usePwa();
  const [draft, setDraft] = useState<Profile>(() => profile ?? { ...DEFAULT_PROFILE, onboarded: true });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const save = async () => {
    if (!draft.heightCm || draft.heightCm < 120 || draft.heightCm > 230) {
      toast('Altura inválida (120–230 cm)', 'warning');
      return;
    }
    if (!draft.weightKg || draft.weightKg < 25 || draft.weightKg > 350) {
      toast('Peso inválido (25–350 kg)', 'warning');
      return;
    }
    if (draft.glucoseLow >= draft.glucoseHigh) {
      toast('A faixa-alvo de glicemia está invertida', 'warning');
      return;
    }
    setSaving(true);
    try {
      await actions.saveProfile({ ...draft, name: draft.name.trim(), onboarded: true });
      toast('Configurações salvas', 'success');
    } catch {
      toast('Não foi possível salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportJson = async () => {
    setBusy('export');
    try {
      const backup = await db.exportAll();
      downloadBackup(backup);
      toast('Backup JSON exportado', 'success');
    } catch {
      toast('Falha ao exportar', 'error');
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setBusy('import');
    try {
      const text = await file.text();
      const backup = parseBackupText(text);
      const result = await actions.importBackup(backup);
      toast(`Importado: ${result.logs} registros e ${result.foods} alimentos`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao importar', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ScreenHead
        eyebrow="Ajustes"
        title="Perfil e preferências"
        subtitle="Tudo fica salvo apenas neste dispositivo"
        actions={
          <Button variant="primary" icon="check" onClick={() => void save()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        }
      />

      <div className="grid-2">
        <Card>
          <CardHead title="Perfil" icon="heart" sub="Usado para calcular suas metas" />
          <div className="form-section">
            <Field label="Nome" htmlFor="set-name">
              <input id="set-name" className="input" value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="Como quer ser chamado(a)?" />
            </Field>
            <div className="field-row">
              <Field label="Nascimento" htmlFor="set-birth">
                <input id="set-birth" className="input" type="date" value={draft.birthDate} onChange={(event) => set('birthDate', event.target.value)} />
              </Field>
              <Field label="Sexo biológico" hint="Usado na equação de gasto energético">
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
            <div className="field-row">
              <Field label="Altura (cm)" htmlFor="set-height">
                <input id="set-height" className="input" type="number" inputMode="numeric" value={draft.heightCm} onChange={(event) => set('heightCm', Number(event.target.value))} />
              </Field>
              <Field
                label="Peso atual (kg)"
                htmlFor="set-weight"
                hint={draft.heightCm >= 120 ? `faixa saudável: ${formatDecimal(ideal[0])}–${formatDecimal(ideal[1])} kg` : 'informe a altura para calcular a faixa'}
              >
                <input id="set-weight" className="input" type="number" inputMode="decimal" step="0.1" value={draft.weightKg} onChange={(event) => set('weightKg', Number(event.target.value))} />
              </Field>
            </div>
            <Field label="Nível de atividade" htmlFor="set-activity" hint={ACTIVITY_LABELS[draft.activity].hint}>
              <select id="set-activity" className="select" value={draft.activity} onChange={(event) => set('activity', event.target.value as ActivityLevel)}>
                {Object.entries(ACTIVITY_LABELS).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label} — {item.hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Objetivo">
              <Segmented
                ariaLabel="Objetivo"
                value={draft.goal}
                onChange={(value) => set('goal', value as GoalKind)}
                options={[
                  { value: 'perder', label: 'Perder' },
                  { value: 'manter', label: 'Manter' },
                  { value: 'ganhar', label: 'Ganhar' },
                ]}
              />
            </Field>
            {draft.goal !== 'manter' ? (
              <Field label={`Ritmo desejado: ${draft.rateKgWeek.toFixed(2)} kg/semana`} htmlFor="set-rate">
                <input
                  id="set-rate"
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
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Estimativa energética" icon="flame" sub="Atualiza conforme você edita" />
            <div className="stat-grid">
              <div className="stat">
                <div className="stat__label">Metabolismo basal</div>
                <div className="stat__value">{metabolic.bmr}<small>kcal</small></div>
              </div>
              <div className="stat">
                <div className="stat__label">Gasto total</div>
                <div className="stat__value">{metabolic.tdee}<small>kcal</small></div>
              </div>
              <div className="stat">
                <div className="stat__label">Meta sugerida</div>
                <div className="stat__value" style={{ color: 'var(--mint)' }}>{metabolic.kcal}<small>kcal</small></div>
              </div>
            </div>
            <p className="field__hint" style={{ marginTop: 10 }}>
              Cálculo por Mifflin-St Jeor. Ajuste fino pode ser feito nas metas manuais abaixo.
            </p>
          </Card>

          <Card>
            <CardHead title="Aparência" icon="sunMoon" />
            <div className="setting-row">
              <div className="setting-row__icon">
                <Icon name="moon" />
              </div>
              <div className="setting-row__body">
                <div className="setting-row__title">Tema</div>
                <div className="setting-row__sub">Escolha claro, escuro ou automático</div>
              </div>
              <div className="theme-toggle">
                {(
                  [
                    { value: 'dark', icon: 'moon', label: 'Escuro' },
                    { value: 'light', icon: 'sun', label: 'Claro' },
                    { value: 'auto', icon: 'sunMoon', label: 'Automático' },
                  ] as { value: Profile['theme']; icon: 'moon' | 'sun' | 'sunMoon'; label: string }[]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={draft.theme === option.value ? 'is-active' : ''}
                    onClick={() => {
                      set('theme', option.value);
                      void actions.setTheme(option.value);
                    }}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <Icon name={option.icon} />
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <div className="setting-row__icon">
                <Icon name={offline ? 'offline' : 'wifi'} />
              </div>
              <div className="setting-row__body">
                <div className="setting-row__title">Modo offline</div>
                <div className="setting-row__sub">{offline ? 'Sem conexão — dados continuam salvando localmente' : 'Aplicativo pronto para funcionar sem internet'}</div>
              </div>
              <span className={`status-chip ${offline ? 'status-chip--offline' : 'status-chip--online'}`}>{offline ? 'Offline' : 'Ativo'}</span>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHead title="Metas" icon="target" sub="Deixe em 0 para usar o valor automático" />
        <div className="grid-3" style={{ gap: 14 }}>
          <Field label="Calorias (kcal)" htmlFor="goal-kcal" hint={`automático: ${auto.kcal}`}>
            <input id="goal-kcal" className="input" type="number" inputMode="numeric" value={draft.calorieGoal} onChange={(event) => set('calorieGoal', Number(event.target.value))} />
          </Field>
          <Field label="Água (ml)" htmlFor="goal-water" hint={`automático: ${auto.waterMl} ml`}>
            <input id="goal-water" className="input" type="number" inputMode="numeric" value={draft.waterGoalMl} onChange={(event) => set('waterGoalMl', Number(event.target.value))} />
          </Field>
          <Field label="Fibras (g)" htmlFor="goal-fiber" hint={`automático: ${auto.fiber} g`}>
            <input id="goal-fiber" className="input" type="number" inputMode="numeric" value={draft.fiberGoalG} onChange={(event) => set('fiberGoalG', Number(event.target.value))} />
          </Field>
          <Field label="Carboidratos (g)" htmlFor="goal-carbs" hint={`automático: ${auto.carbs} g`}>
            <input id="goal-carbs" className="input" type="number" inputMode="numeric" value={draft.carbGoalG} onChange={(event) => set('carbGoalG', Number(event.target.value))} />
          </Field>
          <Field label="Proteínas (g)" htmlFor="goal-protein" hint={`automático: ${auto.protein} g`}>
            <input id="goal-protein" className="input" type="number" inputMode="numeric" value={draft.proteinGoalG} onChange={(event) => set('proteinGoalG', Number(event.target.value))} />
          </Field>
          <Field label="Gorduras (g)" htmlFor="goal-fat" hint={`automático: ${auto.fat} g`}>
            <input id="goal-fat" className="input" type="number" inputMode="numeric" value={draft.fatGoalG} onChange={(event) => set('fatGoalG', Number(event.target.value))} />
          </Field>
        </div>
        <div className="row tiny muted" style={{ marginTop: 12, gap: 6 }}>
          <Icon name="info" size={13} /> Metas atuais em uso: {goals.kcal} kcal · {goals.carbs} g carboidratos · {goals.protein} g proteína · {goals.fat} g gordura · {goals.waterMl} ml de água.
        </div>
      </Card>

      <Card>
        <CardHead title="Perfil clínico" icon="activity" sub="Parâmetros usados nas análises e na calculadora" />
        <div className="grid-3" style={{ gap: 14 }}>
          <Field label="Condição" htmlFor="set-diabetes">
            <select id="set-diabetes" className="select" value={draft.diabetes} onChange={(event) => set('diabetes', event.target.value as DiabetesType)}>
              <option value="nenhum">Nenhuma / não informar</option>
              <option value="tipo1">Diabetes tipo 1</option>
              <option value="tipo2">Diabetes tipo 2</option>
              <option value="prediabetes">Pré-diabetes</option>
              <option value="gestacional">Diabetes gestacional</option>
            </select>
          </Field>
          <Field label="Glicemia alvo mínima" htmlFor="set-low" hint="mg/dL">
            <input id="set-low" className="input" type="number" inputMode="numeric" value={draft.glucoseLow} onChange={(event) => set('glucoseLow', Number(event.target.value))} />
          </Field>
          <Field label="Glicemia alvo máxima" htmlFor="set-high" hint="mg/dL">
            <input id="set-high" className="input" type="number" inputMode="numeric" value={draft.glucoseHigh} onChange={(event) => set('glucoseHigh', Number(event.target.value))} />
          </Field>
          <Field label="Relação carbo/insulina" htmlFor="set-icr" hint="1 U cobre quantos g">
            <input id="set-icr" className="input" type="number" inputMode="decimal" value={draft.icr} onChange={(event) => set('icr', Number(event.target.value))} />
          </Field>
          <Field label="Fator de sensibilidade" htmlFor="set-isf" hint="1 U baixa quantos mg/dL">
            <input id="set-isf" className="input" type="number" inputMode="decimal" value={draft.isf} onChange={(event) => set('isf', Number(event.target.value))} />
          </Field>
          <Field label="Glicemia alvo de correção" htmlFor="set-target" hint="mg/dL">
            <input id="set-target" className="input" type="number" inputMode="numeric" value={draft.targetGlucose} onChange={(event) => set('targetGlucose', Number(event.target.value))} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHead title="Dados e privacidade" icon="database" sub="Você é dono dos seus dados" />
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat">
            <div className="stat__label">Armazenamento</div>
            <div className="stat__value" style={{ fontSize: '.95rem' }}>
              {storageMode === 'indexeddb' ? 'IndexedDB' : 'Memória'}
            </div>
            <div className="stat__hint">{storageMode === 'indexeddb' ? 'persistente no dispositivo' : 'temporário — exporte um backup'}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Registros</div>
            <div className="stat__value">{logs.length}</div>
            <div className="stat__hint">refeições, água, glicemia…</div>
          </div>
          <div className="stat">
            <div className="stat__label">Alimentos</div>
            <div className="stat__value">{foods.length}</div>
            <div className="stat__hint">{foods.filter((food) => food.custom).length} personalizados</div>
          </div>
        </div>
        <div className="row row--wrap" style={{ gap: 10 }}>
          <Button variant="soft" icon="download" onClick={() => void exportJson()} disabled={busy === 'export'}>
            {busy === 'export' ? 'Exportando…' : 'Backup JSON'}
          </Button>
          <Button variant="soft" icon="download" onClick={() => downloadCsv(logs)}>
            Exportar CSV
          </Button>
          <Button variant="soft" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy === 'import'}>
            {busy === 'import' ? 'Importando…' : 'Importar backup'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
          <Button
            variant="soft"
            icon="sparkles"
            onClick={() => {
              if (!window.confirm('Preencher com 21 dias de dados de demonstração? Os registros atuais serão substituídos (o perfil é mantido).')) return;
              void actions.loadDemo().then(() => toast('Dados de demonstração carregados', 'success'));
            }}
          >
            Dados de demonstração
          </Button>
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              if (!window.confirm('Apagar TODOS os dados do Vitalis neste dispositivo? Essa ação não pode ser desfeita.')) return;
              void actions.clearAll().then(() => {
                toast('Todos os dados foram apagados');
                navigate('today');
              });
            }}
          >
            Apagar tudo
          </Button>
        </div>
        <p className="disclaimer" style={{ marginTop: 14 }}>
          <b>Privacidade:</b> nenhum dado sai do seu aparelho. O Vitalis não tem servidor, conta ou rastreamento. Faça backups regulares — limpar os dados do navegador apaga o banco local.
        </p>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHead title="Aplicativo" icon="install" sub="Instale para usar em tela cheia e offline" />
          <div className="setting-row">
            <div className="setting-row__icon">
              <Icon name="install" />
            </div>
            <div className="setting-row__body">
              <div className="setting-row__title">{installed ? 'Instalado' : 'Instalar o Vitalis'}</div>
              <div className="setting-row__sub">{installed ? 'Você já está usando como aplicativo' : 'Adicione à tela inicial do celular ou desktop'}</div>
            </div>
            {canInstall ? (
              <Button size="sm" variant="primary" onClick={() => void install()}>
                Instalar
              </Button>
            ) : (
              <span className="status-chip">{installed ? 'Pronto' : secureContext ? 'Pelo menu do navegador' : 'HTTPS necessário'}</span>
            )}
          </div>
          {!secureContext ? (
            <p className="disclaimer" style={{ marginTop: 10, borderColor: 'rgba(255,190,92,.4)' }}>
              <b>Instalação e modo offline exigem HTTPS.</b> Em um endereço <code>http://</code> da rede local, o Chrome bloqueia o service worker e o instalador do Android. Abra o Vitalis por uma URL <code>https://</code> (túnel ou hospedagem estática) para instalar.
            </p>
          ) : null}
          <div className="setting-row">
            <div className="setting-row__icon">
              <Icon name="wifi" />
            </div>
            <div className="setting-row__body">
              <div className="setting-row__title">Funciona offline</div>
              <div className="setting-row__sub">App shell e dados locais disponíveis sem internet</div>
            </div>
            <span className="status-chip status-chip--online">Ativo</span>
          </div>
          <p className="field__hint" style={{ marginTop: 10 }}>
            No iPhone: Compartilhar → Adicionar à Tela de Início. No desktop: ícone de instalação na barra de endereço.
          </p>
        </Card>

        <Card>
          <CardHead title="Sobre o Vitalis" icon="info" />
          <div className="stack" style={{ gap: 10 }}>
            <div className="between">
              <span className="small muted">Versão</span>
              <span className="small strong">1.0.0</span>
            </div>
            <div className="between">
              <span className="small muted">Tecnologia</span>
              <span className="small strong">PWA · React · three.js · IndexedDB</span>
            </div>
            <div className="between">
              <span className="small muted">Dados</span>
              <span className="small strong">100% no dispositivo</span>
            </div>
            <div className="disclaimer" style={{ marginTop: 4 }}>
              <b>Uso educativo.</b> O Vitalis ajuda a organizar informações de saúde, mas não diagnostica, não prescreve e não substitui consulta com profissionais. Em emergências, procure atendimento imediatamente.
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
        <Button variant="primary" size="lg" icon="check" onClick={() => void save()} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </>
  );
}
