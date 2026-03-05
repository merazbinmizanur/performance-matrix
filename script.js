// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyA5NT48twuSMxm9QN8267fiMxzZjpJttTo",
    authDomain: "slc-friendly.firebaseapp.com",
    projectId: "slc-friendly",
    storageBucket: "slc-friendly.firebasestorage.app",
    messagingSenderId: "202552361992",
    appId: "1:202552361992:web:12b6fca5539c0e7b0e3dbd",
    measurementId: "G-BKM1JDZER7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Constants & State
const ADMIN_PASS = "00110011";
const MAX_MATCHES_OPPONENT = 5;

let state = {
    players: [],
    matches:[],
    isAdmin: false,
    currentUser: null,
    activeTab: 'home'
};

let confirmCallback = null;

// --- 2. UTILS ---

function notify(message, iconName = 'info') {
    const toast = document.getElementById('custom-toast');
    document.getElementById('toast-message').innerText = message;
    document.getElementById('toast-icon').setAttribute('data-lucide', iconName);
    lucide.createIcons();
    toast.classList.remove('hidden');
    toast.classList.add('animate-pop-in');
    setTimeout(() => { toast.classList.add('hidden'); toast.classList.remove('animate-pop-in'); }, 3000);
}
// Copy ID Function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        notify("ID Copied to Clipboard!", "copy");
    }).catch(err => {
        notify("Copy Failed", "x-circle");
    });
}

function askConfirm(message, callback) {
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('modal-confirm').classList.remove('hidden');
    confirmCallback = callback;
}
document.getElementById('confirm-ok').onclick = () => { document.getElementById('modal-confirm').classList.add('hidden'); if(confirmCallback) confirmCallback(); };
document.getElementById('confirm-cancel').onclick = () => { document.getElementById('modal-confirm').classList.add('hidden'); confirmCallback = null; };
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function getAvatarUI(p, w="w-10", h="h-10", tSize="text-xs") {
    if(!p) return `<div class="${w} ${h} rounded-full bg-slate-800 border border-white/10"></div>`;
    const initial = (p.name || "U").charAt(0).toUpperCase();
    if(p.avatar) {
        return `<img src="${p.avatar}" class="${w} ${h} rounded-full object-cover border border-white/10" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <div class="${w} ${h} rounded-full bg-slate-800 hidden items-center justify-center font-black text-white ${tSize} border border-white/10">${initial}</div>`;
    }
    return `<div class="${w} ${h} rounded-full bg-slate-800 flex items-center justify-center font-black text-white ${tSize} border border-white/10">${initial}</div>`;
}

