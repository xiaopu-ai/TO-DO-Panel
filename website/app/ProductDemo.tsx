"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import {
  DEMO_STEPS,
  advanceDemoStep,
  getShowcaseStepForTab,
} from "./demoTimeline.mjs";
import "./ProductDemo.css";

const DEMO_TABS = [
  { id: "home", label: "首页" },
  { id: "todo", label: "待办" },
  { id: "links", label: "链接" },
  { id: "recordings", label: "录制" },
  { id: "notes", label: "笔记" },
] as const;

type DemoTab = (typeof DEMO_TABS)[number]["id"];
type DemoPhase = "collapsed" | "expanding" | "showcase" | "returning" | "collapsing";

function TabIcon({ tab }: { tab: DemoTab }) {
  if (tab === "home") {
    return (
      <svg className="pd-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" />
      </svg>
    );
  }
  if (tab === "todo") {
    return (
      <svg className="pd-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10M4 12h10M4 17h7M17.5 7.5 19 9l2.5-3" />
      </svg>
    );
  }
  if (tab === "links") {
    return (
      <svg className="pd-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.5 14.5 14.5 9.5M7.2 16.8l-1 1a3.5 3.5 0 0 1-5-5l3.2-3.2a3.5 3.5 0 0 1 5 0M16.8 7.2l1-1a3.5 3.5 0 1 1 5 5l-3.2 3.2a3.5 3.5 0 0 1-5 0" />
      </svg>
    );
  }
  if (tab === "recordings") {
    return (
      <svg className="pd-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" />
      </svg>
    );
  }
  return (
    <svg className="pd-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

const TODO_GROUPS = [
  {
    id: "P0",
    label: "紧急 · 重要",
    color: "red",
    items: [
      ["确认发布版本", true],
      ["检查安装包", false],
    ],
  },
  {
    id: "P1",
    label: "重要 · 不紧急",
    color: "orange",
    items: [
      ["完善新手说明", false],
      ["整理体验反馈", false],
    ],
  },
  {
    id: "P2",
    label: "紧急 · 不重要",
    color: "green",
    items: [
      ["回复测试消息", false],
      ["核对演示内容", true],
    ],
  },
  {
    id: "P3",
    label: "日常 · 待办",
    color: "blue",
    items: [
      ["清理演示截图", false],
      ["归档旧文档", false],
    ],
  },
] as const;

const APPS = [
  ["✦", "Safari", "safari", "blue"],
  [">_", "终端", "terminal", "graphite"],
  ["≡", "备忘录", "notes", "yellow"],
  ["●", "Figma", "figma", "rose"],
  ["6", "日历", "calendar", "red"],
  ["✉", "邮件", "mail", "sky"],
  ["⌁", "预览", "preview", "indigo"],
  ["⌁", "活动监视器", "activity", "green"],
  ["◇", "快捷指令", "shortcuts", "violet"],
  ["A", "文本编辑", "textedit", "silver"],
  ["♪", "音乐", "music", "rose"],
  ["✣", "照片", "photos", "silver"],
  ["•••", "信息", "messages", "green"],
  ["⚙", "系统设置", "settings", "graphite"],
  ["＋", "计算器", "calculator", "orange"],
  ["◒", "访达", "finder", "blue"],
  ["X", "Xcode", "preview", "blue"],
  ["⌘", "脚本编辑器", "shortcuts", "violet"],
  ["✓", "提醒事项", "notes", "yellow"],
  ["◉", "地图", "safari", "green"],
  ["B", "图书", "notes", "orange"],
  ["P", "播客", "music", "violet"],
  ["◫", "FaceTime", "messages", "green"],
  ["◷", "时钟", "settings", "graphite"],
  ["∿", "语音备忘录", "activity", "red"],
  ["N", "Numbers", "activity", "green"],
  ["P", "Pages", "textedit", "orange"],
  ["K", "Keynote", "preview", "blue"],
  ["<> ", "VS Code", "terminal", "blue"],
  ["D", "Discord", "shortcuts", "violet"],
  ["S", "Slack", "figma", "rose"],
  ["◎", "Chrome", "safari", "red"],
  ["A", "Arc", "terminal", "silver"],
  ["Z", "Zoom", "preview", "blue"],
  ["O", "Obsidian", "shortcuts", "violet"],
  ["R", "Raycast", "terminal", "rose"],
  ["C", "Cursor", "terminal", "silver"],
  ["G", "GitHub", "terminal", "graphite"],
  ["T", "Things", "notes", "blue"],
  ["I", "iA Writer", "textedit", "silver"],
  ["L", "Linear", "shortcuts", "indigo"],
  ["F", "Firefox", "safari", "orange"],
  ["V", "VLC", "calculator", "orange"],
  ["M", "Mimestream", "mail", "sky"],
  ["P", "Pixelmator", "photos", "rose"],
  ["C", "CleanShot", "preview", "indigo"],
  ["D", "Docker", "finder", "blue"],
  ["H", "Home", "messages", "green"],
] as const;

function HomePanel() {
  const [mirrorOn, setMirrorOn] = useState(false);
  const [openedApp, setOpenedApp] = useState<string | null>(null);

  return (
    <div className="pd-home-grid">
      <section className="pd-tile pd-home-clock">
        <span className="pd-clock-date">8 月 6 日 · 星期四</span>
        <div className="pd-clock-time"><strong>09:<em>41</em></strong><small>26</small></div>
      </section>

      <button
        className={`pd-tile pd-home-mirror${mirrorOn ? " is-on" : ""}`}
        type="button"
        aria-pressed={mirrorOn}
        onClick={() => setMirrorOn((value) => !value)}
      >
        <div className={`pd-mirror-stage${mirrorOn ? " is-live" : ""}`}>
          {mirrorOn ? (
            <span className="pd-mirror-person" aria-hidden="true"><i /><b /></span>
          ) : (
            <span className="pd-camera-glyph"><i /></span>
          )}
          <strong>{mirrorOn ? "镜子已开启" : "镜子"}</strong>
          <small>{mirrorOn ? "再次点按关闭" : "点按开启"}</small>
        </div>
      </button>

      <section className="pd-tile pd-home-quick">
        <div className="pd-tile-header"><span>快捷应用</span><b>＋</b></div>
        <div className="pd-quick-grid">
          {APPS.slice(0, 6).map(([glyph, name, icon, tone]) => (
            <button
              className={`pd-quick-app${openedApp === name ? " is-launched" : ""}`}
              type="button"
              aria-label={`模拟打开 ${name}`}
              onClick={() => setOpenedApp(name)}
              key={name}
            >
              <span className={`pd-app-icon pd-icon-${icon} pd-tone-${tone}`}>{glyph}</span>
              <small>{openedApp === name ? "已打开" : name}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="pd-tile pd-home-note">
        <div className="pd-note-tools" aria-hidden="true">
          <span>H</span><span><b>B</b></span><span><i>I</i></span><span>•</span><span>1.</span><span>✓</span><span>”</span><span>&lt;&gt;</span>
          <div><span>编辑</span><b>预览</b></div>
        </div>
        <div className="pd-note-copy">
          <strong># 今天</strong>
          <p><span>✓</span><s>整理首页文案</s></p>
          <p><span />检查下载流程</p>
          <p><span />回复体验反馈</p>
          <blockquote>先把最重要的一件事做完。</blockquote>
        </div>
      </section>

      <section className="pd-tile pd-home-favorites">
        <div className="pd-tile-header"><span>收藏剪贴</span><small>3</small></div>
        <div className="pd-favorite-clips">
          <p>今天先完成最重要的一件事。</p>
          <p>github.com/xiaopu-ai/TO-DO-Panel</p>
          <p>npm run build</p>
        </div>
      </section>
    </div>
  );
}

function TodoPanel() {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      TODO_GROUPS.flatMap((group) =>
        group.items.map(([text, done]) => [`${group.id}:${text}`, done]),
      ),
    ),
  );

  const toggleTask = (key: string) => {
    setCompleted((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="pd-todo-grid">
      {TODO_GROUPS.map((group) => {
        const remaining = group.items.filter(([text]) => !completed[`${group.id}:${text}`]).length;
        return (
          <section className={`pd-tile pd-todo-group pd-group-${group.color}`} key={group.id}>
            <header>
              <i className={`pd-priority-dot pd-dot-${group.color}`} />
              <strong>{group.id}</strong>
              <span>{group.label}</span>
              <small>{remaining}</small>
            </header>
            <div className="pd-tasks">
              {group.items.map(([text]) => {
                const taskKey = `${group.id}:${text}`;
                const done = completed[taskKey];
                return (
                  <button
                    className={done ? "pd-task is-done" : "pd-task"}
                    type="button"
                    aria-pressed={done}
                    onClick={() => toggleTask(taskKey)}
                    key={text}
                  >
                    <i>{done ? "✓" : ""}</i><span>{text}</span>
                  </button>
                );
              })}
            </div>
            <div className="pd-add-task">添加 {group.id} 待办，回车保存…</div>
          </section>
        );
      })}
    </div>
  );
}

function LinksPanel() {
  const [selectedGroup, setSelectedGroup] = useState("work");
  const groups = [
    { id: "work", label: "工作", count: 4 },
    { id: "design", label: "设计灵感", count: 3 },
    { id: "reading", label: "稍后阅读", count: 5 },
  ];
  const links = [
    ["项目发布检查清单", "github.com/xiaopu-ai/TO-DO-Panel", "GH"],
    ["Apple 设计资源", "developer.apple.com/design", "A"],
    ["React 交互组件", "reactbits.dev", "R"],
    ["Framer 页面参考", "framer.com", "F"],
  ];

  return (
    <div className="pd-links-layout">
      <aside className="pd-tile pd-link-sidebar">
        <header><span>分组</span><button type="button" aria-label="新建链接分组">＋</button></header>
        {groups.map((group) => (
          <button
            className={selectedGroup === group.id ? "is-active" : ""}
            type="button"
            onClick={() => setSelectedGroup(group.id)}
            key={group.id}
          >
            <span>{group.label}</span><small>{group.count}</small>
          </button>
        ))}
      </aside>
      <section className="pd-link-main">
        <div className="pd-link-input"><span>↗</span><p>粘贴公开链接，回车保存…</p><kbd>↵</kbd></div>
        <div className="pd-link-grid">
          {links.map(([title, url, mark], index) => (
            <button className="pd-tile pd-link-card" type="button" key={url}>
              <span className={`pd-link-mark pd-link-mark-${index}`}>{mark}</span>
              <strong>{title}</strong>
              <small>{url}</small>
              <i>↗</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecordingsPanel() {
  const [playing, setPlaying] = useState(false);
  const bars = [7, 13, 9, 18, 24, 16, 29, 20, 12, 26, 33, 21, 15, 28, 18, 10, 23, 31, 17, 8];

  return (
    <div className="pd-recordings-layout">
      <section className="pd-tile pd-recorder-live">
        <div className="pd-recorder-heading"><span className="pd-record-dot" />快速录音<small>转写已启用</small></div>
        <strong className="pd-record-time">00:18</strong>
        <div className="pd-waveform" aria-hidden="true">
          {bars.map((height, index) => <i style={{ height: `${height}%` }} key={`${height}-${index}`} />)}
        </div>
        <p>把今天的页面交互检查一遍，然后整理发布说明…</p>
        <div className="pd-record-controls"><button type="button" aria-label="停止录音">■</button><button type="button" aria-label="暂停录音">Ⅱ</button></div>
      </section>
      <section className="pd-recording-list">
        <header><div><span>录音资料库</span><small>今天 · 3 条</small></div><button type="button">在访达中查看 ↗</button></header>
        {[
          ["官网交互修改", "00:42", "10:26"],
          ["下周内容计划", "02:18", "09:54"],
          ["产品功能备忘", "01:06", "昨天"],
        ].map(([title, duration, time], index) => (
          <button
            className={`pd-tile pd-recording-row${playing && index === 0 ? " is-playing" : ""}`}
            type="button"
            onClick={() => index === 0 && setPlaying((value) => !value)}
            key={title}
          >
            <span>{playing && index === 0 ? "Ⅱ" : "▶"}</span>
            <div><strong>{title}</strong><small>{time}</small></div>
            <time>{duration}</time>
          </button>
        ))}
      </section>
    </div>
  );
}

function NotesPanel() {
  const notes = [
    { title: "今天的工作记录", time: "刚刚", preview: "先完成发布检查，再整理下一轮体验反馈。" },
    { title: "产品体验清单", time: "27 分钟前", preview: "检查展开、收起、提醒和窗口跳转。" },
    { title: "下周内容计划", time: "昨天", preview: "把录音资料整理成三个可执行主题。" },
  ];
  const [activeNote, setActiveNote] = useState(0);

  return (
    <div className="pd-notes-layout">
      <section className="pd-tile pd-notes-library">
        <header><div><span>笔记资料库</span><small>{notes.length} 条</small></div><button type="button">＋ 新建</button></header>
        <div className="pd-note-list">
          {notes.map((note, index) => (
            <button className={activeNote === index ? "is-active" : ""} type="button" onClick={() => setActiveNote(index)} key={note.title}>
              <strong>{note.title}</strong><p>{note.preview}</p><small>{note.time}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="pd-tile pd-note-editor">
        <header><div><span>正在编辑</span><small>自动保存在本机</small></div><button type="button">重命名</button></header>
        <h3>{notes[activeNote].title}</h3>
        <p>{notes[activeNote].preview}</p>
        <ul><li>确认当前优先级</li><li>记录下一步动作</li><li>完成后归档</li></ul>
      </section>
    </div>
  );
}

function PanelContent({ tab }: { tab: DemoTab }) {
  if (tab === "todo") return <TodoPanel />;
  if (tab === "links") return <LinksPanel />;
  if (tab === "recordings") return <RecordingsPanel />;
  if (tab === "notes") return <NotesPanel />;
  return <HomePanel />;
}

export default function ProductDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeTabRef = useRef<DemoTab>("home");
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idBase = useId().replaceAll(":", "");

  const [activeTab, setActiveTab] = useState<DemoTab>("home");
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("collapsed");
  const [stepIndex, setStepIndex] = useState(0);
  const [cursorTab, setCursorTab] = useState<DemoTab>("home");
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorPressing, setCursorPressing] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [focusHeld, setFocusHeld] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [indicatorGeometry, setIndicatorGeometry] = useState({ left: 0, width: 0 });

  const selectTab = useCallback((tab: DemoTab) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
  }, []);

  const pauseAutoplay = useCallback(() => {
    setManualPause(true);
    setCursorVisible(false);
    setCursorPressing(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setManualPause(false);
      resumeTimerRef.current = null;
    }, 8000);
  }, []);

  const chooseTab = useCallback((tab: DemoTab) => {
    pauseAutoplay();
    setDemoPhase("showcase");
    setStepIndex(getShowcaseStepForTab(tab));
    selectTab(tab);
  }, [pauseAutoplay, selectTab]);

  const moveCursorToTab = useCallback((tab: DemoTab) => {
    const screen = screenRef.current;
    const index = DEMO_TABS.findIndex((item) => item.id === tab);
    const target = tabRefs.current[index];
    if (!screen || !target) return;

    const screenRect = screen.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setCursorPosition({
      x: targetRect.left - screenRect.left + targetRect.width * 0.48,
      y: targetRect.top - screenRect.top + targetRect.height * 0.56,
    });
  }, []);

  const updateIndicator = useCallback((tab: DemoTab) => {
    const index = DEMO_TABS.findIndex((item) => item.id === tab);
    const target = tabRefs.current[index];
    if (!target) return;
    setIndicatorGeometry({ left: target.offsetLeft, width: target.offsetWidth });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.18;
        setIsInView(visible);
        if (!visible) {
          setCursorVisible(false);
          setCursorPressing(false);
        }
      },
      { threshold: [0, 0.18, 0.45] },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState === "visible";
      setPageVisible(visible);
      if (!visible) {
        setCursorVisible(false);
        setCursorPressing(false);
      }
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReduceMotion(media.matches);
      if (media.matches) {
        setCursorVisible(false);
        setCursorPressing(false);
        setDemoPhase("showcase");
        selectTab("home");
      }
    };
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, [selectTab]);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      moveCursorToTab(cursorTab);
      updateIndicator(activeTabRef.current);
    });
    observer.observe(screen);
    return () => observer.disconnect();
  }, [cursorTab, moveCursorToTab, updateIndicator]);

  useEffect(() => updateIndicator(activeTab), [activeTab, updateIndicator]);

  const canAutoplay =
    autoplayEnabled && isInView && pageVisible && !manualPause && !focusHeld && !reduceMotion;

  useEffect(() => {
    if (!canAutoplay) {
      return;
    }

    const step = DEMO_STEPS[stepIndex] as {
      phase: DemoPhase;
      tab: DemoTab;
      duration: number;
    };
    let stopped = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!stopped) callback();
      }, delay);
      timers.add(timer);
    };

    const shouldGuideToTab =
      (step.phase === "showcase" || step.phase === "returning") &&
      activeTabRef.current !== step.tab;

    later(() => {
      setCursorPressing(false);
      setDemoPhase(step.phase);
      if (shouldGuideToTab) {
        setCursorTab(step.tab);
        moveCursorToTab(step.tab);
        setCursorVisible(true);
      } else {
        selectTab(step.tab);
        setCursorVisible(false);
      }
    }, 0);

    if (shouldGuideToTab) {
      later(() => setCursorPressing(true), 600);
      later(() => {
        selectTab(step.tab);
        setCursorPressing(false);
      }, 760);
      later(() => setCursorVisible(false), 1180);
    }

    later(() => setStepIndex((current) => advanceDemoStep(current)), step.duration);

    return () => {
      stopped = true;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [canAutoplay, moveCursorToTab, selectTab, stepIndex]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % DEMO_TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + DEMO_TABS.length) % DEMO_TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = DEMO_TABS.length - 1;
    else return;

    event.preventDefault();
    chooseTab(DEMO_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleFocusOut(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setFocusHeld(false);
    }
  }

  function toggleAutoplay() {
    const nextEnabled = !autoplayEnabled;
    setAutoplayEnabled(nextEnabled);
    setCursorVisible(false);
    setCursorPressing(false);
    if (nextEnabled) {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
      setManualPause(false);
      setStepIndex(0);
      setDemoPhase("collapsed");
    }
  }

  let demoStatusText = "切页、勾选、筛选、搜索与滚动，都可以由你接管。";
  if (reduceMotion) demoStatusText = "已遵循系统设置关闭自动动画，五个页面仍可手动操作。";
  else if (focusHeld) demoStatusText = "你正在操作当前控件；焦点离开后会自动续播。";
  else if (manualPause && autoplayEnabled) demoStatusText = "演示已让位，稍后会从当前页面继续。";
  else if (!autoplayEnabled) demoStatusText = "自动演示已暂停，五个页面仍可手动操作。";

  return (
    <div
      className="pd-root"
      ref={rootRef}
      role="region"
      aria-label="TO-DO Panel 交互产品演示"
    >
      <div className="pd-hardware">
        <div
          className="pd-screen"
          ref={screenRef}
          onPointerDownCapture={pauseAutoplay}
          onTouchStart={pauseAutoplay}
          onFocusCapture={() => {
            setFocusHeld(true);
            pauseAutoplay();
          }}
          onBlurCapture={handleFocusOut}
        >
          <div className="pd-wallpaper" aria-hidden="true"><i /><i /><i /></div>
          <div className="pd-menu-bar" aria-hidden="true">
            <div><strong>●</strong><span>TO-DO Panel</span><span>文件</span><span>编辑</span></div>
            <div><span>⌁</span><span>◉</span><span>周四 09:41</span></div>
          </div>
          <button
            className="pd-physical-notch"
            type="button"
            aria-label="展开 TO-DO Panel 演示"
            onClick={() => {
              pauseAutoplay();
              setDemoPhase("showcase");
              setStepIndex(2);
            }}
          ><i /></button>

          <div className="pd-app-window" data-demo-phase={demoPhase}>
            <div className="pd-app-topbar">
              <div className="pd-tab-list" ref={tabListRef} role="tablist" aria-label="TO-DO Panel 页面">
                {DEMO_TABS.map((tab, index) => (
                  <button
                    type="button"
                    role="tab"
                    id={`${idBase}-tab-${tab.id}`}
                    aria-controls={`${idBase}-panel-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    className={activeTab === tab.id ? "is-active" : ""}
                    key={tab.id}
                    ref={(node) => { tabRefs.current[index] = node; }}
                    onClick={() => chooseTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    <TabIcon tab={tab.id} />{tab.label}
                  </button>
                ))}
                <span
                  className="pd-tab-indicator"
                  style={{ left: indicatorGeometry.left, width: indicatorGeometry.width }}
                  aria-hidden="true"
                />
              </div>
              <div className="pd-topbar-safe" />
              <span className="pd-collapse" aria-hidden="true">⌃</span>
            </div>

            <div className="pd-panel-stack">
              {DEMO_TABS.map((tab) => (
                <div
                  className={activeTab === tab.id ? "pd-panel is-active" : "pd-panel"}
                  id={`${idBase}-panel-${tab.id}`}
                  role="tabpanel"
                  aria-labelledby={`${idBase}-tab-${tab.id}`}
                  aria-hidden={activeTab !== tab.id}
                  inert={activeTab !== tab.id}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  key={tab.id}
                >
                  <PanelContent tab={tab.id} />
                </div>
              ))}
            </div>
          </div>

          <div className="pd-desktop-dock" aria-hidden="true">
            {APPS.slice(0, 7).map(([glyph, name, icon, tone]) => (
              <span className={`pd-icon-${icon} pd-tone-${tone}`} key={name}>{glyph}</span>
            ))}
          </div>

          <div
            className={`pd-auto-cursor${cursorVisible ? " is-visible" : ""}${cursorPressing ? " is-pressing" : ""}`}
            style={{
              "--pd-cursor-x": `${cursorPosition.x}px`,
              "--pd-cursor-y": `${cursorPosition.y}px`,
            } as CSSProperties}
            aria-hidden="true"
          >
            <span><i /></span>
          </div>
        </div>
        <div className="pd-camera-mark" aria-hidden="true" />
      </div>
      <div className="pd-hinge" aria-hidden="true"><span /></div>
      <div className="pd-mobile-tabs" role="group" aria-label="移动端演示页面">
        {DEMO_TABS.map((tab) => (
          <button
            className={activeTab === tab.id ? "is-active" : ""}
            type="button"
            aria-pressed={activeTab === tab.id}
            onClick={() => chooseTab(tab.id)}
            key={tab.id}
          >
            <TabIcon tab={tab.id} />{tab.label}
          </button>
        ))}
      </div>
      <div className="pd-demo-footer">
        <button
          className="pd-autoplay-toggle"
          type="button"
          aria-pressed={reduceMotion || !autoplayEnabled}
          disabled={reduceMotion}
          onClick={toggleAutoplay}
        >
          <span aria-hidden="true">{reduceMotion ? "—" : autoplayEnabled ? "Ⅱ" : "▶"}</span>
          {reduceMotion ? "已关闭自动演示" : autoplayEnabled ? "暂停自动演示" : "继续自动演示"}
        </button>
        <p className="pd-a11y-note" aria-live="polite" aria-atomic="true">
          {demoStatusText}
        </p>
      </div>
    </div>
  );
}
