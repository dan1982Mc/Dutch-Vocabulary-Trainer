'use strict';

// Dutch Vocabulary Trainer V2.4 — history service.
// History is persisted only through DutchTrainer.db sessions.

const DutchTrainerHistoryRoot = window.DutchTrainer || (window.DutchTrainer = {});
DutchTrainerHistoryRoot.history = DutchTrainerHistoryRoot.history || {};

function requireDb() {
    if (!DutchTrainerHistoryRoot.db?.getSessions) {
        throw new Error('DutchTrainer.db is not available.');
    }
    return DutchTrainerHistoryRoot.db;
}

async function getSessions() {
    const sessions = await requireDb().getSessions();
    return Array.isArray(sessions) ? sessions : [];
}

async function saveSession(session) {
    if (!session || typeof session !== 'object') {
        throw new Error('Invalid practice session.');
    }

    const value = {
        ...session,
        sessionId: session.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: session.startedAt || Date.now(),
        results: Array.isArray(session.results) ? session.results : [],
        schemaVersion: 3
    };

    await requireDb().saveSession(value);
    return value;
}

async function deleteSession(sessionId) {
    if (!sessionId) {
        throw new Error('Session id is required.');
    }
    return requireDb().deleteSession(sessionId);
}

function sortNewestFirst(sessions) {
    return [...sessions].sort((a, b) => {
        const dateA = new Date(a.completedAt || a.startedAt || 0).getTime();
        const dateB = new Date(b.completedAt || b.startedAt || 0).getTime();
        return dateB - dateA;
    });
}

async function getRecent(limit = 200) {
    const count = Math.max(1, Number(limit) || 200);
    return sortNewestFirst(await getSessions()).slice(0, count);
}

async function getStats() {
    const sessions = await getSessions();
    let questions = 0;
    let correct = 0;

    sessions.forEach(session => {
        const results = Array.isArray(session.results) ? session.results : [];
        questions += results.length;
        correct += results.filter(result => result.correct === true).length;
    });

    return {
        sessions: sessions.length,
        questions,
        correct,
        accuracy: questions ? Math.round((correct / questions) * 100) : 0
    };
}

DutchTrainerHistoryRoot.history.getSessions = getSessions;
DutchTrainerHistoryRoot.history.getRecent = getRecent;
DutchTrainerHistoryRoot.history.saveSession = saveSession;
DutchTrainerHistoryRoot.history.deleteSession = deleteSession;
DutchTrainerHistoryRoot.history.getStats = getStats;
