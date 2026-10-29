import { formatDateDDMMYYYY } from './api.js';

/**
 * Renderiza el Top Héroes del grupo (acumulado semanal - últimos 7 días)
 */
export function renderTopHeroesView(playersData, container) {
  const nowSec = Date.now() / 1000;
  const oneWeekAgo = nowSec - (7 * 24 * 60 * 60);
  const fromDateStr = formatDateDDMMYYYY(oneWeekAgo);
  const toDateStr = formatDateDDMMYYYY(nowSec);

  const heroMap = {};

  playersData.filter(Boolean).forEach(p => {
    (p.matches || []).forEach(m => {
      if (m.started && m.started >= oneWeekAgo && m.heroName) {
        if (!heroMap[m.heroName]) {
          heroMap[m.heroName] = {
            name: m.heroName,
            icon: m.heroIcon,
            img: m.heroImg,
            total: 0,
            wins: 0,
            losses: 0,
            kills: 0,
            deaths: 0,
            assists: 0
          };
        }
        heroMap[m.heroName].total += 1;
        if (m.won) heroMap[m.heroName].wins += 1;
        else heroMap[m.heroName].losses += 1;
        heroMap[m.heroName].kills += (m.kills || 0);
        heroMap[m.heroName].deaths += (m.deaths || 0);
        heroMap[m.heroName].assists += (m.assists || 0);
      }
    });
  });

  const sortedHeroes = Object.values(heroMap)
    .map(h => ({
      ...h,
      winRate: (h.wins / h.total) * 100,
      kda: `${(h.kills / h.total).toFixed(1)} / ${(h.deaths / h.total).toFixed(1)} / ${(h.assists / h.total).toFixed(1)}`
    }))
    .sort((a, b) => b.total - a.total);

  const heroRows = sortedHeroes.map((h, idx) => `
    <tr>
      <td><strong>#${idx + 1}</strong></td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${h.icon || h.img || 'assets/icons/dota2-logo.png'}" style="width:28px; border-radius:3px;" onerror="this.style.display='none';">
          <strong>${h.name}</strong>
        </div>
      </td>
      <td>${h.total}</td>
      <td><span class="green">${h.wins}W</span> / <span class="red">${h.losses}L</span></td>
      <td>
        <span class="${h.winRate >= 50 ? 'green' : 'red'}" style="font-weight:700;">${h.winRate.toFixed(1)}%</span>
        <div class="progress-bar-bg" style="width:100px;">
          <div class="progress-bar-fill" style="width:${h.winRate}%; background:${h.winRate >= 50 ? '#22c55e' : '#ef4444'};"></div>
        </div>
      </td>
      <td>${h.kda}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header-row">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h2>🦸 Héroes más Jugados por el Grupo</h2>
            <span class="weekly-period-badge">📅 Acumulado Semanal (Últimos 7 días)</span>
          </div>
          <p class="subtitle">Elecciones y rendimiento de héroes (${fromDateStr} al ${toDateStr}).</p>
        </div>
      </div>

      <table class="matches-table" style="font-size:1rem;">
        <thead>
          <tr>
            <th>#</th>
            <th>Héroe</th>
            <th>Partidas (7d)</th>
            <th>V/D</th>
            <th>Winrate</th>
            <th>Promedio K/D/A</th>
          </tr>
        </thead>
        <tbody>
          ${heroRows || '<tr><td colspan="6" style="text-align:center; padding:20px; color:#777;">Sin partidas registradas en los últimos 7 días</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}
