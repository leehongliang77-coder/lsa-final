import * as config from './config.js';
import * as state from './state.js';
import {
    setDamagePending,
    setCooldownTime,
    setEnergy,
    updateStats,
    setPlayerActionState,
    updateGridLayout
} from './state.js';

let lastActionTime = { P1: 0, P2: 0 };

const P1_SLOTS = [1, 2, 5, 6, 9, 10, 13, 14];
const P2_SLOTS = [3, 4, 7, 8, 11, 12, 15, 16];

function shuffleArray(array) {
    let newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

export function randomizeGrid() {
    let newGrid = {};
    const p1_random_slots = shuffleArray(P1_SLOTS);
    const p2_random_slots = shuffleArray(P2_SLOTS);

    config.P1_POOL.forEach((action, index) => {
        if (index < p1_random_slots.length) newGrid[p1_random_slots[index]] = action;
    });

    config.P2_POOL.forEach((action, index) => {
        if (index < p2_random_slots.length) newGrid[p2_random_slots[index]] = action;
    });

    updateGridLayout(newGrid);
    console.log("Split Grid Randomized!", newGrid);
}

export function processGameLogic(p1Keypoints, p2Keypoints) {
    if (state.isGameOver) return;
    const currentTime = performance.now();

    if (state.P1_IsCharging) setPlayerActionState('P1', 'charging', false);
    if (state.P1_IsDefending) setPlayerActionState('P1', 'defending', false);
    if (state.P2_IsCharging) setPlayerActionState('P2', 'charging', false);
    if (state.P2_IsDefending) setPlayerActionState('P2', 'defending', false);

    if (p1Keypoints) checkGridInteraction(p1Keypoints, 'P1', currentTime);
    if (p2Keypoints) checkGridInteraction(p2Keypoints, 'P2', currentTime);
}

function checkGridInteraction(keypoints, player, time) {
    const leftWrist = keypoints[9];
    const rightWrist = keypoints[10];

    if (leftWrist && leftWrist.score > 0.3) {
        triggerActionByGrid(leftWrist.x, leftWrist.y, player, time);
    }

    if (rightWrist && rightWrist.score > 0.3) {
        triggerActionByGrid(rightWrist.x, rightWrist.y, player, time);
    }
}

function triggerActionByGrid(x, y, player, time) {
    const col = Math.floor(x / config.CELL_WIDTH);
    const row = Math.floor(y / config.CELL_HEIGHT);

    if (col < 0 || col >= config.GRID_COLS || row < 0 || row >= config.GRID_ROWS) return;

    const cellNum = row * config.GRID_COLS + col + 1;
    const cellConfig = state.currentGridLayout[cellNum];

    if (cellConfig && cellConfig.player === player) {
        switch (cellConfig.action) {
            case 'attack':
                if (time - lastActionTime[player] > config.ATTACK_COOLDOWN_MS) {
                    setDamagePending(player, time, config.NORMAL_DAMAGE, 'Attack');
                    updateStats(player, 'attackCount', 1);
                    lastActionTime[player] = time;
                }
                break;

            case 'ultimate':
                if (time - lastActionTime[player] > config.CROSS_COOLDOWN_MS) {
                    setDamagePending(player, time, config.ULTIMATE_DAMAGE, 'Skill');
                    updateStats(player, 'attackCount', 1);
                    lastActionTime[player] = time;
                }
                break;

            case 'super':
                const currentEnergy = player === 'P1' ? state.P1_Energy : state.P2_Energy;
                const superTime = player === 'P1' ? state.P1_SuperTime : state.P2_SuperTime;

                if (currentEnergy >= config.SUPER_ENERGY_COST && (time - superTime) > config.SUPER_COOLDOWN_MS) {
                    setDamagePending(player, time, config.SUPER_DAMAGE, 'Super');
                    setCooldownTime(player, 'SuperTime', time);
                    updateStats(player, 'superUsed', 1);
                    const enemyEnergy = player === 'P1' ? state.P2_Energy : state.P1_Energy;
                    if (player === 'P1') setEnergy(0, enemyEnergy);
                    else setEnergy(state.P1_Energy, 0);
                }
                break;

            case 'charge':
                addEnergy(player, 0.15);
                setPlayerActionState(player, 'charging', true);
                break;

            case 'defend':
                setPlayerActionState(player, 'defending', true);
                break;

            case 'counter':
                if (time - (player === 'P1' ? state.P1_CounterTime : state.P2_CounterTime) > config.COUNTER_COOLDOWN_MS) {
                    setPlayerActionState(player, 'countering', true);
                }
                break;
        }
    }
}

function addEnergy(player, amount) {
    const current = player === 'P1' ? state.P1_Energy : state.P2_Energy;
    const newEnergy = Math.min(config.MAX_ENERGY, current + amount);
    const enemyEnergy = player === 'P1' ? state.P2_Energy : state.P1_Energy;
    if (player === 'P1') setEnergy(newEnergy, enemyEnergy);
    else setEnergy(state.P1_Energy, newEnergy);
}
