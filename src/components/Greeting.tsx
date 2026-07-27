// src/components/Greeting.tsx
import React, { useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { useShotsContext } from "../context/ShotsContext";
import { resolveGreeting } from "../utils/greeting";
import { todayLocalISO } from "../utils/datetime";

/**
 * The warm greeting at the top of the log view. Adapts to the user's milestone /
 * first-time / returning state (see resolveGreeting). The date is snapshotted once
 * at mount (lazy useState) so the greeting stays stable for the session and only
 * re-derives on a reload or a profile/shots change — no clock-watching.
 *
 * Rendered as a paragraph, not a heading (the app title is the h1).
 */
export const Greeting: React.FC = () => {
  const { profile } = useProfileContext();
  const { shots } = useShotsContext();
  const [today] = useState(todayLocalISO);
  const text = resolveGreeting(profile, shots.length > 0, today);

  return <p className="greeting">{text}</p>;
};
