const expandedCardsMatches = new Set();

/**
 * Renderiza la grilla de tarjetas de jugadores de Dota 2
 */
export function renderPlayersGrid(playersData, container, onCardClick, onRemovePlayer, sortBy = 'current') {
  const sorted = [...playersData.filter(Boolean)].sort((a, b) => {
    if (sortBy === 'max') {
      if (b.maxElo !== a.maxElo) return b.maxElo - a.maxElo;
      return b.currentElo - a.currentElo;
    }
    if (b.currentElo !== a.currentElo) return b.currentElo - a.currentElo;
    return b.maxElo - a.maxElo;
  });

  if (sorted.length === 0) {
    container.innerHTML = `<div class="loading-box"><p>No hay datos de jugadores cargados.</p></div>`;
    return;
  }

  container.innerHTML = '';

  sorted.forEach((player, index) => {
    const rank = index + 1;
    let rankClass = '';
    let stampClass = 'stamp-other';

    if (rank === 1) {
      rankClass = 'rank-1';
      stampClass = 'stamp-1';
    } else if (rank === 2) {
      rankClass = 'rank-2';
      stampClass = 'stamp-2';
    } else if (rank === 3) {
      rankClass = 'rank-3';
      stampClass = 'stamp-3';
    }

    // Racha
    let rachaHtml = 'Racha: <span style="color:#777;">0</span>';
    if (player.streak !== 0) {
      const isWinStreak = player.streak > 0;
      const streakArrow = isWinStreak ? '↑' : '↓';
      const streakColor = isWinStreak ? 'green' : 'red';
      rachaHtml = `Racha: <span class="streak-indicator ${streakColor}">${streakArrow}${Math.abs(player.streak)}</span>`;
    }

    // Últimas 10 partidas con foto del héroe + resultado
    const recentMatchesHtml = player.matches.slice(0, 10).map(m => {
      const borderClass = m.won ? 'hero-win' : 'hero-loss';
      const tooltip = `${m.heroName} • ${m.won ? 'Victoria' : 'Derrota'} • KDA: ${m.kda}`;
      return `
        <div class="last-match-col" title="${tooltip}">
          <img 
            src="${m.heroIcon || m.heroImg || 'assets/icons/dota2-logo.png'}" 
            class="hero-shield-icon ${borderClass}" 
            alt="${m.heroName}"
            onerror="this.onerror=null;this.src='assets/icons/dota2-logo.png';"
          />
          <span class="match-kda-mini ${m.won ? 'green' : 'red'}">${m.kills}/${m.deaths}</span>
        </div>
      `;
    }).join('');

    const isExpanded = expandedCardsMatches.has(player.accountId);

    const card = document.createElement('div');
    card.className = `player-card ${rankClass}`;
    card.innerHTML = `
      <div class="position-stamp ${stampClass}">${rank}</div>
      <div class="card-header">
        <img src="${player.avatar}" class="card-avatar" alt="${player.name}" onerror="this.onerror=null;this.src='assets/icons/dota2-logo.png';">
        <div class="card-title-col">
          <span class="player-name" title="${player.name}">${player.name}</span>
          <span class="rank-badge">${player.rankTierName}</span>
        </div>
      </div>
      <div class="card-stats-row">
        MMR Est: <span class="elo-now ${sortBy === 'current' ? 'elo-active-sort' : ''}">${player.currentElo || 'N/A'}</span> - Max: <span class="elo-max ${sortBy === 'max' ? 'elo-active-sort' : ''}">${player.maxElo || 'N/A'}</span>
      </div>
      <div class="card-last-match-row">
        <span>Últ. partida: ${player.lastMatchDate}</span>
        <span class="meta-separator">•</span>
        <span>${rachaHtml}</span>
      </div>
      <div class="card-civs-dropdown">
        <button type="button" class="card-civs-toggle ${isExpanded ? 'open' : ''}" title="Desplegar / ocultar últimas partidas">
          <span class="toggle-arrow">${isExpanded ? '▼' : '▶'}</span>
          <span>Last Matches (${player.matches.length})</span>
        </button>
        <div class="civs-icons-row ${isExpanded ? '' : 'hidden'}">
          ${recentMatchesHtml || '<span style="font-size:0.8rem; color:#666;">Sin partidas recientes públicas</span>'}
        </div>
      </div>
      <button class="remove-player-btn" title="Quitar jugador">×</button>
    `;

    // Toggle de últimas partidas
    const toggleBtn = card.querySelector('.card-civs-toggle');
    const rowEl = card.querySelector('.civs-icons-row');
    const arrowEl = card.querySelector('.toggle-arrow');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = rowEl.classList.toggle('hidden') === false;
      toggleBtn.classList.toggle('open', open);
      arrowEl.textContent = open ? '▼' : '▶';
      if (open) expandedCardsMatches.add(player.accountId);
      else expandedCardsMatches.delete(player.accountId);
    });

    // Click tarjeta para modal
    card.addEventListener('click', (e) => {
      if (e.target.closest('.remove-player-btn') || e.target.closest('.card-civs-toggle')) return;
      if (onCardClick) onCardClick(player);
    });

    // Quitar jugador
    card.querySelector('.remove-player-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onRemovePlayer) onRemovePlayer(player.accountId);
    });

    container.appendChild(card);
  });
}

