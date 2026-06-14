/* ============================================================
   app.js — Pilote
   Application de gestion de projets, pensée pour décharger
   mentalement. 100% locale, fonctionne hors ligne.
   ============================================================ */

import { DB, uid } from './db.js';

/* ---------- État en mémoire (cache de la base) ---------- */
const state = {
  projects: [],
  tasks: [],
  meetings: [],
  files: [],
  route: { name: 'dashboard', param: null },
};

const PROJECT_COLORS = [
  { key: 'blue',   val: '#3787dd' },
  { key: 'teal',   val: '#1d9e75' },
  { key: 'coral',  val: '#d85a30' },
  { key: 'pink',   val: '#d4537e' },
  { key: 'purple', val: '#7a5fd0' },
  { key: 'amber',  val: '#d39320' },
  { key: 'gray',   val: '#8a8980' },
];
const colorVal = (k) => (PROJECT_COLORS.find(c => c.key === k) || PROJECT_COLORS[0]).val;

const STATUS_LABELS = {
  encours: 'En cours', risque: 'À risque', termine: 'Terminé', attente: 'En attente',
};

/* ============================================================
   Utilitaires de date
   ============================================================ */
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const JOURS_COURT = ['dim','lun','mar','mer','jeu','ven','sam'];

function todayISO() {
  const d = new Date();
  return isoOf(d);
}
function isoOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function parseISO(s) {
  if (!s) return null;
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function daysBetween(aISO, bISO) {
  const a = parseISO(aISO), b = parseISO(bISO);
  return Math.round((b - a) / 86400000);
}
function formatLong(d) {
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
function formatDue(iso) {
  if (!iso) return { label: '', cls: '' };
  const diff = daysBetween(todayISO(), iso);
  if (diff < 0)  return { label: `${Math.abs(diff)}\u00a0j de retard`, cls: 'late', icon: 'ti-alert-triangle' };
  if (diff === 0) return { label: "Aujourd'hui", cls: 'soon', icon: 'ti-calendar' };
  if (diff === 1) return { label: 'Demain', cls: 'soon', icon: 'ti-calendar' };
  if (diff <= 6) return { label: JOURS[parseISO(iso).getDay()], cls: 'soon', icon: '' };
  const d = parseISO(iso);
  return { label: `${d.getDate()} ${MOIS[d.getMonth()].slice(0,4)}.`, cls: '', icon: '' };
}
function startOfWeek(d) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // lundi = 0
  r.setDate(r.getDate() - day);
  r.setHours(0,0,0,0);
  return r;
}

/* ============================================================
   Utilitaires divers
   ============================================================ */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function bytes(n) {
  if (n < 1024) return n + ' o';
  if (n < 1048576) return (n/1024).toFixed(0) + ' Ko';
  return (n/1048576).toFixed(1) + ' Mo';
}
function fileIcon(type, name) {
  const n = (name||'').toLowerCase();
  if (type?.includes('pdf') || n.endsWith('.pdf')) return { i: 'ti-file-type-pdf', c: 'var(--red)' };
  if (type?.includes('image') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return { i: 'ti-photo', c: 'var(--p-teal)' };
  if (/\.(docx?|odt)$/.test(n) || type?.includes('word')) return { i: 'ti-file-type-doc', c: 'var(--blue)' };
  if (/\.(xlsx?|csv|ods)$/.test(n) || type?.includes('sheet')) return { i: 'ti-file-type-xls', c: 'var(--green)' };
  if (/\.(pptx?|odp)$/.test(n)) return { i: 'ti-file-type-ppt', c: 'var(--p-coral)' };
  if (/\.(zip|rar|7z)$/.test(n)) return { i: 'ti-file-zip', c: 'var(--text-2)' };
  return { i: 'ti-file', c: 'var(--text-2)' };
}

/* ============================================================
   Données de démonstration (au premier lancement)
   ============================================================ */
async function seedIfEmpty() {
  const meta = await DB.get('meta', 'seeded');
  if (meta) return;
  const T = todayISO();
  const plus = (n) => { const d = parseISO(T); d.setDate(d.getDate()+n); return isoOf(d); };

  const projs = [
    { id: uid('p'), name: 'Insertion professionnelle', color: 'blue',  status: 'encours', deadline: plus(17), createdAt: Date.now() },
    { id: uid('p'), name: 'Aide alimentaire',          color: 'teal',  status: 'encours', deadline: plus(32), createdAt: Date.now() },
    { id: uid('p'), name: 'Formation bénévoles',       color: 'coral', status: 'risque',  deadline: plus(7),  createdAt: Date.now() },
    { id: uid('p'), name: 'Partenariat CAF',           color: 'pink',  status: 'risque',  deadline: plus(18), createdAt: Date.now() },
    { id: uid('p'), name: 'Rapport annuel',            color: 'gray',  status: 'attente', deadline: plus(79), createdAt: Date.now() },
  ];
  const [insertion, aide, formation, caf, rapport] = projs;

  const tasks = [
    { projectId: caf.id,       title: 'Envoyer la convention de partenariat à la CAF', priority: 'haute',   deadline: plus(-3) },
    { projectId: formation.id, title: 'Valider la liste des bénévoles (formation juin)', priority: 'haute', deadline: plus(-2) },
    { projectId: insertion.id, title: 'Point hebdo équipe insertion', priority: 'basse', deadline: T, done: true },
    { projectId: rapport.id,   title: 'Rédiger le compte-rendu de la réunion CA', priority: 'normale', deadline: T },
    { projectId: insertion.id, title: 'Appeler le référent Pôle Emploi (M. Lefèvre)', priority: 'haute', deadline: T, focus: true },
    { projectId: null,         title: "Préparer l'ordre du jour de la bilatérale", priority: 'normale', deadline: T },
    { projectId: aide.id,      title: 'Recontacter la banque alimentaire régionale', priority: 'normale', deadline: plus(3) },
    { projectId: formation.id, title: 'Réserver la salle pour la session du 20', priority: 'haute', deadline: plus(4) },
    { projectId: insertion.id, title: 'Mettre à jour les dossiers bénéficiaires', priority: 'basse', deadline: plus(6) },
    { projectId: aide.id,      title: 'Établir le budget Q3', priority: 'normale', deadline: plus(10) },
  ];

  for (const p of projs) await DB.put('projects', p);
  for (const t of tasks) {
    await DB.put('tasks', {
      id: uid('t'), projectId: t.projectId, title: t.title,
      priority: t.priority, deadline: t.deadline || null,
      done: !!t.done, parentId: null, focus: !!t.focus,
      fromMeetingId: null, createdAt: Date.now(),
    });
  }

  // Une réunion d'exemple
  await DB.put('meetings', {
    id: uid('m'),
    title: 'Bilatérale direction',
    date: T,
    attendees: 'Direction',
    content: '<p>Tour des projets en cours.</p><p>La directrice souhaite avancer sur le <strong>partenariat CAF</strong> : convention à finaliser cette semaine.</p><p>Point de vigilance sur la formation bénévoles — calendrier serré.</p>',
    createdAt: Date.now(),
  });

  await DB.put('meta', { id: 'seeded', value: true });
}

/* ============================================================
   Chargement de l'état
   ============================================================ */
async function loadState() {
  const [projects, tasks, meetings, files] = await Promise.all([
    DB.all('projects'), DB.all('tasks'), DB.all('meetings'), DB.all('files'),
  ]);
  state.projects = projects.sort((a,b) => a.createdAt - b.createdAt);
  state.tasks = tasks;
  state.meetings = meetings.sort((a,b) => (b.date||'').localeCompare(a.date||'') || b.createdAt - a.createdAt);
  state.files = files.sort((a,b) => b.createdAt - a.createdAt);
}

/* ---------- Sélecteurs ---------- */
const projectById = (id) => state.projects.find(p => p.id === id) || null;
const tasksOfProject = (pid) => state.tasks.filter(t => t.projectId === pid);
const topTasksOfProject = (pid) => state.tasks.filter(t => t.projectId === pid && !t.parentId);
const subtasksOf = (tid) => state.tasks.filter(t => t.parentId === tid);

function projectProgress(pid) {
  const ts = tasksOfProject(pid);
  if (!ts.length) return 0;
  const done = ts.filter(t => t.done).length;
  return Math.round(done / ts.length * 100);
}
function lateTasks() {
  const T = todayISO();
  return state.tasks.filter(t => !t.done && t.deadline && t.deadline < T);
}
function todayTasks() {
  const T = todayISO();
  return state.tasks.filter(t => !t.done && t.deadline === T);
}
function weekTasks() {
  const T = todayISO();
  const end = (() => { const d = parseISO(T); d.setDate(d.getDate()+7); return isoOf(d); })();
  return state.tasks.filter(t => !t.done && t.deadline && t.deadline >= T && t.deadline <= end);
}
const PRIO_ORDER = { haute: 0, normale: 1, basse: 2 };
function sortTasks(arr) {
  return [...arr].sort((a,b) => {
    const da = a.deadline || '9999', db = b.deadline || '9999';
    if (da !== db) return da < db ? -1 : 1;
    return PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];
  });
}

/* ============================================================
   Actions (écritures)
   ============================================================ */
async function saveTask(t) { await DB.put('tasks', t); const i = state.tasks.findIndex(x=>x.id===t.id); if (i>=0) state.tasks[i]=t; else state.tasks.push(t); }
async function removeTask(id) {
  for (const s of subtasksOf(id)) await removeTask(s.id);
  await DB.del('tasks', id);
  state.tasks = state.tasks.filter(t => t.id !== id);
}
async function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done;
  await saveTask(t);
  renderRoute();
}
async function saveProject(p) { await DB.put('projects', p); const i = state.projects.findIndex(x=>x.id===p.id); if (i>=0) state.projects[i]=p; else state.projects.push(p); }
async function removeProject(id) {
  for (const t of tasksOfProject(id)) await DB.del('tasks', t.id);
  state.tasks = state.tasks.filter(t => t.projectId !== id);
  for (const f of state.files.filter(f => f.projectId === id)) await DB.del('files', f.id);
  state.files = state.files.filter(f => f.projectId !== id);
  await DB.del('projects', id);
  state.projects = state.projects.filter(p => p.id !== id);
}
async function saveMeeting(m) { await DB.put('meetings', m); const i = state.meetings.findIndex(x=>x.id===m.id); if (i>=0) state.meetings[i]=m; else state.meetings.unshift(m); }
async function removeMeeting(id) {
  // Les tâches issues de la réunion sont conservées, mais déliées
  for (const t of state.tasks.filter(t => t.fromMeetingId === id)) { t.fromMeetingId = null; await DB.put('tasks', t); }
  await DB.del('meetings', id);
  state.meetings = state.meetings.filter(m => m.id !== id);
}
async function saveFile(f) { await DB.put('files', f); state.files.unshift(f); }
async function removeFile(id) { await DB.del('files', id); state.files = state.files.filter(f => f.id !== id); }

