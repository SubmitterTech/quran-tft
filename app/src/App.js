import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Root from './pages/Root';
import Leaf from './pages/Leaf';

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL}>
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
    </Router>
  );
}

export default App;
