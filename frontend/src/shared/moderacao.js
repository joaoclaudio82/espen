/**
 * Helpers de moderação (puros, sem efeitos colaterais de DOM além de retornar HTML).
 *
 * Este módulo centraliza:
 *   - Labels amigáveis (mesmo texto do formulário) para matriz, ações, trilhas.
 *   - Comparação tolerante a vazios (`null`/`undefined`/`''`/`[]` são equivalentes).
 *   - Coleta de diffs entre registros antigo/novo.
 *   - Builders de HTML para os popups de "Detalhe" / "Ver alterações".
 *
 * Builders dependentes de PDI (`buildPdiModeracaoDiffBodyHtml`) e o dispatcher
 * `buildModeracaoDetalheGenericoHtml` ficam em `legacy.js` enquanto a página de
 * PDI ainda não foi extraída — quando for, eles vêm para cá ou para `pages/pdi.js`.
 */
import { STORAGE_KEYS, getStorage } from '../api/storage.js';
import { escapeHtmlStr } from './escape.js';
import { idEquals } from './format.js';

// ── Tipo / resumo ────────────────────────────────────────────────────────────

const MODERACAO_TIPO_LABELS = {
  matriz_upsert: 'Matriz — incluir/alterar',
  matriz_arquivar: 'Matriz — arquivar',
  acao_upsert: 'Ação educativa — incluir/alterar',
  acao_excluir: 'Ação educativa — excluir',
  trilha_upsert: 'Trilha — incluir/alterar',
  trilha_excluir: 'Trilha — excluir',
  pdi_upsert: 'Plano de ensino — incluir/alterar',
  pdi_excluir: 'Plano de ensino — excluir',
};

export function getModeracaoTipoLabel(tipo) {
  return MODERACAO_TIPO_LABELS[tipo] || tipo;
}

