// Vision-AI field evidence — real deployment outputs surfaced in the dashboard.
// Labelled generically ("Field deployment output — Vision AI"); no client name
// anywhere. PSD numbers are config so real distribution data can be dropped in.
export const VISION_LABEL = 'Field deployment output — Vision AI'

export const VISION = {
  ppe:  { kind: 'video', src: '/vision/ppe_compliance.mp4',    title: 'AI PPE Compliance Detection', caption: 'AI PPE Compliance Detection' },
  lane: { kind: 'video', src: '/vision/lane_monitoring.mp4',   title: 'AI Vehicle Lane Monitoring',  caption: 'AI Vehicle Lane Monitoring' },
  coal: { kind: 'image', src: '/vision/coal_size_analysis.png', title: 'Coal Size Analysis — AI Vision', caption: 'Coal Size Analysis — AI Vision' },
}

// Coal particle-size analysis — stats + size-distribution (drop real numbers here).
export const visionCoalPSD = {
  stats: { particles: 556, areaMm2: 19516, volumeMm3: 484609 },
  classes: [                                   // count per size class (mm)
    { label: '<10',      value: 44 },
    { label: '10–12.5',  value: 78 },
    { label: '12.5–16',  value: 150 },
    { label: '16–18',    value: 128 },
    { label: '18–25',    value: 106 },
    { label: '>25',      value: 50 },
  ],
}
