import { Route, Routes } from "react-router-dom";

import { CreatePage } from "../pages/CreatePage";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/creer" element={<CreatePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