/** Resumo curto para a coluna "Resumo" da tabela de moderação. */
export function getModeracaoResumo(item) {
  const p = item.payload || {};
  try {
    if (item.tipo === 'matriz_upsert') {
      const r = p.registro || {};
      const nome = r.competencia || r.nome || r.codigo || '—';
      const ctx = [r.cargo, r.eixo].filter(Boolean).slice(0, 2).join(' · ');
      const suffix = ctx ? ` (${ctx})` : '';
      return p.editId ? `Alterar competência: ${nome}${suffix}` : `Nova competência: ${nome}${suffix}`;
    }
    if (item.tipo === 'matriz_arquivar') {
      try {
        const data = getStorage(STORAGE_KEYS.matriz) || [];
        const pid = p.id ?? p.matriz_id;
        const row = data.find((x) => idEquals(x.id, pid));
        const nome = row && (row.competencia || row.nome);
        if (nome) return `Arquivar competência: ${nome}`;
      } catch (_) { /* ignore */ }
      return 'Arquivar competência';
    }
    if (item.tipo === 'acao_upsert') {
      const r = p.registro || {};
      const nome = (r.nome || r.titulo || '').trim() || r.codigo || '—';
      const cod = r.codigo && String(r.codigo).trim() && nome !== r.codigo ? ` [${r.codigo}]` : '';
      const mod = r.modalidade ? ` · ${r.modalidade}` : '';
      const st = r.status ? ` · ${r.status}` : '';
      const base = p.editId ? 'Alterar ação: ' : 'Nova ação: ';
      let campos = '';
      if (p.editId) {
        try {
          const data = getStorage(STORAGE_KEYS.acoes) || [];
          const prev = data.find((x) => idEquals(x.id, p.editId));
          if (prev) {
            const keys = [
              ['nome', 'nome'],
              ['codigo', 'código'],
              ['modalidade', 'modalidade'],
              ['status', 'status'],
              ['carga_horaria', 'carga horária'],
              ['publico_alvo', 'público-alvo'],
              ['objetivo_geral', 'objetivo geral'],
              ['ementa', 'ementa'],
              ['metodologia', 'metodologia'],
              ['competencias_vinculadas', 'competências (matriz)'],
            ];
            const changed = keys
              .filter(([k]) => JSON.stringify(prev[k] ?? null) !== JSON.stringify(r[k] ?? null))
              .map(([, lab]) => lab);
            if (changed.length) campos = ` · Alterações: ${changed.join(', ')}`;
          }
        } catch (_) { /* ignore */ }
      }
      return `${base}${nome}${cod}${mod}${st}${campos}`;
    }
    if (item.tipo === 'acao_excluir') {
      try {
        const nomeSnap = (p.nome_acao || '').trim();
        const codSnap = (p.codigo_acao || '').trim();
        const data = getStorage(STORAGE_KEYS.acoes) || [];
        const row = data.find((x) => idEquals(x.id, p.id));
        const nome = nomeSnap || (row && ((row.nome || '').trim() || (row.codigo || '').trim())) || '';
        const cod = codSnap || (row && (row.codigo || '').trim()) || '';
        const mod = row && row.modalidade ? ` · ${row.modalidade}` : '';
        if (nome) {
          const codPart = cod && nome !== cod ? ` [${cod}]` : '';
          return `Excluir ação: ${nome}${codPart}${mod}`;
        }
      } catch (_) { /* ignore */ }
      return `Excluir ação (id: ${p.id || '—'})`;
    }
    if (item.tipo === 'trilha_upsert') {
      const r = p.registro || {};
      const nome = (r.nome || r.titulo || '').trim() || '—';
      const bits = [r.cargo_alvo, r.nivel, r.eixo_funcional].filter(Boolean);
      const nAcoes = (r.acoes_vinculadas || []).length;
      const extra = [...bits.slice(0, 2), nAcoes ? `${nAcoes} ação(ões)` : ''].filter(Boolean).join(' · ');
      return p.editId ? `Alterar trilha: ${nome}${extra ? ` (${extra})` : ''}` : `Nova trilha: ${nome}${extra ? ` (${extra})` : ''}`;
    }
    if (item.tipo === 'trilha_excluir') {
      try {
        const data = getStorage(STORAGE_KEYS.trilhas) || [];
        const row = data.find((x) => idEquals(x.id, p.id));
        const nome = row && (row.nome || row.titulo);
        if (nome) return `Excluir trilha: ${nome}`;
      } catch (_) { /* ignore */ }
      return `Excluir trilha (id: ${p.id || '—'})`;
    }
    if (item.tipo === 'pdi_upsert') {
      const r = p.registro || {};
      const acoes = getStorage(STORAGE_KEYS.acoes) || [];
      const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
      const a = acoes.find((x) => idEquals(x.id, r.acao_id));
      const pb1 = r.plano_bloco1 && typeof r.plano_bloco1 === 'object' ? r.plano_bloco1 : {};
      const tituloBloco1 = String(pb1.titulo_acao || '').trim();
      const legado = !!(r.trilha_id && !r.acao_id);
      const trilha = trilhas.find((t) => idEquals(t.id, r.trilha_id));
      const nomePlano =
        tituloBloco1
        || (a ? String(a.nome || '').trim() : '')
        || (legado && trilha ? String(trilha.nome || '').trim() : '')
        || 'Plano de ensino';
      return p.editId ? `Alterar plano: ${nomePlano}` : `Novo plano: ${nomePlano}`;
    }
    if (item.tipo === 'pdi_excluir') {
      try {
        const data = getStorage(STORAGE_KEYS.pdi) || [];
        const users = getStorage(STORAGE_KEYS.users) || [];
        const acoes = getStorage(STORAGE_KEYS.acoes) || [];
        const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
        const row = data.find((x) => idEquals(x.id, p.id));
        if (row) {
          const u = users.find((x) => idEquals(x.id, row.usuario_id));
          const a = acoes.find((x) => idEquals(x.id, row.acao_id));
          if (a) return `Excluir plano: ${u ? u.nome : '—'} → ${(a.nome || '—')}${a.codigo ? ` [${a.codigo}]` : ''}`;
          const t = trilhas.find((x) => idEquals(x.id, row.trilha_id));
          return `Excluir plano: ${u ? u.nome : '—'} → ${t ? t.nome : '—'}`;
        }
      } catch (_) { /* ignore */ }
      return `Excluir plano (id: ${p.id || '—'})`;
    }
  } catch (_) { /* ignore */ }
  return '—';
}

