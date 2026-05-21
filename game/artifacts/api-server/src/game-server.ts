import { Server as IOServer, Socket } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import { logger } from "./lib/logger.js";
import { verifyToken } from "./lib/auth.js";
import type { Express } from "express";

// ── Seeded PRNG (mulberry32) — identical to client ────────────────────────
function makeMulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── World constants — identical to client ─────────────────────────────────
const WORLD       = 7200;
const BIOME_EDGE  = 0.34;
const PLAY_RADIUS = WORLD * 0.90;
const RES_COUNT   = 420;

function getBiome(x: number, y: number): string {
  const nx = x / WORLD, ny = y / WORLD;
  if (Math.abs(nx) < BIOME_EDGE && Math.abs(ny) < BIOME_EDGE) return "forest";
  if (Math.abs(ny) >= Math.abs(nx)) return ny < 0 ? "snow" : "swamp";
  return nx > 0 ? "desert" : "darkforest";
}

// ── Resource defs — keep in sync with client RES_DEFS_BY_BIOME ────────────
const RES_DEFS: Record<string, Array<{
  type: string; w: number; radius: number; hp: number;
  yW: number; yS: number; yG: number; yA: number;
  yHp?: number; yXp?: number; ySpd?: number;
}>> = {
  forest: [
    { type:"wood",     w:30, radius:122, hp:800,  yW:6,  yS:0, yG:0, yA:0.25 },
    { type:"wood",     w:16, radius:152, hp:1100, yW:10, yS:0, yG:0, yA:0.18 },
    { type:"stone",    w:20, radius:96,  hp:950,  yW:0,  yS:6,  yG:0, yA:0 },
    { type:"stone",    w:10, radius:120, hp:1400, yW:0,  yS:10, yG:0, yA:0 },
    { type:"gold",     w:5,  radius:92,  hp:750,  yW:0,  yS:2,  yG:5, yA:0 },
    { type:"gold",     w:3,  radius:112, hp:1050, yW:0,  yS:3,  yG:9, yA:0 },
    { type:"apple",    w:10, radius:106, hp:650,  yW:4,  yS:0,  yG:0, yA:0.9 },
    { type:"bush",     w:14, radius:66,  hp:400,  yW:2,  yS:0,  yG:0, yA:0.5 },
    { type:"mushroom", w:8,  radius:52,  hp:250,  yW:0,  yS:0,  yG:1, yA:0, yHp:25 },
    { type:"crystal",  w:4,  radius:68,  hp:420,  yW:0,  yS:0,  yG:0, yA:0, yXp:30 },
    { type:"hive",     w:3,  radius:60,  hp:380,  yW:0,  yS:0,  yG:3, yA:0, ySpd:180 },
  ],
  snow: [
    { type:"wood",  w:25, radius:116, hp:720,  yW:5,  yS:0, yG:0, yA:0.12 },
    { type:"wood",  w:12, radius:144, hp:1000, yW:8,  yS:0, yG:0, yA:0.08 },
    { type:"stone", w:22, radius:98,  hp:1100, yW:0,  yS:7,  yG:0, yA:0 },
    { type:"stone", w:10, radius:122, hp:1600, yW:0,  yS:12, yG:0, yA:0 },
    { type:"gold",  w:6,  radius:94,  hp:800,  yW:0,  yS:2,  yG:6, yA:0 },
    { type:"gold",  w:3,  radius:114, hp:1100, yW:0,  yS:3,  yG:10, yA:0 },
    { type:"bush",  w:8,  radius:62,  hp:360,  yW:1,  yS:0,  yG:0, yA:0.3 },
  ],
  desert: [
    { type:"wood",  w:15, radius:112, hp:680,  yW:4,  yS:0, yG:0, yA:0.08 },
    { type:"wood",  w:8,  radius:138, hp:950,  yW:7,  yS:0, yG:0, yA:0.05 },
    { type:"stone", w:28, radius:100, hp:1050, yW:0,  yS:7,  yG:0, yA:0 },
    { type:"stone", w:14, radius:124, hp:1500, yW:0,  yS:12, yG:0, yA:0 },
    { type:"gold",  w:8,  radius:98,  hp:780,  yW:0,  yS:2,  yG:7, yA:0 },
    { type:"gold",  w:4,  radius:116, hp:1080, yW:0,  yS:3,  yG:11, yA:0 },
    { type:"bush",  w:10, radius:60,  hp:320,  yW:1,  yS:0,  yG:0, yA:0.2 },
  ],
  swamp: [
    { type:"wood",  w:22, radius:120, hp:760,  yW:5,  yS:0, yG:0, yA:0.15 },
    { type:"wood",  w:12, radius:148, hp:1080, yW:9,  yS:0, yG:0, yA:0.1 },
    { type:"stone", w:18, radius:94,  hp:880,  yW:0,  yS:5,  yG:0, yA:0 },
    { type:"stone", w:9,  radius:118, hp:1320, yW:0,  yS:9,  yG:0, yA:0 },
    { type:"gold",  w:7,  radius:92,  hp:720,  yW:0,  yS:2,  yG:6, yA:0 },
    { type:"gold",  w:4,  radius:112, hp:1020, yW:0,  yS:3,  yG:10, yA:0 },
    { type:"bush",  w:18, radius:70,  hp:440,  yW:2,  yS:0,  yG:0, yA:0.6 },
  ],
  darkforest: [
    { type:"wood",  w:28, radius:128, hp:880,  yW:7,  yS:0, yG:0, yA:0.1 },
    { type:"wood",  w:14, radius:156, hp:1240, yW:12, yS:0, yG:0, yA:0.07 },
    { type:"stone", w:20, radius:98,  hp:1200, yW:0,  yS:8,  yG:0, yA:0 },
    { type:"stone", w:10, radius:122, hp:1680, yW:0,  yS:13, yG:0, yA:0 },
    { type:"gold",  w:6,  radius:94,  hp:800,  yW:0,  yS:3,  yG:7, yA:0 },
    { type:"gold",  w:3,  radius:114, hp:1160, yW:0,  yS:4,  yG:12, yA:0 },
    { type:"bush",  w:12, radius:68,  hp:384,  yW:2,  yS:0,  yG:0, yA:0.4 },
  ],
};

