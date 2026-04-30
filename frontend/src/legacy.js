/**
 * legacy.js — code path completo do app (renderers, modais, exportações DOCX, moderação).
 *
 * Em refator subsequente este arquivo deve ser quebrado em `src/pages/*.js`. Por ora
 * permanece como um arquivo grande para manter paridade visual e funcional 1:1 com
 * o monólito anterior. Símbolos transversais (storage, auth, formatadores) já foram
 * extraídos e são consumidos via os imports abaixo.
 */
import { apiFetch, getToken } from './api/client.js';
import {
  STORAGE_KEYS,
  appendModeracaoItem,
  deleteStorage,
  getStorage,
  invalidateUsersCache,
  refetchKey,
  setStorage,
} from './api/storage.js';
import { sha256HexUtf8 } from './auth/crypto.js';
import { maskCPF, validateCPF } from './auth/cpf.js';
import {
  isAdminUser,
  isGestorUser,
  isSomenteLeitura,
  podeEditarDireto,
  usaFilaModeracao,
} from './auth/roles.js';
import {
  doLogin,
  doLogout,
  doRegister,
  getCurrentUser,
  setCurrentUser,
  showForgotPassword,
  switchAuthTab,
  updateSidebarUser,
  validateRegisterCPF,
} from './auth/session.js';
import { escapeHtmlStr } from './shared/escape.js';
import { fmtAE, genId, idEquals, normalizeActionCode } from './shared/format.js';
import { acaoEixoUnidadeFromLegacy, syncEixoTematicoLegado } from './shared/acoes-utils.js';
import { pdiNormalizePersistido, pdiUsaTrilhaLegado } from './shared/pdi-utils.js';
import { getPaginationButtons } from './shared/pagination.js';
import {
  MODERACAO_FIELD_LABELS,
  PDI_MODERACAO_LABELS_B1,
  PDI_MODERACAO_LABELS_B2,
  PDI_MODERACAO_LABELS_B3,
  buildMatrizModeracaoDiffBodyHtml,
  buildModeracaoDiffBodyHtml,
  getModeracaoResumo,
  getModeracaoTipoLabel,
  matrizStrippedForFieldDiff,
  moderacaoCollectObjectDiffs,
  moderacaoFmtDiffVal,
  moderacaoLabelForFieldPath,
  moderacaoMetaHeaderHtml,
  moderacaoPdiBlockTable,
  normalizeModeracaoPayload,
  pdiModeracaoLabelForPath,
  pushFilaModeracao,
} from './shared/moderacao.js';
import { showToast } from './shared/toast.js';
import {
  acoesFilter,
  acoesPage,
  acoesPerPage,
  acoesViewMode,
  charts,
  currentPage,
  gestorModeracaoHistoricoPage,
  gestorModeracaoHistoricoPerPage,
  matrizFilters,
  matrizPage,
  matrizPerPage,
  matrizSort,
  moderacaoHistoricoPage,
  moderacaoHistoricoPerPage,
  setAcoesFilter,
  setAcoesPage,
  setAcoesViewMode,
  setCharts,
  setCurrentPage,
  setGestorModeracaoHistoricoPage,
  setMatrizFilters,
  setMatrizPage,
  setMatrizSort,
  setModeracaoHistoricoPage,
} from './core/state.js';
import {
  closeModal,
  closeModalBtn,
  closeSidebar,
  destroyDashboardCharts,
  navigate,
  openModal,
  pageMap,
  toggleSidebar,
} from './router.js';

/* `currentUser` é mantido pelo módulo de auth — exposto aqui como propriedade dinâmica
 * para minimizar mudanças em ~5400 linhas que leem `currentUser.algo`. */
Object.defineProperty(globalThis, 'currentUser', {
  configurable: true,
  get: () => getCurrentUser(),
  set: (value) => setCurrentUser(value),
});

// ================================================================
// AUTH
// ================================================================

// Role helpers (isAdminUser etc.) → src/auth/roles.js
// pushFilaModeracao → src/shared/moderacao.js











// ================================================================
// NAVIGATION
// ================================================================

/**
 * Escopo da matriz usado nos gráficos do dashboard.
 * Se o filtro estiver em "filtrado" mas nenhuma ação tiver competências vinculadas,
 * usa fallback: todas as competências ativas (evita gráficos vazios enganosos).
 * @returns {{ escopo: array, matrizEscopoFallback: boolean }}
 */