/**
 * Modal detallado del jugador
 */
export function showPlayerModal(player, modalContainer, modalOverlay) {
  // Estadísticas por héroe
  const heroStats = {};
  player.matches.forEach(m => {
    if (!heroStats[m.heroName]) {
      heroStats[m.heroName] = { name: m.heroName, img: m.heroImg, total: 0, wins: 0, losses: 0 };
    }
    heroStats[m.heroName].total += 1;
    if (m.won) heroStats[m.heroName].wins += 1;
    else heroStats[m.heroName].losses += 1;
  });

  const heroList = Object.values(heroStats)
    .map(h => ({ ...h, winRate: (h.wins / h.total) * 100 }))
    .sort((a, b) => b.total - a.total);

  const heroStatsHtml = heroList.map(h => `
    <div class="civ-stat-box">
      <img src="${h.img || 'assets/icons/dota2-logo.png'}" alt="${h.name}">
      <div class="civ-stat-info">
        <span class="civ-stat-name">${h.name}</span>
        <span class="civ-stat-numbers">Total: ${h.total} (${h.wins}W / ${h.losses}L)</span>
        <span style="font-weight:700;" class="${h.winRate >= 50 ? 'green' : 'red'}">${h.winRate.toFixed(1)}% WR</span>
      </div>
    </div>
  `).join('');

  const matchesTableHtml = player.matches.map(m => {
    const dateStr = m.started ? new Date(m.started * 1000).toLocaleDateString() : '-';
    const durationMin = m.duration ? `${Math.floor(m.duration / 60)}m` : '-';
    return `
      <tr>
        <td>${dateStr}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${m.heroIcon || 'assets/icons/dota2-logo.png'}" style="width:26px; border-radius:3px;">
            <strong>${m.heroName}</strong>
          </div>
        </td>
        <td><strong class="${m.won ? 'green' : 'red'}">${m.won ? 'Victoria' : 'Derrota'}</strong></td>
        <td>${m.kda}</td>
        <td>${durationMin}</td>
        <td>
          <a href="https://www.opendota.com/matches/${m.matchId}" target="_blank" style="color:#60a5fa; text-decoration:none; font-size:0.85rem;">Ver ↗</a>
        </td>
      </tr>
    `;
  }).join('');

  modalContainer.innerHTML = `
    <button class="modal-close" id="modalCloseBtn">&times;</button>
    <div class="modal-title-row">
      <img src="${player.avatar}" style="width:48px; height:48px; border-radius:8px;">
      <div>
        <h2>${player.name}</h2>
        <span style="color:#f59e0b; font-weight:700;">${player.rankTierName}</span>
      </div>
      <a href="${player.profileUrl}" target="_blank" class="btn" style="margin-left:auto; font-size:0.85rem;">OpenDota ↗</a>
    </div>

    <div class="modal-collapsible-section">
      <div class="modal-section-header">
        <span>📜 Historial de Partidas Recientes (${player.matches.length})</span>
      </div>
      <div class="modal-section-body">
        <div style="overflow-x:auto;">
          <table class="matches-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Héroe</th>
                <th>Resultado</th>
                <th>KDA</th>
                <th>Duración</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              ${matchesTableHtml || '<tr><td colspan="6">Sin partidas recientes</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal-collapsible-section">
      <div class="modal-section-header">
        <span>🛡️ Héroes Jugados Recientemente (${heroList.length})</span>
      </div>
      <div class="modal-section-body">
        <div class="civs-stats-grid">
          ${heroStatsHtml || '<p style="color:#777;">No hay datos de héroes suficientes.</p>'}
        </div>
      </div>
    </div>
  `;

  modalOverlay.classList.add('active');
  document.getElementById('modalCloseBtn').onclick = () => {
    modalOverlay.classList.remove('active');
  };
}
