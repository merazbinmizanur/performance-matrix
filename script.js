
const CURRENT_APP_VERSION = "1.0.0"; // যখন আপডেট করবেন, এই সংখ্যাটি পরিবর্তন করবেন

function checkAppVersion() {
    const savedVersion = localStorage.getItem('slc_app_version');
    
    if (savedVersion !== CURRENT_APP_VERSION) {
        // নতুন ভার্সন পাওয়া গেছে
        console.log(`Updating App: ${savedVersion} -> ${CURRENT_APP_VERSION}`);
        
        // নতুন ভার্সন সেভ করা হচ্ছে
        localStorage.setItem('slc_app_version', CURRENT_APP_VERSION);
        
        // ফোর্স রিলোড (ক্যাশ ক্লিয়ার সহ)
        if (savedVersion) { // প্রথমবার লোড হলে রিলোড হবে না, শুধুমাত্র আপডেট হলে হবে
            window.location.reload(true);
        }
    }
}
checkAppVersion();

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
    // 1. Listen Players Data
    db.collection("players").onSnapshot(snap => {
        state.players = snap.docs.map(d => d.data());
        
if (!state.isAdmin) {
    const currentUserId = localStorage.getItem('slc_user');
    state.currentUser = state.players.find(p => p.id === currentUserId);

    if (currentUserId && !state.currentUser) {
        localStorage.removeItem('slc_user');
        location.reload();
        return;
    }
}
        
        // --- Header Name & Avatar Update Logic ---
        const nameBadge = document.getElementById('user-name-badge');
        const avatarContainer = document.getElementById('header-user-avatar');
        
        if (nameBadge) {
            nameBadge.classList.remove('text-slate-400', 'text-white', 'text-gold-400');
            
            if (state.isAdmin) {
                // অ্যাডমিন হলে
                nameBadge.innerText = 'SYSTEM ADMIN';
                nameBadge.classList.add('text-gold-400');
                if (avatarContainer) {
                    avatarContainer.innerHTML = `<div class="w-8 h-8 rounded-lg bg-slate-950 border border-gold-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.15)]"><i data-lucide="shield-check" class="w-4 h-4 text-gold-400"></i></div>`;
                }
            } else if (state.currentUser) {
                // সাধারণ প্লেয়ার হলে
                nameBadge.innerText = state.currentUser.name;
                nameBadge.classList.add('text-white');
                
                if (avatarContainer) {
                    if (state.currentUser.avatar) {
                        // যদি ছবি থাকে
                        avatarContainer.innerHTML = `
                            <img src="${state.currentUser.avatar}" class="w-8 h-8 rounded-lg object-cover border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                            <div class="w-8 h-8 rounded-lg bg-slate-950 border border-emerald-500/30 hidden items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.15)]"><i data-lucide="user" class="w-4 h-4 text-emerald-400"></i></div>
                        `;
                    } else {
                        // যদি ছবি না থাকে (ডিফল্ট আইকন)
                        avatarContainer.innerHTML = `<div class="w-8 h-8 rounded-lg bg-slate-950 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.15)]"><i data-lucide="user" class="w-4 h-4 text-emerald-400"></i></div>`;
                    }
                }
            } else {
                nameBadge.innerText = 'PLAYER MATRIX';
                nameBadge.classList.add('text-slate-400');
            }
            lucide.createIcons(); // আইকনগুলো রেন্ডার করার জন্য
        }
        
        refreshUI();
    });
    
    // 2. Listen Matches Data
    db.collection("matches").onSnapshot(snap => {
        state.matches = snap.docs.map(d => d.data());
        refreshUI();
    });
}

