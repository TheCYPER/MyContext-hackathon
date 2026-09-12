import { useEffect, useState } from "react";

import { viewAvailable } from "../lib/model.mjs";
import type { CapabilitySet } from "../types";

export type ViewName = "desk" | "workstreams" | "ideas" | "runs" | "people" | "projects" | "experience" | "atlas" | "system";

export const VIEW_META: Record<ViewName, { kicker: string; title: string; deck: string }> = {
  desk: { kicker: "Academic & professional context", title: "Keep the context behind your work.", deck: "Projects, research ideas, coursework, and experience—ready for your next conversation." },
  workstreams: { kicker: "Project context", title: "Where each project stands.", deck: "Current results, open questions, related people, and the next recorded step." },
  ideas: { kicker: "Questions worth exploring", title: "Research and project ideas.", deck: "Keep possible directions connected to the work that prompted them." },
  runs: { kicker: "Connected operations", title: "Local operations.", deck: "Operations registered with this app remain ephemeral until reviewed." },
  people: { kicker: "Working relationships", title: "People behind the work.", deck: "Mentors, collaborators, and instructors with the context that connects you." },
  projects: { kicker: "Project records", title: "Projects, with their evidence.", deck: "What you built, tested, still question, and who was involved." },
  experience: { kicker: "Academic & professional record", title: "Experience in context.", deck: "Internships, research roles, and peer learning with contributions kept in view." },
  atlas: { kicker: "Context graph", title: "Explore the connections.", deck: "Follow recorded links without turning them into unsupported claims." },
  system: { kicker: "Local and read-only", title: "How MyContext reads your records.", deck: "Markdown and Git hold the saved context; this view shows the committed version." },
};

const isView = (value: string): value is ViewName => Object.hasOwn(VIEW_META, value);

function fromHash(capabilities?: CapabilitySet) {
  const candidate = window.location.hash.replace(/^#/, "");
  return isView(candidate) && viewAvailable(candidate, capabilities) ? candidate : "desk";
}

export function useHashView(capabilities?: CapabilitySet) {
  const [view, setViewState] = useState<ViewName>(() => fromHash(capabilities));

  useEffect(() => {
    const sync = () => setViewState(fromHash(capabilities));
    window.addEventListener("hashchange", sync);
    sync();
    return () => window.removeEventListener("hashchange", sync);
  }, [capabilities]);

  const setView = (next: ViewName) => {
    const safe = viewAvailable(next, capabilities) ? next : "desk";
    window.location.hash = safe;
    setViewState(safe);
  };

  return { view, setView };
}
