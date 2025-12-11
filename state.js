import { WIN_BONUS } from './config.js';

export let P1_HP = 100;
export let P2_HP = 100;
export let P1_HP_Display = 100;
export let P2_HP_Display = 100;
export let P1_Energy = 0;
export let P2_Energy = 0;

export let isGameOver = false;
export let gameState = 'start';
export let gameStartTime = 0;
export let remainingTime = 60;
export let scoreSaved = false;

export let P1_Name = 'Player 1';
export let P2_Name = 'Player 2';
export let viewingProfileName = '';

export let P1_Stats = { totalDamage: 0, attackCount: 0, defendCount: 0, superUsed: 0, counterSuccess: 0 };
export let P2_Stats = { totalDamage: 0, attackCount: 0, defendCount: 0, superUsed: 0, counterSuccess: 0 };

export let P1_LastAttackTime = 0;
export let P2_LastAttackTime = 0;
export let P1_CrossAttackTime = 0;
export let P2_CrossAttackTime = 0;
export let P1_ChargeAttackTime = 0;
export let P2_ChargeAttackTime = 0;
export let P1_CounterTime = 0;
export let P2_CounterTime = 0;
export let P1_SuperTime = 0;
export let P2_SuperTime = 0;

export let P1_DamagePending = { time: 0, damage: 0, type: '' };
export let P2_DamagePending = { time: 0, damage: 0, type: '' };

export let P1_IsDefending = false;
export let P2_IsDefending = false;
export let P1_IsCountering = false;
export let P2_IsCountering = false;
export let P1_IsCharging = false;
export let P2_IsCharging = false;

export let currentGridLayout = {};

export function setPlayerNames(p1, p2) {
    P1_Name = p1;
    P2_Name = p2;
}

export function setGameState(newState) {
    gameState = newState;
}

export function setViewingProfile(name) {
    viewingProfileName = name;
}

export function setIsGameOver(status) {
    isGameOver = status;
}

export function setRemainingTime(time) {
    remainingTime = time;
}

export function setGameTimeAndFlag(startTime, remaining, saved) {
    gameStartTime = startTime;
    remainingTime = remaining;
    scoreSaved = saved;
}

export function setHPDisplay(p1Display, p2Display) {
    P1_HP_Display = p1Display;
    P2_HP_Display = p2Display;
}

export function setHP(p1HP, p2HP) {
    P1_HP = p1HP;
    P2_HP = p2HP;
}

export function setEnergy(p1Energy, p2Energy) {
    P1_Energy = p1Energy;
    P2_Energy = p2Energy;
}

export function setCooldownTime(player, cooldownName, timeValue) {
    if (player === 'P1') {
        if (cooldownName === 'LastAttackTime') P1_LastAttackTime = timeValue;
        else if (cooldownName === 'CrossAttackTime') P1_CrossAttackTime = timeValue;
        else if (cooldownName === 'ChargeAttackTime') P1_ChargeAttackTime = timeValue;
        else if (cooldownName === 'CounterTime') P1_CounterTime = timeValue;
        else if (cooldownName === 'SuperTime') P1_SuperTime = timeValue;
    } else if (player === 'P2') {
        if (cooldownName === 'LastAttackTime') P2_LastAttackTime = timeValue;
        else if (cooldownName === 'CrossAttackTime') P2_CrossAttackTime = timeValue;
        else if (cooldownName === 'ChargeAttackTime') P2_ChargeAttackTime = timeValue;
        else if (cooldownName === 'CounterTime') P2_CounterTime = timeValue;
        else if (cooldownName === 'SuperTime') P2_SuperTime = timeValue;
    }
}

export function setDamagePending(player, time, damage, type) {
    if (player === 'P1') P1_DamagePending = { time: time, damage: damage, type: type };
    else if (player === 'P2') P2_DamagePending = { time: time, damage: damage, type: type };
}

export function setDefenseState(player, isDefending, isCountering) {
    if (player === 'P1') {
        P1_IsDefending = isDefending;
        P1_IsCountering = isCountering;
    } else if (player === 'P2') {
        P2_IsDefending = isDefending;
        P2_IsCountering = isCountering;
    }
}

export function setPlayerActionState(player, actionType, value) {
    if (player === 'P1') {
        if (actionType === 'charging') P1_IsCharging = value;
        else if (actionType === 'defending') P1_IsDefending = value;
        else if (actionType === 'countering') P1_IsCountering = value;
    } else if (player === 'P2') {
        if (actionType === 'charging') P2_IsCharging = value;
        else if (actionType === 'defending') P2_IsDefending = value;
        else if (actionType === 'countering') P2_IsCountering = value;
    }
}

export function updateGridLayout(newGrid) {
    currentGridLayout = newGrid;
}

export function updateStats(player, statName, value) {
    let targetStats = (player === 'P1') ? P1_Stats : P2_Stats;
    if (targetStats.hasOwnProperty(statName)) {
        targetStats[statName] += value;
    }
}

export function resetAllState() {
    P1_HP = 100;
    P2_HP = 100;
    P1_HP_Display = 100;
    P2_HP_Display = 100;
    P1_Energy = 0;
    P2_Energy = 0;

    remainingTime = 60;
    isGameOver = false;
    scoreSaved = false;

    P1_LastAttackTime = 0;
    P2_LastAttackTime = 0;
    P1_CrossAttackTime = 0;
    P2_CrossAttackTime = 0;
    P1_ChargeAttackTime = 0;
    P2_ChargeAttackTime = 0;
    P1_CounterTime = 0;
    P2_CounterTime = 0;
    P1_SuperTime = 0;
    P2_SuperTime = 0;

    P1_DamagePending = { time: 0, damage: 0, type: '' };
    P2_DamagePending = { time: 0, damage: 0, type: '' };

    P1_IsDefending = false;
    P2_IsDefending = false;
    P1_IsCountering = false;
    P2_IsCountering = false;
    P1_IsCharging = false;
    P2_IsCharging = false;

    P1_Stats = { totalDamage: 0, attackCount: 0, defendCount: 0, superUsed: 0, counterSuccess: 0 };
    P2_Stats = { totalDamage: 0, attackCount: 0, defendCount: 0, superUsed: 0, counterSuccess: 0 };
}
