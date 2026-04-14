// ============================================================================
// PeptideRx — Main Application
// ============================================================================
// Wrapper that converts HTML attributes to React props (class→className, stroke-width→strokeWidth, etc.)
function h(type, props) {
  if (props) {
    if (props['class'] !== undefined) { props.className = props['class']; delete props['class']; }
    if (props['for'] !== undefined) { props.htmlFor = props['for']; delete props['for']; }
    if (props['stroke-width'] !== undefined) { props.strokeWidth = props['stroke-width']; delete props['stroke-width']; }
    if (props['stroke-linecap'] !== undefined) { props.strokeLinecap = props['stroke-linecap']; delete props['stroke-linecap']; }
    if (props['stroke-linejoin'] !== undefined) { props.strokeLinejoin = props['stroke-linejoin']; delete props['stroke-linejoin']; }
    if (props['stroke-dasharray'] !== undefined) { props.strokeDasharray = props['stroke-dasharray']; delete props['stroke-dasharray']; }
    if (props['stroke-dashoffset'] !== undefined) { props.strokeDashoffset = props['stroke-dashoffset']; delete props['stroke-dashoffset']; }
    if (props['fill-rule'] !== undefined) { props.fillRule = props['fill-rule']; delete props['fill-rule']; }
    if (props['clip-rule'] !== undefined) { props.clipRule = props['clip-rule']; delete props['clip-rule']; }
    if (props['stop-color'] !== undefined) { props.stopColor = props['stop-color']; delete props['stop-color']; }
    if (props['stop-opacity'] !== undefined) { props.stopOpacity = props['stop-opacity']; delete props['stop-opacity']; }
  }
  var args = [type, props];
  for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
  return React.createElement.apply(React, args);
}
var html = htm.bind(h);
var useState = React.useState;
var useEffect = React.useEffect;
var useCallback = React.useCallback;
var useMemo = React.useMemo;
var useRef = React.useRef;
var useContext = React.useContext;
var createContext = React.createContext;
var memo = React.memo;

var RC = Recharts;

