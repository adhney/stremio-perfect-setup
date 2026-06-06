import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Check, LogIn, UserPlus } from 'lucide-react';
import { useWizard } from '../store/wizard';
import { getGuideStatsUrl, resolveSiteUrl } from '../lib/site';
import {
  ACTIVE_KEY_SCREENS,
  AIO_SECTION_START_STEP,
  KEY_SCREEN_START_STEP,
  getCatalogStep,
  getWatchlyStep,
  getInstallStep,
} from '../lib/keyScreens';

interface Props {
  onClose: () => void;
}

interface SidebarStatsLogoItem {
  id: string;
  label: string;
  logoPath: string;
  count: number;
}

interface SidebarStatsEmojiItem {
  emoji?: string;
  title?: string;
  count: number;
}

interface SidebarStatsFormatterItem {
  id: string;
  emoji?: string;
  label: string;
  title?: string;
  count: number;
}

interface SidebarStatsPlatform {
  id: string;
  label: string;
  logoPath: string;
  total: number;
  signin: number;
  create: number;
}

interface SidebarStatsSummary {
  accounts?: {
    total: number;
    platforms: SidebarStatsPlatform[];
  };
  debrid?: SidebarStatsLogoItem[];
  audio?: SidebarStatsEmojiItem[];
  subtitles?: SidebarStatsEmojiItem[];
  catalogs?: {
    discover: SidebarStatsEmojiItem[];
    categories: SidebarStatsEmojiItem[];
  };
  formatter?: SidebarStatsFormatterItem[];
  addons?: {
    anime: number;
    debridio: number;
    httpInstall: number;
    httpOnly: number;
  };
  rowCount?: number;
}

interface GuideStatsResponse {
  totalCompletions?: number;
  wizard?: {
    totalAccountsCreated?: number;
    analytics?: {
      summary?: SidebarStatsSummary;
    };
  };
}

