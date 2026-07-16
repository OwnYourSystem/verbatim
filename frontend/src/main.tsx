import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./App";
import { Dashboard } from "./pages/Dashboard";
import { Systems } from "./pages/Systems";
import { Calendar } from "./pages/Calendar";
import { Proposals } from "./pages/Proposals";
import { Intake } from "./pages/Intake";
import { Reports } from "./pages/Reports";
import { KnowledgePool } from "./pages/KnowledgePool";
import { CheckOutASAP } from "./pages/CheckOutASAP";
import { WallOfPains } from "./pages/WallOfPains";
import { ProductDev } from "./pages/ProductDev";
import { ThemeProvider } from "./theme";
import "./index.css";

// Three.js pulls the main bundle from ~370KB to ~900KB — code-split so it
// only loads when someone actually visits SK Universe, not on every page.
const SKUniverse = lazy(() => import("./pages/SKUniverse").then((m) => ({ default: m.SKUniverse })));

function SKUniverseFallback() {
  return (
    <div
      className="flex items-center justify-center text-slate-500 text-sm"
      style={{ height: "calc(100vh - 3.5rem)", background: "#020408" }}
    >
      Loading universe…
    </div>
  );
}

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
      { path: "knowledge-pool", element: <KnowledgePool /> },
      {
        path: "sk-universe",
        element: (
          <Suspense fallback={<SKUniverseFallback />}>
            <SKUniverse />
          </Suspense>
        ),
      },
      { path: "checkout-asap", element: <CheckOutASAP /> },
      { path: "wall-of-pains", element: <WallOfPains /> },
      { path: "product-dev", element: <ProductDev /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
);