// Time Helpers
function getMonthId(timestamp) {
    const d = new Date(timestamp);
    return `MO-${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
}
function getMonthName(monthId) {
    const parts = monthId.split('-'); if(parts.length!==3) return monthId;
    const d = new Date(parts[1], parseInt(parts[2])-1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}
function getWeekId(timestamp) {
    const d = new Date(timestamp);
    const day = d.getDay();
    const shift = (day === 6) ? 0 : day + 1; // Sat=0, Sun=1... Fri=6
    d.setDate(d.getDate() - shift); // Get to the Saturday
    return `WK-${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}
function getWeekName(weekId) {
    const parts = weekId.split('-'); if(parts.length!==4) return weekId;
    const start = new Date(parts[1], parseInt(parts[2])-1, parts[3]);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${end.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'2-digit'})}`;
}

// --- 3. AUTHENTICATION ---

function switchAuthTab(type) {
    const reg = document.getElementById('reg-form');
    const log = document.getElementById('login-form');
    const bReg = document.getElementById('btn-tab-reg');
    const bLog = document.getElementById('btn-tab-login');
    const activeCls = "flex-1 py-2 text-[10px] font-black uppercase rounded-lg bg-emerald-600 text-white transition-all";
    const inactiveCls = "flex-1 py-2 text-[10px] font-black uppercase rounded-lg text-slate-500 transition-all";
    
    if(type === 'reg') { reg.classList.remove('hidden'); log.classList.add('hidden'); bReg.className=activeCls; bLog.className=inactiveCls; }
    else { log.classList.remove('hidden'); reg.classList.add('hidden'); bLog.className=activeCls; bReg.className=inactiveCls; }
}

async function registerPlayer() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const avatar = document.getElementById('reg-avatar').value.trim();
    const btn = document.getElementById('btn-reg-submit');

    if(!name || !phone) return notify("Name and Phone required!", "alert-circle");
    btn.innerText = "PROCESSING..."; btn.disabled = true;

    // SPM + 4 random + XYZ
    const id = `SPM${Math.floor(1000 + Math.random() * 9000)}XYZ`;

    const newP = { id, name, phone, avatar, createdAt: Date.now() };
    try {
        await db.collection("players").doc(id).set(newP);
        localStorage.setItem('slc_user', id);
        notify(`Success! Your ID: ${id}`, "check-circle");
        setTimeout(() => location.reload(), 2000);
    } catch(e) {
        notify("Database Error", "x-circle");
        btn.innerText = "Generate SPM-ID"; btn.disabled = false;
    }
}

async function loginWithID() {
    const id = document.getElementById('login-id').value.trim().toUpperCase();
    if(!id) return notify("Enter ID!", "alert-circle");
    
    try {
        const doc = await db.collection("players").doc(id).get();
        if(doc.exists) {
            localStorage.setItem('slc_user', id);
            notify("Login Successful!", "unlock");
            setTimeout(() => location.reload(), 1000);
        } else {
            notify("ID Not Found!", "x-octagon");
        }
    } catch(e) { notify("Connection Error", "wifi-off"); }
}

function loginAsAdmin() {
    const pass = document.getElementById('admin-secret-input').value;
    if(pass === ADMIN_PASS) {
        localStorage.setItem('slc_admin', 'true');
        notify("Admin Access Granted!", "shield-check");
        setTimeout(() => location.reload(), 1000);
    } else {
        notify("Wrong Password!", "lock");
    }
}

function logout() { localStorage.clear(); location.reload(); }

function initApp() {
    const uId = localStorage.getItem('slc_user');
    const aId = localStorage.getItem('slc_admin');
    
    if(!uId && !aId) return; // Stay on auth screen
    
    state.isAdmin = aId === 'true';
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('bottom-nav-container').classList.remove('hidden');
    
    if(state.isAdmin) document.getElementById('user-id-badge').innerText = "ADMIN MODE";
    else document.getElementById('user-id-badge').innerText = `ID: ${uId}`;

    listenData();
}

// --- 4. DATA SYNC & PROCESSING ---

function listenData() {
    // Listen Players
    db.collection("players").onSnapshot(snap => {
        state.players = snap.docs.map(d => d.data());
        if(!state.isAdmin) state.currentUser = state.players.find(p => p.id === localStorage.getItem('slc_user'));
        refreshUI();
    });

    // Listen Matches
    db.collection("matches").onSnapshot(snap => {
        state.matches = snap.docs.map(d => d.data());
        refreshUI();
    });
}

function calcLeaderboard(filterId, type) { // type: 'month' or 'week'
    let stats = {};
    state.players.forEach(p => {
        stats[p.id] = { ...p, mp:0, w:0, d:0, l:0, gs:0, gc:0, gd:0, pts:0 };
    });

    state.matches.forEach(m => {
        if(m.status !== 'played' || !m.playedAt) return;
        
        let matchPeriodId = type === 'month' ? getMonthId(m.playedAt) : getWeekId(m.playedAt);
        if(filterId !== 'all' && matchPeriodId !== filterId) return;

        const p1 = stats[m.p1Id]; const p2 = stats[m.p2Id];
        if(!p1 || !p2) return;

        const s1 = m.scoreP1; const s2 = m.scoreP2;
        p1.mp++; p2.mp++;
        p1.gs+=s1; p1.gc+=s2;
        p2.gs+=s2; p2.gc+=s1;

        if(s1 > s2) { p1.w++; p1.pts+=3; p2.l++; }
        else if(s2 > s1) { p2.w++; p2.pts+=3; p1.l++; }
        else { p1.d++; p2.d++; p1.pts+=1; p2.pts+=1; }
    });

    // Calc GD and Sort: PTS -> GD -> GS -> W
    let arr = Object.values(stats).map(s => { s.gd = s.gs - s.gc; return s; });
    // Remove players with 0 matches from ranking
    arr = arr.filter(s => s.mp > 0);
    
    arr.sort((a,b) => {
        if(b.pts !== a.pts) return b.pts - a.pts;
        if(b.gd !== a.gd) return b.gd - a.gd;
        if(b.gs !== a.gs) return b.gs - a.gs;
        return b.w - a.w;
    });
    return arr;
}

// --- 5. NAVIGATION ---

function switchTab(tab) {
    state.activeTab = tab;
    const views =['home', 'matches', 'monthly', 'weekly', 'profile', 'all-matches'];
    views.forEach(v => document.getElementById(`view-${v}`).classList.add('hidden'));
    
    if(tab !== 'all-matches') {
        const navs = ['home', 'matches', 'monthly', 'weekly', 'profile'];
        const indicator = document.getElementById('nav-indicator');
        
        navs.forEach(n => {
            const btn = document.getElementById(`nav-${n}`);
            btn.classList.remove('active', 'text-emerald-500');
            btn.classList.add('text-slate-500');
        });

        const activeBtn = document.getElementById(`nav-${tab}`);
        activeBtn.classList.remove('text-slate-500');
        activeBtn.classList.add('active', 'text-emerald-500');

        // Move Indicator
        const rect = activeBtn.getBoundingClientRect();
        const parentRect = activeBtn.parentElement.getBoundingClientRect();
        const centerX = rect.left - parentRect.left + (rect.width/2) - (indicator.offsetWidth/2);
        indicator.style.transform = `translateX(${centerX}px)`;
        indicator.style.opacity = '1';
    }

    document.getElementById(`view-${tab}`).classList.remove('hidden');
    refreshUI();
    lucide.createIcons();
}

// --- 6. UI RENDERING ---

function refreshUI() {
    if(state.activeTab === 'home') renderHome();
    if(state.activeTab === 'matches') renderMatchesView();
    if(state.activeTab === 'monthly') renderLeaderboardView('month');
    if(state.activeTab === 'weekly') renderLeaderboardView('week');
    if(state.activeTab === 'profile') renderProfile();
    if(state.activeTab === 'all-matches') renderAllMatches();
}

function renderHome() {
    document.getElementById('stat-total-players').innerText = state.players.length;
    document.getElementById('stat-total-matches').innerText = state.matches.filter(m=>m.status==='played').length;
}

// --- MATCHES MODULE ---
function renderMatchesView() {
    const p1Input = document.getElementById('match-p1');
    const p2Input = document.getElementById('match-p2');
    
    // Maintain selection if possible
    const val1 = p1Input.value; const val2 = p2Input.value;
    
    const listP1 = document.getElementById('list-p1');
    const listP2 = document.getElementById('list-p2');
    
    let htmlP1 = ''; let htmlP2 = '';
    
    state.players.forEach(p => {
        const safeName = p.name.replace(/'/g, "\\'");
        const avatarUI = getAvatarUI({avatar: p.avatar, name: p.name}, "w-8", "h-8", "text-[10px]");
        
        const template = (playerSlot) => `
            <div onclick="selectPlayer('${playerSlot}', '${p.id}', '${safeName}', '${p.avatar || ''}')" 
                 class="player-option ${playerSlot}-option flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors border border-transparent hover:border-white/5" 
                 data-name="${p.name.toLowerCase()}">
                ${avatarUI}
                <span class="text-[11px] font-black text-white uppercase tracking-wider truncate">${p.name}</span>
            </div>
        `;
        
        htmlP1 += template('p1');
        htmlP2 += template('p2');
    });

    listP1.innerHTML = htmlP1; listP2.innerHTML = htmlP2;

    // Restore previous selection display if available
    if(val1) { const pt = state.players.find(x=>x.id===val1); if(pt) selectPlayer('p1', pt.id, pt.name, pt.avatar, true); }
    if(val2) { const pt = state.players.find(x=>x.id===val2); if(pt) selectPlayer('p2', pt.id, pt.name, pt.avatar, true); }

    const list = document.getElementById('recent-matches-list');
    list.innerHTML = '';
    
    let sorted = [...state.matches].sort((a,b) => {
        if(a.status==='pending' && b.status==='played') return -1;
        if(a.status==='played' && b.status==='pending') return 1;
        return (b.playedAt || b.timestamp) - (a.playedAt || a.timestamp);
    });

    const display = sorted.slice(0, 5);
    display.forEach(m => list.appendChild(createMatchCard(m)));

    if(sorted.length > 5) {
        list.innerHTML += `<button onclick="switchTab('all-matches')" class="w-full py-3 bg-white/5 border border-white/5 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-white/10 mt-2">View All (${sorted.length})</button>`;
    }
}

function renderAllMatches() {
    const list = document.getElementById('full-match-history-list');
    list.innerHTML = '';
    let sorted = [...state.matches].sort((a,b) => (b.playedAt || b.timestamp) - (a.playedAt || a.timestamp));
    sorted.forEach(m => list.appendChild(createMatchCard(m)));
}
// --- CUSTOM DROPDOWN FUNCTIONALITY ---
function toggleDropdown(playerStr) {
    const dropdown = document.getElementById(`dropdown-${playerStr}`);
    const otherStr = playerStr === 'p1' ? 'p2' : 'p1';
    
    // Close the other dropdown if open
    document.getElementById(`dropdown-${otherStr}`).classList.add('hidden');
    
    // Toggle requested dropdown
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        document.getElementById(`search-${playerStr}`).focus();
        lucide.createIcons(); // reload icons for new elements
    }
}

function filterPlayers(playerStr) {
    const query = document.getElementById(`search-${playerStr}`).value.toLowerCase();
    const options = document.querySelectorAll(`.${playerStr}-option`);
    
    options.forEach(opt => {
        if (opt.getAttribute('data-name').includes(query)) {
            opt.classList.remove('hidden');
            opt.classList.add('flex');
        } else {
            opt.classList.remove('flex');
            opt.classList.add('hidden');
        }
    });
}

function selectPlayer(playerStr, id, name, avatar, skipClose = false) {
    document.getElementById(`match-${playerStr}`).value = id;
    
    const display = document.getElementById(`display-${playerStr}`);
    const avatarUI = getAvatarUI({ avatar: avatar, name: name }, "w-6", "h-6", "text-[8px]");
    
    display.innerHTML = `
        ${avatarUI}
        <span class="text-xs font-black text-white uppercase tracking-widest">${name}</span>
    `;
    
    if (!skipClose) document.getElementById(`dropdown-${playerStr}`).classList.add('hidden');
}

function resetPlayerSelection(playerStr) {
    document.getElementById(`match-${playerStr}`).value = '';
    document.getElementById(`display-${playerStr}`).innerHTML = `
        <div class="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center"><i data-lucide="user" class="w-3 h-3 text-slate-500"></i></div>
        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Player...</span>
    `;
    document.getElementById(`search-${playerStr}`).value = '';
    filterPlayers(playerStr); // Reset search filter visually
}

// Close dropdowns if clicked outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#custom-select-p1')) {
        const dp1 = document.getElementById('dropdown-p1');
        if (dp1) dp1.classList.add('hidden');
    }
    if (!e.target.closest('#custom-select-p2')) {
        const dp2 = document.getElementById('dropdown-p2');
        if (dp2) dp2.classList.add('hidden');
    }
});

async function createMatch() {
    const p1Id = document.getElementById('match-p1').value;
    const p2Id = document.getElementById('match-p2').value;
    const btn = document.getElementById('btn-create-match');

    if(!p1Id || !p2Id) return notify("Select both players", "alert-circle");
    if(p1Id === p2Id) return notify("Cannot play against yourself", "alert-triangle");

    // Rule: Max 5 Matches
    const existing = state.matches.filter(m => 
        (m.p1Id===p1Id && m.p2Id===p2Id) || (m.p1Id===p2Id && m.p2Id===p1Id)
    );
    if(existing.length >= 5 && !state.isAdmin) return notify("Limit Reached: Max 5 matches allowed", "lock");

    btn.innerText = "PROCESSING..."; btn.disabled = true;
    const p1 = state.players.find(p=>p.id===p1Id);
    const p2 = state.players.find(p=>p.id===p2Id);
    
    const id = `SPM${Math.floor(10000 + Math.random() * 90000)}S`;

    try {
        await db.collection("matches").doc(id).set({
            id, p1Id, p2Id, 
            p1Name: p1.name, p2Name: p2.name,
            p1Avatar: p1.avatar, p2Avatar: p2.avatar,
            scoreP1: null, scoreP2: null,
            status: 'pending', timestamp: Date.now()
        });
        notify("Match Created!", "swords");
resetPlayerSelection('p1');
resetPlayerSelection('p2');
lucide.createIcons();
    } catch(e) { notify("Error", "x"); }
    finally { btn.innerText = "Generate Match ID"; btn.disabled = false; }
}

function createMatchCard(m) {
    const div = document.createElement('div');
    const isPlayed = m.status === 'played';
    
    // Container Classes
    div.className = `p-[1.5px] rounded-[1.6rem] relative ${isPlayed ? 'moving-border' : 'moving-border-blue animate-pulse-slow cursor-pointer'}`;
    if(!isPlayed) div.onclick = () => openResultEntry(m.id);

    // Inner Content
    let scoreHtml = isPlayed 
        ? `<span class="text-xl font-black text-emerald-400">${m.scoreP1} - ${m.scoreP2}</span>` 
        : `<span class="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded uppercase tracking-widest">Awaiting Result</span>`;
    
    let subHtml = isPlayed 
        ? `<span class="text-[6px] text-slate-500 font-bold uppercase mt-1">Ver: ${m.submittedBy}</span>`
        : `<span class="text-[6px] text-slate-500 font-bold uppercase mt-1">Tap to enter score</span>`;

    // Admin Controls
    let adminHtml = '';
    if(state.isAdmin) {
        adminHtml = `
        <div class="absolute -top-2 -right-2 flex gap-1 z-20">
            ${isPlayed ? `<button onclick="event.stopPropagation(); openResultEntry('${m.id}')" class="p-1.5 bg-blue-600 rounded-lg text-white shadow"><i data-lucide="edit-2" class="w-3 h-3"></i></button>` : ''}
            <button onclick="event.stopPropagation(); deleteMatch('${m.id}')" class="p-1.5 bg-rose-600 rounded-lg text-white shadow"><i data-lucide="trash" class="w-3 h-3"></i></button>
        </div>`;
    }

    div.innerHTML = `
        ${adminHtml}
        <div class="bg-slate-900 p-4 rounded-[1.5rem] flex items-center justify-between relative z-10 ${isPlayed?'opacity-80':''}">
            <div class="flex flex-col items-center w-[30%]">
                ${getAvatarUI({avatar:m.p1Avatar, name:m.p1Name}, "w-8", "h-8")}
                <span class="text-[8px] font-bold text-white uppercase text-center mt-1 truncate w-full">${m.p1Name}</span>
            </div>
            <div class="flex flex-col items-center flex-1 mx-2">
                ${scoreHtml}
                ${subHtml}
                <span class="text-[5px] text-slate-600 mt-1 uppercase">${m.id}</span>
            </div>
            <div class="flex flex-col items-center w-[30%]">
                ${getAvatarUI({avatar:m.p2Avatar, name:m.p2Name}, "w-8", "h-8")}
                <span class="text-[8px] font-bold text-white uppercase text-center mt-1 truncate w-full">${m.p2Name}</span>
            </div>
        </div>
    `;
    return div;
}

let activeMatchId = null;
function openResultEntry(id) {
    activeMatchId = id;
    const m = state.matches.find(x => x.id === id);
    document.getElementById('res-match-id-display').innerText = `ID: ${m.id}`;
    
    document.getElementById('res-p1-avatar').innerHTML = getAvatarUI({avatar:m.p1Avatar, name:m.p1Name}, "w-12", "h-12");
    document.getElementById('res-p2-avatar').innerHTML = getAvatarUI({avatar:m.p2Avatar, name:m.p2Name}, "w-12", "h-12");
    document.getElementById('res-p1-name').innerText = m.p1Name;
    document.getElementById('res-p2-name').innerText = m.p2Name;
    
    document.getElementById('res-s-p1').value = m.scoreP1 ?? '';
    document.getElementById('res-s-p2').value = m.scoreP2 ?? '';
    document.getElementById('res-verify-id').value = '';
    
    // Admin doesn't need ID
    if(state.isAdmin) document.getElementById('res-verify-id').parentElement.classList.add('hidden');
    else document.getElementById('res-verify-id').parentElement.classList.remove('hidden');

    const btn = document.getElementById('btn-submit-result');
    btn.innerText = "Confirm Result"; btn.disabled = false;

    openModal('modal-result');
}

async function saveMatchResult() {
    const s1 = parseInt(document.getElementById('res-s-p1').value);
    const s2 = parseInt(document.getElementById('res-s-p2').value);
    const vId = document.getElementById('res-verify-id').value.trim().toUpperCase();
    const btn = document.getElementById('btn-submit-result');
    
    const m = state.matches.find(x => x.id === activeMatchId);
    if(isNaN(s1) || isNaN(s2)) return notify("Enter scores", "alert-triangle");
    
    // Verification
    let submitter = "Admin";
    if(!state.isAdmin) {
        if(vId !== m.p1Id && vId !== m.p2Id) return notify("Unauthorized ID", "lock");
        if(vId !== localStorage.getItem('slc_user')) return notify("Please use YOUR login ID", "lock");
        const p = state.players.find(x=>x.id===vId);
        submitter = p ? p.name : "Player";
    }

    btn.innerText = "PROCESSING..."; btn.disabled = true;

    const now = Date.now();
    try {
        await db.collection("matches").doc(m.id).update({
            scoreP1: s1, scoreP2: s2,
            status: 'played',
            submittedBy: submitter,
            playedAt: m.playedAt || now, // Preserve original date if editing
            monthId: getMonthId(m.playedAt || now),
            weekId: getWeekId(m.playedAt || now)
        });
        notify("Result Saved!", "check-circle");
        closeModal('modal-result');
    } catch(e) { notify("Error", "x"); btn.innerText = "Confirm Result"; btn.disabled = false; }
}

async function deleteMatch(id) {
    askConfirm("Delete this match permanently?", async () => {
        try { await db.collection("matches").doc(id).delete(); notify("Deleted", "trash"); }
        catch(e) { notify("Error", "x"); }
    });
}

// --- 7. LEADERBOARDS ---

function populatePeriods(type) {
    const select = document.getElementById(`${type}ly-filter`);
    let periods = new Set();
    state.matches.forEach(m => {
        if(m.status === 'played' && m.playedAt) {
            periods.add(type === 'month' ? getMonthId(m.playedAt) : getWeekId(m.playedAt));
        }
    });
    
    // Sort descending
    let pArr = Array.from(periods).sort().reverse();
    let currentId = type === 'month' ? getMonthId(Date.now()) : getWeekId(Date.now());
    if(!pArr.includes(currentId)) pArr.unshift(currentId);

    let html = `<option value="${currentId}">Current ${type}</option>`;
    pArr.forEach(p => {
        if(p !== currentId) html += `<option value="${p}">${type==='month'?getMonthName(p):getWeekName(p)}</option>`;
    });
    html += `<option value="all">All Time</option>`;
    
    // Only update if options changed to prevent resetting selection
    if(select.innerHTML !== html) select.innerHTML = html;
}

function renderLeaderboardView(type) {
    populatePeriods(type);
    const filter = document.getElementById(`${type}ly-filter`).value;
    const ranked = calcLeaderboard(filter, type);
    
    const podiumEl = document.getElementById(`${type}ly-podium`);
    const tableEl = document.getElementById(`${type}ly-table-body`);
    podiumEl.innerHTML = ''; tableEl.innerHTML = '';

    if(ranked.length === 0) {
        podiumEl.innerHTML = `<p class="text-[10px] text-slate-500 uppercase italic">No matches played yet</p>`;
        return;
    }

    // Podium Rendering
    const top3 = ranked.slice(0, 3);
    
    const getPodiumStep = (p, rankCls, htCls, badgeColor, medal) => {
        if(!p) return `<div class="${rankCls} ${htCls} opacity-30"></div>`;
        return `
        <div class="${rankCls} ${htCls} flex flex-col items-center justify-start p-2 relative shadow-2xl">
            <div class="absolute -top-6">${getAvatarUI(p, "w-12", "h-12")}</div>
            <div class="mt-4 flex flex-col items-center">
                <span class="text-[8px] font-black text-white uppercase truncate w-20 text-center">${p.name}</span>
                <span class="text-xl font-black ${badgeColor} leading-none drop-shadow-lg">${p.pts}</span>
                <span class="text-[6px] text-slate-400 font-bold uppercase mt-1">${medal}</span>
            </div>
        </div>`;
    };

    // Layout: 2nd, 1st, 3rd
    podiumEl.innerHTML = `
        ${getPodiumStep(top3[1], 'podium-step podium-2 moving-border-silver', 'h-[110px]', 'text-silver-400', '2ND PLACE')}
        ${getPodiumStep(top3[0], 'podium-step podium-1 moving-border-gold', 'h-[140px]', 'text-gold-500', 'CHAMPION')}
        ${getPodiumStep(top3[2], 'podium-step podium-3 moving-border-bronze', 'h-[90px]', 'text-bronze-400', '3RD PLACE')}
    `;

    // Table Rendering (Starts at 4th)
    ranked.slice(3).forEach((p, i) => {
        tableEl.innerHTML += `
        <tr class="hover:bg-white/5 transition-colors">
            <td class="p-3 text-[10px] font-black text-slate-600 text-center">${i+4}</td>
            <td class="p-3">
                <div class="flex items-center gap-2">
                    ${getAvatarUI(p, "w-6", "h-6")}
                    <span class="text-[9px] font-bold text-white uppercase truncate max-w-[80px]">${p.name}</span>
                </div>
            </td>
            <td class="p-3 text-[10px] font-bold text-slate-400 text-center">${p.mp}</td>
            <td class="p-3 text-[10px] font-black text-emerald-400 text-center">${p.w}</td>
            <td class="p-3 text-[10px] font-bold text-slate-400 text-center">${p.d}</td>
            <td class="p-3 text-[10px] font-bold text-rose-400 text-center">${p.l}</td>
            <td class="p-3 text-[10px] font-black ${p.gd >= 0 ? 'text-blue-400' : 'text-rose-500'} text-center">${p.gd>0?'+':''}${p.gd}</td>
            <td class="p-3 text-[10px] font-black text-gold-500 text-center">${p.pts}</td>
        </tr>`;
    });
}
window.renderMonthlyRanking = () => renderLeaderboardView('month');
window.renderWeeklyRanking = () => renderLeaderboardView('week');

// --- 8. PROFILE ---

function renderProfile() {
    const container = document.getElementById('profile-container');
    const uId = localStorage.getItem('slc_user');
    
    if(state.isAdmin && !uId) {
        container.innerHTML = `<div class="text-center text-slate-500 mt-20 text-[10px] uppercase font-black">Admin Mode Active. Switch to Player to view profile. <button onclick="logout()" class="block w-full mt-4 py-3 bg-rose-600/20 text-rose-500 rounded-xl">Logout</button></div>`;
        return;
    }

    const p = state.currentUser;
    if(!p) return;

    // Calc overall stats
    let mp=0, w=0, d=0, l=0, gs=0, gc=0;
    const myMatches = state.matches.filter(m => (m.p1Id===p.id || m.p2Id===p.id));
    
    myMatches.forEach(m => {
        if(m.status!=='played') return;
        mp++;
        const sMe = m.p1Id===p.id ? m.scoreP1 : m.scoreP2;
        const sOpp = m.p1Id===p.id ? m.scoreP2 : m.scoreP1;
        gs+=sMe; gc+=sOpp;
        if(sMe>sOpp) w++; else if(sOpp>sMe) l++; else d++;
    });
    const gd = gs-gc;

    container.innerHTML = `
