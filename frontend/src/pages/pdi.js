/**
 * Página "Planos de Ensino" — wizard com 3 blocos (identificação, design MCN,
 * design da ação) por ação educativa. Edições não-admin via fila.
 *
 * Funções `pdiUsaTrilhaLegado` e `pdiNormalizePersistido` ficam em
 * `shared/pdi-utils.js` porque também são usadas pela moderação.
 */
import { STORAGE_KEYS, getStorage, setStorage } from '../api/storage.js';
import { isAdminUser, isGestorUser, isSomenteLeitura, usaFilaModeracao } from '../auth/roles.js';
import { getCurrentUser } from '../auth/session.js';
import { closeModalBtn, openModal } from '../router.js';
import { escapeHtmlStr } from '../shared/escape.js';
import { genId, idEquals } from '../shared/format.js';
import { pushFilaModeracao } from '../shared/moderacao.js';
import { pdiNormalizePersistido, pdiUsaTrilhaLegado } from '../shared/pdi-utils.js';
import { showToast } from '../shared/toast.js';

const currentUserProxy = () => getCurrentUser();


const PDI_B1_PUBLICO_OPTS = [
  'Policial Penal (Estadual / Federal)',
  'Especialista Federal em Assistência à Execução Penal',
  'Técnico Federal de Apoio à Execução Penal',
  'Outros',
];
const PDI_B1_TIPO_OPTS = [
  'Curso',
  'Treinamento em Serviço',
  'Oficina',
  'Workshop',
  'Evento',
  'Palestra',
  'Outra',
];
const PDI_B1_MODALIDADE_OPTS = ['Presencial', 'Híbrida', 'A Distância', 'Autoinstrucional'];

const PDI_B2_CATEGORIA_OPTS = ['Geral', 'Especialista'];
const PDI_B2_SUBCATEGORIA_OPTS = [
  'Técnica/ Tecnológica',
  'Sociojurídica e Direitos Fundamentais',
  'Socioemocional/ Comportamental',
];
const PDI_B2_EIXO_OPTS = [
  'Policiamento Penal',
  'Operação e Controle de Unidades Prisionais',
  'Gestão dos Serviços Penais',
  'Governança do Sistema Penal',
  'Neoaprendizagem e Neoprofessor dos Serviços Penais',
];
const PDI_B2_UNIDADE_TEMATICA_OPTS = [
  'Ações Educativas para as PPL',
  'Alternativas Penais',
  'Aprendizagem Expansiva e Adaptativa',
  'Compras e Suprimentos',
  'Comunicação, Colaboração e Gestão de Conflitos',
  'Documentação e Normas Técnicas',
  'Escolta de Pessoas Privadas de Liberdade',
  'Funcionamento das Unidades Prisionais',
  'Gerenciamento Prisional',
  'Gestão de dados, informações e conhecimentos',
  'Gestão de Pessoas',
  'Gestão de Processos',
  'Gestão de Projetos',
  'Gestão e Planejamento de Ensino e Aprendizagem',
  'Governança Multinível',
  'Inteligência, Contrainteligência e Segurança da Informação',
  'Neoaprendizagem',
  'Ouvidoria e Corregedoria',
  'Política Penal',
  'Práticas Socioemocionais e Comportamentais',
  'Recaptura de Pessoas Privadas de Liberdade',
  'Saúde e Prevenção',
  'Segurança orgânica',
];
const PDI_B2_CONHECIMENTOS_OPTS_A = ["Acesso ao Lazer e Cultura","Ações de Contrainteligência","Alinhamento Institucional e Gestão por Competências","Análise de dados estatísticos","Análise de Riscos e oportunidades","Análise de Viabilidade Econômica de Projetos","Análise de Viabilidade Técnica de Projetos","Análise Situacional e Policiamento Penal Preventivo","Aprendizagem Colaborativa","Arquivamento de documentos","Articulação com Órgãos e Entidades","Atendimento ao Público Interno e/ou Externo","Atendimento Especializado","Atividade correcional","Atuação em Eventos Críticos","Avaliação de Compras e Contratações","Avaliação de Desempenho no Trabalho","Avaliação de Reabilitação","Avaliação e Revisão de Processos","Avaliação Multinível e Bidirecional","Busca Pessoal em Pessoas Privadas de Liberdade","Busca Pessoal em Visitantes","Cadastro em banco de dados","Classificação de PPL","Coleta de Material Genético","Coleta e Análise de Dados para Conhecimento Estratégico","Complexidade do Sistema Penal","Compliance, LGPD e Governança Ética dos Dados","Comunicação Digital Estratégica","Comunicação Institucional e Governança da Informação","Condução de Cães Policiais","Condução tática","Coordenação em Rede","Cumprimento dos fluxos e procedimentos","Custódia","Dados de Inteligência e Contrainteligência","Delegação de Tarefas","Demandas Jurídicas e suas priorizações","Diretrizes do Sistema Penal","Disciplina e segurança das penitenciárias","Distribuição de Pessoal","Domínio da Neoaprendizagem e Maturidade Docente","Educação financeira","Elaboração de normas","Elaboração de Plano de Ensino","Elaboração de Processo de Compra","Elaboração de Programas e Projetos","Escolta de Pessoas Privadas de Liberdade","Estrutura física e tecnológica das unidades prisionais","Ética Correcional e Compliance Público","Ética Profissional","Exame de certificação","Execução de ações educativas","Execução de alternativas penais","Execução de Normas, Rotinas e Procedimentos do Sistema Prisional","Execução do monitoramento eletrônico","Financiamento das Políticas Penais","Fiscalização de Contratos","Fiscalização de Tráfego","Flexibilidade","Força Cooperação Penitenciária","Fundamentos da Inteligência Penitenciária","Fundamentos de Cibersegurança para a Função Pública","Gestão Acadêmica","Gestão de Mudanças","Gestão do Conhecimento Organizacional","Gestão do Tempo","Gestão Pública Sustentável","Governança Algorítmica e Ética Digital","Governança da Aprendizagem Organizacional","Governança do Conhecimento no Sistema Penal","Governança do Desempenho Multinível","Identificação e Compartilhamento de Conhecimento e Informação","Identificação e Organização de dados, informações e conhecimentos"];
const PDI_B2_CONHECIMENTOS_OPTS_B = ["Infraestrutura física","Inovação, Adhocracia e Resolução de Crises","Inspeção de Serviços e produtos adquiridos","Instrumentos de Parcerias","Inteligência Emocional","Justiça Racial, Inclusão e Diversidade","Levantamento de Necessidade de Recursos","Libras","Liderança e Visão Sistêmica","Liderança Pública","Linguagem Verbal e não verbal","Manuseio de Armamento","Mediação de Conflitos","Metodologias Ativas, Ágeis e Andragogia","Monitoramento e Atualização de dados, informações e conhecimentos","Monitorar e Avaliar Programas e Projetos","Movimentação de Pessoas Privadas de Liberdade","Movimentação dos Materiais de Entrega","Negociação","Netweaving","Normas jurídicas e as estruturas institucionais da Política Penal","Normas Técnicas","Operação de drones","Operações de Recaptura de Pessoas Privadas de Liberdade","Pensamento Analítico","Pensamento Computacional","Pensamento Criativo","Pensamento Lógico","Pensamento Matemático","Pensamento Resolutivo","Pensamento Sintético","Pensamento Sistêmico","Pesquisa","Planejamento de Ações Educativas","Planejamento de Atividades de Inteligência","Planejamento de Compras","Planejamento de Escolta de Pessoas Privadas de Liberdade","Planejamento de Processos","Planejamento de Recaptura de Pessoas Privadas de Liberdade","Planejamento Estratégico do Sistema Penal","Política Penal","Prevenção e Enfrentamento ao Assédio","Primeiros Socorros","Proatividade","Procedimentos de Segurança das unidades prisionais","Processos Colaborativos","Reconhecimento de Responsabilidades","Reconhecimento e motivação","Redação Oficial","Registro de Transgressões Disciplinares e de Crimes","Reintegração Social","Relacionamento Interpessoal","Relatórios","Representação institucional","Reputação Digital e Responsabilidade Social nas Redes","Resiliência","Revista em Infraestrutura Prisional","Saúde e Segurança no trabalho","Segurança cidadã","Segurança de Visitantes","Segurança orgânica","Segurança Psicológica no Trabalho","Soluções Transdisciplinares e Intraempreendedorismo","Supervisão de Atividades","Tecnologias de Monitoramento","Tecnologias Digitais e Inteligência Artificial","Tiro de precisão","Trabalho em Equipe","Tramitar Documentos","Triagem","Uso de Equipamentos e Tecnologias de Segurança","Variações de alternativas Penais","Variações Históricas do Sistema Penal"];
const PDI_B2_CONHECIMENTOS_OPTS = PDI_B2_CONHECIMENTOS_OPTS_A.concat(PDI_B2_CONHECIMENTOS_OPTS_B);

