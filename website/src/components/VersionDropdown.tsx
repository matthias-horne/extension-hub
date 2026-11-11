import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export function VersionDropdown({ versions, value, current, onChange }: {
  versions: string[];
  value: string;
  current?: string;
  onChange: (version: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const search = useRef({ value: '', time: 0 });

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (open) options.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openMenu(index = Math.max(versions.indexOf(value), 0)) {
    search.current = { value: '', time: 0 };
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(index: number) {
    onChange(versions[index]);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="version-dropdown" ref={container} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button className="version-dropdown-trigger" ref={trigger} type="button" role="combobox" aria-label={'Version: ' + value}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={id + '-versions'}
        aria-activedescendant={open ? id + '-version-' + activeIndex : undefined}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            if (open) { onChange(versions[activeIndex]); setOpen(false); }
            return;
          }
          if (event.key === 'Escape') {
            if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(activeIndex);
            else openMenu();
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? versions.length - 1
              : Math.max(0, Math.min(versions.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
            if (open) setActiveIndex(next);
            else openMenu(event.key === 'Home' || event.key === 'End' ? next : undefined);
            return;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            const query = (now - search.current.time < 700 ? search.current.value : '') + event.key.toLowerCase();
            search.current = { value: query, time: now };
            const next = versions.findIndex((tag) => tag.toLowerCase().startsWith(query));
            if (next !== -1) { setActiveIndex(next); setOpen(true); }
          }
        }}>
        <span>{value}</span><Icon name="chevron" />
      </button>
      <ul className="version-dropdown-menu" id={id + '-versions'} role="listbox" aria-label="Versions" hidden={!open}>
        {versions.map((tag, index) => (
          <li role="none" key={tag}>
            <button className="version-dropdown-option" ref={(element) => { options.current[index] = element; }}
              type="button" id={id + '-version-' + index} role="option" tabIndex={-1}
              aria-selected={tag === value} data-active={index === activeIndex}
              onPointerMove={() => setActiveIndex(index)} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
              <span>{tag}</span>{tag === current && <span className="version-current">Current</span>}
              {tag === value && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
