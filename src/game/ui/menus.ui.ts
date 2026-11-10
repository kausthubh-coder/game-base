// The title screen, the pause menu, Settings and the end card.

import { add, h, keycaps } from './dom.ui.ts';
import { DEFAULT_KEYS, QUALITIES, SIZES } from './logic.ui.ts';
import type { PanelView, Quality, UiContext, VolumeChannel } from './types.ui.ts';

const button = (label: string, onclick: () => void, extra: Record<string, string | boolean | null> = {}): HTMLButtonElement =>
  h('button', { class: 'gu-btn', type: 'button', onclick, ...extra }, label);

export function titlePanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-plate' });
  /** True while New game waits for a second click, because a save would be replaced. */
  let asking = false;
  const start = (): void => {
    ctx.sound('click');
    ctx.options.newGame();
    ctx.ui.close();
  };
  const view: PanelView = {
    title: 'A plot of your own',
    className: 'gu-panel-plate',
    framed: false,
    body,
    render() {
      const saved = ctx.options.hasSave();
      const menu = h('div', { class: 'gu-menu' });
      if (asking) {
        menu.append(
          h('p', { class: 'gu-menu-note' }, 'A new game replaces the one you saved.'),
          button('Start a new game', start, { 'data-key': 'title:replace' }),
          button('Keep my save', () => { asking = false; view.render(); body.querySelector<HTMLElement>('[data-key="title:new"]')?.focus(); }, { 'data-key': 'title:keep', class: 'gu-btn gu-primary' }),
        );
      } else {
        add(menu,
          button('New game', () => {
            if (!saved) return start();
            asking = true;
            view.render();
            body.querySelector<HTMLElement>('[data-key="title:keep"]')?.focus();
          }, { 'data-key': 'title:new', class: saved ? 'gu-btn' : 'gu-btn gu-primary' }),
          button('Continue', () => { ctx.sound('click'); ctx.options.continueGame(); ctx.ui.close(); },
            { 'data-key': 'title:continue', class: saved ? 'gu-btn gu-primary' : 'gu-btn', disabled: !saved, 'aria-describedby': saved ? null : 'gu-no-save' }),
          saved ? null : h('p', { class: 'gu-menu-note', id: 'gu-no-save' }, 'Nothing saved yet.'),
          button('Settings', () => ctx.ui.open('settings'), { 'data-key': 'title:settings' }),
        );
      }
      body.replaceChildren(h('h1', { class: 'gu-chapter' }, 'A plot of your own'), menu);
    },
  };
  return view;
}

export function pausePanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-menu' });
  return {
    title: 'Paused',
    className: 'gu-panel-pause',
    body,
    render() {
      body.replaceChildren(
        button('Resume', () => ctx.ui.close(), { class: 'gu-btn gu-primary' }),
        button('Settings', () => ctx.ui.open('settings')),
        button('Save and return to title', () => { ctx.sound('click'); ctx.options.saveAndQuit(); ctx.ui.open('title'); }),
      );
    },
  };
}

const QUALITY_NAMES: Record<Quality, string> = { low: 'Low', medium: 'Medium', high: 'High', auto: 'Automatic' };
const SIZE_NAMES = ['Small', 'Normal', 'Large'];
const VOLUMES: readonly { channel: VolumeChannel; label: string }[] = [
  { channel: 'music', label: 'Music' },
  { channel: 'ambience', label: 'Ambience' },
  { channel: 'effects', label: 'Effects' },
  { channel: 'voice', label: 'Voice' },
];

/** A row of choices where one is picked: radio buttons drawn as a strip. */
function choices<T extends string | number>(name: string, legend: string, values: readonly T[], labels: readonly string[], current: T, pick: (value: T) => void): HTMLElement {
  const set = h('fieldset', { class: 'gu-choices' }, h('legend', { class: 'gu-label' }, legend));
  const strip = h('div', { class: 'gu-strip' });
  values.forEach((value, i) => {
    strip.append(
      h('label', { class: 'gu-choice' },
        h('input', { type: 'radio', name: `gu-${name}`, value: String(value), checked: value === current, onchange: () => pick(value) }),
        h('span', null, labels[i]),
      ),
    );
  });
  set.append(strip);
  return set;
}

