// src/components/Greeting.tsx
import React, { useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { useShotsContext } from "../context/ShotsContext";
import { resolveGreeting } from "../utils/greeting";
import { todayLocalISO } from "../utils/datetime";

/** The one line, deliberately identical whether or not a name is set. */
export const ACKNOWLEDGEMENT = "Logged for you.";

/**
 * The warm greeting at the top of the log view. Adapts to the user's milestone /
 * first-time / returning state (see resolveGreeting). The date is snapshotted once
 * at mount (lazy useState) so the greeting stays stable for the session and only
 * re-derives on a reload or a profile/shots change — no clock-watching.
 *
 * Rendered as a paragraph, not a heading (the app title is the h1).
 */
export const Greeting: React.FC<{ acknowledged?: boolean }> = ({
  acknowledged = false,
}) => {
  const { profile } = useProfileContext();
  const { shots } = useShotsContext();
  const [today] = useState(todayLocalISO);
  const text = resolveGreeting(profile, shots.length > 0, today);

  // The acknowledgement outranks everything this slot would otherwise show,
  // including a milestone — but only while it is still a response to something
  // you just did. App retires it on the next deliberate action, so a milestone
  // is deferred rather than eclipsed and is waiting when you look again.
  //
  // `role="status"` announces the swap politely. A live region does not announce
  // its INITIAL content, so an ordinary greeting stays silent and only the change
  // to this line is spoken.
  return (
    <p
      className={`greeting${acknowledged ? " greeting--acknowledged" : ""}`}
      role="status"
    >
      {acknowledged ? ACKNOWLEDGEMENT : text}
    </p>
  );
};
