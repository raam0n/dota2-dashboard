import { CONFIG } from './config.js';
import { 
  getActivePlayerIds, 
  getAllConfiguredPlayerIds, 
  getDisabledPlayerIds, 
  saveDisabledPlayerIds, 
  saveActivePlayerIds, 
  getPlayerStats,
  fetchProfile,
  formatDateDDMMYYYY
} from './api.js';
import { renderPlayersGrid, showPlayerModal } from './dashboard.js';
import { renderWeeklyView } from './weekly.js';
import { renderTopHeroesView } from './heroes.js';

const state = {
  currentTab: 'ranking', // 'ranking' | 'weekly' | 'heroes'
  eloSortBy: 'current',   // 'current' | 'max'
  playerIds: getActivePlayerIds(),
  playersData: [],
  isLoading: false,
  pollTimer: null
};

const elements = {
  contentArea: document.getElementById('contentArea'),
  rankingToolbar: document.getElementById('rankingToolbar'),
  sortBtns: document.querySelectorAll('.sort-btn'),
  navTabs: document.querySelectorAll('.nav-tab'),
  refreshBtn: document.getElementById('refreshBtn'),
  addPlayerBtn: document.getElementById('addPlayerBtn'),
  addPlayerModal: document.getElementById('addPlayerModal'),
  addPlayerInput: document.getElementById('addPlayerInput'),
  confirmAddBtn: document.getElementById('confirmAddBtn'),
  cancelAddBtn: document.getElementById('cancelAddBtn'),
  managePlayersBtn: document.getElementById('managePlayersBtn'),
  managePlayersModal: document.getElementById('managePlayersModal'),
  closeManageBtn: document.getElementById('closeManageBtn'),
  playersChecklistContainer: document.getElementById('playersChecklistContainer'),
  searchPlayersListInput: document.getElementById('searchPlayersListInput'),
  selectAllPlayersBtn: document.getElementById('selectAllPlayersBtn'),
  deselectAllPlayersBtn: document.getElementById('deselectAllPlayersBtn'),
  resetDefaultPlayersBtn: document.getElementById('resetDefaultPlayersBtn'),
  applyPlayersListBtn: document.getElementById('applyPlayersListBtn'),
  checklistSummaryText: document.getElementById('checklistSummaryText'),
  activeCountBadge: document.getElementById('activeCountBadge'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalContainer: document.getElementById('modalContainer')
};

async function init() {
  setupEventListeners();
  await loadAllData(false);
  startPolling();
}

function setupEventListeners() {
  // Cambio de pestañas
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentTab = tab.dataset.tab;
      renderCurrentView();
    });
  });

  // Ordenar por MMR actual vs Max
  elements.sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.eloSortBy = btn.dataset.sort;
      renderCurrentView();
    });
  });

  // Refrescar
  elements.refreshBtn.addEventListener('click', async () => {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.innerHTML = '🔄 Cargando...';
    await loadAllData(true);
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.innerHTML = '🔄 Refrescar';
  });

  // Agregar jugador
  elements.addPlayerBtn.addEventListener('click', () => {
    elements.addPlayerModal.classList.add('active');
    elements.addPlayerInput.value = '';
    elements.addPlayerInput.focus();
  });

  elements.cancelAddBtn.addEventListener('click', () => {
    elements.addPlayerModal.classList.remove('active');
  });

  elements.confirmAddBtn.addEventListener('click', async () => {
    const val = elements.addPlayerInput.value.trim();
    if (!val) return;
    const allConfigured = getAllConfiguredPlayerIds();
    const newIds = val.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && !allConfigured.includes(n));

    if (newIds.length > 0) {
      allConfigured.push(...newIds);
      saveActivePlayerIds(allConfigured);
      const disabled = getDisabledPlayerIds().filter(id => !newIds.includes(id));
      saveDisabledPlayerIds(disabled);
      state.playerIds = getActivePlayerIds();
      elements.addPlayerModal.classList.remove('active');
      await loadAllData(true);
    } else {
      alert('Ingresa uno o varios Account IDs de Dota 2 válidos (ej: 70388657).');
    }
  });

  // Gestionar / Personalizar jugadores
  elements.managePlayersBtn.addEventListener('click', () => openManagePlayersModal());
  elements.closeManageBtn.addEventListener('click', () => elements.managePlayersModal.classList.remove('active'));

  elements.selectAllPlayersBtn.addEventListener('click', () => {
    elements.playersChecklistContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      cb.closest('.player-check-item').classList.add('checked');
    });
    updateChecklistSummary();
  });

  elements.deselectAllPlayersBtn.addEventListener('click', () => {
    elements.playersChecklistContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.closest('.player-check-item').classList.remove('checked');
    });
    updateChecklistSummary();
  });

  elements.resetDefaultPlayersBtn.addEventListener('click', async () => {
    if (!confirm(`¿Restaurar los ${CONFIG.DEFAULT_PLAYERS.length} jugadores predeterminados?`)) return;
    localStorage.removeItem(CONFIG.STORAGE_KEY_PLAYERS);
    localStorage.removeItem(CONFIG.STORAGE_KEY_DISABLED);
    state.playerIds = getActivePlayerIds();
    elements.managePlayersModal.classList.remove('active');
    await loadAllData(true);
  });

  elements.applyPlayersListBtn.addEventListener('click', async () => {
    const disabled = [];
    elements.playersChecklistContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) disabled.push(parseInt(cb.value, 10));
    });
    saveDisabledPlayerIds(disabled);
    state.playerIds = getActivePlayerIds();
    elements.managePlayersModal.classList.remove('active');
    await loadAllData(false);
  });

  elements.searchPlayersListInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    elements.playersChecklistContainer.querySelectorAll('.player-check-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
    });
  });

  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) elements.modalOverlay.classList.remove('active');
  });
  elements.addPlayerModal.addEventListener('click', (e) => {
    if (e.target === elements.addPlayerModal) elements.addPlayerModal.classList.remove('active');
  });
  elements.managePlayersModal.addEventListener('click', (e) => {
    if (e.target === elements.managePlayersModal) elements.managePlayersModal.classList.remove('active');
  });
}