// ── Normalização e comparação ────────────────────────────────────────────────

export function normalizeModeracaoPayload(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
}

/**
 * Considera "equivalentes" valores que representam o mesmo estado vazio.
 * Sem isso, edições onde a UI constrói `[]` ou `''` (em vez do `undefined`
 * original) apareciam como diff espúrio no popup de moderação.
 */
function moderacaoNormalizeForCompare(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return v;
}

export function moderacaoJsonEqual(a, b) {
  try {
    const na = moderacaoNormalizeForCompare(a);
    const nb = moderacaoNormalizeForCompare(b);
    return JSON.stringify(na ?? null) === JSON.stringify(nb ?? null);
  } catch (_) { return false; }
}

/** Percorre objetos planos e lista folhas onde antes ≠ depois (path tipo `a.b.c`). */
export function moderacaoCollectObjectDiffs(prefix, oldObj, newObj, out) {
  const oIsObj = oldObj != null && typeof oldObj === 'object' && !Array.isArray(oldObj);
  const nIsObj = newObj != null && typeof newObj === 'object' && !Array.isArray(newObj);
  if (oIsObj && nIsObj) {
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    keys.forEach((k) => {
      const p = prefix ? `${prefix}.${k}` : k;
      moderacaoCollectObjectDiffs(p, oldObj[k], newObj[k], out);
    });
    return;
  }
  if (!moderacaoJsonEqual(oldObj, newObj)) {
    out.push({ path: prefix || '(raiz)', antes: oldObj, depois: newObj });
  }
}

// ── Formatação de valores ────────────────────────────────────────────────────

/** Se `v` for data/hora ISO, devolve texto curto em pt-BR; senão null. */
function moderacaoTryFormatReadableDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    if (y < 1990 || y > 2120) return null;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
  );
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (y < 1990 || y > 2120 || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  if (!m[4]) {
    const d = new Date(y, mo - 1, da);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const se = m[6] != null ? Number(m[6]) : 0;
  const d = new Date(y, mo - 1, da, h, mi, se);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Valor escalar para tabelas de moderação (datas legíveis ou texto). */
function moderacaoValorCampoLegivel(v) {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v, null, 2);
      return s.length > 6000 ? `${s.slice(0, 6000)}…` : s;
    } catch (_) { return String(v); }
  }
  const asDate = moderacaoTryFormatReadableDate(v);
  if (asDate) return asDate;
  const s = String(v);
  return s.length > 6000 ? `${s.slice(0, 6000)}…` : s;
}

export function moderacaoFmtDiffVal(v) {
  if (v === undefined) return '—';
  if (v === null) return '—';
  if (typeof v === 'object') {
    let s;
    try { s = JSON.stringify(v, null, 2); } catch (_) { s = String(v); }
    return s.length > 5000 ? `${s.slice(0, 5000)}\n… (truncado)` : s;
  }
  const asDate = moderacaoTryFormatReadableDate(v);
  if (asDate) return asDate;
  const s = String(v);
  return s.length > 2500 ? `${s.slice(0, 2500)}… (truncado)` : s;
}

// ── Labels de campos do PDI ──────────────────────────────────────────────────

export const PDI_MODERACAO_LABELS_B1 = {
  titulo_acao: 'Título da Ação Educativa',
  publico_alvo: 'Público Alvo',
  publico_alvo_outros: 'Público Alvo — Outros (especificar)',
  observacoes: 'Observações/descrição',
  objetivo_geral: 'Objetivo Geral da Ação Educativa',
  tipo_acao: 'Tipo da Ação Educativa',
  tipo_acao_outra: 'Tipo da Ação Educativa — Outra (especificar)',
  modalidade: 'Modalidade da Ação Educativa',
  carga_horaria_total: 'Carga Horária Total (hs) da Ação Educativa',
  periodo_inicio: 'Período de realização — Início',
  periodo_fim: 'Período de realização — Fim',
  unidade_promotora: 'Unidade Promotora / Escola do Sistema Penal',
  coordenadores_instrutores: 'Coordenadores(as) / Instrutores(as) responsáveis pela Ação Educativa',
};

