import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const CHECK_PAGE_URL = "https://functions.poehali.dev/31a88c79-57c0-4c6a-a813-cbab8a4c5157";

type Section = "search" | "frequency" | "tabs" | "notifications" | "history" | "logs";

interface TabItem {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  url: string;
  keyword: string;
  context: string;
  matchType: "exact" | "regex";
}

interface LogItem {
  id: string;
  time: string;
  level: "info" | "warn" | "error" | "match";
  message: string;
}

const DEFAULT_TABS: TabItem[] = [
  { id: "1", url: "https://habr.com/ru/feed/", title: "Хабр — Лента", active: false },
  { id: "2", url: "https://news.ycombinator.com", title: "Hacker News", active: false },
  { id: "3", url: "https://example.com", title: "Example.com (тест)", active: true },
];

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "search", label: "Поиск", icon: "Search" },
  { id: "frequency", label: "Частота", icon: "Timer" },
  { id: "tabs", label: "Вкладки", icon: "Globe" },
  { id: "notifications", label: "Алерты", icon: "Bell" },
  { id: "history", label: "История", icon: "Clock" },
  { id: "logs", label: "Логи", icon: "TerminalSquare" },
];

let logIdCounter = 0;
const makeLogId = () => String(++logIdCounter);

function formatTime(d = new Date()) {
  return d.toTimeString().slice(0, 8);
}

function formatTimestamp(d = new Date()) {
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")} ${formatTime(d)}`;
}

const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
  <div
    onClick={e => { e.stopPropagation(); onChange(); }}
    className={`w-8 h-4 rounded-full transition-all duration-200 flex items-center px-0.5 cursor-pointer shrink-0 ${value ? "bg-primary" : "bg-muted border border-border"}`}
  >
    <div className={`w-3 h-3 rounded-full transition-all duration-200 shadow-sm ${value ? "translate-x-4 bg-white" : "translate-x-0 bg-muted-foreground/60"}`} />
  </div>
);

const OptionRow = ({ icon, label, desc, value, onChange }: { icon: string; label: string; desc: string; value: boolean; onChange: () => void }) => (
  <div
    onClick={onChange}
    className={`flex items-center justify-between px-3 py-2.5 rounded cursor-pointer transition-all duration-150 select-none ${
      value ? "bg-primary/6 border border-primary/15" : "hover:bg-muted/60 border border-transparent"
    }`}
  >
    <div className="flex items-center gap-2.5">
      <Icon name={icon} size={13} className={value ? "text-green" : "text-muted-foreground"} />
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
    <Toggle value={value} onChange={onChange} />
  </div>
);

