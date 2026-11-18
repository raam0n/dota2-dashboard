import { formatDateDDMMYYYY } from './api.js';

const PERIOD_LABELS = {
  7: { title: 'Rendimiento Semanal de Dota 2', badge: 'Últimos 7 días', short: 'esta semana', colHeader: 'Partidas (7d)' },
  30: { title: 'Rendimiento Mensual de Dota 2', badge: 'Últimos 30 días', short: 'estos 30 días', colHeader: 'Partidas (30d)' },
  90: { title: 'Rendimiento Trimestral de Dota 2', badge: 'Últimos 90 días', short: 'estos 90 días', colHeader: 'Partidas (90d)' }
};

/**
 * Renderiza el Winrate por período (7, 30 o 90 días) de los jugadores de Dota 2
 */
export function renderWeeklyView(playersData, container, periodDays = 7, onPeriodChange = null) {
  const days = PERIOD_LABELS[periodDays] ? periodDays : 7;
  const meta = PERIOD_LABELS[days];
  const nowSec = Date.now() / 1000;
  const cutoffSec = nowSec - (days * 24 * 60 * 60);
  const fromDateStr = formatDateDDMMYYYY(cutoffSec);
  const toDateStr = formatDateDDMMYYYY(nowSec);

  const periodStats = playersData.filter(Boolean).map(player => {
    const periodMatches = (player.matches || []).filter(m => m.started && m.started >= cutoffSec);
    const total = periodMatches.length;
    const wins = periodMatches.filter(m => m.won).length;
    const losses = total - wins;
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    return {
      accountId: player.accountId,
      name: player.name,
      avatar: player.avatar,
      currentElo: player.currentElo,
      rankTierName: player.rankTierName,
      lastMatchDate: player.lastMatchDate,
      total,
      wins,
      losses,
      winRate
    };
  });

  const activePlayers = periodStats.filter(p => p.total > 0).sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.total - a.total;
  });
  const inactivePlayers = periodStats.filter(p => p.total === 0).sort((a, b) => b.currentElo - a.currentElo);

  const totalGamesGroup = activePlayers.reduce((acc, p) => acc + p.total, 0);
  const totalWinsGroup = activePlayers.reduce((acc, p) => acc + p.wins, 0);
  const groupWinRate = totalGamesGroup > 0 ? ((totalWinsGroup / totalGamesGroup) * 100).toFixed(1) : 0;
  const mostActive = [...activePlayers].sort((a, b) => b.total - a.total)[0];

  const rowsHtml = activePlayers.map((p, index) => {
    const wrClass = p.winRate >= 50 ? 'green' : 'red';
    return `
      <tr>
        <td><strong>#${index + 1}</strong></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${p.avatar}" style="width:24px; height:24px; border-radius:4px;" onerror="this.onerror=null;this.src='assets/icons/dota2-logo.png';">
            <span>${p.name}</span>
          </div>
        </td>
        <td><strong>${p.rankTierName}</strong></td>
        <td>${p.total}</td>
        <td><span class="green">${p.wins}W</span> / <span class="red">${p.losses}L</span></td>
        <td>
          <span class="${wrClass}" style="font-weight:700;">${p.winRate.toFixed(1)}%</span>
          <div class="progress-bar-bg" style="width:100px;">
            <div class="progress-bar-fill" style="width:${p.winRate}%; background:${p.winRate >= 50 ? '#22c55e' : '#ef4444'};"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const inactiveListHtml = inactivePlayers.length > 0 ? `
    <div class="inactive-weekly-section">
      <div class="inactive-weekly-header">
        <h3>💤 Jugadores sin partidas ${meta.short} (${inactivePlayers.length})</h3>
        <span>0 partidas públicas registradas en los últimos ${days} días</span>
      </div>
      <div class="inactive-players-grid">
        ${inactivePlayers.map(p => `
          <div class="inactive-player-chip">
            <img src="${p.avatar}" class="inactive-player-flag" style="border-radius:4px;" alt="${p.name}" onerror="this.onerror=null;this.src='assets/icons/dota2-logo.png';">
            <div class="inactive-player-info">
              <span class="inactive-player-name">${p.name} <small>(${p.rankTierName})</small></span>
              <span class="inactive-player-last">Últ. partida: ${p.lastMatchDate}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header-row">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h2>📊 ${meta.title}</h2>
            <span class="weekly-period-badge">📅 ${meta.badge} (${activePlayers.length} activos)</span>
          </div>
          <p class="subtitle">Monitoreo (${fromDateStr} al ${toDateStr}) con el 100% de las partidas del período (sin límite).</p>
        </div>
        <div class="sort-toggle-group" role="group" aria-label="Filtro de período">
          <span class="sort-label">Período:</span>
          <button type="button" class="sort-btn period-btn ${days === 7 ? 'active' : ''}" data-days="7">7 Días (Semanal)</button>
          <button type="button" class="sort-btn period-btn ${days === 30 ? 'active' : ''}" data-days="30">30 Días</button>
          <button type="button" class="sort-btn period-btn ${days === 90 ? 'active' : ''}" data-days="90">Últ. 90 Días</button>
        </div>
      </div>

      <div class="metrics-cards-row">
        <div class="metric-card">
          <div class="label">Partidas Totales (${days}d)</div>
          <div class="value">${totalGamesGroup}</div>
        </div>
        <div class="metric-card">
          <div class="label">Winrate Colectivo (${days}d)</div>
          <div class="value ${parseFloat(groupWinRate) >= 50 ? 'green' : 'red'}">${groupWinRate}%</div>
        </div>
        <div class="metric-card">
          <div class="label">⚔️ Jugador Más Activo</div>
          <div class="value" style="font-size:1.4rem;">
            ${mostActive && mostActive.total > 0 ? `${mostActive.name} (${mostActive.total} PJ)` : '-'}
          </div>
        </div>
      </div>

      <table class="matches-table" style="font-size:1rem;">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Jugador</th>
            <th>Medalla</th>
            <th>${meta.colHeader}</th>
            <th>Récord (V/D)</th>
            <th>Winrate</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6" style="text-align:center; padding:20px; color:#777;">No se registraron partidas en los últimos ${days} días</td></tr>`}
        </tbody>
      </table>

      ${inactiveListHtml}
    </div>
  `;

  if (onPeriodChange) {
    container.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedDays = parseInt(btn.dataset.days, 10);
        if (selectedDays && selectedDays !== days) {
          onPeriodChange(selectedDays);
        }
      });
    });
  }
}