export const PDI_MODERACAO_LABELS_B2 = {
  categoria_competencia_mcn: 'Categoria de Competência',
  subcategoria_competencia_mcn: 'Subcategoria de Competência',
  eixo_competencia_mcn: 'Eixo de Competência',
  unidade_tematica_mcn: 'Unidade Temática',
  conhecimento_critico_mcn: 'Conhecimentos Críticos Trabalhados',
  justificativa_design: 'Justificativa',
};

export const PDI_MODERACAO_LABELS_B3 = {
  metodologias_estrategias: 'Metodologias e Estratégias de ensino-aprendizagem',
  recursos_humanos_tecnologicos_materiais: 'Recursos humanos, tecnológicos e materiais',
  avaliacao_aprendizagem_transferencia: 'Avaliação da Aprendizagem e transferência para a prática',
  referencias_curadoria: 'Referências e Curadoria de Conhecimento',
};

const PDI_MODERACAO_LABELS_RAIZ = {
  id: 'ID do plano',
  usuario_id: 'Responsável (usuário)',
  acao_id: 'Ação educativa vinculada',
  trilha_id: 'Trilha vinculada (modelo anterior)',
  data_inicio: 'Data de início',
  data_meta: 'Data fim / meta',
  data_criacao: 'Data de criação',
};

export function pdiModeracaoLabelForPath(path) {
  const p = String(path || '').trim();
  if (!p || p === '(raiz)') return p;
  let m = /^plano_bloco1\.(.+)$/.exec(p);
  if (m) return PDI_MODERACAO_LABELS_B1[m[1]] || `Bloco 1 — ${m[1]}`;
  m = /^plano_bloco2\.(.+)$/.exec(p);
  if (m) return PDI_MODERACAO_LABELS_B2[m[1]] || `Bloco 2 — ${m[1]}`;
  m = /^plano_bloco3\.(.+)$/.exec(p);
  if (m) return PDI_MODERACAO_LABELS_B3[m[1]] || `Bloco 3 — ${m[1]}`;
  return PDI_MODERACAO_LABELS_RAIZ[p] || p;
}

// ── Tabela de bloco (usada em popups PDI e em diff de inclusão) ──────────────

export function moderacaoPdiBlockTable(title, obj, keyLabels) {
  if (!obj || typeof obj !== 'object') {
    return `<div style="margin-bottom:14px;"><div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:6px;">${escapeHtmlStr(title)}</div><p class="text-muted" style="font-size:12px;margin:0;">—</p></div>`;
  }
  const rows = Object.keys(obj)
    .map((k) => {
      const v = obj[k];
      let val;
      if (v != null && typeof v === 'object') {
        try { val = JSON.stringify(v, null, 2); } catch (_) { val = String(v); }
      } else {
        val = moderacaoValorCampoLegivel(v);
      }
      if (val.length > 6000) val = `${val.slice(0, 6000)}…`;
      const rowLabel = keyLabels && keyLabels[k] != null && String(keyLabels[k]).trim() !== '' ? keyLabels[k] : k;
      return `<tr><td style="font-weight:600;padding:6px 10px;vertical-align:top;border-bottom:1px solid var(--gray-100);width:32%;">${escapeHtmlStr(rowLabel)}</td><td style="padding:6px 10px;font-size:12px;border-bottom:1px solid var(--gray-100);white-space:pre-wrap;word-break:break-word;">${escapeHtmlStr(val)}</td></tr>`;
    })
    .join('');
  return `<div style="margin-bottom:16px;"><div style="font-weight:700;font-size:13px;color:var(--navy);margin-bottom:6px;">${escapeHtmlStr(title)}</div><table style="width:100%;border-collapse:collapse;border:1px solid var(--gray-200);border-radius:8px;overflow:hidden;">${rows}</table></div>`;
}

// ── Strip de metadata + labels de campo por agregado ────────────────────────

/**
 * Campos de metadata que `save*` reescreve a cada edição mas não fazem parte da
 * intenção do usuário — sempre apareciam como "diferenças" e confundiam o moderador.
 */
