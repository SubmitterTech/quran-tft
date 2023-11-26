import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Root from './pages/Root';

function App() {
  return (
      <Router basename={process.env.PUBLIC_URL}>
        <Routes>
          <Route path="/qurantft" element={<Root />} />
          <Route path="/" element={<Root />} />
        </Routes>
      </Router>
  );
}

export default App;