interface WorldResource {
  x: number; y: number; radius: number; type: string;
  maxHp: number; hp: number;
  yW: number; yS: number; yG: number; yA: number;
  yHp: number; yXp: number; ySpd: number;
}

// ── Generate world with seed ───────────────────────────────────────────────
const WORLD_SEED = (Math.random() * 0x7fffffff) | 0;
const _worldRng  = makeMulberry32(WORLD_SEED);

function pickResDef(biome: string, rng: () => number) {
  const defs = RES_DEFS[biome] || RES_DEFS.forest;
  const total = defs.reduce((s, d) => s + d.w, 0);
  let r = rng() * total;
  for (const d of defs) { r -= d.w; if (r <= 0) return d; }
  return defs[0];
}

const worldResources: WorldResource[] = [];
(function generateResources() {
  const r = PLAY_RADIUS * 0.98;
  for (let i = 0; i < RES_COUNT; i++) {
    const x = (_worldRng() * 2 - 1) * r;
    const y = (_worldRng() * 2 - 1) * r;
    const biome = getBiome(x, y);
    const d = pickResDef(biome, _worldRng);
    const scaledHp = d.hp * 20; // HP_MUL=20 — must match client makeResource
    worldResources.push({
      x, y, radius: d.radius, type: d.type,
      maxHp: scaledHp, hp: scaledHp,
      yW: d.yW, yS: d.yS, yG: d.yG, yA: d.yA,
      yHp: d.yHp || 0, yXp: d.yXp || 0, ySpd: d.ySpd || 0,
    });
  }
})();

// Respawn timers: Map<resourceIndex, timestamp when it respawns>
const resRespawnAt = new Map<number, number>();

