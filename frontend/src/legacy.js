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
  // Manutenção
  importExcelData,
  // Bootstrap helpers (consumidos pelo `main.js`)
  updateSidebarUser,
});
