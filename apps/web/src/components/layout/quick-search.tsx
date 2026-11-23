'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/navigation';
import { NavIconGlyph } from './sidebar';

/** Menu entries matching the typed words (label or section), in menu order. */
export function filterNav(nav: NavItem[], query: string): NavItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return nav;
  return nav.filter((item) => {
    const text = `${item.label} ${item.group ?? ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

interface QuickSearchProps {
  nav: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Jump to any screen by typing its name (Ctrl K / ⌘ K), like the command menus in Canvas and Notion. */
export function QuickSearch({ nav, open, onOpenChange }: QuickSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const results = useMemo(() => filterNav(nav, query), [nav, query]);

  // Start fresh each time it closes
  const setOpen = (next: boolean) => {
    if (!next) {
      setQuery('');
      setIndex(0);
    }
    onOpenChange(next);
  };

  const go = (item: NavItem | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[index]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] max-w-lg translate-y-0 gap-0 overflow-hidden bg-white p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Go to a page</DialogTitle>
        <DialogDescription className="sr-only">Type a page name, then press Enter.</DialogDescription>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Go to a page…"
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-search-results"
            aria-activedescendant={results[index] ? `quick-search-${index}` : undefined}
            className="h-14 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Esc</kbd>
        </div>
        <ul id="quick-search-results" role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">No page matches “{query}”.</li>}
          {results.map((item, i) => (
            <li
              key={item.href}
              id={`quick-search-${i}`}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(item)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                i === index ? 'bg-slate-100 text-slate-900' : 'text-slate-700',
              )}
            >
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', i === index ? 'bg-brand-soft text-brand-strong' : 'bg-slate-100 text-slate-500')}>
                <NavIconGlyph icon={item.icon} className="h-4 w-4" />
              </span>
              <span className="flex-1 font-medium">{item.label}</span>
              {item.group && <span className="text-xs text-slate-400">{item.group}</span>}
              {i === index && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