// ── Player types ───────────────────────────────────────────────────────────
interface PlayerAcc { a?: string; y?: string; s?: string; k?: string; }

interface PlayerState {
  id: string; name: string; skin: string; color: string;
  x: number; y: number; angle: number; vx: number; vy: number;
  hp: number; maxHp: number; weapon: number; isAttacking: boolean;
  kills: number; xp: number; gold: number; axeTier: number; swordTier: number;
  mode: string; team: string; lastSwing: number; rankId: number;
  dead: boolean;
  score?: number;
  buildX?: number | null;
  buildY?: number | null;
  acc?: PlayerAcc;
}

interface Building {
  id: string; ownerId: string; type: number;
  x: number; y: number; angle: number; hp: number; maxHp: number; radius: number;
  tier?: number;
}

// Compact mob state from host
interface MobState {
  id: string; x: number; y: number; hp: number; maxHp: number;
  vx: number; vy: number; shape: string; color: string; outline: string;
  radius: number; eyes: string; hitFlash: number; typeName: string;
}

// Compact boss state from host
interface BossState {
  type: string; name: string; emoji: string; x: number; y: number;
  hp: number; maxHp: number; radius: number; color: string; outline: string;
  angle: number; hitFlash: number; provoked: boolean;
}

// ── Party System ───────────────────────────────────────────────────────────
interface Party {
  code: string;
  leader: string;
  members: Set<string>;
  memberNames: Map<string, string>;
  createdAt: number;
}

const parties   = new Map<string, Party>();
const socketToParty = new Map<string, string>();

function partyMemberList(party: Party) {
  return [...party.members].map(id => ({
    id,
    name: party.memberNames.get(id) || "Savaşçı",
    isLeader: id === party.leader,
  }));
}

function leaveParty(socket: Socket, io: IOServer) {
  const code = socketToParty.get(socket.id);
  if (!code) return;
  const party = parties.get(code);
  socketToParty.delete(socket.id);
  socket.leave("party:" + code);
  if (!party) return;

  party.members.delete(socket.id);
  party.memberNames.delete(socket.id);

  if (party.members.size === 0) {
    parties.delete(code);
    return;
  }
  if (party.leader === socket.id) {
    party.leader = [...party.members][0];
  }
  const memberList = partyMemberList(party);
  io.to("party:" + code).emit("party_update", { code, members: memberList });
}

const players   = new Map<string, PlayerState>();
const buildings = new Map<string, Building>();
let hostId: string | null = null;
let mobStates:  MobState[]  = [];
let bossState:  BossState | null = null;

const PLAYER_RADIUS    = 34;
const SWING_COOLDOWN_MS = 400;

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function inArc(ax: number, ay: number, aAngle: number, bx: number, by: number,
               hitRange: number, halfArc: number): boolean {
  const dx = bx - ax, dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > hitRange) return false;
  const angle = Math.atan2(dy, dx);
  let diff = angle - aAngle;
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= halfArc;
}

function pickNewHost(io: IOServer) {
  const next = players.keys().next().value;
  hostId = next || null;
  if (hostId) {
    io.to(hostId).emit("become_host");
    logger.info({ hostId }, "New host assigned");
  }
}

