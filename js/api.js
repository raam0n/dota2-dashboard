import { CONFIG } from './config.js';

const profileCache = new Map();
const matchesCache = new Map();
const profileInFlight = new Map();
const matchesInFlight = new Map();
let heroesCache = null;
let heroesInFlight = null;

// Nombres y medallas según rank_tier de Dota 2 (ej: 11 = Herald 1, 80 = Immortal)
const RANK_TIERS = {
  1: 'Herald',
  2: 'Guardian',
  3: 'Crusader',
  4: 'Archon',
  5: 'Legend',
  6: 'Ancient',
  7: 'Divine',
  8: 'Immortal'
};

export function getRankTierName(rankTier, leaderboardRank) {
  if (!rankTier) return 'Uncalibrated';
  const tier = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  const name = RANK_TIERS[tier] || 'Rank';
  if (tier === 8) {
    return leaderboardRank ? `Immortal #${leaderboardRank}` : 'Immortal';
  }
  return `${name} [${stars}]`;
}

export function estimateMmr(rankTier, leaderboardRank) {
  if (!rankTier) return 0;
  const tier = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  if (tier === 8) {
    if (leaderboardRank && leaderboardRank > 0) {
      return Math.max(6000, 11000 - Math.floor(leaderboardRank * 1.1));
    }
    return 6000;
  }
  // Aproximación estándar de MMR por medalla en Dota 2 (~150 MMR por estrella)
  const baseMmr = (tier - 1) * 770;
  return baseMmr + (stars * 154);
}

/**
 * Carga la lista de héroes de Dota 2 (con deduplicación de peticiones en vuelo)
 */
export async function getHeroesMap() {
  if (heroesCache) return heroesCache;
  if (heroesInFlight) return heroesInFlight;

  heroesInFlight = (async () => {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/constants/heroes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      heroesCache = new Map();
      Object.values(data).forEach(h => {
        heroesCache.set(h.id, {
          id: h.id,
          name: h.localized_name,
          icon: h.icon ? `${CONFIG.STEAM_CDN}${h.icon}` : '',
          img: h.img ? `${CONFIG.STEAM_CDN}${h.img}` : ''
        });
      });
      return heroesCache;
    } catch (err) {
      console.error('Error cargando lista de héroes:', err);
      return new Map();
    } finally {
      heroesInFlight = null;
    }
  })();

  return heroesInFlight;
}

/**
 * Obtiene los IDs configurados por el usuario
 */
export function getAllConfiguredPlayerIds() {
  const urlParams = new URLSearchParams(window.location.search);
  const idsParam = urlParams.get('ids');
  if (idsParam) {
    const parsed = idsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (parsed.length > 0) return parsed;
  }

  const stored = localStorage.getItem(CONFIG.STORAGE_KEY_PLAYERS);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...new Set([...CONFIG.DEFAULT_PLAYER_IDS, ...parsed])];
      }
    } catch (e) {
      console.warn('Error leyendo localStorage:', e);
    }
  }
  return [...CONFIG.DEFAULT_PLAYER_IDS];
}

export function getDisabledPlayerIds() {
  const stored = localStorage.getItem(CONFIG.STORAGE_KEY_DISABLED);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('Error leyendo disabled IDs:', e);
    }
  }
  return [];
}

export function saveDisabledPlayerIds(disabledIds) {
  localStorage.setItem(CONFIG.STORAGE_KEY_DISABLED, JSON.stringify(disabledIds));
}

export function saveActivePlayerIds(ids) {
  localStorage.setItem(CONFIG.STORAGE_KEY_PLAYERS, JSON.stringify(ids));
}

export function getActivePlayerIds() {
  const allIds = getAllConfiguredPlayerIds();
  const disabledIds = getDisabledPlayerIds();
  return allIds.filter(id => !disabledIds.includes(id));
}

/**
 * Obtiene el perfil de un jugador desde OpenDota
 */
export async function fetchProfile(accountId, forceRefresh = false) {
  if (!forceRefresh && profileCache.has(accountId)) {
    return profileCache.get(accountId);
  }
  if (profileInFlight.has(accountId)) {
    return profileInFlight.get(accountId);
  }

  const req = (async () => {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/players/${accountId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      profileCache.set(accountId, data);
      return data;
    } catch (err) {
      console.error(`Error al obtener perfil ${accountId}:`, err);
      return profileCache.get(accountId) || null;
    } finally {
      profileInFlight.delete(accountId);
    }
  })();

  profileInFlight.set(accountId, req);
  return req;
}

/**
 * Obtiene todas las partidas RANKED (lobby_type=7) de los últimos 90 días de un jugador (sin el tope de 20).
 * Si el jugador tiene menos de 10 partidas ranked en los últimos 90 días, complementa con las últimas 10 históricas ranked
 * para mantener siempre la fecha de última partida, racha y el desplegable de la tarjeta.
 */
