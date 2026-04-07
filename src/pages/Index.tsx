import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";

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

const MOCK_TABS: TabItem[] = [
  { id: "1", url: "https://habr.com/ru/feed/", title: "Хабр — Лента", active: true },
  { id: "2", url: "https://news.ycombinator.com", title: "Hacker News", active: false },
  { id: "3", url: "https://tproger.ru", title: "Tproger — Программирование", active: true },
  { id: "4", url: "https://dev.to", title: "DEV Community", active: false },
  { id: "5", url: "https://stackoverflow.com/questions", title: "Stack Overflow", active: false },
];

const MOCK_HISTORY: HistoryItem[] = [
  { id: "1", timestamp: "07.04 14:32:18", url: "habr.com/ru/feed", keyword: "React 19", context: "...вышел React 19 с новыми хуками и улучшенным...", matchType: "exact" },
  { id: "2", timestamp: "07.04 13:55:04", url: "tproger.ru", keyword: "TypeScript|Golang", context: "...GoLang продолжает набирать популярность в 2024...", matchType: "regex" },
  { id: "3", timestamp: "07.04 12:10:44", url: "habr.com/ru/feed", keyword: "React 19", context: "...обновление React 19 привносит Server Components...", matchType: "exact" },
  { id: "4", timestamp: "07.04 09:22:11", url: "tproger.ru", keyword: "TypeScript|Golang", context: "...TypeScript 5.4 получил новые возможности типов...", matchType: "regex" },
];

const MOCK_LOGS: LogItem[] = [
  { id: "1", time: "14:32:18", level: "match", message: "Совпадение: \"React 19\" → habr.com/ru/feed" },
  { id: "2", time: "14:32:17", level: "info", message: "Проверка завершена: habr.com/ru/feed (1240 мс)" },
  { id: "3", time: "14:32:15", level: "info", message: "Начало проверки: habr.com/ru/feed" },
  { id: "4", time: "14:30:17", level: "info", message: "Проверка завершена: tproger.ru (890 мс)" },
  { id: "5", time: "14:30:15", level: "info", message: "Начало проверки: tproger.ru" },
  { id: "6", time: "14:28:16", level: "warn", message: "Медленный ответ: habr.com (3200 мс)" },
  { id: "7", time: "14:28:15", level: "info", message: "Начало проверки: habr.com/ru/feed" },
  { id: "8", time: "14:25:00", level: "info", message: "Мониторинг запущен. Активных вкладок: 2" },
];

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "search", label: "Поиск", icon: "Search" },
  { id: "frequency", label: "Частота", icon: "Timer" },
  { id: "tabs", label: "Вкладки", icon: "Globe" },
  { id: "notifications", label: "Алерты", icon: "Bell" },
  { id: "history", label: "История", icon: "Clock" },
  { id: "logs", label: "Логи", icon: "TerminalSquare" },
];

const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
  <div
    onClick={onChange}
    className={`w-8 h-4 rounded-full transition-all duration-200 flex items-center px-0.5 cursor-pointer shrink-0 ${value ? "bg-primary" : "bg-muted"}`}
  >
    <div className={`w-3 h-3 rounded-full bg-white transition-all duration-200 shadow-sm ${value ? "translate-x-4" : "translate-x-0"}`} />
  </div>
);

