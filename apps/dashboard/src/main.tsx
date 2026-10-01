import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { DashboardStateProvider } from "./state/DashboardStateContext";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/icons.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DashboardStateProvider>
        <App />
      </DashboardStateProvider>
    </BrowserRouter>
  </React.StrictMode>
);