async function loadAllData(forceRefresh = false) {
  state.isLoading = true;
  elements.contentArea.innerHTML = `
    <div class="loading-box">
      <div class="spinner"></div>
      <p>Cargando datos de ${state.playerIds.length} jugadores de Dota 2...</p>
    </div>
  `;

  try {
    const results = [];
    const batchSize = 4;
    for (let i = 0; i < state.playerIds.length; i += batchSize) {
      const batch = state.playerIds.slice(i, i + batchSize);
      const batchRes = await Promise.all(batch.map(id => getPlayerStats(id, forceRefresh)));
      results.push(...batchRes.filter(Boolean));
    }
    state.playersData = results;
  } catch (err) {
    console.error('Error cargando jugadores:', err);
  } finally {
    state.isLoading = false;
    renderCurrentView();
  }
}

function renderCurrentView() {
  if (elements.activeCountBadge) {
    elements.activeCountBadge.textContent = state.playerIds.length;
  }

  if (elements.rankingToolbar) {
    elements.rankingToolbar.style.display = state.currentTab === 'ranking' ? 'flex' : 'none';
  }

  if (state.isLoading) return;

  if (state.currentTab === 'ranking') {
    elements.contentArea.className = 'cards-grid';
    renderPlayersGrid(state.playersData, elements.contentArea, onCardClick, onRemovePlayer, state.eloSortBy);
  } else if (state.currentTab === 'weekly') {
    elements.contentArea.className = '';
    renderWeeklyView(state.playersData, elements.contentArea);
  } else if (state.currentTab === 'heroes') {
    elements.contentArea.className = '';
    renderTopHeroesView(state.playersData, elements.contentArea);
  }
}

