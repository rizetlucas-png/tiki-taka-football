// ═══════════════════════════════════════════════════════════
// FIREBASE
// ═══════════════════════════════════════════════════════════
firebase.initializeApp({
  apiKey:"AIzaSyC2XbMUjr9j0djhMaT_SIyjcpajQNZ_kDg",
  authDomain:"tiki-taka-football.firebaseapp.com",
  databaseURL:"https://tiki-taka-football-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"tiki-taka-football",
  storageBucket:"tiki-taka-football.firebasestorage.app",
  messagingSenderId:"971803678486",
  appId:"1:971803678486:web:fe91632e29a0a641b4e237"
});
const DB = firebase.database();

// ═══════════════════════════════════════════════════════════
// WIKIDATA — Recherche joueurs
// ═══════════════════════════════════════════════════════════
const WD_API = "https://www.wikidata.org/w/api.php";
const _cache = {};

async function searchFootballers(query) {
  if (query.length < 2) return [];
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&type=item&limit=20&format=json&origin=*`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    const all = d.search || [];
    const footballers = all.filter(e => e.description && (
      e.description.toLowerCase().includes('foot') ||
      e.description.toLowerCase().includes('joueur') ||
      e.description.toLowerCase().includes('player') ||
      e.description.toLowerCase().includes('soccer') ||
      e.description.toLowerCase().includes('attaquant') ||
      e.description.toLowerCase().includes('milieu') ||
      e.description.toLowerCase().includes('défenseur') ||
      e.description.toLowerCase().includes('gardien') ||
      e.description.toLowerCase().includes('striker') ||
      e.description.toLowerCase().includes('midfielder') ||
      e.description.toLowerCase().includes('goalkeeper') ||
      e.description.toLowerCase().includes('winger') ||
      e.description.toLowerCase().includes('forward')
    )).slice(0, 6);
    return footballers.length > 0 ? footballers : all.slice(0, 5);
  } catch(e) { return []; }
}

async function getEntityClaims(qid) {
  if (_cache[qid]) return _cache[qid];
  try {
    const url = `${WD_API}?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
    const r   = await fetch(url);
    const d   = await r.json();
    const claims = d.entities?.[qid]?.claims || {};
    _cache[qid] = claims;
    return claims;
  } catch(e) { return {}; }
}

// ── Validateurs de base (Wikidata) ───────────────────────

async function hasClub(qid, clubQid) {
  const c = await getEntityClaims(qid);
  return (c.P54||[]).some(x => x.mainsnak?.datavalue?.value?.id === clubQid);
}