/* ============================================================
   Routeur
   ============================================================ */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, param] = h.split('/');
  return { name: name || 'dashboard', param: param || null };
}
function navigate(path) { location.hash = '#/' + path; }
window.addEventListener('hashchange', () => { state.route = parseHash(); renderRoute(); });

/* ============================================================
   Rendu — Sidebar + Topbar
   ============================================================ */
function renderSidebar() {
  const nLate = lateTasks().length;
  const nToday = todayTasks().length;
  const r = state.route;
  const navActive = (n) => r.name === n ? 'active' : '';

  const projItems = state.projects.map(p => {
    const active = r.name === 'project' && r.param === p.id ? 'active' : '';
    return `<button class="nav-project ${active}" data-nav="project/${p.id}">
      <span class="dot" style="background:${colorVal(p.color)}"></span>
      <span class="nm">${esc(p.name)}</span>
    </button>`;
  }).join('');

  return `
  <div class="sidebar-logo"><span class="mark"><i class="ti ti-compass"></i></span> Pilote</div>

  <div class="nav-group">
    <button class="nav-item ${navActive('focus')}" data-nav="focus"><i class="ti ti-target"></i> Focus du jour</button>
    <button class="nav-item ${navActive('dashboard')}" data-nav="dashboard"><i class="ti ti-layout-dashboard"></i> Tableau de bord
      ${nLate ? `<span class="badge-count">${nLate}</span>` : ''}</button>
    <button class="nav-item ${navActive('meeting')}" data-nav="meeting"><i class="ti ti-notes"></i> Réunions</button>
    <button class="nav-item ${navActive('planning')}" data-nav="planning"><i class="ti ti-calendar-week"></i> Planning
      ${nToday ? `<span class="badge-count muted">${nToday}</span>` : ''}</button>
    <button class="nav-item ${navActive('files')}" data-nav="files"><i class="ti ti-folder"></i> Fichiers</button>
  </div>

  <div class="nav-section-label">Projets
    <button data-action="new-project" title="Nouveau projet"><i class="ti ti-plus"></i></button>
  </div>
  <div class="nav-group">${projItems || '<div style="padding:6px 16px;font-size:12px;color:var(--text-3)">Aucun projet</div>'}</div>

  <div class="sidebar-spacer"></div>
  <div class="nav-group">
    <button class="nav-item" data-action="settings"><i class="ti ti-settings"></i> Paramètres & données</button>
  </div>`;
}

function topbar({ title, sub, actions }) {
  return `
  <div class="topbar">
    <div class="mobile-bar">
      <button class="btn-icon btn-ghost" data-action="toggle-menu"><i class="ti ti-menu-2"></i></button>
    </div>
    <div class="topbar-left">
      <div class="topbar-title">${title}</div>
      ${sub ? `<div class="topbar-sub">${sub}</div>` : ''}
    </div>
    <div class="topbar-actions">${actions || ''}</div>
  </div>`;
}

/* ============================================================
   Composants réutilisables
   ============================================================ */
function taskRow(t, { showProject = true } = {}) {
  const p = projectById(t.projectId);
  const due = formatDue(t.deadline);
  const projTag = showProject ? (p
    ? `<span class="task-proj"><span class="dot" style="background:${colorVal(p.color)}"></span>${esc(p.name)}</span>`
    : `<span class="task-proj">— général</span>`) : '';
  return `
  <div class="task ${t.done?'done':''} ${t.parentId?'sub':''}" data-task="${t.id}">
    <button class="check ${t.done?'done':''}" data-action="toggle-task" data-id="${t.id}"><i class="ti ti-check"></i></button>
    <span class="task-title" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</span>
    <div class="task-meta">
      ${projTag}
      <span class="pill pill-${t.priority}">${t.priority[0].toUpperCase()+t.priority.slice(1)}</span>
      ${t.deadline ? `<span class="due ${due.cls}">${due.icon?`<i class="ti ${due.icon}"></i>`:''}${due.label}</span>` : ''}
    </div>
  </div>`;
}