export default function Index() {
  const [activeSection, setActiveSection] = useState<Section>("search");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [intervalValue, setIntervalValue] = useState(30);
  const [tabs, setTabs] = useState<TabItem[]>(DEFAULT_TABS);
  const [newUrl, setNewUrl] = useState("");
  const [notifySound, setNotifySound] = useState(true);
  const [notifyBadge, setNotifyBadge] = useState(true);
  const [notifyPopup, setNotifyPopup] = useState(false);
  const [highlightMatches, setHighlightMatches] = useState(true);
  const [stopOnFirst, setStopOnFirst] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [totalChecks, setTotalChecks] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [startTime] = useState<Date | null>(null);
  const [monitorStartTime, setMonitorStartTime] = useState<Date | null>(null);
  const [uptime, setUptime] = useState("00:00:00");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uptimeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const stopOnFirstRef = useRef(stopOnFirst);
  stopOnFirstRef.current = stopOnFirst;

  let regexError = "";
  if (useRegex && keyword) {
    try { new RegExp(keyword); } catch { regexError = "Некорректное регулярное выражение"; }
  }

  const addLog = useCallback((level: LogItem["level"], message: string) => {
    setLogs(prev => [{ id: makeLogId(), time: formatTime(), level, message }, ...prev].slice(0, 200));
  }, []);

  const checkPage = useCallback(async (tab: TabItem, kw: string, opts: { useRegex: boolean; caseSensitive: boolean; wholeWord: boolean }) => {
    addLog("info", `Проверка: ${tab.url}`);
    const t0 = Date.now();
    try {
      const res = await fetch(CHECK_PAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tab.url, keyword: kw, ...opts }),
      });
      const data = await res.json();
      const elapsed = Date.now() - t0;

      if (data.error) {
        addLog("warn", `Ошибка ${tab.title}: ${data.error}`);
        return false;
      }

      setTotalChecks(n => n + 1);
      addLog("info", `Завершено: ${tab.title} (${elapsed} мс)`);

      if (data.found && data.matches?.length > 0) {
        setTotalMatches(n => n + data.match_count);
        data.matches.slice(0, 2).forEach((m: { matched_text: string; context: string }) => {
          addLog("match", `Совпадение: "${m.matched_text}" → ${tab.url}`);
          setHistory(prev => [{
            id: makeLogId(),
            timestamp: formatTimestamp(),
            url: new URL(tab.url.startsWith("http") ? tab.url : "https://" + tab.url).hostname,
            keyword: kw,
            context: m.context,
            matchType: opts.useRegex ? "regex" : "exact",
          }, ...prev].slice(0, 100));
        });

        if (notifyPopup && "Notification" in window && Notification.permission === "granted") {
          new Notification("WebMonitor: совпадение найдено", { body: `"${kw}" на ${tab.title}` });
        }
        return true;
      }
      return false;
    } catch (e) {
      addLog("error", `Сеть: ${tab.title} — ${String(e)}`);
      return false;
    }
  }, [addLog, notifyPopup]);

  const runCycle = useCallback(async (
    currentTabs: TabItem[],
    kw: string,
    opts: { useRegex: boolean; caseSensitive: boolean; wholeWord: boolean },
    stopFirst: boolean,
  ) => {
    const active = currentTabs.filter(t => t.active);
    if (active.length === 0) {
      addLog("warn", "Нет активных вкладок для проверки");
      return;
    }
    for (const tab of active) {
      const found = await checkPage(tab, kw, opts);
      if (found && stopFirst) {
        addLog("info", "Остановлен: найдено первое совпадение");
        setIsMonitoring(false);
        return;
      }
    }
  }, [checkPage, addLog]);

  useEffect(() => {
    if (!isMonitoring) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (uptimeRef.current) clearInterval(uptimeRef.current);
      setMonitorStartTime(null);
      setUptime("00:00:00");
      return;
    }

    if (!keyword.trim()) {
      addLog("warn", "Не задано ключевое слово");
      setIsMonitoring(false);
      return;
    }
    if (regexError) {
      addLog("error", "Некорректное регулярное выражение");
      setIsMonitoring(false);
      return;
    }

    const activeTabs = tabs.filter(t => t.active);
    if (activeTabs.length === 0) {
      addLog("warn", "Нет активных вкладок. Выберите вкладки для мониторинга.");
      setIsMonitoring(false);
      return;
    }

    const start = new Date();
    setMonitorStartTime(start);
    addLog("info", `Мониторинг запущен. Активных вкладок: ${activeTabs.length}. Интервал: ${intervalValue} сек`);

    const opts = { useRegex, caseSensitive, wholeWord };
    runCycle(tabs, keyword, opts, stopOnFirstRef.current);

    intervalRef.current = setInterval(() => {
      runCycle(tabs, keyword, opts, stopOnFirstRef.current);
    }, intervalValue * 1000);

    uptimeRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, "0");
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      setUptime(`${h}:${m}:${s}`);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    };
  }, [isMonitoring]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const formatInterval = (sec: number) => {
    if (sec < 60) return `${sec} сек`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m} мин ${s} сек` : `${m} мин`;
  };

  const activeTabsCount = tabs.filter(t => t.active).length;
  const allActive = tabs.every(t => t.active);
  const currentNav = navItems.find(n => n.id === activeSection)!;

  const handleAddUrl = () => {
    if (!newUrl.trim()) return;
    const url = newUrl.trim();
    const title = url.replace(/^https?:\/\//, "").split("/")[0];
    setTabs(prev => [...prev, { id: String(Date.now()), url: url.startsWith("http") ? url : "https://" + url, title, active: true }]);
    setNewUrl("");
  };

  const logLevelColors: Record<LogItem["level"], string> = {
    match: "text-green",
    warn: "text-amber",
    error: "text-red-alert",
    info: "text-muted-foreground/70",
  };
  const logLevelLabels: Record<LogItem["level"], string> = { match: "MATCH", warn: "WARN", error: "ERR", info: "INFO" };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Golos Text', sans-serif" }}>
      {/* Header */}
      <header className="border-b border-border px-5 py-3 flex items-center justify-between animate-fade-in shrink-0 bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 border border-border rounded flex items-center justify-center bg-background">
            <Icon name="Radar" size={14} className="text-green" />
            {isMonitoring && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse-green" />
            )}
          </div>
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">WebMonitor</span>
          <span className="text-muted-foreground font-mono text-xs hidden sm:block">v1.0</span>
        </div>

        <div className="flex items-center gap-3">
          {isMonitoring && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              <Icon name="Clock" size={10} />
              {uptime}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className={`status-dot ${isMonitoring ? "active" : "inactive"}`} />
            <span className="hidden sm:block">{isMonitoring ? "активен" : "остановлен"}</span>
          </div>
          <button
            onClick={() => setIsMonitoring(v => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-mono font-medium transition-all duration-200 ${
              isMonitoring
                ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                : "bg-primary text-primary-foreground hover:brightness-105 shadow-sm"
            }`}
          >
            <Icon name={isMonitoring ? "Square" : "Play"} size={10} />
            {isMonitoring ? "Стоп" : "Запуск"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-14 border-r border-border flex flex-col items-center pt-3 pb-3 gap-1 shrink-0 bg-card">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              title={item.label}
              className={`relative w-10 h-10 flex items-center justify-center rounded transition-all duration-150 ${
                activeSection === item.id
                  ? "bg-primary/10 text-green"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon name={item.icon} size={15} />
              {item.id === "history" && history.length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 bg-background">
          <div className="max-w-xl animate-fade-in" key={activeSection}>

            <div className="flex items-center gap-2 mb-5">
              <Icon name={currentNav.icon} size={13} className="text-green" />
              <span className="label-text">{currentNav.label}</span>
              <div className="flex-1 h-px bg-border ml-2" />
            </div>

            {/* ── SEARCH ── */}
            {activeSection === "search" && (
              <div className="space-y-3">
                <div className="section-card">
                  <label className="label-text block mb-3">Ключевое слово / Паттерн</label>
                  <div className="relative">
                    <input
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      placeholder={useRegex ? "Паттерн, напр. React\\s\\d+" : "Введите ключевое слово..."}
                      className={`w-full bg-muted border rounded px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors ${
                        regexError ? "border-destructive/50 focus:border-destructive/70" : "border-border focus:border-primary/50"
                      }`}
                    />
                    {useRegex && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground pointer-events-none">/re/</span>
                    )}
                  </div>
                  {regexError && (
                    <p className="mt-2 text-xs font-mono text-red-alert flex items-center gap-1.5">
                      <Icon name="AlertCircle" size={11} />
                      {regexError}
                    </p>
                  )}
                </div>

                <div className="section-card space-y-0.5">
                  <label className="label-text block mb-3">Параметры</label>
                  <OptionRow icon="Code2" label="Регулярное выражение" desc="Использовать RegExp паттерн" value={useRegex} onChange={() => setUseRegex(v => !v)} />
                  <OptionRow icon="CaseSensitive" label="Учитывать регистр" desc="Строгое совпадение A ≠ a" value={caseSensitive} onChange={() => setCaseSensitive(v => !v)} />
                  <OptionRow icon="Spline" label="Целое слово" desc="Совпадение только целых слов" value={wholeWord} onChange={() => setWholeWord(v => !v)} />
                </div>

                {keyword && !regexError && (
                  <div className="section-card border-green bg-green-dim">
                    <div className="flex items-center gap-2">
                      <Icon name="CheckCircle2" size={12} className="text-green shrink-0" />
                      <span className="text-xs font-mono text-green truncate">
                        {useRegex
                          ? `Паттерн: /${keyword}/${caseSensitive ? "" : "i"}`
                          : `Поиск: "${keyword}"${caseSensitive ? " [регистр]" : ""}${wholeWord ? " [слово]" : ""}`}
                      </span>
                    </div>
                  </div>
                )}

                {!keyword && (
                  <div className="section-card border-dashed text-center py-4">
                    <p className="text-xs text-muted-foreground">Введите слово и нажмите <span className="font-mono font-medium text-foreground">Запуск</span> вверху</p>
                  </div>
                )}
              </div>
            )}

            {/* ── FREQUENCY ── */}
            {activeSection === "frequency" && (
              <div className="space-y-3">
                <div className="section-card">
                  <label className="label-text block mb-4">Интервал проверки</label>
                  <div className="text-center mb-5">
                    <span className="font-mono text-[2.5rem] font-light tracking-tighter text-foreground leading-none">
                      {formatInterval(intervalValue)}
                    </span>
                  </div>
                  <input
                    type="range" min={5} max={600} step={5} value={intervalValue}
                    onChange={e => setIntervalValue(+e.target.value)}
                    className="w-full cursor-pointer"
                    style={{ accentColor: "hsl(var(--primary))" }}
                  />
                  <div className="flex justify-between mt-1.5 text-xs font-mono text-muted-foreground">
                    <span>5 сек</span><span>10 мин</span>
                  </div>
                </div>

                <div className="section-card">
                  <label className="label-text block mb-3">Быстрый выбор</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[{l:"5 сек",v:5},{l:"15 сек",v:15},{l:"30 сек",v:30},{l:"1 мин",v:60},{l:"2 мин",v:120},{l:"5 мин",v:300},{l:"10 мин",v:600}].map(p => (
                      <button key={p.v} onClick={() => setIntervalValue(p.v)}
                        className={`py-1.5 rounded text-xs font-mono transition-all duration-150 ${
                          intervalValue === p.v ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}>{p.l}</button>
                    ))}
                  </div>
                </div>

                <div className="section-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Следующая проверка</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {isMonitoring ? `~${formatInterval(intervalValue)}` : "мониторинг не запущен"}
                    </div>
                  </div>
                  <span className={`status-dot ${isMonitoring ? "active" : "inactive"}`} />
                </div>
              </div>
            )}

            {/* ── TABS ── */}
            {activeSection === "tabs" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>Активных: <span className="text-foreground font-medium">{activeTabsCount}</span> / {tabs.length}</span>
                  <button onClick={() => setTabs(prev => prev.map(t => ({ ...t, active: !allActive })))} className="hover:text-foreground transition-colors">
                    {allActive ? "Снять все" : "Выбрать все"}
                  </button>
                </div>

                <div className="space-y-1.5">
                  {tabs.map(tab => (
                    <div key={tab.id}
                      onClick={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, active: !t.active } : t))}
                      className={`section-card flex items-center gap-3 cursor-pointer transition-all duration-150 ${
                        tab.active ? "border-primary/20 bg-primary/4" : "opacity-55 hover:opacity-80"
                      }`}
                    >
                      <div className={`w-1 h-8 rounded-full shrink-0 transition-all ${tab.active ? "bg-primary" : "bg-border"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-foreground">{tab.title}</div>
                        <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">{tab.url}</div>
                      </div>
                      <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${tab.active ? "border-primary bg-primary" : "border-border bg-background"}`}>
                        {tab.active && <Icon name="Check" size={9} className="text-white" />}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="section-card flex gap-2">
                  <input
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddUrl()}
                    placeholder="https://example.com/page"
                    className="flex-1 bg-muted border border-border rounded px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
                  />
                  <button onClick={handleAddUrl} className="px-3 py-2 bg-primary text-primary-foreground rounded text-xs font-mono hover:brightness-105 transition-all shrink-0">
                    <Icon name="Plus" size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeSection === "notifications" && (
              <div className="space-y-3">
                <div className="section-card space-y-0.5">
                  <label className="label-text block mb-3">Способы уведомления</label>
                  <OptionRow icon="Volume2" label="Звуковой сигнал" desc="Воспроизводить звук при совпадении" value={notifySound} onChange={() => setNotifySound(v => !v)} />
                  <OptionRow icon="Hash" label="Значок на иконке" desc="Счётчик совпадений" value={notifyBadge} onChange={() => setNotifyBadge(v => !v)} />
                  <OptionRow icon="BellRing" label="Системное уведомление" desc="Всплывающее окно браузера" value={notifyPopup} onChange={() => {
                    if (!notifyPopup && "Notification" in window) Notification.requestPermission();
                    setNotifyPopup(v => !v);
                  }} />
                </div>

                <div className="section-card space-y-0.5">
                  <label className="label-text block mb-3">Поведение</label>
                  <OptionRow icon="Highlighter" label="Подсветка на странице" desc="Выделять найденные слова цветом" value={highlightMatches} onChange={() => setHighlightMatches(v => !v)} />
                  <OptionRow icon="OctagonX" label="Стоп при первом совпадении" desc="Прекратить мониторинг после находки" value={stopOnFirst} onChange={() => setStopOnFirst(v => !v)} />
                </div>
              </div>
            )}

            {/* ── HISTORY ── */}
            {activeSection === "history" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>Совпадений: <span className="text-foreground font-medium">{history.length}</span></span>
                  {history.length > 0 && (
                    <button onClick={() => setHistory([])} className="hover:text-red-alert transition-colors flex items-center gap-1">
                      <Icon name="Trash2" size={10} />Очистить
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="section-card text-center py-10">
                    <Icon name="SearchX" size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Совпадений ещё не найдено</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Введите ключевое слово и запустите мониторинг</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item, i) => (
                      <div key={item.id} className="section-card animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                              item.matchType === "regex" ? "bg-amber/10 text-amber border border-amber/20" : "bg-primary/8 text-green border border-primary/15"
                            }`}>
                              {item.matchType === "regex" ? "/re/" : "abc"}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground truncate">{item.url}</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground whitespace-nowrap shrink-0">{item.timestamp}</span>
                        </div>
                        <div className="text-xs font-mono text-foreground/70 bg-muted/60 rounded px-2.5 py-2 leading-relaxed">
                          {item.context}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Icon name="Tag" size={10} className="text-muted-foreground" />
                          <span className="text-xs font-mono text-muted-foreground">{item.keyword}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── LOGS ── */}
            {activeSection === "logs" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Проверок", value: String(totalChecks), icon: "RefreshCw", hi: false },
                    { label: "Совпадений", value: String(totalMatches), icon: "Zap", hi: true },
                    { label: "Uptime", value: isMonitoring ? uptime : "—", icon: "Clock3", hi: false },
                  ].map(s => (
                    <div key={s.label} className={`section-card text-center ${s.hi && totalMatches > 0 ? "border-primary/20 bg-primary/4" : ""}`}>
                      <Icon name={s.icon} size={13} className={`mx-auto mb-1.5 ${s.hi && totalMatches > 0 ? "text-green" : "text-muted-foreground"}`} />
                      <div className={`font-mono text-xl font-medium leading-none ${s.hi && totalMatches > 0 ? "text-green" : "text-foreground"}`}>{s.value}</div>
                      <div className="label-text mt-1.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="section-card p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="label-text">Журнал событий</span>
                    <button onClick={() => setLogs([])} className="text-xs font-mono text-muted-foreground hover:text-red-alert transition-colors flex items-center gap-1">
                      <Icon name="Trash2" size={10} />Очистить
                    </button>
                  </div>
                  <div className="overflow-y-auto max-h-72">
                    {logs.length === 0 ? (
                      <div className="text-center py-6 text-xs font-mono text-muted-foreground/60">Лог пуст — запустите мониторинг</div>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className="log-row">
                          <span className="text-muted-foreground/60 whitespace-nowrap w-16 shrink-0">{log.time}</span>
                          <span className={`whitespace-nowrap font-medium w-12 shrink-0 ${logLevelColors[log.level]}`}>
                            {logLevelLabels[log.level]}
                          </span>
                          <span className="text-foreground/80 truncate">{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