<!-- FIFA Card -->
<div class="fifa-card-container glow-emerald mb-8 animate-pop-in">
            <div class="fifa-card-bg"></div>

            <!-- Avatar -->
            <div class="w-24 h-24 mx-auto relative z-10 mb-4 mt-2 rounded-3xl border-2 border-emerald-500/50 p-1 shadow-[0_0_20px_rgba(16,185,129,0.2)] overflow-hidden bg-slate-900">
                ${p.avatar ? `<img src="${p.avatar}" class="w-full h-full object-cover rounded-[1.3rem]">` : `<div class="w-full h-full bg-slate-800 rounded-[1.3rem] flex items-center justify-center font-black text-white text-3xl">${p.name.charAt(0)}</div>`}
            </div>
            
            <!-- Info Section -->
            <div class="text-center relative z-10 flex flex-col items-center">
                <h1 class="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">${p.name}</h1>
                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1 mb-4"><i data-lucide="phone" class="w-3 h-3"></i> ${p.phone}</p>
                
                <!-- Matrix ID Copy Button (Centered at bottom) -->
                <div onclick="copyToClipboard('${p.id}')" class="inline-flex flex-col items-center gap-1 bg-slate-950/80 border border-white/10 px-5 py-2 rounded-xl cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-900/20 transition-all active:scale-95 group shadow-lg">
                    <span class="text-[6px] text-slate-500 uppercase font-black tracking-[0.2em]">Matrix ID</span>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-black text-emerald-400 tracking-widest">${p.id}</span>
                        <i data-lucide="copy" class="w-3 h-3 text-slate-400 group-hover:text-emerald-400 transition-colors"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Career Stats -->
        <div class="moving-border p-[1px] rounded-[1.6rem] shadow-xl mb-6">
            <div class="bg-slate-900 p-5 rounded-[1.5rem]">
                <h4 class="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-4 border-b border-white/5 pb-2">Career Statistics</h4>
                <div class="grid grid-cols-3 gap-y-4 gap-x-2">
                    <div class="text-center"><p class="text-[7px] text-slate-500 font-bold uppercase mb-1">Matches</p><p class="text-sm font-black text-white">${mp}</p></div>
                    <div class="text-center"><p class="text-[7px] text-emerald-500 font-bold uppercase mb-1">Wins</p><p class="text-sm font-black text-white">${w}</p></div>
                    <div class="text-center"><p class="text-[7px] text-slate-400 font-bold uppercase mb-1">Draws</p><p class="text-sm font-black text-white">${d}</p></div>
                    <div class="text-center"><p class="text-[7px] text-rose-500 font-bold uppercase mb-1">Losses</p><p class="text-sm font-black text-white">${l}</p></div>
                    <div class="text-center"><p class="text-[7px] text-gold-500 font-bold uppercase mb-1">Goals</p><p class="text-sm font-black text-white">${gs}</p></div>
                    <div class="text-center"><p class="text-[7px] text-blue-400 font-bold uppercase mb-1">GD</p><p class="text-sm font-black ${gd>=0?'text-blue-400':'text-rose-500'}">${gd>0?'+':''}${gd}</p></div>
                </div>
            </div>
        </div>

        <!-- My Matches -->
        <div class="mb-8">
            <div class="flex items-center justify-between mb-3 px-2">
                <h2 class="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">My Recent Matches</h2>
            </div>
            <div class="space-y-2">
                ${myMatches.sort((a,b)=> (b.playedAt||b.timestamp) - (a.playedAt||a.timestamp)).slice(0,5).map(m => {
                    const isP1 = m.p1Id === p.id;
                    const oppName = isP1 ? m.p2Name : m.p1Name;
                    const oppAvatar = isP1 ? m.p2Avatar : m.p1Avatar;
                    let resClass = "text-slate-500"; let resText = "PEN";
                    if(m.status === 'played') {
                        const sMe = isP1 ? m.scoreP1 : m.scoreP2; const sOpp = isP1 ? m.scoreP2 : m.scoreP1;
                        if(sMe>sOpp) { resClass="text-emerald-400"; resText="W"; }
                        else if(sOpp>sMe) { resClass="text-rose-500"; resText="L"; }
                        else { resClass="text-slate-400"; resText="D"; }
                    }
                    return `
                    <div class="bg-slate-900 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            ${getAvatarUI({avatar:oppAvatar, name:oppName},"w-8","h-8")}
                            <div>
                                <p class="text-[9px] font-bold text-white uppercase">${oppName}</p>
                                <p class="text-[6px] text-slate-500 uppercase mt-0.5">${new Date(m.playedAt||m.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            ${m.status==='played' ? `<span class="text-xs font-black text-white">${m.scoreP1}-${m.scoreP2}</span>` : `<span class="text-[6px] bg-white/5 px-2 py-1 rounded text-slate-400">WAITING</span>`}
                            <span class="w-5 text-center font-black text-[10px] ${resClass}">${resText}</span>
                        </div>
                    </div>`;
                }).join('')}
                ${myMatches.length === 0 ? '<p class="text-center text-[8px] text-slate-600 uppercase font-black py-4">No Matches Played</p>' : ''}
                ${myMatches.length > 5 ? `<button onclick="switchTab('all-matches')" class="w-full py-2 bg-white/5 text-[8px] text-slate-400 rounded-lg uppercase font-black mt-2">View All My Matches</button>` : ''}
            </div>
        </div>

        <!-- Controls -->
        <button onclick="openEditProfile()" class="w-full py-4 bg-slate-900 border border-white/10 rounded-2xl mb-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white shadow-xl hover:bg-slate-800 transition-colors"><i data-lucide="edit" class="w-4 h-4"></i> Edit Profile</button>
        <button onclick="logout()" class="w-full py-4 bg-rose-900/20 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 shadow-xl hover:bg-rose-900/40 transition-colors">Logout</button>
    `;
    lucide.createIcons();
}

function openEditProfile() {
    const p = state.currentUser;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-avatar').value = p.avatar || '';
    openModal('modal-edit-profile');
}

async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value.trim();
    const avatar = document.getElementById('edit-avatar').value.trim();
    const btn = document.getElementById('btn-save-profile');
    if(!name) return notify("Name required", "alert-circle");

    btn.innerText = "SAVING..."; btn.disabled = true;
    try {
        await db.collection("players").doc(state.currentUser.id).update({ name, avatar });
        
        // Also update names in matches where this player exists (for display consistency)
        const batch = db.batch();
        state.matches.forEach(m => {
            if(m.p1Id === state.currentUser.id) batch.update(db.collection("matches").doc(m.id), { p1Name: name, p1Avatar: avatar });
            if(m.p2Id === state.currentUser.id) batch.update(db.collection("matches").doc(m.id), { p2Name: name, p2Avatar: avatar });
        });
        await batch.commit();
        
        notify("Profile Updated", "check-circle");
        closeModal('modal-edit-profile');
    } catch(e) { notify("Error", "x"); }
    finally { btn.innerText = "Save"; btn.disabled = false; }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    lucide.createIcons();
});