import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

const Root = lazy(() => import(/* webpackChunkName: "route-root" */ './pages/Root'));
const Leaf = lazy(() => import(/* webpackChunkName: "route-leaf" */ './pages/Leaf'));

const StaticSplash = ({ direction }) => (
  <div
    dir={direction}
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-cyan-500 to-sky-500 select-none"
  >
    <img
      src={`${process.env.PUBLIC_URL || ''}/logo512.png`}
      alt="Quran TFT"
      className="h-[min(45vw,220px)] w-[min(45vw,220px)] object-contain drop-shadow-[0_10px_28px_rgba(8,47,73,0.3)]"
      loading="eager"
      decoding="async"
      fetchpriority="high"
    />
  </div>
);

function App({ loadingDirection = 'ltr', bootData = null }) {
  return (
    <Router
      basename={process.env.PUBLIC_URL}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Suspense fallback={<StaticSplash direction={loadingDirection} />}>
        <Routes>
          <Route path="/" element={<Root bootData={bootData} />} />
          <Route path="/:language/appendix/:id" element={<Root bootData={bootData} />} />
          <Route path="/:language/search" element={<Root bootData={bootData} />} />
          <Route path="/appendix/:id" element={<Root bootData={bootData} />} />
          <Route path="/search" element={<Root bootData={bootData} />} />
          <Route path="/:lang/:params" element={<Leaf />} />
          <Route path="/:params" element={<Leaf />} />
          <Route path="*" element={<Leaf />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
