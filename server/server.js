require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Import our Database Blueprints
const Message = require('./models/Message');
const BlockedUser = require('./models/BlockedUser');
const SystemState = require('./models/SystemState');
const Report = require('./models/Report'); 
const Operator = require('./models/Operator');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Trust first-layer reverse proxies

// --- SECURITY: Rate Limiting ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, // Increased threshold
  keyGenerator: (req) => req.body?.id ? req.body.id.toLowerCase().trim() : req.ip,
  message: { error: "TOO MANY LOGIN ATTEMPTS — ACCOUNT FIREWALLED FOR 15 MINUTES" }
});

// --- DEPLOYMENT UPDATE: Dynamic CORS ---
// This allows your live Vercel frontend AND your local Vite server to connect securely.
// The .filter(Boolean) part prevents errors if CLIENT_URL is empty while you are testing.
const allowedOrigins = [
  process.env.CLIENT_URL, 
  "http://localhost:5173", 
  "http://127.0.0.1:5173"
].filter(Boolean);

// Single, unified CORS policy
app.use(cors({
  origin: allowedOrigins, 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json()); 
const server = http.createServer(app);

// Set up real-time WebSockets with updated CORS
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins, 
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- CONSTANTS & GENERATORS ---
const ADMIN_ID = "bt25csd064";
const ADMIN_PASS = "bt25csd0641357!";
const PFX = ["OPERATOR","GHOST","CIPHER","PHANTOM","SHADOW","VECTOR","NEXUS","PROXY","DAEMON","SPECTER"];
const SFX = ["ALPHA","BETA","GAMMA","DELTA","SIGMA","OMEGA","ZETA","THETA","KAPPA","LAMBDA"];

const VALID_BATCHES = {
  bt24cse: 223, bt24csa: 67, bt24csd: 66, bt24csh: 66, bt24ece: 132, bt24eci: 49,
  bt25cse: 220, bt25csd: 70, bt25csa: 68, bt25csh: 74, bt25ece: 132, bt25eci: 69,
  bt26cse: 220, bt26csd: 70, bt26csa: 68, bt26csh: 74, bt26ece: 132, bt26eci: 69
};

let TOTAL_USERS = 0;
const BATCH_OFFSETS = {};
Object.entries(VALID_BATCHES).forEach(([prefix, max]) => {
  BATCH_OFFSETS[prefix] = TOTAL_USERS;
  TOTAL_USERS += max; // Sum is exactly 1236
});

function getUserIndex(id) {
  const m = id.match(/^(bt2[456][a-z]{3})(\d{3})$/);
  if (!m) return -1;
  return BATCH_OFFSETS[m[1]] + (parseInt(m[2], 10) - 1);
}

const isValid = id => {
  if (id === ADMIN_ID) return true;
  const m = id.match(/^(bt2[456][a-z]{3})(\d{3})$/);
  if (!m) return false;
  const prefix = m[1], num = parseInt(m[2], 10);
  return VALID_BATCHES[prefix] && num >= 1 && num <= VALID_BATCHES[prefix];
};

const mkPass = id => id===ADMIN_ID ? ADMIN_PASS : id+"2026!";

// Server generates the Ghost Tag securely for 1,236 users natively
const ghostTag = (id) => {
  if (id === ADMIN_ID) return "SUDO_MASTER";
  const day = Math.floor(Date.now() / 86400000);
  const idx = getUserIndex(id);
  if (idx === -1) return "UNKNOWN_ENTIY_00";
  
  // 17 is coprime to 1236, creates a perfect collision-free daily bijection field
  const scrambled = (idx * 17 + day * 31) % TOTAL_USERS;
  
  const pi = scrambled % 10;
  const si = Math.floor(scrambled / 10) % 10;
  const subNum = Math.floor(scrambled / 100) + 1; // Maps 1 to 13
  
  const numStr = String(subNum).padStart(2, "0");
  return `${PFX[pi]}_${SFX[si]}_${numStr}`;
};

// --- API ROUTES ---
const onlineSockets = new Map();

app.get('/ping', (req, res) => res.status(200).send('pong'));

app.post('/api/login', loginLimiter, async (req, res) => {
  const { id, pw, channel = 'general' } = req.body;
  const cleanId = id.toLowerCase().trim();

  if (!isValid(cleanId)) return res.status(400).json({ error: "ACCESS DENIED — INVALID OPERATOR ID" });

  if (channel === 'ds' && !cleanId.startsWith('bt25csd') && cleanId !== ADMIN_ID) {
    return res.status(403).json({ error: "ACCESS DENIED — INSUFFICIENT SUB-NODE CLEARANCE" });
  }

  const activeIds = Array.from(new Set(onlineSockets.values()));
  if (activeIds.includes(cleanId)) {
    return res.status(403).json({ error: "ACCESS DENIED — OPERATOR ALREADY ACTIVE" });
  }

  let valid = false;
  const sysUser = await Operator.findOne({ btId: cleanId });

  if (sysUser) {
    valid = await bcrypt.compare(pw, sysUser.password);
  } else {
    valid = (pw === mkPass(cleanId));
  }

  if (!valid) return res.status(401).json({ error: "ACCESS DENIED — WRONG PASSKEY" });

  const isBlocked = await BlockedUser.findOne({ btId: cleanId });
  if (isBlocked) return res.status(403).json({ error: "ACCESS BLOCKED — OPERATOR BANNED BY ADMIN" });

  let sysState = await SystemState.findOne();
  if (!sysState) sysState = await SystemState.create({});
  
  if (sysState.isLocked && cleanId !== ADMIN_ID) {
    return res.status(403).json({ error: "ACCESS DENIED — CHANNEL IS LOCKED BY ADMIN" });
  }

  const token = jwt.sign({ id: cleanId, isAdmin: cleanId === ADMIN_ID, channel }, process.env.JWT_SECRET, { expiresIn: '12h' });
  
  res.json({ 
    token, 
    user: { id: cleanId, ghost: ghostTag(cleanId), isAdmin: cleanId === ADMIN_ID },
    sysState
  });
});

app.post('/api/change-password', loginLimiter, async (req, res) => {
  try {
    const { id, currentPw, newPw } = req.body;
    const cleanId = id.toLowerCase().trim();

    if (!isValid(cleanId)) return res.status(400).json({ error: "INVALID OPERATOR ID" });
    if (!newPw || newPw.length < 6) return res.status(400).json({ error: "NEW PASSKEY MUST BE AT LEAST 6 CHARACTERS" });
    if (newPw === mkPass(cleanId)) return res.status(400).json({ error: "CANNOT USE DEFAULT PASSKEY" });

    const sysUser = await Operator.findOne({ btId: cleanId });
    let isMatch = false;

    if (sysUser) {
      isMatch = await bcrypt.compare(currentPw, sysUser.password);
    } else {
      isMatch = (currentPw === mkPass(cleanId));
    }

    if (!isMatch) return res.status(401).json({ error: "CURRENT PASSKEY INCORRECT" });

    const hashedNew = await bcrypt.hash(newPw, 10);

    if (sysUser) {
      sysUser.password = hashedNew;
      await sysUser.save();
    } else {
      await Operator.create({ btId: cleanId, password: hashedNew });
    }

    res.json({ message: "PASSKEY UPDATED SECURELY" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "SERVER SECURE FAULT" });
  }
});

// --- REAL-TIME CHAT LOGIC ---

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication Error"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload; 
    socket.user.ghostName = ghostTag(payload.id);
    next();
  } catch (err) {
    next(new Error("Authentication Error"));
  }
});