/* ============================================================
   VUE — Tableau de bord
   ============================================================ */
function viewDashboard() {
  const late = sortTasks(lateTasks());
  const today = sortTasks(todayTasks());
  const week = weekTasks();
  const activeProjects = state.projects.filter(p => p.status !== 'termine');
  const now = new Date();

  const statsHtml = `
  <div class="stats-row">
    <div class="stat" data-nav="dashboard"><div class="stat-label">En retard</div><div class="stat-val ${late.length?'red':''}">${late.length}</div></div>
    <div class="stat" data-nav="planning"><div class="stat-label">Aujourd'hui</div><div class="stat-val">${today.length}</div></div>
    <div class="stat" data-nav="planning"><div class="stat-label">Cette semaine</div><div class="stat-val ${week.length?'amber':''}">${week.length}</div></div>
    <div class="stat" data-nav="dashboard"><div class="stat-label">Projets actifs</div><div class="stat-val green">${activeProjects.length}</div></div>
  </div>`;

  const lateHtml = late.length ? `
  <div class="section">
    <div class="section-head"><span class="section-title"><i class="ti ti-alert-triangle" style="color:var(--red)"></i> En retard</span></div>
    ${late.map(t => taskRow(t)).join('')}
  </div>` : '';

  const todayHtml = `
  <div class="section">
    <div class="section-head"><span class="section-title">À faire aujourd'hui</span>
      <button class="link-btn" data-action="new-task">+ Ajouter</button></div>
    ${today.length ? today.map(t => taskRow(t)).join('')
      : `<div class="empty"><i class="ti ti-coffee"></i><div class="empty-title">Rien de prévu aujourd'hui</div><div class="empty-sub">Profite-en, ou planifie une tâche.</div></div>`}
  </div>`;

  const projectsHtml = `
  <div class="section">
    <div class="section-head"><span class="section-title">État des projets</span></div>
    ${state.projects.map(p => {
      const prog = projectProgress(p.id);
      const ts = tasksOfProject(p.id);
      const nLate = ts.filter(t => !t.done && t.deadline && t.deadline < todayISO()).length;
      const sub = nLate ? `${nLate} en retard` : `${ts.filter(t=>!t.done).length} tâche(s) ouverte(s)`;
      return `<div class="proj-row" data-nav="project/${p.id}">
        <span class="dot" style="width:9px;height:9px;border-radius:50%;background:${colorVal(p.color)}"></span>
        <div class="proj-info"><div class="proj-name">${esc(p.name)}</div><div class="proj-sub">${sub}${p.deadline?` · échéance ${formatDue(p.deadline).label}`:''}</div></div>
        <div class="progress"><div style="width:${prog}%;background:${colorVal(p.color)}"></div></div>
        <span class="status-chip st-${p.status}">${STATUS_LABELS[p.status]}</span>
      </div>`;
    }).join('') || `<div class="empty"><i class="ti ti-folder-plus"></i><div class="empty-title">Aucun projet</div><div class="empty-sub">Crée ton premier projet pour commencer.</div></div>`}
  </div>`;

  // Alertes dérivées
  const alerts = [];
  for (const t of late.filter(t => t.priority === 'haute').slice(0,3)) {
    const p = projectById(t.projectId);
    alerts.push({ title: `${esc(t.title)} — ${Math.abs(daysBetween(todayISO(), t.deadline))} j de retard`, sub: `${p?esc(p.name):'Général'} · Priorité haute` });
  }
  for (const p of state.projects.filter(p => p.status === 'risque')) {
    if (alerts.length >= 4) break;
    alerts.push({ title: `${esc(p.name)} — projet à risque`, sub: p.deadline ? `Échéance ${formatDue(p.deadline).label}` : 'Sans échéance' });
  }
  const alertsHtml = alerts.length ? `
  <div class="section">
    <div class="section-head"><span class="section-title">Alertes</span></div>
    ${alerts.map(a => `<div class="alert"><i class="ti ti-alert-circle"></i><div class="alert-body"><div class="alert-title">${a.title}</div><div class="alert-sub">${a.sub}</div></div></div>`).join('')}
  </div>` : '';

  const main = `
  <div class="view-inner">
    ${statsHtml}
    ${lateHtml}
    ${todayHtml}
    <div class="two-col">
      <div>${projectsHtml}</div>
      <div>${alertsHtml || `<div class="section"><div class="section-head"><span class="section-title">Alertes</span></div><div class="empty"><i class="ti ti-circle-check"></i><div class="empty-title">Tout est sous contrôle</div></div></div>`}</div>
    </div>
  </div>`;

  return topbar({
    title: 'Bonjour 👋',
    sub: `${formatLong(now)} · ${late.length} en retard · ${today.length} aujourd'hui`,
    actions: `<button class="btn" data-action="new-task"><i class="ti ti-plus"></i> Tâche</button>
              <button class="btn btn-primary" data-action="new-project"><i class="ti ti-plus"></i> Projet</button>`,
  }) + `<div class="view">${main}</div>`;
}

/* ============================================================
   VUE — Réunion (bac à sable + extraction de tâches)
   ============================================================ */
let currentMeetingId = null;
let sandboxSaveTimer = null;

