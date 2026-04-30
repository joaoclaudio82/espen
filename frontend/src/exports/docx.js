/**
 * Geração de documentos DOCX — exports da Matriz, Ações Educativas e Plano
 * de Ensino (com e sem template institucional).
 *
 * As libs UMD (`docx`, `pizzip`, `file-saver`) são carregadas em main.js e
 * acessadas via `window.docx` / `window.PizZip` / `window.saveAs` para
 * preservar o caminho de uso original.
 */
import { STORAGE_KEYS, getStorage } from '../api/storage.js';
import { getCurrentUser } from '../auth/session.js';
import { matrizFilters } from '../core/state.js';
import { acaoEixoUnidadeFromLegacy } from '../shared/acoes-utils.js';
import { fmtAE, idEquals } from '../shared/format.js';
import { isMatrizRegistroArquivado } from '../shared/matriz-utils.js';
import { pdiUsaTrilhaLegado } from '../shared/pdi-utils.js';
import { showToast } from '../shared/toast.js';

import { getFilteredMatriz } from '../pages/matriz.js';

//  resolvido via getCurrentUser() — sem ler globalThis no nível de módulo.
const currentUser = new Proxy({}, { get: (_, k) => { const u = getCurrentUser(); return u ? u[k] : undefined; } });

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


Object.assign(globalThis, {
  exportMatrizDOCX,
  exportAcoesDOCX,
  exportPDIDOCX,
  // window.exportPlanoEnsinoFromTemplate já é `window.X = …` dentro do módulo.
});
