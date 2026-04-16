import { createBrowserRouter, Navigate } from "react-router";
import { Timeline } from "./pages/Timeline";
import { Guides } from "./pages/Guides";
import { GuideProfile } from "./pages/GuideProfile";
import { AddEditGuide } from "./pages/AddEditGuide";

export const router = createBrowserRouter([
  {
    // Redirect the base URL to /timeline automatically
    path: "/",
    element: <Navigate to="/timeline?tab=calendar" replace />,
  },
  {
    // Define the /timeline route so your links work
    path: "/timeline",
    Component: Timeline,
  },
  {
    path: "/guides",
    Component: Guides,
  },
  {
    path: "/guides/:id",
    Component: GuideProfile,
  },
  {
    path: "/guides/new",
    Component: AddEditGuide,
  },
  {
    path: "/guides/:id/edit",
    Component: AddEditGuide,
  },
]);