function viewMeeting(meetingId) {
  // Si pas d'ID : ouvre la plus récente, ou en crée une
  let m = meetingId ? state.meetings.find(x => x.id === meetingId) : state.meetings[0];
  if (!m) {
    // Aucune réunion : on affiche un état d'accueil pour en créer une
    return topbar({ title: 'Réunions', actions: `<button class="btn btn-primary" data-action="new-meeting"><i class="ti ti-plus"></i> Nouvelle réunion</button>` })
      + `<div class="view"><div class="view-inner"><div class="empty" style="padding-top:80px">
          <i class="ti ti-notes"></i>
          <div class="empty-title">Aucune note de réunion</div>
          <div class="empty-sub">Crée une page pour ta prochaine bilatérale.<br>Écris librement, transforme les demandes en tâches d'un clic.</div>
          <div style="margin-top:16px"><button class="btn btn-primary" data-action="new-meeting"><i class="ti ti-plus"></i> Nouvelle réunion</button></div>
        </div></div></div>`;
  }
  currentMeetingId = m.id;

  const meetingTasks = sortTasks(state.tasks.filter(t => t.fromMeetingId === m.id));
  const meetingFiles = state.files.filter(f => f.meetingId === m.id);

  const otherMeetings = state.meetings.filter(x => x.id !== m.id).slice(0, 6);

  const sideTasks = meetingTasks.length ? meetingTasks.map(t => {
    const p = projectById(t.projectId);
    const due = formatDue(t.deadline);
    return `<div class="side-task">
      <button class="check ${t.done?'done':''}" data-action="toggle-task" data-id="${t.id}" style="margin-top:1px"><i class="ti ti-check"></i></button>
      <div class="side-task-body">
        <div class="side-task-title" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</div>
        <div class="side-task-meta">
          <span class="pill pill-${t.priority}">${t.priority[0].toUpperCase()+t.priority.slice(1)}</span>
          ${t.deadline?`<span class="due ${due.cls}">${due.label}</span>`:''}
          ${p?`<span class="task-proj"><span class="dot" style="background:${colorVal(p.color)}"></span>${esc(p.name)}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('') : `<div style="font-size:12px;color:var(--text-3);padding:4px 0 10px">Sélectionne du texte dans tes notes puis clique « → Tâche » pour ne rien oublier.</div>`;

  const filesHtml = meetingFiles.map(f => {
    const ic = fileIcon(f.type, f.name);
    return `<div class="file-chip">
      <i class="ti ${ic.i}" style="color:${ic.c}"></i>
      <div class="fc-body"><div class="fc-name">${esc(f.name)}</div><div class="fc-size">${bytes(f.size)}</div></div>
      <button class="fc-act" data-action="open-file" data-id="${f.id}" title="Ouvrir"><i class="ti ti-download"></i></button>
      <button class="fc-act" data-action="del-file" data-id="${f.id}" title="Supprimer"><i class="ti ti-x"></i></button>
    </div>`;
  }).join('');

  const main = `
  <div class="meeting-layout">
    <div class="meeting-main">
      <div class="meeting-toolbar">
        <button class="tb-btn" data-fmt="bold" title="Gras"><i class="ti ti-bold"></i></button>
        <button class="tb-btn" data-fmt="italic" title="Italique"><i class="ti ti-italic"></i></button>
        <button class="tb-btn" data-fmt="insertUnorderedList" title="Liste"><i class="ti ti-list"></i></button>
        <button class="tb-btn" data-fmt="h3" title="Titre"><i class="ti ti-heading"></i></button>
        <button class="tb-btn" data-fmt="checklist" title="Case à cocher"><i class="ti ti-checkbox"></i></button>
      </div>
      <input class="meeting-title-input" id="m-title" value="${esc(m.title)}" placeholder="Titre de la réunion…" />
      <div class="meeting-date-bar">
        <input type="date" class="meeting-meta-input" id="m-date" value="${m.date||todayISO()}" />
        <input class="meeting-meta-input" id="m-attendees" value="${esc(m.attendees||'')}" placeholder="Participants…" style="flex:1;min-width:120px" />
      </div>
      <div class="sandbox" id="sandbox" contenteditable="true" data-placeholder="Écris ici tout ce qui se dit pendant la réunion. Sélectionne une demande pour la transformer en tâche avec échéance.">${m.content||''}</div>
    </div>

    <div class="meeting-side">
      <div style="margin-bottom:22px">
        <div class="side-section-title"><i class="ti ti-checklist" style="font-size:13px"></i> Actions de cette réunion</div>
        ${sideTasks}
      </div>
      <div style="margin-bottom:22px">
        <div class="side-section-title">Fichiers joints</div>
        ${filesHtml}
        <div class="dropzone" id="meeting-dropzone"><i class="ti ti-paperclip"></i> Glisse un fichier ici<br>ou <button class="link-btn" data-action="pick-meeting-file" style="text-decoration:underline">parcourir</button></div>
        <input type="file" id="meeting-file-input" class="hidden" multiple />
      </div>
      ${otherMeetings.length ? `<div>
        <div class="side-section-title">Réunions précédentes</div>
        ${otherMeetings.map(o => `<button class="nav-project" data-nav="meeting/${o.id}" style="border-radius:5px;margin-bottom:2px">
          <i class="ti ti-note" style="font-size:14px"></i><span class="nm">${esc(o.title)} · ${formatDue(o.date).label||o.date}</span></button>`).join('')}
      </div>` : ''}
    </div>
  </div>`;

  return topbar({
    title: 'Réunion',
    sub: m.date ? formatLong(parseISO(m.date)) : '',
    actions: `<button class="btn" data-action="new-meeting"><i class="ti ti-plus"></i> Nouvelle</button>
              <button class="btn btn-ghost btn-icon" data-action="del-meeting" data-id="${m.id}" title="Supprimer cette réunion"><i class="ti ti-trash"></i></button>`,
  }) + `<div class="view" style="overflow:hidden;display:flex">${main}</div>
  <div class="sel-toolbar" id="sel-toolbar">
    <button data-action="sel-to-task"><i class="ti ti-circle-plus"></i> → Tâche</button>
    <span class="sep"></span>
    <button data-action="sel-bold" title="Gras"><i class="ti ti-bold"></i></button>
    <button data-action="sel-highlight" title="Surligner"><i class="ti ti-highlight"></i></button>
  </div>`;
}

/* ---- Logique du bac à sable ---- */
let savedRange = null;
let sandboxGlobalsBound = false;

function refreshSelToolbar() {
  const sb = document.getElementById('sandbox');
  const toolbar = document.getElementById('sel-toolbar');
  if (!sb || !toolbar) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) { toolbar.style.display = 'none'; return; }
  const anchor = sel.anchorNode;
  if (!anchor || !sb.contains(anchor.nodeType === 3 ? anchor.parentNode : anchor)) { toolbar.style.display = 'none'; return; }
  savedRange = sel.getRangeAt(0).cloneRange();
  const rect = savedRange.getBoundingClientRect();
  toolbar.style.display = 'flex';
  const tw = toolbar.offsetWidth || 220;
  let left = rect.left + rect.width/2 - tw/2;
  left = Math.max(10, Math.min(left, window.innerWidth - tw - 10));
  toolbar.style.left = left + 'px';
  toolbar.style.top = Math.max(8, rect.top - toolbar.offsetHeight - 8) + 'px';
}

function initSandbox() {
  const sb = document.getElementById('sandbox');
  if (!sb) return;

  const persist = () => {
    const m = state.meetings.find(x => x.id === currentMeetingId);
    if (!m) return;
    m.title = document.getElementById('m-title')?.value || m.title;
    m.date = document.getElementById('m-date')?.value || m.date;
    m.attendees = document.getElementById('m-attendees')?.value ?? m.attendees;
    m.content = sb.innerHTML;
    saveMeeting(m);
  };
  const debouncedPersist = () => { clearTimeout(sandboxSaveTimer); sandboxSaveTimer = setTimeout(persist, 500); };

  sb.addEventListener('input', debouncedPersist);
  document.getElementById('m-title')?.addEventListener('input', debouncedPersist);
  document.getElementById('m-date')?.addEventListener('change', persist);
  document.getElementById('m-attendees')?.addEventListener('input', debouncedPersist);

  sb.addEventListener('mouseup', () => setTimeout(refreshSelToolbar, 0));
  sb.addEventListener('keyup', (e) => { if (e.shiftKey || e.key.startsWith('Arrow')) setTimeout(refreshSelToolbar, 0); });

  // Écouteurs au niveau document : attachés une seule fois
  if (!sandboxGlobalsBound) {
    sandboxGlobalsBound = true;
    document.addEventListener('scroll', () => {
      const tb = document.getElementById('sel-toolbar');
      if (tb && tb.style.display === 'flex') refreshSelToolbar();
    }, true);
    document.addEventListener('mousedown', (e) => {
      const tb = document.getElementById('sel-toolbar');
      const sbx = document.getElementById('sandbox');
      if (tb && !tb.contains(e.target) && sbx && !sbx.contains(e.target)) tb.style.display = 'none';
    });
  }

  // Barre d'outils de formatage
  document.querySelectorAll('.tb-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const fmt = btn.dataset.fmt;
      sb.focus();
      if (fmt === 'h3') document.execCommand('formatBlock', false, document.queryCommandValue('formatBlock') === 'h3' ? 'p' : 'h3');
      else if (fmt === 'checklist') document.execCommand('insertHTML', false, '☐ ');
      else document.execCommand(fmt, false, null);
      debouncedPersist();
    });
  });

  // Fichiers — drag & drop
  const dz = document.getElementById('meeting-dropzone');
  const fi = document.getElementById('meeting-file-input');
  if (dz) {
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => handleFiles(e.dataTransfer.files, { meetingId: currentMeetingId }));
  }
  if (fi) fi.addEventListener('change', e => handleFiles(e.target.files, { meetingId: currentMeetingId }));
}

