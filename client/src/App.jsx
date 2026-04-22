import { useState, useRef, useEffect } from "react";
import { Terminal, ShieldAlert, Lock, Flag, Users, LogOut, Zap, UserX, AlertTriangle, X, Eye, EyeOff, AlertOctagon, VolumeX, Volume2, Trash2, LogIn } from "lucide-react";
import axios from "axios";
import { io } from "socket.io-client";

// --- COMM LINKS ---
const API_URL = "http://127.0.0.1:5000/api";
const socket = io("http://127.0.0.1:5000", { autoConnect: false });

// --- CONSTANTS & GENERATORS ---
const ADMIN_ID   = "bt25csd064";
const ALL_IDS    = Array.from({length:70},(_,i)=>`bt25csd${String(i+1).padStart(3,"0")}`);
const MSG_TTL    = 60000;
const DAY_NUM    = Math.floor(Date.now() / 86400000); 

const PFX = ["OPERATOR","GHOST","CIPHER","PHANTOM","SHADOW","VECTOR","NEXUS","PROXY","DAEMON","SPECTER"];
const SFX = ["ALPHA","BETA","GAMMA","DELTA","SIGMA","OMEGA","ZETA","THETA","KAPPA","LAMBDA"];

const ghostTag = (id, day=DAY_NUM) => {
  if(id===ADMIN_ID) return "SUDO_MASTER";
  const n   = parseInt(id.slice(-3))-1;
  const pi  = (n + day*3) % PFX.length;
  const si  = (Math.floor(n/7) + day*2) % SFX.length;
  return `${PFX[pi]}_${SFX[si]}_${(n+1)}`;
};

const SCAN = {background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.13) 2px,rgba(0,0,0,0.13) 4px)",pointerEvents:"none"};
const GLOW     = "0 0 8px rgba(0,255,65,0.25)";
const G  = "#00FF41";
const DG = "#003d0f";
const MG = "#00861f";

const BOOT_LINES = ["TERMINAL v1.0 INITIALIZING...","LOADING CRYPTO MODULES... OK","ESTABLISHING SECURE TUNNEL... OK","VERIFYING OPERATOR IDENTITY... OK","ACCESS GRANTED"];

const DISCLAIMER_POINTS = [
  {icon:"⚠",title:"MONITORED ENVIRONMENT",body:"All messages are logged by the System Administrator."},
  {icon:"🚫",title:"ZERO TOLERANCE",body:"Misconduct will result in immediate blocking from the DS node."},
  {icon:"⏱",title:"AUTO-VANISH",body:"Messages auto-vanish after 60 seconds on the server."}
];

const inp_s  = {width:"100%",background:"#000",border:`1px solid ${DG}`,color:G,padding:"9px 12px",outline:"none",fontSize:14,fontFamily:"'Courier New',monospace",boxSizing:"border-box"};
const btn_p  = {flex:1,background:"#001a07",border:"1px solid #00661a",color:G,padding:"9px 0",fontSize:12,letterSpacing:"0.18em",cursor:"pointer",fontFamily:"'Courier New',monospace"};
const btn_ab = {background:"#000",border:"1px solid #001a07",color:"#00661a",padding:"9px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Courier New',monospace"};

const CtrlBtn = ({onClick,title,children,danger,active,disabled})=>(
  <button onClick={disabled?undefined:onClick} title={title}
    style={{
      display:"flex",alignItems:"center",gap:5,fontSize:11,padding:"4px 10px",cursor:disabled?"not-allowed":"pointer",
      border:`1px solid ${danger?(active?"#ff4444":"#550000"):active?"#ffd700":DG}`,
      color: danger?(active?"#ff4444":"#661100"):active?"#ffd700":DG,
      background:"#000",fontFamily:"'Courier New',monospace",letterSpacing:"0.1em",
      opacity:disabled?0.4:1,transition:"all 0.15s",
    }}>
    {children}
  </button>
);

const SysMsg = ({text,color="#ffcc44"})=>(
  <div style={{textAlign:"center",fontSize:12,color,letterSpacing:"0.12em",padding:"8px 0",borderTop:`1px dashed ${DG}`,borderBottom:`1px dashed ${DG}`,margin:"6px 0"}}>
    ◈ {text} ◈
  </div>
);

