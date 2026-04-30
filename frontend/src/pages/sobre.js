/**
 * Página "Sobre" — informações institucionais e logos das organizações parceiras.
 * Estática: sem mutação, formulário ou estado próprio.
 */
import { escapeHtmlStr } from '../shared/escape.js';

const LOGOS_INSTITUCIONAIS = [
  { file: 'Governo Federal.png', label: 'Governo Federal' },
  { file: 'Senappen.png', label: 'SENAPPEN' },
  { file: 'UFSC.png', label: 'Universidade Federal de Santa Catarina (UFSC)' },
  { file: 'EGC.png', label: 'EGC' },
  { file: 'ENGIN.png', label: 'ENGIN' },
];

export function renderSobre() {
  document.getElementById('topbar-actions').innerHTML = '';

  const logosHtml = LOGOS_INSTITUCIONAIS.map(({ file, label }) => {
    const src = 'logos/' + encodeURIComponent(file);
    const alt = escapeHtmlStr(label);
    return `<div class="sobre-logo-cell" title="${alt}"><img src="${src}" alt="${alt}" loading="lazy"></div>`;
  }).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Sobre</div>
        <div class="section-sub">Informações institucionais e apoio ao desenvolvimento do sistema ESPEN</div>
      </div>
    </div>

    <div class="table-card" style="margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);">
        <div class="section-title" style="font-size:16px;"><i class="fas fa-info-circle" style="color:var(--success);margin-right:8px;"></i>Sobre o sistema</div>
      </div>
      <div style="padding:20px 24px;">
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-label">Sistema</div><div class="detail-value fw-600">ESPEN — Sistema de Gestão por Competências</div></div>
          <div class="detail-field"><div class="detail-label">Instituição</div><div class="detail-value">Escola Nacional de Serviços Penais (ESPEN) / SENAPPEN</div></div>
          <div class="detail-field"><div class="detail-label">Versão</div><div class="detail-value">1.0.0 — MCN 2026</div></div>
          <div class="detail-field"><div class="detail-label">Desenvolvimento</div><div class="detail-value">2026</div></div>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);">
        <div class="section-title" style="font-size:16px;"><i class="fas fa-handshake" style="color:var(--navy);margin-right:8px;"></i>Realização e parcerias</div>
        <div class="section-sub">Identidades visuais das instituições vinculadas ao projeto</div>
      </div>
      <div style="padding:24px;">
        <div class="sobre-logos-grid">${logosHtml}</div>
      </div>
    </div>
  `;
}

// `navigate('sobre')` resolve `renderSobre` via globalThis enquanto router.js
// estiver consultando os globals — quando todas as páginas estiverem extraídas,
// router.js poderá importar diretamente e este bridge sai.
globalThis.renderSobre = renderSobre;