function markSelectionAsTask(taskId) {
  if (!savedRange) return;
  const sb = document.getElementById('sandbox');
  const span = document.createElement('span');
  span.className = 'task-mark';
  span.dataset.taskId = taskId;
  try { savedRange.surroundContents(span); }
  catch { try { span.appendChild(savedRange.extractContents()); savedRange.insertNode(span); } catch {} }
  // persist
  const m = state.meetings.find(x => x.id === currentMeetingId);
  if (m && sb) { m.content = sb.innerHTML; saveMeeting(m); }
  document.getElementById('sel-toolbar').style.display = 'none';
}

/* ============================================================
   VUE — Projet détail
   ============================================================ */
function viewProject(pid) {
  const p = projectById(pid);
  if (!p) { navigate('dashboard'); return ''; }
  const prog = projectProgress(pid);
  const top = topTasksOfProject(pid);
  const open = sortTasks(top.filter(t => !t.done));
  const done = top.filter(t => t.done);
  const pfiles = state.files.filter(f => f.projectId === pid);

  const renderTaskWithSubs = (t) => {
    const subs = subtasksOf(t.id);
    return taskRow(t, { showProject: false }) +
      subs.map(s => taskRow(s, { showProject: false })).join('') +
      `<button class="link-btn" data-action="add-subtask" data-id="${t.id}" style="margin:0 0 8px 26px;display:inline-block">+ sous-tâche</button>`;
  };

  const main = `
  <div class="view-inner">
    <div class="proj-header">
      <span class="pdot" style="background:${colorVal(p.color)}"></span>
      <div style="flex:1">
        <h1>${esc(p.name)}</h1>
        <div class="proj-header-meta">
          <span class="status-chip st-${p.status}">${STATUS_LABELS[p.status]}</span>
          ${p.deadline ? `<span><i class="ti ti-flag" style="font-size:14px;vertical-align:-2px"></i> Échéance ${formatLong(parseISO(p.deadline))}</span>` : ''}
          <span><i class="ti ti-checklist" style="font-size:14px;vertical-align:-2px"></i> ${tasksOfProject(pid).filter(t=>t.done).length}/${tasksOfProject(pid).length} terminées</span>
        </div>
      </div>
      <button class="btn btn-sm" data-action="edit-project" data-id="${p.id}"><i class="ti ti-edit"></i> Modifier</button>
    </div>
    <div class="proj-progress-big"><div style="width:${prog}%;background:${colorVal(p.color)}"></div></div>

    <div class="section">
      <div class="section-head"><span class="section-title">Tâches à faire</span>
        <button class="link-btn" data-action="new-task" data-project="${p.id}">+ Ajouter une tâche</button></div>
      ${open.length ? open.map(renderTaskWithSubs).join('')
        : `<div class="empty"><i class="ti ti-circle-check"></i><div class="empty-title">Aucune tâche en cours</div></div>`}
    </div>

    ${done.length ? `<div class="section">
      <div class="section-head"><span class="section-title">Terminées (${done.length})</span></div>
      ${done.map(t => taskRow(t, { showProject:false })).join('')}
    </div>` : ''}

    <div class="section">
      <div class="section-head"><span class="section-title">Fichiers du projet</span>
        <button class="link-btn" data-action="pick-project-file" data-project="${p.id}">+ Ajouter</button></div>
      <input type="file" id="project-file-input" class="hidden" multiple />
      ${pfiles.length ? `<div class="files-grid">${pfiles.map(f => {
        const ic = fileIcon(f.type, f.name);
        return `<div class="file-card">
          <i class="ti ${ic.i} ftype" style="color:${ic.c}"></i>
          <div class="file-card-body"><div class="file-card-name">${esc(f.name)}</div><div class="file-card-meta">${bytes(f.size)}</div></div>
          <button class="btn-icon btn-ghost" data-action="open-file" data-id="${f.id}"><i class="ti ti-download"></i></button>
          <button class="btn-icon btn-ghost" data-action="del-file" data-id="${f.id}"><i class="ti ti-x"></i></button>
        </div>`;
      }).join('')}</div>`
      : `<div class="dropzone" id="project-dropzone"><i class="ti ti-paperclip"></i> Glisse des plans, présentations ou dossiers ici</div>`}
    </div>
  </div>`;

  return topbar({
    title: esc(p.name),
    sub: `${prog}% terminé`,
    actions: `<button class="btn" data-action="new-task" data-project="${p.id}"><i class="ti ti-plus"></i> Tâche</button>`,
  }) + `<div class="view">${main}</div>`;
}

function initProjectView(pid) {
  const fi = document.getElementById('project-file-input');
  if (fi) fi.addEventListener('change', e => handleFiles(e.target.files, { projectId: pid }));
  const dz = document.getElementById('project-dropzone');
  if (dz) {
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => handleFiles(e.dataTransfer.files, { projectId: pid }));
  }
}

/* ============================================================
   VUE — Planning (semaine)
   ============================================================ */
