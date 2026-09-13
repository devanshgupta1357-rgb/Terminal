import { useState, useRef, useEffect, useMemo } from "react";
import { Terminal, ShieldAlert, Lock, Flag, Users, LogOut, Zap, UserX, AlertTriangle, X, Eye, EyeOff, AlertOctagon, VolumeX, Volume2, Trash2, LogIn } from "lucide-react";
import axios from "axios";
import { io } from "socket.io-client";

// --- COMM LINKS ---
const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";
const socket = io(API_URL, { autoConnect: false });

// --- CONSTANTS & GENERATORS ---
const ADMIN_ID = "bt25csd064";

const VALID_BATCHES = {
  bt24cse: 223, bt24csa: 67, bt24csd: 66, bt24csh: 66, bt24ece: 132, bt24eci: 49,
  bt25cse: 220, bt25csd: 70, bt25csa: 68, bt25csh: 74, bt25ece: 132, bt25eci: 69,
  bt26cse: 220, bt26csd: 70, bt26csa: 68, bt26csh: 74, bt26ece: 132, bt26eci: 69
};

let TOTAL_USERS = 0;
const BATCH_OFFSETS = {};
const ALL_IDS = [];
Object.entries(VALID_BATCHES).forEach(([prefix, max]) => {
  BATCH_OFFSETS[prefix] = TOTAL_USERS;
  TOTAL_USERS += max;
  for (let i = 1; i <= max; i++) {
    ALL_IDS.push(`${prefix}${String(i).padStart(3, "0")}`);
  }
});

function getUserIndex(id) {
  const m = id.match(/^(bt2[456][a-z]{3})(\d{3})$/);
  if (!m) return -1;
  return BATCH_OFFSETS[m[1]] + (parseInt(m[2], 10) - 1);
}

const MSG_TTL = 60000;
const DAY_NUM = Math.floor(Date.now() / 86400000);

const PFX = ["OPERATOR", "GHOST", "CIPHER", "PHANTOM", "SHADOW", "VECTOR", "NEXUS", "PROXY", "DAEMON", "SPECTER"];
const SFX = ["ALPHA", "BETA", "GAMMA", "DELTA", "SIGMA", "OMEGA", "ZETA", "THETA", "KAPPA", "LAMBDA"];

const ghostTag = (id, day = DAY_NUM) => {
  if (id === ADMIN_ID) return "SUDO_MASTER";
  const idx = getUserIndex(id);
  if (idx === -1) return "UNKNOWN_ENTIY_00";
  const scrambled = (idx * 17 + day * 31) % TOTAL_USERS;
  const pi = scrambled % 10;
  const si = Math.floor(scrambled / 10) % 10;
  const subNum = Math.floor(scrambled / 100) + 1;
  const numStr = String(subNum).padStart(2, "0");
  return `${PFX[pi]}_${SFX[si]}_${numStr}`;
};

const SCAN = { background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.13) 2px,rgba(0,0,0,0.13) 4px)", pointerEvents: "none" };
const GLOW = "0 0 8px rgba(0,255,65,0.25)";
const G = "#00FF41";
const DG = "#003d0f";
const MG = "#00861f";

const BOOT_LINES = ["TERMINAL v1.0 INITIALIZING...", "LOADING CRYPTO MODULES... OK", "ESTABLISHING SECURE TUNNEL... OK", "VERIFYING OPERATOR IDENTITY... OK", "ACCESS GRANTED"];

const DISCLAIMER_POINTS = [
  { icon: "⚠", title: "MONITORED ENVIRONMENT", body: "All messages are logged by the System Administrator." },
  { icon: "🚫", title: "ZERO TOLERANCE", body: "Misconduct will result in immediate blocking from the DS node." },
  { icon: "⏱", title: "AUTO-VANISH", body: "Messages auto-vanish after 60 seconds on the server." }
];

const inp_s = { width: "100%", background: "#000", border: `1px solid ${DG}`, color: G, padding: "9px 12px", outline: "none", fontSize: 14, fontFamily: "'Courier New',monospace", boxSizing: "border-box" };
const btn_p = { flex: 1, background: "#001a07", border: "1px solid #00661a", color: G, padding: "9px 0", fontSize: 12, letterSpacing: "0.18em", cursor: "pointer", fontFamily: "'Courier New',monospace" };
const btn_ab = { background: "#000", border: "1px solid #001a07", color: "#00661a", padding: "9px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Courier New',monospace" };