function onCardClick(player) {
  showPlayerModal(player, elements.modalContainer, elements.modalOverlay);
}

async function onRemovePlayer(accountId) {
  if (!confirm('¿Deseas ocultar este jugador del dashboard?')) return;
  const disabled = getDisabledPlayerIds();
  if (!disabled.includes(accountId)) {
    disabled.push(accountId);
    saveDisabledPlayerIds(disabled);
  }
  state.playerIds = getActivePlayerIds();
  state.playersData = state.playersData.filter(p => p.accountId !== accountId);
  renderCurrentView();
}

function dateStrToSortableInt(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return 0;
  return parseInt(`${m[3]}${m[2]}${m[1]}`, 10) || 0;
}

function openManagePlayersModal() {
  const allConfigured = getAllConfiguredPlayerIds();
  const disabledIds = getDisabledPlayerIds();
  const nameMap = new Map();
  const lastMatchMap = new Map();
  const lastMatchTsMap = new Map();

  CONFIG.DEFAULT_PLAYERS.forEach(p => nameMap.set(p.id, p.name));
  state.playersData.forEach(p => {
    if (p && p.accountId) {
      if (p.name) nameMap.set(p.accountId, p.name);
      if (p.lastMatchDate) lastMatchMap.set(p.accountId, p.lastMatchDate);
      if (p.lastMatchTimestamp) lastMatchTsMap.set(p.accountId, p.lastMatchTimestamp);
    }
  });

  const sortedIds = [...allConfigured].sort((a, b) => {
    const dayA = dateStrToSortableInt(lastMatchMap.get(a));
    const dayB = dateStrToSortableInt(lastMatchMap.get(b));
    if (dayB !== dayA) return dayB - dayA;
    const tsA = lastMatchTsMap.get(a) ?? -1;
    const tsB = lastMatchTsMap.get(b) ?? -1;
    if (tsB !== tsA) return tsB - tsA;
    return (nameMap.get(a) || '').localeCompare(nameMap.get(b) || '');
  });

  elements.playersChecklistContainer.innerHTML = sortedIds.map(id => {
    const isChecked = !disabledIds.includes(id);
    const playerName = nameMap.get(id) || `Player #${id}`;
    const lastMatchStr = lastMatchMap.get(id) || 'Cargando...';
    return `
      <label class="player-check-item ${isChecked ? 'checked' : ''}" data-item-id="${id}">
        <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''}>
        <div class="player-check-info">
          <span class="player-check-name" title="${playerName}">${playerName}</span>
          <span class="player-check-id">ID: ${id} • Últ. partida: ${lastMatchStr}</span>
        </div>
      </label>
    `;
  }).join('');

  elements.playersChecklistContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.player-check-item').classList.toggle('checked', cb.checked);
      updateChecklistSummary();
    });
  });

  elements.searchPlayersListInput.value = '';
  updateChecklistSummary();
  elements.managePlayersModal.classList.add('active');
}

function updateChecklistSummary() {
  const total = elements.playersChecklistContainer.querySelectorAll('input[type="checkbox"]').length;
  const checked = elements.playersChecklistContainer.querySelectorAll('input[type="checkbox"]:checked').length;
  elements.checklistSummaryText.textContent = `${checked} de ${total} seleccionados`;
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    console.log('🔄 Actualizando datos de Dota 2...');
    try {
      const results = [];
      const batchSize = 4;
      for (let i = 0; i < state.playerIds.length; i += batchSize) {
        const batch = state.playerIds.slice(i, i + batchSize);
        const batchRes = await Promise.all(batch.map(id => getPlayerStats(id, true)));
        results.push(...batchRes.filter(Boolean));
      }
      state.playersData = results;
      renderCurrentView();
    } catch (e) {
      console.warn('Error en polling:', e);
    }
  }, CONFIG.POLL_INTERVAL_MS);
}

window.addEventListener('DOMContentLoaded', init);
