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

const app = express();

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

const isValid = id => /^bt25csd(0[0-6]\d|070)$/.test(id) && parseInt(id.slice(-3))>=1;
const mkPass = id => id===ADMIN_ID ? ADMIN_PASS : id+"2026!";

// Server generates the Ghost Tag securely
const ghostTag = (id) => {
  if(id===ADMIN_ID) return "SUDO_MASTER";
  const day = Math.floor(Date.now() / 86400000);
  const n = parseInt(id.slice(-3))-1;
  const pi = (n + day*3) % PFX.length;
  const si = (Math.floor(n/7) + day*2) % SFX.length;
  return `${PFX[pi]}_${SFX[si]}_${(n+1)}`;
};

// --- API ROUTES ---
app.get('/ping', (req, res) => res.status(200).send('pong'));

app.post('/api/login', async (req, res) => {
  const { id, pw } = req.body;
  const cleanId = id.toLowerCase().trim();

  if (!isValid(cleanId)) return res.status(400).json({ error: "ACCESS DENIED — INVALID OPERATOR ID" });

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

  const token = jwt.sign({ id: cleanId, isAdmin: cleanId === ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: '12h' });
  
  res.json({ 
    token, 
    user: { id: cleanId, ghost: ghostTag(cleanId), isAdmin: cleanId === ADMIN_ID },
    sysState
  });
});

app.post('/api/change-password', async (req, res) => {
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

const onlineSockets = new Map();

// --- REAL-TIME CHAT LOGIC ---
io.on('connection', async (socket) => {
  const sysState = await SystemState.findOne() || await SystemState.create({});
  socket.emit('system_state', sysState);

  const recentMessages = await Message.find().sort({ sentAt: 1 }).limit(50);
  socket.emit('load_messages', recentMessages);

  // --- JOIN / LEAVE LOGIC ---
  socket.on('identify', (data) => {
    const isObj = typeof data === 'object';
    socket.ghostName = isObj ? data.ghost : data;
    socket.btId = isObj ? data.btId : null;
    if (socket.btId) onlineSockets.set(socket.id, socket.btId);

    io.emit('receive_message', { system: true, color: "#00bb2d", text: `[${socket.ghostName}] CONNECTED TO NODE` });
    io.emit('active_users', Array.from(new Set(onlineSockets.values())));
  });

  socket.on('disconnect', () => {
    if (socket.ghostName) {
      onlineSockets.delete(socket.id);
      io.emit('receive_message', { system: true, color: "#993300", text: `[${socket.ghostName}] NODE DISCONNECTED` });
      io.emit('active_users', Array.from(new Set(onlineSockets.values())));
    }
  });

  // --- TYPING INDICATOR ---
  socket.on('typing', (data) => {
    socket.broadcast.emit('user_typing', data); 
  });

  // Listen for new messages
  socket.on('send_message', async (data) => {
    const currentState = await SystemState.findOne();
    if (currentState?.isMuted && data.btId !== ADMIN_ID) return; 

    // Server-side firewall: Check if blocked mid-session
    const isBlocked = await BlockedUser.findOne({ btId: data.btId });
    if (isBlocked) return; 

    const newMessage = new Message({
      text: data.text,
      btId: data.btId,
      ghost: data.ghost,
      sentAt: new Date() 
    });

    await newMessage.save();
    io.emit('receive_message', newMessage); 
  });

  // --- REPORTING & ADMIN LOGIC ---
  socket.on('submit_report', async (data) => {
    const newReport = await Report.create(data);
    io.emit('new_report', newReport); 
  });

  socket.on('request_admin_data', async (adminId) => {
    if (adminId !== ADMIN_ID) return;
    const reports = await Report.find().sort({ createdAt: -1 });
    const blockedUsers = await BlockedUser.find();
    socket.emit('admin_data', { 
      reports, 
      blockedIds: blockedUsers.map(b => b.btId) 
    });
  });

  socket.on('toggle_block', async (data) => {
    if (data.adminId !== ADMIN_ID) return;
    
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
    if (cmdData.adminId !== ADMIN_ID) return; 

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