export function createGameServer(app: Express): HttpServer {
  const httpServer = createServer(app);

  const io = new IOServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*" },
    transports: ["websocket"],
    pingInterval: 5000,
    pingTimeout: 10000,
    perMessageDeflate: false,
    httpCompression: false,
  });

  const broadcastOnlineCount = () => io.emit("online_count", io.sockets.sockets.size);

  // ── Resource respawn ticker ─────────────────────────────────────────────
  setInterval(() => {
    const now = Date.now();
    for (const [idx, at] of resRespawnAt) {
      if (now >= at) {
        resRespawnAt.delete(idx);
        worldResources[idx].hp = worldResources[idx].maxHp;
        io.emit("res_respawn", { idx });
      }
    }
  }, 1000);

  // ── Live leaderboard broadcast every 3 seconds ──────────────────────────
  setInterval(() => {
    if (players.size === 0) return;
    const entries = Array.from(players.values())
      .filter(p => !p.dead)
      .map(p => ({
        name: p.name,
        score: p.score || 0,
        kills: p.kills,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    io.emit("live_lb", entries);
  }, 3000);

  // ── Stale party cleanup (every 30 min) ─────────────────────────────────
  setInterval(() => {
    const now = Date.now();
    for (const [code, party] of parties) {
      if (now - party.createdAt > 30 * 60 * 1000 && party.members.size === 0) {
        parties.delete(code);
      }
    }
  }, 60_000);

  io.on("connection", (socket: Socket) => {
    logger.info({ id: socket.id }, "Player connected");
    socket.emit("online_count", io.sockets.sockets.size);
    broadcastOnlineCount();

    // ── join ────────────────────────────────────────────────────────────
    socket.on("join", (data: {
      name?: string; skin?: string; color?: string;
      x?: number; y?: number; mode?: string; team?: string; token?: string;
      partyCode?: string;
    }) => {
      if (!data || typeof data !== "object") return;
      let rankId = 0;
      if (data.token) {
        const payload = verifyToken(data.token);
        if (payload) rankId = payload.rankId ?? 0;
      }

      // If joining with a party code, use the party code as the team
      let team = data.team || "";
      if (data.partyCode) {
        const pCode = data.partyCode.toUpperCase();
        if (parties.has(pCode)) team = pCode;
      }

      const player: PlayerState = {
        id: socket.id,
        name: (data.name || "Savaşçı").slice(0, 24),
        skin: data.skin || "warrior",
        color: data.color || "#8B5E3A",
        x: data.x ?? 0, y: data.y ?? 0,
        angle: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100, weapon: 1, isAttacking: false,
        kills: 0, xp: 0, gold: 0, axeTier: 0, swordTier: 0,
        mode: data.mode || "classic", team,
        lastSwing: 0, rankId, dead: false,
        acc: (data.acc && typeof data.acc === 'object') ? data.acc as PlayerAcc : {},
      };
      players.set(socket.id, player);

      // First player becomes host
      if (!hostId) { hostId = socket.id; socket.emit("become_host"); }

      // Build compact others map
      const othersObj: Record<string, object> = {};
      players.forEach((p, id) => {
        if (id !== socket.id && !p.dead) {
          othersObj[id] = {
            n: p.name, sk: p.skin, x: p.x, y: p.y, a: p.angle,
            vx: p.vx, vy: p.vy, hp: p.hp, mhp: p.maxHp,
            w: p.weapon, atk: p.isAttacking, k: p.kills, xp: p.xp,
            at: p.axeTier, st: p.swordTier, color: p.color, rk: p.rankId,
            team: p.team, acc: p.acc || {},
          };
        }
      });

      const buildingsObj: Record<string, object> = {};
      buildings.forEach((b, id) => { buildingsObj[id] = { ...b }; });

      // Build resource HP snapshot (only damaged/destroyed ones)
      const resHp: Record<number, number> = {};
      worldResources.forEach((r, i) => { if (r.hp < r.maxHp) resHp[i] = r.hp; });

      socket.emit("welcome", {
        id: socket.id,
        players: othersObj,
        buildings: buildingsObj,
        worldSeed: WORLD_SEED,
        resHp,
        mobs: mobStates,
        boss: bossState,
        isHost: hostId === socket.id,
        team,
      });

      socket.broadcast.emit("player_join", {
        id: socket.id,
        state: {
          name: player.name, skin: player.skin, x: player.x, y: player.y,
          angle: player.angle, hp: player.hp, maxHp: player.maxHp,
          weapon: player.weapon, isAttacking: false, kills: 0, xp: 0,
          axeTier: 0, swordTier: 0, color: player.color, rankId: player.rankId,
          team, acc: player.acc || {},
        },
      });

      broadcastOnlineCount();
      logger.info({ name: player.name, rankId, team, total: players.size }, "Player joined");
    });

    // ── state ────────────────────────────────────────────────────────────
    socket.on("state", (s: {
      x?: number; y?: number; angle?: number; vx?: number; vy?: number;
      hp?: number; maxHp?: number; weapon?: number; isAttacking?: boolean;
      kills?: number; xp?: number; axeTier?: number; swordTier?: number;
      buildX?: number | null; buildY?: number | null;
    }) => {
      if (!s || typeof s !== "object") return;
      const player = players.get(socket.id);
      if (!player || player.dead) return;
      if (typeof s.x === "number")           player.x = s.x;
      if (typeof s.y === "number")           player.y = s.y;
      if (typeof s.angle === "number")       player.angle = s.angle;
      if (typeof s.vx === "number")          player.vx = s.vx;
      if (typeof s.vy === "number")          player.vy = s.vy;
      if (typeof s.hp === "number")          player.hp = Math.max(0, s.hp);
      if (typeof s.maxHp === "number")       player.maxHp = s.maxHp;
      if (typeof s.weapon === "number")      player.weapon = s.weapon;
      if (typeof s.isAttacking === "boolean") player.isAttacking = s.isAttacking;
      if (typeof s.kills === "number")       player.kills = s.kills;
      if (typeof s.xp === "number")          player.xp = s.xp;
      if (typeof (s as Record<string, unknown>).gold === "number") player.gold = (s as Record<string, unknown>).gold as number;
      if (typeof (s as Record<string, unknown>).sc === "number") player.score = (s as Record<string, unknown>).sc as number;
      if (typeof s.axeTier === "number")     player.axeTier = Math.min(6, Math.max(0, s.axeTier));
      if (typeof s.swordTier === "number")   player.swordTier = Math.min(6, Math.max(0, s.swordTier));
      player.buildX = (typeof s.buildX === "number") ? s.buildX : null;
      player.buildY = (typeof s.buildY === "number") ? s.buildY : null;
      const _sacc = (s as Record<string,unknown>).acc;
      if (_sacc && typeof _sacc === 'object') player.acc = _sacc as PlayerAcc;
    });

    // ── swing (PvP) ──────────────────────────────────────────────────────
    socket.on("swing", (data: {
      angle: number; weapon: number; axeTier?: number; swordTier?: number;
    }) => {
      if (!data || typeof data !== "object") return;
      const attacker = players.get(socket.id);
      if (!attacker || attacker.dead) return;
      const now = Date.now();
      if (now - attacker.lastSwing < SWING_COOLDOWN_MS) return;
      attacker.lastSwing = now;
      attacker.angle  = data.angle ?? attacker.angle;
      attacker.weapon = data.weapon ?? attacker.weapon;
      if (data.axeTier  !== undefined) attacker.axeTier  = Math.min(6, Math.max(0, data.axeTier));
      if (data.swordTier !== undefined) attacker.swordTier = Math.min(6, Math.max(0, data.swordTier));

      const isAxe = data.weapon === 1;
      const hitRange = PLAYER_RADIUS * 2 + (isAxe ? 70 : 80);
      const halfArc  = isAxe ? Math.PI / 2.2 : Math.PI / 3;
      const baseDmg  = isAxe ? 25 : 35;
      const safeTier = isAxe ? Math.min(6, attacker.axeTier ?? 0) : Math.min(6, attacker.swordTier ?? 0);
      const tierBonus = isAxe ? safeTier * 8 : safeTier * 10;
      const dmg = Math.min(85, baseDmg + tierBonus);

      players.forEach((target, targetId) => {
        if (targetId === socket.id || target.hp <= 0 || target.dead) return;
        // No friendly fire: skip teammates
        if (attacker.team && attacker.team !== "" && attacker.team === target.team) return;
        if (dist2(attacker.x, attacker.y, target.x, target.y) > hitRange * hitRange) return;
        if (!inArc(attacker.x, attacker.y, attacker.angle, target.x, target.y, hitRange, halfArc)) return;
        target.hp = Math.max(0, target.hp - dmg);
        io.to(targetId).emit("pvp_hit", { dmg, fromName: attacker.name });
        socket.emit("pvp_confirm", { targetId, dmg, targetName: target.name });
        if (target.hp <= 0) {
          target.dead = true;
          attacker.kills++;
          socket.emit("pvp_kill_confirm", { targetName: target.name });
          io.to(targetId).emit("pvp_killed", { byName: attacker.name });
        }
      });
    });

    // ── spike PvP hit ────────────────────────────────────────────────────
    socket.on("spike_hit", (data: { targetId: string; bId?: string; dmg: number }) => {
      if (!data || typeof data !== "object") return;
      const attacker = players.get(socket.id);
      if (!attacker || attacker.dead) return;
      const target = players.get(data.targetId);
      // Cap spike damage to 25 max (prevent exploit)
      const dmg = Math.min(25, Math.max(1, Math.floor(data.dmg)));
      if (target && target.hp > 0 && !target.dead) {
        target.hp = Math.max(0, target.hp - dmg);
        io.to(data.targetId).emit("pvp_hit", { dmg, fromName: attacker.name + " (kazık)" });
        socket.emit("pvp_confirm", { targetId: data.targetId, dmg, targetName: target.name });
        socket.emit("spike_dmg_confirm", { targetId: data.targetId, dmg, targetName: target.name });
        if (target.hp <= 0) {
          target.dead = true;
          attacker.kills++;
          socket.emit("pvp_kill_confirm", { targetName: target.name });
          io.to(data.targetId).emit("pvp_killed", { byName: attacker.name });
        }
      }
    });

    // ── player respawn ───────────────────────────────────────────────────
    socket.on("respawn", () => {
      const player = players.get(socket.id);
      if (!player) return;
      player.dead = false;
      player.hp = player.maxHp;
      player.x = (Math.random() - 0.5) * 400;
      player.y = (Math.random() - 0.5) * 400;
    });

    // ── resource hit (server-authoritative) ─────────────────────────────
    socket.on("res_hit", (data: { idx: number; dmg: number }) => {
      if (!data || typeof data !== "object") return;
      const { idx, dmg } = data;
      if (typeof idx !== "number" || idx < 0 || idx >= worldResources.length) return;
      const res = worldResources[idx];
      if (res.hp <= 0) return;
      if (resRespawnAt.has(idx)) return;

      // Cap damage to 250 per hit (prevent one-shot exploit)
      const safeDmg = Math.min(250, Math.max(1, Math.floor(dmg)));
      res.hp = Math.max(0, res.hp - safeDmg);

      io.emit("res_sync", { idx, hp: res.hp });

      if (res.hp <= 0) {
        resRespawnAt.set(idx, Date.now() + 18000);
      }
    });

    // ── host relays mob states ───────────────────────────────────────────
    socket.on("host_mobs", (mobs: MobState[]) => {
      if (socket.id !== hostId) return;
      if (!Array.isArray(mobs)) return;
      mobStates = mobs;
      socket.broadcast.emit("mob_states", mobs);
    });

    // ── host relays boss state ───────────────────────────────────────────
    socket.on("host_boss", (boss: BossState | null) => {
      if (socket.id !== hostId) return;
      bossState = boss;
      socket.broadcast.emit("boss_state", boss);
    });

    // ── non-host hits a mob — ask host to apply damage ────────────────
    socket.on("mob_hit_req", (data: { mobId: string; dmg: number }) => {
      if (!data || socket.id === hostId) return;
      if (hostId) io.to(hostId).emit("mob_hit_apply", { mobId: data.mobId, dmg: data.dmg, byName: players.get(socket.id)?.name || "?" });
    });

    // ── non-host hits boss ────────────────────────────────────────────
    socket.on("boss_hit_req", (data: { dmg: number }) => {
      if (!data || socket.id === hostId) return;
      if (hostId) io.to(hostId).emit("boss_hit_apply", { dmg: data.dmg, byName: players.get(socket.id)?.name || "?" });
    });

    // ── host confirms mob killed ──────────────────────────────────────
    socket.on("mob_killed", (data: { mobId: string; xp: number; gold: number; typeName: string }) => {
      if (socket.id !== hostId) return;
      socket.broadcast.emit("mob_killed_broadcast", data);
    });

    // ── host confirms boss killed ─────────────────────────────────────
    socket.on("boss_killed", (data: { xp: number; gold: number; name: string; emoji: string }) => {
      if (socket.id !== hostId) return;
      socket.broadcast.emit("boss_killed_broadcast", data);
    });

    // ── arrow hit (PvP) ──────────────────────────────────────────────────
    socket.on("arrow_hit", (data: { targetId: string; dmg: number; bId?: string }) => {
      if (!data || typeof data !== "object") return;
      const attacker = players.get(socket.id);
      if (!attacker || attacker.dead) return;
      const target = players.get(data.targetId);
      const dmg = Math.min(60, Math.max(1, Math.floor(data.dmg)));
      if (target && target.hp > 0 && !target.dead) {
        target.hp = Math.max(0, target.hp - dmg);
        io.to(data.targetId).emit("pvp_hit", { dmg, fromName: attacker.name });
        socket.emit("pvp_confirm", { targetId: data.targetId, dmg, targetName: target.name });
        if (target.hp <= 0) {
          target.dead = true;
          attacker.kills++;
          socket.emit("pvp_kill_confirm", { targetName: target.name });
          io.to(data.targetId).emit("pvp_killed", { byName: attacker.name });
        }
      }
    });

    // ── build ────────────────────────────────────────────────────────────
    socket.on("build", (data: {
      id: string; type: number; x: number; y: number;
      angle?: number; hp?: number; maxHp?: number; radius?: number;
    }) => {
      if (!data || typeof data !== "object") return;
      const player = players.get(socket.id);
      if (!player) return;
      const building: Building = {
        id: data.id, ownerId: socket.id, type: data.type,
        x: data.x, y: data.y, angle: data.angle ?? 0,
        hp: data.hp ?? 100, maxHp: data.maxHp ?? 100, radius: data.radius ?? 28,
        tier: 0,
      };
      buildings.set(data.id, building);
      socket.broadcast.emit("build", { id: data.id, building });
    });

    socket.on("build_destroy", (data: { id: string }) => {
      if (!data) return;
      buildings.delete(data.id);
      socket.broadcast.emit("build_destroy", { id: data.id });
    });

    socket.on("build_hp_update", (data: { id: string; hp: number }) => {
      if (!data) return;
      const b = buildings.get(data.id);
      if (b) b.hp = data.hp;
      socket.broadcast.emit("build_hp_update", { id: data.id, hp: data.hp });
    });

    // ── building tier upgrade sync ────────────────────────────────────────
    socket.on("build_tier_update", (data: { id: string; tier: number; maxHp: number; hp: number }) => {
      if (!data || typeof data !== "object") return;
      const player = players.get(socket.id);
      if (!player) return;
      const b = buildings.get(data.id);
      if (b && b.ownerId === socket.id) {
        b.maxHp = Math.max(1, data.maxHp);
        b.hp    = Math.max(1, Math.min(data.maxHp, data.hp));
        b.tier = Math.min(6, Math.max(0, Math.floor(data.tier)));
      }
      socket.broadcast.emit("build_tier_update", {
        id: data.id,
        tier: Math.min(6, Math.max(0, Math.floor(data.tier))),
        maxHp: data.maxHp,
        hp: data.hp,
      });
    });

    // ── chat ─────────────────────────────────────────────────────────────
    socket.on("chat", (data: { msg: string }) => {
      if (!data) return;
      const player = players.get(socket.id);
      if (!player) return;
      const msg = String(data.msg || "").slice(0, 120);
      if (!msg.trim()) return;
      io.emit("chat", { name: player.name, msg, id: socket.id });
    });

    socket.on("ping_req", (data: { t?: number }) => socket.emit("pong_res", { t: data?.t ?? Date.now() }));

    // ── PARTY SYSTEM ─────────────────────────────────────────────────────

    socket.on("party_create", (data: { name?: string }) => {
      // Generate unique 6-char code
      let code: string;
      do { code = Math.random().toString(36).toUpperCase().slice(2, 8); }
      while (parties.has(code));

      leaveParty(socket, io);

      const party: Party = {
        code,
        leader: socket.id,
        members: new Set([socket.id]),
        memberNames: new Map([[socket.id, (data?.name || "Savaşçı").slice(0, 24)]]),
        createdAt: Date.now(),
      };
      parties.set(code, party);
      socketToParty.set(socket.id, code);
      socket.join("party:" + code);

      socket.emit("party_created", {
        code,
        members: [{ id: socket.id, name: data?.name || "Savaşçı", isLeader: true }],
      });
      logger.info({ code, leader: socket.id }, "Party created");
    });

    socket.on("party_join", (data: { code?: string; name?: string }) => {
      const code = (data?.code || "").toUpperCase().trim();
      if (!code) { socket.emit("party_error", { msg: "Kod boş olamaz" }); return; }
      const party = parties.get(code);
      if (!party) { socket.emit("party_error", { msg: "Parti bulunamadı! Kodu kontrol et." }); return; }
      if (party.members.size >= 4) { socket.emit("party_error", { msg: "Parti dolu (maks 4 kişi)" }); return; }
      if (party.members.has(socket.id)) { socket.emit("party_error", { msg: "Zaten bu partidesin" }); return; }

      leaveParty(socket, io);

      party.members.add(socket.id);
      party.memberNames.set(socket.id, (data?.name || "Savaşçı").slice(0, 24));
      socketToParty.set(socket.id, code);
      socket.join("party:" + code);

      const memberList = partyMemberList(party);
      io.to("party:" + code).emit("party_update", { code, members: memberList });
      socket.emit("party_joined", { code, members: memberList });
      logger.info({ code, member: socket.id, total: party.members.size }, "Player joined party");
    });

    socket.on("party_leave", () => {
      leaveParty(socket, io);
      socket.emit("party_left", {});
    });

    socket.on("party_start", () => {
      const code = socketToParty.get(socket.id);
      if (!code) return;
      const party = parties.get(code);
      if (!party) return;
      if (party.leader !== socket.id) {
        socket.emit("party_error", { msg: "Sadece parti lideri oyunu başlatabilir" });
        return;
      }
      logger.info({ code, members: party.members.size }, "Party game starting");
      io.to("party:" + code).emit("party_game_start", { partyCode: code });
    });

    // ── disconnect ───────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const player = players.get(socket.id);
      if (player) {
        io.emit("player_left", { id: socket.id, name: player.name });
        players.delete(socket.id);
        buildings.forEach((b, bid) => { if (b.ownerId === socket.id) buildings.delete(bid); });
        broadcastOnlineCount();
        logger.info({ name: player.name, total: players.size }, "Player left");
      }

      // Clean up party membership
      leaveParty(socket, io);

      // Re-assign host if needed
      if (socket.id === hostId) {
        mobStates = [];
        bossState = null;
        pickNewHost(io);
      }
    });
  });

  // ── Player state broadcast (20ms tick) — skip dead players ──────────────
  setInterval(() => {
    if (players.size === 0) return;
    const states: Record<string, object> = {};
    players.forEach((p, id) => {
      if (p.dead) return; // don't broadcast dead players
      const pr = p as unknown as Record<string, unknown>;
      states[id] = {
        n: p.name, sk: p.skin, x: p.x, y: p.y, a: p.angle,
        vx: p.vx, vy: p.vy, hp: p.hp, mhp: p.maxHp,
        w: p.weapon, atk: p.isAttacking, k: p.kills, xp: p.xp, g: p.gold,
        sc: p.score || 0,
        at: p.axeTier, st: p.swordTier, color: p.color, rk: p.rankId,
        bx: pr.buildX ?? null, by: pr.buildY ?? null,
        team: p.team, acc: p.acc || {},
      };
    });
    io.emit("players", states);
  }, 20);

  return httpServer;
}
