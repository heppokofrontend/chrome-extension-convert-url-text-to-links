import { beforeEach, describe, expect, it } from 'vitest';
import type { TrailingPunctuationMode } from './constants';
import {
  checkIsSkippableTarget,
  convertToLink,
  getRegExp,
  getTextNodes,
  narrowDownToOnlyTopLevelNodeLayer,
} from './linkify';

type NodeSummary =
  { kind: 'text'; text: string } | { kind: 'anchor'; href: string; text: string; target: string };

const summarize = (nodes: NodeListOf<ChildNode>): NodeSummary[] => {
  const result: NodeSummary[] = [];

  for (const node of nodes) {
    if (node instanceof HTMLAnchorElement) {
      result.push({
        kind: 'anchor',
        href: node.getAttribute('href') ?? '',
        text: node.textContent,
        target: node.getAttribute('target') ?? '',
      });
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      result.push({ kind: 'text', text: node.textContent ?? '' });
      continue;
    }

    throw new Error(`Unexpected node: ${node.nodeName}`);
  }

  return result;
};

const setup = (raw: string) => {
  document.body.innerHTML = '';

  const container = document.createElement('div');
  const textNode = document.createTextNode(raw);

  container.appendChild(textNode);
  document.body.appendChild(container);

  return { container, textNode };
};

const baseOptions = {
  enableTtp: false,
  enableAllDoubleSlash: false,
  enableNoColon: false,
  useNewTab: false,
  trailingPunctuationMode: 'none' as TrailingPunctuationMode,
};

describe('getRegExp', () => {
  describe('strict (all options false)', () => {
    const { regExp } = getRegExp({
      enableTtp: false,
      enableAllDoubleSlash: false,
      enableNoColon: false,
    });

    it.each(['https://example.com', 'http://example.com', 'prefix https://a.b suffix'])(
      'matches %s',
      (input) => {
        expect(regExp.test(input)).toBe(true);
      },
    );

    it.each([
      'ttp://example.com',
      'ttps://example.com',
      'https//example.com',
      'http//example.com',
      'HTTP://example.com',
      'hoge://example.com',
      'plain text',
      '',
    ])('does not match %s', (input) => {
      expect(regExp.test(input)).toBe(false);
    });
  });

  describe('enableTtp only', () => {
    const { regExp } = getRegExp({
      enableTtp: true,
      enableAllDoubleSlash: false,
      enableNoColon: false,
    });

    it.each([
      'ttp://example.com',
      'ttps://example.com',
      'http://example.com',
      'https://example.com',
    ])('matches %s', (input) => {
      expect(regExp.test(input)).toBe(true);
    });

    it.each(['https//example.com', 'ttps//example.com', 'hoge://example.com'])(
      'does not match %s',
      (input) => {
        expect(regExp.test(input)).toBe(false);
      },
    );
  });

  describe('enableNoColon only', () => {
    const { regExp } = getRegExp({
      enableTtp: false,
      enableAllDoubleSlash: false,
      enableNoColon: true,
    });

    it.each(['https://example.com', 'https//example.com', 'http//example.com'])(
      'matches %s',
      (input) => {
        expect(regExp.test(input)).toBe(true);
      },
    );

    it.each(['ttp://example.com', 'ttps//example.com', 'hoge://example.com'])(
      'does not match %s',
      (input) => {
        expect(regExp.test(input)).toBe(false);
      },
    );
  });

  describe('enableTtp + enableNoColon', () => {
    const { regExp } = getRegExp({
      enableTtp: true,
      enableAllDoubleSlash: false,
      enableNoColon: true,
    });

    it.each([
      'https://example.com',
      'ttp://example.com',
      'ttps://example.com',
      'https//example.com',
      'http//example.com',
      'ttps//example.com',
      'ttp//example.com',
    ])('matches %s', (input) => {
      expect(regExp.test(input)).toBe(true);
    });

    it.each(['hoge://example.com', 'HTTP://example.com'])('does not match %s', (input) => {
      expect(regExp.test(input)).toBe(false);
    });
  });

  describe('enableAllDoubleSlash', () => {
    const { regExp } = getRegExp({
      enableTtp: false,
      enableAllDoubleSlash: true,
      enableNoColon: false,
    });

    it.each([
      'https://example.com',
      'http://example.com',
      'ttp://example.com',
      'hoge://example.com',
      'HTTP://example.com',
      'hoge//example.com',
    ])('matches %s', (input) => {
      expect(regExp.test(input)).toBe(true);
    });
  });

  it('captures URLs greedily up to the character class boundary', () => {
    const { regExp } = getRegExp({
      enableTtp: false,
      enableAllDoubleSlash: false,
      enableNoColon: false,
    });
    const input = 'see https://example.com/path?q=1 then stop';
    const match = regExp.exec(input);

    expect(match?.[0]).toBe('https://example.com/path?q=1');
  });
});

