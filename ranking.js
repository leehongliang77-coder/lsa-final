import * as config from './config.js';

export function calculateScore(stats, remainingHP) {
    let score = 0;
    score += stats.totalDamage * 10;
    score += stats.attackCount * 5;
    score += stats.defendCount * 15;
    score += stats.superUsed * 50;
    score += stats.counterSuccess * 30;
    score += remainingHP * 5;
    return Math.floor(score);
}

export function getRank(score) {
    if (score >= 1000) return 'SSS';
    if (score >= 800) return 'SS';
    if (score >= 650) return 'S';
    if (score >= 500) return 'A';
    if (score >= 350) return 'B';
    if (score >= 200) return 'C';
    return 'D';
}

export function getRankColor(rank) {
    const colors = {
        'SSS': '#FF00FF',
        'SS': '#FFD700',
        'S': '#FFA500',
        'A': '#00FF00',
        'B': '#00FFFF',
        'C': '#FFFFFF',
        'D': '#808080'
    };
    return colors[rank] || 'white';
}

export async function saveScoreToLeaderboard(playerName, score, rank) {
    try {
        let leaderboard = [];
        const existingData = localStorage.getItem('leaderboard');
        if (existingData) leaderboard = JSON.parse(existingData);

        const newEntry = {
            name: playerName,
            score: score,
            rank: rank,
            date: new Date().toLocaleString('zh-TW')
        };

        const existingIndex = leaderboard.findIndex(p => p.name === playerName);

        if (existingIndex !== -1) {
            if (score > leaderboard[existingIndex].score) {
                leaderboard[existingIndex] = newEntry;
            }
        } else {
            leaderboard.push(newEntry);
        }

        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 50);

        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    } catch (e) {
        console.error("Leaderboard Save Error:", e);
    }
}

export async function getLeaderboard() {
    const data = localStorage.getItem('leaderboard');
    return data ? JSON.parse(data) : [];
}

export function saveMatchRecord(p1Name, p1Score, p2Name, p2Score, winner) {
    try {
        let history = [];
        const data = localStorage.getItem('matchHistory');
        if (data) history = JSON.parse(data);

        const record = {
            date: new Date().toLocaleString('zh-TW'),
            timestamp: Date.now(),
            p1: p1Name,
            p1Score: p1Score,
            p2: p2Name,
            p2Score: p2Score,
            winner: winner
        };

        history.unshift(record);
        if (history.length > 500) history = history.slice(0, 500);
        localStorage.setItem('matchHistory', JSON.stringify(history));
    } catch (error) {
        console.error("Match History Save Error:", error);
    }
}

export function getPlayerStats(playerName) {
    const data = localStorage.getItem('matchHistory');
    const history = data ? JSON.parse(data) : [];
    const myGames = history.filter(match => match.p1 === playerName || match.p2 === playerName);

    let wins = 0,
        losses = 0,
        draws = 0,
        totalScore = 0;

    myGames.forEach(match => {
        if (match.p1 === playerName) {
            totalScore += match.p1Score;
            if (match.winner === 'P1') wins++;
            else if (match.winner === 'P2') losses++;
            else draws++;
        } else {
            totalScore += match.p2Score;
            if (match.winner === 'P2') wins++;
            else if (match.winner === 'P1') losses++;
            else draws++;
        }
    });

    const totalGames = myGames.length;
    return {
        name: playerName,
        totalGames,
        wins,
        losses,
        draws,
        winRate: totalGames > 0 ? Math.floor((wins / totalGames) * 100) : 0,
        avgScore: totalGames > 0 ? Math.floor(totalScore / totalGames) : 0,
        recentMatches: myGames.slice(0, 10)
    };
}

export async function renderLeaderboardTable(tableElementId) {
    const leaderboard = await getLeaderboard();
    const tableBody = document.querySelector(`#${tableElementId} tbody`);

    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (leaderboard.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">尚無資料</td></tr>';
        return;
    }

    leaderboard.forEach((item, index) => {
        const row = document.createElement('tr');
        const rankColor = getRankColor(item.rank);

        let rankDisplay = `#${index + 1}`;
        if (index === 0) rankDisplay = '1st';
        if (index === 1) rankDisplay = '2nd';
        if (index === 2) rankDisplay = '3rd';

        row.innerHTML = `
            <td>${rankDisplay}</td>
            <td>${item.name}</td>
            <td style="color: ${rankColor}; font-weight: bold;">${item.rank}</td>
            <td>${item.score}</td>
        `;
        tableBody.appendChild(row);
    });
}

export function renderPlayerProfile(containerId, playerName) {
    const stats = getPlayerStats(playerName);
    const container = document.getElementById(containerId);

    if (!container) return;

    if (stats.totalGames === 0) {
        container.innerHTML = `<h3 style="text-align:center">找不到玩家 "${playerName}" 的紀錄</h3>`;
        return;
    }

    let historyHtml = stats.recentMatches.map(m => {
        const isP1 = m.p1 === playerName;
        const myScore = isP1 ? m.p1Score : m.p2Score;
        const opponent = isP1 ? m.p2 : m.p1;
        const result = (isP1 && m.winner === 'P1') || (!isP1 && m.winner === 'P2') ?
            '<span class="win">WIN</span>' :
            (m.winner === 'Draw' ? '<span class="draw">DRAW</span>' : '<span class="lose">LOSE</span>');

        return `
            <div class="match-card">
                <div class="match-result">${result}</div>
                <div class="match-info">vs ${opponent}</div>
                <div class="match-score">分數: ${myScore}</div>
                <div class="match-date">${m.date.split(' ')[0]}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="stats-header">
            <h2>${stats.name} 的戰績</h2>
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="value">${stats.winRate}%</div>
                    <div class="label">勝率</div>
                </div>
                <div class="stat-box">
                    <div class="value">${stats.totalGames}</div>
                    <div class="label">總場次</div>
                </div>
                <div class="stat-box">
                    <div class="value">${stats.avgScore}</div>
                    <div class="label">平均分數</div>
                </div>
            </div>
        </div>
        <h3 class="history-title">最近 10 場紀錄</h3>
        <div class="history-list">
            ${historyHtml}
        </div>
    `;
}
