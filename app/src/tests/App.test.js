import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

jest.mock('../pages/Root', () => function MockRoot() {
  return <div data-testid="root-page" />;
});

jest.mock('../pages/Leaf', () => function MockLeaf() {
  return <div data-testid="leaf-page" />;
});

test('routes / to Root', () => {
  window.history.pushState({}, '', '/');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<App />));
  expect(container.querySelector('[data-testid="root-page"]')).not.toBeNull();
  act(() => root.unmount());
  container.remove();
});

test('routes unknown path to Leaf', () => {
  window.history.pushState({}, '', '/does-not-exist');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<App />));
  expect(container.querySelector('[data-testid="leaf-page"]')).not.toBeNull();
  act(() => root.unmount());
  container.remove();
});