describe('narrowDownToOnlyTopLevelNodeLayer', () => {
  const byId = (id: string) => {
    const el = document.getElementById(id);

    if (el === null) {
      throw new Error(`Missing #${id}`);
    }

    return el;
  };
  let outer: HTMLElement;
  let inner: HTMLElement;
  let leaf: HTMLElement;
  let sibling: HTMLElement;
  let disjoint: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="outer">
        <div id="inner">
          <div id="leaf"></div>
        </div>
        <div id="sibling"></div>
      </div>
      <div id="disjoint"></div>
    `;
    outer = byId('outer');
    inner = byId('inner');
    leaf = byId('leaf');
    sibling = byId('sibling');
    disjoint = byId('disjoint');
  });

  it('returns an empty array for empty input', () => {
    expect(narrowDownToOnlyTopLevelNodeLayer([])).toEqual([]);
  });

  it('returns all nodes when none contain another', () => {
    const result = narrowDownToOnlyTopLevelNodeLayer([outer, disjoint]);

    expect(result).toEqual([outer, disjoint]);
  });

  it('drops descendants of ancestors present in the list', () => {
    const result = narrowDownToOnlyTopLevelNodeLayer([outer, inner, leaf]);

    expect(result).toEqual([outer]);
  });

  it('keeps sibling branches independently', () => {
    const result = narrowDownToOnlyTopLevelNodeLayer([inner, sibling, leaf]);

    expect(result).toEqual([inner, sibling]);
  });
});

describe('checkIsSkippableTarget', () => {
  const makeTextIn = (parent: HTMLElement) => {
    const textNode = document.createTextNode('sample');

    parent.appendChild(textNode);

    return textNode;
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true when the text node has no parent', () => {
    const detached = document.createTextNode('foo');

    expect(checkIsSkippableTarget(detached)).toBe(true);
  });

  it.each(['a', 'button', 'textarea', 'code', 'script', 'noscript', 'style'])(
    'skips text directly inside <%s>',
    (tagName) => {
      const parent = document.createElement(tagName);

      document.body.appendChild(parent);
      const textNode = makeTextIn(parent);

      expect(checkIsSkippableTarget(textNode)).toBe(true);
    },
  );

  it('skips text inside <summary> (nested in <details>)', () => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');

    details.appendChild(summary);
    document.body.appendChild(details);
    const textNode = makeTextIn(summary);

    expect(checkIsSkippableTarget(textNode)).toBe(true);
  });

  it('skips text inside a contenteditable="true" element', () => {
    const div = document.createElement('div');

    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    const textNode = makeTextIn(div);

    expect(checkIsSkippableTarget(textNode)).toBe(true);
  });

  it('skips text arbitrarily nested inside a skipped ancestor', () => {
    const anchor = document.createElement('a');
    const span = document.createElement('span');
    const em = document.createElement('em');

    anchor.appendChild(span);
    span.appendChild(em);
    document.body.appendChild(anchor);
    const textNode = makeTextIn(em);

    expect(checkIsSkippableTarget(textNode)).toBe(true);
  });

  it('does not skip a plain <p>', () => {
    const p = document.createElement('p');

    document.body.appendChild(p);
    const textNode = makeTextIn(p);

    expect(checkIsSkippableTarget(textNode)).toBe(false);
  });

  it('does not skip when contenteditable is false', () => {
    const div = document.createElement('div');

    div.setAttribute('contenteditable', 'false');
    document.body.appendChild(div);
    const textNode = makeTextIn(div);

    expect(checkIsSkippableTarget(textNode)).toBe(false);
  });
});

describe('getTextNodes', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<section id="a"><p>alpha</p></section><section id="b"><p>beta<em>gamma</em></p></section>';
  });

  it('scopes to descendant text nodes when a context is given', () => {
    const scope = document.getElementById('a');

    if (scope === null) {
      throw new Error('missing #a');
    }

    expect(getTextNodes(scope).map((n) => n.textContent)).toEqual(['alpha']);
  });

  it('defaults to document.body when no context is given', () => {
    expect(getTextNodes().map((n) => n.textContent)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('convertToLink', () => {
  describe('early exits without touching the DOM', () => {
    it('does nothing when text is empty', () => {
      const { container, textNode } = setup('');

      convertToLink({ ...baseOptions, textNode });

      expect(container.childNodes.length).toBe(1);
      expect(container.firstChild).toBe(textNode);
    });

    it('does nothing when text is only whitespace', () => {
      const { container, textNode } = setup('   \n\t  ');

      convertToLink({ ...baseOptions, textNode });

      expect(container.firstChild).toBe(textNode);
    });

    it('does nothing when text has no URL', () => {
      const { container, textNode } = setup('nothing to linkify here');

      convertToLink({ ...baseOptions, textNode });

      expect(container.firstChild).toBe(textNode);
    });
  });

  describe('single URL, no trailing punctuation', () => {
    it('creates one anchor with matching href and text', () => {
      const { container, textNode } = setup('https://example.com');

      convertToLink({ ...baseOptions, textNode });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'https://example.com', text: 'https://example.com', target: '' },
      ]);
    });

    it('preserves surrounding text', () => {
      const { container, textNode } = setup('See https://example.com now');

      convertToLink({ ...baseOptions, textNode });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'text', text: 'See ' },
        { kind: 'anchor', href: 'https://example.com', text: 'https://example.com', target: '' },
        { kind: 'text', text: ' now' },
      ]);
    });

    it('handles multiple URLs in a single node', () => {
      const { container, textNode } = setup('go to https://a.com or https://b.com/x');

      convertToLink({ ...baseOptions, textNode });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'text', text: 'go to ' },
        { kind: 'anchor', href: 'https://a.com', text: 'https://a.com', target: '' },
        { kind: 'text', text: ' or ' },
        { kind: 'anchor', href: 'https://b.com/x', text: 'https://b.com/x', target: '' },
      ]);
    });
  });

  describe('useNewTab toggle', () => {
    it('sets target=_blank when useNewTab is true', () => {
      const { container, textNode } = setup('https://example.com');

      convertToLink({ ...baseOptions, textNode, useNewTab: true });

      const anchor = container.querySelector('a');

      expect(anchor?.getAttribute('target')).toBe('_blank');
    });

    it('omits target when useNewTab is false', () => {
      const { container, textNode } = setup('https://example.com');

      convertToLink({ ...baseOptions, textNode, useNewTab: false });

      const anchor = container.querySelector('a');

      expect(anchor?.hasAttribute('target')).toBe(false);
    });
  });

  describe('enableTtp normalizes href without altering displayed text', () => {
    it('rewrites ttp:// to http:// in href', () => {
      const { container, textNode } = setup('ttp://example.com');

      convertToLink({ ...baseOptions, textNode, enableTtp: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'http://example.com', text: 'ttp://example.com', target: '' },
      ]);
    });

    it('rewrites ttps:// to https:// in href', () => {
      const { container, textNode } = setup('ttps://example.com');

      convertToLink({ ...baseOptions, textNode, enableTtp: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'https://example.com', text: 'ttps://example.com', target: '' },
      ]);
    });

    it('leaves standard URLs untouched', () => {
      const { container, textNode } = setup('https://example.com');

      convertToLink({ ...baseOptions, textNode, enableTtp: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'https://example.com', text: 'https://example.com', target: '' },
      ]);
    });
  });

  describe('enableNoColon inserts the missing colon into href', () => {
    it('normalizes https// to https://', () => {
      const { container, textNode } = setup('https//example.com');

      convertToLink({ ...baseOptions, textNode, enableNoColon: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'https://example.com', text: 'https//example.com', target: '' },
      ]);
    });

    it('normalizes http// to http://', () => {
      const { container, textNode } = setup('http//example.com');

      convertToLink({ ...baseOptions, textNode, enableNoColon: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'http://example.com', text: 'http//example.com', target: '' },
      ]);
    });
  });

  describe('enableAllDoubleSlash', () => {
    it('linkifies arbitrary schemes', () => {
      const { container, textNode } = setup('hoge://example.com');

      convertToLink({ ...baseOptions, textNode, enableAllDoubleSlash: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'hoge://example.com', text: 'hoge://example.com', target: '' },
      ]);
    });

    it('linkifies uppercase HTTP', () => {
      const { container, textNode } = setup('HTTP://example.com');

      convertToLink({ ...baseOptions, textNode, enableAllDoubleSlash: true });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'HTTP://example.com', text: 'HTTP://example.com', target: '' },
      ]);
    });
  });

  describe('trailing punctuation modes', () => {
    type Case = {
      mode: TrailingPunctuationMode;
      input: string;
      expected: NodeSummary[];
    };

    const anchor = (href: string, text: string = href): NodeSummary => ({
      kind: 'anchor',
      href,
      text,
      target: '',
    });
    const text = (t: string): NodeSummary => ({ kind: 'text', text: t });

    const cases: Case[] = [
      // "none" keeps every captured character inside the anchor.
      {
        mode: 'none',
        input: 'https://example.com.',
        expected: [anchor('https://example.com.')],
      },
      {
        mode: 'none',
        input: 'https://example.com...',
        expected: [anchor('https://example.com...')],
      },
      {
        mode: 'none',
        input: '(see https://example.com)',
        expected: [text('(see '), anchor('https://example.com)')],
      },

      // "period" only strips trailing periods.
      {
        mode: 'period',
        input: 'https://example.com.',
        expected: [anchor('https://example.com'), text('.')],
      },
      {
        mode: 'period',
        input: 'https://example.com...',
        expected: [anchor('https://example.com'), text('...')],
      },
      { mode: 'period', input: 'https://example.com?', expected: [anchor('https://example.com?')] },
      { mode: 'period', input: 'https://example.com:', expected: [anchor('https://example.com:')] },
      {
        mode: 'period',
        input: '(see https://example.com)',
        expected: [text('(see '), anchor('https://example.com)')],
      },

      // "periodColon" also strips trailing colons.
      {
        mode: 'periodColon',
        input: 'https://example.com:',
        expected: [anchor('https://example.com'), text(':')],
      },
      {
        mode: 'periodColon',
        input: 'https://example.com?',
        expected: [anchor('https://example.com?')],
      },
      {
        mode: 'periodColon',
        input: 'https://example.com.:',
        expected: [anchor('https://example.com'), text('.:')],
      },

      // "periodColonQuestion" (default) also strips trailing question marks.
      {
        mode: 'periodColonQuestion',
        input: 'https://example.com?',
        expected: [anchor('https://example.com'), text('?')],
      },
      {
        mode: 'periodColonQuestion',
        input: 'https://example.com.',
        expected: [anchor('https://example.com'), text('.')],
      },
      {
        mode: 'periodColonQuestion',
        input: 'https://example.com:',
        expected: [anchor('https://example.com'), text(':')],
      },
      {
        mode: 'periodColonQuestion',
        input: '(see https://example.com)',
        expected: [text('(see '), anchor('https://example.com)')],
      },

      // "all" additionally strips trailing ")".
      {
        mode: 'all',
        input: '(see https://example.com)',
        expected: [text('(see '), anchor('https://example.com'), text(')')],
      },
      {
        mode: 'all',
        input: 'https://example.com)!?',
        expected: [anchor('https://example.com'), text(')'), text('!?')],
      },

      // Characters outside the URL char class are never captured, regardless of mode.
      {
        mode: 'periodColonQuestion',
        input: 'https://example.com,',
        expected: [anchor('https://example.com'), text(',')],
      },
      {
        mode: 'periodColonQuestion',
        input: 'https://example.com;',
        expected: [anchor('https://example.com'), text(';')],
      },
      {
        mode: 'periodColonQuestion',
        input: 'https://example.com!',
        expected: [anchor('https://example.com'), text('!')],
      },
      {
        mode: 'periodColonQuestion',
        input: '[https://example.com]',
        expected: [text('['), anchor('https://example.com'), text(']')],
      },
      {
        mode: 'periodColonQuestion',
        input: '{https://example.com}',
        expected: [text('{'), anchor('https://example.com'), text('}')],
      },
    ];

    for (const { mode, input, expected } of cases) {
      it(`mode="${mode}", input="${input}"`, () => {
        const { container, textNode } = setup(input);

        convertToLink({ ...baseOptions, textNode, trailingPunctuationMode: mode });

        expect(summarize(container.childNodes)).toEqual(expected);
      });
    }
  });

  describe('trailing punctuation combined with scheme rewrites', () => {
    it('strips trailing period from ttp:// (enableTtp)', () => {
      const { container, textNode } = setup('ttp://example.com.');

      convertToLink({
        ...baseOptions,
        textNode,
        enableTtp: true,
        trailingPunctuationMode: 'period',
      });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'http://example.com', text: 'ttp://example.com', target: '' },
        { kind: 'text', text: '.' },
      ]);
    });

    it('strips trailing punctuation before applying enableNoColon rewrite', () => {
      const { container, textNode } = setup('https//example.com.');

      convertToLink({
        ...baseOptions,
        textNode,
        enableNoColon: true,
        trailingPunctuationMode: 'period',
      });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: 'https://example.com', text: 'https//example.com', target: '' },
        { kind: 'text', text: '.' },
      ]);
    });
  });

  describe('scheme + trailing punctuation combinations (text.txt)', () => {
    type OptionOverrides = {
      enableTtp?: boolean;
      enableAllDoubleSlash?: boolean;
      enableNoColon?: boolean;
      trailingPunctuationMode?: TrailingPunctuationMode;
    };
    type Case = {
      label: string;
      input: string;
      options: OptionOverrides;
      expected: NodeSummary[];
    };
    const anchor = (href: string, textStr: string): NodeSummary => ({
      kind: 'anchor',
      href,
      text: textStr,
      target: '',
    });
    const text = (t: string): NodeSummary => ({ kind: 'text', text: t });

    const cases: Case[] = [
      {
        label: 'ttp:// scheme + "?" trim',
        input: 'ttps://example.com?',
        options: { enableTtp: true, trailingPunctuationMode: 'periodColonQuestion' },
        expected: [anchor('https://example.com', 'ttps://example.com'), text('?')],
      },
      {
        label: 'ttp:// with enableTtp + enableNoColon leaves standard URL alone',
        input: 'ttp//example.com',
        options: { enableTtp: true, enableNoColon: true },
        expected: [anchor('http://example.com', 'ttp//example.com')],
      },
      {
        label: 'ttps// with enableTtp + enableNoColon',
        input: 'ttps//example.com',
        options: { enableTtp: true, enableNoColon: true },
        expected: [anchor('https://example.com', 'ttps//example.com')],
      },
      {
        label: 'noColon + period trim',
        input: 'http//example.com.',
        options: { enableNoColon: true, trailingPunctuationMode: 'period' },
        expected: [anchor('http://example.com', 'http//example.com'), text('.')],
      },
      {
        label: 'noColon + trailing comma (comma outside URL class)',
        input: 'https//example.com,',
        options: { enableNoColon: true, trailingPunctuationMode: 'periodColonQuestion' },
        expected: [anchor('https://example.com', 'https//example.com'), text(',')],
      },
      {
        label: 'arbitrary scheme + period trim',
        input: 'hoge://example.com.',
        options: { enableAllDoubleSlash: true, trailingPunctuationMode: 'period' },
        expected: [anchor('hoge://example.com', 'hoge://example.com'), text('.')],
      },
      {
        label: 'no-colon arbitrary scheme',
        input: 'hoge//example.com',
        options: { enableAllDoubleSlash: true },
        expected: [anchor('hoge://example.com', 'hoge//example.com')],
      },
      {
        label: 'uppercase HTTP + period trim',
        input: 'HTTP://example.com.',
        options: { enableAllDoubleSlash: true, trailingPunctuationMode: 'period' },
        expected: [anchor('HTTP://example.com', 'HTTP://example.com'), text('.')],
      },
      {
        label: 'space-separated "h " leaves leading fragment as plain text',
        input: 'h ttp://example.com',
        options: { enableAllDoubleSlash: true },
        expected: [text('h '), anchor('ttp://example.com', 'ttp://example.com')],
      },
      {
        label: 'space-separated "h " + uppercase + question-mark trim',
        input: 'h TTP://example.com?',
        options: { enableAllDoubleSlash: true, trailingPunctuationMode: 'periodColonQuestion' },
        expected: [text('h '), anchor('TTP://example.com', 'TTP://example.com'), text('?')],
      },
    ];

    for (const { label, input, options, expected } of cases) {
      it(label, () => {
        const { container, textNode } = setup(input);

        convertToLink({ ...baseOptions, ...options, textNode });

        expect(summarize(container.childNodes)).toEqual(expected);
      });
    }
  });

  describe('URL with internal parentheses (text.txt)', () => {
    const wikipediaUrl = 'https://en.wikipedia.org/wiki/Foo_(bar)';

    it('keeps the closing paren of a Wikipedia URL under the default mode', () => {
      const { container, textNode } = setup(wikipediaUrl);

      convertToLink({
        ...baseOptions,
        textNode,
        trailingPunctuationMode: 'periodColonQuestion',
      });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: wikipediaUrl, text: wikipediaUrl, target: '' },
      ]);
    });

    it('keeps the closing paren when embedded in a sentence with a trailing period', () => {
      const { container, textNode } = setup(`See ${wikipediaUrl} for details.`);

      convertToLink({
        ...baseOptions,
        textNode,
        trailingPunctuationMode: 'periodColonQuestion',
      });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'text', text: 'See ' },
        { kind: 'anchor', href: wikipediaUrl, text: wikipediaUrl, target: '' },
        { kind: 'text', text: ' for details.' },
      ]);
    });

    it('strips the trailing period after the closing paren under the default mode', () => {
      const { container, textNode } = setup(`${wikipediaUrl}.`);

      convertToLink({
        ...baseOptions,
        textNode,
        trailingPunctuationMode: 'periodColonQuestion',
      });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: wikipediaUrl, text: wikipediaUrl, target: '' },
        { kind: 'text', text: '.' },
      ]);
    });

    it('strips a trailing colon after the closing paren under the default mode', () => {
      const { container, textNode } = setup(`${wikipediaUrl}:`);

      convertToLink({
        ...baseOptions,
        textNode,
        trailingPunctuationMode: 'periodColonQuestion',
      });

      expect(summarize(container.childNodes)).toEqual([
        { kind: 'anchor', href: wikipediaUrl, text: wikipediaUrl, target: '' },
        { kind: 'text', text: ':' },
      ]);
    });

    it('greedily strips ")." from the Wikipedia URL under "all" mode (documented trade-off)', () => {
      const { container, textNode } = setup(`${wikipediaUrl}.`);

      convertToLink({
        ...baseOptions,
        textNode,
        trailingPunctuationMode: 'all',
      });

      expect(summarize(container.childNodes)).toEqual([
        {
          kind: 'anchor',
          href: 'https://en.wikipedia.org/wiki/Foo_(bar',
          text: 'https://en.wikipedia.org/wiki/Foo_(bar',
          target: '',
        },
        { kind: 'text', text: ').' },
      ]);
    });
  });
});
