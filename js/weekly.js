import { formatDateDDMMYYYY } from './api.js';

/**
 * Renderiza el Winrate Semanal de los jugadores de Dota 2
 */
export function renderWeeklyView(playersData, container) {
  const nowSec = Date.now() / 1000;
  const oneWeekAgo = nowSec - (7 * 24 * 60 * 60);
  const fromDateStr = formatDateDDMMYYYY(oneWeekAgo);
  const toDateStr = formatDateDDMMYYYY(nowSec);

  const weeklyStats = playersData.filter(Boolean).map(player => {
    const weekMatches = (player.matches || []).filter(m => m.started && m.started >= oneWeekAgo);
    const total = weekMatches.length;
    const wins = weekMatches.filter(m => m.won).length;
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

  const activePlayers = weeklyStats.filter(p => p.total > 0).sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.total - a.total;
  });
  const inactivePlayers = weeklyStats.filter(p => p.total === 0).sort((a, b) => b.currentElo - a.currentElo);

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
            <img src="${p.avatar}" style="width:24px; height:24px; border-radius:4px;">
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
        <h3>💤 Jugadores sin partidas esta semana (${inactivePlayers.length})</h3>
        <span>0 partidas públicas registradas en los últimos 7 días</span>
      </div>
      <div class="inactive-players-grid">
        ${inactivePlayers.map(p => `
          <div class="inactive-player-chip">
            <img src="${p.avatar}" class="inactive-player-flag" style="border-radius:4px;" alt="${p.name}">
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
            <h2>📊 Rendimiento Semanal de Dota 2</h2>
            <span class="weekly-period-badge">📅 Últimos 7 días (${activePlayers.length} activos)</span>
          </div>
          <p class="subtitle">Monitoreo semanal (${fromDateStr} al ${toDateStr}) de partidas competitivas.</p>
        </div>
      </div>

      <div class="metrics-cards-row">
        <div class="metric-card">
          <div class="label">Partidas Totales del Grupo</div>
          <div class="value">${totalGamesGroup}</div>
        </div>
        <div class="metric-card">
          <div class="label">Winrate Colectivo Semanal</div>
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
            <th>Partidas Semanales</th>
            <th>Récord (V/D)</th>
            <th>Winrate</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:20px; color:#777;">No se registraron partidas en los últimos 7 días</td></tr>'}
        </tbody>
      </table>

      ${inactiveListHtml}
    </div>
  `;
}