function graphicsControls(ctx: UiContext): HTMLElement {
  // The Picture section comes first in settings: quality, then the overrides the graphics settings offer.
  const section = h('section', { class: 'gu-section gu-settings-picture', 'data-key': 'settings:picture' }, h('h3', { class: 'gu-label' }, 'Picture'));
  section.append(choices('quality', 'Quality', QUALITIES, QUALITIES.map(q => QUALITY_NAMES[q]), ctx.settings.quality, value => ctx.setSetting('quality', value)));
  const api = ctx.options.graphics;
  if (!api) return section;
  const g = api.get();
  section.append(choices('shadows', 'Shadows', ['preset','off','soft','sharp'], ['Preset','Off','Soft','Sharp'], g.shadows, value => api.set({shadows: value as typeof g.shadows})));
  for (const [key,label,min,max,step,fallback] of [
    ['shadowDistance','Shadow distance',20,90,5,40],
    ['plantDensity','Grass and flowers density',0,1,.1,1],
    ['viewDistance','View distance',.5,1.5,.1,1],
  ] as const) {
    const id = 'gu-' + key;
    const output = h('output', {class:'gu-num',for:id}, g[key] === null ? 'Preset' : String(g[key]));
    section.append(h('div',{class:'gu-slider'}, h('label',{for:id},label), h('input',{id,type:'range',min,max,step,value:g[key] ?? fallback,oninput:(event: Event) => {const value = Number((event.target as HTMLInputElement).value);api.set({[key]:value});output.textContent=String(value);}}),output));
  }
  for (const [key,label] of [['bloom','Bloom'],['cloudShadows','Cloud shadows'],['weatherParticles','Weather particles']] as const) {
    section.append(choices(key,label,['preset','on','off'],['Preset','On','Off'],g[key] === null ? 'preset' : g[key] ? 'on' : 'off', value => api.set({[key]:value === 'preset' ? null : value === 'on'})));
  }
  section.append(choices('reduceMotion','Reduce motion',['off','on'],['Off','On'],g.reduceMotion ? 'on' : 'off',value => api.set({reduceMotion:value === 'on'})));
  section.append(button('Reset graphics overrides',()=>{api.set({shadows:'preset',shadowDistance:null,plantDensity:null,viewDistance:null,bloom:null,cloudShadows:null,weatherParticles:null,reduceMotion:false});section.replaceWith(graphicsControls(ctx));}));
  return section;
}

/** The View section, right after Picture: how the camera stands and how characters are drawn. The game stores both. */
function viewControls(ctx: UiContext): HTMLElement | null {
  const view = ctx.options.view;
  if (!view) return null;
  return h('section', { class: 'gu-section gu-settings-view', 'data-key': 'settings:view' }, h('h3', { class: 'gu-label' }, 'View'),
    choices('camera', 'Camera', ['tilt', 'free', 'first'] as const, ['2.5D', 'Free', 'First person'], view.camera(), (mode) => view.setCamera(mode)),
    choices('characters', 'Characters', ['sprites', 'models'] as const, ['Sprites', '3D models'], view.characters(), (look) => view.setCharacters(look)),
  );
}

export function settingsPanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-settings' });
  return {
    title: 'Settings',
    className: 'gu-panel-settings',
    body,
    render() {
      const sound = h('section', { class: 'gu-section' }, h('h3', { class: 'gu-label' }, 'Sound'));
      for (const { channel, label } of VOLUMES) {
        const id = `gu-volume-${channel}`;
        const percent = (value: number): string => `${Math.round(value * 100)}%`;
        const out = h('output', { class: 'gu-num', for: id }, percent(ctx.settings[channel]));
        sound.append(
          h('div', { class: 'gu-slider' },
            h('label', { for: id }, label),
            h('input', {
              id, type: 'range', min: 0, max: 100, step: 5, value: Math.round(ctx.settings[channel] * 100),
              oninput: (event: Event) => {
                const value = Number((event.target as HTMLInputElement).value) / 100;
                out.textContent = percent(value);
                ctx.setSetting(channel, value);
              },
            }),
            out,
          ),
        );
      }
      const keys = h('dl', { class: 'gu-keylist' });
      for (const hint of ctx.options.keys ?? DEFAULT_KEYS) keys.append(h('dt', null, hint.action), h('dd', null, keycaps(hint.keys, hint.action === 'Move' ? '' : 'or')));
      body.replaceChildren(
        h('div', { class: 'gu-settings-side' },
          graphicsControls(ctx),
          viewControls(ctx),
          sound,
          h('section', { class: 'gu-section' }, h('h3', { class: 'gu-label' }, 'Interface'), choices('size', 'Size', SIZES, SIZE_NAMES, ctx.settings.size, (value) => ctx.setSetting('size', value))),
        ),
        h('section', { class: 'gu-section' }, h('h3', { class: 'gu-label' }, 'Keys'), keys),
      );
    },
  };
}

export function endPanel(ctx: UiContext): PanelView {
  const body = h('div', { class: 'gu-end' });
  return {
    title: 'End of the first part',
    className: 'gu-panel-end',
    framed: false,
    body,
    render() {
      const stats = ctx.options.stats();
      const stat = (value: number, label: string): HTMLElement => h('div', { class: 'gu-stat' }, h('dt', null, label), h('dd', { class: 'gu-num' }, String(value)));
      body.replaceChildren(
        h('h1', { class: 'gu-end-title' }, 'End of the first part'),
        h('dl', { class: 'gu-stats' },
          stat(stats.days, stats.days === 1 ? 'day played' : 'days played'),
          stat(stats.wheat, 'wheat grown'),
          stat(stats.blocks, stats.blocks === 1 ? 'block placed' : 'blocks placed'),
          stat(stats.pages, stats.pages === 1 ? 'Almanac page complete' : 'Almanac pages complete'),
        ),
        h('p', { class: 'gu-end-line' }, 'The second part is not built yet. You can keep playing.'),
        button('Keep playing', () => ctx.ui.close(), { class: 'gu-btn gu-primary' }),
      );
    },
  };
}
