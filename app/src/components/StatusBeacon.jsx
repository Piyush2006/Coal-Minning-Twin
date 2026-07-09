// StatusBeacon — DISABLED. We no longer show the "bulb on a stick" beacon on any
// asset (built-in machines or custom/imported components). Status / anomalies are
// conveyed by the component's own colour + the rules glow halo instead.
//
// Kept as a no-op so every existing import and <StatusBeacon …/> usage stays valid;
// it simply renders nothing.
export function StatusBeacon() {
  return null
}