const OptionRow = ({ icon, label, desc, value, onChange }: { icon: string; label: string; desc: string; value: boolean; onChange: () => void }) => (
  <div
    onClick={onChange}
    className={`flex items-center justify-between px-3 py-2.5 rounded cursor-pointer transition-all duration-150 select-none ${
      value ? "bg-primary/8 border border-primary/20" : "hover:bg-muted/60 border border-transparent"
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
  const [tabs, setTabs] = useState<TabItem[]>(MOCK_TABS);
  const [notifySound, setNotifySound] = useState(true);
  const [notifyBadge, setNotifyBadge] = useState(true);
  const [notifyPopup, setNotifyPopup] = useState(false);
  const [highlightMatches, setHighlightMatches] = useState(true);
  const [stopOnFirst, setStopOnFirst] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  let regexError = "";
  if (useRegex && keyword) {
    try { new RegExp(keyword); } catch { regexError = "Некорректное регулярное выражение"; }
  }

  const formatInterval = (sec: number) => {
    if (sec < 60) return `${sec} сек`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m} мин ${s} сек` : `${m} мин`;
  };

  const activeTabsCount = tabs.filter(t => t.active).length;
  const allActive = tabs.every(t => t.active);

  const currentNav = navItems.find(n => n.id === activeSection)!;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Golos Text', sans-serif" }}>
      {/* Header */}
      <header className="border-b border-border px-5 py-3.5 flex items-center justify-between animate-fade-in shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 border border-border rounded flex items-center justify-center">
            <Icon name="Radar" size={14} className="text-green" />
            {isMonitoring && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse-green" />
            )}
          </div>
          <span className="font-mono text-sm font-medium tracking-tight">WebMonitor</span>
          <span className="text-muted-foreground font-mono text-xs hidden sm:block">v1.0</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className={`status-dot ${isMonitoring ? "active" : "inactive"}`} />
            <span className="hidden sm:block">{isMonitoring ? "активен" : "остановлен"}</span>
          </div>
          <button
            onClick={() => setIsMonitoring(v => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-mono font-medium transition-all duration-200 ${
              isMonitoring
                ? "bg-destructive/15 text-red-alert border border-destructive/25 hover:bg-destructive/25"
                : "bg-primary text-primary-foreground hover:brightness-110"
            }`}
          >
            <Icon name={isMonitoring ? "Square" : "Play"} size={10} />
            {isMonitoring ? "Стоп" : "Запуск"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-14 border-r border-border flex flex-col items-center pt-4 pb-4 gap-1 shrink-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              title={item.label}
              className={`w-10 h-10 flex items-center justify-center rounded transition-all duration-150 ${
                activeSection === item.id
                  ? "bg-primary/12 text-green"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon name={item.icon} size={15} />
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          <div className="max-w-xl animate-fade-in" key={activeSection}>

            {/* Section title */}
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
                        regexError ? "border-destructive/50" : "border-border focus:border-primary/50"
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
                          : `Поиск: "${keyword}"${caseSensitive ? " [регистр]" : ""}${wholeWord ? " [слово]" : ""}`
                        }
                      </span>
                    </div>
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
                      <button
                        key={p.v}
                        onClick={() => setIntervalValue(p.v)}
                        className={`py-1.5 rounded text-xs font-mono transition-all duration-150 ${
                          intervalValue === p.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >{p.l}</button>
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
                  <span>Активных: <span className="text-foreground">{activeTabsCount}</span> / {tabs.length}</span>
                  <button onClick={() => setTabs(prev => prev.map(t => ({ ...t, active: !allActive })))} className="hover:text-foreground transition-colors">
                    {allActive ? "Снять все" : "Выбрать все"}
                  </button>
                </div>

                <div className="space-y-1.5">
                  {tabs.map(tab => (
                    <div
                      key={tab.id}
                      onClick={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, active: !t.active } : t))}
                      className={`section-card flex items-center gap-3 cursor-pointer transition-all duration-150 ${
                        tab.active ? "border-primary/25 bg-primary/5" : "opacity-55 hover:opacity-75"
                      }`}
                    >
                      <div className={`w-1 h-8 rounded-full shrink-0 transition-all ${tab.active ? "bg-primary" : "bg-border"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{tab.title}</div>
                        <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">{tab.url}</div>
                      </div>
                      <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${tab.active ? "border-primary bg-primary" : "border-border"}`}>
                        {tab.active && <Icon name="Check" size={9} className="text-primary-foreground" />}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full section-card border-dashed flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-all py-3">
                  <Icon name="Plus" size={12} />
                  Добавить URL вручную
                </button>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeSection === "notifications" && (
              <div className="space-y-3">
                <div className="section-card space-y-0.5">
                  <label className="label-text block mb-3">Способы уведомления</label>
                  <OptionRow icon="Volume2" label="Звуковой сигнал" desc="Воспроизводить звук при совпадении" value={notifySound} onChange={() => setNotifySound(v => !v)} />
                  <OptionRow icon="Hash" label="Значок на иконке" desc="Показывать счётчик на иконке расширения" value={notifyBadge} onChange={() => setNotifyBadge(v => !v)} />
                  <OptionRow icon="BellRing" label="Всплывающее окно" desc="Системное уведомление браузера" value={notifyPopup} onChange={() => setNotifyPopup(v => !v)} />
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
                  <span>Совпадений: <span className="text-foreground">{MOCK_HISTORY.length}</span></span>
                  <button className="hover:text-red-alert transition-colors flex items-center gap-1">
                    <Icon name="Trash2" size={10} />Очистить
                  </button>
                </div>

                <div className="space-y-2">
                  {MOCK_HISTORY.map((item, i) => (
                    <div key={item.id} className="section-card animate-fade-in" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                            item.matchType === "regex" ? "bg-amber/10 text-amber border border-amber/20" : "bg-primary/10 text-green border border-primary/20"
                          }`}>
                            {item.matchType === "regex" ? "/re/" : "abc"}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground truncate">{item.url}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap shrink-0">{item.timestamp}</span>
                      </div>
                      <div className="text-xs font-mono text-foreground/65 bg-muted/40 rounded px-2.5 py-2 leading-relaxed">
                        {item.context}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Icon name="Tag" size={10} className="text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">{item.keyword}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LOGS ── */}
            {activeSection === "logs" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Проверок", value: "148", icon: "RefreshCw", hi: false },
                    { label: "Совпадений", value: "4", icon: "Zap", hi: true },
                    { label: "Uptime", value: "02:07", icon: "Clock3", hi: false },
                  ].map(s => (
                    <div key={s.label} className={`section-card text-center ${s.hi ? "border-primary/20 bg-primary/5" : ""}`}>
                      <Icon name={s.icon} size={13} className={`mx-auto mb-1.5 ${s.hi ? "text-green" : "text-muted-foreground"}`} />
                      <div className={`font-mono text-xl font-medium leading-none ${s.hi ? "text-green" : "text-foreground"}`}>{s.value}</div>
                      <div className="label-text mt-1.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="section-card p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="label-text">Журнал событий</span>
                    <button className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <Icon name="Download" size={10} />Экспорт
                    </button>
                  </div>
                  <div className="overflow-y-auto max-h-64">
                    {MOCK_LOGS.map(log => (
                      <div key={log.id} className="log-row">
                        <span className="text-muted-foreground/70 whitespace-nowrap w-16 shrink-0">{log.time}</span>
                        <span className={`whitespace-nowrap font-medium w-12 shrink-0 ${
                          log.level === "match" ? "text-green" :
                          log.level === "warn" ? "text-amber" :
                          log.level === "error" ? "text-red-alert" : "text-muted-foreground/60"
                        }`}>
                          {log.level === "match" ? "MATCH" : log.level === "info" ? "INFO" : log.level === "warn" ? "WARN" : "ERR"}
                        </span>
                        <span className="text-foreground/75 truncate">{log.message}</span>
                      </div>
                    ))}
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
