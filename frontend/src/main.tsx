import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./App";
import { Dashboard } from "./pages/Dashboard";
import { Systems } from "./pages/Systems";
import { Calendar } from "./pages/Calendar";
import { Proposals } from "./pages/Proposals";
import { Intake } from "./pages/Intake";
import { Reports } from "./pages/Reports";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "systems", element: <Systems /> },
      { path: "calendar", element: <Calendar /> },
      { path: "proposals", element: <Proposals /> },
      { path: "intake", element: <Intake /> },
      { path: "reports", element: <Reports /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