export function pdiListVisibleForCurrentUser(pdis) {
  if (!currentUser) return [];
  /** Qualquer perfil logado consulta todos os planos; edição/exclusão ficam só na UI para quem pode alterar. */
  return pdis || [];
}

function pdiMapModalidadeAcaoParaBloco1(mod) {
  const m = String(mod || '').trim();
  if (m === 'Presencial') return 'Presencial';
  if (m === 'EaD') return 'A Distância';
  if (m === 'Híbrido') return 'Híbrida';
  if (m === 'Semipresencial') return 'Híbrida';
  return '';
}

function pdiMapTipoAcaoParaBloco1(tipo) {
  const x = String(tipo || '').trim();
  if (PDI_B1_TIPO_OPTS.includes(x) && x !== 'Outra') return { tipo: x, outra: '' };
  if (x === 'Seminário') return { tipo: 'Evento', outra: '' };
  if (['Módulo', 'Disciplina'].includes(x)) return { tipo: 'Outra', outra: x };
  if (x) return { tipo: 'Outra', outra: x };
  return { tipo: '', outra: '' };
}

/** Valida YYYY-MM-DD (input type=date); retorna timestamp UTC do dia ou null. */
function pdiParseDateOnly(s) {
  const t = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, mo, d] = t.split('-').map(Number);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.getTime();
}

window.pdiOnPeriodoDateChange = function(which) {
  const ini = document.getElementById('pb1-periodo-inicio');
  const fim = document.getElementById('pb1-periodo-fim');
  if (!ini || !fim) return;
  if (ini.value && fim.value && ini.value > fim.value) {
    if (which === 'inicio') fim.value = ini.value;
    else ini.value = fim.value;
  }
  if (ini.value) fim.setAttribute('min', ini.value);
  else fim.removeAttribute('min');
  if (fim.value) ini.setAttribute('max', fim.value);
  else ini.removeAttribute('max');
};

function pdiMatchPublicoAlvoBloco1(publicoAlvoText) {
  const pa = String(publicoAlvoText || '').toLowerCase();
  if (pa.includes('policial penal')) return { v: 'Policial Penal (Estadual / Federal)', outros: '' };
  if (pa.includes('especialista federal')) return { v: 'Especialista Federal em Assistência à Execução Penal', outros: '' };
  if (pa.includes('técnico federal') || pa.includes('tecnico federal')) return { v: 'Técnico Federal de Apoio à Execução Penal', outros: '' };
  if (pa.trim()) return { v: 'Outros', outros: String(publicoAlvoText || '').trim() };
  return { v: '', outros: '' };
}