function calcLeaderboard(filterId, type, skipStars = false) { 
    let stats = {};
    state.players.forEach(p => {
        stats[p.id] = { ...p, mp:0, w:0, d:0, l:0, gs:0, gc:0, gd:0, pts:0, stars:0 }; // stars:0 যুক্ত হলো
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

    // NEW: Weekly Winner Star System (Only for Monthly Matrix)
    if (type === 'month' && !skipStars) {
        let weeksInMonth = new Set();
        state.matches.forEach(m => {
            if(m.status === 'played' && m.playedAt) {
                if (filterId === 'all' || getMonthId(m.playedAt) === filterId) {
                    weeksInMonth.add(getWeekId(m.playedAt));
                }
            }
        });
        
const currentWeekId = getWeekId(Date.now()); // বর্তমানে চলমান সপ্তাহের ID বের করা

weeksInMonth.forEach(wId => {
    // চেক করা হচ্ছে সপ্তাহটি শেষ হয়েছে কি না (বর্তমান সপ্তাহের আইডি থেকে ছোট/আগের আইডি হলে)
    if (wId < currentWeekId) {
        // ওই নির্দিষ্ট সপ্তাহের উইনার কে ছিল সেটা বের করা হচ্ছে
        let wStats = calcLeaderboard(wId, 'week', true);
        if (wStats.length > 0) {
            let winnerId = wStats[0].id;
            if (stats[winnerId]) {
                stats[winnerId].stars += 1; // উইনার একটি স্টার পাবে
                stats[winnerId].pts += 10; // ১ স্টার = ১০ পয়েন্ট যোগ
            }
        }
    }
});
    }

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
    // ম্যাচ ফিল্টার করা
    const playedMatches = state.matches.filter(m => m.status === 'played');
    const pendingMatches = state.matches.filter(m => m.status === 'pending');
    
    // মোট গোল হিসাব করা
    let totalGoals = 0;
    playedMatches.forEach(m => {
        totalGoals += (m.scoreP1 || 0) + (m.scoreP2 || 0);
    });
    
    // ডাটা ড্যাশবোর্ডে সেট করা
    document.getElementById('stat-total-players').innerText = state.players.length;
    document.getElementById('stat-total-matches').innerText = playedMatches.length;
    
    const goalsEl = document.getElementById('stat-total-goals');
    const battlesEl = document.getElementById('stat-active-battles');
    
    if (goalsEl) goalsEl.innerText = totalGoals;
    if (battlesEl) battlesEl.innerText = pendingMatches.length;
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

// Search bar clear & trigger list render
const searchInput = document.getElementById('search-match-input');
if (searchInput) searchInput.value = '';
searchMatches();
}

// --- MATCH SEARCH FUNCTIONALITY ---
// --- MATCH SEARCH FUNCTIONALITY ---
function searchMatches() {
    const searchInput = document.getElementById('search-match-input');
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase().trim();
    
    const incompleteList = document.getElementById('incomplete-matches-list');
    const recentList = document.getElementById('recent-matches-list');
    const incompleteSection = document.getElementById('incomplete-section');
    
    if (incompleteList) incompleteList.innerHTML = '';
    if (recentList) recentList.innerHTML = '';
    
    // Split matches into pending and played
    let pendingMatches = state.matches.filter(m => m.status === 'pending')
        .sort((a, b) => b.timestamp - a.timestamp);
    
    let playedMatches = state.matches.filter(m => m.status === 'played')
        .sort((a, b) => (b.playedAt || b.timestamp) - (a.playedAt || a.timestamp));
    
    // Filter logic: Search by ID or Player Names
    if (query) {
        const matchQuery = m =>
            m.id.toLowerCase().includes(query) ||
            m.p1Name.toLowerCase().includes(query) ||
            m.p2Name.toLowerCase().includes(query);
        
        pendingMatches = pendingMatches.filter(matchQuery);
        playedMatches = playedMatches.filter(matchQuery);
    }
    
    // Display Incomplete (Pending) Matches
    if (incompleteList && incompleteSection) {
        if (pendingMatches.length === 0) {
            incompleteSection.classList.add('hidden');
        } else {
            incompleteSection.classList.remove('hidden');
            pendingMatches.forEach(m => incompleteList.appendChild(createMatchCard(m)));
        }
    }
    
    // Display Recent (Played) Matches
    if (recentList) {
        const displayLimit = query ? playedMatches.length : 5;
        const displayPlayed = playedMatches.slice(0, displayLimit);
        
        if (displayPlayed.length === 0) {
            recentList.innerHTML = `<p class="text-center text-[10px] text-slate-600 uppercase font-black py-4 border border-dashed border-white/10 rounded-2xl mt-2">No completed matches found</p>`;
        } else {
            displayPlayed.forEach(m => recentList.appendChild(createMatchCard(m)));
        }
        
        // Show View All button if not searching and has more than 5 completed matches
        if (!query && playedMatches.length > 5) {
            recentList.insertAdjacentHTML('beforeend', `<button onclick="switchTab('all-matches')" class="w-full py-3 bg-slate-900 border border-white/5 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-800 shadow-md mt-2 transition-colors">View All Completed (${playedMatches.length})</button>`);
        }
    }
    
    lucide.createIcons();
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

    // NEW CHECK: Prevent creating matches for others if not admin
    if (!state.isAdmin) {
        const myId = localStorage.getItem('slc_user');
        if (p1Id !== myId && p2Id !== myId) {
            return notify("You can only create matches for yourself!", "lock");
        }
    }

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

        copyToClipboard(id);
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
    if (!isPlayed) div.onclick = () => openResultEntry(m.id);
    
    // Inner Content
let scoreHtml = isPlayed ?
    `<span class="text-xl font-black text-emerald-400">${m.scoreP1} - ${m.scoreP2}</span>` :
    `<span class="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded uppercase tracking-widest whitespace-nowrap">Awaiting Result</span>`;
    
    let subHtml = isPlayed ?
        `<span class="text-[6px] text-slate-500 font-bold uppercase mt-1">Ver: ${m.submittedBy}</span>` :
        `<span class="text-[6px] text-slate-500 font-bold uppercase mt-1">Tap to enter score</span>`;
    
    // Admin Controls
    let adminHtml = '';
    if (state.isAdmin) {
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
                <!-- Tap to Copy ID Button -->
                <div onclick="event.stopPropagation(); copyToClipboard('${m.id}')" class="flex items-center gap-1 mt-1.5 bg-white/5 border border-white/5 px-2 py-1 rounded-md cursor-pointer hover:bg-white/10 active:scale-95 transition-all group z-20">
                    <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">${m.id}</span>
                    <i data-lucide="copy" class="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors"></i>
                </div>
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

let currentFilterType = '';

function getAvailablePeriods(type) {
    let periods = new Set();
    state.matches.forEach(m => {
        if (m.status === 'played' && m.playedAt) {
            periods.add(type === 'month' ? getMonthId(m.playedAt) : getWeekId(m.playedAt));
        }
    });
    let pArr = Array.from(periods).sort().reverse();
    let currentId = type === 'month' ? getMonthId(Date.now()) : getWeekId(Date.now());
    if (!pArr.includes(currentId)) pArr.unshift(currentId);
    return { pArr, currentId };
}

function openFilterModal(type) {
    currentFilterType = type;
    const { pArr, currentId } = getAvailablePeriods(type);
    
    const filterInput = document.getElementById(`${type}ly-filter`);
    // যদি প্রথমবার হয়, ডিফল্ট ভ্যালু সেট করা
    if (!filterInput.value) filterInput.value = currentId;
    const currentSelected = filterInput.value;
    
    // থিম অনুযায়ী টাইটেল ও আইকন কালার
    const titleColor = type === 'month' ? 'text-gold-400' : 'text-emerald-400';
    document.getElementById('filter-sheet-title').innerHTML = `<i data-lucide="calendar" class="w-4 h-4 ${titleColor}"></i> <span class="${titleColor}">SELECT ${type.toUpperCase()}</span>`;
    
    const optionsContainer = document.getElementById('filter-sheet-options');
    let html = '';
    
    // Current Option
    html += createOptionHTML(currentId, `CURRENT ${type}`, currentSelected === currentId, type);
    
    // Past Options
    pArr.forEach(p => {
        if (p !== currentId) {
            const label = type === 'month' ? getMonthName(p) : getWeekName(p);
            html += createOptionHTML(p, label, currentSelected === p, type);
        }
    });
    
    // All Time Option
    html += createOptionHTML('all', 'ALL TIME', currentSelected === 'all', type);
    
    optionsContainer.innerHTML = html;
    lucide.createIcons();
    
    // Modal Animation On
    const modal = document.getElementById('modal-filter-sheet');
    const content = document.getElementById('filter-sheet-content');
    modal.classList.remove('hidden');
    // ছোট্ট ডিলের পর এনিমেশন ক্লাস যুক্ত করা
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('translate-y-full');
    }, 10);
}

function createOptionHTML(value, label, isSelected, type) {
    const activeBorder = type === 'month' ? 'border-gold-500 text-gold-400 bg-gold-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-emerald-500 text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    const inactiveBorder = 'border-white/5 text-slate-400 bg-slate-950 hover:bg-slate-800';
    const checkIcon = isSelected ? `<i data-lucide="check-circle-2" class="w-5 h-5"></i>` : `<div class="w-5 h-5 rounded-full border border-slate-700"></div>`;
    
    return `
    <div onclick="selectFilterOption('${value}', '${label}')" class="flex items-center justify-between p-4 rounded-[1.2rem] border ${isSelected ? activeBorder : inactiveBorder} cursor-pointer transition-all active:scale-95">
        <span class="text-[10px] font-black uppercase tracking-widest">${label}</span>
        ${checkIcon}
    </div>`;
}

function selectFilterOption(value, label) {
    const type = currentFilterType;
    document.getElementById(`${type}ly-filter`).value = value;
    document.getElementById(`${type}ly-filter-text`).innerText = label;
    
    closeFilterModal(true);
    
    if (type === 'month') renderMonthlyRanking();
    else renderWeeklyRanking();
}

function closeFilterModal(force = false) {
    if (force) {
        const modal = document.getElementById('modal-filter-sheet');
        const content = document.getElementById('filter-sheet-content');
        
        modal.classList.add('opacity-0');
        content.classList.add('translate-y-full');
        // এনিমেশন শেষ হওয়ার পর hidden করা
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    }
}

function renderLeaderboardView(type) {
    const filterInput = document.getElementById(`${type}ly-filter`);
    
    // প্রথমবার লোড হওয়ার সময় ডিফল্ট সেট করা
    if (!filterInput.value) {
        const defaultId = type === 'month' ? getMonthId(Date.now()) : getWeekId(Date.now());
        filterInput.value = defaultId;
        document.getElementById(`${type}ly-filter-text`).innerText = `CURRENT ${type}`;
    }
    
    const filter = filterInput.value;
    const ranked = calcLeaderboard(filter, type);
    
    const podiumEl = document.getElementById(`${type}ly-podium`);
const countdownContainer = document.getElementById(`${type}ly-countdown-container`);
if (countdownContainer) {
    const currentPeriodId = type === 'month' ? getMonthId(Date.now()) : getWeekId(Date.now());
    if (filter === currentPeriodId || filter === 'all') {
        countdownContainer.classList.remove('hidden');
    } else {
        countdownContainer.classList.add('hidden');
    }
}
    const tableEl = document.getElementById(`${type}ly-table-body`);
    podiumEl.innerHTML = ''; tableEl.innerHTML = '';

    if(ranked.length === 0) {
        podiumEl.innerHTML = `<p class="text-[10px] text-slate-500 uppercase italic">No matches played yet</p>`;
        return;
    }

    // Podium Rendering
    // Podium Rendering
const top3 = ranked.slice(0, 3);

const getPodiumStep = (p, rank, heightClass) => {
    if (!p) return `<div class="w-[30%] ${heightClass} opacity-30"></div>`; // Empty placeholder
    
    // র্যাঙ্ক অনুযায়ী ডিজাইন ভ্যারিয়েবল
    let rankBadge, boxStyle, nameColor, ptsColor, movingBorderClass, gradientBg;
    
    if (rank === 1) {
        rankBadge = `<div class="absolute -top-2 -right-2 bg-gold-500 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shadow-[0_0_15px_rgba(245,158,11,0.6)] z-30 border border-white/20">1</div>`;
        nameColor = 'text-gold-400';
        ptsColor = 'text-gold-500';
        movingBorderClass = 'moving-border-gold shadow-[0_0_30px_rgba(245,158,11,0.15)]';
        gradientBg = 'from-gold-500/10 to-transparent';
    } else if (rank === 2) {
        rankBadge = `<div class="absolute -top-1 -right-1 bg-silver-400 text-slate-900 w-4 h-4 rounded-full flex items-center justify-center font-black text-[8px] shadow-[0_0_10px_rgba(148,163,184,0.6)] z-30 border border-white/20">2</div>`;
        nameColor = 'text-white';
        ptsColor = 'text-silver-400';
        movingBorderClass = 'moving-border-silver shadow-xl';
        gradientBg = 'from-silver-500/10 to-transparent';
    } else {
        rankBadge = `<div class="absolute -top-1 -right-1 bg-bronze-400 text-white w-4 h-4 rounded-full flex items-center justify-center font-black text-[8px] shadow-[0_0_10px_rgba(180,83,9,0.6)] z-30 border border-white/20">3</div>`;
        nameColor = 'text-white';
        ptsColor = 'text-bronze-400';
        movingBorderClass = 'moving-border-bronze shadow-xl';
        gradientBg = 'from-bronze-500/10 to-transparent';
    }
    
    const avatarSize = rank === 1 ? "w-14 h-14" : "w-11 h-11";
    const medalText = rank === 1 ? "CHAMPION" : (rank === 2 ? "2ND PLACE" : "3RD PLACE");
    const crown = rank === 1 ? `<i data-lucide="crown" class="w-5 h-5 text-gold-500 absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)] z-40"></i>` : '';
    
    return `
        <div class="flex flex-col items-center justify-end w-[32%] relative transition-transform hover:-translate-y-1 duration-300">
            <div class="relative z-30 translate-y-5">
                ${crown}
                ${rankBadge}
                <div class="rounded-full p-[3px] bg-slate-950 shadow-2xl relative z-20">
                    ${getAvatarUI(p, avatarSize, avatarSize)}
                </div>
            </div>
            <div class="${movingBorderClass} w-full rounded-t-[1.2rem] p-[1.5px] border-b-0 ${heightClass}">
                <div class="bg-slate-900 w-full h-full rounded-t-[1.1rem] flex flex-col items-center justify-start pt-8 pb-2 px-1 relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-b ${gradientBg} z-0"></div>
                    
                    <span class="text-[8px] font-black ${nameColor} uppercase truncate w-full text-center mt-1 z-10 px-1 drop-shadow-md shrink-0">${p.name}</span>
                    
                    ${type === 'month' && p.stars > 0 ? `<div class="flex items-center justify-center gap-[1px] mt-0.5 z-10">${Array(p.stars).fill('<i data-lucide="star" class="w-2.5 h-2.5 text-gold-400 fill-gold-400 drop-shadow-md"></i>').join('')}</div>` : ''}

<span class="text-xl font-black ${ptsColor} leading-none mt-1.5 z-10 drop-shadow-md shrink-0">${p.pts}</span>
<span class="text-[5.5px] text-slate-400 font-bold uppercase mt-1 z-10 tracking-[0.2em] shrink-0">${medalText}</span>
                </div>
            </div>
        </div>`;
};

// Layout: 2nd, 1st, 3rd (নতুন ডিজাইন অনুযায়ী উচ্চতা সেট করা হয়েছে)
podiumEl.innerHTML = `
        ${getPodiumStep(top3[1], 2, 'h-[120px]')}
        ${getPodiumStep(top3[0], 1, 'h-[150px]')}
        ${getPodiumStep(top3[2], 3, 'h-[105px]')}
    `;

// আইকন লোড করার জন্য এটি যোগ করা জরুরি (Crown আইকনের জন্য)
setTimeout(() => { lucide.createIcons(); }, 10);

// Table Rendering (Starts at 4th)
ranked.slice(3).forEach((p, i) => {
            tableEl.innerHTML += `
        <tr class="hover:bg-white/5 transition-colors">
            <td class="p-3 text-[10px] font-black text-slate-600 text-center">${i+4}</td>
            <td class="p-3">
                <div class="flex items-center gap-2">
                    ${getAvatarUI(p, "w-6", "h-6")}
                    <div class="flex flex-col">
                        <span class="text-[9px] font-bold text-white uppercase truncate max-w-[80px]">${p.name}</span>
                        ${type === 'month' && p.stars > 0 ? `<div class="flex items-center justify-start gap-[1px] mt-0.5">${Array(p.stars).fill('<i data-lucide="star" class="w-2.5 h-2.5 text-gold-400 fill-gold-400"></i>').join('')}</div>` : ''}
                    </div>
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
    
if (state.isAdmin && !uId) {
    container.innerHTML = `
            <div class="mb-6 text-center animate-pop-in mt-4">
                <div class="w-16 h-16 mx-auto bg-slate-900 rounded-2xl border border-gold-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-3">
                    <i data-lucide="shield-check" class="w-8 h-8 text-gold-500"></i>
                </div>
                <h2 class="text-xl font-black text-white uppercase italic tracking-widest">Admin Panel</h2>
                <p class="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Total Players: <span id="admin-total-players" class="text-gold-400 font-black">${state.players.length}</span></p>
            </div>

            <!-- Search Bar -->
            <div class="relative mb-4 animate-pop-in">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                <input type="text" id="search-admin-player" onkeyup="searchAdminPlayers()" placeholder="Search Name or ID..." class="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-white/5 rounded-2xl text-[10px] text-white font-black outline-none focus:border-gold-500 placeholder-slate-600 uppercase tracking-widest shadow-inner transition-all">
            </div>

            <!-- Player List -->
            <div id="admin-player-list" class="space-y-3 mb-6 animate-pop-in pb-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-1"></div>

            <button onclick="logout()" class="w-full py-4 bg-rose-900/20 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 shadow-xl hover:bg-rose-900/40 transition-colors mt-2">Logout Admin</button>
        `;
    setTimeout(() => { renderAdminPlayerList(); }, 50);
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
// --- COUNTDOWN TIMERS ---
function updateCountdowns() {
    const now = new Date();
    
    // Calculate Next Week (Saturday 00:00:00)
    let day = now.getDay();
    let daysUntilSat = (6 - day + 7) % 7;
    // If it's currently Saturday but time has passed midnight, next Saturday is in 7 days
    if (daysUntilSat === 0 && (now.getHours() > 0 || now.getMinutes() > 0 || now.getSeconds() > 0)) {
        daysUntilSat = 7;
    }
    let nextSat = new Date(now);
    nextSat.setDate(now.getDate() + daysUntilSat);
    nextSat.setHours(0, 0, 0, 0);
    let diffWeek = nextSat - now;
    
    // Calculate Next Month (1st of next month 00:00:00)
    let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let diffMonth = nextMonth - now;
    
    // Format Time Function
    const formatTime = (ms) => {
        let totalSec = Math.floor(ms / 1000);
        let d = Math.floor(totalSec / (3600 * 24));
        let h = Math.floor((totalSec % (3600 * 24)) / 3600);
        let m = Math.floor((totalSec % 3600) / 60);
        let s = totalSec % 60;
        return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    };
    
    // Update DOM
    const wTimer = document.getElementById('weekly-timer');
    const mTimer = document.getElementById('monthly-timer');
    if (wTimer) wTimer.innerText = formatTime(diffWeek);
    if (mTimer) mTimer.innerText = formatTime(diffMonth);
}
// --- ADMIN PLAYER MANAGEMENT SYSTEM ---
window.renderAdminPlayerList = function(query = '') {
    const list = document.getElementById('admin-player-list');
    const totalEl = document.getElementById('admin-total-players');
    if (!list) return;
    
    // নতুন প্লেয়ার সবার উপরে দেখাবে
    let filtered = [...state.players].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    // সার্চ ফিল্টার
    if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    
    if (totalEl) totalEl.innerText = filtered.length;
    list.innerHTML = '';
    
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-center text-[10px] text-slate-600 uppercase font-black py-4 border border-dashed border-white/10 rounded-2xl">No players found</p>`;
        return;
    }
    
    filtered.forEach((p, index) => {
        list.innerHTML += `
        <div class="bg-slate-900 p-3 rounded-2xl border border-white/5 flex items-center justify-between hover:border-gold-500/30 transition-colors">
            <div class="flex items-center gap-3 w-[75%]">
                <div class="text-[9px] font-black text-slate-600 w-4 text-center">${index+1}</div>
                ${getAvatarUI({avatar:p.avatar, name:p.name}, "w-8", "h-8")}
                <div class="overflow-hidden w-full">
                    <p class="text-[10px] font-black text-white uppercase truncate">${p.name}</p>
                    <p class="text-[7px] text-gold-400 font-bold tracking-widest uppercase mt-0.5">${p.id}</p>
                </div>
            </div>
            <button onclick="copyToClipboard('${p.id}')" class="p-2 bg-white/5 border border-white/5 rounded-xl hover:bg-gold-500/20 hover:text-gold-400 active:scale-95 transition-all group shrink-0">
                <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-400 group-hover:text-gold-400 transition-colors"></i>
            </button>
        </div>`;
    });
    lucide.createIcons();
};

window.searchAdminPlayers = function() {
    const input = document.getElementById('search-admin-player');
    if (input) renderAdminPlayerList(input.value);
};

// Start Timers globally
setInterval(updateCountdowns, 1000);
updateCountdowns();
// Init
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    lucide.createIcons();
});