export async function fetchRecentMatches(accountId, forceRefresh = false) {
  if (!forceRefresh && matchesCache.has(accountId)) {
    return matchesCache.get(accountId);
  }
  if (matchesInFlight.has(accountId)) {
    return matchesInFlight.get(accountId);
  }

  const req = (async () => {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/players/${accountId}/matches?date=90&lobby_type=7`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = ((await res.json()) || []).filter(m => m.lobby_type === 7);

      if (data.length < 10) {
        try {
          const fallbackRes = await fetch(`${CONFIG.API_BASE_URL}/players/${accountId}/matches?limit=10&lobby_type=7`);
          if (fallbackRes.ok) {
            const fallbackData = ((await fallbackRes.json()) || []).filter(m => m.lobby_type === 7);
            const seenIds = new Set(data.map(m => m.match_id));
            for (const m of fallbackData) {
              if (!seenIds.has(m.match_id)) {
                data.push(m);
                seenIds.add(m.match_id);
              }
            }
            data.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
          }
        } catch (fallbackErr) {
          console.warn(`Error en fallback de partidas ranked para ${accountId}:`, fallbackErr);
        }
      }

      matchesCache.set(accountId, data);
      return data;
    } catch (err) {
      console.error(`Error al obtener partidas ranked de ${accountId}:`, err);
      return matchesCache.get(accountId) || [];
    } finally {
      matchesInFlight.delete(accountId);
    }
  })();

  matchesInFlight.set(accountId, req);
  return req;
}

/**
 * Formatea fecha dd/mm/yyyy
 */
export function formatDateDDMMYYYY(val) {
  if (!val) return 'Sin registro';
  const d = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
  if (isNaN(d.getTime())) return 'Sin registro';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calcula todas las estadísticas procesadas de un jugador
 */
export async function getPlayerStats(accountId, forceRefresh = false) {
  const [profile, recentMatchesRaw, heroesMap] = await Promise.all([
    fetchProfile(accountId, forceRefresh),
    fetchRecentMatches(accountId, forceRefresh),
    getHeroesMap()
  ]);

  if (!profile) return null;

  const prof = profile.profile || {};
  const name = prof.personaname || `Player #${accountId}`;
  const avatar = prof.avatarfull || prof.avatar || 'assets/icons/dota2-logo.png';
  const rankTier = profile.rank_tier || 0;
  const leaderboardRank = profile.leaderboard_rank || null;
  const rankTierName = getRankTierName(rankTier, leaderboardRank);
  const currentElo = estimateMmr(rankTier, leaderboardRank);
  const maxElo = profile.mmr_estimate?.estimate ? Math.max(currentElo, profile.mmr_estimate.estimate) : currentElo;

  // Procesamos partidas mapeando héroe, victoria/derrota, facción y metadatos de la partida
  const matches = (recentMatchesRaw || []).map(m => {
    const isRadiant = m.player_slot < 128;
    const won = (isRadiant && m.radiant_win) || (!isRadiant && !m.radiant_win);
    const heroInfo = heroesMap.get(m.hero_id) || { name: `Hero #${m.hero_id}`, icon: '', img: '' };
    return {
      matchId: m.match_id,
      started: m.start_time,
      duration: m.duration,
      won,
      isRadiant,
      partySize: m.party_size || null,
      gameMode: m.game_mode,
      lobbyType: m.lobby_type,
      averageRank: m.average_rank || null,
      leaverStatus: m.leaver_status || 0,
      heroId: m.hero_id,
      heroName: heroInfo.name,
      heroImg: heroInfo.img,
      heroIcon: heroInfo.icon,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      kda: `${m.kills}/${m.deaths}/${m.assists}`
    };
  });

  // Racha actual
  let streak = 0;
  if (matches.length > 0) {
    const firstWon = matches[0].won;
    for (const m of matches) {
      if (m.won === firstWon) {
        streak += firstWon ? 1 : -1;
      } else {
        break;
      }
    }
  }

  // Última partida
  const lastMatchTimestamp = matches[0]?.started ? matches[0].started * 1000 : 0;
  const lastMatchDate = lastMatchTimestamp > 0 ? formatDateDDMMYYYY(new Date(lastMatchTimestamp).toISOString()) : 'Sin registro';

  return {
    accountId,
    name,
    avatar,
    profileUrl: prof.profileurl || `https://www.opendota.com/players/${accountId}`,
    rankTier,
    rankTierName,
    leaderboardRank,
    currentElo,
    maxElo,
    streak,
    lastMatchTimestamp,
    lastMatchDate,
    matches
  };
}
