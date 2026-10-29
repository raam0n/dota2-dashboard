// Configuración del Dashboard de Dota 2
export const CONFIG = {
  API_BASE_URL: 'https://api.opendota.com/api',
  STEAM_CDN: 'https://cdn.cloudflare.steamstatic.com',
  // Jugadores iniciales por defecto (Steam 32-bit Account IDs).
  DEFAULT_PLAYERS: [
    { id: 57629155, name: 'EvilFoca' },
    { id: 469201242, name: 'La Alpaca Justiciera' },
    { id: 803382042, name: 'Kouchi' },
    { id: 1028262342, name: 'Molotrotsky' },
    { id: 58990899, name: 'El Principito' },
    { id: 309314472, name: 'Samuel L. Gankson' }
  ],
  get DEFAULT_PLAYER_IDS() {
    return this.DEFAULT_PLAYERS.map(p => p.id);
  },
  STORAGE_KEY_PLAYERS: 'dota2_dashboard_player_ids_v2',
  STORAGE_KEY_DISABLED: 'dota2_dashboard_disabled_ids_v2',
  POLL_INTERVAL_MS: 45000
};
