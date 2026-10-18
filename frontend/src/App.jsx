import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ToastProvider from "./components/ui/ToastProvider";
import AppLayout from "./components/layout/AppLayout";
import { RequireAuth, RequireManager } from "./components/guards";
import Garage from "./pages/Garage";
import AddCar from "./pages/AddCar";
import EditCar from "./pages/EditCar";
import CarDetails from "./pages/CarDetails";
import AddRecord from "./pages/AddRecord";
import EditRecord from "./pages/EditRecord";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import ManagerDashboard from "./pages/ManagerDashboard";
import Reminders from "./pages/Reminders";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<RequireAuth />}>
            <Route path="/change-password" element={<ChangePassword />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Garage />} />
              <Route path="/add-car" element={<AddCar />} />
              <Route path="/car/:id" element={<CarDetails />} />
              <Route path="/car/:id/edit" element={<EditCar />} />
              <Route path="/car/:id/add-record" element={<AddRecord />} />
              <Route path="/car/:id/edit-record/:recordId" element={<EditRecord />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/profile" element={<Profile />} />

              <Route element={<RequireManager />}>
                <Route path="/manager" element={<ManagerDashboard />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
