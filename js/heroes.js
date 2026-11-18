import { formatDateDDMMYYYY } from './api.js';

const HERO_PERIOD_LABELS = {
  7: { badge: 'Acumulado Semanal (Últimos 7 días)', colHeader: 'Partidas (7d)' },
  30: { badge: 'Acumulado Mensual (Últimos 30 días)', colHeader: 'Partidas (30d)' },
  90: { badge: 'Acumulado Trimestral (Últimos 90 días)', colHeader: 'Partidas (90d)' }
};

/**
 * Renderiza el Top Héroes del grupo según el período seleccionado (7, 30 o 90 días)
 */
export function renderTopHeroesView(playersData, container, periodDays = 7, onPeriodChange = null) {
  const days = HERO_PERIOD_LABELS[periodDays] ? periodDays : 7;
  const meta = HERO_PERIOD_LABELS[days];
  const nowSec = Date.now() / 1000;
  const cutoffSec = nowSec - (days * 24 * 60 * 60);
  const fromDateStr = formatDateDDMMYYYY(cutoffSec);
  const toDateStr = formatDateDDMMYYYY(nowSec);

  const heroMap = {};

  playersData.filter(Boolean).forEach(p => {
    (p.matches || []).forEach(m => {
      if (m.started && m.started >= cutoffSec && m.heroName) {
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
            <span class="weekly-period-badge">📅 ${meta.badge}</span>
          </div>
          <p class="subtitle">Elecciones y rendimiento de héroes (${fromDateStr} al ${toDateStr}).</p>
        </div>
        <div class="sort-toggle-group" role="group" aria-label="Filtro de período">
          <span class="sort-label">Período:</span>
          <button type="button" class="sort-btn period-btn ${days === 7 ? 'active' : ''}" data-days="7">7 Días (Semanal)</button>
          <button type="button" class="sort-btn period-btn ${days === 30 ? 'active' : ''}" data-days="30">30 Días</button>
          <button type="button" class="sort-btn period-btn ${days === 90 ? 'active' : ''}" data-days="90">Últ. 90 Días</button>
        </div>
      </div>

      <table class="matches-table" style="font-size:1rem;">
        <thead>
          <tr>
            <th>#</th>
            <th>Héroe</th>
            <th>${meta.colHeader}</th>
            <th>V/D</th>
            <th>Winrate</th>
            <th>Promedio K/D/A</th>
          </tr>
        </thead>
        <tbody>
          ${heroRows || `<tr><td colspan="6" style="text-align:center; padding:20px; color:#777;">Sin partidas registradas en los últimos ${days} días</td></tr>`}
        </tbody>
      </table>
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
