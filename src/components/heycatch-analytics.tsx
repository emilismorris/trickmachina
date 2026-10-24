"use client";
import { useEffect } from "react";
import { analytics } from "@heycatch/sdk";

let started = false;

export function HeyCatchAnalytics() {
  useEffect(() => {
    if (started) return;
    started = true;
    analytics.init({
      projectKey: "hck_pk_XugB4QZC3CZBnysKezMmkMaHif8XXkES",
      install: { framework: "vite-react", frameworkVersion: "8", agent: "cursor" },
    });
  }, []);
  return null;
}