export default function App() {
  const [showDisclaimer,setShowDisclaimer] = useState(true);
  const [agreed,setAgreed]       = useState(false);
  const [scr,setScr]             = useState("map");
  const [user,setUser]           = useState(null);
  const [creds,setCreds]         = useState({id:"",pw:""});
  const [err,setErr]             = useState("");
  const [loading,setLoad]        = useState(false);
  const [prog,setProg]           = useState(0);
  const [boot,setBoot]           = useState([]);
  const [msgs,setMsgs]           = useState([]);
  const [inp,setInp]             = useState("");
  const [tab,setTab]             = useState("chat");
  const [now,setNow]             = useState(Date.now());

  // Admin Data States
  const [reports,setReports]     = useState([]);
  const [blocked,setBlocked]     = useState([]);
  const [reportModal,setReportModal] = useState(null);
  const [reportReason,setReportReason] = useState("");
  const [revealedIds,setRevealedIds] = useState({});

  // Backend Sync States
  const [muted,setMuted]         = useState(false);
  const [locked,setLocked]       = useState(false);

  const endRef = useRef(null);

  useEffect(()=>{ const iv=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(iv); },[]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,scr,tab]);

  // --- SOCKET.IO REAL-TIME LISTENERS ---
  useEffect(() => {
    socket.on("system_state", (state) => {
      if(state) { setMuted(state.isMuted); setLocked(state.isLocked); }
    });

    socket.on("load_messages", (pastMessages) => setMsgs(pastMessages));
    socket.on("receive_message", (m) => setMsgs((p) => [...p, m]));
    socket.on("clear_all_messages", () => setMsgs([]));
    
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
    };
  }, []);

  function deny(msg){ setErr(msg); }

  async function doLogin(){
    const id = creds.id.toLowerCase().trim();
    const pw = creds.pw;
    
    setErr(""); setLoad(true); setProg(0); setBoot([]);
    
    try {
      const response = await axios.post(`${API_URL}/login`, { id, pw });
      
      let p=0,bi=0;
      const iv=setInterval(()=>{
        p+=Math.random()*16+5; setProg(Math.min(p,100));
        if(p>=(bi+1)*(100/BOOT_LINES.length)&&bi<BOOT_LINES.length){ setBoot(b=>[...b,BOOT_LINES[bi]]); bi++; }
        if(p>=100){ 
          clearInterval(iv); 
          setTimeout(()=>{ 
            setUser(response.data.user);
            if(response.data.sysState) {
              setMuted(response.data.sysState.isMuted); setLocked(response.data.sysState.isLocked);
            }
            socket.connect(); 
            if(response.data.user.isAdmin) {
              socket.emit('request_admin_data', response.data.user.id);
            }
            setLoad(false); setScr("chat"); 
          }, 400); 
        }
      },90);

    } catch (error) {
      setLoad(false);
      if (error.response && error.response.data) deny(error.response.data.error);
      else deny("NETWORK ERROR — CANNOT REACH SERVER");
    }
  }

  function send(){
    if(!inp.trim()||!user||(!user.isAdmin&&muted)) return;
    socket.emit("send_message", { text: inp.trim(), btId: user.id, ghost: user.ghost });
    setInp("");
  }

  function submitReport(){
    if(!reportModal) return;
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

  function logout(){ 
    setUser(null); setScr("map"); setTab("chat"); setCreds({id:"",pw:""}); setErr(""); 
    socket.disconnect();
  }

  const sendAdminCmd = (action) => socket.emit('admin_command', { adminId: user.id, action });
  const secondsLeft = m => Math.max(0,Math.ceil((MSG_TTL-(now-new Date(m.sentAt).getTime()))/1000));

  /* ─── MODALS ─── */
  const DisclaimerModal = () => (
    <div style={{position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.97)", fontFamily: "'Courier New',monospace"}}>
      <div style={{width: "100%", maxWidth: 600, background: "#000", border: "1px solid #cc2200", boxShadow: "0 0 30px rgba(200,0,0,0.2), 0 0 18px rgba(255,0,0,0.45)", display: "flex", flexDirection: "column", maxHeight: "90vh"}}>
        <div style={{padding: "18px 24px", borderBottom: "1px solid #330000", flexShrink: 0}}>
          <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 6}}>
            <AlertOctagon size={18} style={{color: "#ff2222"}}/>
            <span style={{fontSize: 15, fontWeight: "bold", color: "#ff2222", letterSpacing: "0.2em"}}>SYSTEM DISCLAIMER</span>
          </div>
          <div style={{fontSize: 12, color: "#661100", letterSpacing: "0.12em"}}>READ CAREFULLY BEFORE PROCEEDING</div>
        </div>
        <div style={{overflowY: "auto", padding: "20px 24px", flex: 1}}>
          <div style={{fontSize: 13, color: "#ff4444", marginBottom: 20, lineHeight: 1.8, border: "1px solid #330000", padding: "12px 16px", background: "rgba(50,0,0,0.2)"}}>
            By entering this terminal, you acknowledge that you have read, understood, and agree to abide by all rules. Failure to comply will result in permanent access revocation.
          </div>
          {DISCLAIMER_POINTS.map((pt,i)=>(
            <div key={i} style={{marginBottom: 18, paddingBottom: 18, borderBottom: i<DISCLAIMER_POINTS.length-1 ? "1px solid #001a07" : "none"}}>
              <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                <span style={{fontSize: 15}}>{pt.icon}</span>
                <span style={{fontSize: 13, fontWeight: "bold", color: G, letterSpacing: "0.12em"}}>{String(i+1).padStart(2,"0")}. {pt.title}</span>
              </div>
              <div style={{fontSize: 13, color: "#99ddaa", lineHeight: 1.8, paddingLeft: 24}}>{pt.body}</div>
            </div>
          ))}
        </div>
        <div style={{padding: "18px 24px", borderTop: "1px solid #001a07", flexShrink: 0, background: "#000"}}>
          <label style={{display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16}}>
            <div onClick={()=>setAgreed(a=>!a)}
              style={{width: 16, height: 16, border: `1px solid ${agreed?G:DG}`, background: agreed?"#001a07":"#000", flexShrink: 0, marginTop: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"}}>
              {agreed && <span style={{color: G, fontSize: 13, lineHeight: 1}}>✓</span>}
            </div>
            <span style={{fontSize: 13, color: agreed?G:"#00661a", lineHeight: 1.5}}>I agree to conduct myself responsibly within the DS terminal.</span>
          </label>
          <div style={{display: "flex", gap: 10}}>
            <button onClick={()=>{if(agreed)setShowDisclaimer(false);}}
              style={{...btn_p, opacity: agreed?1:0.35, cursor: agreed?"pointer":"not-allowed", background: agreed?"#001a07":"#000", border: agreed?"1px solid #00661a":"1px solid #001a07", fontSize: 13, padding: "10px 0"}}>
              ◈ ACCEPT & ENTER
            </button>
            <button onClick={()=>window.location.reload()}
              style={{...btn_ab, fontSize: 13, padding: "10px 18px", borderColor: "#330000", color: "#661100"}}>
              DECLINE
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── MAP SCREEN ─── */
  if(scr==="map") return (
    <div style={{position: "relative", minHeight: "100vh", backgroundColor: "#000", overflow: "hidden", fontFamily:"'Courier New',monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px"}}>
      <div style={{...SCAN, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40}}/>
      {showDisclaimer && <DisclaimerModal />}
      {err && <div style={{position: "absolute", top: "16px", width: "100%", textAlign: "center", color: "#ff4444", fontWeight: "bold", zIndex: 50}}>⚠ {err}</div>}
      
      <div style={{position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", color: G}}>
        <div style={{textAlign: "center", marginBottom: "40px"}}>
          <div style={{fontSize: 12, color: DG, letterSpacing: "0.3em", marginBottom: 8}}>◈ NEXUS_OS v1.0 ◈</div>
          <div style={{fontSize: 30, fontWeight: "bold", letterSpacing: "0.35em", textShadow: GLOW}}>TERMINAL</div>
          <div style={{fontSize: 11, color: "#00661a", letterSpacing: "0.2em", marginTop: 4}}>CLASSIFIED // AUTHORIZED OPERATORS ONLY</div>
        </div>
        
        <button onClick={()=>{setCreds({id:"",pw:""});setErr("");setScr("login");}}
          style={{width: 340, textAlign: "left", padding: 28, cursor: "pointer", background: "#000", border: `1px solid ${DG}`, color: G, transition: "all 0.2s"}}>
          <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 12}}>
            <Terminal size={22} style={{color: "#00bb2d"}}/>
            <span style={{fontSize: 22, fontWeight: "bold", letterSpacing: "0.35em"}}>DS</span>
          </div>
          <div style={{fontSize: 13, color: "#00661a", marginBottom: 16, lineHeight: 1.7}}>Data Science Division — All Operators Authorized</div>
          <div style={{height: 1, background: "#001a07", marginBottom: 16}}/>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: 11, color: DG}}>
            <span style={{display: "flex", alignItems: "center", gap: 4}}><Users size={11}/>70 OPERATORS ENROLLED</span>
            <span style={{display: "flex", alignItems: "center", gap: 4}}><Lock size={11}/>SECURED</span>
          </div>
          <div style={{marginTop: 16, fontSize: 11, color: "#00330d", letterSpacing: "0.15em", textAlign: "center"}}>[ CLICK TO AUTHENTICATE ]</div>
        </button>
        
        <div style={{marginTop: 24, fontSize: 11, color: "#003d0f", letterSpacing: "0.15em"}}>GHOST TAGS ROTATE EVERY 24 HOURS</div>
      </div>
    </div>
  );

  /* ─── LOGIN SCREEN ─── */
  if(scr==="login") return (
    <div style={{position: "relative", minHeight: "100vh", backgroundColor: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", overflow: "hidden", fontFamily:"'Courier New',monospace"}}>
      <div style={{...SCAN, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40}}/>
      <div style={{position: "relative", zIndex: 10, width: "100%", maxWidth: "384px", padding: "32px", background:"#000", border:"1px solid #00661a", boxShadow:GLOW, color:G}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <Lock size={16} style={{color:"#00bb2d"}}/>
          <span style={{fontSize:13,fontWeight:"bold",letterSpacing:"0.18em"}}>SECURE AUTH</span>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:MG,marginBottom:4}}>OPERATOR_ID</div>
          <input style={inp_s} placeholder="bt25csd###" value={creds.id}
            onChange={e=>setCreds(p=>({...p,id:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:MG,marginBottom:4}}>PASSKEY</div>
          <input type="password" style={inp_s} placeholder="••••••••••" value={creds.pw}
            onChange={e=>setCreds(p=>({...p,pw:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
        </div>
        {err&&<div style={{color:"#ff2222",fontSize:13,fontWeight:"bold",marginBottom:14}}>⚠ {err}</div>}
        {loading&&(
          <div style={{marginBottom:14}}>
            {boot.map((l,i)=><div key={i} style={{fontSize:12,color:"#00bb2d",marginBottom:2}}>&gt; {l}</div>)}
            <div style={{marginTop:8,fontSize:12,color:"#00661a",marginBottom:6}}>DECRYPTING...</div>
            <div style={{width:"100%",background:"#001a07",height:6}}><div style={{background:G,height:6,width:`${prog}%`}}/></div>
          </div>
        )}
        {!loading&&(
          <div style={{display:"flex",gap:8}}>
            <button onClick={doLogin} style={btn_p}>AUTHENTICATE</button>
            <button onClick={()=>setScr("map")} style={btn_ab}>ABORT</button>
          </div>
        )}
      </div>
    </div>
  );

  /* ─── MAIN TERMINAL ─── */
  if(scr==="chat"&&user) return (
    <div style={{position: "relative", display: "flex", flexDirection: "column", backgroundColor: "#000", overflow: "hidden", height:"100vh", fontFamily:"'Courier New',monospace", color:G}}>
      <div style={{...SCAN, position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40}}/>

      {/* Report Modal */}
      {reportModal&&(
        <div style={{position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.88)"}}>
          <div style={{width:360,background:"#000",border:"1px solid #cc2200",boxShadow:"0 0 20px rgba(200,0,0,0.3)",padding:26,color:G}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:"bold",color:"#ff4444"}}><AlertTriangle size={15}/>REPORT TRANSMISSION</div>
              <button onClick={()=>setReportModal(null)} style={{background:"none",border:"none",cursor:"pointer",color:DG}}><X size={15}/></button>
            </div>
            <div style={{fontSize:11,color:DG,marginBottom:4}}>FLAGGING OPERATOR</div>
            <div style={{fontSize:13,color:"#ff4444",marginBottom:12,border:"1px solid #330000",padding:"7px 10px"}}>[{reportModal.msg.ghost}]</div>
            <div style={{fontSize:11,color:MG,marginBottom:4}}>REASON FOR REPORT</div>
            <textarea style={{...inp_s,resize:"none",height:70,marginBottom:16}} placeholder="Describe the violation..."
              value={reportReason} onChange={e=>setReportReason(e.target.value)} />
            <div style={{display:"flex",gap:8}}>
              <button onClick={submitReport} style={{...btn_p,background:"#1a0000",border:"1px solid #550000",color:"#ff4444"}}>SUBMIT REPORT</button>
              <button onClick={()=>setReportModal(null)} style={btn_ab}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", flexShrink: 0, borderBottom:"1px solid #001a07", background:"#000"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Terminal size={15} style={{color:"#00bb2d"}}/>
          <span style={{fontSize:17,fontWeight:"bold",letterSpacing:"0.3em"}}>TERMINAL</span>
          {locked&&<span style={{fontSize:10,color:"#ff4444",border:"1px solid #550000",padding:"1px 6px"}}>LOCKED</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:11,color:"#00661a"}}>[{user.ghost}]</span>
          <button onClick={logout} style={{background:"none",border:"none",cursor:"pointer",color:DG}}><LogOut size={14}/></button>
        </div>
      </div>

      {/* Admin controls & Tabs */}
      {user.isAdmin&&(
        <div style={{position: "relative", zIndex: 10, flexShrink: 0, borderBottom:"1px solid #001a07", background:"#000"}}>
          <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid #001007"}}>
            {["chat","reports","users"].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{fontSize:12,padding:"7px 18px",letterSpacing:"0.15em",cursor:"pointer",background:"none",border:"none",color:tab===t?G:DG,borderBottom:tab===t?`1px solid ${G}`:"1px solid transparent",fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>
                {t}{t==="reports"&&reports.length>0?` (${reports.length})`:""}
              </button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",flexWrap:"wrap"}}>
            <CtrlBtn onClick={()=>sendAdminCmd('toggle_mute')} active={muted}>{muted?"UNMUTE ALL":"MUTE ALL"}</CtrlBtn>
            <CtrlBtn onClick={()=>sendAdminCmd('toggle_lock')} active={locked}>{locked?"UNLOCK CHANNEL":"LOCK CHANNEL"}</CtrlBtn>
            <CtrlBtn onClick={()=>sendAdminCmd('force_logout')} danger>LOGOUT ALL</CtrlBtn>
            <CtrlBtn onClick={()=>sendAdminCmd('clear_messages')} danger>CLEAR MSG</CtrlBtn>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {(tab==="chat"||!user.isAdmin)&&(
        <>
          <div style={{position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "16px"}}>
            {msgs.length===0&&<div style={{textAlign:"center",marginTop:40,color:DG,fontSize:13,letterSpacing:"0.2em"}}>◈ DS CHANNEL CLEAR ◈</div>}
            {msgs.map(m=>{
              if(m.system) return <SysMsg key={m._id || Math.random()} text={m.text} color={m.color}/>;
              const secs = secondsLeft(m);
              const fading = secs <= 10;
              if (secs <= 0) return null;
              
              return (
                <div key={m._id || m.id || Math.random()} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"5px 0",opacity:fading?0.4+0.6*(secs/10):1,transition:"opacity 0.5s",borderBottom:"1px solid #000c04"}}>
                  <div style={{flex:1,minWidth:0,lineHeight:1.8}}>
                    <span style={{fontSize:13,fontWeight:"bold",marginRight:8,color:m.ghost==="SUDO_MASTER"?"#ffd700":MG}}>[{m.ghost}]</span>
                    <span style={{fontSize:14,color:"#ccffdd",wordBreak:"break-word"}}>{m.text}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0,paddingTop:3}}>
                    <span style={{fontSize:10,color:fading?"#cc2200":DG,minWidth:26,textAlign:"right"}}>{secs}s</span>
                    <div style={{display:"flex",gap:4}}>
                      {m.btId!==user.id&&<button onClick={()=>setReportModal({msg:m})} style={{background:"none",border:"none",cursor:"pointer",color:DG,padding:0}}><Flag size={13}/></button>}
                      {user.isAdmin&&m.btId!==ADMIN_ID&&<button onClick={()=>toggleBlockUser(m.btId, true)} style={{background:"none",border:"none",cursor:"pointer",color:DG,padding:0}}><UserX size={13}/></button>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef}/>
          </div>
          <div style={{position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", flexShrink: 0, borderTop:"1px solid #001a07", background:"#000"}}>
            <span style={{color:"#00bb2d",fontSize:16}}>{">"}</span>
            {!user.isAdmin&&muted
              ? <div style={{flex:1,fontSize:13,color:"#ff8800",letterSpacing:"0.1em"}}>⊘ CHANNEL MUTED BY ADMIN</div>
              : <input autoFocus style={{flex:1,background:"transparent",border:"none",color:G,fontSize:14,outline:"none",fontFamily:"'Courier New',monospace"}}
                  placeholder="TRANSMIT MESSAGE..." value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
            }
            <button onClick={send} disabled={!user.isAdmin&&muted} style={{fontSize:12,padding:"5px 14px",cursor:(!user.isAdmin&&muted)?"not-allowed":"pointer",background:"#001a07",border:`1px solid ${DG}`,color:MG}}>TX</button>
          </div>
        </>
      )}

      {/* REPORTS TAB */}
      {user.isAdmin&&tab==="reports"&&(
        <div style={{position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "16px"}}>
          <div style={{fontSize:13,color:"#cc2200",marginBottom:16,display:"flex",alignItems:"center",gap:6,letterSpacing:"0.12em"}}><ShieldAlert size={14}/>INCIDENT REPORT LOG</div>
          {reports.length===0 ? <div style={{textAlign:"center",marginTop:60,color:DG,fontSize:13}}>NO REPORTS ON RECORD</div> : reports.map((r,i)=>(
              <div key={i} style={{border:"1px solid #330000",padding:16,marginBottom:12,background:"rgba(30,0,0,0.2)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:11,color:DG,marginBottom:3}}>REPORTED BY</div>
                    <div style={{fontSize:13,color:MG}}>[{r.reporterGhost}]</div>
                    <div style={{fontSize:11,color:DG}}>{r.reporterBtId}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:DG,marginBottom:3}}>REPORTED OPERATOR</div>
                    <div style={{fontSize:13,color:"#ff4444",fontWeight:"bold"}}>[{r.reportedGhost}]</div>
                    <div style={{fontSize:11,color:"#661100"}}>{r.reportedBtId}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:DG,marginBottom:4}}>FLAGGED MESSAGE</div>
                <div style={{fontSize:13,color:"#ccffdd",border:`1px solid ${DG}`,padding:"7px 10px",marginBottom:10,wordBreak:"break-word"}}>{r.msgText}</div>
                <div style={{fontSize:11,color:DG,marginBottom:4}}>REASON</div>
                <div style={{fontSize:13,color:"#ffcc44",marginBottom:12}}>{r.reason}</div>
                {!blocked.includes(r.reportedBtId)&&r.reportedBtId!==ADMIN_ID
                  ? <button onClick={()=>toggleBlockUser(r.reportedBtId, true)} style={{fontSize:12,padding:"5px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,border:"1px solid #550000",color:"#cc2200",background:"#000",fontFamily:"'Courier New',monospace"}}><UserX size={13}/>BLOCK OPERATOR</button>
                  : <span style={{fontSize:12,color:"#330000",letterSpacing:"0.1em"}}>◈ OPERATOR BLOCKED</span>
                }
              </div>
          ))}
        </div>
      )}

      {/* USERS TAB */}
      {user.isAdmin&&tab==="users"&&(
        <div style={{position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "16px"}}>
          <div style={{fontSize:13,color:MG,marginBottom:16,display:"flex",alignItems:"center",gap:6,letterSpacing:"0.12em"}}><Users size={14}/>DS OPERATOR REGISTRY</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:2}}>
            {ALL_IDS.map(id=>{
              const isBlocked = blocked.includes(id);
              const revealed = revealedIds[id];
              return (
                <div key={id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,padding:"8px 10px",borderBottom:"1px solid #001007",background:isBlocked?"rgba(30,0,0,0.3)":"transparent"}}>
                  <div style={{minWidth:0}}>
                    <span style={{color:id===ADMIN_ID?"#665000":isBlocked?"#330000":MG,fontWeight:"bold"}}>{ghostTag(id)}</span>
                    {revealed&&<div style={{color:isBlocked?"#440000":"#00661a",fontSize:11,marginTop:1}}>{id}</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                    <button onClick={()=>setRevealedIds(p=>({...p,[id]:!p[id]}))} style={{background:"none",border:"none",cursor:"pointer",color:revealed?G:DG}}>{revealed?<EyeOff size={13}/>:<Eye size={13}/>}</button>
                    {id!==ADMIN_ID&&(
                      isBlocked ? <button onClick={()=>toggleBlockUser(id, false)} style={{fontSize:10,padding:"2px 7px",cursor:"pointer",border:"1px solid #333",color:"#666",background:"#000"}}>UNBLOCK</button>
                                : <button onClick={()=>toggleBlockUser(id, true)} style={{background:"none",border:"none",cursor:"pointer",color:DG}}><UserX size={13}/></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}