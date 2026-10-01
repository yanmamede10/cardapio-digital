import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/icons.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
