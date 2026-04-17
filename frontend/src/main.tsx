import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/app-layout";
import { CronjobDetailsPage } from "@/pages/cronjob-details";
import { CronjobsPage } from "@/pages/cronjobs";
import { DashboardPage } from "@/pages/dashboard";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cronjobs" element={<CronjobsPage />} />
            <Route path="/cronjobs/:id" element={<CronjobDetailsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors />
    </TooltipProvider>
  </React.StrictMode>,
);
