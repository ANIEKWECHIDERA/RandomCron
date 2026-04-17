import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/app-layout";
import { CronjobDetailsPage } from "@/pages/cronjob-details";
import { CronjobsPage } from "@/pages/cronjobs";
import { DashboardPage } from "@/pages/dashboard";
import { RealtimeProvider } from "@/components/realtime-provider";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
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
      </RealtimeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
