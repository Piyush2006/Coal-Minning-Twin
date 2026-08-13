// The dashboard's rates / capacity / baselines — all INTERNAL config now (there
// is no Settings drawer). All PLANNED/TARGET values come from the user's
// operational plan (see calc/plan.js); everything here only shapes the synthetic
// ACTUAL telemetry and the monetary conversion so every tab keeps working.
export const DEFAULT_SETTINGS = {
  // ── INTERNAL · cost rates for the operating-cost KPIs (₹ conversion + Cost
  //        Variance benchmark). Not user-editable; the plan carries the per-ton
  //        efficiency targets, these carry the money rates. ──
  plannedCostPerTon: 182,             // ₹/T (planned all-in cost — for Cost Variance)
  electricityCostPerKwh: 8.2,         // ₹/kWh
  fuelCostPerLitre: 92,               // ₹/L

  // ── INTERNAL · mine capacity — scale of the synthetic ACTUAL output when no
  //        plan covers a day. NOT a plan/target; only shapes realistic telemetry ──
  capacityPerDay: 9000,               // T/day (saleable capacity baseline)
  // ── (B) INTERNAL · baseline per-ton intensities the ACTUAL kWh / litres /
  //        man-hours are generated from (comparison targets come from the plan) ──
  baseEnergyPerTon: 12.0,             // kWh/T
  baseFuelPerTon: 0.42,               // L/T
  // ── (B) INTERNAL · planned operating time per day (also scales the plan-derived
  //        Throughput target: planned coal/day ÷ this) ──
  plannedOperatingHoursPerDay: 20,    // h/day
  // ── (B) INTERNAL · nominal coal recovery baseline for realistic mock signals.
  //        Recovery has NO target (site maximises it); this only shapes the data ──
  nominalCoalYield: 82,               // %
  // ── (B) INTERNAL · planned crew per shift → man-hours for labour intensity ──
  plannedManpowerPerShift: 150,       // workers/shift (man-shifts/day = crew × 2 shifts)
  hoursPerManShift: 8,                // standard shift length → man-hours = man-shifts × 8

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
