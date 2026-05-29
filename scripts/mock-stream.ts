/**
 * Mock Streaming Server for Local Development
 * Simulates real-time baseball game state updates
 */

import { WebSocketServer } from 'ws';
import { createInitialBaseballState, type LiveSportState } from '../src/types/sports';
import { processBaseballEvent, type BaseballEvent } from '../src/machines/evaluator';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const gameState = createInitialBaseballState('mock-game-123');
let tickCount = 0;

console.log(`🚀 Mock sports stream server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    payload: gameState
  }));

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});

const possibleEvents: BaseballEvent['type'][] = [
  'STRIKE', 'BALL', 'OUT', 'SINGLE', 'DOUBLE', 'HOMERUN', 'WALK'
];

// Fast-forward simulation
setInterval(() => {
  tickCount++;

  // Random event
  const randomEventType = possibleEvents[Math.floor(Math.random() * possibleEvents.length)] as BaseballEvent['type'];
  const event: BaseballEvent = { type: randomEventType };

  const newState = processBaseballEvent(gameState, event);
  Object.assign(gameState, newState);

  const message = {
    type: 'STATE_UPDATE',
    payload: gameState,
    tick: tickCount
  };

  const json = JSON.stringify(message);

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(json);
    }
  });

  // Occasional log
  if (tickCount % 10 === 0) {
    console.log(`📡 Tick ${tickCount} | ${gameState.situation.inning} ${gameState.situation.isTopInning ? 'Top' : 'Bot'} | Score: ${gameState.awayTeam.score}-${gameState.homeTeam.score}`);
  }
}, 1500);

console.log('🎮 Baseball simulation started - events every 1.5s');