import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$discipline", params: { discipline: "skate" }, replace: true });
  },
});