async function hasNationality(qid, countryQids) {
  const c   = await getEntityClaims(qid);
  const ids = (c.P27||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return countryQids.some(q => ids.includes(q));
}

async function hasLeague(qid, clubQids) {
  const c    = await getEntityClaims(qid);
  const pcs  = (c.P54||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return clubQids.some(q => pcs.includes(q));
}

async function hasAward(qid, awardQids) {
  const c   = await getEntityClaims(qid);
  const ids = (c.P166||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return awardQids.some(q => ids.includes(q));
}

// ═══════════════════════════════════════════════════════════
// DONNÉES FIXES — Plus fiables que les requêtes dynamiques
// ═══════════════════════════════════════════════════════════

// Clubs vainqueurs de la Ligue des Champions
const UCL_CLUBS = new Set([
  "Q8682",  // Real Madrid
  "Q7156",  // Barcelone
  "Q18656", // Manchester United
  "Q50602", // Manchester City
  "Q1523",  // Liverpool
  "Q9616",  // Chelsea
  "Q157539",// AC Milan
  "Q297",   // Inter Milan
  "Q15789", // Bayern Munich
  "Q4933",  // Juventus
  "Q44979", // Borussia Dortmund
  "Q83819", // Ajax
  "Q44278", // Porto
  "Q32930", // Benfica
  "Q43996", // Marseille
  "Q524985",// Monaco
  "Q42274", // Celtic
  "Q18869", // Nottingham Forest
  "Q41612", // Aston Villa
]);

// Clubs vainqueurs de la FA Cup (principaux)
const FA_CUP_CLUBS = new Set([
  "Q9616","Q18656","Q9617","Q1523","Q50602","Q47322",
  "Q18727","Q41612","Q18869","Q79099","Q43261","Q51417"
]);

// Clubs vainqueurs de la Copa del Rey (principaux)
const COPA_REY_CLUBS = new Set([
  "Q8682","Q7156","Q8701","Q117099","Q43799","Q61289","Q14573","Q46000"
]);

// Clubs vainqueurs de la DFB-Pokal (principaux)
const DFB_CLUBS = new Set([
  "Q15789","Q44979","Q14584","Q136453","Q114295","Q40498","Q40573"
]);

// Clubs vainqueurs de la Coupe de France (principaux)
const CDF_CLUBS = new Set([
  "Q583","Q217427","Q43996","Q524985","Q1016","Q125760"
]);

// Nations ayant remporté chaque trophée international
const TROPHY_NATIONS = {
  wc:   new Set(["Q142","Q155","Q183","Q38","Q414","Q29","Q77","Q21","Q145"]),
  // France, Brésil, Allemagne, Italie, Argentine, Espagne, Uruguay, Angleterre
  euro: new Set(["Q142","Q183","Q38","Q29","Q55","Q45"]),
  // France, Allemagne, Italie, Espagne, Pays-Bas, Portugal
  copa: new Set(["Q414","Q77","Q155"]),
  // Argentine, Uruguay, Brésil uniquement (dans notre liste de nationalités)
};

// Clubs de chaque manager (validation fiable sans SPARQL)
const MANAGER_CLUBS = {
  "Q47443":  ["Q18656"],
  "Q7243":   ["Q15789","Q7156","Q50602"],
  "Q193236": ["Q9616","Q18656","Q297","Q50602","Q18727","Q2800"],
  "Q55844":  ["Q1523","Q44979"],
  "Q25181":  ["Q157539","Q297","Q8682","Q1523","Q15789","Q9617","Q4933"],
  "Q50933":  ["Q9617"],
  "Q43029":  ["Q8682"],
  "Q152200": ["Q1523","Q8682","Q297","Q18727","Q50602"],
  "Q221754": ["Q8682","Q157539","Q4933","Q217427"],
  "Q275596": ["Q8701"],
  "Q444003": ["Q4933","Q9616","Q18727","Q297"],
  "Q240397": ["Q47322","Q9616","Q8682","Q2800"],
  "Q464671": ["Q18727","Q50602","Q583"],
  "Q47459":  ["Q7156","Q50602","Q18656"],
  "Q1318843":["Q583","Q9616","Q15789"],
  "Q186397": ["Q15789"],
  "Q57218":  ["Q15789"],
  "Q47457":  ["Q7156"],
  "Q1055038":["Q4933"],
  "Q190879": ["Q4933"],
  "Q1418562":["Q83819","Q18656"],
};

// ── Nouvelles validations (sans SPARQL, fiables) ─────────

async function hasManagedBy(playerQid, managerQid) {
  const clubsOfManager = MANAGER_CLUBS[managerQid] || [];
  if (!clubsOfManager.length) return false;
  const c = await getEntityClaims(playerQid);
  const playerClubs = (c.P54||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return clubsOfManager.some(c => playerClubs.includes(c));
}

async function hasWonUCL(qid) {
  const direct = await hasAward(qid, ["Q18756515","Q18756514","Q19026256"]);
  if (direct) return true;
  const c = await getEntityClaims(qid);
  const clubs = (c.P54||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return clubs.some(c => UCL_CLUBS.has(c));
}

async function hasWonWorldCup(qid) {
  const c    = await getEntityClaims(qid);
  const nats = (c.P27||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return nats.some(n => TROPHY_NATIONS.wc.has(n));
}

async function hasWonEuro(qid) {
  const c    = await getEntityClaims(qid);
  const nats = (c.P27||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return nats.some(n => TROPHY_NATIONS.euro.has(n));
}

async function hasWonCopaAm(qid) {
  const c    = await getEntityClaims(qid);
  const nats = (c.P27||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return nats.some(n => TROPHY_NATIONS.copa.has(n));
}

async function hasClubTrophy(qid, clubSet) {
  const c = await getEntityClaims(qid);
  const clubs = (c.P54||[]).map(x => x.mainsnak?.datavalue?.value?.id);
  return clubs.some(c => clubSet.has(c));
}

// ═══════════════════════════════════════════════════════════
// CLUBS DE CHAQUE LIGUE
// ═══════════════════════════════════════════════════════════
const LEAGUE_CLUBS = {
  pl:   ["Q9616","Q18656","Q50602","Q1523","Q9617","Q18727","Q47322","Q18869","Q43261","Q79049","Q18645","Q830218","Q51417"],
  liga: ["Q8682","Q7156","Q8701","Q117099","Q43799","Q61289","Q14566","Q117255","Q52742","Q60741","Q46000"],
  sa:   ["Q4933","Q157539","Q297","Q2800","Q14567","Q14458","Q14560","Q14549","Q77240","Q46152"],
  bund: ["Q15789","Q44979","Q14584","Q114295","Q136453","Q14540","Q14621","Q40498","Q40573"],
  l1:   ["Q583","Q217427","Q43996","Q524985","Q1016","Q125760","Q49694","Q142863"],
  ere:  ["Q22026","Q83819","Q14629","Q14634"],
  lp:   ["Q44278","Q32930","Q148668","Q201556"],
};

// ═══════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════
const CATS = [
  // CLUBS
  {id:"rm",   label:"Real Madrid",          icon:"🤍", type:"club",        validate:q=>hasClub(q,"Q8682")},
  {id:"barca",label:"FC Barcelone",          icon:"🔵", type:"club",        validate:q=>hasClub(q,"Q7156")},
  {id:"atm",  label:"Atlético Madrid",       icon:"🔴", type:"club",        validate:q=>hasClub(q,"Q8701")},
  {id:"manu", label:"Manchester United",     icon:"👹", type:"club",        validate:q=>hasClub(q,"Q18656")},
  {id:"city", label:"Manchester City",       icon:"🩵", type:"club",        validate:q=>hasClub(q,"Q50602")},
  {id:"liv",  label:"Liverpool FC",          icon:"❤", type:"club",        validate:q=>hasClub(q,"Q1523")},
  {id:"che",  label:"Chelsea FC",            icon:"💙", type:"club",        validate:q=>hasClub(q,"Q9616")},
  {id:"ars",  label:"Arsenal FC",            icon:"🔴", type:"club",        validate:q=>hasClub(q,"Q9617")},
  {id:"tot",  label:"Tottenham Hotspur",     icon:"⚪", type:"club",        validate:q=>hasClub(q,"Q18727")},
  {id:"psg",  label:"Paris Saint-Germain",   icon:"🗼", type:"club",        validate:q=>hasClub(q,"Q583")},
  {id:"juve", label:"Juventus FC",           icon:"⚫", type:"club",        validate:q=>hasClub(q,"Q4933")},
  {id:"acm",  label:"AC Milan",              icon:"🔴⚫",type:"club",       validate:q=>hasClub(q,"Q157539")},
  {id:"int",  label:"Inter Milan",           icon:"⚫🔵",type:"club",       validate:q=>hasClub(q,"Q297")},
  {id:"rom",  label:"AS Roma",               icon:"🟡", type:"club",        validate:q=>hasClub(q,"Q2800")},
  {id:"nap",  label:"SSC Napoli",            icon:"🔵", type:"club",        validate:q=>hasClub(q,"Q14567")},
  {id:"laz",  label:"SS Lazio",              icon:"🔵⚪",type:"club",       validate:q=>hasClub(q,"Q14458")},
  {id:"bay",  label:"Bayern Munich",         icon:"🔴", type:"club",        validate:q=>hasClub(q,"Q15789")},
  {id:"bvb",  label:"Borussia Dortmund",     icon:"🟡", type:"club",        validate:q=>hasClub(q,"Q44979")},
  {id:"lev",  label:"Bayer Leverkusen",      icon:"⚫🔴",type:"club",       validate:q=>hasClub(q,"Q14584")},
  {id:"ajax", label:"AFC Ajax",              icon:"🔴⚪",type:"club",       validate:q=>hasClub(q,"Q83819")},
  {id:"por",  label:"FC Porto",              icon:"🔵⚪",type:"club",       validate:q=>hasClub(q,"Q44278")},
  {id:"ben",  label:"Benfica",               icon:"🦅", type:"club",        validate:q=>hasClub(q,"Q32930")},
  {id:"sev",  label:"Sevilla FC",            icon:"🔴⚪",type:"club",       validate:q=>hasClub(q,"Q43799")},
  {id:"mon",  label:"AS Monaco",             icon:"🔴⚪",type:"club",       validate:q=>hasClub(q,"Q524985")},
  {id:"lyon", label:"Olympique Lyonnais",    icon:"🔴🔵",type:"club",       validate:q=>hasClub(q,"Q217427")},
  {id:"mars", label:"Olympique Marseille",   icon:"🔵⚪",type:"club",       validate:q=>hasClub(q,"Q43996")},
  {id:"lei",  label:"Leicester City",        icon:"🦊", type:"club",        validate:q=>hasClub(q,"Q47322")},
  {id:"psv",  label:"PSV Eindhoven",         icon:"🔴⚪",type:"club",       validate:q=>hasClub(q,"Q22026")},
  {id:"cel",  label:"Celtic FC",             icon:"🍀", type:"club",        validate:q=>hasClub(q,"Q42274")},
  {id:"vil",  label:"Villarreal CF",         icon:"🟡", type:"club",        validate:q=>hasClub(q,"Q61289")},
  // LIGUES
  {id:"lpl",  label:"Premier League",        icon:"🏴",type:"league",  validate:q=>hasLeague(q,LEAGUE_CLUBS.pl)},
  {id:"llig", label:"La Liga",               icon:"🇪🇸", type:"league",     validate:q=>hasLeague(q,LEAGUE_CLUBS.liga)},
  {id:"lsa",  label:"Serie A",               icon:"🇮🇹", type:"league",     validate:q=>hasLeague(q,LEAGUE_CLUBS.sa)},
  {id:"lbun", label:"Bundesliga",            icon:"🇩🇪", type:"league",     validate:q=>hasLeague(q,LEAGUE_CLUBS.bund)},
  {id:"ll1",  label:"Ligue 1",               icon:"🇫🇷", type:"league",     validate:q=>hasLeague(q,LEAGUE_CLUBS.l1)},
  {id:"lere", label:"Eredivisie",            icon:"🇳🇱", type:"league",     validate:q=>hasLeague(q,LEAGUE_CLUBS.ere)},
  {id:"lp1",  label:"Liga Portuguesa",       icon:"🇵🇹", type:"league",     validate:q=>hasLeague(q,LEAGUE_CLUBS.lp)},
  // TROPHÉES
  {id:"tucl", label:"Vainqueur UCL 🏆",      icon:"🏆", type:"trophy",      validate:q=>hasWonUCL(q)},
  {id:"twc",  label:"Champion du Monde 🌍",  icon:"🌍", type:"trophy",      validate:q=>hasWonWorldCup(q)},
  {id:"teur", label:"Champion d'Europe ⭐",  icon:"⭐", type:"trophy",      validate:q=>hasWonEuro(q)},
  {id:"tca",  label:"Copa América 🌎",       icon:"🌎", type:"trophy",      validate:q=>hasWonCopaAm(q)},
  {id:"tbo",  label:"Ballon d'Or 🥇",        icon:"🥇", type:"trophy",      validate:q=>hasAward(q,["Q189085","Q189534","Q215030","Q3533987","Q3533985"])},
  {id:"tfa",  label:"Vainqueur FA Cup ⚽",   icon:"⚽", type:"trophy",      validate:q=>hasClubTrophy(q,FA_CUP_CLUBS)},
  {id:"tcdr", label:"Vainqueur Copa del Rey",icon:"👑", type:"trophy",      validate:q=>hasClubTrophy(q,COPA_REY_CLUBS)},
  {id:"tdfl", label:"Vainqueur DFB-Pokal",   icon:"🏆", type:"trophy",      validate:q=>hasClubTrophy(q,DFB_CLUBS)},
  // MANAGERS
  {id:"mfer", label:"Entraîné par Ferguson",  icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q47443")},
  {id:"mgua", label:"Entraîné par Guardiola", icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q7243")},
  {id:"mmou", label:"Entraîné par Mourinho",  icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q193236")},
  {id:"mklo", label:"Entraîné par Klopp",     icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q55844")},
  {id:"manc", label:"Entraîné par Ancelotti", icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q25181")},
  {id:"mwen", label:"Entraîné par Wenger",    icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q50933")},
  {id:"mzid", label:"Entraîné par Zidane",    icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q43029")},
  {id:"mben", label:"Entraîné par Benitez",   icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q152200")},
  {id:"mcap", label:"Entraîné par Capello",   icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q221754")},
  {id:"msim", label:"Entraîné par Simeone",   icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q275596")},
  {id:"mcon", label:"Entraîné par Conte",     icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q444003")},
  {id:"mran", label:"Entraîné par Ranieri",   icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q240397")},
  {id:"mpoc", label:"Entraîné par Pochettino",icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q464671")},
  {id:"mvag", label:"Entraîné par Van Gaal",  icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q47459")},
  {id:"mtuc", label:"Entraîné par Tuchel",    icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q1318843")},
  {id:"mhey", label:"Entraîné par Heynckes",  icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q186397")},
  {id:"mfli", label:"Entraîné par Flick",     icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q57218")},
  {id:"mrij", label:"Entraîné par Rijkaard",  icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q47457")},
  {id:"mall", label:"Entraîné par Allegri",   icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q1055038")},
  {id:"mlip", label:"Entraîné par Lippi",     icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q190879")},
  {id:"mten", label:"Entraîné par Ten Hag",   icon:"👨💼",type:"manager",    validate:q=>hasManagedBy(q,"Q1418562")},
  // NATIONALITÉS
  {id:"nfr", label:"Joueur Français 🇫🇷",    icon:"🇫🇷",type:"nationality", validate:q=>hasNationality(q,["Q142"])},
  {id:"nbr", label:"Joueur Brésilien 🇧🇷",   icon:"🇧🇷",type:"nationality", validate:q=>hasNationality(q,["Q155"])},
  {id:"npt", label:"Joueur Portugais 🇵🇹",   icon:"🇵🇹",type:"nationality", validate:q=>hasNationality(q,["Q45"])},
  {id:"nes", label:"Joueur Espagnol 🇪🇸",    icon:"🇪🇸",type:"nationality", validate:q=>hasNationality(q,["Q29"])},
  {id:"nar", label:"Joueur Argentin 🇦🇷",    icon:"🇦🇷",type:"nationality", validate:q=>hasNationality(q,["Q414"])},
  {id:"nde", label:"Joueur Allemand 🇩🇪",    icon:"🇩🇪",type:"nationality", validate:q=>hasNationality(q,["Q183"])},
  {id:"nit", label:"Joueur Italien 🇮🇹",     icon:"🇮🇹",type:"nationality", validate:q=>hasNationality(q,["Q38"])},
  {id:"nen", label:"Joueur Anglais 🏴",icon:"🏴",type:"nationality",validate:q=>hasNationality(q,["Q21","Q145"])},
  {id:"nnl", label:"Joueur Néerlandais 🇳🇱", icon:"🇳🇱",type:"nationality", validate:q=>hasNationality(q,["Q55"])},
  {id:"nbe", label:"Joueur Belge 🇧🇪",       icon:"🇧🇪",type:"nationality", validate:q=>hasNationality(q,["Q31"])},
  {id:"nhr", label:"Joueur Croate 🇭🇷",      icon:"🇭🇷",type:"nationality", validate:q=>hasNationality(q,["Q224"])},
  {id:"nuy", label:"Joueur Uruguayen 🇺🇾",   icon:"🇺🇾",type:"nationality", validate:q=>hasNationality(q,["Q77"])},
  {id:"nco", label:"Joueur Colombien 🇨🇴",   icon:"🇨🇴",type:"nationality", validate:q=>hasNationality(q,["Q739"])},
  {id:"nse", label:"Joueur Sénégalais 🇸🇳",  icon:"🇸🇳",type:"nationality", validate:q=>hasNationality(q,["Q1041"])},
  {id:"npo", label:"Joueur Polonais 🇵🇱",    icon:"🇵🇱",type:"nationality", validate:q=>hasNationality(q,["Q36"])},
];

// ═══════════════════════════════════════════════════════════
// COMBINAISONS IMPOSSIBLES
// ═══════════════════════════════════════════════════════════
const INCOMPATIBLE = [
  // Copa América = seulement AR, UY, BR
  ["nfr","tca"],["nde","tca"],["nit","tca"],["nes","tca"],["nen","tca"],
  ["nnl","tca"],["nbe","tca"],["nhr","tca"],["npt","tca"],["npo","tca"],
  ["nse","tca"],["nco","tca"],
  // Euro = FR, DE, IT, ES, NL, PT uniquement (dans notre liste)
  ["nbr","teur"],["nar","teur"],["nuy","teur"],["nco","teur"],["nse","teur"],
  ["nen","teur"],["nbe","teur"],["nhr","teur"],["npo","teur"],
  // Coupe du Monde = NL, BE, HR, PT, CO, PO, SN n'ont jamais gagné
  ["nnl","twc"],["nbe","twc"],["nhr","twc"],["npt","twc"],
  ["nco","twc"],["npo","twc"],["nse","twc"],
];

function isCompatible(catIds) {
  for (let i = 0; i < catIds.length; i++) {
    for (let j = i+1; j < catIds.length; j++) {
      const a = catIds[i], b = catIds[j];
      if (INCOMPATIBLE.some(([x,y]) => (a===x&&b===y)||(a===y&&b===x))) return false;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════
// ÉTAT DU JEU
// ═══════════════════════════════════════════════════════════
let G = {
  roomCode:null, playerId:null, playerNum:null,
  timerSec:15, rowCats:[], colCats:[],
  cells:{}, usedPlayers:[], scores:{"1":0,"2":0},
  currentPlayer:1, gameStatus:"waiting",
  timerInterval:null, timeLeft:0, _lastTurnChange:null,
  selectedCell:null, selectedPlayerQid:null, selectedPlayerName:null,
};

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════
const randCode = () => Math.random().toString(36).substr(2,6).toUpperCase();

function pickRandom(arr,n) {
  const s=[...arr],r=[];
  while(r.length<n&&s.length>0) r.push(s.splice(Math.floor(Math.random()*s.length),1)[0]);
  return r;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function toast(msg,type='ok',dur=3000) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast '+type;
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>t.classList.remove('show'),dur);
}

function copyLink() {
  const url=`${location.origin}${location.pathname}?room=${G.roomCode}`;
  navigator.clipboard.writeText(url).then(()=>toast('🔗 Lien copié !','ok')).catch(()=>{});
}

function toggleJoin() {
  const a=document.getElementById('join-area');
  const hidden=a.classList.toggle('hidden');
  a.style.display=hidden?'none':'flex';
}

function setTimer(sec,btn) {
  G.timerSec=sec;
  document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(G.roomCode) DB.ref('rooms/'+G.roomCode+'/timerSec').set(sec);
}

function el(tag,cls='') {
  const e=document.createElement(tag);
  if(cls) e.className=cls;
  return e;
}

function typeName(t) {
  return {club:'Club',league:'Ligue',trophy:'Trophée',manager:'Manager',nationality:'Nationalité'}[t]||t;
}

// ═══════════════════════════════════════════════════════════
// GÉNÉRATION DES CATÉGORIES (avec vérification compatibilité)
// ═══════════════════════════════════════════════════════════
function generateCategories() {
  const templates = [
    ['club','club','league','trophy','manager','nationality'],
    ['club','club','trophy','nationality','manager','league'],
    ['club','trophy','nationality','manager','club','league'],
    ['club','club','trophy','trophy','nationality','manager'],
  ];

  const pools = {};
  ['club','league','trophy','manager','nationality'].forEach(t => {
    pools[t] = CATS.filter(c=>c.type===t);
  });

  let selected = [];
  let attempts = 0;

  // Réessaie jusqu'à avoir une grille sans combinaisons impossibles
  do {
    const template = templates[Math.floor(Math.random()*templates.length)];
    const shuffled = [...template].sort(()=>Math.random()-.5);
    const used = new Set();
    selected = [];

    for(const type of shuffled) {
      if(selected.length>=6) break;
      const available = (pools[type]||[]).filter(c=>!used.has(c.id));
      if(!available.length) continue;
      const pick = available[Math.floor(Math.random()*available.length)];
      used.add(pick.id);
      selected.push(pick.id);
    }

    if(selected.length<6) {
      const remaining = CATS.filter(c=>!new Set(selected).has(c.id));
      pickRandom(remaining,6-selected.length).forEach(c=>selected.push(c.id));
    }

    attempts++;
  } while(!isCompatible(selected) && attempts < 50);

  return { rowCats:selected.slice(0,3), colCats:selected.slice(3,6) };
}

// ═══════════════════════════════════════════════════════════
// GESTION DES ROOMS FIREBASE
// ═══════════════════════════════════════════════════════════
async function createRoom() {
  G.roomCode  = randCode();
  G.playerId  = 'p1';
  G.playerNum = 1;
  const {rowCats,colCats} = generateCategories();
  G.rowCats=rowCats; G.colCats=colCats;

  await DB.ref('rooms/'+G.roomCode).set({
    status:'waiting', p1:'ready', p2:null,
    currentPlayer:1, timerSec:G.timerSec,
    rowCats, colCats, cells:{}, usedPlayers:[],
    scores:{"1":0,"2":0}, createdAt:Date.now()
  });

  const url=`${location.origin}${location.pathname}?room=${G.roomCode}`;
  document.getElementById('lob-code').textContent=G.roomCode;
  document.getElementById('lob-link').textContent='🔗 '+url+' — Clique pour copier';
  showScreen('s-lobby');
  listenLobby();
}

async function joinRoom() {
  let input=document.getElementById('join-input').value.trim();
  if(input.includes('?room=')) input=input.split('?room=')[1].split('&')[0];
  const code=input.toUpperCase().slice(0,6);
  if(!code){ toast('Entre un code de partie !','err'); return; }

  const snap=await DB.ref('rooms/'+code).get();
  if(!snap.exists())              { toast('❌ Partie introuvable','err'); return; }
  const data=snap.val();
  if(data.status!=='waiting')     { toast('❌ Partie déjà commencée','err'); return; }
  if(data.p2)                     { toast('❌ Partie déjà complète','err'); return; }

  G.roomCode=code; G.playerId='p2'; G.playerNum=2;
  G.rowCats=data.rowCats; G.colCats=data.colCats; G.timerSec=data.timerSec||15;

  await DB.ref('rooms/'+code+'/p2').set('ready');

  const url=`${location.origin}${location.pathname}?room=${G.roomCode}`;
  document.getElementById('lob-code').textContent=G.roomCode;
  document.getElementById('lob-link').textContent='🔗 '+url+' — Clique pour copier';
  document.getElementById('lob-status').textContent='✅ Connecté !';
  document.getElementById('btn-start').classList.remove('hidden');
  showScreen('s-lobby');
  listenLobby();
}

function listenLobby() {
  DB.ref('rooms/'+G.roomCode).on('value', snap => {
    if(!snap.exists()) return;
    const data=snap.val();
    G.timerSec=data.timerSec||15;
    if(data.p1&&data.p2) {
      document.getElementById('lob-status').textContent='🎉 Les deux joueurs sont connectés !';
      document.getElementById('btn-start').classList.remove('hidden');
    }
    if(data.status==='playing') {
      DB.ref('rooms/'+G.roomCode).off();
      G.rowCats=data.rowCats; G.colCats=data.colCats;
      G.cells=data.cells||{}; G.usedPlayers=data.usedPlayers||[];
      G.scores=data.scores||{"1":0,"2":0};
      G.currentPlayer=data.currentPlayer||1;
      G.timerSec=data.timerSec||15;
      initGame();
    }
  });
}

async function startGame() {
  await DB.ref('rooms/'+G.roomCode).update({
    timerSec:G.timerSec, status:'playing', lastTurnChange:Date.now()
  });
}

// ═══════════════════════════════════════════════════════════
// INIT JEU
// ═══════════════════════════════════════════════════════════
function initGame() {
  showScreen('s-game');
  renderGrid();
  listenGameState();
  updateUI();
  if(G.currentPlayer===G.playerNum&&G.timerSec>0) startTimer();
}

function renderGrid() {
  const grid=document.getElementById('the-grid');
  grid.innerHTML='';
  const rowObjs=G.rowCats.map(id=>CATS.find(c=>c.id===id));
  const colObjs=G.colCats.map(id=>CATS.find(c=>c.id===id));

  grid.appendChild(el('div','cat-head'));

  colObjs.forEach(cat=>{
    if(!cat) return;
    const h=el('div','cat-head type-'+cat.type);
    h.innerHTML=`<div class="cat-icon">${cat.icon}</div><div class="cat-lbl">${cat.label}</div><div class="cat-type-label">${typeName(cat.type)}</div>`;
    grid.appendChild(h);
  });

  rowObjs.forEach((rowCat,ri)=>{
    if(!rowCat) return;
    const rh=el('div','cat-head row type-'+rowCat.type);
    rh.innerHTML=`<div class="cat-icon">${rowCat.icon}</div><div class="cat-lbl">${rowCat.label}</div><div class="cat-type-label">${typeName(rowCat.type)}</div>`;
    grid.appendChild(rh);

    colObjs.forEach((colCat,ci)=>{
      const key=ri+'_'+ci;
      const cell=el('div','cell');
      cell.dataset.row=ri; cell.dataset.col=ci;
      const taken=G.cells[key];
      if(taken) {
        cell.classList.add('done-p'+taken.player);
        cell.innerHTML=`<div><span class="owner-icon">${taken.player===1?'🔵':'🔴'}</span><span class="cname">${taken.playerName}</span></div>`;
      } else {
        cell.innerHTML='<span class="plus">+</span>';
        if(G.currentPlayer===G.playerNum) cell.onclick=()=>openModal(ri,ci);
        else cell.classList.add('off');
      }
      grid.appendChild(cell);
    });
  });
}

// ═══════════════════════════════════════════════════════════
// ÉCOUTE TEMPS RÉEL
// ═══════════════════════════════════════════════════════════
function listenGameState() {
  DB.ref('rooms/'+G.roomCode).on('value', snap=>{
    if(!snap.exists()) return;
    const data=snap.val();
    G.cells=data.cells||{}; G.usedPlayers=data.usedPlayers||[];
    G.scores=data.scores||{"1":0,"2":0}; G.currentPlayer=data.currentPlayer||1;
    renderGrid(); updateUI();
    if(data.status==='finished') {
      DB.ref('rooms/'+G.roomCode).off(); stopTimer(); showResult(data.winner); return;
    }
    if(data.lastTurnChange&&data.lastTurnChange!==G._lastTurnChange) {
      G._lastTurnChange=data.lastTurnChange;
      stopTimer();
      if(G.currentPlayer===G.playerNum&&G.timerSec>0) startTimer();
    }
  });
}

function updateUI() {
  document.getElementById('sc-p1').textContent=G.scores["1"]||0;
  document.getElementById('sc-p2').textContent=G.scores["2"]||0;
  const isMy=G.currentPlayer===G.playerNum;
  document.getElementById('turn-info').innerHTML=isMy
    ? '<strong>🟢 C\'est ton tour !</strong>'
    : `<span>⏳ Tour du Joueur ${G.currentPlayer}...</span>`;
  document.getElementById('b-p1').classList.toggle('myturn',G.currentPlayer===1);
  document.getElementById('b-p2').classList.toggle('myturn',G.currentPlayer===2);
  document.getElementById('pass-btn').classList.toggle('hidden',!isMy||G.timerSec===0);
  if(G.timerSec===0) document.getElementById('timer-disp').textContent='∞';
  document.getElementById('used-disp').textContent=
    G.usedPlayers.length>0 ? '🚫 Déjà joués : '+G.usedPlayers.join(', ') : '';
}

// ═══════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════
function startTimer() {
  G.timeLeft=G.timerSec; updateTimerDisplay();
  G.timerInterval=setInterval(()=>{
    G.timeLeft--; updateTimerDisplay();
    if(G.timeLeft<=0) {
      stopTimer();
      if(G.currentPlayer===G.playerNum) { toast('⏱ Temps écoulé !','info'); closeModal(); nextTurn(); }
    }
  },1000);
}

function stopTimer() {
  if(G.timerInterval){ clearInterval(G.timerInterval); G.timerInterval=null; }
  const d=document.getElementById('timer-disp');
  d.textContent=G.timerSec===0?'∞':'–'; d.classList.remove('urgent');
}

function updateTimerDisplay() {
  const d=document.getElementById('timer-disp');
  d.textContent=G.timeLeft; d.classList.toggle('urgent',G.timeLeft<=5);
}

function passMyTurn() {
  if(G.currentPlayer!==G.playerNum) return;
  closeModal(); toast('⏭ Tour passé','info'); nextTurn();
}

async function nextTurn() {
  await DB.ref('rooms/'+G.roomCode).update({
    currentPlayer:G.currentPlayer===1?2:1, lastTurnChange:Date.now()
  });
}

// ═══════════════════════════════════════════════════════════
// MODAL — SAISIE JOUEUR
// ═══════════════════════════════════════════════════════════
function openModal(row,col) {
  if(G.currentPlayer!==G.playerNum||G.cells[row+'_'+col]) return;
  G.selectedCell={row,col}; G.selectedPlayerQid=null; G.selectedPlayerName=null;
  const rc=CATS.find(c=>c.id===G.rowCats[row]);
  const cc=CATS.find(c=>c.id===G.colCats[col]);
  document.getElementById('modal-info').innerHTML=
    `<span class="cbadge">${rc?.icon} ${rc?.label}</span>
     <span style="color:var(--muted)">×</span>
     <span class="cbadge">${cc?.icon} ${cc?.label}</span>`;
  document.getElementById('psearch').value='';
  document.getElementById('presults').classList.add('hidden');
  document.getElementById('merr').textContent='';
  document.getElementById('wikidata-status').textContent='';
  document.getElementById('wikidata-status').className='wiki-status';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('psearch').focus(),100);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('presults').classList.add('hidden');
  G.selectedCell=G.selectedPlayerQid=G.selectedPlayerName=null;
}

let _st;
function onSearchInput(val) {
  clearTimeout(_st);
  G.selectedPlayerQid=null; G.selectedPlayerName=null;
  document.getElementById('merr').textContent='';
  if(val.length<2){ document.getElementById('presults').classList.add('hidden'); return; }
  document.getElementById('wikidata-status').textContent='🔍 Recherche Wikipedia...';
  document.getElementById('wikidata-status').className='wiki-status loading';
  _st=setTimeout(()=>doSearch(val),400);
}

async function doSearch(query) {
  const results=await searchFootballers(query);
  const box=document.getElementById('presults');
  box.innerHTML='';
  if(!results.length) {
    document.getElementById('wikidata-status').textContent='❌ Aucun résultat — essaie le nom complet ou en anglais';
    document.getElementById('wikidata-status').className='wiki-status err';
    box.classList.add('hidden'); return;
  }
  document.getElementById('wikidata-status').textContent='';
  document.getElementById('wikidata-status').className='wiki-status';
  results.forEach(r=>{
    const item=el('div','res-item');
    item.innerHTML=`<strong>${r.label}</strong><div class="res-desc">${r.description||''}</div>`;
    item.onclick=()=>selectPlayer(r.id,r.label);
    box.appendChild(item);
  });
  box.classList.remove('hidden');
}

function selectPlayer(qid,name) {
  G.selectedPlayerQid=qid; G.selectedPlayerName=name;
  document.getElementById('psearch').value=name;
  document.getElementById('presults').classList.add('hidden');
  document.getElementById('wikidata-status').textContent='✅ '+name+' sélectionné';
  document.getElementById('wikidata-status').className='wiki-status ok';
  document.getElementById('merr').textContent='';
}

async function confirmPlayer() {
  if(!G.selectedPlayerQid){ document.getElementById('merr').textContent='⚠ Sélectionne un joueur dans la liste'; return; }
  if(!G.selectedCell) return;
  const {row,col}=G.selectedCell;
  const qid=G.selectedPlayerQid, name=G.selectedPlayerName;

  if(G.usedPlayers.map(p=>p.toLowerCase()).includes(name.toLowerCase())) {
    document.getElementById('merr').textContent='❌ Ce joueur a déjà été joué !'; return;
  }

  const rc=CATS.find(c=>c.id===G.rowCats[row]);
  const cc=CATS.find(c=>c.id===G.colCats[col]);

  document.getElementById('wikidata-status').textContent='⏳ Vérification en cours...';
  document.getElementById('wikidata-status').className='wiki-status loading';
  document.getElementById('merr').textContent='';

  try {
    const [mRow,mCol]=await Promise.all([rc.validate(qid), cc.validate(qid)]);

    if(!mRow||!mCol) {
      document.getElementById('wikidata-status').textContent='';
      document.getElementById('wikidata-status').className='wiki-status';
      let err='❌ ';
      if(!mRow&&!mCol) err+=`${name} ne correspond à aucune catégorie`;
      else if(!mRow) err+=`${name} ne correspond pas à "${rc.label}"`;
      else err+=`${name} ne correspond pas à "${cc.label}"`;
      document.getElementById('merr').textContent=err;
      return;
    }

    // ✅ Validé !
    closeModal(); stopTimer(); toast(`✅ ${name} validé !`,'ok');
    const key=row+'_'+col;
    const newScore={...G.scores};
    newScore[String(G.playerNum)]=(parseInt(newScore[String(G.playerNum)])||0)+1;
    const newCells={...G.cells,[key]:{player:G.playerNum,playerName:name}};
    const newUsed=[...G.usedPlayers,name];
    const winner=checkWin(newCells);
    const upd={
      cells:newCells, usedPlayers:newUsed, scores:newScore,
      currentPlayer:G.currentPlayer===1?2:1, lastTurnChange:Date.now()
    };
    if(winner!==null){ upd.status='finished'; upd.winner=winner; }
    else if(Object.keys(newCells).length>=9){ upd.status='finished'; upd.winner=0; }
    await DB.ref('rooms/'+G.roomCode).update(upd);

  } catch(e) {
    document.getElementById('wikidata-status').textContent='';
    document.getElementById('merr').textContent='⚠ Erreur de vérification, réessaie.';
  }
}

// ═══════════════════════════════════════════════════════════
// VICTOIRE
// ═══════════════════════════════════════════════════════════
function checkWin(cells) {
  const lines=[
    [[0,0],[0,1],[0,2]],[[1,0],[1,1],[1,2]],[[2,0],[2,1],[2,2]],
    [[0,0],[1,0],[2,0]],[[0,1],[1,1],[2,1]],[[0,2],[1,2],[2,2]],
    [[0,0],[1,1],[2,2]],[[0,2],[1,1],[2,0]]
  ];
  for(const line of lines) {
    const ps=line.map(([r,c])=>cells[r+'_'+c]?.player);
    if(ps[0]&&ps[0]===ps[1]&&ps[1]===ps[2]) return ps[0];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// RÉSULTAT
// ═══════════════════════════════════════════════════════════
function showResult(winner) {
  showScreen('s-result');
  let emoji,title;
  if(winner===0||winner===null){ emoji='🤝'; title='Match nul !'; }
  else if(winner===G.playerNum){ emoji='🏆'; title='Tu as gagné ! 🎉'; }
  else                          { emoji='😢'; title='Tu as perdu...'; }
  document.getElementById('r-emoji').textContent=emoji;
  document.getElementById('r-title').textContent=title;
  document.getElementById('r-score').textContent=
    `Joueur 1 : ${G.scores["1"]||0} pts  —  Joueur 2 : ${G.scores["2"]||0} pts`;
  document.getElementById('r-recap').textContent=
    `${Object.keys(G.cells).length} case(s) remplie(s) sur 9`;
}

async function rematch() {
  const {rowCats,colCats}=generateCategories();
  await DB.ref('rooms/'+G.roomCode).update({
    status:'playing', cells:{}, usedPlayers:[],
    scores:{"1":0,"2":0}, currentPlayer:1,
    rowCats, colCats, lastTurnChange:Date.now()
  });
  G.rowCats=[...rowCats]; G.colCats=[...colCats];
  G.cells={}; G.usedPlayers=[]; G.scores={"1":0,"2":0};
  G.currentPlayer=1; G._lastTurnChange=null;
  initGame();
}

function goHome() {
  DB.ref('rooms/'+G.roomCode).off(); stopTimer();
  G={roomCode:null,playerId:null,playerNum:null,timerSec:15,
     rowCats:[],colCats:[],cells:{},usedPlayers:[],scores:{"1":0,"2":0},
     currentPlayer:1,gameStatus:"waiting",timerInterval:null,timeLeft:0,
     _lastTurnChange:null,selectedCell:null,selectedPlayerQid:null,selectedPlayerName:null};
  showScreen('s-home');
}

// ═══════════════════════════════════════════════════════════
// AUTO-JOIN VIA LIEN
// ═══════════════════════════════════════════════════════════
window.addEventListener('load', ()=>{
  const room=new URLSearchParams(location.search).get('room');
  if(room) {
    const a=document.getElementById('join-area');
    a.classList.remove('hidden'); a.style.display='flex';
    document.getElementById('join-input').value=room;
    toast('🔗 Lien de partie détecté !','info');
  }
});
