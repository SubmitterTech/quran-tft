import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Cover from '../components/Cover';

const coverData = {
  quran: 'QURAN',
  title: 'THE \nFINAL \nTESTAMENT',
  version: '[ Authorized English Version ]',
  translated: 'Translated from the Original \n by  ',
  author: 'Rashad Khalifa, Ph.D.',
  edition: '(Revised Edition)',
};

// jsdom lays nothing out, so the sizes the cover measures are given here. A line is as wide as
// its natural width at the font size the cover set on it, the way a browser would draw it.
const BASE_SIZES = { quran: 3.75, title: 2.25, version: 1.125, translated: 1, author: 1, edition: 1 };

const layoutWith = ({ coverWidth, coverHeight, blockWidth, lineWidths }) => {
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function clientWidth() {
    if (this.classList.contains('cover')) {
      return coverWidth;
    }
    return this.dataset.coverBlock ? blockWidth : 0;
  });
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function clientHeight() {
    return this.classList.contains('cover') ? coverHeight : 0;
  });
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const key = this.dataset?.coverLine;
    if (!key) {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    }
    const width = lineWidths[key] * (parseFloat(this.style.fontSize) / BASE_SIZES[key]);
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0 };
  });
};

const renderCover = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<Cover coverData={coverData} lang="en" onCoverSeen={() => {}} onChangeLanguage={() => {}} />);
  });
  return { container, root };
};

const lineFontSize = (container, key) => container.querySelector(`[data-cover-line="${key}"]`).style.fontSize;

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete global.ResizeObserver;
});

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

test('keeps its drawn sizes while the cover has no width yet', async () => {
  layoutWith({
    coverWidth: 0,
    coverHeight: 0,
    blockWidth: 0,
    lineWidths: { quran: 215, title: 210, version: 254, translated: 206, author: 155, edition: 168 },
  });

  const { container, root } = await renderCover();

  expect(lineFontSize(container, 'quran')).toBe('3.75em');
  expect(lineFontSize(container, 'version')).toBe('1.125em');
  act(() => root.unmount());
});

test('steps a line that is wider than its block down to fit, and settles', async () => {
  layoutWith({
    coverWidth: 320,
    coverHeight: 568,
    blockWidth: 296,
    lineWidths: { quran: 215, title: 210, version: 347, translated: 206, author: 155, edition: 168 },
  });

  const { container, root } = await renderCover();

  expect(parseFloat(lineFontSize(container, 'version'))).toBeCloseTo(1.125 * (296 / 347), 3);
  expect(lineFontSize(container, 'quran')).toBe('3.75em');
  act(() => root.unmount());
});

test('draws each line without the spaces left at its ends', async () => {
  layoutWith({ coverWidth: 0, coverHeight: 0, blockWidth: 0, lineWidths: BASE_SIZES });

  const { container, root } = await renderCover();

  expect(container.querySelector('[data-cover-line="title"]').textContent).toBe('THE\nFINAL\nTESTAMENT');
  expect(container.querySelector('[data-cover-line="translated"]').textContent).toBe('Translated from the Original\nby');
  act(() => root.unmount());
});