io.on('connection', async (socket) => {
  const sysState = await SystemState.findOne() || await SystemState.create({});
  socket.emit('system_state', sysState);

  const channel = socket.user.channel || 'general';
  socket.join(channel);

  const recentMessages = await Message.find({ channel }).sort({ sentAt: 1 }).limit(150);
  socket.emit('load_messages', recentMessages);

  // --- JOIN / LEAVE LOGIC ---
  socket.on('identify', () => {
    socket.ghostName = socket.user.ghostName;
    socket.btId = socket.user.id;
    onlineSockets.set(socket.id, socket.btId);

    const channel = socket.user.channel || 'general';
    io.to(channel).emit('receive_message', { system: true, channel, color: "#00bb2d", text: `[${socket.ghostName}] CONNECTED TO NODE` });
    io.emit('active_users', Array.from(new Set(onlineSockets.values())));
  });

  socket.on('disconnect', () => {
    if (socket.ghostName) {
      onlineSockets.delete(socket.id);
      const channel = socket.user.channel || 'general';
      io.to(channel).emit('receive_message', { system: true, channel, color: "#993300", text: `[${socket.ghostName}] NODE DISCONNECTED` });
      io.emit('active_users', Array.from(new Set(onlineSockets.values())));
    }
  });

  // --- TYPING INDICATOR ---
  socket.on('typing', (data) => {
    data.ghost = socket.user.ghostName;
    const ch = data.channel === 'ds' ? 'ds' : 'general';
    socket.broadcast.to(ch).emit('user_typing', data); 
  });

  // Listen for new messages
  socket.on('send_message', async (data) => {
    // Server-side Firewall: Limit data size to prevent DoS attacks
    if (!data.text || typeof data.text !== 'string' || data.text.length > 300) return;

    const btId = socket.user.id;
    const ghost = socket.user.ghostName;
    const targetChannel = data.channel === 'ds' ? 'ds' : 'general';

    // Channel Security Lockdown
    if (targetChannel === 'ds' && !btId.startsWith('bt25csd') && !socket.user.isAdmin) return;

    const currentState = await SystemState.findOne();
    if (currentState?.isMuted && !socket.user.isAdmin) return; 

    // Server-side firewall: Check if blocked mid-session
    const isBlocked = await BlockedUser.findOne({ btId });
    if (isBlocked) return; 

    const newMessage = new Message({
      text: data.text,
      btId,
      ghost,
      channel: targetChannel,
      sentAt: new Date() 
    });

    await newMessage.save();
    const payload = newMessage.toObject();
    if (data.clientMsgId) payload.clientMsgId = data.clientMsgId;
    io.to(targetChannel).emit('receive_message', payload); 
  });

  // --- REPORTING & ADMIN LOGIC ---
  socket.on('submit_report', async (data) => {
    data.reporterBtId = socket.user.id;
    data.reporterGhost = socket.user.ghostName;
    const newReport = await Report.create(data);
    io.emit('new_report', newReport); 
  });

  socket.on('request_admin_data', async () => {
    if (!socket.user.isAdmin) return;
    const reports = await Report.find().sort({ createdAt: -1 });
    const blockedUsers = await BlockedUser.find();
    socket.emit('admin_data', { 
      reports, 
      blockedIds: blockedUsers.map(b => b.btId) 
    });
  });

  socket.on('toggle_block', async (data) => {
    if (!socket.user.isAdmin) return;
    
    if (data.isBlocked) {
      const exists = await BlockedUser.findOne({ btId: data.btId });
      if (!exists) await BlockedUser.create({ btId: data.btId });
      
      // Live kick signal
      io.emit('kick_banned_user', data.btId);
      
    } else {
      await BlockedUser.deleteOne({ btId: data.btId });
    }
    
    const updatedBlocked = await BlockedUser.find();
    io.emit('blocked_list_updated', updatedBlocked.map(b => b.btId));
  });

  socket.on('admin_command', async (cmdData) => {
    if (!socket.user.isAdmin) return;

    let sysState = await SystemState.findOne() || await SystemState.create({});

    if (cmdData.action === 'toggle_mute') {
      sysState.isMuted = !sysState.isMuted;
      await sysState.save();
      io.emit('system_state', sysState);
      io.emit('receive_message', { system: true, color: sysState.isMuted ? "#ff8800" : "#00FF41", text: sysState.isMuted ? "ALL USERS MUTED BY ADMIN" : "MUTE LIFTED BY ADMIN" });
    }
    
    if (cmdData.action === 'toggle_lock') {
      sysState.isLocked = !sysState.isLocked;
      await sysState.save();
      io.emit('system_state', sysState);
      io.emit('receive_message', { system: true, color: sysState.isLocked ? "#ff4444" : "#00FF41", text: sysState.isLocked ? "CHANNEL LOCKED" : "CHANNEL UNLOCKED" });
    }

    if (cmdData.action === 'clear_messages') {
      await Message.deleteMany({});
      io.emit('clear_all_messages');
    }

    if (cmdData.action === 'force_logout') {
      io.emit('force_logout_all');
    }

    if (cmdData.action === 'delete_report' && cmdData.reportId) {
      await Report.findByIdAndDelete(cmdData.reportId);
      const reports = await Report.find().sort({ createdAt: -1 });
      const blockedUsers = await BlockedUser.find();
      io.emit('admin_data', { reports, blockedIds: blockedUsers.map(b => b.btId) });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // --- RENDER KEEP-ALIVE ---
  // Pings itself every 14 minutes to prevent Render free tier from sleeping
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  if (SELF_URL) {
    setInterval(() => {
      fetch(`${SELF_URL}/ping`)
        .then(res => console.log(`[KEEP-ALIVE] Pinged self at ${new Date().toISOString()} - Status: ${res.status}`))
        .catch(err => console.error('[KEEP-ALIVE] Error pinging self:', err.message));
    }, 14 * 60 * 1000); // 14 mins
  }
});