const MODERACAO_DIFF_METADATA_KEYS = [
  'historico',
  'atualizado_em',
  'atualizado_por',
  'criado_em',
  'criado_por',
  'arquivado_em',
  'arquivado_por',
  // Derivado de `eixo`/`unidade` em ações (legado da estrutura antiga "Eixo / Unidade").
  'eixo_tematico',
];

export function matrizStrippedForFieldDiff(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const o = { ...obj };
  for (const k of MODERACAO_DIFF_METADATA_KEYS) delete o[k];
  return o;
}

/** Mapas de label amigável (mesmo texto do formulário) por agregado. */
export const MODERACAO_FIELD_LABELS = {
  espen_matriz: {
    competencia: 'Competência (capacidades de/para)',
    categoria: 'Categoria',
    subcategoria: 'Subcategoria',
    cargo: 'Cargo',
    eixo: 'Eixo Funcional',
    unidade: 'Unidade Temática',
    conhecimento: 'Conhecimento Crítico e para Prática',
    tipologia_objetivo: 'Tipologia do Objetivo',
    tipologia_complexidade: 'Tipologia de Complexidade',
    matriz: 'Matriz de Referência',
    objetivo: 'Objetivo de Aprendizagem',
  },
  espen_acoes: {
    nome: 'Nome da Ação',
    codigo: 'Código / ID AE',
    tipo: 'Tipo',
    estado: 'Estado',
    sigla_estado: 'Sigla Estado',
    e_trilha: 'É Trilha?',
    e_modulo: 'É Módulo?',
    modulos_associados: 'Módulos associados',
    competencia_mcn: 'Competência MCN',
    eixo_funcional_mcn: 'Eixo funcional MCN',
    unidade_tematica_mcn: 'Unidade temática MCN',
    conhecimento_critico_mcn: 'Conhecimento crítico e para a prática',
    objetivo_aprendizagem_mcn: 'Objetivo de aprendizagem MCN',
    area_demandante: 'Área Demandante',
    escola_proponente: 'Escola Proponente',
    eixo: 'Eixo (oferta)',
    unidade: 'Unidade (oferta)',
    eixo_tematico: 'Eixo Temático',
    justificativa_oferta: 'Justificativa da oferta',
    amparo_legal: 'Amparo legal',
    competencia_texto: 'Competência (oferta)',
    objetivos_especificos: 'Objetivos específicos',
    status: 'Status',
    objetivo_geral: 'Objetivo Geral',
    ementa: 'Ementa',
    conteudo_programatico: 'Conteúdo Programático',
    metodologia: 'Metodologia',
    duracao: 'Duração',
    espaco_fisico: 'Espaço físico',
    plataforma_virtual: 'Plataforma virtual',
    recursos_materiais: 'Recursos materiais',
    recursos_tecnologicos: 'Recursos tecnológicos',
    recursos_humanos: 'Recursos humanos',
    carga_horaria: 'Carga Horária (h/a)',
    num_modulos: 'Nº de Módulos',
    modalidade: 'Modalidade',
    num_vagas: 'Nº de Vagas',
    publico_alvo: 'Público-Alvo',
    frequencia_minima: 'Frequência mínima (%)',
    instrumento_avaliacao_aprendizagem: 'Instrumento — aprendizagem',
    instrumento_avaliacao_reacao: 'Instrumento — reação',
    instrumento_avaliacao_transferencia: 'Instrumento — transferência',
    instrumento_avaliacao: 'Instrumento de avaliação',
    criterios_matricula: 'Critérios de matrícula',
    criterio_certificacao: 'Critérios de certificação',
    bibliografia: 'Bibliografia',
    competencias_vinculadas: 'Competências vinculadas',
  },
  espen_trilhas: {
    nome: 'Nome da Trilha',
    descricao: 'Descrição',
    cargo_alvo: 'Cargo-Alvo',
    nivel: 'Nível',
    eixo_funcional: 'Eixo Funcional',
    acoes_vinculadas: 'Ações vinculadas',
  },
};

