import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export function Dropdown<T extends string>({ options, value, onChange, label, listLabel = label, className = '' }: {
  options: readonly { value: T; label: string; badge?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  listLabel?: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const search = useRef({ value: '', time: 0 });
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (open) optionButtons.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openMenu(index = Math.max(options.findIndex((option) => option.value === value), 0)) {
    search.current = { value: '', time: 0 };
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className={'dropdown ' + className} ref={container} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button className="dropdown-trigger" ref={trigger} type="button" role="combobox" aria-label={label + ': ' + (selected?.label ?? value)}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={id + '-options'}
        aria-activedescendant={open ? id + '-option-' + activeIndex : undefined}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            if (open) { onChange(options[activeIndex].value); setOpen(false); }
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
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
              : Math.max(0, Math.min(options.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
            if (open) setActiveIndex(next);
            else openMenu(event.key === 'Home' || event.key === 'End' ? next : undefined);
            return;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            const query = (now - search.current.time < 700 ? search.current.value : '') + event.key.toLowerCase();
            search.current = { value: query, time: now };
            const next = options.findIndex((option) => option.label.toLowerCase().startsWith(query));
            if (next !== -1) { setActiveIndex(next); setOpen(true); }
          }
        }}>
        <span>{selected?.label ?? value}</span><Icon name="chevron" />
      </button>
      <ul className="dropdown-menu" id={id + '-options'} role="listbox" aria-label={listLabel} hidden={!open}>
        {options.map((option, index) => (
          <li role="none" key={option.value}>
            <button className="dropdown-option" ref={(element) => { optionButtons.current[index] = element; }}
              type="button" id={id + '-option-' + index} role="option" tabIndex={-1}
              aria-selected={option.value === value} data-active={index === activeIndex}
              onPointerMove={() => setActiveIndex(index)} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
              <span>{option.label}</span>{option.badge && <span className="dropdown-badge">{option.badge}</span>}
              {option.value === value && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
