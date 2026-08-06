// The dashboard's targets / plan / rates. Two tiers:
//   (A) USER INPUTS — the 8 values exposed in the Settings drawer, editable and
//       persisted. They drive Plan-vs-Actual, Throughput, Yield, Cost Variance,
//       IoT Operating Cost/Ton, Energy/Ton and Fuel/Ton.
//   (B) INTERNAL CONFIG — planned operating hours, shift timings and sensor
//       thresholds. NOT user inputs (removed from the drawer); predefined here so
//       Equipment Utilisation, the Shift-wise toggle and Predictive-Maintenance
//       alerts keep working. plannedProduction ÷ plannedOperatingHours ≈
//       targetThroughput keeps the demo internally consistent (9000 ÷ 20 ≈ 450).
export const DEFAULT_SETTINGS = {
  // ── (A) USER INPUTS · Production & targets ──
  plannedProductionPerDay: 9000,      // T/day (saleable)
  targetThroughput: 450,              // T/hr
  targetCoalYield: 82,                // %
  // ── (A) USER INPUTS · Cost ──
  plannedCostPerTon: 182,             // ₹/T (planned all-in cost — for Cost Variance)
  electricityCostPerKwh: 8.2,         // ₹/kWh
  fuelCostPerLitre: 92,               // ₹/L
  // ── (A) USER INPUTS · Efficiency targets ──
  targetEnergyPerTon: 12.0,           // kWh/T
  targetFuelPerTon: 0.42,             // L/T

  // ── (B) INTERNAL · planned operating time per day (derived with the selected
  //        period length for Equipment Utilisation; not a user input) ──
  plannedOperatingHoursPerDay: 20,    // h/day

  // ── (B) INTERNAL · shift timings (drive the Shift-wise toggle; not a user input) ──
  shift1: { name: 'Shift 1', start: '06:00', end: '18:00' },
  shift2: { name: 'Shift 2', start: '18:00', end: '06:00' },

  // ── (B) INTERNAL · equipment sensor thresholds for predictive maintenance
  //        (warn → critical; `low:true` = lower is worse). Not a user input. ──
  thresholds: {
    vibration:      { label: 'Vibration', unit: 'mm/s', warn: 4.5, crit: 6.5 },
    temperature:    { label: 'Bearing temp', unit: '°C', warn: 95, crit: 110 },
    current:        { label: 'Motor current', unit: '%', warn: 110, crit: 125 },
    pressure:       { label: 'Hyd. pressure', unit: 'bar', warn: 2.5, crit: 1.8, low: true },
    rpm:            { label: 'Engine RPM', unit: 'rpm', warn: 1650, crit: 1750 },
    oilPressure:    { label: 'Oil pressure', unit: 'bar', warn: 1.8, crit: 1.2, low: true },
    coolantTemp:    { label: 'Coolant temp', unit: '°C', warn: 98, crit: 108 },
    batteryVoltage: { label: 'Battery', unit: 'V', warn: 23.5, crit: 22.5, low: true },
  },
}