export function Sidebar({ onClose }: Props) {
  const { step, maxReachedStep, aioSections, setStep } = useWizard();
  const guideCountRef = useRef<HTMLSpanElement>(null);
  const wizardCountRef = useRef<HTMLSpanElement>(null);
  const statsCardRef = useRef<HTMLElement>(null);
  const [statsSummary, setStatsSummary] = useState<SidebarStatsSummary | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Load and animate the guide and wizard counts
  useEffect(() => {
    const BASELINE = 15000;
    fetch(getGuideStatsUrl(), { cache: 'no-store' })
      .then(r => r.json())
      .then((data: GuideStatsResponse) => {
        const guideTotal = data?.totalCompletions ?? BASELINE;
        const wizardTotal = data?.wizard?.totalAccountsCreated ?? 0;
        animateCount(guideCountRef.current, guideTotal);
        animateCount(wizardCountRef.current, wizardTotal);
        setStatsSummary(data?.wizard?.analytics?.summary?.rowCount ? data.wizard.analytics.summary : null);
      })
      .catch(() => {
        if (guideCountRef.current) guideCountRef.current.textContent = new Intl.NumberFormat().format(BASELINE);
        if (wizardCountRef.current) wizardCountRef.current.textContent = '0';
        setStatsSummary(null);
      });
  }, []);

  useEffect(() => {
    if (!isStatsOpen) return;

    function handleClick(event: MouseEvent) {
      const card = statsCardRef.current;
      if (!card || card.contains(event.target as Node)) return;
      setIsStatsOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsStatsOpen(false);
      }
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isStatsOpen]);

  useEffect(() => {
    if (!statsSummary?.rowCount) {
      setIsStatsOpen(false);
    }
  }, [statsSummary]);

  useEffect(() => {
    function updateLayout() {
      const card = statsCardRef.current;
      if (!card) return;
      const rootStyle = getComputedStyle(document.documentElement);
      const headerHeight = Number.parseFloat(rootStyle.getPropertyValue('--header-height')) || 74;
      const rect = card.getBoundingClientRect();
      const availableHeight = Math.max(250, Math.floor(rect.top - headerHeight - 8));
      card.style.setProperty('--sidebar-stats-max-height', `${availableHeight}px`);
    }

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [isStatsOpen, statsSummary]);

  function animateCount(node: HTMLElement | null, target: number) {
    if (!node) return;
    const duration = 1400;
    const start = performance.now();
    function frame(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node!.textContent = new Intl.NumberFormat().format(Math.floor(target * eased));
      if (p < 1) requestAnimationFrame(frame);
      else node!.textContent = new Intl.NumberFormat().format(target);
    }
    requestAnimationFrame(frame);
  }

  const hasStatsSummary = Boolean(statsSummary?.rowCount);

  const n = aioSections.length;
  const CATALOGS_STEP = getCatalogStep(n);
  const WATCHLY_STEP = getWatchlyStep(n);
  const INSTALL_STEP = getInstallStep(n);

  function goTo(s: number) {
    if (s <= maxReachedStep && s !== step) { setStep(s); onClose(); }
  }

  function cls(s: number) {
    const isDone = s < step;
    const isCurr = s === step;
    const isClickable = s <= maxReachedStep && s !== step;
    return [
      'nav-step',
      isCurr ? 'is-current' : '',
      isDone ? 'is-done' : '',
      isClickable ? 'is-clickable' : '',
    ].filter(Boolean).join(' ');
  }

  function StepIcon({ s }: { s: number }) {
    if (s < step) return <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
    if (s === step) return <ChevronRight size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
    return (
      <span style={{
        width: '12px', height: '12px', borderRadius: '50%',
        border: '1px solid var(--border)', display: 'inline-block', flexShrink: 0,
      }} />
    );
  }

  function SectionHeader({ label, firstStep, count }: { label: string; firstStep: number; count: number }) {
    const lastStep = firstStep + count - 1;
    const isDone = count > 0 && lastStep < step;
    const isCurrent = count > 0 && step >= firstStep && step <= lastStep;
    const classes = ['nav-step', isDone ? 'is-done' : '', isCurrent ? 'is-current' : ''].filter(Boolean).join(' ');
    const icon = isDone
      ? <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      : isCurrent
        ? <ChevronRight size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid var(--border)', display: 'inline-block', flexShrink: 0 }} />;
    return (
      <div className={classes} style={{ cursor: 'default' }}>
        {icon}
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="sidebar__inner">
      {/* Wizard nav steps */}
      <nav id="sidebar-nav">
        {/* Welcome */}
        <button className={cls(0)} onClick={() => goTo(0)}>
          <StepIcon s={0} />
          <span>🔮 Welcome</span>
        </button>

        {/* Account */}
        <button className={cls(1)} onClick={() => goTo(1)}>
          <StepIcon s={1} />
          <span>📝 Account</span>
        </button>

        {/* Services & Keys */}
        <SectionHeader label="🔑 Services" firstStep={KEY_SCREEN_START_STEP} count={ACTIVE_KEY_SCREENS.length} />
        {ACTIVE_KEY_SCREENS.map((screen, index) => {
          const stepIndex = KEY_SCREEN_START_STEP + index;
          return (
            <button key={screen.id} className={`${cls(stepIndex)} is-sub`} onClick={() => goTo(stepIndex)}>
              <StepIcon s={stepIndex} />
              <span>{screen.label}</span>
            </button>
          );
        })}

        {/* AIOStreams Config */}
        <SectionHeader label="📚 Streams" firstStep={AIO_SECTION_START_STEP} count={n} />
        {n === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '0.35rem 0.65rem', fontStyle: 'italic' }}>
            Loading…
          </div>
        ) : (
          aioSections.map((sec, i) => {
            const s = AIO_SECTION_START_STEP + i;
            return (
              <button key={sec.id} className={`${cls(s)} is-sub`} onClick={() => goTo(s)}>
                <StepIcon s={s} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sec.icon} {sec.title}
                </span>
              </button>
            );
          })
        )}

        {/* Catalogs + Watchly + Install */}
        <div style={{ marginTop: '0.6rem' }}>
          <button className={cls(CATALOGS_STEP)} onClick={() => goTo(CATALOGS_STEP)}>
            <StepIcon s={CATALOGS_STEP} />
            <span>🔎 Catalogs</span>
          </button>
          <button className={cls(WATCHLY_STEP)} onClick={() => goTo(WATCHLY_STEP)}>
            <StepIcon s={WATCHLY_STEP} />
            <span>🤖 Recommendations</span>
          </button>
          <button className={cls(INSTALL_STEP)} onClick={() => goTo(INSTALL_STEP)}>
            <StepIcon s={INSTALL_STEP} />
            <span>🎉 Finish</span>
          </button>
        </div>
      </nav>

      {/* Footer mirrors guide sidebar footer */}
      <div className="sidebar-footer">
        <div className="sidebar-support-links">
          <a
            className="sidebar-support-link sidebar-support-link--github"
            href="https://github.com/luckynumb3rs/stremio-perfect-setup"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View GitHub repository"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.11.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.27 1.17-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.14 1.18a10.9 10.9 0 0 1 5.72 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.73.81 1.17 1.83 1.17 3.08 0 4.41-2.68 5.39-5.24 5.67.41.35.78 1.04.78 2.1v3.12c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>
            </svg>
          </a>
          <a
            className="sidebar-support-link sidebar-support-link--kofi"
            href="https://ko-fi.com/luckynumb3rs"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support on Ko-fi"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M7.5 3.25c.35.35.7.78.7 1.35 0 .48-.22.84-.43 1.17-.2.31-.37.57-.37.93 0 .39.2.7.55 1.08l-1.1.95C6.25 8.08 6 7.43 6 6.75c0-.62.27-1.04.5-1.4.17-.27.3-.47.3-.75 0-.25-.15-.47-.4-.72l1.1-.63Zm4 0c.35.35.7.78.7 1.35 0 .48-.22.84-.43 1.17-.2.31-.37.57-.37.93 0 .39.2.7.55 1.08l-1.1.95c-.6-.65-.85-1.3-.85-1.98 0-.62.27-1.04.5-1.4.17-.27.3-.47.3-.75 0-.25-.15-.47-.4-.72l1.1-.63Zm4 0c.35.35.7.78.7 1.35 0 .48-.22.84-.43 1.17-.2.31-.37.57-.37.93 0 .39.2.7.55 1.08l-1.1.95c-.6-.65-.85-1.3-.85-1.98 0-.62.27-1.04.5-1.4.17-.27.3-.47.3-.75 0-.25-.15-.47-.4-.72l1.1-.63ZM4 10h12.5A1.5 1.5 0 0 1 18 11.5V12h.75a3.75 3.75 0 0 1 0 7.5h-1.23A3.5 3.5 0 0 1 14.5 21h-7A3.5 3.5 0 0 1 4 17.5V10Zm14 3.5v4.25h.75a2.125 2.125 0 0 0 0-4.25H18Zm-12.25-2v6A1.75 1.75 0 0 0 7.5 19.25h7a1.75 1.75 0 0 0 1.75-1.75v-6H5.75Z"/>
            </svg>
            <span>Buy me a coffee</span>
          </a>
        </div>
        <section
          ref={statsCardRef}
          className="sidebar-stat-card"
          aria-label="Guide and wizard activity"
          data-sidebar-stats-card
          data-sidebar-stats-open={isStatsOpen ? 'true' : 'false'}
        >
          <button
            className="sidebar-stat-toggle"
            type="button"
            aria-expanded={isStatsOpen}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!hasStatsSummary) return;
              setIsStatsOpen(open => !open);
            }}
            hidden={!hasStatsSummary}
          >
            <span className="sidebar-stat-toggle__label">Toggle setup stats</span>
            <span className="sidebar-stat-toggle__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M4 15 12 8l8 7" />
              </svg>
            </span>
          </button>
          <div className="sidebar-stats-panel" aria-hidden={!isStatsOpen}>
            <div className="sidebar-stats-panel__header">
              <strong>Wizard Setup Statistics</strong>
              <span>Popular Choices</span>
            </div>
            <div className="sidebar-stats-panel__content">
              {hasStatsSummary ? (
                <SidebarStatsSummaryPanel summary={statsSummary!} />
              ) : null}
            </div>
          </div>
          <div className="sidebar-stat-grid">
            <div className="sidebar-stat-item">
              <span className="sidebar-stat-item__label">Guide completed</span>
              <strong className="sidebar-stat-item__value"><span ref={guideCountRef}>0</span></strong>
              <span className="sidebar-stat-item__suffix">readers</span>
            </div>
            <div className="sidebar-stat-divider" aria-hidden="true" />
            <div className="sidebar-stat-item">
              <span className="sidebar-stat-item__label">Wizard created</span>
              <strong className="sidebar-stat-item__value"><span ref={wizardCountRef}>0</span></strong>
              <span className="sidebar-stat-item__suffix">accounts</span>
            </div>
          </div>
        </section>
        <div className="sidebar-credit">
          Made with ❤️ by <a className="sidebar-credit__link" href="https://github.com/luckynumb3rs" target="_blank" rel="noopener noreferrer">luckynumb3rs</a>
        </div>
      </div>
    </div>
  );
}