function normalizeExcelHeader(header) {
  return String(header || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getRowValue(row, aliases) {
  for (const alias of aliases) {
    const v = row[alias];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

/** Valor da linha: aliases fixos primeiro; depois qualquer coluna cujo nome normalizado inclua `needle` (exceto substrings em `exclude`). */
function getRowValueFuzzy(row, aliases, needle, exclude) {
  const direct = getRowValue(row, aliases);
  if (String(direct || '').trim()) return direct;
  if (!needle) return '';
  const ex = exclude || [];
  for (const key of Object.keys(row)) {
    if (!key.includes(needle)) continue;
    if (ex.some((s) => key.includes(s))) continue;
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

/** Carga horária (> 0) para importação; retorna null se ausente/ inválida. */
function cargaHorariaLidaAPlanilha(row) {
  const cargaRaw = getRowValue(row, [
    'carga_horaria', 'carga_horaria_h_a', 'carga_horaria_h', 'ch', 'carga', '13_carga_horaria',
    '13_carga_horaria_h_a', '13_carga_horaria_h', 'horas', 'horas_totais', 'total_horas', 'total_de_horas',
    'total_de_horas_h', 'quantidade_de_horas', 'n_de_horas', 'numero_de_horas',
    'carga_h', 'h', 'cargahoraria', 'carga_hora', 'carga_de_horas', 'carga_horria',
  ]);
  const s = cargaRaw !== '' && cargaRaw != null ? String(cargaRaw).replace(/\s/g, '').replace(',', '.').trim() : '';
  if (!s) return null;
  const f = parseFloat(s);
  if (!Number.isFinite(f) || f <= 0) return null;
  const n = Math.round(f);
  return n > 0 ? n : null;
}

function parseBool(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'sim', 'yes', 'y', 'ok'].includes(normalized);
}

function parseIdList(value) {
  if (!value) return [];
  return String(value).split(/[;,]/).map(x => x.trim()).filter(Boolean);
}

function excelSheetToArrayOfArrays(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
}

/** Pontua uma linha como possível cabeçalho da matriz (evita planilhas com título nas primeiras linhas). */
function scorePotentialMatrizHeaderRow(cellValues) {
  let score = 0;
  for (const raw of cellValues) {
    const h = normalizeExcelHeader(raw);
    if (!h || h.length < 2) continue;
    if (h.includes('competencia') || h === 'competencias') score += 3;
    if (h.includes('categoria')) score += 2;
    if (h.includes('cargo')) score += 2;
    if (h.includes('objetivo')) score += 2;
    if (h.includes('subcategoria')) score += 1;
    if (h.includes('eixo')) score += 1;
    if (h.includes('unidade')) score += 1;
    if (h.includes('conhecimento')) score += 1;
    if (h.includes('tipologia')) score += 1;
    if (h === 'matriz' || (h.includes('matriz') && h.length <= 36)) score += 1;
  }
  return score;
}

function scorePotentialAcoesHeaderRow(cellValues) {
  let score = 0;
  for (const raw of cellValues) {
    const h = normalizeExcelHeader(raw);
    if (!h) continue;
    if (h.includes('nome') && (h.includes('acao') || h.includes('a_o') || h.includes('curso'))) score += 3;
    if (h === 'nome' || h.includes('nome_da_acao')) score += 2;
    if (h.includes('carga') && h.includes('hor')) score += 2;
    if (h.includes('carga_horaria') || h === 'ch') score += 2;
    if (h.includes('objetivo')) score += 2;
    if (h.includes('codigo')) score += 1;
  }
  return score;
}

function rowsFromAoA(aoa, headerRowIndex) {
  const headerCells = aoa[headerRowIndex] || [];
  const headers = headerCells.map((c) => normalizeExcelHeader(c));
  const rows = [];
  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!line || !line.some((cell) => String(cell || '').trim() !== '')) continue;
    const normalized = {};
    headers.forEach((key, c) => {
      if (!key) return;
      const v = line[c];
      normalized[key] = typeof v === 'string' ? v.trim() : v;
    });
    rows.push(normalized);
  }
  return rows;
}

function readExcelRows(file, moduleKey) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo Excel.'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = excelSheetToArrayOfArrays(ws);

        let headerIdx = 0;
        if (moduleKey === STORAGE_KEYS.matriz && aoa.length > 1) {
          const s0 = scorePotentialMatrizHeaderRow(aoa[0] || []);
          const s1 = scorePotentialMatrizHeaderRow(aoa[1] || []);
          /* Ex.: BANCO DE DADOS - MCN-2026-SPB.xlsx: linha 1 = título; linha 2 = cabeçalhos; dados a partir da 3. */
          if (s1 >= 8 && s1 > s0) {
            headerIdx = 1;
          } else {
            let best = 0;
            let bestScore = s0;
            for (let i = 1; i < Math.min(aoa.length, 50); i++) {
              const s = scorePotentialMatrizHeaderRow(aoa[i] || []);
              if (s > bestScore) {
                bestScore = s;
                best = i;
              }
            }
            if (bestScore >= 8) headerIdx = best;
          }
        } else if (moduleKey === STORAGE_KEYS.acoes && aoa.length > 1) {
          let best = 0;
          let bestScore = scorePotentialAcoesHeaderRow(aoa[0] || []);
          for (let i = 1; i < Math.min(aoa.length, 50); i++) {
            const s = scorePotentialAcoesHeaderRow(aoa[i] || []);
            if (s > bestScore) {
              bestScore = s;
              best = i;
            }
          }
          if (bestScore >= 5) headerIdx = best;
        }

        const rows = rowsFromAoA(aoa, headerIdx);
        /* Linha 1-based do Excel onde começa o 1.º registro de dados (cabeçalho na linha anterior). */
        const firstDataExcelRow = headerIdx + 2;
        resolve({ rows, firstDataExcelRow });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function buildMatrizImportRecord(row) {
  return {
    id: getRowValue(row, ['id', 'id_registro', 'id_competencia', 'id_mcn', 'id_matriz']) || genId(),
    competencia: getRowValueFuzzy(row, [
      'competencia',
      'competencias',
      'competencia_capacidades_de_para',
      'competencia_mcn',
      'nome_da_competencia',
      'descricao_da_competencia',
      '1_competencia',
      '2_competencia',
      'item_competencia',
    ], 'competencia', ['subcategoria', 'categoria']),
    categoria: getRowValueFuzzy(row, ['categoria', 'categoria_funcional', '1_categoria', '2_categoria'], 'categoria', ['subcategoria']),
    subcategoria: getRowValueFuzzy(row, ['subcategoria', 'sub_categoria', '1_subcategoria'], 'subcategoria', []),
    cargo: getRowValueFuzzy(row, ['cargo', 'cargo_alvo', 'perfil', '1_cargo', '2_cargo'], 'cargo', []),
    eixo: getRowValueFuzzy(row, ['eixo', 'eixo_funcional', 'eixo_funcional_mcn', '1_eixo'], 'eixo', []),
    unidade: getRowValueFuzzy(row, ['unidade', 'unidade_tematica', 'unidade_tematica_mcn', '1_unidade'], 'unidade', []),
    conhecimento: getRowValueFuzzy(row, [
      'conhecimento',
      'conhecimento_critico',
      'conhecimento_critico_e_para_pratica',
      'conhecimento_critico_e_para_a_pratica',
    ], 'conhecimento', []),
    tipologia_objetivo: getRowValueFuzzy(row, ['tipologia_objetivo', 'tipologia_do_objetivo'], 'tipologia_objetivo', ['complexidade']),
    tipologia_complexidade: getRowValueFuzzy(row, ['tipologia_complexidade', 'tipologia_de_complexidade', 'complexidade'], 'tipologia_complexidade', []),
    matriz: getRowValue(row, ['matriz', 'matriz_de_referencia', 'ano_matriz', 'ano', 'referencia_matriz']) || '2026',
    objetivo: getRowValueFuzzy(row, [
      'objetivo',
      'objetivo_aprendizagem',
      'objetivo_de_aprendizagem',
      'objetivo_da_competencia',
      'objetivo_de_aprendizagem_da_competencia',
      '1_objetivo',
    ], 'objetivo', []),
  };
}


function buildAcoesImportRecord(row) {
  const chLida = cargaHorariaLidaAPlanilha(row);
  const eixo = getRowValue(row, ['eixo', '6_eixo']);
  const unidade = getRowValue(row, ['unidade', '7_unidade']);
  const instA = getRowValue(row, [
    'instrumento_avaliacao_aprendizagem', 'instrumento_avaliacao',
    '22_instrumentos_de_avaliacao_de_aprendizagem', '22_instrumento_de_avaliacao_da_aprendizagem',
  ]);
  const instR = getRowValue(row, [
    'instrumento_avaliacao_reacao',
    '23_instrumentos_de_avaliacao_de_reacao', '23_instrumento_de_avaliacao_da_reacao',
  ]);
  const instT = getRowValue(row, [
    'instrumento_avaliacao_transferencia',
    '24_instrumentos_de_avaliacao_de_transferencia_e_impacto', '24_instrumento_de_avaliacao_da_transferencia',
  ]);
  const nome = getRowValue(row, ['nome', 'nome_da_acao', '3_nome_da_acao', 'titulo', 'nome_da_acao_educativa', 'curso']);
  const objEsp = getRowValue(row, ['objetivos_especificos', '11_objetivos_especificos']);
  const compOferta = getRowValue(row, ['competencia', '10_competencia', 'competencia_texto']);
  const objetivoGeral = getRowValue(row, ['objetivo_geral', 'objetivo', '14_objetivo_geral', 'objetivo_geral_da_acao'])
    || [compOferta, objEsp].filter(Boolean).join('\n\n')
    || getRowValue(row, ['objetivo_de_aprendizagem_mcn', 'objetivo_aprendizagem_mcn'])
    || String(getRowValue(row, ['conteudos', '15_conteudos']) || '').slice(0, 2000);
  return {
    id: getRowValue(row, ['id', 'id_registro', 'id_acao', 'id_acao_educativa']) || genId(),
    nome,
    objetivo_geral: objetivoGeral,
    codigo: getRowValue(row, ['codigo', 'id_ae', 'codigo_ae', '3_codigo', '4_codigo', '5_id_ae', '3_id_ae']),
    tipo: getRowValue(row, ['tipo', '4_tipo_da_acao']) || 'Curso',
    estado: getRowValue(row, ['estado']),
    sigla_estado: getRowValue(row, ['sigla_estado']),
    e_trilha: getRowValue(row, ['e_trilha']),
    e_modulo: getRowValue(row, ['e_modulo']),
    modulos_associados: getRowValue(row, ['modulos_associados']),
    competencia_mcn: getRowValue(row, ['competencia_mcn']),
    eixo_funcional_mcn: getRowValue(row, ['eixo_funcional_mcn']),
    unidade_tematica_mcn: getRowValue(row, ['unidade_tematica_mcn']),
    conhecimento_critico_mcn: getRowValue(row, ['conhecimento_critico_e_para_a_pratica', 'conhecimento_critico_mcn']),
    objetivo_aprendizagem_mcn: getRowValue(row, ['objetivo_de_aprendizagem_mcn', 'objetivo_aprendizagem_mcn']),
    area_demandante: getRowValue(row, ['area_demandante', '1_area_demandante']),
    escola_proponente: getRowValue(row, ['escola_proponente', '2_escola_proponente']) || 'ESPEN',
    eixo,
    unidade,
    eixo_tematico: syncEixoTematicoLegado(eixo, unidade) || getRowValue(row, ['eixo_tematico']),
    justificativa_oferta: getRowValue(row, ['justificativa_da_oferta', 'justificativa_oferta', '8_justificativa_da_oferta']),
    amparo_legal: getRowValue(row, ['amparo_legal', '9_amparo_legal']),
    competencia_texto: compOferta,
    objetivos_especificos: objEsp,
    status: getRowValue(row, ['status']) || 'Ativo',
    ementa: getRowValue(row, ['ementa']),
    conteudo_programatico: getRowValue(row, ['conteudo_programatico', 'conteudos', '15_conteudos']),
    metodologia: getRowValue(row, ['metodologia', '16_metodologia_de_ensino']),
    duracao: getRowValue(row, ['duracao', '14_duracao']),
    espaco_fisico: getRowValue(row, ['espaco_fisico', '17_espaco_fisico']),
    plataforma_virtual: getRowValue(row, [
      'plataforma_virtual',
      '18_plataforma_virtual_de_ensino_e_aprendizagem',
      '18_plataforma_virtual_de_ensino_aprendizagem',
    ]),
    recursos_materiais: getRowValue(row, ['recursos_materiais', '19_recursos_materiais']),
    recursos_tecnologicos: getRowValue(row, ['recursos_tecnologicos', '20_recursos_tecnologicos']),
    recursos_humanos: getRowValue(row, ['recursos_humanos', '21_recursos_humanos']),
    carga_horaria: chLida != null ? chLida : 0,
    num_modulos: parseInt(getRowValue(row, ['num_modulos', 'modulos']), 10) || 1,
    modalidade: getRowValue(row, ['modalidade', '12_modalidade']) || 'EaD',
    num_vagas: parseInt(getRowValue(row, ['num_vagas', 'vagas']), 10) || 0,
    publico_alvo: getRowValue(row, ['publico_alvo', '5_publico_alvo']),
    frequencia_minima: parseInt(getRowValue(row, ['frequencia_minima']), 10) || 90,
    instrumento_avaliacao_aprendizagem: instA,
    instrumento_avaliacao_reacao: instR,
    instrumento_avaliacao_transferencia: instT,
    instrumento_avaliacao: instA || getRowValue(row, ['instrumento_avaliacao']),
    criterios_matricula: getRowValue(row, ['criterios_de_matricula', 'criterios_matricula', '25_criterios_de_matricula']),
    criterio_certificacao: getRowValue(row, ['criterio_certificacao', 'criterios_de_certificacao', '26_criterios_de_certificacao']),
    bibliografia: getRowValue(row, ['bibliografia', '27_bibliografia']),
    data_criacao: getRowValue(row, ['data_criacao']) || new Date().toISOString().split('T')[0],
  };
}

function buildTrilhaImportRecord(row, acoes) {
  const rawRefs = parseIdList(getRowValue(row, ['acoes_vinculadas', 'acoes', 'acoes_ids']));
  const actionIds = rawRefs.map((token) => {
    const byId = acoes.find(a => idEquals(a.id, token));
    if (byId) return byId.id;
    const byName = acoes.find(a => (a.nome || '').toLowerCase() === token.toLowerCase());
    return byName ? byName.id : null;
  }).filter(Boolean);

  return {
    id: getRowValue(row, ['id']) || genId(),
    nome: getRowValue(row, ['nome']),
    descricao: getRowValue(row, ['descricao']),
    cargo_alvo: getRowValue(row, ['cargo_alvo', 'cargo']),
    eixo_funcional: getRowValue(row, ['eixo_funcional', 'eixo']),
    nivel: getRowValue(row, ['nivel']) || 'Intermediário',
    acoes_vinculadas: actionIds,
  };
}

function transformExcelRows(moduleKey, rows, firstDataExcelRow) {
  const valid = [];
  const invalid = [];
  const lineBase = firstDataExcelRow != null && firstDataExcelRow > 0 ? firstDataExcelRow : 2;
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];
  const codigosAcoesNaPlanilha = new Set();

  rows.forEach((row, idx) => {
    try {
      let rec = null;
      if (moduleKey === STORAGE_KEYS.matriz) {
        rec = buildMatrizImportRecord(row);
        const faltam = [];
        if (!String(rec.competencia || '').trim()) faltam.push('competência');
        if (!String(rec.categoria || '').trim()) faltam.push('categoria');
        if (!String(rec.cargo || '').trim()) faltam.push('cargo');
        if (!String(rec.objetivo || '').trim()) faltam.push('objetivo / objetivo de aprendizagem');
        if (faltam.length) {
          throw new Error(
            'Matriz: ausente(s): ' + faltam.join(', ') +
            '. Cabeçalhos aceitos incluem competencia, "Competência", objetivo, "Objetivo de Aprendizagem", categoria, cargo (e export CSV do sistema).'
          );
        }
      } else if (moduleKey === STORAGE_KEYS.acoes) {
        rec = buildAcoesImportRecord(row);
        const chOk = cargaHorariaLidaAPlanilha(row);
        if (chOk != null) rec.carga_horaria = chOk;
        if (!String(rec.nome || '').trim()) {
          throw new Error('Nome da ação ausente (colunas: nome, nome_da_acao, titulo, curso).');
        }
        if (!String(rec.objetivo_geral || '').trim()) {
          throw new Error('Objetivo geral vazio (objetivo_geral, objetivo, competência ou conteúdos).');
        }
        if (chOk == null) {
          throw new Error('Carga horária ausente ou inválida. Use coluna carga_horaria, "Carga Horária (h/a)", ch, horas ou 13_carga_horaria (número > 0).');
        }
        const idNaPlanilha = String(getRowValue(row, ['id', 'id_registro', 'id_acao', 'id_acao_educativa']) || '').trim();
        const cn = normalizeActionCode(rec.codigo);
        if (cn) {
          if (codigosAcoesNaPlanilha.has(cn)) {
            throw new Error('Código da ação duplicado nesta planilha (mesmo código em mais de uma linha).');
          }
          const matches = acoes.filter((a) => normalizeActionCode(a.codigo) === cn);
          if (matches.length && !idNaPlanilha) {
            rec.id = matches[0].id;
          }
          const conflito = acoes.find((a) => {
            if (normalizeActionCode(a.codigo) !== cn) return false;
            if (idEquals(a.id, rec.id)) return false;
            if (matches.length > 1 && idEquals(rec.id, matches[0].id)) return false;
            return true;
          });
          if (conflito) {
            throw new Error(
              `Código "${String(rec.codigo).trim()}" conflita com outro registro. Ajuste o código ou a coluna id.`
            );
          }
          codigosAcoesNaPlanilha.add(cn);
        }
      } else if (moduleKey === STORAGE_KEYS.trilhas) {
        rec = buildTrilhaImportRecord(row, acoes);
        if (!rec.nome) throw new Error('Nome da trilha é obrigatório');
      }

      if (!rec) throw new Error('Registro não mapeado');
      valid.push(rec);
    } catch (err) {
      invalid.push({ line: lineBase + idx, error: err.message });
    }
  });

  return { valid, invalid };
}

/** Resumo pós-importação: novos vs. atualização de IDs já no acervo (planilha sobrescreve merge em AEs). */
function resumoMensagemImportacao(moduleKey, replaceAll, existing, valid, invalidCount) {
  const ex = existing || [];
  const exIds = new Set(ex.map((x) => String(x.id)));
  const inv = invalidCount || 0;
  const sufixoInv = inv > 0 ? ` ${inv} linha(s) da planilha rejeitada(s).` : '';
  if (replaceAll) {
    return {
      text:
        `Substituiu todo o módulo: agora há ${valid.length} registro(s) com base na planilha (dados anteriores deste módulo deixam de valer).` + sufixoInv,
      toastType: inv > 0 ? 'warning' : 'success',
    };
  }
  const novos = valid.filter((v) => !exIds.has(String(v.id))).length;
  const atual = valid.length - novos;
  if (atual > 0 && novos > 0) {
    return {
      text: `${novos} registro(s) novo(s) e ${atual} registro(s) que já existiam (foram atualizados com os dados da planilha).` + sufixoInv,
      toastType: 'warning',
    };
  }
  if (atual > 0) {
    return {
      text: `Nenhum registro novo: ${atual} linha(s) corresponderam a registro(s) já existente(s) e foram atualizadas conforme a planilha.` + sufixoInv,
      toastType: 'warning',
    };
  }
  return {
    text: `Incluídos ${novos} registro(s) novo(s).` + sufixoInv,
    toastType: inv > 0 ? 'warning' : 'success',
  };
}

function importExcelData(moduleKey) {
  if (!isAdminUser()) {
    showToast('A importação em massa é restrita ao administrador.', 'warning');
    return;
  }
  if (!window.XLSX) {
    showToast('Biblioteca de Excel não carregada. Recarregue a página.', 'error');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    try {
      const { rows, firstDataExcelRow } = await readExcelRows(file, moduleKey);
      if (!rows.length) {
        showToast('Planilha sem dados para importar.', 'warning');
        return;
      }

      const { valid, invalid } = transformExcelRows(moduleKey, rows, firstDataExcelRow);
      if (!valid.length) {
        const amostra = (invalid || []).slice(0, 3).map((i) => `Linha ${i.line}: ${i.error}`).join(' ');
        showToast(
          'Nenhuma linha válida. ' +
            (amostra ? amostra + (invalid.length > 3 ? ' …' : '') :
              (moduleKey === STORAGE_KEYS.matriz
                ? 'Verifique competência, categoria, cargo e objetivo (ou exporte CSV da tela da matriz e reabra como Excel).'
                : 'Verifique cabeçalhos e carga horária.')),
          'error'
        );
        return;
      }

      const replaceAll = confirm(
        'Importação: escolha o modo.\n\n' +
        '• OK — substitui todos os registros deste módulo pelos dados da planilha.\n' +
        '• Cancelar — mantém o que já existe e acrescenta só os registros importados.'
      );
      const existing = getStorage(moduleKey) || [];
      let payload;
      if (replaceAll) {
        payload = valid;
      } else if (moduleKey === STORAGE_KEYS.acoes || moduleKey === STORAGE_KEYS.matriz) {
        const byId = new Map((existing || []).map((x) => [String(x.id), { ...x }]));
        valid.forEach((v) => {
          const k = String(v.id);
          if (byId.has(k)) {
            byId.set(k, { ...byId.get(k), ...v });
          } else {
            byId.set(k, v);
          }
        });
        payload = Array.from(byId.values());
      } else {
        payload = [...(existing || []), ...valid];
      }
      setStorage(moduleKey, payload);

      const res = resumoMensagemImportacao(moduleKey, replaceAll, existing, valid, invalid.length);
      showToast(res.text, res.toastType);

      if (moduleKey === STORAGE_KEYS.matriz && document.getElementById('matriz-table-content')) globalThis.renderMatrizTable?.();
      if (moduleKey === STORAGE_KEYS.acoes && document.getElementById('acoes-grid')) globalThis.renderAcoesGrid?.();
      if (moduleKey === STORAGE_KEYS.trilhas && typeof globalThis.renderTrilhas === 'function') globalThis.renderTrilhas();
    } catch (err) {
      showToast(`Falha na importação: ${err.message}`, 'error');
    }
  };

  input.click();
}

// ================================================================
// DASHBOARD
// ================================================================

// ================================================================
// MATRIZ DE COMPETÊNCIAS
// ================================================================

// ================================================================
// AÇÕES EDUCATIVAS
// ================================================================


// ================================================================
// TRILHAS DE APRENDIZAGEM
// ================================================================

// ================================================================
// PLANO DE ENSINO
// ================================================================
/** Plano antigo só com trilha (sem acao_id): ainda exibido até ser regravado. */

// ================================================================
// MODERAÇÃO / APROVAÇÕES (ADMIN)
// ================================================================

// ================================================================
// GESTÃO DE USUÁRIOS
// ================================================================

// ================================================================
// EXPORTAÇÃO DOCX — HELPERS
// ================================================================

// Alias global para a lib (UMD expõe window.docx)
function getDocx() { return window.docx || window.docxLib; }

// Paleta e estilos reutilizáveis
function docxStyles() {
  const { docx } = window;
  return {
    navy:   '1A237E',
    gold:   'FFC107',
    white:  'FFFFFF',
    gray1:  'F8F9FA',
    gray2:  'DEE2E6',
    gray3:  '6C757D',
    dark:   '212529',
  };
}

// Cabeçalho institucional do documento
function docxHeader(title, subtitle) {
  const docx = getDocx();
  const c = docxStyles();
  return [
    new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'ESPEN — Escola Nacional de Serviços Penais', bold: true, size: 22, color: c.white, font: 'Calibri' }),
      ],
      shading: { type: docx.ShadingType.SOLID, color: c.navy },
      spacing: { before: 0, after: 80 },
      indent: { left: 200, right: 200 },
    }),
    new docx.Paragraph({
      children: [
        new docx.TextRun({ text: 'SENAPPEN / Ministério da Justiça e Segurança Pública', size: 18, color: c.white, font: 'Calibri' }),
      ],
      shading: { type: docx.ShadingType.SOLID, color: c.navy },
      spacing: { before: 0, after: 200 },
      indent: { left: 200, right: 200 },
    }),
    new docx.Paragraph({
      children: [
        new docx.TextRun({ text: title, bold: true, size: 32, color: c.navy, font: 'Calibri' }),
      ],
      spacing: { before: 300, after: 100 },
    }),
    ...(subtitle ? [new docx.Paragraph({
      children: [new docx.TextRun({ text: subtitle, size: 20, color: c.gray3, font: 'Calibri' })],
      spacing: { before: 0, after: 60 },
    })] : []),
    new docx.Paragraph({
      children: [new docx.TextRun({ text: `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}  |  Usuário: ${currentUser ? currentUser.nome : '—'}`, size: 18, color: c.gray3, italics: true, font: 'Calibri' })],
      spacing: { before: 0, after: 400 },
      border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: c.gold } },
    }),
  ];
}

