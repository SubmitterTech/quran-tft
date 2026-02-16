import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

const Root = lazy(() => import(/* webpackChunkName: "route-root" */ './pages/Root'));
const Leaf = lazy(() => import(/* webpackChunkName: "route-leaf" */ './pages/Leaf'));

const RouteLoading = ({ loadingLabel, direction }) => (
  <div
    dir={direction}
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-r from-sky-500 to-cyan-500 select-none"
  >
    <div className="flex items-center text-neutral-100 text-xl md:text-2xl">
      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {loadingLabel}
    </div>
  </div>
);

function App({ loadingLabel = 'Loading...', loadingDirection = 'ltr' }) {
  return (
    <Router basename={process.env.PUBLIC_URL}>
      <Suspense fallback={<RouteLoading loadingLabel={loadingLabel} direction={loadingDirection} />}>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/:language/appendix/:id" element={<Root />} />
          <Route path="/:language/search" element={<Root />} />
          <Route path="/appendix/:id" element={<Root />} />
          <Route path="/search" element={<Root />} />
          <Route path="/:lang/:params" element={<Leaf />} />
          <Route path="/:params" element={<Leaf />} />
          <Route path="*" element={<Leaf />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