function SidebarStatsSummaryPanel({ summary }: { summary: SidebarStatsSummary }) {
  const debrid = summary.debrid ?? [];
  const audio = summary.audio ?? [];
  const subtitles = summary.subtitles ?? [];
  const discover = summary.catalogs?.discover ?? [];
  const categories = summary.catalogs?.categories ?? [];
  const formatter = summary.formatter ?? [];

  return (
    <>
      <section className="sidebar-stats-accounts">
        <div className="sidebar-stats-total-card">
          <span className="sidebar-stats-total-card__label">Total</span>
          <strong className="sidebar-stats-total-card__value">{new Intl.NumberFormat().format(summary.accounts?.total ?? 0)}</strong>
        </div>
        <div className="sidebar-stats-platform-grid">
          {(summary.accounts?.platforms ?? []).map((platform) => (
            <div key={platform.id} className="sidebar-stats-platform-card">
              <div className="sidebar-stats-platform-card__head">
                <img className="sidebar-stats-platform-card__logo" src={resolveSiteUrl(platform.logoPath)} alt={platform.label} />
              </div>
              <strong className="sidebar-stats-platform-card__value">{new Intl.NumberFormat().format(platform.total)}</strong>
              <div className="sidebar-stats-platform-card__modes">
                <div className="sidebar-stats-platform-card__mode" title="Existing">
                  <LogIn size={12} className="sidebar-stats-mode-icon" />
                  <strong>{new Intl.NumberFormat().format(platform.signin)}</strong>
                </div>
                <div className="sidebar-stats-platform-card__mode" title="New">
                  <UserPlus size={12} className="sidebar-stats-mode-icon" />
                  <strong>{new Intl.NumberFormat().format(platform.create)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {debrid.length > 0 ? (
        <StatsRow
          label="Debrid"
          variant="logos"
          items={debrid.map((item) => ({
            key: item.id,
            title: item.label,
            count: item.count,
            logoPath: item.logoPath,
          }))}
        />
      ) : null}

      {audio.length > 0 ? <StatsRow label="Audio" variant="emoji" items={audio.map(toEmojiRowItem)} /> : null}
      {subtitles.length > 0 ? <StatsRow label="Subtitles" variant="emoji" items={subtitles.map(toEmojiRowItem)} /> : null}
      {discover.length > 0 ? <StatsRow label="Discover" variant="discover" items={discover.map(toEmojiRowItem)} /> : null}
      {categories.length > 0 ? <StatsRow label="Categories" variant="categories" items={categories.map(toEmojiRowItem)} /> : null}
      {formatter.length > 0 ? (
        <StatsRow
          label="Formatter"
          variant="formatter"
          items={formatter.map((item) => ({
            key: item.id,
            title: item.title ?? item.label,
            count: item.count,
            emoji: item.emoji,
          }))}
        />
      ) : null}

      <StatsRow
        label="Addons"
        variant="addons"
        items={[
          { key: 'anime', title: 'Anime', count: summary.addons?.anime ?? 0, emoji: '🍥' },
          {
            key: 'http',
            title: 'HTTP',
            countText: `➕ ${new Intl.NumberFormat().format(summary.addons?.httpInstall ?? 0)} / 🔒 ${new Intl.NumberFormat().format(summary.addons?.httpOnly ?? 0)}`,
            emoji: '🌐',
          },
          { key: 'debridio', title: 'Debridio', count: summary.addons?.debridio ?? 0, emoji: '🧊' },
        ]}
      />
    </>
  );
}

function toEmojiRowItem(item: SidebarStatsEmojiItem, index: number) {
  return {
    key: `${item.title ?? item.emoji ?? 'item'}-${index}`,
    title: item.title ?? item.emoji ?? '',
    count: item.count,
    emoji: item.emoji,
  };
}

interface StatsRowItem {
  key: string;
  title: string;
  count?: number;
  countText?: string;
  emoji?: string;
  logoPath?: string;
}

function StatsRow({ label, items, variant }: { label: string; items: StatsRowItem[]; variant: string }) {
  return (
    <section className="sidebar-stats-row">
      <div className="sidebar-stats-row__label">{label}</div>
      <div className={`sidebar-stats-icon-row sidebar-stats-icon-row--${variant}`}>
        {items.map((item) => (
          <div key={item.key} className="sidebar-stats-icon-item" title={item.title}>
            <div className="sidebar-stats-icon-item__icon">
              {item.logoPath ? <img className="sidebar-stats-icon-item__logo" src={resolveSiteUrl(item.logoPath)} alt={item.title} /> : null}
              {!item.logoPath && item.emoji ? <span className="sidebar-stats-icon-item__emoji">{item.emoji}</span> : null}
            </div>
            <strong className="sidebar-stats-icon-item__count">
              {item.countText ?? new Intl.NumberFormat().format(item.count ?? 0)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