const CtrlBtn = ({ onClick, title, children, danger, active, disabled }) => (
  <button onClick={disabled ? undefined : onClick} title={title}
    style={{
      display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", cursor: disabled ? "not-allowed" : "pointer",
      border: `1px solid ${danger ? (active ? "#ff4444" : "#550000") : active ? "#ffd700" : DG}`,
      color: danger ? (active ? "#ff4444" : "#661100") : active ? "#ffd700" : DG,
      background: "#000", fontFamily: "'Courier New',monospace", letterSpacing: "0.1em",
      opacity: disabled ? 0.4 : 1, transition: "all 0.15s",
    }}>
    {children}
  </button>
);

const SysMsg = ({ text, color = "#ffcc44" }) => (
  <div style={{ textAlign: "center", fontSize: 12, color, letterSpacing: "0.12em", padding: "8px 0", borderTop: `1px dashed ${DG}`, borderBottom: `1px dashed ${DG}`, margin: "6px 0" }}>
    ◈ {text} ◈
  </div>
);

export default function App() {
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [scr, setScr] = useState("map");
  const [user, setUser] = useState(null);
  const [creds, setCreds] = useState({ id: "", pw: "" });
  const [err, setErr] = useState("");
  const [loading, setLoad] = useState(false);
  const [prog, setProg] = useState(0);
  const [boot, setBoot] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [tab, setTab] = useState("chat");
  const [activeChannel, setActiveChannel] = useState("general");
  const [now, setNow] = useState(Date.now());
  const [typing, setTyping] = useState([]);
  const typingTimeout = useRef(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [channelUserCount, setChannelUserCount] = useState(0);
  const [mentionQuery, setMentionQuery] = useState(null);

  const allGhosts = useMemo(() => ALL_IDS.map(id => ghostTag(id)).filter(g => g !== user?.ghost), [user]);

  // Admin Data States
  const [reports, setReports] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [reportModal, setReportModal] = useState(null);
  const [passModal, setPassModal] = useState(false);
  const [passData, setPassData] = useState({ current: "", newPass: "", confirm: "", err: "", success: "" });
  const [reportReason, setReportReason] = useState("");
  const [revealedIds, setRevealedIds] = useState({});

  // Backend Sync States
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);

  const endRef = useRef(null);

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, scr, tab]);

  // --- SOCKET.IO REAL-TIME LISTENERS ---
  useEffect(() => {
    socket.on("system_state", (state) => {
      if (state) { setMuted(state.isMuted); setLocked(state.isLocked); }
    });

    socket.on("load_messages", (pastMessages) => setMsgs(pastMessages));
    socket.on("receive_message", (m) => setMsgs((prev) => {
      if (m.clientMsgId) {
        const idx = prev.findIndex(msg => msg._id === m.clientMsgId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = m;
          return next;
        }
      }
      if (prev.some(msg => msg._id === m._id)) return prev;
      return [...prev, m].slice(-50);
    }));
    socket.on("clear_all_messages", () => setMsgs([]));

    socket.on("user_typing", (data) => {
      setTyping(p => {
        if (!p.includes(data.ghost) && data.isTyping) return [...p, data.ghost];
        if (!data.isTyping) return p.filter(g => g !== data.ghost);
        return p;
      });
    });

    socket.on("active_users", (users) => setActiveUsers(users));
    socket.on("channel_users", (count) => setChannelUserCount(count));

    socket.on("admin_data", (data) => {
      setReports(data.reports);
      setBlocked(data.blockedIds);
    });

    socket.on("new_report", (r) => setReports(p => [r, ...p]));
    socket.on("blocked_list_updated", (blockedIds) => setBlocked(blockedIds));

    socket.on("force_logout_all", () => {
      setUser(null); setScr("map"); setErr("SESSION TERMINATED BY ADMIN");
      socket.disconnect();
    });

    socket.on("kick_banned_user", (bannedBtId) => {
      setUser(currentUser => {
        if (currentUser && currentUser.id === bannedBtId) {
          socket.disconnect();
          setScr("map");
          setErr("ACCESS BLOCKED — YOU HAVE BEEN BANNED BY ADMIN");
          return null;
        }
        return currentUser;
      });
    });

    return () => {
      socket.off("system_state"); socket.off("load_messages"); socket.off("receive_message");
      socket.off("clear_all_messages"); socket.off("admin_data"); socket.off("new_report");
      socket.off("blocked_list_updated"); socket.off("force_logout_all"); socket.off("kick_banned_user");
      socket.off("user_typing"); socket.off("active_users");
    };
  }, []);

  function deny(msg) { setErr(msg); }

  async function doLogin() {
    const id = creds.id.toLowerCase().trim();
    const pw = creds.pw;

    setErr(""); setLoad(true); setProg(0); setBoot([]);

    try {
      const response = await axios.post(`${API_URL}/api/login`, { id, pw, channel: activeChannel });

      let p = 0, bi = 0;
      const iv = setInterval(() => {
        p += Math.random() * 16 + 5; setProg(Math.min(p, 100));
        if (p >= (bi + 1) * (100 / BOOT_LINES.length) && bi < BOOT_LINES.length) { setBoot(b => [...b, BOOT_LINES[bi]]); bi++; }
        if (p >= 100) {
          clearInterval(iv);
          setTimeout(() => {
            setUser(response.data.user);
            if (response.data.sysState) {
              setMuted(response.data.sysState.isMuted); setLocked(response.data.sysState.isLocked);
            }
            socket.auth = { token: response.data.token };
            socket.connect();
            socket.emit('identify');
            if (response.data.user.isAdmin) {
              socket.emit('request_admin_data', response.data.user.id);
            }
            setLoad(false); setScr("chat");
          }, 400);
        }
      }, 90);

    } catch (error) {
      setLoad(false);
      if (error.response && error.response.data) deny(error.response.data.error);
      else deny("NETWORK ERROR — CANNOT REACH SERVER");
    }
  }

  function handleInpChange(e) {
    const val = e.target.value;
    setInp(val);

    const lastWord = val.split(" ").pop();
    if (lastWord.startsWith("@") && lastWord.length <= 20) {
      setMentionQuery(lastWord.slice(1).toUpperCase());
    } else {
      setMentionQuery(null);
    }

    if (!user || (!user.isAdmin && muted)) return;
    
    socket.emit("typing", { ghost: user.ghost, channel: activeChannel, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { ghost: user.ghost, channel: activeChannel, isTyping: false });
    }, 2500);
  }

  const canSend = activeChannel === 'general' || user?.id.startsWith('bt25csd') || user?.isAdmin;

  function send() {
    if (!inp.trim() || !user || (!user.isAdmin && muted) || !canSend) return;
    const txt = inp.trim();
    setInp("");
    
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const optMsg = { _id: tempId, text: txt, btId: user.id, ghost: user.ghost, channel: activeChannel, sentAt: new Date().toISOString(), pending: true };
    setMsgs(prev => [...prev, optMsg]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 10);

    socket.emit("send_message", { text: txt, channel: activeChannel, clientMsgId: tempId });
    socket.emit("typing", { ghost: user.ghost, channel: activeChannel, isTyping: false });
    clearTimeout(typingTimeout.current);
  }

  function submitReport() {
    if (!reportModal) return;
    const m = reportModal.msg;
    socket.emit('submit_report', {
      reporterBtId: user.id, reporterGhost: user.ghost,
      reportedBtId: m.btId, reportedGhost: m.ghost,
      msgText: m.text, reason: reportReason.trim() || "No reason given"
    });
    setReportModal(null); setReportReason("");
  }

  function toggleBlockUser(btId, isBlocked) {
    socket.emit('toggle_block', { adminId: user.id, btId, isBlocked });
  }

  function logout() {
    setUser(null); setScr("map"); setTab("chat"); setCreds({ id: "", pw: "" }); setErr("");
    socket.disconnect();
  }

  async function updatePass() {
    setPassData(p => ({ ...p, err: "", success: "" }));
    if (!passData.current || !passData.newPass) return setPassData(p => ({ ...p, err: "FILL ALL FIELDS" }));
    if (passData.newPass !== passData.confirm) return setPassData(p => ({ ...p, err: "NEW PASSKEYS DO NOT MATCH" }));
    if (passData.newPass.length < 6) return setPassData(p => ({ ...p, err: "PASSKEY MUST BE AT LEAST 6 CHARACTERS" }));

    try {
      const res = await axios.post(`${API_URL}/api/change-password`, {
        id: user.id, currentPw: passData.current, newPw: passData.newPass
      });
      setPassData({ current: "", newPass: "", confirm: "", err: "", success: res.data.message });
      setTimeout(() => {
        setPassModal(false);
        setPassData({ current: "", newPass: "", confirm: "", err: "", success: "" });
      }, 1500);
    } catch (e) {
      if (e.response?.data) setPassData(p => ({ ...p, err: e.response.data.error }));
      else setPassData(p => ({ ...p, err: "NETWORK FAULT" }));
    }
  }

  const sendAdminCmd = (action, payload = {}) => socket.emit('admin_command', { adminId: user.id, action, ...payload });
  const secondsLeft = m => Math.max(0, Math.ceil((MSG_TTL - (now - new Date(m.sentAt).getTime())) / 1000));

  /* ─── MODALS ─── */
  const DisclaimerModal = () => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.97)", fontFamily: "'Courier New',monospace" }}>
      <div style={{ width: "100%", maxWidth: 600, background: "#000", border: "1px solid #cc2200", boxShadow: "0 0 30px rgba(200,0,0,0.2), 0 0 18px rgba(255,0,0,0.45)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #330000", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <AlertOctagon size={18} style={{ color: "#ff2222" }} />
            <span style={{ fontSize: 15, fontWeight: "bold", color: "#ff2222", letterSpacing: "0.2em" }}>SYSTEM DISCLAIMER</span>
          </div>
          <div style={{ fontSize: 12, color: "#661100", letterSpacing: "0.12em" }}>READ CAREFULLY BEFORE PROCEEDING</div>
        </div>
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          <div style={{ fontSize: 13, color: "#ff4444", marginBottom: 20, lineHeight: 1.8, border: "1px solid #330000", padding: "12px 16px", background: "rgba(50,0,0,0.2)" }}>
            By entering this terminal, you acknowledge that you have read, understood, and agree to abide by all rules. Failure to comply will result in permanent access revocation.
          </div>
          {DISCLAIMER_POINTS.map((pt, i) => (
            <div key={i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: i < DISCLAIMER_POINTS.length - 1 ? "1px solid #001a07" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 15 }}>{pt.icon}</span>
                <span style={{ fontSize: 13, fontWeight: "bold", color: G, letterSpacing: "0.12em" }}>{String(i + 1).padStart(2, "0")}. {pt.title}</span>
              </div>
              <div style={{ fontSize: 13, color: "#99ddaa", lineHeight: 1.8, paddingLeft: 24 }}>{pt.body}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "18px 24px", borderTop: "1px solid #001a07", flexShrink: 0, background: "#000" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}>
            <div onClick={() => setAgreed(a => !a)}
              style={{ width: 16, height: 16, border: `1px solid ${agreed ? G : DG}`, background: agreed ? "#001a07" : "#000", flexShrink: 0, marginTop: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {agreed && <span style={{ color: G, fontSize: 13, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: G, lineHeight: 1.5 }}>I agree to conduct myself responsibly within the DS terminal.</span>
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { if (agreed) setShowDisclaimer(false); }}
              style={{ ...btn_p, opacity: agreed ? 1 : 0.35, cursor: agreed ? "pointer" : "not-allowed", background: agreed ? "#001a07" : "#000", border: agreed ? "1px solid #00661a" : "1px solid #001a07", fontSize: 13, padding: "10px 0" }}>
              ◈ ACCEPT & ENTER
            </button>
            <button onClick={() => window.location.reload()}
              style={{ ...btn_ab, fontSize: 13, padding: "10px 18px", borderColor: "#330000", color: "#661100" }}>
              DECLINE
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── MAP SCREEN (NODE SELECTOR) ─── */
  if (scr === "map") return (
    <div style={{ position: "relative", minHeight: "100dvh", backgroundColor: "#000", overflow: "hidden", fontFamily: "'Courier New',monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ ...SCAN, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} />
      {showDisclaimer && <DisclaimerModal />}
      {err && <div style={{ position: "absolute", top: "16px", width: "100%", textAlign: "center", color: "#ff4444", fontWeight: "bold", zIndex: 50 }}>⚠ {err}</div>}

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", color: G, width: "100%", maxWidth: 600 }}>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div style={{ fontSize: 12, color: DG, letterSpacing: "0.3em", marginBottom: 8 }}>◈ NEXUS_OS v1.0 ◈</div>
          <div style={{ fontSize: 30, fontWeight: "bold", letterSpacing: "0.35em", textShadow: GLOW }}>TERMINAL</div>
          <div style={{ fontSize: 11, color: "#00bb2d", letterSpacing: "0.2em", marginTop: 4 }}>SELECT TARGET ENDPOINT</div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", width: "100%" }}>
          <button onClick={() => { setActiveChannel("general"); setCreds({ id: "", pw: "" }); setErr(""); setScr("login"); }}
            style={{ flex: "1 1 240px", textAlign: "left", padding: 24, cursor: "pointer", background: "#001a07", border: `1px solid ${DG}`, color: G, transition: "all 0.2s", boxShadow: "0 4px 15px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Terminal size={20} style={{ color: "#00bb2d" }} />
              <span style={{ fontSize: 19, fontWeight: "bold", letterSpacing: "0.3em" }}>#GENERAL</span>
            </div>
            <div style={{ fontSize: 12, color: "#00bb2d", marginBottom: 12, lineHeight: 1.5 }}>Public Subnet</div>
            <div style={{ height: 1, background: "#00330d", marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DG }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} />1200+ OP(S)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Lock size={11} />ENCRYPTED</span>
            </div>
          </button>

          <button onClick={() => { setActiveChannel("ds"); setCreds({ id: "", pw: "" }); setErr(""); setScr("login"); }}
            style={{ flex: "1 1 240px", textAlign: "left", padding: 24, cursor: "pointer", background: "#001a07", border: `1px solid ${DG}`, color: G, transition: "all 0.2s", boxShadow: "0 4px 15px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Terminal size={20} style={{ color: "#00bb2d" }} />
              <span style={{ fontSize: 19, fontWeight: "bold", letterSpacing: "0.3em" }}>#DS_EXCLUSIVE</span>
            </div>
            <div style={{ fontSize: 12, color: "#00bb2d", marginBottom: 12, lineHeight: 1.5 }}>Data Science Node</div>
            <div style={{ height: 1, background: "#00330d", marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DG }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} />70 OP(S)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Lock size={11} />ENCRYPTED</span>
            </div>
          </button>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: "#003d0f", letterSpacing: "0.15em" }}>OPERATOR CREDENTIALS REQUIRED FOR ENTRY</div>
      </div>
    </div>
  );

  /* ─── LOGIN SCREEN ─── */
  if (scr === "login") return (
    <div style={{ position: "relative", minHeight: "100dvh", backgroundColor: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", overflow: "hidden", fontFamily: "'Courier New',monospace" }}>
      <div style={{ ...SCAN, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} />
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "384px", padding: "32px", background: "#000", border: "1px solid #00661a", boxShadow: GLOW, color: G }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Lock size={16} style={{ color: "#00bb2d" }} />
          <span style={{ fontSize: 13, fontWeight: "bold", letterSpacing: "0.18em" }}>SECURE AUTH</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: MG, marginBottom: 4 }}>OPERATOR_ID</div>
          <input style={inp_s} placeholder={activeChannel === "general" ? "bt id" : "bt25csd###"} value={creds.id}
            onChange={e => setCreds(p => ({ ...p, id: e.target.value }))} onKeyDown={e => e.key === "Enter" && doLogin()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: MG, marginBottom: 4 }}>PASSKEY</div>
          <input type="password" style={inp_s} placeholder="••••••••••" value={creds.pw}
            onChange={e => setCreds(p => ({ ...p, pw: e.target.value }))} onKeyDown={e => e.key === "Enter" && doLogin()} />
        </div>
        {err && <div style={{ color: "#ff2222", fontSize: 13, fontWeight: "bold", marginBottom: 14 }}>⚠ {err}</div>}
        {loading && (
          <div style={{ marginBottom: 14 }}>
            {boot.map((l, i) => <div key={i} style={{ fontSize: 12, color: "#00bb2d", marginBottom: 2 }}>&gt; {l}</div>)}
            <div style={{ marginTop: 8, fontSize: 12, color: "#00661a", marginBottom: 6 }}>DECRYPTING...</div>
            <div style={{ width: "100%", background: "#001a07", height: 6 }}><div style={{ background: G, height: 6, width: `${prog}%` }} /></div>
          </div>
        )}
        {!loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={doLogin} style={btn_p}>AUTHENTICATE</button>
            <button onClick={() => setScr("map")} style={btn_ab}>ABORT</button>
          </div>
        )}
      </div>
    </div>
  );

  /* ─── MAIN TERMINAL ─── */
  if (scr === "chat" && user) return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", backgroundColor: "#000", overflow: "hidden", height: "100dvh", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", fontFamily: "'Courier New',monospace", color: G }}>
      <div style={{ ...SCAN, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} />

      {/* Report Modal */}
      {reportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.88)" }}>
          <div style={{ width: 360, background: "#000", border: "1px solid #cc2200", boxShadow: "0 0 20px rgba(200,0,0,0.3)", padding: 26, color: G }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: "bold", color: "#ff4444" }}><AlertTriangle size={15} />REPORT TRANSMISSION</div>
              <button onClick={() => setReportModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DG }}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 11, color: DG, marginBottom: 4 }}>FLAGGING OPERATOR</div>
            <div style={{ fontSize: 13, color: "#ff4444", marginBottom: 12, border: "1px solid #330000", padding: "7px 10px" }}>[{reportModal.msg.ghost}]</div>
            <div style={{ fontSize: 11, color: MG, marginBottom: 4 }}>REASON FOR REPORT</div>
            <textarea style={{ ...inp_s, resize: "none", height: 70, marginBottom: 16 }} placeholder="Describe the violation..."
              value={reportReason} onChange={e => setReportReason(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submitReport} style={{ ...btn_p, background: "#1a0000", border: "1px solid #550000", color: "#ff4444" }}>SUBMIT REPORT</button>
              <button onClick={() => setReportModal(null)} style={btn_ab}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Passkey Modal */}
      {passModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.88)" }}>
          <div style={{ width: 320, background: "#000", border: "1px solid #00bb2d", boxShadow: "0 0 20px rgba(0,255,65,0.2)", padding: 26, color: G }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: "bold", color: "#00bb2d", letterSpacing: "0.1em" }}><Lock size={15} /> UPDATE PASSKEY</div>
              <button onClick={() => setPassModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: DG }}><X size={15} /></button>
            </div>
            
            <div style={{ fontSize: 11, color: MG, marginBottom: 4 }}>CURRENT PASSKEY</div>
            <input type="password" style={{ ...inp_s, marginBottom: 12 }} value={passData.current} onChange={e => setPassData(p => ({ ...p, current: e.target.value }))} />
            
            <div style={{ fontSize: 11, color: MG, marginBottom: 4 }}>NEW PASSKEY</div>
            <input type="password" style={{ ...inp_s, marginBottom: 12 }} value={passData.newPass} onChange={e => setPassData(p => ({ ...p, newPass: e.target.value }))} />
            
            <div style={{ fontSize: 11, color: MG, marginBottom: 4 }}>CONFIRM NEW PASSKEY</div>
            <input type="password" style={{ ...inp_s, marginBottom: 16 }} value={passData.confirm} onChange={e => setPassData(p => ({ ...p, confirm: e.target.value }))} onKeyDown={e => e.key === "Enter" && updatePass()} />
            
            {passData.err && <div style={{ fontSize: 11, color: "#ff4444", marginBottom: 12, fontWeight: "bold" }}>⚠ {passData.err}</div>}
            {passData.success && <div style={{ fontSize: 11, color: "#00bb2d", marginBottom: 12, fontWeight: "bold" }}>{passData.success}</div>}
            
            <button onClick={updatePass} style={{ ...btn_p, width: "100%", padding: "10px 0" }}>CONFIRM UPDATE</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 16px", flex: "none", borderBottom: "1px solid #001a07", background: "#000" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Terminal size={15} style={{ color: "#00bb2d" }} />
          <span style={{ fontSize: 17, fontWeight: "bold", letterSpacing: "0.3em" }}>TERMINAL</span>
          {locked && <span style={{ fontSize: 10, color: "#ff4444", border: "1px solid #550000", padding: "1px 6px" }}>LOCKED</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          {user.isAdmin ? (
             <span style={{ fontSize: 11, color: "#00bb2d", display: "flex", alignItems: "center", gap: 4 }} title="GLOBAL ONLINE COUNT">
               <Users size={12} /> {activeUsers.length} ONLINE
             </span>
          ) : (
             <span style={{ fontSize: 11, color: "#00bb2d", display: "flex", alignItems: "center", gap: 4 }} title={`USERS IN ${activeChannel.toUpperCase()}`}>
               <Zap size={12} /> {channelUserCount} ONLINE
             </span>
          )}
          <span style={{ fontSize: 11, color: user.ghost === "SUDO_MASTER" ? "#ffd700" : G, fontWeight: "bold" }}>[{user.ghost}]</span>
          <button onClick={() => { setPassModal(true); setPassData({ current: "", newPass: "", confirm: "", err: "", success: "" }); }} title="CHANGE PASSKEY" style={{ background: "none", border: "none", cursor: "pointer", color: "#00bb2d" }}><Lock size={18} /></button>
          <button onClick={logout} title="LOGOUT" style={{ background: "none", border: "none", cursor: "pointer", color: "#00bb2d" }}><LogOut size={18} /></button>
        </div>
      </header>

      {/* Admin controls & Tabs */}
      {user.isAdmin && (
        <div style={{ position: "relative", zIndex: 10, flex: "none", borderBottom: "1px solid #001a07", background: "#000" }}>
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #001007" }}>
            {["chat", "reports", "users"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ fontSize: 12, padding: "7px 18px", letterSpacing: "0.15em", cursor: "pointer", background: "none", border: "none", color: tab === t ? G : DG, borderBottom: tab === t ? `1px solid ${G}` : "1px solid transparent", fontFamily: "'Courier New',monospace", textTransform: "uppercase" }}>
                {t}{t === "reports" && reports.length > 0 ? ` (${reports.length})` : ""}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", flexWrap: "wrap" }}>
            <CtrlBtn onClick={() => sendAdminCmd('toggle_mute')} active={muted}>{muted ? "UNMUTE ALL" : "MUTE ALL"}</CtrlBtn>
            <CtrlBtn onClick={() => sendAdminCmd('toggle_lock')} active={locked}>{locked ? "UNLOCK CHANNEL" : "LOCK CHANNEL"}</CtrlBtn>
            <CtrlBtn onClick={() => sendAdminCmd('force_logout')} danger>LOGOUT ALL</CtrlBtn>
            <CtrlBtn onClick={() => sendAdminCmd('clear_messages')} danger>CLEAR MSG</CtrlBtn>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {(tab === "chat" || !user.isAdmin) && (
        <>
          <main style={{ position: "relative", zIndex: 10, flex: "1 1 auto", overflowY: "auto", padding: "16px" }}>
            {msgs.filter(m => m.channel === activeChannel).length === 0 && <div style={{ textAlign: "center", marginTop: 40, color: DG, fontSize: 13, letterSpacing: "0.2em" }}>◈ CHANNEL CLEAR ◈</div>}
            {msgs.filter(m => m.channel === activeChannel).map(m => {
              if (m.system) return <SysMsg key={m._id || Math.random()} text={m.text} color={m.color} />;
              const secs = secondsLeft(m);
              const fading = secs <= 10;
              if (secs <= 0) return null;

              const isTagged = m.text.includes(`@${user.ghost}`);
              return (
                <div key={m._id || m.id || Math.random()} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 6px", margin: "2px 0", background: isTagged ? "rgba(0,255,65,0.08)" : "transparent", borderLeft: isTagged ? `2px solid ${G}` : "2px solid transparent", opacity: m.pending ? 0.6 : (fading ? 0.4 + 0.6 * (secs / 10) : 1), transition: "opacity 0.5s", borderBottom: isTagged ? "none" : "1px solid #000c04" }}>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.8 }}>
                    <span style={{ fontSize: 13, fontWeight: "bold", marginRight: 8, color: m.ghost === "SUDO_MASTER" ? "#ffd700" : (m.pending ? "#00661a" : G) }}>[{m.ghost}]</span>
                    <span style={{ fontSize: 14, color: m.pending ? "#00661a" : "#ccffdd", wordBreak: "break-word" }}>
                      {m.text.split(new RegExp(`(@${user.ghost})`, 'gi')).map((part, i) => 
                         part.toUpperCase() === `@${user.ghost}` ? <span key={i} style={{ color: "#000", background: m.pending ? "#00661a" : G, padding: "0 4px", fontWeight: "bold" }}>{part}</span> : part
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, paddingTop: 3 }}>
                    <span style={{ fontSize: 10, color: fading && !m.pending ? "#cc2200" : "#00bb2d", minWidth: 26, textAlign: "right", letterSpacing: m.pending ? "0.2em" : "normal" }}>
                      {m.pending ? "..." : `${secs}s`}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {m.btId !== user.id && <button onClick={() => setReportModal({ msg: m })} style={{ background: "none", border: "none", cursor: "pointer", color: DG, padding: 0 }}><Flag size={13} /></button>}
                      {user.isAdmin && m.btId !== ADMIN_ID && <button onClick={() => toggleBlockUser(m.btId, true)} style={{ background: "none", border: "none", cursor: "pointer", color: DG, padding: 0 }}><UserX size={13} /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {typing.length > 0 && (
              <div style={{ fontSize: 11, color: "#00bb2d", paddingTop: 10, fontStyle: "italic", letterSpacing: "0.1em" }}>
                ◈ [{typing[0]}] {typing.length > 1 ? `AND +${typing.length - 1} OTHER(S) ARE TRANSMITTING...` : "IS TRANSMITTING..."}
              </div>
            )}
            <div ref={endRef} />
          </main>
          <footer style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", gap: "8px", padding: "12px 16px", flex: "none", borderTop: "1px solid #001a07", background: "#000" }}>
            {mentionQuery !== null && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {allGhosts.filter(g => g.includes(mentionQuery)).slice(0, 5).map(g => (
                  <button key={g} onClick={() => {
                    const words = inp.split(" ");
                    words.pop();
                    setInp(words.join(" ") + (words.length ? " " : "") + "@" + g + " ");
                    setMentionQuery(null);
                  }} style={{ background: "#001a07", border: `1px solid ${DG}`, color: G, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: "'Courier New',monospace" }}>
                    @{g}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#00bb2d", fontSize: 16 }}>{">"}</span>
              {!user.isAdmin && muted
                ? <div style={{ flex: 1, fontSize: 13, color: "#ff8800", letterSpacing: "0.1em" }}>⊘ CHANNEL MUTED BY ADMIN</div>
                : !canSend
                ? <div style={{ flex: 1, fontSize: 13, color: "#cc2200", letterSpacing: "0.1em" }}>⊘ INSUFFICIENT CLEARANCE</div>
                : <input autoFocus maxLength={300} style={{ flex: 1, background: "transparent", border: "none", color: G, fontSize: 14, outline: "none", fontFamily: "'Courier New',monospace" }}
                  placeholder="TRANSMIT MESSAGE (MAX 300 CHARS)..." value={inp} onChange={handleInpChange} onKeyDown={e => e.key === "Enter" && send()} />
              }
              <button onClick={send} disabled={(!user.isAdmin && muted) || !canSend} style={{ fontSize: 12, padding: "5px 14px", cursor: ((!user.isAdmin && muted) || !canSend) ? "not-allowed" : "pointer", background: "#001a07", border: `1px solid ${DG}`, color: MG }}>TX</button>
            </div>
          </footer>
        </>
      )}

      {/* REPORTS TAB */}
      {user.isAdmin && tab === "reports" && (
        <main style={{ position: "relative", zIndex: 10, flex: "1 1 auto", overflowY: "auto", padding: "16px" }}>
          <div style={{ fontSize: 13, color: "#cc2200", marginBottom: 16, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.12em" }}><ShieldAlert size={14} />INCIDENT REPORT LOG</div>
          {reports.length === 0 ? <div style={{ textAlign: "center", marginTop: 60, color: DG, fontSize: 13 }}>NO REPORTS ON RECORD</div> : reports.map((r, i) => (
            <div key={i} style={{ border: "1px solid #330000", padding: 16, marginBottom: 12, background: "rgba(30,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: DG, marginBottom: 3 }}>REPORTED BY</div>
                  <div style={{ fontSize: 13, color: MG }}>[{r.reporterGhost}]</div>
                  <div style={{ fontSize: 11, color: DG }}>{r.reporterBtId}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: DG, marginBottom: 3 }}>REPORTED OPERATOR</div>
                  <div style={{ fontSize: 13, color: "#ff4444", fontWeight: "bold" }}>[{r.reportedGhost}]</div>
                  <div style={{ fontSize: 11, color: "#661100" }}>{r.reportedBtId}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: DG, marginBottom: 4 }}>FLAGGED MESSAGE</div>
              <div style={{ fontSize: 13, color: "#ccffdd", border: `1px solid ${DG}`, padding: "7px 10px", marginBottom: 10, wordBreak: "break-word" }}>{r.msgText}</div>
              <div style={{ fontSize: 11, color: DG, marginBottom: 4 }}>REASON</div>
              <div style={{ fontSize: 13, color: "#ffcc44", marginBottom: 12 }}>{r.reason}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                {!blocked.includes(r.reportedBtId) && r.reportedBtId !== ADMIN_ID
                  ? <button onClick={() => toggleBlockUser(r.reportedBtId, true)} style={{ fontSize: 12, padding: "5px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, border: "1px solid #550000", color: "#cc2200", background: "#000", fontFamily: "'Courier New',monospace" }}><UserX size={13} />BLOCK OPERATOR</button>
                  : <span style={{ fontSize: 12, color: "#330000", letterSpacing: "0.1em" }}>◈ OPERATOR BLOCKED</span>
                }
                <button onClick={() => sendAdminCmd('delete_report', { reportId: r._id })} style={{ fontSize: 12, padding: "5px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, border: "none", color: "#666", background: "none", fontFamily: "'Courier New',monospace", transition: "all 0.2s" }}><Trash2 size={13} />DISMISS</button>
              </div>
            </div>
          ))}
        </main>
      )}

      {/* USERS TAB */}
      {user.isAdmin && tab === "users" && (
        <main style={{ position: "relative", zIndex: 10, flex: "1 1 auto", overflowY: "auto", padding: "16px" }}>
          <div style={{ fontSize: 13, color: "#00bb2d", marginBottom: 16, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.12em" }}><Users size={14} />SYSTEM REGISTRY</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 2 }}>
            {ALL_IDS.map(id => {
              const isBlocked = blocked.includes(id);
              const isOnline = activeUsers.includes(id);
              const revealed = revealedIds[id];
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "8px 10px", borderBottom: "1px solid #001007", background: isBlocked ? "rgba(30,0,0,0.3)" : "transparent" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isOnline && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00bb2d", boxShadow: "0 0 5px #00bb2d", flexShrink: 0 }} />}
                      <span style={{ color: id === ADMIN_ID ? "#665000" : isBlocked ? "#330000" : MG, fontWeight: "bold" }}>{ghostTag(id)}</span>
                    </div>
                    {revealed && <div style={{ color: isBlocked ? "#440000" : "#00661a", fontSize: 11, marginTop: 1, paddingLeft: isOnline ? 12 : 0 }}>{id}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button onClick={() => setRevealedIds(p => ({ ...p, [id]: !p[id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: revealed ? G : DG }}>{revealed ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    {id !== ADMIN_ID && (
                      isBlocked ? <button onClick={() => toggleBlockUser(id, false)} style={{ fontSize: 10, padding: "2px 7px", cursor: "pointer", border: "1px solid #333", color: "#666", background: "#000" }}>UNBLOCK</button>
                        : <button onClick={() => toggleBlockUser(id, true)} style={{ background: "none", border: "none", cursor: "pointer", color: DG }}><UserX size={13} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}