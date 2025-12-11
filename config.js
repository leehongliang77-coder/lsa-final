export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;

export const GAME_TIME_LIMIT = 60000;
export const MAX_ENERGY = 100;
export const WIN_BONUS = 500;

export const ATTACK_COOLDOWN_MS = 500;
export const CROSS_COOLDOWN_MS = 1000;
export const SUPER_COOLDOWN_MS = 2000;
export const COUNTER_COOLDOWN_MS = 1000;
export const DEFENSE_REACTION_MS = 1000;

export const NORMAL_DAMAGE = 5;
export const ULTIMATE_DAMAGE = 10;
export const SUPER_DAMAGE = 20;
export const COUNTER_DAMAGE = 5;

export const SUPER_ENERGY_COST = 100;
export const ENERGY_PER_ATTACK = 5;
export const ENERGY_PER_ULTIMATE = 15;

export const GRID_ROWS = 4;
export const GRID_COLS = 4;
export const CELL_WIDTH = VIDEO_WIDTH / GRID_COLS;
export const CELL_HEIGHT = VIDEO_HEIGHT / GRID_ROWS;

export const P1_POOL = [
    { player: 'P1', action: 'attack', color: 'rgba(0, 0, 255, 0.4)' },
    { player: 'P1', action: 'ultimate', color: 'rgba(0, 0, 255, 0.4)' },
    { player: 'P1', action: 'charge', color: 'rgba(128, 0, 128, 0.4)' },
    { player: 'P1', action: 'defend', color: 'rgba(0, 255, 0, 0.4)' },
    { player: 'P1', action: 'super', color: 'rgba(255, 0, 0, 0.6)' },
    { player: 'P1', action: 'counter', color: 'rgba(255, 215, 0, 0.4)' }
];

export const P2_POOL = [
    { player: 'P2', action: 'attack', color: 'rgba(255, 0, 0, 0.4)' },
    { player: 'P2', action: 'ultimate', color: 'rgba(255, 0, 0, 0.4)' },
    { player: 'P2', action: 'charge', color: 'rgba(128, 0, 128, 0.4)' },
    { player: 'P2', action: 'defend', color: 'rgba(0, 255, 0, 0.4)' },
    { player: 'P2', action: 'super', color: 'rgba(255, 0, 0, 0.6)' },
    { player: 'P2', action: 'counter', color: 'rgba(255, 215, 0, 0.4)' }
];