/** Converte `snake_case`/`camelCase` em "Snake Case" para fallback. */
function prettifyFieldKey(key) {
  if (!key) return '';
  return String(key)
    .replace(/[._-]+/g, ' ')
    .replace(/([a-zà-ú])([A-ZÀ-Ú])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Label amigável dado o caminho do diff (`a.b.c`) e a chave do storage. */
export function moderacaoLabelForFieldPath(storageKey, path) {
  const map = MODERACAO_FIELD_LABELS[storageKey] || {};
  const top = String(path || '').split('.')[0];
  if (map[top]) {
    const rest = String(path).slice(top.length);
    return rest ? `${map[top]}${rest}` : map[top];
  }
  return prettifyFieldKey(path);
}

function matrizHistoricoAlterado(prev, reg) {
  try {
    return JSON.stringify(prev?.historico ?? null) !== JSON.stringify(reg?.historico ?? null);
  } catch (_) { return true; }
}

// ── Builders de HTML para popups ─────────────────────────────────────────────

/** Cabeçalho comum a todos os popups de moderação (data + solicitante + tipo). */
export function moderacaoMetaHeaderHtml(it) {
  const dt = it.criado_em ? new Date(it.criado_em).toLocaleString('pt-BR') : '—';
  return `
    <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
      <div><strong style="color:var(--gray-600);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Solicitante</strong>${escapeHtmlStr(it.solicitante_nome || '—')}</div>
      <div><strong style="color:var(--gray-600);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Solicitada em</strong>${escapeHtmlStr(dt)}</div>
      <div><strong style="color:var(--gray-600);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Tipo</strong><span class="badge badge-orange">${escapeHtmlStr(getModeracaoTipoLabel(it.tipo))}</span></div>
    </div>`;
}

/** Diff antes/depois para matriz_upsert. */
export function buildMatrizModeracaoDiffBodyHtml(payload) {
  const p = normalizeModeracaoPayload(payload);
  const reg = p.registro || {};
  const editId = p.editId;
  const notaHistorico = (prev, cur) =>
    matrizHistoricoAlterado(prev, cur)
      ? '<p style="font-size:12px;color:var(--gray-600);margin:12px 0 0;line-height:1.45;">O <strong>histórico interno</strong> da competência (rastreio de versões) também foi atualizado na proposta do gestor.</p>'
      : '';

  if (editId) {
    const data = getStorage(STORAGE_KEYS.matriz) || [];
    const prev = data.find((x) => idEquals(x.id, editId));
    if (!prev) {
      return `<p class="text-muted" style="font-size:13px;">Não foi possível localizar o registo atual na matriz (id: <code>${escapeHtmlStr(String(editId))}</code>). Proposta (JSON):</p><pre style="white-space:pre-wrap;font-size:12px;max-height:58vh;overflow:auto;margin:0;">${escapeHtmlStr(JSON.stringify(reg, null, 2))}</pre>`;
    }
    const diffs = [];
    moderacaoCollectObjectDiffs('', matrizStrippedForFieldDiff(prev), matrizStrippedForFieldDiff(reg), diffs);
    const histHtml = notaHistorico(prev, reg);
    if (!diffs.length) {
      if (histHtml) {
        return `<p style="font-size:13px;margin:0 0 8px;line-height:1.45;">Os <strong>campos principais</strong> da competência (sem contar o histórico interno) estão iguais ao registo atual.</p>${histHtml}`;
      }
      return '<p class="text-muted" style="font-size:13px;margin:0;">Nenhuma diferença detectada entre o registro guardado e o proposto.</p>';
    }
    const rows = diffs
      .map(
        (d) => `
      <tr>
        <td style="vertical-align:top;font-weight:600;font-size:12px;color:var(--navy);padding:8px;border-bottom:1px solid var(--gray-100);word-break:break-word;">${escapeHtmlStr(moderacaoLabelForFieldPath(STORAGE_KEYS.matriz, d.path))}</td>
        <td style="vertical-align:top;font-size:12px;padding:8px;border-bottom:1px solid var(--gray-100);background:#fff5f5;max-width:36%;word-break:break-word;"><pre style="margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;">${escapeHtmlStr(moderacaoFmtDiffVal(d.antes))}</pre></td>
        <td style="vertical-align:top;font-size:12px;padding:8px;border-bottom:1px solid var(--gray-100);background:#f0fdf4;max-width:36%;word-break:break-word;"><pre style="margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;">${escapeHtmlStr(moderacaoFmtDiffVal(d.depois))}</pre></td>
      </tr>`,
      )
      .join('');
    return `<p style="font-size:13px;margin:0 0 10px;line-height:1.45;">Campos da matriz que <strong>diferem</strong> do registo atual.</p>
      <div class="table-responsive" style="max-height:58vh;overflow:auto;border:1px solid var(--gray-200);border-radius:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:var(--gray-50);">
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Campo</th>
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Antes (atual)</th>
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Depois (proposto)</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>${histHtml}`;
  }
  const regShow = matrizStrippedForFieldDiff(reg);
  return `<p style="font-size:13px;margin:0 0 10px;line-height:1.45;"><strong>Nova competência</strong> — registo que será gravado na matriz se aprovar.</p>
    <div style="max-height:58vh;overflow:auto;padding-right:4px;">
      ${moderacaoPdiBlockTable('Dados da competência (matriz)', regShow, MODERACAO_FIELD_LABELS[STORAGE_KEYS.matriz])}
    </div>`;
}

/**
 * Diff antes/depois genérico para qualquer agregado JSON (usado por ações/trilhas).
 * Aceita a chave do storage e um título amigável para o caso de inclusão.
 */
export function buildModeracaoDiffBodyHtml(payload, storageKey, labelTituloNovo) {
  const p = normalizeModeracaoPayload(payload);
  const reg = p.registro || {};
  const editId = p.editId;

  if (editId) {
    const data = getStorage(storageKey) || [];
    const prev = data.find((x) => idEquals(x.id, editId));
    if (!prev) {
      return `<p class="text-muted" style="font-size:13px;">Não foi possível localizar o registro atual (id: <code>${escapeHtmlStr(String(editId))}</code>). Proposta (JSON):</p><pre style="white-space:pre-wrap;font-size:12px;max-height:58vh;overflow:auto;margin:0;">${escapeHtmlStr(JSON.stringify(reg, null, 2))}</pre>`;
    }
    const diffs = [];
    moderacaoCollectObjectDiffs('', matrizStrippedForFieldDiff(prev), matrizStrippedForFieldDiff(reg), diffs);
    if (!diffs.length) {
      return '<p class="text-muted" style="font-size:13px;margin:0;">Nenhuma diferença detectada entre o registro guardado e o proposto.</p>';
    }
    const rows = diffs
      .map(
        (d) => `
      <tr>
        <td style="vertical-align:top;font-weight:600;font-size:12px;color:var(--navy);padding:8px;border-bottom:1px solid var(--gray-100);word-break:break-word;">${escapeHtmlStr(moderacaoLabelForFieldPath(storageKey, d.path))}</td>
        <td style="vertical-align:top;font-size:12px;padding:8px;border-bottom:1px solid var(--gray-100);background:#fff5f5;max-width:36%;word-break:break-word;"><pre style="margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;">${escapeHtmlStr(moderacaoFmtDiffVal(d.antes))}</pre></td>
        <td style="vertical-align:top;font-size:12px;padding:8px;border-bottom:1px solid var(--gray-100);background:#f0fdf4;max-width:36%;word-break:break-word;"><pre style="margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;">${escapeHtmlStr(moderacaoFmtDiffVal(d.depois))}</pre></td>
      </tr>`,
      )
      .join('');
    return `<p style="font-size:13px;margin:0 0 10px;line-height:1.45;">Apenas os campos abaixo <strong>diferem</strong> do registro atual.</p>
      <div class="table-responsive" style="max-height:58vh;overflow:auto;border:1px solid var(--gray-200);border-radius:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:var(--gray-50);">
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Campo</th>
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Antes (atual)</th>
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Depois (proposto)</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
  // Inclusão: tabela com todos os campos do novo registro com labels amigáveis
  return `<p style="font-size:13px;margin:0 0 10px;line-height:1.45;"><strong>${escapeHtmlStr(labelTituloNovo)}</strong> — conteúdo que será gravado se aprovado.</p>
    <div style="max-height:58vh;overflow:auto;padding-right:4px;">
      ${moderacaoPdiBlockTable('Dados propostos', matrizStrippedForFieldDiff(reg), MODERACAO_FIELD_LABELS[storageKey] || {})}
    </div>`;
}