function pdiPrefillBloco1FromAcao(a) {
  if (!a) {
    return {
      titulo_acao: '', publico_alvo: '', publico_alvo_outros: '', observacoes: '', objetivo_geral: '',
      tipo_acao: '', tipo_acao_outra: '', modalidade: '', carga_horaria_total: '', periodo_inicio: '', periodo_fim: '', unidade_promotora: '',
      coordenadores_instrutores: '',
    };
  }
  const pub = pdiMatchPublicoAlvoBloco1(a.publico_alvo);
  const tipoM = pdiMapTipoAcaoParaBloco1(a.tipo);
  const parts = [a.ementa, a.justificativa_oferta].filter(Boolean);
  const esc = [a.escola_proponente, a.area_demandante].filter(Boolean).join(' — ');
  return {
    titulo_acao: String(a.nome || '').trim(),
    publico_alvo: pub.v,
    publico_alvo_outros: pub.outros,
    observacoes: parts.join('\n\n').trim(),
    objetivo_geral: String(a.objetivo_geral || '').trim(),
    tipo_acao: tipoM.tipo,
    tipo_acao_outra: tipoM.outra,
    modalidade: pdiMapModalidadeAcaoParaBloco1(a.modalidade),
    carga_horaria_total: a.carga_horaria != null && a.carga_horaria !== '' ? String(Number(a.carga_horaria)) : '',
    periodo_inicio: '',
    periodo_fim: '',
    unidade_promotora: esc || 'ESPEN',
    coordenadores_instrutores: String(a.recursos_humanos || '').trim(),
  };
}

function pdiMergeBloco1(stored, acao) {
  const base = pdiPrefillBloco1FromAcao(acao);
  const s = stored && typeof stored === 'object' ? stored : {};
  return { ...base, ...s };
}

function pdiOptionsHtml(opts, selected) {
  return opts.map(o => `<option value="${escapeHtmlStr(o)}" ${o === selected ? 'selected' : ''}>${escapeHtmlStr(o)}</option>`).join('');
}