// Linha de campo: "Rótulo: Valor"
function docxField(label, value) {
  const docx = getDocx();
  const c = docxStyles();
  return new docx.Paragraph({
    children: [
      new docx.TextRun({ text: `${label}: `, bold: true, size: 20, color: c.navy, font: 'Calibri' }),
      new docx.TextRun({ text: value || '—', size: 20, color: c.dark, font: 'Calibri' }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

// Título de seção
function docxSectionTitle(text) {
  const docx = getDocx();
  const c = docxStyles();
  return new docx.Paragraph({
    children: [new docx.TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: c.white, font: 'Calibri' })],
    shading: { type: docx.ShadingType.SOLID, color: c.navy },
    spacing: { before: 300, after: 120 },
    indent: { left: 100 },
  });
}

// Parágrafo de texto longo
function docxText(text) {
  const docx = getDocx();
  const c = docxStyles();
  return new docx.Paragraph({
    children: [new docx.TextRun({ text: text || '—', size: 20, color: c.dark, font: 'Calibri' })],
    spacing: { before: 60, after: 120 },
  });
}

// Linha divisória leve
function docxDivider() {
  const docx = getDocx();
  const c = docxStyles();
  return new docx.Paragraph({
    children: [],
    border: { bottom: { style: docx.BorderStyle.SINGLE, size: 2, color: c.gray2 } },
    spacing: { before: 160, after: 160 },
  });
}

// Parágrafo de página nova
function docxPageBreak() {
  const docx = getDocx();
  return new docx.Paragraph({ children: [new docx.PageBreak()] });
}

// Gera e salva o DOCX
async function saveDocx(sections, filename) {
  const docx = getDocx();
  const doc = new docx.Document({
    creator: 'ESPEN — Sistema de Gestão por Competências',
    title: filename,
    description: 'Documento gerado automaticamente pelo ESPEN SGC',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: sections,
  });
  const blob = await docx.Packer.toBlob(doc);
  saveAs(blob, filename);
}

const PLANO_ENSINO_TEMPLATE_DOCX = 'templates/Modelo de Plano de ensino.docx';

function getPizZip() {
  return typeof window !== 'undefined' ? window.PizZip : null;
}

function fmtPlanoDateDocx(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

/** Texto seguro para w:t em WordprocessingML. */
function escapeDocxText(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function docxWParagraphField(label, value) {
  const lines = String(value ?? '').split(/\n/);
  let inner = `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeDocxText(label)}:</w:t></w:r>`;
  inner += `<w:r><w:t xml:space="preserve"> ${escapeDocxText(lines[0] || '—')}</w:t></w:r>`;
  for (let i = 1; i < lines.length; i++) {
    inner += '<w:r><w:br/></w:r>';
    inner += `<w:r><w:t xml:space="preserve">${escapeDocxText(lines[i])}</w:t></w:r>`;
  }
  return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${inner}</w:p>`;
}

function docxWParagraphTitle(text) {
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeDocxText(text)}</w:t></w:r></w:p>`;
}

function docxWParagraphMeta(text) {
  return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="666666"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeDocxText(text)}</w:t></w:r></w:p>`;
}

function docxWParagraphBody(text) {
  return `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:t xml:space="preserve">${escapeDocxText(text)}</w:t></w:r></w:p>`;
}

function buildPlanoEnsinoBodyXmlFragment(sections, legadoLista) {
  let meta = `ESPEN / SENAPPEN — ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.nome) meta += ` — ${currentUser.nome}`;
  let xml = '';
  xml += docxWParagraphTitle('Plano de ensino');
  xml += docxWParagraphMeta(meta);
  sections.forEach((sec) => {
    xml += docxWParagraphTitle(sec.title);
    sec.rows.forEach(([k, v]) => {
      xml += docxWParagraphField(k, v);
    });
  });
  if (legadoLista && legadoLista.length) {
    xml += docxWParagraphTitle('Ações da trilha (formato legado)');
    legadoLista.forEach((line) => {
      xml += docxWParagraphBody(line);
    });
  }
  return xml;
}

function mergePlanoBodyIntoDocumentXml(documentXml, fragmentXml) {
  const bodyOpen = '<w:body>';
  const bodyIdx = documentXml.indexOf(bodyOpen);
  const sectIdx = documentXml.indexOf('<w:sectPr', bodyIdx + 1);
  if (bodyIdx < 0 || sectIdx < 0) {
    throw new Error('O modelo Word não tem a estrutura esperada (word/document.xml: <w:body> … <w:sectPr>).');
  }
  return documentXml.slice(0, bodyIdx + bodyOpen.length) + fragmentXml + documentXml.slice(sectIdx);
}

function gatherPlanoEnsinoTemplateSections(p, users, acoes, trilhas) {
  const user = users.find((u) => idEquals(u.id, p.usuario_id));
  const acao = acoes.find((a) => idEquals(a.id, p.acao_id));
  const trilha = trilhas.find((t) => idEquals(t.id, p.trilha_id));
  const legado = pdiUsaTrilhaLegado(p);
  const pb = p.plano_bloco1 && typeof p.plano_bloco1 === 'object' ? p.plano_bloco1 : {};
  const p2 = p.plano_bloco2 && typeof p.plano_bloco2 === 'object' ? p.plano_bloco2 : {};
  const p3 = p.plano_bloco3 && typeof p.plano_bloco3 === 'object' ? p.plano_bloco3 : {};
  const sections = [];

  sections.push({
    title: 'Dados do servidor',
    rows: [
      ['Nome', user ? user.nome : '—'],
      ['CPF', user ? user.cpf : '—'],
      ['E-mail', user ? user.email : '—'],
      ['Cargo', user ? user.cargo : '—'],
      ['Nível de acesso', user ? user.acesso : '—'],
    ],
  });

  const planoRows = [];
  if (acao) {
    planoRows.push(['Ação educativa', acao.nome || '—']);
    planoRows.push(['Código', acao.codigo || '—']);
    planoRows.push(['Modalidade (cadastro da ação)', acao.modalidade || '—']);
    planoRows.push(['Carga horária (cadastro)', `${acao.carga_horaria || 0}h`]);
  } else if (legado && trilha) {
    planoRows.push(['Trilha (formato antigo)', trilha.nome || '—']);
    planoRows.push(['Nível da trilha', trilha.nivel || '—']);
    planoRows.push(['Eixo funcional', trilha.eixo_funcional || '—']);
  } else {
    planoRows.push(['Ação educativa', '—']);
  }
  planoRows.push(['Data de início', fmtPlanoDateDocx(p.data_inicio)]);
  planoRows.push(['Data fim / meta', fmtPlanoDateDocx(p.data_meta)]);
  sections.push({ title: 'Dados do plano', rows: planoRows });

  if (pb && typeof pb === 'object') {
    sections.push({
      title: 'Bloco 1 — Identificação da ação educativa',
      rows: [
        ['Título da ação educativa', pb.titulo_acao || '—'],
        ['Público-alvo', `${pb.publico_alvo || '—'}${pb.publico_alvo === 'Outros' && pb.publico_alvo_outros ? ` — ${pb.publico_alvo_outros}` : ''}`],
        ['Observações / descrição', pb.observacoes || '—'],
        ['Objetivo geral', pb.objetivo_geral || '—'],
        ['Tipo da ação', `${pb.tipo_acao || '—'}${pb.tipo_acao === 'Outra' && pb.tipo_acao_outra ? ` (${pb.tipo_acao_outra})` : ''}`],
        ['Modalidade (plano)', pb.modalidade || '—'],
        ['Carga horária total (h)', pb.carga_horaria_total != null ? String(pb.carga_horaria_total) : '—'],
        ['Período — início', fmtPlanoDateDocx(pb.periodo_inicio)],
        ['Período — fim', fmtPlanoDateDocx(pb.periodo_fim)],
        ['Unidade promotora / Escola', pb.unidade_promotora || '—'],
        ['Coordenadores(as) / Instrutores(as)', pb.coordenadores_instrutores || '—'],
      ],
    });
  }

  if (p2 && typeof p2 === 'object') {
    sections.push({
      title: 'Bloco 2 — Design de competências (MCN-SPB 2026)',
      rows: [
        ['10. Categoria de competência', p2.categoria_competencia_mcn || '—'],
        ['11. Subcategoria de competência', p2.subcategoria_competencia_mcn || '—'],
        ['12. Eixo de competência', p2.eixo_competencia_mcn || '—'],
        ['13. Unidade temática', p2.unidade_tematica_mcn || '—'],
        ['14. Conhecimentos críticos trabalhados', p2.conhecimento_critico_mcn || '—'],
        ['15. Justificativa', p2.justificativa_design || '—'],
      ],
    });
  }

  if (p3 && typeof p3 === 'object') {
    sections.push({
      title: 'Bloco 3 — Design da ação educativa (MCN—2026-SPB)',
      rows: [
        ['16. Metodologias e estratégias', p3.metodologias_estrategias || '—'],
        ['17. Recursos humanos, tecnológicos e materiais', p3.recursos_humanos_tecnologicos_materiais || '—'],
        ['18. Avaliação da aprendizagem e transferência', p3.avaliacao_aprendizagem_transferencia || '—'],
        ['19. Referências e curadoria', p3.referencias_curadoria || '—'],
      ],
    });
  }

  let legadoLista = null;
  if (legado && trilha && (trilha.acoes_vinculadas || []).length > 0) {
    legadoLista = trilha.acoes_vinculadas
      .map((aid) => acoes.find((x) => idEquals(x.id, aid)))
      .filter(Boolean)
      .map((a, ai) => `${ai + 1}. ${a.nome} (${a.modalidade || '—'} · ${a.carga_horaria || 0}h)`);
    const totalH = trilha.acoes_vinculadas.reduce((sum, aid) => {
      const a = acoes.find((x) => idEquals(x.id, aid));
      return sum + (a ? a.carga_horaria || 0 : 0);
    }, 0);
    legadoLista.push(`Carga horária total da trilha: ${totalH}h`);
  }

  return { sections, legadoLista };
}

/**
 * Gera um .docx a partir do ficheiro-template real (cabeçalho, estilos, fontes do modelo)
 * inserindo o texto do plano no corpo (word/document.xml). Para PDF, abra no Word e use «Guardar como PDF».
 */
window.exportPlanoEnsinoFromTemplate = async function exportPlanoEnsinoFromTemplate(btn, opts) {
  opts = opts || {};
  const resetBtn = () => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-word"></i>';
    }
  };
  const PizZip = getPizZip();
  if (!PizZip || typeof saveAs !== 'function') {
    showToast('Bibliotecas necessárias não carregaram (PizZip / FileSaver). Atualize a página.', 'error');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  const pdis = pdiListVisibleForCurrentUser(getStorage(STORAGE_KEYS.pdi) || []);
  const users = getStorage(STORAGE_KEYS.users) || [];
  const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];

  if (opts.pdiId == null || String(opts.pdiId) === '') {
    resetBtn();
    showToast('Identificador do plano ausente.', 'error');
    return;
  }
  const p = pdis.find((row) => idEquals(row.id, opts.pdiId));
  if (!p) {
    resetBtn();
    showToast('Plano não encontrado ou sem permissão para exportar.', 'warning');
    return;
  }

  try {
    const res = await fetch(encodeURI(PLANO_ENSINO_TEMPLATE_DOCX), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Modelo não encontrado (${res.status}). Caminho esperado: templates/Modelo de Plano de ensino.docx`);
    }
    const buf = await res.arrayBuffer();
    const zip = new PizZip(buf);
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('O modelo .docx não contém word/document.xml.');
    const documentXml = docFile.asText();
    const { sections, legadoLista } = gatherPlanoEnsinoTemplateSections(p, users, acoes, trilhas);
    const fragment = buildPlanoEnsinoBodyXmlFragment(sections, legadoLista);
    const newDocXml = mergePlanoBodyIntoDocumentXml(documentXml, fragment);
    zip.file('word/document.xml', newDocXml);
    const blob = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveAs(blob, `Plano_ensino_${new Date().toISOString().slice(0, 10)}.docx`);
    showToast('Documento gerado a partir do modelo institucional.', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message ? String(e.message) : 'Não foi possível gerar o documento.', 'error');
  } finally {
    resetBtn();
  }
};

// ================================================================
// EXPORT DOCX — MATRIZ DE COMPETÊNCIAS
// ================================================================
async function exportMatrizDOCX(btn) {
  const d = getDocx();
  if (!d) { showToast('Biblioteca DOCX ainda carregando, aguarde.', 'warning'); return; }
  const data = getFilteredMatriz();
  if (data.length === 0) { showToast('Nenhum registro para exportar.', 'warning'); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  showToast(`Gerando DOCX com ${data.length} competências...`, 'info');
  const c = docxStyles();

  // Colunas da tabela
  const colWidths = [3200, 1200, 1200, 1800, 1800, 1800, 1400, 1100, 1100];

  function tCell(text, opts = {}) {
    return new d.TableCell({
      children: [new d.Paragraph({
        children: [new d.TextRun({
          text: String(text || '—'),
          bold: opts.bold || false,
          size: opts.size || 16,
          color: opts.color || c.dark,
          font: 'Calibri',
        })],
        spacing: { before: 40, after: 40 },
      })],
      shading: opts.shading ? { type: d.ShadingType.SOLID, color: opts.shading } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });
  }

  const headerRow = new d.TableRow({
    children: [
      tCell('Competência',            { bold:true, color:c.white, shading:c.navy }),
      tCell('Categoria',              { bold:true, color:c.white, shading:c.navy }),
      tCell('Subcategoria',           { bold:true, color:c.white, shading:c.navy }),
      tCell('Cargo',                  { bold:true, color:c.white, shading:c.navy }),
      tCell('Eixo Funcional',         { bold:true, color:c.white, shading:c.navy }),
      tCell('Unidade Temática',       { bold:true, color:c.white, shading:c.navy }),
      tCell('Conhecimento Crítico',   { bold:true, color:c.white, shading:c.navy }),
      tCell('Complexidade',           { bold:true, color:c.white, shading:c.navy }),
      tCell('Matriz',                 { bold:true, color:c.white, shading:c.navy }),
    ],
    tableHeader: true,
  });

  const dataRows = data.map((r, i) => new d.TableRow({
    children: [
      tCell(r.competencia,              { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.categoria,                { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.subcategoria,             { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.cargo,                    { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.eixo,                     { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.unidade,                  { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.conhecimento,             { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.tipologia_complexidade,   { shading: i%2===0 ? c.gray1 : c.white }),
      tCell(r.matriz,                   { shading: i%2===0 ? c.gray1 : c.white }),
    ],
  }));

  const table = new d.Table({
    rows: [headerRow, ...dataRows],
    columnWidths: colWidths,
    width: { size: 100, type: d.WidthType.PERCENTAGE },
    borders: {
      top:           { style: d.BorderStyle.SINGLE, size: 4, color: c.gray2 },
      bottom:        { style: d.BorderStyle.SINGLE, size: 4, color: c.gray2 },
      left:          { style: d.BorderStyle.SINGLE, size: 4, color: c.gray2 },
      right:         { style: d.BorderStyle.SINGLE, size: 4, color: c.gray2 },
      insideH:       { style: d.BorderStyle.SINGLE, size: 2, color: c.gray2 },
      insideV:       { style: d.BorderStyle.SINGLE, size: 2, color: c.gray2 },
    },
  });

  // Rodapé com objetivo de aprendizagem — seção separada após a tabela
  const objParagraphs = [];
  data.forEach((r, i) => {
    if (r.objetivo) {
      objParagraphs.push(
        new d.Paragraph({
          children: [
            new d.TextRun({ text: `[${i+1}] `, bold:true, size:18, color:c.navy, font:'Calibri' }),
            new d.TextRun({ text: r.competencia, bold:true, size:18, color:c.dark, font:'Calibri' }),
          ],
          spacing: { before: 120, after: 40 },
        }),
        new d.Paragraph({
          children: [new d.TextRun({ text: r.objetivo, size:18, color:'495057', font:'Calibri', italics:true })],
          spacing: { before: 0, after: 60 },
          indent: { left: 200 },
        }),
      );
    }
  });

  const totalFilters = Object.values(matrizFilters).filter(v => v !== '').length;
  const subtitle = totalFilters > 0
    ? `Exportação filtrada — ${data.length} de ${(getStorage(STORAGE_KEYS.matriz)||[]).length} registros`
    : `Exportação completa — ${data.length} registros`;

  await saveDocx([
    {
      properties: { page: { margin: { top: 800, right: 800, bottom: 800, left: 800 } } },
      children: [
        ...docxHeader('Matriz de Competências Nacional — MCN 2026', subtitle),
        table,
        docxPageBreak(),
        docxSectionTitle('Objetivos de Aprendizagem'),
        ...objParagraphs,
        new d.Paragraph({
          children: [new d.TextRun({ text: `Total de registros: ${data.length}`, bold:true, size:20, color:c.navy, font:'Calibri' })],
          spacing: { before: 400, after: 0 },
        }),
      ],
    }
  ], `ESPEN_Matriz_Competencias_${new Date().toISOString().slice(0,10)}.docx`);

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>'; }
  showToast(`DOCX gerado com ${data.length} competências!`, 'success');
}

// ================================================================
// EXPORT DOCX — AÇÕES EDUCATIVAS
// ================================================================
async function exportAcoesDOCX(btn) {
  if (!getDocx()) { showToast('Biblioteca DOCX ainda carregando, aguarde.', 'warning'); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  let data = getStorage(STORAGE_KEYS.acoes) || [];
  // Aplicar filtros vigentes
  if (acoesFilter.search) {
    const s = acoesFilter.search.toLowerCase();
    data = data.filter(a => (a.nome||'').toLowerCase().includes(s) || (a.codigo||'').toLowerCase().includes(s));
  }
  if (acoesFilter.modalidade) data = data.filter(a => a.modalidade === acoesFilter.modalidade);
  if (acoesFilter.status)    data = data.filter(a => a.status === acoesFilter.status);

  if (data.length === 0) { showToast('Nenhuma ação para exportar.', 'warning'); return; }
  showToast(`Gerando DOCX com ${data.length} ações educativas...`, 'info');

  const children = [
    ...docxHeader(
      'Cadastro Único — Ações Educativas',
      `ESPEN / SENAPPEN  •  ${data.length} ação(ões) educativa(s)`
    ),
  ];

  data.forEach((a, idx) => {
    const dLib = getDocx();
    if (idx > 0) children.push(docxPageBreak());
    const c2 = docxStyles();

    children.push(
      new dLib.Paragraph({
        children: [
          new dLib.TextRun({ text: `${a.codigo || `#${idx+1}`}  `, bold:true, size:28, color:c2.gold, font:'Calibri' }),
          new dLib.TextRun({ text: a.nome || '—', bold:true, size:28, color:c2.navy, font:'Calibri' }),
        ],
        spacing: { before: 0, after: 120 },
        border: { bottom: { style:dLib.BorderStyle.SINGLE, size:8, color:c2.gold } },
      }),
    );

    const eu = acaoEixoUnidadeFromLegacy(a);
    children.push(docxSectionTitle('Contexto'));
    children.push(docxField('Estado', a.estado));
    children.push(docxField('Sigla Estado', a.sigla_estado));
    children.push(docxField('É Trilha?', a.e_trilha));
    children.push(docxField('É Módulo?', a.e_modulo));
    children.push(docxField('Módulos associados', a.modulos_associados));

    children.push(docxSectionTitle('Alinhamento MCN (texto)'));
    children.push(docxField('Competência MCN', a.competencia_mcn));
    children.push(docxField('Eixo funcional MCN', a.eixo_funcional_mcn));
    children.push(docxField('Unidade temática MCN', a.unidade_tematica_mcn));
    children.push(docxField('Conhecimento crítico', ''));
    children.push(docxText(a.conhecimento_critico_mcn));
    children.push(docxField('Objetivo de aprendizagem MCN', ''));
    children.push(docxText(a.objetivo_aprendizagem_mcn));

    children.push(docxSectionTitle('Identificação'));
    children.push(docxField('Código / ID AE',    a.codigo));
    children.push(docxField('Tipo',              a.tipo));
    children.push(docxField('Área Demandante',   a.area_demandante));
    children.push(docxField('Escola Proponente', a.escola_proponente));
    children.push(docxField('Eixo (oferta)',     eu.eixo || a.eixo_tematico));
    children.push(docxField('Unidade (oferta)',  eu.unidade));
    children.push(docxField('Status',            a.status));
    children.push(docxField('Nº de Módulos',     String(a.num_modulos || 1)));

    children.push(docxSectionTitle('Planejamento pedagógico'));
    children.push(docxField('Justificativa da oferta', ''));
    children.push(docxText(a.justificativa_oferta));
    children.push(docxField('Amparo legal', ''));
    children.push(docxText(a.amparo_legal));
    children.push(docxField('Competência (oferta)', ''));
    children.push(docxText(a.competencia_texto));
    children.push(docxField('Objetivos específicos', ''));
    children.push(docxText(a.objetivos_especificos));

    children.push(docxSectionTitle('Detalhamento Pedagógico'));
    children.push(docxField('Objetivo Geral', ''));
    children.push(docxText(a.objetivo_geral));
    children.push(docxField('Ementa', ''));
    children.push(docxText(a.ementa));
    children.push(docxField('Conteúdo Programático', ''));
    children.push(docxText(a.conteudo_programatico));
    children.push(docxField('Metodologia', ''));
    children.push(docxText(a.metodologia));

    children.push(docxSectionTitle('Modalidade, carga e infraestrutura'));
    children.push(docxField('Carga Horária',           `${a.carga_horaria || 0} h/a`));
    children.push(docxField('Modalidade',              a.modalidade));
    children.push(docxField('Duração',                 a.duracao));
    children.push(docxField('Público-Alvo',            a.publico_alvo));
    children.push(docxField('Espaço físico',           a.espaco_fisico));
    children.push(docxField('Plataforma virtual',      a.plataforma_virtual));
    children.push(docxField('Número de Vagas',         String(a.num_vagas || '—')));

    children.push(docxSectionTitle('Recursos'));
    children.push(docxField('Recursos materiais', ''));
    children.push(docxText(a.recursos_materiais));
    children.push(docxField('Recursos tecnológicos', ''));
    children.push(docxText(a.recursos_tecnologicos));
    children.push(docxField('Recursos humanos', ''));
    children.push(docxText(a.recursos_humanos));

    children.push(docxSectionTitle('Avaliação'));
    children.push(docxField('Instrumento — aprendizagem', a.instrumento_avaliacao_aprendizagem || a.instrumento_avaliacao));
    children.push(docxField('Instrumento — reação', a.instrumento_avaliacao_reacao));
    children.push(docxField('Instrumento — transferência', a.instrumento_avaliacao_transferencia));

    children.push(docxSectionTitle('Matrícula e certificação'));
    children.push(docxField('Critérios de matrícula', ''));
    children.push(docxText(a.criterios_matricula));
    children.push(docxField('Frequência Mínima',       `${a.frequencia_minima || '—'}%`));
    children.push(docxField('Critérios de certificação', ''));
    children.push(docxText(a.criterio_certificacao));
    children.push(docxField('Bibliografia', ''));
    children.push(docxText(a.bibliografia));
  });

  await saveDocx([
    {
      properties: { page: { margin: { top: 800, right: 900, bottom: 800, left: 900 } } },
      children,
    }
  ], `ESPEN_Acoes_Educativas_${new Date().toISOString().slice(0,10)}.docx`);

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>'; }
  showToast(`DOCX gerado com ${data.length} ação(ões)!`, 'success');
}

// ================================================================
// EXPORT DOCX — PLANOS DE ENSINO
// ================================================================
async function exportPDIDOCX(btn, opts) {
  opts = opts || {};
  const resetBtn = () => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-word"></i>';
    }
  };
  if (!getDocx()) { showToast('Biblioteca DOCX ainda carregando, aguarde.', 'warning'); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  let pdis = pdiListVisibleForCurrentUser(getStorage(STORAGE_KEYS.pdi) || []);
  const users   = getStorage(STORAGE_KEYS.users)   || [];
  const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
  const acoes   = getStorage(STORAGE_KEYS.acoes)   || [];

  if (opts.pdiId != null && String(opts.pdiId) !== '') {
    const one = pdis.find(p => idEquals(p.id, opts.pdiId));
    if (!one) {
      resetBtn();
      showToast('Plano não encontrado ou você não tem permissão para exportá-lo.', 'warning');
      return;
    }
    pdis = [one];
  }

  if (pdis.length === 0) {
    resetBtn();
    showToast('Nenhum plano de ensino para exportar.', 'warning');
    return;
  }
  showToast(pdis.length === 1 ? 'Gerando DOCX do plano de ensino…' : `Gerando DOCX com ${pdis.length} plano(s) de ensino…`, 'info');

  const d = getDocx();
  const c = docxStyles();

  const headerTitle = pdis.length === 1 ? 'Plano de Ensino' : 'Planos de Ensino';
  const headerSub = pdis.length === 1
    ? 'ESPEN / SENAPPEN · documento único'
    : `ESPEN / SENAPPEN  •  ${pdis.length} plano(s) cadastrado(s)`;

  const children = [
    ...docxHeader(headerTitle, headerSub),
  ];

  pdis.forEach((p, idx) => {
    if (idx > 0) children.push(docxPageBreak());

    const user = users.find(u => idEquals(u.id, p.usuario_id));
    const acao = acoes.find(a => idEquals(a.id, p.acao_id));
    const trilha = trilhas.find(t => idEquals(t.id, p.trilha_id));
    const legado = pdiUsaTrilhaLegado(p);
    const nomeServidor = user ? user.nome : 'Servidor não encontrado';

    // Título do plano
    children.push(
      new d.Paragraph({
        children: [
          new d.TextRun({ text: `Plano #${idx+1}  —  `, bold:true, size:28, color:c.gold, font:'Calibri' }),
          new d.TextRun({ text: nomeServidor, bold:true, size:28, color:c.navy, font:'Calibri' }),
        ],
        spacing: { before: 0, after: 120 },
        border: { bottom: { style:d.BorderStyle.SINGLE, size:8, color:c.gold } },
      }),
    );

    children.push(docxSectionTitle('Dados do Servidor'));
    children.push(docxField('Nome',    user ? user.nome  : '—'));
    children.push(docxField('CPF',     user ? user.cpf   : '—'));
    children.push(docxField('E-mail',  user ? user.email : '—'));
    children.push(docxField('Cargo',   user ? user.cargo : '—'));
    children.push(docxField('Nível de Acesso', user ? user.acesso : '—'));

    children.push(docxSectionTitle('Dados do Plano'));
    if (acao) {
      children.push(docxField('Ação educativa', acao.nome || '—'));
      children.push(docxField('Código',          acao.codigo || '—'));
      children.push(docxField('Modalidade',      acao.modalidade || '—'));
      children.push(docxField('Carga horária',   `${acao.carga_horaria || 0}h`));
    } else if (legado && trilha) {
      children.push(docxField('Trilha (formato antigo)', trilha.nome || '—'));
      children.push(docxField('Nível da Trilha', trilha.nivel || '—'));
      children.push(docxField('Eixo Funcional', trilha.eixo_funcional || '—'));
    } else {
      children.push(docxField('Ação educativa', '—'));
    }
    children.push(docxField('Data de Início',   p.data_inicio ? new Date(p.data_inicio).toLocaleDateString('pt-BR') : '—'));
    children.push(docxField('Data Meta',        p.data_meta   ? new Date(p.data_meta).toLocaleDateString('pt-BR')   : '—'));

    const pb = p.plano_bloco1;
    if (pb && typeof pb === 'object') {
      children.push(docxSectionTitle('Bloco 1 — Identificação da Ação Educativa (questionário)'));
      children.push(docxField('Título da ação educativa', pb.titulo_acao || '—'));
      children.push(docxField('Público-alvo', (pb.publico_alvo || '—') + (pb.publico_alvo === 'Outros' && pb.publico_alvo_outros ? ` — ${pb.publico_alvo_outros}` : '')));
      children.push(docxField('Observações / descrição', pb.observacoes || '—'));
      children.push(docxField('Objetivo geral', pb.objetivo_geral || '—'));
      children.push(docxField('Tipo da ação', (pb.tipo_acao || '—') + (pb.tipo_acao === 'Outra' && pb.tipo_acao_outra ? ` (${pb.tipo_acao_outra})` : '')));
      children.push(docxField('Modalidade (plano)', pb.modalidade || '—'));
      children.push(docxField('Carga horária total (h)', pb.carga_horaria_total != null ? String(pb.carga_horaria_total) : '—'));
      children.push(docxField('Período — início', pb.periodo_inicio ? new Date(pb.periodo_inicio).toLocaleDateString('pt-BR') : '—'));
      children.push(docxField('Período — fim', pb.periodo_fim ? new Date(pb.periodo_fim).toLocaleDateString('pt-BR') : '—'));
      children.push(docxField('Unidade promotora / Escola', pb.unidade_promotora || '—'));
      children.push(docxField('Coordenadores(as) / Instrutores(as) responsáveis pela Ação Educativa', pb.coordenadores_instrutores || '—'));
    }

    const p2 = p.plano_bloco2;
    if (p2 && typeof p2 === 'object') {
      children.push(docxSectionTitle('Bloco 2 — Design de Competências MCN-SPB 2026'));
      children.push(docxField('10. Categoria de Competência', p2.categoria_competencia_mcn || '—'));
      children.push(docxField('11. Subcategoria de Competência', p2.subcategoria_competencia_mcn || '—'));
      children.push(docxField('12. Eixo de Competência', p2.eixo_competencia_mcn || '—'));
      children.push(docxField('13. Unidade Temática', p2.unidade_tematica_mcn || '—'));
      children.push(docxField('14. Conhecimentos Críticos Trabalhados', p2.conhecimento_critico_mcn || '—'));
      children.push(docxField('15. Justificativa', p2.justificativa_design || '—'));
    }

    const p3 = p.plano_bloco3;
    if (p3 && typeof p3 === 'object') {
      children.push(docxSectionTitle('Bloco 3 — Design da Ação Educativa MCN—2026-SPB'));
      children.push(docxField('16. Metodologias e Estratégias de ensino-aprendizagem', ''));
      children.push(docxText(p3.metodologias_estrategias));
      children.push(docxField('17. Recursos humanos, tecnológicos e materiais', ''));
      children.push(docxText(p3.recursos_humanos_tecnologicos_materiais));
      children.push(docxField('18. Avaliação da Aprendizagem e transferência para a prática', ''));
      children.push(docxText(p3.avaliacao_aprendizagem_transferencia));
      children.push(docxField('19. Referências e Curadoria de Conhecimento', ''));
      children.push(docxText(p3.referencias_curadoria));
    }

    if (legado && trilha && (trilha.acoes_vinculadas || []).length > 0) {
      children.push(docxSectionTitle('Ações da trilha (formato legado)'));
      trilha.acoes_vinculadas.forEach((aid, ai) => {
        const a = acoes.find(x => idEquals(x.id, aid));
        if (!a) return;
        children.push(
          new d.Paragraph({
            children: [
              new d.TextRun({ text: `${ai + 1}. ${a.nome}`, size: 20, color: c.dark, font: 'Calibri' }),
              new d.TextRun({ text: `  (${a.modalidade || '—'} • ${a.carga_horaria || 0}h)`, size: 18, color: c.gray3, italics: true, font: 'Calibri' }),
            ],
            spacing: { before: 80, after: 80 },
            indent: { left: 200 },
          }),
        );
      });
      const totalHoras = trilha.acoes_vinculadas.reduce((sum, aid) => {
        const a = acoes.find(x => idEquals(x.id, aid)); return sum + (a ? (a.carga_horaria || 0) : 0);
      }, 0);
      children.push(docxDivider());
      children.push(
        new d.Paragraph({
          children: [
            new d.TextRun({ text: `Carga horária total (trilha): `, bold: true, size: 20, color: c.navy, font: 'Calibri' }),
            new d.TextRun({ text: `${totalHoras}h`, size: 20, color: c.dark, font: 'Calibri' }),
          ],
          spacing: { before: 80, after: 40 },
        }),
      );
    }
  });

  await saveDocx([
    {
      properties: { page: { margin: { top: 800, right: 900, bottom: 800, left: 900 } } },
      children,
    }
  ], pdis.length === 1
    ? `ESPEN_plano_ensino_${new Date().toISOString().slice(0, 10)}.docx`
    : `ESPEN_PLANO_ENSINO_${new Date().toISOString().slice(0, 10)}.docx`);

  resetBtn();
  showToast(pdis.length === 1 ? 'DOCX do plano gerado!' : `DOCX gerado com ${pdis.length} plano(s) de ensino!`, 'success');
}


// ================================================================
// EXPOSIÇÃO PARA INLINE HANDLERS DO HTML
// ================================================================
//
// Templates renderizam `onclick="navigate('matriz')"` em escopo de documento.
// Como ES modules não vazam para `window`, ligamos as funções aqui no fim.
// O bridge das *variáveis de estado* mutáveis (matrizPage, matrizFilters, etc.)
// fica em `core/state.js`, populado quando aquele módulo é carregado.

Object.assign(globalThis, {
  // Constantes consumidas em onclick (ex.: importExcelData(STORAGE_KEYS.matriz))
  STORAGE_KEYS,
  // Navegação / chrome
  navigate, closeSidebar, toggleSidebar, openModal, closeModal, closeModalBtn,
  // Auth (re-expõe imports para inline handlers)
  doLogin, doRegister, doLogout, showForgotPassword, switchAuthTab,
  validateRegisterCPF, maskCPF,
  // Exports DOCX (vão pra src/exports/ na Fase C)
  exportMatrizDOCX,
  exportAcoesDOCX,
  exportPDIDOCX,
  // Manutenção
  importExcelData,
  // Bootstrap helpers (consumidos pelo `main.js`)
  updateSidebarUser,
});
