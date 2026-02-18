import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

jest.mock('../pages/Root', () => function MockRoot() {
  return <div data-testid="root-page" />;
});

jest.mock('../pages/Leaf', () => function MockLeaf() {
  return <div data-testid="leaf-page" />;
});

const waitForSelector = async (container, selector, timeoutMs = 1000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const found = container.querySelector(selector);
    if (found) {
      return found;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  return null;
};

const renderAppAtPath = async (path) => {
  window.history.pushState({}, '', path);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });

  return { container, root };
};

test('routes / to Root', async () => {
  const { container, root } = await renderAppAtPath('/');
  const rootPage = await waitForSelector(container, '[data-testid="root-page"]');

  expect(rootPage).not.toBeNull();

  act(() => root.unmount());
  container.remove();
});

test('routes unknown path to Leaf', async () => {
  const { container, root } = await renderAppAtPath('/does-not-exist');
  const leafPage = await waitForSelector(container, '[data-testid="leaf-page"]');

  expect(leafPage).not.toBeNull();

  act(() => root.unmount());
  container.remove();
});