function pdiBuildBloco1FormHtml(b1) {
  const b = b1 || {};
  const showPubOut = b.publico_alvo === 'Outros';
  const showTipoOut = b.tipo_acao === 'Outra';
  return `
    <input type="hidden" id="pdi-w-acao-id" value="">
    <input type="hidden" id="pdi-w-edit-id" value="">
    <div class="form-section" style="margin-top:0;">
      <div class="pdi-b1-block-title">BLOCO 1 - Identificação da Ação Educativa</div>
      <p class="text-muted" style="font-size:12px;margin:-8px 0 18px;line-height:1.45;">Campos podem vir pré-preenchidos a partir da ação educativa selecionada; ajuste conforme o plano de execução.</p>
      <div class="form-grid">
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">1.</span> Título da Ação Educativa: *</label>
          <input type="text" id="pb1-titulo" value="${escapeHtmlStr(b.titulo_acao || '')}" placeholder="Título da ação educativa">
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">2.</span> Público Alvo <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb1-publico-alvo" onchange="document.getElementById('pb1-wrap-publico-outros').style.display=this.value==='Outros'?'block':'none'">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B1_PUBLICO_OPTS, b.publico_alvo || '')}
          </select>
          <div id="pb1-wrap-publico-outros" style="display:${showPubOut ? 'block' : 'none'};margin-top:10px;">
            <label style="font-size:12px;">Outros — especificar</label>
            <input type="text" id="pb1-publico-outros" value="${escapeHtmlStr(b.publico_alvo_outros || '')}" placeholder="Descreva quando marcar &quot;Outros&quot;">
          </div>
        </div>
        <div class="form-group form-full">
          <label>Observações/descrição:</label>
          <textarea id="pb1-observacoes" rows="3" placeholder="Observações ou descrição complementar">${escapeHtmlStr(b.observacoes || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">3.</span> Objetivo Geral da Ação Educativa *</label>
          <p class="pdi-b1-hint">(Declare o propósito central da ação, com foco no desenvolvimento de competências e impacto institucional.)</p>
          <textarea id="pb1-objetivo-geral" rows="4" placeholder="Objetivo geral da ação educativa">${escapeHtmlStr(b.objetivo_geral || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">4.</span> Tipo da Ação Educativa <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb1-tipo-acao" onchange="document.getElementById('pb1-wrap-tipo-outra').style.display=this.value==='Outra'?'block':'none'">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B1_TIPO_OPTS, b.tipo_acao || '')}
          </select>
          <div id="pb1-wrap-tipo-outra" style="display:${showTipoOut ? 'block' : 'none'};margin-top:10px;">
            <label style="font-size:12px;">Outra — especificar</label>
            <input type="text" id="pb1-tipo-outra" value="${escapeHtmlStr(b.tipo_acao_outra || '')}" placeholder="Descreva quando marcar &quot;Outra&quot;">
          </div>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">5.</span> Modalidade da Ação Educativa <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb1-modalidade">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B1_MODALIDADE_OPTS, b.modalidade || '')}
          </select>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">6.</span> Carga Horária Total (hs) da Ação Educativa: *</label>
          <input type="number" id="pb1-ch-total" min="0" step="1" value="${escapeHtmlStr(b.carga_horaria_total != null ? String(b.carga_horaria_total) : '')}" placeholder="0">
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">7.</span> Período de Realização da Ação Educativa *</label>
          <p class="pdi-b1-hint" style="margin-top:4px;">A data de início não pode ser posterior à data de fim.</p>
          <div class="form-grid" style="margin-top:8px;">
            <div class="form-group">
              <label style="font-size:12px;font-weight:600;">Início <span style="color:var(--gray-500);font-weight:500;">(dia/mês/ano)</span> *</label>
              <input type="date" id="pb1-periodo-inicio" value="${escapeHtmlStr(b.periodo_inicio || '')}" onchange="pdiOnPeriodoDateChange('inicio')">
            </div>
            <div class="form-group">
              <label style="font-size:12px;font-weight:600;">Fim <span style="color:var(--gray-500);font-weight:500;">(dia/mês/ano)</span> *</label>
              <input type="date" id="pb1-periodo-fim" value="${escapeHtmlStr(b.periodo_fim || '')}" onchange="pdiOnPeriodoDateChange('fim')">
            </div>
          </div>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">8.</span> Unidade Promotora / Escola do Sistema Penal:</label>
          <input type="text" id="pb1-unidade-promotora" value="${escapeHtmlStr(b.unidade_promotora || '')}" placeholder="Unidade promotora ou escola do sistema penal">
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">9.</span> Coordenadores(as) / Instrutores(as) responsáveis pela Ação Educativa:</label>
          <textarea id="pb1-coordenadores" rows="3" placeholder="Nomes e papéis (coordenação, instrução, etc.)">${escapeHtmlStr(b.coordenadores_instrutores || '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function pdiCollectBloco1FromForm() {
  const get = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  };
  return {
    titulo_acao: get('pb1-titulo'),
    publico_alvo: get('pb1-publico-alvo'),
    publico_alvo_outros: get('pb1-publico-outros'),
    observacoes: get('pb1-observacoes'),
    objetivo_geral: get('pb1-objetivo-geral'),
    tipo_acao: get('pb1-tipo-acao'),
    tipo_acao_outra: get('pb1-tipo-outra'),
    modalidade: get('pb1-modalidade'),
    carga_horaria_total: get('pb1-ch-total'),
    periodo_inicio: get('pb1-periodo-inicio'),
    periodo_fim: get('pb1-periodo-fim'),
    unidade_promotora: get('pb1-unidade-promotora'),
    coordenadores_instrutores: get('pb1-coordenadores'),
  };
}

function pdiPrefillBloco2FromAcaoMatriz(acao) {
  const empty = {
    categoria_competencia_mcn: '',
    subcategoria_competencia_mcn: '',
    eixo_competencia_mcn: '',
    unidade_tematica_mcn: '',
    conhecimento_critico_mcn: '',
    justificativa_design: '',
  };
  if (!acao) return empty;
  const just = String(acao.justificativa_oferta || '').trim();
  const matriz = getStorage(STORAGE_KEYS.matriz) || [];
  const ids = acao.competencias_vinculadas || [];
  const row = matriz.find(m => ids.some(cid => idEquals(m.id, cid)));
  if (!row) return { ...empty, justificativa_design: just };
  const pick = (val, opts) => {
    const v = String(val || '').trim();
    if (!v) return '';
    if (opts.includes(v)) return v;
    const low = v.toLowerCase();
    return opts.find(o => o.toLowerCase() === low) || '';
  };
  let eixo = pick(row.eixo, PDI_B2_EIXO_OPTS);
  if (!eixo && row.eixo) {
    const ex = String(row.eixo).toLowerCase();
    if (ex.includes('neoprofessor')) eixo = 'Neoaprendizagem e Neoprofessor dos Serviços Penais';
  }
  let unidade = pick(row.unidade, PDI_B2_UNIDADE_TEMATICA_OPTS);
  if (!unidade && row.unidade) {
    const mapU = { 'educação e cultura para as ppl': 'Ações Educativas para as PPL', 'gestão de dados, informações e conhecimentos': 'Gestão de dados, informações e conhecimentos' };
    const k = String(row.unidade).toLowerCase();
    if (mapU[k]) unidade = mapU[k];
  }
  const conh = pick(row.conhecimento, PDI_B2_CONHECIMENTOS_OPTS);
  return {
    categoria_competencia_mcn: pick(row.categoria, PDI_B2_CATEGORIA_OPTS) || (row.categoria ? String(row.categoria).trim() : ''),
    subcategoria_competencia_mcn: pick(row.subcategoria, PDI_B2_SUBCATEGORIA_OPTS) || (row.subcategoria ? String(row.subcategoria).trim() : ''),
    eixo_competencia_mcn: eixo,
    unidade_tematica_mcn: unidade,
    conhecimento_critico_mcn: conh,
    justificativa_design: just,
  };
}

function pdiMergeBloco2(stored, acao) {
  const base = pdiPrefillBloco2FromAcaoMatriz(acao);
  const s = stored && typeof stored === 'object' ? stored : {};
  return { ...base, ...s };
}

function pdiBuildBloco2FormHtml(b2) {
  const b = b2 || {};
  return `
    <div class="form-section" style="margin-top:8px;padding-top:20px;border-top:1px solid var(--gray-200);">
      <div class="pdi-b1-block-title">BLOCO 2 - Design de Competências MCN-SPB 2026</div>
      <p class="text-muted" style="font-size:12px;margin:-8px 0 16px;line-height:1.5;">Orienta o alinhamento da ação à Matriz Curricular Nacional.</p>
      <div class="form-grid">
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">10.</span> Categoria de Competência <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb2-categoria">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B2_CATEGORIA_OPTS, b.categoria_competencia_mcn || '')}
          </select>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">11.</span> Subcategoria de Competência <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb2-subcategoria">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B2_SUBCATEGORIA_OPTS, b.subcategoria_competencia_mcn || '')}
          </select>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">12.</span> Eixo de Competência <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb2-eixo">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B2_EIXO_OPTS, b.eixo_competencia_mcn || '')}
          </select>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">13.</span> Unidade Temática <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb2-unidade-tematica" style="max-width:100%;">
            <option value="">Selecione…</option>
            ${pdiOptionsHtml(PDI_B2_UNIDADE_TEMATICA_OPTS, b.unidade_tematica_mcn || '')}
          </select>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">14.</span> Conhecimentos Críticos Trabalhados: <span style="font-weight:500;color:var(--gray-600);"></span> *</label>
          <select id="pb2-conhecimento-critico" style="max-width:100%;">
            <option value="">Selecione…</option>
            ${PDI_B2_CONHECIMENTOS_OPTS.map(o => `<option value="${escapeHtmlStr(o)}" ${o === (b.conhecimento_critico_mcn || '') ? 'selected' : ''}>${escapeHtmlStr(o)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">15.</span> Justificativa *</label>
          <p class="pdi-b1-hint">(Descreva a relevância da ação educativa à luz do serviço penal, das lacunas de competência identificadas e da valorização profissional. Conecte a proposta com desafios reais, riscos institucionais, demandas éticas, operacionais ou formativas.)</p>
          <textarea id="pb2-justificativa" rows="5" placeholder="Justificativa alinhada à MCN">${escapeHtmlStr(b.justificativa_design || '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function pdiCollectBloco2FromForm() {
  const get = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  };
  return {
    categoria_competencia_mcn: get('pb2-categoria'),
    subcategoria_competencia_mcn: get('pb2-subcategoria'),
    eixo_competencia_mcn: get('pb2-eixo'),
    unidade_tematica_mcn: get('pb2-unidade-tematica'),
    conhecimento_critico_mcn: get('pb2-conhecimento-critico'),
    justificativa_design: get('pb2-justificativa'),
  };
}

function pdiPrefillBloco3FromAcao(a) {
  const empty = {
    metodologias_estrategias: '',
    recursos_humanos_tecnologicos_materiais: '',
    avaliacao_aprendizagem_transferencia: '',
    referencias_curadoria: '',
  };
  if (!a) return empty;
  const recParts = [
    a.recursos_humanos && `Recursos humanos:\n${a.recursos_humanos}`,
    a.recursos_tecnologicos && `Recursos tecnológicos:\n${a.recursos_tecnologicos}`,
    a.recursos_materiais && `Recursos materiais:\n${a.recursos_materiais}`,
    a.espaco_fisico && `Espaço físico:\n${a.espaco_fisico}`,
    a.plataforma_virtual && `Plataforma virtual:\n${a.plataforma_virtual}`,
  ].filter(Boolean);
  let avalParts = [
    a.instrumento_avaliacao_aprendizagem && `Aprendizagem:\n${a.instrumento_avaliacao_aprendizagem}`,
    a.instrumento_avaliacao_reacao && `Reação:\n${a.instrumento_avaliacao_reacao}`,
    a.instrumento_avaliacao_transferencia && `Transferência para a prática:\n${a.instrumento_avaliacao_transferencia}`,
  ].filter(Boolean);
  if (!avalParts.length && a.instrumento_avaliacao) avalParts = [`Instrumento(s) de avaliação:\n${a.instrumento_avaliacao}`];
  const refParts = [a.bibliografia, a.conteudo_programatico].filter(Boolean);
  return {
    metodologias_estrategias: String(a.metodologia || '').trim(),
    recursos_humanos_tecnologicos_materiais: recParts.join('\n\n').trim(),
    avaliacao_aprendizagem_transferencia: avalParts.join('\n\n').trim(),
    referencias_curadoria: refParts.join('\n\n---\n\n').trim(),
  };
}

function pdiMergeBloco3(stored, acao) {
  const base = pdiPrefillBloco3FromAcao(acao);
  const s = stored && typeof stored === 'object' ? stored : {};
  return { ...base, ...s };
}

function pdiBuildBloco3FormHtml(b3) {
  const b = b3 || {};
  return `
    <div class="form-section" style="margin-top:8px;padding-top:20px;border-top:1px solid var(--gray-200);">
      <div class="pdi-b1-block-title">BLOCO 3 - Design da Ação Educativa MCN--2026-SPB</div>
      <p class="text-muted" style="font-size:12px;margin:-8px 0 16px;line-height:1.5;">Complete os campos conforme o desenho pedagógico da ação e o cadastro único da ação educativa, quando útil.</p>
      <div class="form-grid">
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">16.</span> Metodologias e Estratégias de ensino-aprendizagem *</label>
          <textarea id="pb3-metodologias" rows="4" placeholder="Metodologias ativas, estratégias, sequência didática, etc.">${escapeHtmlStr(b.metodologias_estrategias || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">17.</span> Recursos humanos, tecnológicos e materiais *</label>
          <textarea id="pb3-recursos" rows="4" placeholder="Equipe, plataformas, materiais de apoio, infraestrutura…">${escapeHtmlStr(b.recursos_humanos_tecnologicos_materiais || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">18.</span> Avaliação da Aprendizagem e transferência para a prática *</label>
          <textarea id="pb3-avaliacao" rows="4" placeholder="Instrumentos, critérios, momentos avaliativos, transferência para o trabalho…">${escapeHtmlStr(b.avaliacao_aprendizagem_transferencia || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label><span class="pdi-b1-n">19.</span> Referências e Curadoria de Conhecimento *</label>
          <textarea id="pb3-referencias" rows="4" placeholder="Bibliografia, normas, links curados, bases de dados…">${escapeHtmlStr(b.referencias_curadoria || '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function pdiCollectBloco3FromForm() {
  const get = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  };
  return {
    metodologias_estrategias: get('pb3-metodologias'),
    recursos_humanos_tecnologicos_materiais: get('pb3-recursos'),
    avaliacao_aprendizagem_transferencia: get('pb3-avaliacao'),
    referencias_curadoria: get('pb3-referencias'),
  };
}

function renderPDI() {
  const podeAlterar = !isSomenteLeitura();
  document.getElementById('topbar-actions').innerHTML = `
    ${podeAlterar ? `<button class="btn btn-gold btn-sm" onclick="openPDIForm()"><i class="fas fa-plus"></i> <span class="btn-label">Novo Plano</span></button>` : ''}
  `;

  const pdisAll = getStorage(STORAGE_KEYS.pdi) || [];
  const pdis = pdiListVisibleForCurrentUser(pdisAll);
  const users = getStorage(STORAGE_KEYS.users) || [];
  const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];

  const pdiSubEscopo = isAdminUser()
    ? 'Todos os servidores'
    : (isGestorUser()
      ? 'Todos os planos do sistema — alterações passam pela aba Aprovações'
      : 'Todos os planos do sistema (somente leitura)');
  let html = `
    <div class="section-header">
      <div>
        <div class="section-title">Planos de Ensino</div>
        <div class="section-sub">${pdiSubEscopo}</div>
      </div>
    </div>
  `;

  if (pdis.length === 0) {
    const emptyP = podeAlterar
      ? `Escolha uma ação educativa e responda aos Blocos 1, 2 e 3 do questionário. O servidor vinculado ao plano é sempre você (${currentUser ? escapeHtmlStr(currentUser.nome) : 'usuário logado'}).`
      : 'Não há planos cadastrados. Quando existirem, eles aparecerão aqui para consulta.';
    html += `<div class="empty-state" style="margin-top:60px;">
      <i class="fas fa-clipboard-list"></i>
      <h3>Nenhum plano de ensino cadastrado</h3>
      <p>${emptyP}</p>
      ${podeAlterar ? `<button class="btn btn-primary" onclick="openPDIForm()"><i class="fas fa-plus"></i> Criar plano</button>` : ''}
    </div>`;
  } else {
    html += `<div style="display:grid;gap:16px;">`;
    pdis.forEach(p => {
      const trilha = trilhas.find(t => idEquals(t.id, p.trilha_id));
      const acao = acoes.find(a => idEquals(a.id, p.acao_id));
      const legado = pdiUsaTrilhaLegado(p);
      const pb1 = p.plano_bloco1 && typeof p.plano_bloco1 === 'object' ? p.plano_bloco1 : {};
      const tituloBloco1 = String(pb1.titulo_acao || '').trim();
      const nomeAeFallback = acao
        ? String(acao.nome || '—').trim()
        : (legado && trilha ? String(trilha.nome || '—').trim() : '—');
      /** Título exibido no card: reflete o Bloco 1 salvo no plano (ex.: após aprovação de edição do gestor), não só o nome da ação no cadastro. */
      const nomeAe = tituloBloco1 || nomeAeFallback;
      const modalidade = (pb1.modalidade && String(pb1.modalidade).trim())
        || (acao && acao.modalidade && String(acao.modalidade).trim())
        || '—';
      const rawIni = pb1.periodo_inicio || p.data_inicio || '';
      const rawFim = pb1.periodo_fim || p.data_meta || '';
      const fmtD = (raw) => {
        if (!raw) return '—';
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
      };
      const dIni = fmtD(rawIni);
      const dFim = fmtD(rawFim);
      const tituloCard = `Plano de ensino - ${nomeAe}`;
      const autorUser = users.find(u => idEquals(u.id, p.usuario_id));
      const linhaAutor = `<div style="font-size:13px;color:var(--gray-600);margin-top:8px;"><span style="font-weight:600;color:var(--gray-500);">Autor</span> ${escapeHtmlStr(autorUser ? (autorUser.nome || '—') : 'Usuário não encontrado')}</div>`;
      const idJson = JSON.stringify(String(p.id));
      html += `
        <div class="card">
          <div class="card-header" style="align-items:flex-start;">
            <div style="font-size:16px;font-weight:700;color:var(--navy);line-height:1.35;flex:1;min-width:0;padding-right:12px;">${escapeHtmlStr(tituloCard)}</div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <button type="button" class="btn btn-secondary btn-sm" onclick='exportPlanoEnsinoFromTemplate(this, { pdiId: ${idJson} })' title="Baixar plano (.docx) com o modelo institucional" style="color:#2b579a;"><i class="fas fa-file-word"></i></button>
              ${podeAlterar ? `<button type="button" class="btn btn-secondary btn-sm" onclick="editPDI('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
              <button type="button" class="btn btn-danger btn-sm" onclick="deletePDI('${p.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
            </div>
          </div>
          <div class="card-body" style="padding-top:4px;">
            ${linhaAutor}
            <div style="font-size:14px;color:var(--gray-700);margin-top:10px;"><span style="color:var(--gray-500);font-weight:600;">Modalidade</span> ${escapeHtmlStr(modalidade)}</div>
            <div style="font-size:14px;color:var(--gray-700);margin-top:8px;"><span style="color:var(--gray-500);font-weight:600;">Início</span> ${escapeHtmlStr(dIni)} <span style="color:var(--gray-400);margin:0 6px;">·</span> <span style="color:var(--gray-500);font-weight:600;">Fim</span> ${escapeHtmlStr(dFim)}</div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  document.getElementById('page-content').innerHTML = html;
}

function openPDIPassoSelecionarAcao() {
  if (!currentUser) {
    showToast('Faça login para criar um plano.', 'warning');
    return;
  }
  if (isSomenteLeitura()) return;
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];
  const acoesOpts = [...acoes]
    .filter(a => a && a.status !== 'Inativo')
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
    .map(a => {
      const label = `${escapeHtmlStr(a.nome || '—')}${a.codigo ? ` (${escapeHtmlStr(String(a.codigo))})` : ''}`;
      return `<option value="${a.id}">${label}</option>`;
    })
    .join('');
  const body = `
    <p class="text-muted" style="font-size:13px;margin:0 0 16px;line-height:1.5;">Passo <strong>1</strong> de 2: escolha a ação educativa. Em seguida você preencherá os <strong>Blocos 1, 2 e 3</strong> do questionário. O plano será vinculado a <strong>você</strong> (${escapeHtmlStr(currentUser.nome || 'usuário logado')}).</p>
    <div class="form-group form-full">
      <label>Ação educativa *</label>
      <select id="pdi-sel-acao-passo1" class="form-control" style="width:100%;">
        <option value="">Selecione…</option>
        ${acoesOpts}
      </select>
    </div>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button type="button" class="btn btn-primary" onclick="pdiContinuarDoPasso1()"><i class="fas fa-arrow-right"></i> Continuar</button>
  `;
  openModal('Novo plano de ensino — escolher ação', body, footer, false);
}

window.pdiContinuarDoPasso1 = function() {
  const sel = document.getElementById('pdi-sel-acao-passo1');
  const acaoId = sel && sel.value;
  if (!acaoId) {
    showToast('Selecione uma ação educativa.', 'warning');
    return;
  }
  closeModalBtn();
  openPDIQuestionarioWizard({ editId: null, acaoId });
};

function openPDIQuestionarioWizard({ editId, acaoId }) {
  if (!currentUser) {
    showToast('Faça login.', 'warning');
    return;
  }
  if (isSomenteLeitura()) return;
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];
  const pdis = getStorage(STORAGE_KEYS.pdi) || [];
  const users = getStorage(STORAGE_KEYS.users) || [];
  const acao = acoes.find(a => idEquals(a.id, acaoId));
  if (!acao) {
    showToast('Ação educativa não encontrada.', 'error');
    return;
  }
  let prev = null;
  if (editId) {
    prev = pdis.find(x => idEquals(x.id, editId));
    if (!prev) {
      showToast('Plano não encontrado.', 'error');
      return;
    }
    if (!isAdminUser() && !isGestorUser() && !idEquals(prev.usuario_id, currentUser.id)) {
      showToast('Você só pode editar seus próprios planos.', 'warning');
      return;
    }
  }
  const b1 = editId ? pdiMergeBloco1(prev.plano_bloco1, acao) : pdiPrefillBloco1FromAcao(acao);
  const b2 = editId ? pdiMergeBloco2(prev.plano_bloco2, acao) : pdiPrefillBloco2FromAcaoMatriz(acao);
  const b3 = editId ? pdiMergeBloco3(prev.plano_bloco3, acao) : pdiPrefillBloco3FromAcao(acao);
  const donoPlano = editId && prev
    ? users.find(u => idEquals(u.id, prev.usuario_id))
    : null;
  const servidorNome = escapeHtmlStr(
    donoPlano && (donoPlano.nome || '').trim()
      ? donoPlano.nome.trim()
      : (currentUser.nome || '—')
  );
  const acaoLinha = `${escapeHtmlStr(acao.nome || '—')}${acao.codigo ? ` <span style="color:var(--gray-500);">(${escapeHtmlStr(String(acao.codigo))})</span>` : ''}`;
  const stepsHtml = editId
    ? `<div class="pdi-wizard-steps"><span class="active">Questionário</span></div>`
    : `<div class="pdi-wizard-steps"><span>1. Ação ✓</span><span class="active">2. Questionário</span></div>`;
  const body = `
    ${stepsHtml}
    <div style="padding:14px 16px;background:var(--gray-50);border-radius:12px;margin-bottom:18px;border:1px solid var(--gray-200);">
      <div style="font-size:12px;font-weight:700;color:var(--gray-600);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Servidor (plano)</div>
      <div style="font-size:15px;font-weight:700;color:var(--navy);">${servidorNome}</div>
      <div style="font-size:12px;color:var(--gray-600);margin-top:10px;font-weight:700;text-transform:uppercase;">Ação educativa selecionada</div>
      <div style="font-size:14px;margin-top:4px;line-height:1.45;">${acaoLinha}</div>
    </div>
    ${pdiBuildBloco1FormHtml(b1)}
    ${pdiBuildBloco2FormHtml(b2)}
    ${pdiBuildBloco3FormHtml(b3)}
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button type="button" class="btn btn-primary" onclick="savePDIFromWizard()"><i class="fas fa-save"></i> ${editId ? 'Salvar alterações' : 'Criar plano'}</button>
  `;
  openModal(editId ? 'Editar plano de ensino' : 'Novo plano de ensino — questionário (Blocos 1, 2 e 3)', body, footer, true, 'modal-pdi-wizard');
  document.getElementById('pdi-w-acao-id').value = String(acao.id);
  document.getElementById('pdi-w-edit-id').value = editId ? String(editId) : '';
  setTimeout(() => { if (typeof pdiOnPeriodoDateChange === 'function') pdiOnPeriodoDateChange('inicio'); }, 0);
}

function openPDIForm(id = null) {
  if (!currentUser) {
    showToast('Faça login.', 'warning');
    return;
  }
  if (isSomenteLeitura()) return;
  if (!id) {
    openPDIPassoSelecionarAcao();
    return;
  }
  const pdis = getStorage(STORAGE_KEYS.pdi) || [];
  const p = pdis.find(x => idEquals(x.id, id));
  if (!p) {
    showToast('Plano não encontrado.', 'warning');
    return;
  }
  if (!p.acao_id) {
    showToast('Este plano ainda está no formato antigo (sem ação vinculada).', 'warning');
    return;
  }
  openPDIQuestionarioWizard({ editId: id, acaoId: p.acao_id });
}

function editPDI(id) { openPDIForm(id); }

window.savePDIFromWizard = function() {
  const acaoId = (document.getElementById('pdi-w-acao-id') || {}).value;
  const editIdRaw = (document.getElementById('pdi-w-edit-id') || {}).value || '';
  const editId = editIdRaw ? editIdRaw : null;
  if (!acaoId) {
    showToast('Ação não identificada. Reabra o formulário.', 'error');
    return;
  }
  const b1 = pdiCollectBloco1FromForm();
  if (!b1.titulo_acao) {
    showToast('Preencha o título da ação educativa (Bloco 1).', 'warning');
    return;
  }
  if (!b1.publico_alvo) {
    showToast('Selecione o público-alvo.', 'warning');
    return;
  }
  if (b1.publico_alvo === 'Outros' && !b1.publico_alvo_outros) {
    showToast('Descreva o público quando selecionar "Outros".', 'warning');
    return;
  }
  if (!b1.objetivo_geral) {
    showToast('Preencha o objetivo geral da ação educativa.', 'warning');
    return;
  }
  if (!b1.tipo_acao) {
    showToast('Selecione o tipo da ação educativa.', 'warning');
    return;
  }
  if (b1.tipo_acao === 'Outra' && !b1.tipo_acao_outra) {
    showToast('Especifique o tipo quando escolher "Outra".', 'warning');
    return;
  }
  if (!b1.modalidade) {
    showToast('Selecione a modalidade.', 'warning');
    return;
  }
  const chNum = parseInt(b1.carga_horaria_total, 10);
  if (!b1.carga_horaria_total || Number.isNaN(chNum) || chNum < 0) {
    showToast('Informe a carga horária total (número válido).', 'warning');
    return;
  }
  if (!b1.periodo_inicio) {
    showToast('Informe a data de início do período de realização (item 7).', 'warning');
    return;
  }
  if (!b1.periodo_fim) {
    showToast('Informe a data de fim do período de realização (item 7).', 'warning');
    return;
  }
  const tIni = pdiParseDateOnly(b1.periodo_inicio);
  const tFim = pdiParseDateOnly(b1.periodo_fim);
  if (tIni == null || tFim == null) {
    showToast('Use datas válidas no período de realização (início e fim).', 'warning');
    return;
  }
  if (tIni > tFim) {
    showToast('A data de início não pode ser posterior à data de fim.', 'warning');
    return;
  }
  const b2 = pdiCollectBloco2FromForm();
  if (!b2.categoria_competencia_mcn) {
    showToast('Bloco 2: selecione a categoria de competência (item 10).', 'warning');
    return;
  }
  if (!PDI_B2_CATEGORIA_OPTS.includes(b2.categoria_competencia_mcn)) {
    showToast('Bloco 2: categoria de competência inválida.', 'error');
    return;
  }
  if (!b2.subcategoria_competencia_mcn) {
    showToast('Bloco 2: selecione a subcategoria de competência (item 11).', 'warning');
    return;
  }
  if (!PDI_B2_SUBCATEGORIA_OPTS.includes(b2.subcategoria_competencia_mcn)) {
    showToast('Bloco 2: subcategoria inválida.', 'error');
    return;
  }
  if (!b2.eixo_competencia_mcn) {
    showToast('Bloco 2: selecione o eixo de competência (item 12).', 'warning');
    return;
  }
  if (!PDI_B2_EIXO_OPTS.includes(b2.eixo_competencia_mcn)) {
    showToast('Bloco 2: eixo de competência inválido.', 'error');
    return;
  }
  if (!b2.unidade_tematica_mcn) {
    showToast('Bloco 2: selecione a unidade temática (item 13).', 'warning');
    return;
  }
  if (!PDI_B2_UNIDADE_TEMATICA_OPTS.includes(b2.unidade_tematica_mcn)) {
    showToast('Bloco 2: unidade temática inválida.', 'error');
    return;
  }
  if (!b2.conhecimento_critico_mcn) {
    showToast('Bloco 2: selecione o conhecimento crítico trabalhado (item 14).', 'warning');
    return;
  }
  if (!PDI_B2_CONHECIMENTOS_OPTS.includes(b2.conhecimento_critico_mcn)) {
    showToast('Bloco 2: escolha um conhecimento crítico da lista oficial (item 14).', 'warning');
    return;
  }
  if (!b2.justificativa_design) {
    showToast('Bloco 2: preencha a justificativa (item 15).', 'warning');
    return;
  }
  const b3 = pdiCollectBloco3FromForm();
  if (!b3.metodologias_estrategias) {
    showToast('Bloco 3: preencha as metodologias e estratégias (item 16).', 'warning');
    return;
  }
  if (!b3.recursos_humanos_tecnologicos_materiais) {
    showToast('Bloco 3: preencha recursos humanos, tecnológicos e materiais (item 17).', 'warning');
    return;
  }
  if (!b3.avaliacao_aprendizagem_transferencia) {
    showToast('Bloco 3: preencha a avaliação da aprendizagem e transferência (item 18).', 'warning');
    return;
  }
  if (!b3.referencias_curadoria) {
    showToast('Bloco 3: preencha referências e curadoria (item 19).', 'warning');
    return;
  }
  const data = getStorage(STORAGE_KEYS.pdi) || [];
  const prev = editId ? data.find(x => idEquals(x.id, editId)) : null;
  const usuarioId = prev ? prev.usuario_id : currentUser.id;
  if (!isAdminUser() && !isGestorUser() && prev && !idEquals(prev.usuario_id, currentUser.id)) {
    showToast('Você não pode alterar este plano.', 'warning');
    return;
  }
  if (!prev && !isAdminUser() && !isGestorUser() && !idEquals(usuarioId, currentUser.id)) {
    showToast('Erro de consistência do usuário.', 'error');
    return;
  }
  const rec = {
    usuario_id: usuarioId,
    acao_id: acaoId,
    plano_bloco1: b1,
    plano_bloco2: b2,
    plano_bloco3: b3,
    data_inicio: b1.periodo_inicio,
    data_meta: b1.periodo_fim,
  };
  if (editId) {
    const idx = data.findIndex(x => idEquals(x.id, editId));
    if (idx < 0) return;
    const merged = pdiNormalizePersistido({ ...data[idx], ...rec });
    if (usaFilaModeracao()) {
      pushFilaModeracao('pdi_upsert', { editId, registro: merged });
      closeModalBtn();
      showToast('Alteração enviada para aprovação do administrador.', 'info');
      renderPDI();
      return;
    }
    data[idx] = merged;
  } else {
    const novo = pdiNormalizePersistido({ id: genId(), ...rec, data_criacao: new Date().toISOString() });
    if (usaFilaModeracao()) {
      pushFilaModeracao('pdi_upsert', { editId: null, registro: novo });
      closeModalBtn();
      showToast('Cadastro enviado para aprovação do administrador.', 'info');
      renderPDI();
      return;
    }
    data.push(novo);
  }
  setStorage(STORAGE_KEYS.pdi, data);
  closeModalBtn();
  showToast(editId ? 'Plano de ensino atualizado!' : 'Plano de ensino criado!', 'success');
  renderPDI();
};

function deletePDI(id) {
  if (isSomenteLeitura()) return;
  const todos = getStorage(STORAGE_KEYS.pdi) || [];
  const row = todos.find(x => idEquals(x.id, id));
  if (!row) {
    showToast('Plano não encontrado.', 'warning');
    return;
  }
  if (!isAdminUser() && !isGestorUser() && !idEquals(row.usuario_id, currentUser.id)) {
    showToast('Você só pode excluir seus próprios planos.', 'warning');
    return;
  }
  if (!confirm('Deseja excluir este plano de ensino?')) return;
  if (usaFilaModeracao()) {
    pushFilaModeracao('pdi_excluir', { id });
    showToast('Solicitação enviada ao administrador.', 'info');
    renderPDI();
    return;
  }
  const data = (getStorage(STORAGE_KEYS.pdi) || []).filter(x => x.id !== id);
  setStorage(STORAGE_KEYS.pdi, data);
  showToast('Plano de ensino excluído.', 'success');
  renderPDI();
}

Object.assign(globalThis, {
  renderPDI,
  openPDIForm,
  editPDI,
  deletePDI,
  // window.pdiOnPeriodoDateChange / pdiContinuarDoPasso1 / savePDIFromWizard já são atribuídos via `window.X = …` dentro do módulo.
});