// ============================================================================
// UTILITIES
// ============================================================================
function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getNow() {
  var d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function daysBetween(date1, date2) {
  var d1 = new Date(date1 + 'T00:00:00');
  var d2 = new Date(date2 + 'T00:00:00');
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getGreeting() {
  var h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMonthDays(year, month) {
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var daysInPrev = new Date(year, month, 0).getDate();
  var days = [];
  for (var i = firstDay - 1; i >= 0; i--) {
    var d = daysInPrev - i;
    var m = month === 0 ? 11 : month - 1;
    var y = month === 0 ? year - 1 : year;
    days.push({ date: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), isCurrentMonth: false });
  }
  for (var i = 1; i <= daysInMonth; i++) {
    days.push({ date: year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0'), isCurrentMonth: true });
  }
  while (days.length < 42) {
    var extra = days.length - firstDay - daysInMonth + 1;
    var m = month === 11 ? 0 : month + 1;
    var y = month === 11 ? year + 1 : year;
    days.push({ date: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(extra).padStart(2, '0'), isCurrentMonth: false });
  }
  return days;
}

function calcCompliance(injections, protocol, days) {
  if (!protocol || protocol.length === 0) return 0;
  var today = getToday();
  var startDate = new Date(today + 'T00:00:00');
  startDate.setDate(startDate.getDate() - (days - 1));
  var startStr = startDate.toISOString().split('T')[0];

  var totalExpected = 0;
  var totalDone = 0;

  protocol.filter(function(p) { return p.active && p.phase === 1; }).forEach(function(p) {
    var expected = 0;
    if (p.frequency === 'daily') expected = days;
    else if (p.frequency === 'weekly') expected = Math.ceil(days / 7);
    else if (p.frequency === 'eod') expected = Math.ceil(days / 2);
    else expected = days;

    var done = injections.filter(function(inj) {
      return inj.peptideId === p.peptideId && inj.date >= startStr && inj.date <= today;
    }).length;

    totalExpected += expected;
    totalDone += Math.min(done, expected);
  });

  return totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
}

function calcStreak(injections, protocol) {
  if (!injections.length || !protocol.length) return { current: 0, best: 0 };
  var today = getToday();
  var dailyPeptides = protocol.filter(function(p) { return p.active && p.phase === 1 && p.frequency === 'daily'; });
  if (dailyPeptides.length === 0) return { current: 0, best: 0 };

  var current = 0;
  var best = 0;
  var d = new Date(today + 'T00:00:00');

  for (var i = 0; i < 365; i++) {
    var dateStr = d.toISOString().split('T')[0];
    var allDone = dailyPeptides.every(function(p) {
      return injections.some(function(inj) { return inj.peptideId === p.peptideId && inj.date === dateStr; });
    });
    if (allDone) {
      current++;
      best = Math.max(best, current);
    } else {
      if (i > 0) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return { current: current, best: best };
}

function getMotivationalMessage(days) {
  if (days === 0) return "Ready to start your transformation!";
  if (days < 7) return "Great start! The first week is all about building the habit.";
  if (days < 14) return "One week down! Your body is beginning to adapt.";
  if (days < 30) return "Two weeks in! Consistency is your superpower.";
  if (days < 60) return "A full month! Real changes are happening beneath the surface.";
  if (days < 90) return "Two months strong! You're in the transformation zone.";
  return "Over 90 days! You're a protocol veteran. Keep pushing.";
}

// ============================================================================
// STORAGE HOOK
// ============================================================================
// Storage: read/write using window.storage API if available, else localStorage
function storageGet(key) {
  try {
    if (window.storage && typeof window.storage.get === 'function') {
      var result = window.storage.get(key);
      if (result && typeof result.then === 'function') return result;
      return result;
    }
    return localStorage.getItem(key);
  } catch(e) { return null; }
}

function storageSet(key, value) {
  try {
    if (window.storage && typeof window.storage.set === 'function') {
      window.storage.set(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  } catch(e) {}
}

function readStorageSync(key, defaultValue) {
  try {
    var raw = storageGet(key);
    if (raw && typeof raw === 'string') return JSON.parse(raw);
    if (raw && typeof raw.then === 'function') return defaultValue; // async, handle later
  } catch(e) {}
  return defaultValue;
}

function useStorage(key, defaultValue) {
  var stateArr = useState(function() { return readStorageSync(key, defaultValue); });
  var data = stateArr[0];
  var setData = stateArr[1];
  var loadedArr = useState(function() {
    var raw = storageGet(key);
    return !(raw && typeof raw.then === 'function'); // loaded if sync
  });
  var loaded = loadedArr[0];
  var setLoaded = loadedArr[1];

  useEffect(function() {
    // Handle async storage (window.storage API)
    var raw = storageGet(key);
    if (raw && typeof raw.then === 'function') {
      raw.then(function(val) {
        if (val) { try { setData(JSON.parse(val)); } catch(e) {} }
        setLoaded(true);
      }).catch(function() { setLoaded(true); });
    }
  }, [key]);

  var save = useCallback(function(newValue) {
    var val = typeof newValue === 'function' ? newValue(data) : newValue;
    setData(val);
    storageSet(key, JSON.stringify(val));
  }, [key, data]);

  return [data, save, loaded];
}

// ============================================================================
// APP CONTEXT
// ============================================================================
var AppContext = createContext(null);

function AppProvider(props) {
  var settingsArr = useStorage('peptiderx_settings', {
    userName: '', startDate: '', goals: [], weight: '', height: '', goalWeight: '', targetBF: '',
    proteinGoal: 150, waterGoal: 100, onboardingComplete: false
  });
  var settings = settingsArr[0];
  var saveSettings = settingsArr[1];
  var settingsLoaded = settingsArr[2];

  var protocolArr = useStorage('peptiderx_protocol', []);
  var protocol = protocolArr[0];
  var saveProtocol = protocolArr[1];
  var protocolLoaded = protocolArr[2];

  var injectionsArr = useStorage('peptiderx_injections', []);
  var injections = injectionsArr[0];
  var saveInjections = injectionsArr[1];
  var injectionsLoaded = injectionsArr[2];

  var checkInsArr = useStorage('peptiderx_checkins', []);
  var checkIns = checkInsArr[0];
  var saveCheckIns = checkInsArr[1];
  var checkInsLoaded = checkInsArr[2];

  var dailyArr = useStorage('peptiderx_daily', {});
  var daily = dailyArr[0];
  var saveDaily = dailyArr[1];
  var dailyLoaded = dailyArr[2];

  var isLoaded = settingsLoaded && protocolLoaded && injectionsLoaded && checkInsLoaded && dailyLoaded;

  var addInjection = useCallback(function(entry) {
    saveInjections(function(prev) { return [entry].concat(prev); });
  }, [saveInjections]);

  var deleteInjection = useCallback(function(id) {
    saveInjections(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
  }, [saveInjections]);

  var addCheckIn = useCallback(function(entry) {
    saveCheckIns(function(prev) {
      var filtered = prev.filter(function(e) { return e.date !== entry.date; });
      return [entry].concat(filtered);
    });
  }, [saveCheckIns]);

  var updateDaily = useCallback(function(date, updates) {
    saveDaily(function(prev) {
      var existing = prev[date] || { proteinGrams: 0, waterOz: 0, completedPeptides: [] };
      var newEntry = Object.assign({}, existing, updates);
      var newDaily = Object.assign({}, prev);
      newDaily[date] = newEntry;
      return newDaily;
    });
  }, [saveDaily]);

  var togglePeptideComplete = useCallback(function(date, peptideId) {
    saveDaily(function(prev) {
      var existing = prev[date] || { proteinGrams: 0, waterOz: 0, completedPeptides: [] };
      var completed = existing.completedPeptides || [];
      var isComplete = completed.indexOf(peptideId) !== -1;
      var newCompleted = isComplete
        ? completed.filter(function(id) { return id !== peptideId; })
        : completed.concat([peptideId]);
      var newDaily = Object.assign({}, prev);
      newDaily[date] = Object.assign({}, existing, { completedPeptides: newCompleted });
      return newDaily;
    });
  }, [saveDaily]);

  var updateProtocolItem = useCallback(function(id, updates) {
    saveProtocol(function(prev) {
      return prev.map(function(p) {
        return p.id === id ? Object.assign({}, p, updates) : p;
      });
    });
  }, [saveProtocol]);

  var value = {
    settings: settings, saveSettings: saveSettings,
    protocol: protocol, saveProtocol: saveProtocol, updateProtocolItem: updateProtocolItem,
    injections: injections, addInjection: addInjection, deleteInjection: deleteInjection, saveInjections: saveInjections,
    checkIns: checkIns, addCheckIn: addCheckIn,
    daily: daily, updateDaily: updateDaily, togglePeptideComplete: togglePeptideComplete,
    isLoaded: isLoaded,
  };

  return html`<${AppContext.Provider} value=${value}>${props.children}<//>`;
}

function useApp() { return useContext(AppContext); }

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
function Card(props) {
  var cn = 'glass rounded-2xl p-4 ' + (props.className || '');
  return html`<div class=${cn} onClick=${props.onClick} style=${props.style}>${props.children}</div>`;
}

function Button(props) {
  var base = 'font-semibold rounded-xl transition-all duration-200 active:scale-[0.97] min-h-[44px] flex items-center justify-center gap-2 ';
  var variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white px-6 py-3',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3',
    ghost: 'bg-transparent text-slate-400 hover:text-white px-4 py-2',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 px-6 py-3',
    success: 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-6 py-3',
    small: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 text-sm rounded-lg min-h-[36px]',
  };
  var v = props.variant || 'primary';
  var cn = base + (variants[v] || variants.primary) + ' ' + (props.className || '');
  var isDisabled = props.disabled;
  return html`<button class=${cn + (isDisabled ? ' opacity-50 pointer-events-none' : '')} onClick=${props.onClick} disabled=${isDisabled} type=${props.type || 'button'}>${props.children}</button>`;
}

function Badge(props) {
  var colors = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    slate: 'bg-slate-700/50 text-slate-300 border-slate-600/30',
  };
  var c = colors[props.color || 'blue'] || colors.blue;
  return html`<span class=${'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ' + c}>${props.children}</span>`;
}

function Modal(props) {
  if (!props.open) return null;

  var hasAction = !!props.action;

  return html`
    <div class="fixed inset-0 z-[100] fade-in" onClick=${function(e) { if (e.target === e.currentTarget) props.onClose && props.onClose(); }}>
      <div class="absolute inset-0 bg-black/70" onClick=${props.onClose} />
      <div class="absolute bottom-0 left-0 right-0 bg-navy-50 rounded-t-3xl slide-up safe-bottom"
        style=${{ maxHeight: '80vh' }}>
        <div class="flex items-center justify-between p-4 border-b border-slate-800/50">
          <h3 class="text-lg font-bold text-white">${props.title}</h3>
          <button class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400" onClick=${props.onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="overflow-y-scroll p-4" style=${{ maxHeight: hasAction ? 'calc(80vh - 130px)' : 'calc(80vh - 60px)', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div class="space-y-3">
            ${props.children}
          </div>
        </div>
        ${hasAction && html`
          <div class="p-4 pt-2 border-t border-slate-800/50">
            ${props.action}
          </div>
        `}
      </div>
    </div>
  `;
}

function ProgressRing(props) {
  var size = props.size || 80;
  var stroke = props.stroke || 6;
  var pct = Math.min(100, Math.max(0, props.value || 0));
  var r = (size - stroke) / 2;
  var circ = 2 * Math.PI * r;
  var offset = circ - (pct / 100) * circ;
  var color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct >= 25 ? '#f59e0b' : '#ef4444';
  return html`
    <div class="relative inline-flex items-center justify-center" style=${{ width: size, height: size }}>
      <svg width=${size} height=${size} class="transform -rotate-90">
        <circle cx=${size/2} cy=${size/2} r=${r} fill="none" stroke="#1e293b" stroke-width=${stroke} />
        <circle cx=${size/2} cy=${size/2} r=${r} fill="none" stroke=${props.color || color}
          stroke-width=${stroke} stroke-dasharray=${circ} stroke-dashoffset=${offset}
          stroke-linecap="round" style=${{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div class="absolute text-center">
        <div class="text-lg font-bold" style=${{ color: props.color || color }}>${pct}%</div>
        ${props.label && html`<div class="text-[10px] text-slate-500">${props.label}</div>`}
      </div>
    </div>
  `;
}

function StatCard(props) {
  return html`
    <${Card} className="text-center flex-1 min-w-0">
      <div class="text-xs text-slate-500 mb-1 truncate">${props.label}</div>
      <div class="text-xl font-bold text-white">${props.value}</div>
      ${props.unit && html`<div class="text-xs text-slate-500">${props.unit}</div>`}
    <//>
  `;
}

function EmptyState(props) {
  return html`
    <div class="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div class="text-4xl mb-4">${props.icon || '📋'}</div>
      <div class="text-lg font-semibold text-slate-300 mb-2">${props.title}</div>
      <div class="text-sm text-slate-500 mb-6 max-w-xs">${props.description}</div>
      ${props.action && html`<${Button} variant="primary" onClick=${props.action.onClick}>${props.action.label}<//>`}
    </div>
  `;
}

function SearchInput(props) {
  return html`
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
        placeholder=${props.placeholder || 'Search...'} value=${props.value} onInput=${function(e) { props.onChange(e.target.value); }} />
    </div>
  `;
}

function FilterChips(props) {
  return html`
    <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style=${{ WebkitOverflowScrolling: 'touch' }}>
      ${props.options.map(function(opt) {
        var isActive = props.value === opt.id;
        return html`
          <button key=${opt.id} onClick=${function() { props.onChange(opt.id); }}
            class=${'whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border ' +
              (isActive ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-slate-800/40 text-slate-400 border-slate-700/40')}>
            ${opt.label}
          </button>
        `;
      })}
    </div>
  `;
}

function FormField(props) {
  return html`
    <div class=${'mb-4 ' + (props.className || '')}>
      ${props.label && html`<label class="block text-sm font-medium text-slate-400 mb-1.5">${props.label}</label>`}
      ${props.children}
    </div>
  `;
}

function TextInput(props) {
  return html`<input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
    type=${props.type || 'text'} value=${props.value} placeholder=${props.placeholder}
    inputMode=${props.inputMode} min=${props.min} max=${props.max} step=${props.step}
    onInput=${function(e) { props.onChange(e.target.value); }} />`;
}

function SelectInput(props) {
  return html`<select class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 appearance-none"
    value=${props.value} onChange=${function(e) { props.onChange(e.target.value); }}>
    ${props.options.map(function(opt) { return html`<option key=${opt.value} value=${opt.value}>${opt.label}</option>`; })}
  </select>`;
}

function RatingInput(props) {
  var max = props.max || 10;
  var val = props.value || 0;
  return html`
    <div class="flex gap-1.5 flex-wrap">
      ${Array.from({ length: max }, function(_, i) {
        var n = i + 1;
        var isActive = n <= val;
        var color = n <= 3 ? 'bg-red-500' : n <= 6 ? 'bg-amber-500' : 'bg-emerald-500';
        return html`
          <button key=${n} onClick=${function() { props.onChange(n); }}
            class=${'w-8 h-8 rounded-lg text-xs font-bold transition-all ' + (isActive ? color + ' text-white' : 'bg-slate-800 text-slate-500')}>
            ${n}
          </button>
        `;
      })}
    </div>
  `;
}

// ============================================================================
// ICONS (inline SVGs)
// ============================================================================
function IconDashboard(props) {
  return html`<svg width=${props.size || 22} height=${props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>`;
}
function IconCalendar(props) {
  return html`<svg width=${props.size || 22} height=${props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>`;
}
function IconChart(props) {
  return html`<svg width=${props.size || 22} height=${props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
  </svg>`;
}
function IconFlask(props) {
  return html`<svg width=${props.size || 22} height=${props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 3h6M10 3v7.4L4.2 19.2A1.5 1.5 0 0 0 5.4 21h13.2a1.5 1.5 0 0 0 1.2-1.8L14 10.4V3"/>
    <path d="M8.5 14h7"/>
  </svg>`;
}
function IconBook(props) {
  return html`<svg width=${props.size || 22} height=${props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>`;
}
function IconSettings(props) {
  return html`<svg width=${props.size || 22} height=${props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;
}
function IconPlus(props) {
  return html`<svg width=${props.size || 20} height=${props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
function IconCheck(props) {
  return html`<svg width=${props.size || 18} height=${props.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`;
}
function IconChevron(props) {
  var dir = props.direction || 'right';
  var r = dir === 'left' ? 180 : dir === 'up' ? -90 : dir === 'down' ? 90 : 0;
  return html`<svg width=${props.size || 20} height=${props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style=${{ transform: 'rotate(' + r + 'deg)' }}><polyline points="9,18 15,12 9,6"/></svg>`;
}
function IconSyringe() {
  return html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 5 5"/>
  </svg>`;
}

// ============================================================================
// ONBOARDING
// ============================================================================
function OnboardingFlow() {
  var ctx = useApp();
  var stepArr = useState(0);
  var step = stepArr[0];
  var setStep = stepArr[1];

  var formArr = useState({
    name: '', weight: '', height: '', goalWeight: '', startDate: getToday(), goals: ['fat_loss', 'recovery']
  });
  var form = formArr[0];
  var setForm = formArr[1];

  function updateForm(key, val) {
    setForm(function(prev) {
      var n = Object.assign({}, prev);
      n[key] = val;
      return n;
    });
  }

  function complete() {
    ctx.saveSettings({
      userName: form.name, startDate: form.startDate, goals: form.goals,
      weight: parseFloat(form.weight) || 0, height: parseFloat(form.height) || 0,
      goalWeight: parseFloat(form.goalWeight) || 0, targetBF: 12,
      proteinGoal: 150, waterGoal: 100, onboardingComplete: true
    });
    ctx.saveProtocol(window.DEFAULT_PROTOCOL);
  }

  // Step 0: Welcome
  if (step === 0) {
    return html`
      <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div class="mb-8">
          <div class="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6 glow-pulse">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5">
              <path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 5 5"/>
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-white mb-2">PeptideRx</h1>
          <p class="text-slate-400 text-lg">Your personal peptide protocol tracker</p>
        </div>
        <p class="text-slate-500 mb-8 max-w-xs">Track injections, monitor progress, and optimize your peptide protocol — all from your phone.</p>
        <${Button} onClick=${function() { setStep(1); }} className="w-full max-w-xs">Get Started<//>
      </div>
    `;
  }

  // Step 1: Personal Info
  if (step === 1) {
    return html`
      <div class="min-h-screen p-6 safe-top">
        <div class="mb-8">
          <div class="flex gap-1.5 mb-6">
            ${[0,1,2].map(function(i) { return html`<div key=${i} class=${'h-1 flex-1 rounded-full ' + (i <= 1 ? 'bg-blue-500' : 'bg-slate-700')} />`; })}
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">About You</h2>
          <p class="text-slate-400">Let's personalize your experience</p>
        </div>

        <${FormField} label="Your Name">
          <${TextInput} value=${form.name} placeholder="Enter your name" onChange=${function(v) { updateForm('name', v); }} />
        <//>
        <${FormField} label="Current Weight (lbs)">
          <${TextInput} value=${form.weight} placeholder="185" inputMode="decimal" onChange=${function(v) { updateForm('weight', v); }} />
        <//>
        <${FormField} label="Height (inches)">
          <${TextInput} value=${form.height} placeholder="70" inputMode="decimal" onChange=${function(v) { updateForm('height', v); }} />
        <//>
        <${FormField} label="Goal Weight (lbs)">
          <${TextInput} value=${form.goalWeight} placeholder="170" inputMode="decimal" onChange=${function(v) { updateForm('goalWeight', v); }} />
        <//>
        <${FormField} label="Protocol Start Date">
          <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50" type="date" value=${form.startDate}
            onChange=${function(e) { updateForm('startDate', e.target.value); }} />
        <//>

        <div class="flex gap-3 mt-8">
          <${Button} variant="secondary" onClick=${function() { setStep(0); }} className="flex-1">Back<//>
          <${Button} onClick=${function() { setStep(2); }} className="flex-1" disabled=${!form.name}>Next<//>
        </div>
      </div>
    `;
  }

  // Step 2: Protocol Confirmation
  if (step === 2) {
    return html`
      <div class="min-h-screen p-6 safe-top">
        <div class="mb-6">
          <div class="flex gap-1.5 mb-6">
            ${[0,1,2].map(function(i) { return html`<div key=${i} class=${'h-1 flex-1 rounded-full ' + (i <= 2 ? 'bg-blue-500' : 'bg-slate-700')} />`; })}
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">Your Protocol</h2>
          <p class="text-slate-400">Confirm your peptide stack</p>
        </div>

        <div class="space-y-3 mb-6">
          <div class="text-sm font-medium text-blue-400 mb-2">Phase 1 — Active</div>
          ${window.DEFAULT_PROTOCOL.filter(function(p) { return p.phase === 1; }).map(function(p) {
            return html`
              <${Card} key=${p.id} className="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <${IconSyringe} />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-white text-sm">${p.name}</div>
                  <div class="text-xs text-slate-400">${p.doseAmount}${p.doseUnit} · ${p.frequency} · ${p.timing}</div>
                </div>
                ${p.fdaApproved ? html`<${Badge} color="green">FDA<//>` : html`<${Badge} color="amber">Research<//>`}
              <//>
            `;
          })}

          <div class="text-sm font-medium text-slate-500 mb-2 mt-4">Phase 2 — Upcoming</div>
          ${window.DEFAULT_PROTOCOL.filter(function(p) { return p.phase === 2; }).map(function(p) {
            return html`
              <${Card} key=${p.id} className="opacity-50 flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <${IconSyringe} />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-slate-300 text-sm">${p.name}</div>
                  <div class="text-xs text-slate-500">${p.notes}</div>
                </div>
              <//>
            `;
          })}
        </div>

        <div class="flex gap-3 mt-8">
          <${Button} variant="secondary" onClick=${function() { setStep(1); }} className="flex-1">Back<//>
          <${Button} onClick=${complete} className="flex-1">Start Protocol<//>
        </div>
      </div>
    `;
  }

  return null;
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================
function DashboardTab(props) {
  var ctx = useApp();
  var today = getToday();
  var todayData = ctx.daily[today] || { proteinGrams: 0, waterOz: 0, completedPeptides: [] };
  var daysOn = ctx.settings.startDate ? daysBetween(ctx.settings.startDate, today) : 0;
  var compliance = calcCompliance(ctx.injections, ctx.protocol, 7);
  var latestCheckIn = ctx.checkIns.length > 0 ? ctx.checkIns.sort(function(a, b) { return b.date.localeCompare(a.date); })[0] : null;
  var firstCheckIn = ctx.checkIns.length > 0 ? ctx.checkIns.sort(function(a, b) { return a.date.localeCompare(b.date); })[0] : null;
  var totalLost = firstCheckIn && latestCheckIn ? Math.max(0, (firstCheckIn.weight || 0) - (latestCheckIn.weight || 0)) : 0;

  var proteinPct = Math.min(100, Math.round((todayData.proteinGrams / (ctx.settings.proteinGoal || 150)) * 100));
  var waterPct = Math.min(100, Math.round((todayData.waterOz / (ctx.settings.waterGoal || 100)) * 100));

  var proteinModalArr = useState(false);
  var showProteinModal = proteinModalArr[0]; var setShowProteinModal = proteinModalArr[1];
  var waterModalArr = useState(false);
  var showWaterModal = waterModalArr[0]; var setShowWaterModal = waterModalArr[1];
  var addAmountArr = useState('');
  var addAmount = addAmountArr[0]; var setAddAmount = addAmountArr[1];

  function addProtein() {
    var amt = parseFloat(addAmount) || 0;
    if (amt > 0) {
      ctx.updateDaily(today, { proteinGrams: todayData.proteinGrams + amt });
      setAddAmount('');
      setShowProteinModal(false);
    }
  }

  function addWater() {
    var amt = parseFloat(addAmount) || 0;
    if (amt > 0) {
      ctx.updateDaily(today, { waterOz: todayData.waterOz + amt });
      setAddAmount('');
      setShowWaterModal(false);
    }
  }

  var activePeptides = ctx.protocol.filter(function(p) { return p.active && p.phase === 1; });

  return html`
    <div class="space-y-4">
      <!-- Greeting -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">${getGreeting()}, ${ctx.settings.userName || 'there'}</h1>
          <p class="text-slate-400 text-sm">${formatDateLong(today)}</p>
        </div>
        <button class="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-400" onClick=${function() { props.onOpenSettings && props.onOpenSettings(); }}>
          <${IconSettings} size=${20} />
        </button>
      </div>

      <!-- Days Counter + Compliance -->
      <div class="flex gap-3">
        <${Card} className="flex-1 text-center">
          <div class="text-3xl font-bold text-blue-400">${daysOn}</div>
          <div class="text-xs text-slate-400 mt-1">Days on Protocol</div>
        <//>
        <div class="flex-shrink-0">
          <${ProgressRing} value=${compliance} size=${80} label="Weekly" />
        </div>
      </div>

      <!-- Active Peptide Cards -->
      <div>
        <h3 class="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Today's Injections</h3>
        ${activePeptides.length === 0
          ? html`<${EmptyState} icon="💉" title="No active peptides" description="Set up your protocol to start tracking" />`
          : html`<div class="space-y-2">
            ${activePeptides.map(function(p) {
              var isComplete = (todayData.completedPeptides || []).indexOf(p.peptideId) !== -1;
              var pepInfo = window.PEPTIDE_MAP[p.peptideId];
              var catColor = window.CATEGORY_COLORS[pepInfo ? pepInfo.category : ''] || '#3b82f6';
              return html`
                <${Card} key=${p.id} className=${'flex items-center gap-3 cursor-pointer transition-all ' + (isComplete ? 'border-emerald-500/30' : '')}
                  onClick=${function() { ctx.togglePeptideComplete(today, p.peptideId); }}>
                  <div class=${'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ' +
                    (isComplete ? 'bg-emerald-500 check-pop' : 'bg-slate-800 border border-slate-700')}>
                    ${isComplete
                      ? html`<${IconCheck} size=${20} />`
                      : html`<div class="w-3 h-3 rounded-full" style=${{ background: catColor }} />`}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class=${'font-semibold text-sm ' + (isComplete ? 'text-emerald-400' : 'text-white')}>${p.name}</div>
                    <div class="text-xs text-slate-500">${p.doseAmount}${p.doseUnit} · ${p.frequency}</div>
                  </div>
                  <div class=${'text-xs px-2 py-1 rounded-lg font-medium ' + (isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500')}>
                    ${isComplete ? 'Done' : p.timing}
                  </div>
                <//>
              `;
            })}
          </div>`
        }
      </div>

      <!-- Protein + Water Trackers -->
      <div class="grid grid-cols-2 gap-3">
        <${Card} className="cursor-pointer" onClick=${function() { setAddAmount(''); setShowProteinModal(true); }}>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-400">Protein</span>
            <span class="text-xs font-semibold text-blue-400">${todayData.proteinGrams}/${ctx.settings.proteinGoal || 150}g</span>
          </div>
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full transition-all duration-500" style=${{ width: proteinPct + '%' }} />
          </div>
        <//>
        <${Card} className="cursor-pointer" onClick=${function() { setAddAmount(''); setShowWaterModal(true); }}>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-400">Water</span>
            <span class="text-xs font-semibold text-cyan-400">${todayData.waterOz}/${ctx.settings.waterGoal || 100}oz</span>
          </div>
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-cyan-500 rounded-full transition-all duration-500" style=${{ width: waterPct + '%' }} />
          </div>
        <//>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-4 gap-2">
        <${StatCard} label="Weight" value=${latestCheckIn ? latestCheckIn.weight : '--'} unit="lbs" />
        <${StatCard} label="Body Fat" value=${latestCheckIn && latestCheckIn.bodyFat ? latestCheckIn.bodyFat + '%' : '--'} />
        <${StatCard} label="Days" value=${daysOn} />
        <${StatCard} label="Lost" value=${totalLost > 0 ? totalLost.toFixed(1) : '--'} unit="lbs" />
      </div>

      <!-- Motivational Message -->
      <${Card} className="text-center">
        <p class="text-sm text-slate-300">${getMotivationalMessage(daysOn)}</p>
      <//>

      <!-- Protein Modal -->
      <${Modal} open=${showProteinModal} onClose=${function() { setShowProteinModal(false); }} title="Add Protein">
        <${FormField} label="Grams of protein">
          <${TextInput} value=${addAmount} placeholder="30" inputMode="decimal" onChange=${setAddAmount} />
        <//>
        <div class="flex gap-2 mb-4">
          ${[20, 30, 40, 50].map(function(amt) {
            return html`<button key=${amt} onClick=${function() { setAddAmount(String(amt)); }}
              class="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700">${amt}g</button>`;
          })}
        </div>
        <${Button} onClick=${addProtein} className="w-full" disabled=${!addAmount}>Add Protein<//>
      <//>

      <!-- Water Modal -->
      <${Modal} open=${showWaterModal} onClose=${function() { setShowWaterModal(false); }} title="Add Water">
        <${FormField} label="Ounces of water">
          <${TextInput} value=${addAmount} placeholder="16" inputMode="decimal" onChange=${setAddAmount} />
        <//>
        <div class="flex gap-2 mb-4">
          ${[8, 12, 16, 24].map(function(amt) {
            return html`<button key=${amt} onClick=${function() { setAddAmount(String(amt)); }}
              class="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700">${amt}oz</button>`;
          })}
        </div>
        <${Button} onClick=${addWater} className="w-full" disabled=${!addAmount}>Add Water<//>
      <//>
    </div>
  `;
}

// ============================================================================
// INJECTION LOG TAB
// ============================================================================
function LogTab() {
  var ctx = useApp();
  var today = getToday();

  var monthArr = useState(function() { var d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  var currentMonth = monthArr[0]; var setCurrentMonth = monthArr[1];
  var selectedDateArr = useState(today);
  var selectedDate = selectedDateArr[0]; var setSelectedDate = selectedDateArr[1];
  var showLogArr = useState(false);
  var showLog = showLogArr[0]; var setShowLog = showLogArr[1];
  var filterArr = useState('all');
  var filter = filterArr[0]; var setFilter = filterArr[1];

  var logFormArr = useState({ peptideId: '', date: today, time: getNow(), doseAmount: '', doseUnit: 'mcg', site: 'abdomen_left', notes: '' });
  var logForm = logFormArr[0]; var setLogForm = logFormArr[1];

  function updateLogForm(key, val) {
    setLogForm(function(prev) { var n = Object.assign({}, prev); n[key] = val; return n; });
  }

  function submitLog() {
    if (!logForm.peptideId || !logForm.doseAmount) return;
    ctx.addInjection({
      id: generateId('inj'),
      peptideId: logForm.peptideId,
      date: logForm.date,
      time: logForm.time,
      doseAmount: parseFloat(logForm.doseAmount),
      doseUnit: logForm.doseUnit,
      injectionSite: logForm.site,
      notes: logForm.notes,
      createdAt: Date.now()
    });
    ctx.togglePeptideComplete(logForm.date, logForm.peptideId);
    setShowLog(false);
    setLogForm({ peptideId: '', date: today, time: getNow(), doseAmount: '', doseUnit: 'mcg', site: 'abdomen_left', notes: '' });
  }

  var days = getMonthDays(currentMonth.year, currentMonth.month);
  var monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  var injByDate = {};
  ctx.injections.forEach(function(inj) {
    if (!injByDate[inj.date]) injByDate[inj.date] = [];
    injByDate[inj.date].push(inj);
  });

  var selectedInjections = (injByDate[selectedDate] || []).filter(function(inj) {
    return filter === 'all' || inj.peptideId === filter;
  });

  var streakData = calcStreak(ctx.injections, ctx.protocol);

  var activePeptides = ctx.protocol.filter(function(p) { return p.active && p.phase === 1; });
  var filterOptions = [{ id: 'all', label: 'All' }].concat(activePeptides.map(function(p) { return { id: p.peptideId, label: p.name.split(' + ')[0] }; }));

  function prevMonth() {
    setCurrentMonth(function(m) {
      var nm = m.month === 0 ? 11 : m.month - 1;
      var ny = m.month === 0 ? m.year - 1 : m.year;
      return { year: ny, month: nm };
    });
  }
  function nextMonth() {
    setCurrentMonth(function(m) {
      var nm = m.month === 11 ? 0 : m.month + 1;
      var ny = m.month === 11 ? m.year + 1 : m.year;
      return { year: ny, month: nm };
    });
  }

  function openLogForPeptide(peptideId) {
    var proto = ctx.protocol.find(function(p) { return p.peptideId === peptideId; });
    setLogForm({
      peptideId: peptideId,
      date: today,
      time: getNow(),
      doseAmount: proto ? String(proto.doseAmount) : '',
      doseUnit: proto ? proto.doseUnit : 'mcg',
      site: 'abdomen_left',
      notes: ''
    });
    setShowLog(true);
  }

  return html`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Injection Log</h2>
        <${Button} variant="small" onClick=${function() { setLogForm({ peptideId: '', date: today, time: getNow(), doseAmount: '', doseUnit: 'mcg', site: 'abdomen_left', notes: '' }); setShowLog(true); }}>
          <${IconPlus} size=${16} /> Log
        <//>
      </div>

      <!-- Streak + Compliance -->
      <div class="flex gap-3">
        <${Card} className="flex-1 text-center">
          <div class="text-2xl font-bold text-orange-400">${streakData.current}</div>
          <div class="text-xs text-slate-400">Current Streak</div>
        <//>
        <${Card} className="flex-1 text-center">
          <div class="text-2xl font-bold text-purple-400">${streakData.best}</div>
          <div class="text-xs text-slate-400">Best Streak</div>
        <//>
        <${Card} className="flex-1 text-center">
          <div class="text-2xl font-bold text-blue-400">${calcCompliance(ctx.injections, ctx.protocol, 7)}%</div>
          <div class="text-xs text-slate-400">This Week</div>
        <//>
      </div>

      <!-- Calendar -->
      <${Card}>
        <div class="flex items-center justify-between mb-4">
          <button class="p-2 text-slate-400" onClick=${prevMonth}><${IconChevron} direction="left" size=${18} /></button>
          <span class="font-semibold text-white">${monthName}</span>
          <button class="p-2 text-slate-400" onClick=${nextMonth}><${IconChevron} direction="right" size=${18} /></button>
        </div>
        <div class="grid grid-cols-7 gap-1 mb-2">
          ${['S','M','T','W','T','F','S'].map(function(d, i) { return html`<div key=${i} class="text-center text-xs text-slate-500 font-medium py-1">${d}</div>`; })}
        </div>
        <div class="grid grid-cols-7 gap-1">
          ${days.map(function(day, i) {
            var dayInj = injByDate[day.date] || [];
            var isSelected = day.date === selectedDate;
            var isToday = day.date === today;
            return html`
              <button key=${i} onClick=${function() { setSelectedDate(day.date); }}
                class=${'relative flex flex-col items-center py-1.5 rounded-lg min-h-[40px] transition-all ' +
                  (!day.isCurrentMonth ? 'opacity-30 ' : '') +
                  (isSelected ? 'bg-blue-500/20 border border-blue-500/40 ' : '') +
                  (isToday && !isSelected ? 'bg-slate-800/60 ' : '')}>
                <span class=${'text-xs ' + (isSelected ? 'text-blue-400 font-bold' : isToday ? 'text-white font-semibold' : 'text-slate-300')}>
                  ${parseInt(day.date.split('-')[2])}
                </span>
                ${dayInj.length > 0 && html`
                  <div class="flex gap-0.5 mt-0.5">
                    ${dayInj.slice(0, 3).map(function(inj, j) {
                      var pepInfo = window.PEPTIDE_MAP[inj.peptideId];
                      var color = window.CATEGORY_COLORS[pepInfo ? pepInfo.category : ''] || '#3b82f6';
                      return html`<div key=${j} class="w-1.5 h-1.5 rounded-full" style=${{ background: color }} />`;
                    })}
                  </div>
                `}
              </button>
            `;
          })}
        </div>
      <//>

      <!-- Filter -->
      <${FilterChips} options=${filterOptions} value=${filter} onChange=${setFilter} />

      <!-- Selected Day Injections -->
      <div>
        <h3 class="text-sm font-semibold text-slate-400 mb-2">${formatDate(selectedDate)} — ${selectedInjections.length} injection${selectedInjections.length !== 1 ? 's' : ''}</h3>
        ${selectedInjections.length === 0
          ? html`<${Card} className="text-center py-6">
            <p class="text-slate-500 text-sm">No injections logged</p>
            <${Button} variant="small" onClick=${function() { setLogForm(Object.assign({}, logForm, { date: selectedDate })); setShowLog(true); }} className="mt-3">Log Injection<//>
          <//>`
          : html`<div class="space-y-2">
            ${selectedInjections.map(function(inj) {
              var pepInfo = window.PEPTIDE_MAP[inj.peptideId];
              var catColor = window.CATEGORY_COLORS[pepInfo ? pepInfo.category : ''] || '#3b82f6';
              var siteLbl = window.INJECTION_SITES.find(function(s) { return s.id === inj.injectionSite; });
              return html`
                <${Card} key=${inj.id} className="flex items-center gap-3">
                  <div class="w-2 h-10 rounded-full" style=${{ background: catColor }} />
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-white text-sm">${pepInfo ? pepInfo.name : inj.peptideId}</div>
                    <div class="text-xs text-slate-500">${inj.doseAmount}${inj.doseUnit} · ${inj.time} · ${siteLbl ? siteLbl.label : inj.injectionSite}</div>
                  </div>
                  <button class="text-slate-600 hover:text-red-400 p-1" onClick=${function() { ctx.deleteInjection(inj.id); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                <//>
              `;
            })}
          </div>`
        }
      </div>

      <!-- Log Injection Full Screen -->
      ${showLog && html`
        <div class="fixed inset-0 z-[100] bg-navy safe-top overflow-y-scroll fade-in" style=${{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div class="p-4 max-w-lg mx-auto pb-24">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-bold text-white">Log Injection</h2>
              <button class="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400" onClick=${function() { setShowLog(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="space-y-4">
              <${FormField} label="Peptide">
                <${SelectInput} value=${logForm.peptideId} onChange=${function(v) { updateLogForm('peptideId', v); var proto = ctx.protocol.find(function(p) { return p.peptideId === v; }); if (proto) { updateLogForm('doseAmount', String(proto.doseAmount)); updateLogForm('doseUnit', proto.doseUnit); } }}
                  options=${[{ value: '', label: 'Select peptide...' }].concat(activePeptides.map(function(p) { return { value: p.peptideId, label: p.name }; }))} />
              <//>
              <div class="grid grid-cols-2 gap-3">
                <${FormField} label="Date">
                  <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50" type="date" value=${logForm.date} onChange=${function(e) { updateLogForm('date', e.target.value); }} />
                <//>
                <${FormField} label="Time">
                  <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50" type="time" value=${logForm.time} onChange=${function(e) { updateLogForm('time', e.target.value); }} />
                <//>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <${FormField} label="Dose">
                  <${TextInput} value=${logForm.doseAmount} placeholder="250" inputMode="decimal" onChange=${function(v) { updateLogForm('doseAmount', v); }} />
                <//>
                <${FormField} label="Unit">
                  <${SelectInput} value=${logForm.doseUnit} onChange=${function(v) { updateLogForm('doseUnit', v); }}
                    options=${[{ value: 'mcg', label: 'mcg' }, { value: 'mg', label: 'mg' }, { value: 'IU', label: 'IU' }]} />
                <//>
              </div>
              <${FormField} label="Injection Site">
                <${SelectInput} value=${logForm.site} onChange=${function(v) { updateLogForm('site', v); }}
                  options=${window.INJECTION_SITES.map(function(s) { return { value: s.id, label: s.label }; })} />
              <//>
              <${FormField} label="Notes (optional)">
                <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                  type="text" placeholder="Any observations..." value=${logForm.notes} onInput=${function(e) { updateLogForm('notes', e.target.value); }} />
              <//>
              <${Button} onClick=${submitLog} className="w-full" disabled=${!logForm.peptideId || !logForm.doseAmount}>Log Injection<//>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

// ============================================================================
// PROGRESS TAB
// ============================================================================
function ProgressTab() {
  var ctx = useApp();
  var showCheckInArr = useState(false);
  var showCheckIn = showCheckInArr[0]; var setShowCheckIn = showCheckInArr[1];
  var chartViewArr = useState('weight');
  var chartView = chartViewArr[0]; var setChartView = chartViewArr[1];

  var ciFormArr = useState({ weight: '', bodyFat: '', energy: 5, sleep: 5, hunger: 5, notes: '' });
  var ciForm = ciFormArr[0]; var setCiForm = ciFormArr[1];

  function updateCI(key, val) {
    setCiForm(function(prev) { var n = Object.assign({}, prev); n[key] = val; return n; });
  }

  function submitCheckIn() {
    ctx.addCheckIn({
      id: generateId('ci'),
      date: getToday(),
      weight: parseFloat(ciForm.weight) || null,
      bodyFat: parseFloat(ciForm.bodyFat) || null,
      energyLevel: ciForm.energy,
      sleepQuality: ciForm.sleep,
      hungerLevel: ciForm.hunger,
      notes: ciForm.notes,
      createdAt: Date.now()
    });
    setShowCheckIn(false);
    setCiForm({ weight: '', bodyFat: '', energy: 5, sleep: 5, hunger: 5, notes: '' });
  }

  var sortedCheckIns = ctx.checkIns.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
  var firstCI = sortedCheckIns[0];
  var latestCI = sortedCheckIns[sortedCheckIns.length - 1];
  var totalLost = firstCI && latestCI ? Math.max(0, (firstCI.weight || 0) - (latestCI.weight || 0)) : 0;
  var weekCount = sortedCheckIns.length > 1 ? Math.max(1, daysBetween(firstCI.date, latestCI.date) / 7) : 0;
  var avgWeeklyLoss = weekCount > 0 ? (totalLost / weekCount).toFixed(1) : '--';
  var daysOn = ctx.settings.startDate ? daysBetween(ctx.settings.startDate, getToday()) : 0;

  // Chart data
  var chartData = sortedCheckIns.map(function(ci) {
    return { date: formatDateShort(ci.date), weight: ci.weight, bodyFat: ci.bodyFat, energy: ci.energyLevel, sleep: ci.sleepQuality, hunger: ci.hungerLevel };
  });

  // Milestones
  var milestoneData = {
    totalInjections: ctx.injections.length,
    currentStreak: calcStreak(ctx.injections, ctx.protocol).current,
    daysOnProtocol: daysOn,
    totalWeightLost: totalLost,
    proteinStreak: 0,
  };
  var earned = window.MILESTONES.filter(function(m) { return m.condition(milestoneData); });
  var unearned = window.MILESTONES.filter(function(m) { return !m.condition(milestoneData); });

  // Projected results
  var projectedEndWeight = null;
  if (avgWeeklyLoss !== '--' && parseFloat(avgWeeklyLoss) > 0 && latestCI) {
    var weeksRemaining = 12;
    projectedEndWeight = ((latestCI.weight || 0) - (parseFloat(avgWeeklyLoss) * weeksRemaining)).toFixed(1);
  }

  var chartOptions = [
    { id: 'weight', label: 'Weight' },
    { id: 'bodyFat', label: 'Body Fat' },
    { id: 'energy', label: 'Energy & Sleep' },
    { id: 'hunger', label: 'Hunger' },
  ];

  return html`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Progress</h2>
        <${Button} variant="small" onClick=${function() { setShowCheckIn(true); }}>
          <${IconPlus} size=${16} /> Check-in
        <//>
      </div>

      <!-- Summary Stats -->
      <div class="grid grid-cols-3 gap-2">
        <${StatCard} label="Total Lost" value=${totalLost > 0 ? totalLost.toFixed(1) : '--'} unit="lbs" />
        <${StatCard} label="Avg/Week" value=${avgWeeklyLoss} unit="lbs" />
        <${StatCard} label="Days" value=${daysOn} />
      </div>

      ${projectedEndWeight && html`
        <${Card} className="text-center bg-blue-500/10 border-blue-500/20">
          <div class="text-xs text-blue-400 mb-1">Projected in 12 weeks</div>
          <div class="text-2xl font-bold text-blue-400">${projectedEndWeight} lbs</div>
        <//>
      `}

      <!-- Chart Selector -->
      <${FilterChips} options=${chartOptions} value=${chartView} onChange=${setChartView} />

      <!-- Charts -->
      ${sortedCheckIns.length < 2
        ? html`<${Card} className="text-center py-8">
            <p class="text-slate-500 text-sm">Log at least 2 check-ins to see charts</p>
          <//>`
        : html`
          <${Card}>
            ${chartView === 'weight' && html`
              <${RC.ResponsiveContainer} width="100%" height=${200}>
                <${RC.LineChart} data=${chartData}>
                  <${RC.CartesianGrid} strokeDasharray="3 3" stroke="#1e293b" />
                  <${RC.XAxis} dataKey="date" stroke="#64748b" fontSize=${11} />
                  <${RC.YAxis} stroke="#64748b" fontSize=${11} domain=${['auto', 'auto']} />
                  <${RC.Tooltip} contentStyle=${{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }} />
                  <${RC.Line} type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth=${2} dot=${{ fill: '#3b82f6', r: 4 }} activeDot=${{ r: 6 }} />
                  ${ctx.settings.goalWeight && html`<${RC.ReferenceLine} y=${ctx.settings.goalWeight} stroke="#22c55e" strokeDasharray="5 5" label=${{ value: 'Goal', fill: '#22c55e', fontSize: 11 }} />`}
                <//>
              <//>
            `}
            ${chartView === 'bodyFat' && html`
              <${RC.ResponsiveContainer} width="100%" height=${200}>
                <${RC.AreaChart} data=${chartData}>
                  <defs>
                    <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity=${0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity=${0} />
                    </linearGradient>
                  </defs>
                  <${RC.CartesianGrid} strokeDasharray="3 3" stroke="#1e293b" />
                  <${RC.XAxis} dataKey="date" stroke="#64748b" fontSize=${11} />
                  <${RC.YAxis} stroke="#64748b" fontSize=${11} domain=${['auto', 'auto']} />
                  <${RC.Tooltip} contentStyle=${{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }} />
                  <${RC.Area} type="monotone" dataKey="bodyFat" stroke="#a855f7" strokeWidth=${2} fill="url(#bfGrad)" dot=${{ fill: '#a855f7', r: 4 }} />
                <//>
              <//>
            `}
            ${chartView === 'energy' && html`
              <${RC.ResponsiveContainer} width="100%" height=${200}>
                <${RC.LineChart} data=${chartData}>
                  <${RC.CartesianGrid} strokeDasharray="3 3" stroke="#1e293b" />
                  <${RC.XAxis} dataKey="date" stroke="#64748b" fontSize=${11} />
                  <${RC.YAxis} stroke="#64748b" fontSize=${11} domain=${[0, 10]} />
                  <${RC.Tooltip} contentStyle=${{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }} />
                  <${RC.Line} type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth=${2} dot=${{ fill: '#f59e0b', r: 4 }} name="Energy" />
                  <${RC.Line} type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth=${2} dot=${{ fill: '#8b5cf6', r: 4 }} name="Sleep" />
                  <${RC.Legend} wrapperStyle=${{ color: '#94a3b8', fontSize: 12 }} />
                <//>
              <//>
            `}
            ${chartView === 'hunger' && html`
              <${RC.ResponsiveContainer} width="100%" height=${200}>
                <${RC.AreaChart} data=${chartData}>
                  <defs>
                    <linearGradient id="hungerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity=${0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity=${0} />
                    </linearGradient>
                  </defs>
                  <${RC.CartesianGrid} strokeDasharray="3 3" stroke="#1e293b" />
                  <${RC.XAxis} dataKey="date" stroke="#64748b" fontSize=${11} />
                  <${RC.YAxis} stroke="#64748b" fontSize=${11} domain=${[0, 10]} />
                  <${RC.Tooltip} contentStyle=${{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc' }} />
                  <${RC.Area} type="monotone" dataKey="hunger" stroke="#22c55e" strokeWidth=${2} fill="url(#hungerGrad)" dot=${{ fill: '#22c55e', r: 4 }} name="Hunger Level" />
                <//>
              <//>
            `}
          <//>
        `
      }

      <!-- Milestones -->
      <div>
        <h3 class="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Milestones</h3>
        <div class="grid grid-cols-2 gap-2">
          ${earned.map(function(m) {
            return html`<${Card} key=${m.id} className="flex items-center gap-2 border-emerald-500/20">
              <span class="text-xl">${m.icon}</span>
              <span class="text-sm font-medium text-emerald-400">${m.label}</span>
            <//>`;
          })}
          ${unearned.slice(0, 4).map(function(m) {
            return html`<${Card} key=${m.id} className="flex items-center gap-2 opacity-40">
              <span class="text-xl grayscale">${m.icon}</span>
              <span class="text-sm text-slate-500">${m.label}</span>
            <//>`;
          })}
        </div>
      </div>

      <!-- Check-in Modal -->
      <${Modal} open=${showCheckIn} onClose=${function() { setShowCheckIn(false); }} title="Weekly Check-in"
        action=${html`<${Button} onClick=${submitCheckIn} className="w-full">Save Check-in<//>`}>
        <div class="grid grid-cols-2 gap-3">
          <${FormField} label="Weight (lbs)">
            <${TextInput} value=${ciForm.weight} placeholder="185" inputMode="decimal" onChange=${function(v) { updateCI('weight', v); }} />
          <//>
          <${FormField} label="Body Fat %">
            <${TextInput} value=${ciForm.bodyFat} placeholder="18" inputMode="decimal" onChange=${function(v) { updateCI('bodyFat', v); }} />
          <//>
        </div>
        <${FormField} label=${'Energy Level (' + ciForm.energy + '/10)'}>
          <${RatingInput} value=${ciForm.energy} max=${10} onChange=${function(v) { updateCI('energy', v); }} />
        <//>
        <${FormField} label=${'Sleep Quality (' + ciForm.sleep + '/10)'}>
          <${RatingInput} value=${ciForm.sleep} max=${10} onChange=${function(v) { updateCI('sleep', v); }} />
        <//>
        <${FormField} label=${'Hunger Level (' + ciForm.hunger + '/10)'}>
          <${RatingInput} value=${ciForm.hunger} max=${10} onChange=${function(v) { updateCI('hunger', v); }} />
        <//>
        <${FormField} label="Notes">
          <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            type="text" placeholder="How are you feeling?" value=${ciForm.notes} onInput=${function(e) { updateCI('notes', e.target.value); }} />
        <//>
      <//>
    </div>
  `;
}

// ============================================================================
// PROTOCOL TAB
// ============================================================================
function ProtocolTab() {
  var ctx = useApp();
  var showCalcArr = useState(false);
  var showCalc = showCalcArr[0]; var setShowCalc = showCalcArr[1];
  var calcFormArr = useState({ vialMg: '5', waterMl: '2', desiredDose: '250', doseUnit: 'mcg' });
  var calcForm = calcFormArr[0]; var setCalcForm = calcFormArr[1];

  function updateCalc(key, val) { setCalcForm(function(prev) { var n = Object.assign({}, prev); n[key] = val; return n; }); }

  var concentration = (parseFloat(calcForm.vialMg) || 0) / (parseFloat(calcForm.waterMl) || 1);
  var desiredMg = calcForm.doseUnit === 'mcg' ? (parseFloat(calcForm.desiredDose) || 0) / 1000 : (parseFloat(calcForm.desiredDose) || 0);
  var drawMl = concentration > 0 ? desiredMg / concentration : 0;
  var drawUnits = drawMl * 100;

  var editingArr = useState(null);
  var editing = editingArr[0]; var setEditing = editingArr[1];

  var showAddArr = useState(false);
  var showAdd = showAddArr[0]; var setShowAdd = showAddArr[1];

  var activePeptides = ctx.protocol.filter(function(p) { return p.active && p.phase === 1; });
  var phase2Peptides = ctx.protocol.filter(function(p) { return p.phase === 2; });

  // Peptides available to add (not already in protocol)
  var protocolIds = ctx.protocol.map(function(p) { return p.peptideId; });
  var availablePeptides = window.PEPTIDE_LIBRARY.filter(function(p) { return protocolIds.indexOf(p.id) === -1; });

  function addPeptideToProtocol(pepId) {
    var pepInfo = window.PEPTIDE_MAP[pepId];
    if (!pepInfo) return;
    var newItem = {
      id: generateId('proto'),
      peptideId: pepId,
      name: pepInfo.name,
      doseAmount: pepInfo.typicalDose ? (pepInfo.typicalDose.min || 0) : 0,
      doseUnit: pepInfo.typicalDose ? (pepInfo.typicalDose.unit || 'mcg') : 'mcg',
      frequency: pepInfo.frequency || 'daily',
      timeOfDay: 'any',
      timing: pepInfo.timing || 'Any time',
      active: true,
      phase: 1,
      startDate: getToday(),
      notes: '',
      fdaApproved: pepInfo.fdaApproved || false,
    };
    ctx.saveProtocol(function(prev) { return prev.concat([newItem]); });
    setShowAdd(false);
  }

  function removePeptide(id) {
    ctx.saveProtocol(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
    if (editing === id) setEditing(null);
  }

  // Injection site rotation
  var recentSites = ctx.injections.slice(0, 10).map(function(i) { return i.injectionSite; });
  var siteCounts = {};
  recentSites.forEach(function(s) { siteCounts[s] = (siteCounts[s] || 0) + 1; });
  var leastUsed = window.INJECTION_SITES.reduce(function(best, site) {
    var count = siteCounts[site.id] || 0;
    return count < (siteCounts[best.id] || 0) ? site : best;
  }, window.INJECTION_SITES[0]);

  return html`
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">My Protocol</h2>
        <${Button} variant="small" onClick=${function() { setShowAdd(true); }}>
          <${IconPlus} size=${16} /> Add
        <//>
      </div>

      <!-- Phase 1 Cards -->
      <div class="space-y-3">
        <div class="text-sm font-semibold text-blue-400 uppercase tracking-wider">Phase 1 — Active</div>
        ${activePeptides.map(function(p) {
          var pepInfo = window.PEPTIDE_MAP[p.peptideId];
          var catColor = window.CATEGORY_COLORS[pepInfo ? pepInfo.category : ''] || '#3b82f6';
          var pStartDate = p.startDate || ctx.settings.startDate || '';
          var pDaysOn = pStartDate ? daysBetween(pStartDate, getToday()) : 0;
          var weeksOn = Math.floor(pDaysOn / 7);
          var isEditing = editing === p.id;
          return html`
            <${Card} key=${p.id} className="space-y-3">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick=${function() { setEditing(isEditing ? null : p.id); }}>
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style=${{ background: catColor + '20' }}>
                    <${IconSyringe} />
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-white">${p.name}</div>
                    <div class="text-xs text-slate-400">${pepInfo ? pepInfo.category.replace('_', ' ') : ''}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${p.fdaApproved ? html`<${Badge} color="green">FDA<//>` : html`<${Badge} color="amber">Research<//>`}
                  <${IconChevron} direction=${isEditing ? 'down' : 'right'} />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-slate-800/40 rounded-lg py-2">
                  <div class="text-sm font-bold text-white">${p.doseAmount}${p.doseUnit}</div>
                  <div class="text-[10px] text-slate-500">Dose</div>
                </div>
                <div class="bg-slate-800/40 rounded-lg py-2">
                  <div class="text-sm font-bold text-white capitalize">${p.frequency}</div>
                  <div class="text-[10px] text-slate-500">Frequency</div>
                </div>
                <div class="bg-slate-800/40 rounded-lg py-2">
                  <div class="text-sm font-bold text-white">${pStartDate ? weeksOn : '—'}</div>
                  <div class="text-[10px] text-slate-500">${pStartDate ? 'Weeks on' : 'No start'}</div>
                </div>
              </div>
              ${isEditing && html`
                <div class="space-y-3 pt-2 border-t border-slate-700/50">
                  <div class="grid grid-cols-3 gap-2">
                    <${FormField} label="Dose">
                      <${TextInput} value=${String(p.doseAmount)} inputMode="decimal" onChange=${function(v) { ctx.updateProtocolItem(p.id, { doseAmount: parseFloat(v) || 0 }); }} />
                    <//>
                    <${FormField} label="Unit">
                      <${SelectInput} value=${p.doseUnit} onChange=${function(v) { ctx.updateProtocolItem(p.id, { doseUnit: v }); }}
                        options=${[{ value: 'mcg', label: 'mcg' }, { value: 'mg', label: 'mg' }, { value: 'IU', label: 'IU' }]} />
                    <//>
                    <${FormField} label="Frequency">
                      <${SelectInput} value=${p.frequency} onChange=${function(v) { ctx.updateProtocolItem(p.id, { frequency: v }); }}
                        options=${[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'eod', label: 'EOD' }, { value: '3x_week', label: '3x/wk' }, { value: '5_on_2_off', label: '5on/2off' }]} />
                    <//>
                  </div>
                  <${FormField} label="Timing">
                    <${TextInput} value=${p.timing || ''} onChange=${function(v) { ctx.updateProtocolItem(p.id, { timing: v }); }} placeholder="e.g. Before bed on empty stomach" />
                  <//>
                  <${FormField} label="Start Date">
                    <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                      type="date" value=${pStartDate}
                      onChange=${function(e) { ctx.updateProtocolItem(p.id, { startDate: e.target.value }); }} />
                  <//>
                  <${FormField} label="Notes">
                    <${TextInput} value=${p.notes || ''} onChange=${function(v) { ctx.updateProtocolItem(p.id, { notes: v }); }} placeholder="Any notes..." />
                  <//>
                  <${Button} variant="danger" onClick=${function() { removePeptide(p.id); }} className="w-full">Remove from Protocol<//>
                </div>
              `}
              ${!isEditing && html`<div class="text-xs text-slate-400">
                <span class="text-slate-500">Timing:</span> ${p.timing}
              </div>`}
              ${!isEditing && p.notes && html`<div class="text-xs text-slate-500 italic">${p.notes}</div>`}
              ${!isEditing && pepInfo && pepInfo.sideEffects && html`
                <div class="text-xs">
                  <span class="text-slate-500">Watch for:</span>
                  <span class="text-amber-400/80"> ${pepInfo.sideEffects.slice(0, 3).join(', ')}</span>
                </div>
              `}
            <//>
          `;
        })}
      </div>

      <!-- Phase 2 -->
      ${phase2Peptides.length > 0 && html`
        <div class="space-y-3">
          <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Phase 2 — Upcoming</div>
          ${phase2Peptides.map(function(p) {
            var isEditing2 = editing === p.id;
            return html`
              <${Card} key=${p.id} className=${isEditing2 ? 'space-y-3' : 'opacity-50'}>
                <div class="flex items-center gap-3 cursor-pointer" onClick=${function() { setEditing(isEditing2 ? null : p.id); }}>
                  <div class="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                    <${IconSyringe} />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-slate-300">${p.name}</div>
                    <div class="text-xs text-slate-500">${p.doseAmount}${p.doseUnit} · ${p.frequency}</div>
                  </div>
                  <${Badge} color="slate">Phase 2<//>
                </div>
                ${isEditing2 && html`
                  <div class="space-y-3 pt-2 border-t border-slate-700/50">
                    <div class="grid grid-cols-3 gap-2">
                      <${FormField} label="Dose">
                        <${TextInput} value=${String(p.doseAmount)} inputMode="decimal" onChange=${function(v) { ctx.updateProtocolItem(p.id, { doseAmount: parseFloat(v) || 0 }); }} />
                      <//>
                      <${FormField} label="Unit">
                        <${SelectInput} value=${p.doseUnit} onChange=${function(v) { ctx.updateProtocolItem(p.id, { doseUnit: v }); }}
                          options=${[{ value: 'mcg', label: 'mcg' }, { value: 'mg', label: 'mg' }, { value: 'IU', label: 'IU' }]} />
                      <//>
                      <${FormField} label="Frequency">
                        <${SelectInput} value=${p.frequency} onChange=${function(v) { ctx.updateProtocolItem(p.id, { frequency: v }); }}
                          options=${[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'eod', label: 'EOD' }, { value: '3x_week', label: '3x/wk' }, { value: '5_on_2_off', label: '5on/2off' }]} />
                      <//>
                    </div>
                    <div class="flex gap-2">
                      <${Button} variant="success" onClick=${function() { ctx.updateProtocolItem(p.id, { active: true, phase: 1, startDate: getToday() }); }} className="flex-1">Activate<//>
                      <${Button} variant="danger" onClick=${function() { removePeptide(p.id); }} className="flex-1">Remove<//>
                    </div>
                  </div>
                `}
              <//>
            `;
          })}
        </div>
      `}

      <!-- Add Peptide Modal -->
      <${Modal} open=${showAdd} onClose=${function() { setShowAdd(false); }} title="Add Peptide">
        ${availablePeptides.length === 0
          ? html`<p class="text-slate-400 text-sm text-center py-4">All peptides are already in your protocol</p>`
          : html`<div class="space-y-2">
            ${availablePeptides.map(function(pep) {
              var catColor = window.CATEGORY_COLORS[pep.category] || '#3b82f6';
              var doseStr = pep.typicalDose ? (pep.typicalDose.min + '-' + pep.typicalDose.max + pep.typicalDose.unit) : '';
              var subtitle = pep.category.replace('_', ' ') + (doseStr ? ' · ' + doseStr : '');
              return html`
                <button key=${pep.id} class="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 active:bg-slate-700/60 text-left"
                  onClick=${function() { addPeptideToProtocol(pep.id); }}>
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style=${{ background: catColor + '20' }}>
                    <${IconSyringe} />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-white text-sm">${pep.name}</div>
                    <div class="text-xs text-slate-400">${subtitle}</div>
                  </div>
                  <${IconPlus} size=${18} />
                </button>
              `;
            })}
          </div>`
        }
      <//>

      <!-- Dosing Calculator -->
      <${Card} className="cursor-pointer" onClick=${function() { setShowCalc(!showCalc); }}>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="12" y1="10" x2="12" y2="18"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
            </div>
            <div>
              <div class="font-semibold text-white text-sm">Dosing Calculator</div>
              <div class="text-xs text-slate-400">Calculate units from vial concentration</div>
            </div>
          </div>
          <${IconChevron} direction=${showCalc ? 'down' : 'right'} />
        </div>
      <//>

      ${showCalc && html`
        <${Card}>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <${FormField} label="Vial (mg)">
              <${TextInput} value=${calcForm.vialMg} inputMode="decimal" onChange=${function(v) { updateCalc('vialMg', v); }} />
            <//>
            <${FormField} label="Bac Water (mL)">
              <${TextInput} value=${calcForm.waterMl} inputMode="decimal" onChange=${function(v) { updateCalc('waterMl', v); }} />
            <//>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <${FormField} label="Desired Dose">
              <${TextInput} value=${calcForm.desiredDose} inputMode="decimal" onChange=${function(v) { updateCalc('desiredDose', v); }} />
            <//>
            <${FormField} label="Unit">
              <${SelectInput} value=${calcForm.doseUnit} onChange=${function(v) { updateCalc('doseUnit', v); }}
                options=${[{ value: 'mcg', label: 'mcg' }, { value: 'mg', label: 'mg' }]} />
            <//>
          </div>
          <div class="bg-slate-800/60 rounded-xl p-4 text-center space-y-2">
            <div class="text-xs text-slate-400">Concentration: ${concentration.toFixed(2)} mg/mL</div>
            <div class="text-2xl font-bold text-blue-400">${drawMl.toFixed(3)} mL</div>
            <div class="text-lg font-semibold text-emerald-400">${drawUnits.toFixed(1)} units</div>
            <div class="text-xs text-slate-500">(on a 100-unit insulin syringe)</div>
          </div>
        <//>
      `}

      <!-- Injection Site Rotation -->
      <${Card}>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="5" r="3"/><path d="M12 8v4m-4 2h8m-6 0v6m4-6v6"/>
            </svg>
          </div>
          <div>
            <div class="font-semibold text-white text-sm">Next Injection Site</div>
            <div class="text-xs text-emerald-400 font-medium">${leastUsed.label}</div>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-2">
          ${window.INJECTION_SITES.map(function(site) {
            var count = siteCounts[site.id] || 0;
            var isNext = site.id === leastUsed.id;
            return html`
              <div key=${site.id} class=${'text-center py-2 rounded-lg text-xs ' + (isNext ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-slate-800/40 text-slate-400')}>
                <div class="font-semibold">${count}</div>
                <div class="truncate px-1">${site.label.split(' (')[0]}</div>
              </div>
            `;
          })}
        </div>
      <//>

      <!-- Storage Info -->
      <${Card}>
        <h3 class="font-semibold text-white mb-3">Storage Instructions</h3>
        <div class="space-y-2">
          ${activePeptides.map(function(p) {
            var pepInfo = window.PEPTIDE_MAP[p.peptideId];
            if (!pepInfo || !pepInfo.storage) return null;
            return html`
              <div key=${p.id} class="flex items-start gap-2 text-xs">
                <div class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span class="text-white font-medium">${pepInfo.name}:</span>
                  <span class="text-slate-400"> ${pepInfo.storage.refrigerated ? 'Refrigerate' : 'Room temp'} · ${pepInfo.storage.shelfLife}</span>
                </div>
              </div>
            `;
          })}
        </div>
      <//>
    </div>
  `;
}

// ============================================================================
// LIBRARY TAB
// ============================================================================
function LibraryTab() {
  var searchArr = useState('');
  var search = searchArr[0]; var setSearch = searchArr[1];
  var categoryArr = useState('all');
  var category = categoryArr[0]; var setCategory = categoryArr[1];
  var selectedArr = useState(null);
  var selected = selectedArr[0]; var setSelected = selectedArr[1];

  var filtered = window.PEPTIDE_LIBRARY.filter(function(p) {
    var matchesSearch = !search || p.name.toLowerCase().indexOf(search.toLowerCase()) !== -1 ||
      (p.aliases || []).some(function(a) { return a.toLowerCase().indexOf(search.toLowerCase()) !== -1; });
    var matchesCat = category === 'all' || p.category === category;
    return matchesSearch && matchesCat;
  });

  var selectedPeptide = selected ? window.PEPTIDE_MAP[selected] : null;

  function renderSafetyStars(rating) {
    return Array.from({ length: 5 }, function(_, i) {
      return html`<span key=${i} class=${i < rating ? 'text-amber-400' : 'text-slate-700'}>★</span>`;
    });
  }

  return html`
    <div class="space-y-4">
      <h2 class="text-xl font-bold text-white">Peptide Library</h2>

      <${SearchInput} value=${search} onChange=${setSearch} placeholder="Search peptides..." />
      <${FilterChips} options=${window.PEPTIDE_CATEGORIES} value=${category} onChange=${setCategory} />

      <div class="space-y-2">
        ${filtered.map(function(p) {
          var catColor = window.CATEGORY_COLORS[p.category] || '#3b82f6';
          var catLabel = (window.PEPTIDE_CATEGORIES.find(function(c) { return c.id === p.category; }) || {}).label || p.category;
          return html`
            <${Card} key=${p.id} className="flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform" onClick=${function() { setSelected(p.id); }}>
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style=${{ background: catColor + '20' }}>
                <div class="w-3 h-3 rounded-full" style=${{ background: catColor }} />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-white text-sm">${p.name}</div>
                <div class="text-xs text-slate-500">${catLabel} · ${p.frequency}</div>
              </div>
              <div class="flex flex-col items-end gap-1">
                ${p.fdaApproved ? html`<${Badge} color="green">FDA<//>` : html`<${Badge} color="slate">Research<//>`}
                <div class="text-[10px]">${renderSafetyStars(p.safetyRating)}</div>
              </div>
            <//>
          `;
        })}
        ${filtered.length === 0 && html`<${EmptyState} icon="🔍" title="No peptides found" description="Try a different search term or category" />`}
      </div>

      <!-- Detail Modal -->
      <${Modal} open=${!!selectedPeptide} onClose=${function() { setSelected(null); }} title=${selectedPeptide ? selectedPeptide.name : ''}>
        ${selectedPeptide && html`
          <div class="space-y-4">
            <div class="flex items-center gap-2 flex-wrap">
              ${(function() {
                var catLabel = (window.PEPTIDE_CATEGORIES.find(function(c) { return c.id === selectedPeptide.category; }) || {}).label || '';
                var catColorKey = selectedPeptide.category === 'fat_loss' ? 'red' : selectedPeptide.category === 'muscle' ? 'blue' : selectedPeptide.category === 'recovery' ? 'green' : selectedPeptide.category === 'anti_aging' ? 'purple' : selectedPeptide.category === 'sexual_health' ? 'pink' : 'amber';
                return html`<${Badge} color=${catColorKey}>${catLabel}<//>`;
              })()}
              ${selectedPeptide.fdaApproved ? html`<${Badge} color="green">FDA Approved<//>` : html`<${Badge} color="amber">Not FDA Approved<//>`}
              <div class="text-sm">${renderSafetyStars(selectedPeptide.safetyRating)}</div>
            </div>

            ${selectedPeptide.aliases && html`<div class="text-xs text-slate-500">Also known as: ${selectedPeptide.aliases.join(', ')}</div>`}

            <div>
              <h4 class="text-sm font-semibold text-slate-300 mb-1">Mechanism of Action</h4>
              <p class="text-sm text-slate-400">${selectedPeptide.mechanism}</p>
            </div>

            <div>
              <h4 class="text-sm font-semibold text-slate-300 mb-1">Benefits</h4>
              <div class="space-y-1">
                ${selectedPeptide.benefits.map(function(b, i) {
                  return html`<div key=${i} class="flex items-start gap-2 text-sm text-slate-400">
                    <span class="text-emerald-400 mt-0.5">+</span> ${b}
                  </div>`;
                })}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="bg-slate-800/40 rounded-xl p-3">
                <div class="text-xs text-slate-500 mb-1">Typical Dose</div>
                <div class="text-sm font-semibold text-white">${selectedPeptide.typicalDose.min}-${selectedPeptide.typicalDose.max} ${selectedPeptide.typicalDose.unit}</div>
              </div>
              <div class="bg-slate-800/40 rounded-xl p-3">
                <div class="text-xs text-slate-500 mb-1">Frequency</div>
                <div class="text-sm font-semibold text-white">${selectedPeptide.frequency}</div>
              </div>
              <div class="bg-slate-800/40 rounded-xl p-3">
                <div class="text-xs text-slate-500 mb-1">Half-life</div>
                <div class="text-sm font-semibold text-white">${selectedPeptide.halfLife}</div>
              </div>
              <div class="bg-slate-800/40 rounded-xl p-3">
                <div class="text-xs text-slate-500 mb-1">Cycle Length</div>
                <div class="text-sm font-semibold text-white">${selectedPeptide.cycleLength}</div>
              </div>
            </div>

            <div>
              <h4 class="text-sm font-semibold text-slate-300 mb-1">Timing</h4>
              <p class="text-sm text-slate-400">${selectedPeptide.timing}</p>
            </div>

            <div>
              <h4 class="text-sm font-semibold text-slate-300 mb-1">Side Effects</h4>
              <div class="flex flex-wrap gap-1.5">
                ${selectedPeptide.sideEffects.map(function(s, i) {
                  return html`<span key=${i} class="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs">${s}</span>`;
                })}
              </div>
            </div>

            ${selectedPeptide.stacksWith && selectedPeptide.stacksWith.length > 0 && html`
              <div>
                <h4 class="text-sm font-semibold text-slate-300 mb-1">Stacks With</h4>
                <div class="flex flex-wrap gap-1.5">
                  ${selectedPeptide.stacksWith.map(function(id) {
                    var p = window.PEPTIDE_MAP[id];
                    return p ? html`<span key=${id} class="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs">${p.name}</span>` : null;
                  })}
                </div>
              </div>
            `}

            ${selectedPeptide.reconstitution && html`
              <div>
                <h4 class="text-sm font-semibold text-slate-300 mb-1">Reconstitution</h4>
                <p class="text-sm text-slate-400">${selectedPeptide.reconstitution.powderMg}mg powder + ${selectedPeptide.reconstitution.waterMl}mL bacteriostatic water = ${selectedPeptide.reconstitution.concentrationPerMl}</p>
              </div>
            `}

            ${selectedPeptide.storage && html`
              <div>
                <h4 class="text-sm font-semibold text-slate-300 mb-1">Storage</h4>
                <p class="text-sm text-slate-400">${selectedPeptide.storage.refrigerated ? 'Refrigerate after reconstitution' : 'Room temperature'} · Shelf life: ${selectedPeptide.storage.shelfLife}</p>
              </div>
            `}

            ${selectedPeptide.contraindications && html`
              <div>
                <h4 class="text-sm font-semibold text-red-400 mb-1">Contraindications</h4>
                <div class="space-y-1">
                  ${selectedPeptide.contraindications.map(function(c, i) {
                    return html`<div key=${i} class="flex items-start gap-2 text-sm text-red-400/80">
                      <span class="mt-0.5">!</span> ${c}
                    </div>`;
                  })}
                </div>
              </div>
            `}
          </div>
        `}
      <//>
    </div>
  `;
}

// ============================================================================
// SETTINGS
// ============================================================================
function SettingsPage(props) {
  var ctx = useApp();
  var formArr = useState(Object.assign({}, ctx.settings));
  var form = formArr[0]; var setForm = formArr[1];

  useEffect(function() {
    setForm(Object.assign({}, ctx.settings));
  }, [ctx.settings]);

  function updateForm(key, val) {
    setForm(function(prev) { var n = Object.assign({}, prev); n[key] = val; return n; });
  }

  function save() {
    ctx.saveSettings(Object.assign({}, form, {
      weight: parseFloat(form.weight) || 0,
      height: parseFloat(form.height) || 0,
      goalWeight: parseFloat(form.goalWeight) || 0,
      targetBF: parseFloat(form.targetBF) || 0,
      proteinGoal: parseInt(form.proteinGoal) || 150,
      waterGoal: parseInt(form.waterGoal) || 100,
      onboardingComplete: true
    }));
    props.onClose();
  }

  function exportData() {
    var data = {
      settings: ctx.settings,
      protocol: ctx.protocol,
      injections: ctx.injections,
      checkIns: ctx.checkIns,
      daily: ctx.daily,
      exportDate: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'peptiderx-export-' + getToday() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    var rows = [['Date', 'Peptide', 'Dose', 'Unit', 'Time', 'Site', 'Notes']];
    ctx.injections.forEach(function(inj) {
      var pepInfo = window.PEPTIDE_MAP[inj.peptideId];
      rows.push([inj.date, pepInfo ? pepInfo.name : inj.peptideId, inj.doseAmount, inj.doseUnit, inj.time, inj.injectionSite, inj.notes || '']);
    });
    var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'peptiderx-injections-' + getToday() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return html`
    <div class="fixed inset-0 z-[90] bg-navy safe-top overflow-y-scroll" style=${{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
      <div class="p-4 max-w-lg mx-auto pb-20">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white">Settings</h2>
          <button class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400" onClick=${props.onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Profile</h3>
            <${FormField} label="Name">
              <${TextInput} value=${form.userName || ''} onChange=${function(v) { updateForm('userName', v); }} />
            <//>
            <${FormField} label="Protocol Start Date">
              <input class="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50" type="date" value=${form.startDate || ''}
                onChange=${function(e) { updateForm('startDate', e.target.value); }} />
            <//>
            <div class="grid grid-cols-2 gap-3">
              <${FormField} label="Current Weight (lbs)">
                <${TextInput} value=${String(form.weight || '')} inputMode="decimal" onChange=${function(v) { updateForm('weight', v); }} />
              <//>
              <${FormField} label="Goal Weight (lbs)">
                <${TextInput} value=${String(form.goalWeight || '')} inputMode="decimal" onChange=${function(v) { updateForm('goalWeight', v); }} />
              <//>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <${FormField} label="Height (inches)">
                <${TextInput} value=${String(form.height || '')} inputMode="decimal" onChange=${function(v) { updateForm('height', v); }} />
              <//>
              <${FormField} label="Target BF %">
                <${TextInput} value=${String(form.targetBF || '')} inputMode="decimal" onChange=${function(v) { updateForm('targetBF', v); }} />
              <//>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Daily Goals</h3>
            <div class="grid grid-cols-2 gap-3">
              <${FormField} label="Protein Goal (g)">
                <${TextInput} value=${String(form.proteinGoal || '')} inputMode="numeric" onChange=${function(v) { updateForm('proteinGoal', v); }} />
              <//>
              <${FormField} label="Water Goal (oz)">
                <${TextInput} value=${String(form.waterGoal || '')} inputMode="numeric" onChange=${function(v) { updateForm('waterGoal', v); }} />
              <//>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Data</h3>
            <div class="space-y-2">
              <${Button} variant="secondary" onClick=${exportCSV} className="w-full">Export Injections (CSV)<//>
              <${Button} variant="secondary" onClick=${exportData} className="w-full">Export All Data (JSON)<//>
            </div>
          </div>

          <${Button} onClick=${save} className="w-full">Save Settings<//>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// BOTTOM NAV
// ============================================================================
function BottomNav(props) {
  var tabs = [
    { id: 0, label: 'Dashboard', icon: html`<${IconDashboard} />` },
    { id: 1, label: 'Log', icon: html`<${IconCalendar} />` },
    { id: 2, label: 'Progress', icon: html`<${IconChart} />` },
    { id: 3, label: 'Protocol', icon: html`<${IconFlask} />` },
    { id: 4, label: 'Library', icon: html`<${IconBook} />` },
  ];

  return html`
    <nav class="fixed bottom-0 left-0 right-0 bg-[#0a0a0f]/95 backdrop-blur-lg border-t border-slate-800/50 z-50 safe-bottom">
      <div class="flex justify-around items-center h-16 max-w-lg mx-auto">
        ${tabs.map(function(tab) {
          var isActive = props.activeTab === tab.id;
          return html`
            <button key=${tab.id} onClick=${function() { props.onChange(tab.id); }}
              class=${'flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] transition-colors duration-200 ' +
                (isActive ? 'text-blue-500' : 'text-slate-500')}>
              ${tab.icon}
              <span class="text-[10px] font-medium">${tab.label}</span>
              ${isActive && html`<div class="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />`}
            </button>
          `;
        })}
      </div>
    </nav>
  `;
}

// ============================================================================
// APP SHELL
// ============================================================================
function AppShell() {
  var tabArr = useState(0);
  var activeTab = tabArr[0]; var setActiveTab = tabArr[1];
  var showSettingsArr = useState(false);
  var showSettings = showSettingsArr[0]; var setShowSettings = showSettingsArr[1];

  var tabContent = null;
  if (activeTab === 0) tabContent = html`<${DashboardTab} onOpenSettings=${function() { setShowSettings(true); }} />`;
  else if (activeTab === 1) tabContent = html`<${LogTab} />`;
  else if (activeTab === 2) tabContent = html`<${ProgressTab} />`;
  else if (activeTab === 3) tabContent = html`<${ProtocolTab} />`;
  else if (activeTab === 4) tabContent = html`<${LibraryTab} />`;

  return html`
    <div class="fixed inset-0 flex flex-col bg-navy">
      <div class="flex-1 overflow-y-scroll safe-top" style=${{ paddingBottom: '80px', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
        <div class="p-4 max-w-lg mx-auto tab-enter" key=${activeTab}>
          ${tabContent}
        </div>
      </div>
      <${BottomNav} activeTab=${activeTab} onChange=${setActiveTab} />
      ${showSettings && html`<${SettingsPage} onClose=${function() { setShowSettings(false); }} />`}
    </div>
  `;
}

// ============================================================================
// MAIN APP
// ============================================================================
function App() {
  var ctx = useApp();

  if (!ctx.isLoaded) {
    return html`
      <div class="h-screen flex items-center justify-center bg-navy">
        <div class="text-center">
          <div class="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4 glow-pulse">
            <${IconSyringe} />
          </div>
          <div class="text-slate-400 text-sm">Loading...</div>
        </div>
      </div>
    `;
  }

  if (!ctx.settings.onboardingComplete) {
    return html`<${OnboardingFlow} />`;
  }

  return html`<${AppShell} />`;
}

// ============================================================================
// RENDER
// ============================================================================
var root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${AppProvider}><${App} /><//>`);
