import { formatDateDDMMYYYY } from './api.js';

const SYNERGY_PERIOD_LABELS = {
  7: { title: 'Últimos 7 días (Semanal)', short: '7d' },
  30: { title: 'Últimos 30 días', short: '30d' },
  90: { title: 'Últimos 90 días', short: '90d' }
};

/**
 * Renderiza la pestaña de Sinergia y Parties (exclusivo partidas Ranked)
 */
export function renderSynergyView(
  playersData,
  container,
  periodDays = 7,
  selectedPlayerId = null,
  onPeriodChange = null,
  onSelectPlayer = null
) {
  const validPlayers = (playersData || []).filter(Boolean);
  if (validPlayers.length === 0) {
    container.innerHTML = `<div class="loading-box"><p>No hay jugadores activos para calcular sinergia.</p></div>`;
    return;
  }

  const days = SYNERGY_PERIOD_LABELS[periodDays] ? periodDays : 7;
  const periodMeta = SYNERGY_PERIOD_LABELS[days];
  const nowSec = Date.now() / 1000;
  const cutoffSec = nowSec - (days * 24 * 60 * 60);
  const fromDateStr = formatDateDDMMYYYY(cutoffSec);
  const toDateStr = formatDateDDMMYYYY(nowSec);

  // Jugador seleccionado (por defecto el primero con más partidas en el período o el primero de la lista)
  let currentPlayer = validPlayers.find(p => p.accountId === selectedPlayerId);
  if (!currentPlayer) {
    currentPlayer = validPlayers[0];
  }

  // Indexar todas las partidas de todos los jugadores del dashboard por matchId
  // matchIndex: Map<matchId, Array<{ player, match }>>
  const matchIndex = new Map();
  validPlayers.forEach(p => {
    (p.matches || []).forEach(m => {
      if (!m.matchId) return;
      if (!matchIndex.has(m.matchId)) {
        matchIndex.set(m.matchId, []);
      }
      matchIndex.get(m.matchId).push({ player: p, match: m });
    });
  });

  // Contar cantidad de partidas en el período para cada jugador (para mostrar en el selector superior)
  const playerPeriodCounts = new Map();
  validPlayers.forEach(p => {
    const count = (p.matches || []).filter(m => m.started && m.started >= cutoffSec).length;
    playerPeriodCounts.set(p.accountId, count);
  });

  // Filtrar las partidas ranked del jugador seleccionado en el período
  const playerMatches = (currentPlayer.matches || []).filter(m => m.started && m.started >= cutoffSec);

  // Estructuras de acumulación para el jugador seleccionado
  const partyBuckets = {
    1: {
      size: 1,
      label: 'Party de 1 (Solo Queue)',
      icon: '👤',
      total: 0,
      wins: 0,
      pureGroup: 0,
      pureGroupWins: 0,
      withRandom: 0,
      withRandomWins: 0,
      fourPlusOneRandom: 0,
      fourPlusOneRandomWins: 0
    },
    2: {
      size: 2,
      label: 'Party de 2 (Dúo)',
      icon: '👥',
      total: 0,
      wins: 0,
      pureGroup: 0,
      pureGroupWins: 0,
      withRandom: 0,
      withRandomWins: 0,
      fourPlusOneRandom: 0,
      fourPlusOneRandomWins: 0
    },
    3: {
      size: 3,
      label: 'Party de 3 (Trío)',
      icon: '☘️',
      total: 0,
      wins: 0,
      pureGroup: 0,
      pureGroupWins: 0,
      withRandom: 0,
      withRandomWins: 0,
      fourPlusOneRandom: 0,
      fourPlusOneRandomWins: 0
    },
    5: {
      size: 5,
      label: 'Party de 5 (Full Stack)',
      icon: '🖐️',
      total: 0,
      wins: 0,
      pureGroup: 0,
      pureGroupWins: 0,
      withRandom: 0,
      withRandomWins: 0,
      fourPlusOneRandom: 0,
      fourPlusOneRandomWins: 0,
      otherRandomStack: 0,
      otherRandomStackWins: 0
    }
  };

  // Estadísticas por compañero del dashboard
  const companionsMap = new Map();
  validPlayers.forEach(p => {
    if (p.accountId === currentPlayer.accountId) return;
    companionsMap.set(p.accountId, {
      accountId: p.accountId,
      name: p.name,
      avatar: p.avatar,
      rankTierName: p.rankTierName,
      currentElo: p.currentElo,
      games: 0,
      wins: 0,
      losses: 0,
      byPartySize: { 2: 0, 3: 0, 5: 0 },
      inFourPlusOne: 0
    });
  });

  // Combinaciones exactas de stacks
  const stackCombinations = new Map();

  let totalMatches = playerMatches.length;
  let totalWins = 0;
  let totalInParty = 0;
  let totalInPartyWins = 0;
  let totalMatchesWithRandom = 0;
  let totalMatchesWithRandomWins = 0;
  let totalFourPlusOneRandom = 0;
  let totalFourPlusOneRandomWins = 0;

  playerMatches.forEach(m => {
    if (m.won) totalWins += 1;

    // Buscar qué otros jugadores del dashboard estuvieron en esta misma partida
    const participants = matchIndex.get(m.matchId) || [];
    const companionsInMatch = participants
      .filter(entry => entry.player.accountId !== currentPlayer.accountId)
      .map(entry => entry.player);

    const knownGroupCount = 1 + companionsInMatch.length;

    // Determinar el party_size reportado por OpenDota (en el jugador o en alguno de sus compañeros de esa partida)
    let reportedPartySize = m.partySize;
    if (!reportedPartySize) {
      for (const entry of participants) {
        if (entry.match.partySize) {
          reportedPartySize = entry.match.partySize;
          break;
        }
      }
    }

    // En Ranked (lobby_type = 7) no existen parties de 4; si hay 4 del grupo, sí o sí completaron con un 5to random
    let effectivePartySize = reportedPartySize || knownGroupCount;
    if (knownGroupCount > effectivePartySize) {
      effectivePartySize = knownGroupCount;
    }
    if (effectivePartySize === 4 || knownGroupCount === 4) {
      effectivePartySize = 5;
    }
    if (![1, 2, 3, 5].includes(effectivePartySize)) {
      effectivePartySize = effectivePartySize > 3 ? 5 : 1;
    }

    const randomsInParty = Math.max(0, effectivePartySize - knownGroupCount);
    const hasRandom = randomsInParty > 0;
    const isFourPlusOne = effectivePartySize === 5 && knownGroupCount === 4;

    if (effectivePartySize > 1) {
      totalInParty += 1;
      if (m.won) totalInPartyWins += 1;
    }

    if (hasRandom) {
      totalMatchesWithRandom += 1;
      if (m.won) totalMatchesWithRandomWins += 1;
    }

    if (isFourPlusOne) {
      totalFourPlusOneRandom += 1;
      if (m.won) totalFourPlusOneRandomWins += 1;
    }

    const bucket = partyBuckets[effectivePartySize];
    if (bucket) {
      bucket.total += 1;
      if (m.won) bucket.wins += 1;
      if (hasRandom) {
        bucket.withRandom += 1;
        if (m.won) bucket.withRandomWins += 1;
        if (isFourPlusOne) {
          bucket.fourPlusOneRandom += 1;
          if (m.won) bucket.fourPlusOneRandomWins += 1;
        } else if (effectivePartySize === 5) {
          bucket.otherRandomStack += 1;
          if (m.won) bucket.otherRandomStackWins += 1;
        }
      } else {
        bucket.pureGroup += 1;
        if (m.won) bucket.pureGroupWins += 1;
      }
    }

    // Actualizar estadísticas con cada compañero presente en la partida
    companionsInMatch.forEach(comp => {
      const cStat = companionsMap.get(comp.accountId);
      if (cStat) {
        cStat.games += 1;
        if (m.won) cStat.wins += 1;
        else cStat.losses += 1;
        if (cStat.byPartySize[effectivePartySize] !== undefined) {
          cStat.byPartySize[effectivePartySize] += 1;
        }
        if (isFourPlusOne) {
          cStat.inFourPlusOne += 1;
        }
      }
    });

    // Registrar formación / stack si jugó en party (party > 1)
    if (effectivePartySize > 1) {
      const sortedCompNames = companionsInMatch.map(c => c.name).sort((a, b) => a.localeCompare(b));
      const key = `P${effectivePartySize}|${sortedCompNames.join('+')}|R${randomsInParty}`;
      if (!stackCombinations.has(key)) {
        stackCombinations.set(key, {
          partySize: effectivePartySize,
          companionNames: sortedCompNames,
          randomsCount: randomsInParty,
          isFourPlusOne,
          games: 0,
          wins: 0
        });
      }
      const st = stackCombinations.get(key);
      st.games += 1;
      if (m.won) st.wins += 1;
    }
  });

  const overallWr = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) : '0.0';
  const partyWr = totalInParty > 0 ? ((totalInPartyWins / totalInParty) * 100).toFixed(1) : '0.0';
  const randomWr = totalMatchesWithRandom > 0 ? ((totalMatchesWithRandomWins / totalMatchesWithRandom) * 100).toFixed(1) : '0.0';
  const fourPlusOneWr = totalFourPlusOneRandom > 0 ? ((totalFourPlusOneRandomWins / totalFourPlusOneRandom) * 100).toFixed(1) : '0.0';

  // Selector de jugador
  const playerSelectorHtml = validPlayers.map(p => {
    const isSelected = p.accountId === currentPlayer.accountId;
    const pCount = playerPeriodCounts.get(p.accountId) || 0;
    return `
      <button type="button" class="synergy-player-pill ${isSelected ? 'active' : ''}" data-player-id="${p.accountId}">
        <img src="${p.avatar}" alt="${p.name}" onerror="this.onerror=null;this.src='assets/icons/dota2-logo.png';">
        <div class="synergy-pill-info">
          <span class="synergy-pill-name">${p.name}</span>
          <span class="synergy-pill-sub">${p.rankTierName} • ${pCount} PJ</span>
        </div>
      </button>
    `;
  }).join('');

  // Tarjetas de Party de 1, 2, 3, 5
  const partySizeCardsHtml = [1, 2, 3, 5].map(size => {
    const b = partyBuckets[size];
    const losses = b.total - b.wins;
    const wr = b.total > 0 ? (b.wins / b.total) * 100 : 0;
    const sharePct = totalMatches > 0 ? ((b.total / totalMatches) * 100).toFixed(0) : 0;
    const wrClass = b.total === 0 ? '' : (wr >= 50 ? 'green' : 'red');

    let breakdownHtml = '';
    if (size === 1) {
      breakdownHtml = `
        <div class="party-sub-row">
          <span>👤 Solitario (Sin party)</span>
          <strong>${b.total} PJ</strong>
        </div>
      `;
    } else if (size === 2 || size === 3) {
      const pureWr = b.pureGroup > 0 ? `${((b.pureGroupWins / b.pureGroup) * 100).toFixed(0)}% WR` : '-';
      const rndWr = b.withRandom > 0 ? `${((b.withRandomWins / b.withRandom) * 100).toFixed(0)}% WR` : '-';
      breakdownHtml = `
        <div class="party-sub-row">
          <span>✅ Puro del Dashboard (${size} del grupo)</span>
          <strong>${b.pureGroup} PJ (${pureWr})</strong>
        </div>
        <div class="party-sub-row ${b.withRandom > 0 ? 'random-highlight' : ''}">
          <span>🎲 Con Random externo</span>
          <strong>${b.withRandom} PJ (${rndWr})</strong>
        </div>
      `;
    } else if (size === 5) {
      const pureWr = b.pureGroup > 0 ? `${((b.pureGroupWins / b.pureGroup) * 100).toFixed(0)}% WR` : '-';
      const fourWr = b.fourPlusOneRandom > 0 ? `${((b.fourPlusOneRandomWins / b.fourPlusOneRandom) * 100).toFixed(0)}% WR` : '-';
      const otherWr = b.otherRandomStack > 0 ? `${((b.otherRandomStackWins / b.otherRandomStack) * 100).toFixed(0)}% WR` : '-';
      breakdownHtml = `
        <div class="party-sub-row">
          <span>✅ Stack 5 Puro (5 del Dashboard)</span>
          <strong>${b.pureGroup} PJ (${pureWr})</strong>
        </div>
        <div class="party-sub-row ${b.fourPlusOneRandom > 0 ? 'random-highlight' : ''}">
          <span>🎲 4 del Grupo + 1 Random (5to externo)</span>
          <strong>${b.fourPlusOneRandom} PJ (${fourWr})</strong>
        </div>
        ${b.otherRandomStack > 0 ? `
        <div class="party-sub-row random-highlight">
          <span>🎲 Stack 5 con 2+ Randoms externos</span>
          <strong>${b.otherRandomStack} PJ (${otherWr})</strong>
        </div>
        ` : ''}
      `;
    }

    return `
      <div class="party-size-card ${b.total === 0 ? 'empty-party-card' : ''}">
        <div class="party-size-header">
          <span class="party-size-title">${b.icon} ${b.label}</span>
          <span class="party-share-badge">${sharePct}% del total</span>
        </div>
        <div class="party-size-main">
          <div>
            <div class="party-big-count">${b.total} <small>partidas</small></div>
            <div class="party-record">
              <span class="green">${b.wins}W</span> / <span class="red">${losses}L</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="party-wr-value ${wrClass}">${b.total > 0 ? `${wr.toFixed(1)}%` : '-'}</div>
            <div class="party-wr-label">Winrate</div>
          </div>
        </div>
        <div class="progress-bar-bg" style="margin: 10px 0 12px 0;">
          <div class="progress-bar-fill" style="width:${b.total > 0 ? wr : 0}%; background:${wr >= 50 ? '#22c55e' : '#ef4444'};"></div>
        </div>
        <div class="party-breakdown-box">
          ${breakdownHtml}
        </div>
      </div>
    `;
  }).join('');

  // Tabla de compañeros del dashboard
  const allCompanions = [...companionsMap.values()];
  const activeCompanions = allCompanions
    .filter(c => c.games > 0)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return (b.wins / b.games) - (a.wins / a.games);
    });
  const zeroCompanions = allCompanions.filter(c => c.games === 0);

  const companionsRowsHtml = activeCompanions.map((c, idx) => {
    const wr = (c.wins / c.games) * 100;
    const wrClass = wr >= 50 ? 'green' : 'red';
    const shareOfParty = totalInParty > 0 ? ((c.games / totalInParty) * 100).toFixed(0) : 0;

    const badges = [];
    if (c.byPartySize[2] > 0) badges.push(`<span class="mini-party-tag">👥 Dúo: ${c.byPartySize[2]}</span>`);
    if (c.byPartySize[3] > 0) badges.push(`<span class="mini-party-tag">☘️ Trío: ${c.byPartySize[3]}</span>`);
    if (c.byPartySize[5] > 0) {
      const pure5 = c.byPartySize[5] - c.inFourPlusOne;
      if (pure5 > 0) badges.push(`<span class="mini-party-tag">🖐️ Stack 5: ${pure5}</span>`);
      if (c.inFourPlusOne > 0) badges.push(`<span class="mini-party-tag tag-random">🎲 4+1 Random: ${c.inFourPlusOne}</span>`);
    }

    return `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${c.avatar}" style="width:28px; height:28px; border-radius:6px;" onerror="this.onerror=null;this.src='assets/icons/dota2-logo.png';">
            <div>
              <div style="font-weight:700; color:#fff;">${c.name}</div>
              <div style="font-size:0.75rem; color:#f59e0b;">${c.rankTierName}</div>
            </div>
          </div>
        </td>
        <td>
          <strong>${c.games} PJ</strong>
          <div style="font-size:0.75rem; color:#888;">Presente en el ${shareOfParty}% de sus parties</div>
        </td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${badges.join('') || '-'}
          </div>
        </td>
        <td><span class="green">${c.wins}W</span> / <span class="red">${c.losses}L</span></td>
        <td>
          <span class="${wrClass}" style="font-weight:700;">${wr.toFixed(1)}%</span>
          <div class="progress-bar-bg" style="width:110px;">
            <div class="progress-bar-fill" style="width:${wr}%; background:${wr >= 50 ? '#22c55e' : '#ef4444'};"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Formaciones exactas más jugadas
  const sortedStacks = [...stackCombinations.values()].sort((a, b) => b.games - a.games);
  const stacksRowsHtml = sortedStacks.map((st, idx) => {
    const losses = st.games - st.wins;
    const wr = (st.wins / st.games) * 100;
    const wrClass = wr >= 50 ? 'green' : 'red';
    const membersNames = [currentPlayer.name, ...st.companionNames];
    const randomBadge = st.randomsCount > 0
      ? `<span class="mini-party-tag tag-random">+ 🎲 ${st.randomsCount} Random${st.randomsCount > 1 ? 's' : ''} externo${st.randomsCount > 1 ? 's' : ''}</span>`
      : `<span class="mini-party-tag tag-pure">100% Grupo</span>`;

    return `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>Party de ${st.partySize}</strong></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span>${membersNames.join(' + ')}</span>
            ${randomBadge}
          </div>
        </td>
        <td><strong>${st.games}</strong></td>
        <td><span class="green">${st.wins}W</span> / <span class="red">${losses}L</span></td>
        <td>
          <span class="${wrClass}" style="font-weight:700;">${wr.toFixed(1)}%</span>
        </td>
      </tr>
    `;
  }).join('');

  const zeroCompanionsHtml = zeroCompanions.length > 0 ? `
    <div style="margin-top:14px; font-size:0.85rem; color:#888;">
      💤 <strong>Sin partidas juntos en este período (${days}d):</strong>
      ${zeroCompanions.map(c => c.name).join(', ')}
    </div>
  ` : '';

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header-row">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h2>🤝 Sinergia de Players & Análisis de Parties</h2>
            <span class="weekly-period-badge">🎯 Exclusivo Ranked • ${periodMeta.title}</span>
          </div>
          <p class="subtitle">Analizando partidas competitivas (${fromDateStr} al ${toDateStr}) para <strong>${currentPlayer.name}</strong>.</p>
        </div>
        <div class="sort-toggle-group" role="group" aria-label="Filtro de período">
          <span class="sort-label">Período:</span>
          <button type="button" class="sort-btn period-btn ${days === 7 ? 'active' : ''}" data-days="7">7 Días (Semanal)</button>
          <button type="button" class="sort-btn period-btn ${days === 30 ? 'active' : ''}" data-days="30">30 Días</button>
          <button type="button" class="sort-btn period-btn ${days === 90 ? 'active' : ''}" data-days="90">Últ. 90 Días</button>
        </div>
      </div>

      <!-- Selector de Jugador -->
      <div class="synergy-player-selector-bar">
        <span class="synergy-selector-label">👤 Elegí un jugador para ver su sinergia:</span>
        <div class="synergy-players-list">
          ${playerSelectorHtml}
        </div>
      </div>

      <!-- Resumen KPI del Jugador Seleccionado -->
      <div class="metrics-cards-row">
        <div class="metric-card">
          <div class="label">Partidas Ranked (${periodMeta.short})</div>
          <div class="value">${totalMatches}</div>
          <div class="metric-sub">
            <span class="green">${totalWins}W</span> / <span class="red">${totalMatches - totalWins}L</span> •
            <strong class="${parseFloat(overallWr) >= 50 ? 'green' : 'red'}">${overallWr}% WR</strong>
          </div>
        </div>
        <div class="metric-card">
          <div class="label">Partidas en Party (2, 3 o 5)</div>
          <div class="value">${totalInParty} <small style="font-size:0.95rem; color:#888;">de ${totalMatches}</small></div>
          <div class="metric-sub">
            Winrate en Party: <strong class="${parseFloat(partyWr) >= 50 ? 'green' : 'red'}">${totalInParty > 0 ? `${partyWr}%` : '-'}</strong>
          </div>
        </div>
        <div class="metric-card">
          <div class="label">🎲 Parties de 5 con "4 + 1 Random"</div>
          <div class="value" style="color:#fbbf24;">${totalFourPlusOneRandom}</div>
          <div class="metric-sub">
            4 del dashboard + 1 externo • WR: <strong class="${parseFloat(fourPlusOneWr) >= 50 ? 'green' : 'red'}">${totalFourPlusOneRandom > 0 ? `${fourPlusOneWr}%` : '-'}</strong>
          </div>
        </div>
        <div class="metric-card">
          <div class="label">🎲 Total Parties con algún Random</div>
          <div class="value">${totalMatchesWithRandom}</div>
          <div class="metric-sub">
            Incluyendo al menos 1 externo al dashboard • WR: <strong class="${parseFloat(randomWr) >= 50 ? 'green' : 'red'}">${totalMatchesWithRandom > 0 ? `${randomWr}%` : '-'}</strong>
          </div>
        </div>
      </div>

      <!-- Desglose por Tamaño de Party (1, 2, 3, 5) -->
      <div class="synergy-section-block">
        <h3 class="synergy-section-title">📊 Rendimiento por Tamaño de Party (1, 2, 3 y 5)</h3>
        <div class="party-sizes-grid">
          ${partySizeCardsHtml}
        </div>
      </div>

      <!-- Tabla de Compañeros del Dashboard -->
      <div class="synergy-section-block">
        <h3 class="synergy-section-title">👥 Rendimiento de ${currentPlayer.name} con cada Compañero del Grupo (${periodMeta.short})</h3>
        <div style="overflow-x:auto;">
          <table class="matches-table" style="font-size:0.95rem;">
            <thead>
              <tr>
                <th>#</th>
                <th>Compañero</th>
                <th>Partidas Juntos</th>
                <th>Cómo jugaron (Tamaño de Party)</th>
                <th>Récord Juntos</th>
                <th>Winrate Juntos</th>
              </tr>
            </thead>
            <tbody>
              ${companionsRowsHtml || `<tr><td colspan="6" style="text-align:center; padding:20px; color:#777;">${currentPlayer.name} no registró partidas compartidas con el grupo en los últimos ${days} días.</td></tr>`}
            </tbody>
          </table>
        </div>
        ${zeroCompanionsHtml}
      </div>

      <!-- Formaciones / Stacks Exactos -->
      <div class="synergy-section-block" style="margin-bottom:0;">
        <h3 class="synergy-section-title">🧩 Formaciones de Party de ${currentPlayer.name} (${periodMeta.short})</h3>
        <div style="overflow-x:auto;">
          <table class="matches-table" style="font-size:0.92rem;">
            <thead>
              <tr>
                <th>#</th>
                <th>Tipo de Party</th>
                <th>Integrantes de la Party</th>
                <th>Partidas</th>
                <th>Récord (V/D)</th>
                <th>Winrate</th>
              </tr>
            </thead>
            <tbody>
              ${stacksRowsHtml || `<tr><td colspan="6" style="text-align:center; padding:20px; color:#777;">No hay partidas en party registradas en los últimos ${days} días.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Eventos de cambio de período
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

  // Eventos de selección de jugador
  if (onSelectPlayer) {
    container.querySelectorAll('.synergy-player-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = parseInt(btn.dataset.playerId, 10);
        if (pid && pid !== currentPlayer.accountId) {
          onSelectPlayer(pid);
        }
      });
    });
  }
}
