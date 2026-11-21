'use client';

import { cn, NavigationMenu } from '@casvitta/ui';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { NavLink, NavMenu } from '@/lib/site-nav';

export function useNavLabel() {
  const t = useTranslations('marketplace.menus.links');
  return (label: NavLink['label']) => ('text' in label ? label.text : t(label.key, label.values));
}

function SoonPill() {
  const t = useTranslations('marketplace.menus');
  return (
    <span className="ml-1.5 rounded-pill bg-subtle px-2 type-caption text-fg-muted">
      {t('soon')}
    </span>
  );
}

function SectionLinks({
  menu,
  linkClass,
  onNavigate,
}: {
  menu: NavMenu;
  linkClass: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations('marketplace.menus');
  const label = useNavLabel();
  return menu.sections.map((section) => (
    <div key={section.key} className="flex min-w-0 flex-col gap-1">
      <h3 className="type-eyebrow">{t(`sections.${section.key}`)}</h3>
      <ul>
        {section.links.map((link) => (
          <li key={link.id}>
            <NavigationMenu.Link asChild>
              <Link
                href={link.href}
                onClick={onNavigate}
                className={cn(linkClass, link.more && 'font-semibold')}
              >
                {label(link.label)}
                {link.more ? (
                  <span aria-hidden="true" className="ml-1">
                    ›
                  </span>
                ) : null}
                {link.soon ? <SoonPill /> : null}
              </Link>
            </NavigationMenu.Link>
          </li>
        ))}
      </ul>
    </div>
  ));
}

/**
 * Radix opens on hover by default, so hover-then-click closes the menu the pointer just opened.
 * Menus here open on click and keyboard only.
 */
const clickOnly = {
  onPointerMove: (event: { preventDefault: () => void }) => event.preventDefault(),
  onPointerLeave: (event: { preventDefault: () => void }) => event.preventDefault(),
};

/**
 * Desktop header menus: open on click and keyboard (Radix NavigationMenu), Esc closes, one open
 * at a time. The panel drops under the whole header (the header is the positioning context).
 */
export function DesktopMenus({ menus }: { menus: NavMenu[] }) {
  const t = useTranslations('marketplace.menus');
  return (
    <NavigationMenu.Root
      aria-label={t('label')}
      className="static hidden lg:block"
      delayDuration={150}
    >
      <NavigationMenu.List className="flex gap-1">
        {menus.map((menu) => (
          <NavigationMenu.Item key={menu.key} value={menu.key}>
            <NavigationMenu.Trigger
              {...clickOnly}
              className="group flex min-h-11 items-center gap-1 rounded-control px-3 type-body-s font-medium text-fg hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus data-[state=open]:bg-action-subtle"
            >
              {t(`menus.${menu.key}`)}
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.6}
                className="size-4 transition-transform group-data-[state=open]:rotate-180"
              />
            </NavigationMenu.Trigger>
            <NavigationMenu.Content {...clickOnly}>
              <div className="mx-auto max-w-7xl px-4 md:px-8 xl:px-20">
                <div className="mt-2 flex max-w-4xl flex-col gap-4 rounded-card border border-line bg-panel px-7 py-6 shadow-[0_8px_24px_rgba(15,30,61,.08)]">
                  <div
                    className="grid gap-8"
                    style={{
                      gridTemplateColumns: `repeat(${menu.sections.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <SectionLinks
                      menu={menu}
                      linkClass="inline-flex min-h-8 items-center type-body-s text-action hover:underline"
                    />
                  </div>
                  <p className="border-t border-line pt-3 type-caption">{t(`notes.${menu.key}`)}</p>
                </div>
              </div>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
      {/* Outside the List (which Radix wraps in a relative box): drops under the whole header. */}
      <div className="absolute inset-x-0 top-full z-40">
        <NavigationMenu.Viewport />
      </div>
    </NavigationMenu.Root>
  );
}

/** Mobile menu: the same tree as an accordion; touch targets of 44 px or more. */
export function MobileMenus({ menus, onNavigate }: { menus: NavMenu[]; onNavigate: () => void }) {
  const t = useTranslations('marketplace.menus');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <NavigationMenu.Root aria-label={t('label')} orientation="vertical">
      <ul className="flex flex-col">
        {menus.map((menu) => {
          const expanded = open === menu.key;
          const id = `menu-${menu.key}`;
          return (
            <li key={menu.key} className="border-b border-line">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={id}
                onClick={() => setOpen(expanded ? null : menu.key)}
                className="flex min-h-12 w-full items-center justify-between type-body font-semibold"
              >
                {t(`menus.${menu.key}`)}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.6}
                  className={cn('size-5 transition-transform', expanded && 'rotate-180')}
                />
              </button>
              {expanded ? (
                <div id={id} className="flex flex-col gap-3 pb-4">
                  <SectionLinks
                    menu={menu}
                    onNavigate={onNavigate}
                    linkClass="flex min-h-11 items-center type-body text-action"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </NavigationMenu.Root>
  );
}
