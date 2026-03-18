import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { getAuth } from "./auth";
import AppShell from "./components/AppShell";
import Dashboard from './pages/Dashboard';
import AddCar from './pages/AddCar';
import CarDetails from './pages/CarDetails';
import AddRecord from './pages/AddRecord';
import EditRecord from './pages/EditRecord';
import Login from "./pages/Login";
import Register from "./pages/Register";
import ManagerDashboard from "./pages/ManagerDashboard";
import Reminders from "./pages/Reminders";
import Profile from "./pages/Profile";
import './index.css';

function RequireAuth({ children }) {
  const { token } = getAuth();
  if (!token) return <Login />;
  return <AppShell>{children}</AppShell>;
}

function RequireManager({ children }) {
  const { token, role } = getAuth();
  if (!token) return <Login />;
  if (role !== "manager") return <AppShell><Dashboard /></AppShell>;
  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AppShell><Login /></AppShell>} />
        <Route path="/register" element={<AppShell><Register /></AppShell>} />

        {/* Main screen */}
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        
        {/* Screen to add a new car */}
        <Route path="/add-car" element={<RequireAuth><AddCar /></RequireAuth>} />
        
        {/* Screen to see a specific car's history */}
        <Route path="/car/:id" element={<RequireAuth><CarDetails /></RequireAuth>} />
        
        {/* Screen to add a service record to a car */}
        <Route path="/car/:id/add-record" element={<RequireAuth><AddRecord /></RequireAuth>} />

        {/* Screen to edit a service record */}
        <Route path="/car/:id/edit-record/:recordId" element={<RequireAuth><EditRecord /></RequireAuth>} />

        <Route path="/manager" element={<RequireManager><ManagerDashboard /></RequireManager>} />
        <Route path="/reminders" element={<RequireAuth><Reminders /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App;