let weekOffset = 0;
function viewPlanning() {
  const base = startOfWeek(new Date());
  base.setDate(base.getDate() + weekOffset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(d.getDate()+i); days.push(d); }
  const T = todayISO();

  const cols = days.map(d => {
    const iso = isoOf(d);
    const dayTasks = sortTasks(state.tasks.filter(t => t.deadline === iso));
    const isToday = iso === T;
    return `<div class="day-col ${isToday?'today':''}">
      <div class="day-head"><div class="day-name">${JOURS_COURT[d.getDay()]}</div><div class="day-num">${d.getDate()}</div></div>
      <div class="day-tasks">
        ${dayTasks.map(t => {
          const p = projectById(t.projectId);
          const c = p ? colorVal(p.color) : 'var(--text-3)';
          return `<div class="day-task ${t.done?'done':''}" data-action="edit-task" data-id="${t.id}" style="border-left-color:${c}" title="${esc(t.title)}">${esc(t.title)}</div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  const label = `${base.getDate()} ${MOIS[base.getMonth()].slice(0,4)}. – ${days[6].getDate()} ${MOIS[days[6].getMonth()].slice(0,4)}.`;

  const main = `<div class="view-inner wide">
    <div class="section-head" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-icon btn-ghost" data-action="week-prev"><i class="ti ti-chevron-left"></i></button>
        <span style="font-size:14px;font-weight:600">${label}</span>
        <button class="btn btn-icon btn-ghost" data-action="week-next"><i class="ti ti-chevron-right"></i></button>
        ${weekOffset!==0?`<button class="btn btn-sm" data-action="week-today">Aujourd'hui</button>`:''}
      </div>
      <button class="btn btn-sm" data-action="new-task"><i class="ti ti-plus"></i> Tâche</button>
    </div>
    <div class="week-grid">${cols}</div>
  </div>`;

  return topbar({ title: 'Planning', sub: 'Vue par semaine' }) + `<div class="view">${main}</div>`;
}

/* ============================================================
   VUE — Fichiers
   ============================================================ */
function viewFiles() {
  const byProject = {};
  for (const f of state.files) {
    const key = f.projectId || (f.meetingId ? '__meeting' : '__autre');
    (byProject[key] = byProject[key] || []).push(f);
  }
  const groups = Object.entries(byProject).map(([key, files]) => {
    let label;
    if (key === '__meeting') label = 'Réunions';
    else if (key === '__autre') label = 'Autres';
    else label = projectById(key)?.name || 'Projet supprimé';
    return `<div class="section">
      <div class="section-head"><span class="section-title">${esc(label)}</span></div>
      <div class="files-grid">${files.map(f => {
        const ic = fileIcon(f.type, f.name);
        return `<div class="file-card">
          <i class="ti ${ic.i} ftype" style="color:${ic.c}"></i>
          <div class="file-card-body"><div class="file-card-name">${esc(f.name)}</div><div class="file-card-meta">${bytes(f.size)} · ${new Date(f.createdAt).toLocaleDateString('fr-FR')}</div></div>
          <button class="btn-icon btn-ghost" data-action="open-file" data-id="${f.id}"><i class="ti ti-download"></i></button>
          <button class="btn-icon btn-ghost" data-action="del-file" data-id="${f.id}"><i class="ti ti-x"></i></button>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');

  const main = `<div class="view-inner">
    ${state.files.length ? groups : `<div class="empty" style="padding-top:70px"><i class="ti ti-folder-open"></i><div class="empty-title">Aucun fichier</div><div class="empty-sub">Ajoute des plans ou dossiers depuis un projet ou une réunion.<br>Tu les retrouveras tous ici.</div></div>`}
  </div>`;

  return topbar({
    title: 'Fichiers', sub: `${state.files.length} fichier(s)`,
    actions: `<button class="btn btn-primary" data-action="pick-global-file"><i class="ti ti-upload"></i> Importer</button>`,
  }) + `<div class="view">${main}</div><input type="file" id="global-file-input" class="hidden" multiple />`;
}

/* ============================================================
   VUE — Focus du jour
   ============================================================ */
function viewFocus() {
  const focusTasks = sortTasks(state.tasks.filter(t => t.focus && !t.done));
  const doneFocus = state.tasks.filter(t => t.focus && t.done);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Ce matin' : hour < 18 ? 'Cet après-midi' : 'Ce soir';

  const candidates = sortTasks(state.tasks.filter(t => !t.done && !t.focus)).slice(0, 8);

  const main = `<div class="focus-wrap">
    <div class="focus-greeting">${greeting}, l'essentiel.</div>
    <div class="focus-sub">${focusTasks.length ? `${focusTasks.length} chose(s) à accomplir. Rien d'autre ne compte pour l'instant.` : 'Choisis 1 à 3 tâches à accomplir aujourd\'hui.'}</div>

    ${focusTasks.map(t => {
      const p = projectById(t.projectId);
      const due = formatDue(t.deadline);
      return `<div class="focus-task ${t.done?'done':''}">
        <button class="check ${t.done?'done':''}" data-action="toggle-task" data-id="${t.id}"><i class="ti ti-check"></i></button>
        <div class="focus-task-body">
          <div class="focus-task-title">${esc(t.title)}</div>
          <div class="focus-task-meta">
            <span class="pill pill-${t.priority}">${t.priority[0].toUpperCase()+t.priority.slice(1)}</span>
            ${p?`<span class="task-proj"><span class="dot" style="background:${colorVal(p.color)}"></span>${esc(p.name)}</span>`:''}
            ${t.deadline?`<span class="due ${due.cls}">${due.label}</span>`:''}
          </div>
        </div>
        <button class="btn-icon btn-ghost" data-action="unfocus" data-id="${t.id}" title="Retirer du focus"><i class="ti ti-x"></i></button>
      </div>`;
    }).join('')}

    ${doneFocus.length ? `<div style="margin-top:6px;font-size:13px;color:var(--text-3)">${doneFocus.length} déjà fait(s) aujourd'hui ✓</div>` : ''}

    ${focusTasks.length < 3 ? `<div class="focus-add">
      <div class="side-section-title" style="margin-top:24px">Ajouter au focus</div>
      ${candidates.length ? candidates.map(t => {
        const p = projectById(t.projectId);
        return `<div class="task" data-action="focus" data-id="${t.id}" style="cursor:pointer">
          <i class="ti ti-plus" style="color:var(--text-3)"></i>
          <span class="task-title">${esc(t.title)}</span>
          <div class="task-meta">${p?`<span class="task-proj"><span class="dot" style="background:${colorVal(p.color)}"></span>${esc(p.name)}</span>`:''}<span class="pill pill-${t.priority}">${t.priority[0].toUpperCase()+t.priority.slice(1)}</span></div>
        </div>`;
      }).join('') : `<div style="font-size:12.5px;color:var(--text-3)">Plus aucune tâche en attente. 🎉</div>`}
    </div>` : ''}
  </div>`;

  return topbar({ title: 'Focus du jour', sub: formatLong(now) }) + `<div class="view">${main}</div>`;
}

/* ============================================================
   Gestion des fichiers (lecture → IndexedDB)
   ============================================================ */
async function handleFiles(fileList, { projectId = null, meetingId = null }) {
  const arr = Array.from(fileList || []);
  for (const file of arr) {
    if (file.size > 25 * 1048576) { toast(`« ${file.name} » dépasse 25 Mo`, 'ti-alert-triangle'); continue; }
    const buf = await file.arrayBuffer();
    await saveFile({
      id: uid('f'), name: file.name, type: file.type, size: file.size,
      blob: buf, projectId, meetingId, createdAt: Date.now(),
    });
  }
  if (arr.length) { toast(`${arr.length} fichier(s) ajouté(s)`, 'ti-check'); renderRoute(); }
}
function openFile(id) {
  const f = state.files.find(x => x.id === id); if (!f) return;
  const blob = new Blob([f.blob], { type: f.type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = f.name; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ============================================================
   Modales
   ============================================================ */
const overlay = () => document.getElementById('overlay');
function openModal(html) {
  const o = overlay();
  o.innerHTML = `<div class="modal">${html}</div>`;
  o.classList.add('open');
  const first = o.querySelector('input, textarea, select');
  if (first) setTimeout(() => first.focus(), 60);
}
function closeModal() { const o = overlay(); o.classList.remove('open'); setTimeout(()=>o.innerHTML='', 150); }

function projectOptions(selected) {
  return `<option value="">— Sans projet</option>` + state.projects.map(p =>
    `<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');
}

let modalCtx = {};
function taskModal(task = null, presets = {}) {
  const isEdit = !!task;
  modalCtx = { taskId: task?.id || null, priority: task?.priority || 'normale', parentId: task?.parentId || presets.parentId || null, fromMeetingId: task?.fromMeetingId || presets.fromMeetingId || null };
  const t = task || {};
  openModal(`
    <div class="modal-head"><span class="modal-title">${isEdit?'Modifier la tâche':'Nouvelle tâche'}</span>
      <button class="btn-icon btn-ghost" data-action="close-modal"><i class="ti ti-x"></i></button></div>
    <div class="modal-body">
      <div class="field"><label>Intitulé</label>
        <textarea class="input" id="t-title" placeholder="Que faut-il faire ?">${esc(t.title||presets.title||'')}</textarea></div>
      <div class="field"><label>Priorité</label>
        <div class="seg" id="t-prio">
          <button class="haute ${modalCtx.priority==='haute'?'active':''}" data-prio="haute">Haute</button>
          <button class="normale ${modalCtx.priority==='normale'?'active':''}" data-prio="normale">Normale</button>
          <button class="basse ${modalCtx.priority==='basse'?'active':''}" data-prio="basse">Basse</button>
        </div></div>
      <div class="field"><label>Échéance</label>
        <input type="date" class="input" id="t-date" value="${t.deadline||presets.deadline||''}" /></div>
      ${modalCtx.parentId ? '' : `<div class="field"><label>Projet</label>
        <select class="select" id="t-project">${projectOptions(t.projectId ?? presets.projectId)}</select></div>`}
    </div>
    <div class="modal-foot">
      ${isEdit?`<button class="btn btn-danger" data-action="delete-task-modal" data-id="${t.id}" style="margin-right:auto"><i class="ti ti-trash"></i> Supprimer</button>`:''}
      <button class="btn" data-action="close-modal">Annuler</button>
      <button class="btn btn-primary" data-action="save-task-modal">${isEdit?'Enregistrer':'Ajouter'}</button>
    </div>`);

  document.querySelectorAll('#t-prio button').forEach(b => b.addEventListener('click', () => {
    modalCtx.priority = b.dataset.prio;
    document.querySelectorAll('#t-prio button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }));
  const ta = document.getElementById('t-title');
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveTaskFromModal(); } });
}

async function saveTaskFromModal() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) { document.getElementById('t-title').focus(); return; }
  const deadline = document.getElementById('t-date').value || null;
  const projSel = document.getElementById('t-project');
  const existing = modalCtx.taskId ? state.tasks.find(t => t.id === modalCtx.taskId) : null;

  const task = existing || {
    id: uid('t'), done: false, focus: false, createdAt: Date.now(),
    parentId: modalCtx.parentId, fromMeetingId: modalCtx.fromMeetingId,
  };
  task.title = title;
  task.priority = modalCtx.priority;
  task.deadline = deadline;
  if (projSel) task.projectId = projSel.value || null;
  else if (task.parentId) { const parent = state.tasks.find(t => t.id === task.parentId); task.projectId = parent?.projectId || null; }

  await saveTask(task);
  closeModal();

  // Si la tâche vient d'une réunion (nouvelle création), on marque la sélection
  if (!existing && modalCtx.fromMeetingId && savedRange) {
    markSelectionAsTask(task.id);
    savedRange = null;
  }
  renderRoute();
  toast(existing ? 'Tâche mise à jour' : 'Tâche ajoutée', 'ti-check');
}

let projModalCtx = {};
function projectModal(project = null) {
  const isEdit = !!project;
  const p = project || {};
  projModalCtx = { id: p.id || null, color: p.color || 'blue', status: p.status || 'encours' };
  openModal(`
    <div class="modal-head"><span class="modal-title">${isEdit?'Modifier le projet':'Nouveau projet'}</span>
      <button class="btn-icon btn-ghost" data-action="close-modal"><i class="ti ti-x"></i></button></div>
    <div class="modal-body">
      <div class="field"><label>Nom du projet</label>
        <input class="input" id="p-name" value="${esc(p.name||'')}" placeholder="Ex : Partenariat CAF" /></div>
      <div class="field"><label>Couleur</label>
        <div class="color-picker" id="p-color">
          ${PROJECT_COLORS.map(c => `<span class="color-dot ${projModalCtx.color===c.key?'active':''}" data-color="${c.key}" style="background:${c.val}"></span>`).join('')}
        </div></div>
      <div class="field"><label>Statut</label>
        <select class="select" id="p-status">
          ${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${projModalCtx.status===k?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="field"><label>Échéance (optionnel)</label>
        <input type="date" class="input" id="p-date" value="${p.deadline||''}" /></div>
    </div>
    <div class="modal-foot">
      ${isEdit?`<button class="btn btn-danger" data-action="delete-project-modal" data-id="${p.id}" style="margin-right:auto"><i class="ti ti-trash"></i> Supprimer</button>`:''}
      <button class="btn" data-action="close-modal">Annuler</button>
      <button class="btn btn-primary" data-action="save-project-modal">${isEdit?'Enregistrer':'Créer'}</button>
    </div>`);
  document.querySelectorAll('#p-color .color-dot').forEach(d => d.addEventListener('click', () => {
    projModalCtx.color = d.dataset.color;
    document.querySelectorAll('#p-color .color-dot').forEach(x => x.classList.remove('active'));
    d.classList.add('active');
  }));
}
async function saveProjectFromModal() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) { document.getElementById('p-name').focus(); return; }
  const existing = projModalCtx.id ? state.projects.find(p => p.id === projModalCtx.id) : null;
  const proj = existing || { id: uid('p'), createdAt: Date.now() };
  proj.name = name;
  proj.color = projModalCtx.color;
  proj.status = document.getElementById('p-status').value;
  proj.deadline = document.getElementById('p-date').value || null;
  await saveProject(proj);
  closeModal();
  if (!existing) navigate('project/' + proj.id); else renderRoute();
  renderShell();
  toast(existing ? 'Projet mis à jour' : 'Projet créé', 'ti-check');
}

function settingsModal() {
  const totalFiles = state.files.reduce((s,f) => s + (f.size||0), 0);
  openModal(`
    <div class="modal-head"><span class="modal-title">Paramètres & données</span>
      <button class="btn-icon btn-ghost" data-action="close-modal"><i class="ti ti-x"></i></button></div>
    <div class="modal-body">
      <div style="font-size:12.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px">
        Tes données sont stockées <strong>localement sur cet appareil</strong> et fonctionnent hors ligne.
        ${state.projects.length} projet(s), ${state.tasks.length} tâche(s), ${state.meetings.length} réunion(s), ${state.files.length} fichier(s) (${bytes(totalFiles)}).
      </div>
      <div class="field"><button class="btn" style="width:100%;justify-content:center" data-action="export-data"><i class="ti ti-download"></i> Exporter une sauvegarde (.json)</button></div>
      <div class="field"><button class="btn" style="width:100%;justify-content:center" data-action="import-data"><i class="ti ti-upload"></i> Importer une sauvegarde</button>
        <input type="file" id="import-input" accept="application/json" class="hidden" /></div>
      <div class="field"><button class="btn btn-danger" style="width:100%;justify-content:center" data-action="reset-data"><i class="ti ti-trash"></i> Tout réinitialiser</button></div>
    </div>`);
}

/* Export / import / reset */
async function exportData() {
  const data = { projects: state.projects, tasks: state.tasks, meetings: state.meetings,
    files: state.files.map(f => ({ ...f, blob: arrBufToB64(f.blob) })), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pilote-sauvegarde-${todayISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Sauvegarde exportée', 'ti-check');
}
function arrBufToB64(buf) {
  if (!buf) return null;
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToArrBuf(b64) {
  if (!b64) return null;
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    for (const s of ['projects','tasks','meetings','files']) await DB.clear(s);
    for (const p of data.projects||[]) await DB.put('projects', p);
    for (const t of data.tasks||[]) await DB.put('tasks', t);
    for (const m of data.meetings||[]) await DB.put('meetings', m);
    for (const f of data.files||[]) await DB.put('files', { ...f, blob: b64ToArrBuf(f.blob) });
    await loadState();
    closeModal(); renderShell(); renderRoute();
    toast('Sauvegarde importée', 'ti-check');
  } catch (e) { toast('Fichier invalide', 'ti-alert-triangle'); }
}
async function resetData() {
  if (!confirm('Supprimer définitivement toutes les données ? Cette action est irréversible.')) return;
  for (const s of ['projects','tasks','meetings','files','meta']) await DB.clear(s);
  await seedIfEmpty(); await loadState();
  closeModal(); renderShell(); navigate('dashboard'); renderRoute();
  toast('Données réinitialisées', 'ti-check');
}

/* ============================================================
   Toast
   ============================================================ */
function toast(msg, icon = 'ti-check') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i class="ti ${icon}"></i> ${esc(msg)}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2400);
}

/* ============================================================
   Rendu principal + délégation d'événements
   ============================================================ */
function renderShell() {
  document.getElementById('sidebar').innerHTML = renderSidebar();
}
function renderRoute() {
  const r = state.route;
  const main = document.getElementById('main');
  let html = '';
  if (r.name === 'dashboard') html = viewDashboard();
  else if (r.name === 'meeting') html = viewMeeting(r.param);
  else if (r.name === 'project') html = viewProject(r.param);
  else if (r.name === 'planning') html = viewPlanning();
  else if (r.name === 'files') html = viewFiles();
  else if (r.name === 'focus') html = viewFocus();
  else html = viewDashboard();
  main.innerHTML = html;
  renderShell();

  // Initialisations spécifiques
  if (r.name === 'meeting') initSandbox();
  if (r.name === 'project') initProjectView(r.param);

  // Fermer menu mobile
  document.getElementById('sidebar')?.classList.remove('open');
  document.querySelector('.scrim')?.classList.remove('open');
}

/* Délégation globale des clics */
document.addEventListener('click', async (e) => {
  const navEl = e.target.closest('[data-nav]');
  if (navEl) { navigate(navEl.dataset.nav); return; }

  const actEl = e.target.closest('[data-action]');
  if (!actEl) return;
  const action = actEl.dataset.action;
  const id = actEl.dataset.id;

  switch (action) {
    case 'toggle-menu': document.getElementById('sidebar').classList.toggle('open'); document.querySelector('.scrim')?.classList.toggle('open'); break;
    case 'new-task': taskModal(null, { projectId: actEl.dataset.project || null, deadline: state.route.name==='planning'?todayISO():'' }); break;
    case 'edit-task': { const t = state.tasks.find(x=>x.id===id); if (t) taskModal(t); break; }
    case 'toggle-task': await toggleTask(id); break;
    case 'add-subtask': taskModal(null, { parentId: id }); break;
    case 'save-task-modal': await saveTaskFromModal(); break;
    case 'delete-task-modal': await removeTask(id); closeModal(); renderRoute(); toast('Tâche supprimée','ti-trash'); break;
    case 'new-project': projectModal(); break;
    case 'edit-project': { const p = projectById(id); if (p) projectModal(p); break; }
    case 'save-project-modal': await saveProjectFromModal(); break;
    case 'delete-project-modal': if (confirm('Supprimer ce projet et toutes ses tâches ?')) { await removeProject(id); closeModal(); navigate('dashboard'); renderShell(); renderRoute(); toast('Projet supprimé','ti-trash'); } break;
    case 'new-meeting': { const m = { id: uid('m'), title: 'Nouvelle réunion', date: todayISO(), attendees: '', content: '', createdAt: Date.now() }; await saveMeeting(m); navigate('meeting/'+m.id); break; }
    case 'del-meeting': if (confirm('Supprimer cette note de réunion ? (les tâches créées sont conservées)')) { await removeMeeting(id); navigate('meeting'); toast('Réunion supprimée','ti-trash'); } break;
    case 'pick-meeting-file': document.getElementById('meeting-file-input')?.click(); break;
    case 'pick-project-file': document.getElementById('project-file-input')?.click(); break;
    case 'pick-global-file': document.getElementById('global-file-input')?.click(); break;
    case 'open-file': openFile(id); break;
    case 'del-file': if (confirm('Supprimer ce fichier ?')) { await removeFile(id); renderRoute(); toast('Fichier supprimé','ti-trash'); } break;
    case 'sel-to-task': {
      const sel = window.getSelection();
      const live = sel ? sel.toString().trim() : '';
      const text = live || (savedRange ? savedRange.toString().trim() : '');
      taskModal(null, { title: text, fromMeetingId: currentMeetingId });
      break;
    }
    case 'sel-bold': document.execCommand('bold'); document.getElementById('sel-toolbar').style.display='none'; break;
    case 'sel-highlight': document.execCommand('hiliteColor', false, '#fff3b0'); document.getElementById('sel-toolbar').style.display='none'; break;
    case 'focus': { const t = state.tasks.find(x=>x.id===id); if (t){ t.focus=true; await saveTask(t); renderRoute(); } break; }
    case 'unfocus': { const t = state.tasks.find(x=>x.id===id); if (t){ t.focus=false; await saveTask(t); renderRoute(); } break; }
    case 'week-prev': weekOffset--; renderRoute(); break;
    case 'week-next': weekOffset++; renderRoute(); break;
    case 'week-today': weekOffset=0; renderRoute(); break;
    case 'settings': settingsModal(); break;
    case 'export-data': await exportData(); break;
    case 'import-data': document.getElementById('import-input')?.click(); break;
    case 'reset-data': await resetData(); break;
    case 'close-modal': closeModal(); break;
  }
});

/* Fermer modale au clic sur le fond */
document.addEventListener('mousedown', (e) => {
  const o = overlay();
  if (o && o.classList.contains('open') && e.target === o) closeModal();
});
/* Échap ferme la modale */
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const o = overlay(); if (o?.classList.contains('open')) closeModal(); } });

/* Changements sur inputs file globaux (délégué) */
document.addEventListener('change', (e) => {
  if (e.target.id === 'global-file-input') handleFiles(e.target.files, {});
  if (e.target.id === 'import-input' && e.target.files[0]) importData(e.target.files[0]);
});

/* ============================================================
   Démarrage
   ============================================================ */
async function init() {
  await seedIfEmpty();
  await loadState();
  state.route = parseHash();
  if (!location.hash) location.hash = '#/dashboard';
  renderShell();
  renderRoute();

  // Service worker (PWA)
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch {}
  }
}
init();
