// Configuración del Dashboard de Dota 2
export const CONFIG = {
  API_BASE_URL: 'https://api.opendota.com/api',
  STEAM_CDN: 'https://cdn.cloudflare.steamstatic.com',
  // Jugadores iniciales de muestra (Steam 32-bit Account IDs).
  // Puedes reemplazarlos por los IDs de tus amigos o agregar nuevos desde la UI.
  DEFAULT_PLAYERS: [
    { id: 70388657, name: 'Dendi' },
    { id: 86745912, name: 'Arteezy' },
    { id: 111620041, name: 'Miracle-' },
    { id: 105248644, name: 'Topson' },
    { id: 87278757, name: 'Puppey' },
    { id: 94054712, name: 'N0tail' },
    { id: 25907144, name: 'Cr1t-' }
  ],
  get DEFAULT_PLAYER_IDS() {
    return this.DEFAULT_PLAYERS.map(p => p.id);
  },
  STORAGE_KEY_PLAYERS: 'dota2_dashboard_player_ids',
  STORAGE_KEY_DISABLED: 'dota2_dashboard_disabled_ids',
  POLL_INTERVAL_MS: 45000
};
