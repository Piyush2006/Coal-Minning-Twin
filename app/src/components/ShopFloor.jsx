import { Html } from '@react-three/drei'
import { Floor } from './Floor'
import { ChainConveyor } from './ChainConveyor'
import { Carbonator }    from './machines/Carbonator'
import { PETFiller }     from './machines/PETFiller'
import { RotaryCapper }  from './machines/RotaryCapper'
import { Labeller }      from './machines/Labeller'
import { CheckWeigher }  from './machines/CheckWeigher'
import { CanFiller }     from './machines/CanFiller'
import { CanSeamer }     from './machines/CanSeamer'
import { DateCoder }     from './machines/DateCoder'
import { BottleWasher }  from './machines/BottleWasher'
import { GlassFiller }   from './machines/GlassFiller'
import { CrownCapper }   from './machines/CrownCapper'
import { EBIInspector }  from './machines/EBIInspector'

function Label({ position, text }) {
  return (
    <Html position={position} center distanceFactor={18} zIndexRange={[0, 0]}>
      <div style={{
        color: '#2a3d50',
        fontFamily: "'Courier New', monospace",
        fontSize: 11,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {text}
      </div>
    </Html>
  )
}

function LineLabel({ position, text, color = '#4488aa' }) {
  return (
    <Html position={position} center distanceFactor={22} zIndexRange={[0, 0]}>
      <div style={{
        color,
        fontFamily: "'Courier New', monospace",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {text}
      </div>
    </Html>
  )
}

export function ShopFloor({ statuses, onMachineClick }) {
  const A = { carb: -23, fill: -13, cap: -4,  lab: 4,   cw: 11  }
  const B = { carb: -23, fill: -13, seam: -5, code: 2,  cw: 9   }
  const C = { wash: -20, fill: -11, cap: -2,  ebi: 6,   cw: 13  }
  const ZA =  8.5,  ZB = 0,  ZC = -8.5

  return (
    <group>
      <Floor />

      <LineLabel position={[-24, 0.5, ZA + 2.5]} text="— LINE A: PET BOTTLES —" color="#008844" />
      <LineLabel position={[-24, 0.5, ZB + 2.5]} text="— LINE B: CANS —"         color="#0066cc" />
      <LineLabel position={[-24, 0.5, ZC - 2.5]} text="— LINE C: GLASS —"        color="#cc7700" />

      {/* ══ LINE A ══ */}
      <Carbonator   position={[A.carb, 0, ZA]} status={statuses.carb1}   onClick={() => onMachineClick('carb1',   'Carbonator',    'A')} />
      <Label position={[A.carb,  0.1, ZA + 1.8]} text="Carbonator" />

      <PETFiller    position={[A.fill, 0, ZA]} status={statuses.petFill}  onClick={() => onMachineClick('petFill', 'PET Filler',    'A')} />
      <Label position={[A.fill,  0.1, ZA + 2.8]} text="PET Filler" />

      <RotaryCapper position={[A.cap,  0, ZA]} status={statuses.rotCap}   onClick={() => onMachineClick('rotCap',  'Rotary Capper', 'A')} />
      <Label position={[A.cap,   0.1, ZA + 2.2]} text="Rotary Capper" />

      <Labeller     position={[A.lab,  0, ZA]} status={statuses.label}    onClick={() => onMachineClick('label',   'Labeller',      'A')} />
      <Label position={[A.lab,   0.1, ZA + 1.8]} text="Labeller" />

      <CheckWeigher position={[A.cw,   0, ZA]} status={statuses.cwPET}    onClick={() => onMachineClick('cwPET',   'Check Weigher', 'A')} />
      <Label position={[A.cw,    0.1, ZA + 1.0]} text="Check Weigher" />

      <ChainConveyor start={A.carb + 1.2} end={A.fill - 2.1} z={ZA} />
      <ChainConveyor start={A.fill + 2.1} end={A.cap  - 1.6} z={ZA} />
      <ChainConveyor start={A.cap  + 1.6} end={A.lab  - 1.6} z={ZA} />
      <ChainConveyor start={A.lab  + 1.6} end={A.cw   - 1.1} z={ZA} />

      {/* ══ LINE B ══ */}
      <Carbonator position={[B.carb, 0, ZB]} status={statuses.carb2}   onClick={() => onMachineClick('carb2',   'Carbonator',    'B')} />
      <Label position={[B.carb, 0.1, ZB + 1.8]} text="Carbonator-2" />

      <CanFiller  position={[B.fill, 0, ZB]} status={statuses.canFill}  onClick={() => onMachineClick('canFill', 'Can Filler',    'B')} />
      <Label position={[B.fill, 0.1, ZB + 2.2]} text="Can Filler" />

      <CanSeamer  position={[B.seam, 0, ZB]} status={statuses.seamer}   onClick={() => onMachineClick('seamer',  'Can Seamer',    'B')} />
      <Label position={[B.seam, 0.1, ZB + 1.5]} text="Can Seamer" />

      <DateCoder  position={[B.code, 0, ZB]} status={statuses.coder}    onClick={() => onMachineClick('coder',   'Date Coder',    'B')} />
      <Label position={[B.code, 0.1, ZB + 1.0]} text="Date Coder" />

      <CheckWeigher position={[B.cw, 0, ZB]} status={statuses.cwCan}    onClick={() => onMachineClick('cwCan',   'Check Weigher', 'B')} />
      <Label position={[B.cw,  0.1, ZB + 1.0]} text="Check Weigher" />

      <ChainConveyor start={B.carb + 1.2} end={B.fill - 1.9} z={ZB} />
      <ChainConveyor start={B.fill + 1.9} end={B.seam - 1.2} z={ZB} />
      <ChainConveyor start={B.seam + 1.2} end={B.code - 0.7} z={ZB} />
      <ChainConveyor start={B.code + 0.7} end={B.cw   - 1.1} z={ZB} />

      {/* ══ LINE C ══ */}
      <BottleWasher position={[C.wash, 0, ZC]} status={statuses.washer}   onClick={() => onMachineClick('washer',   'Bottle Washer', 'C')} />
      <Label position={[C.wash, 0.1, ZC - 1.5]} text="Bottle Washer" />

      <GlassFiller  position={[C.fill, 0, ZC]} status={statuses.glasFill} onClick={() => onMachineClick('glasFill', 'Glass Filler',  'C')} />
      <Label position={[C.fill, 0.1, ZC - 2.6]} text="Glass Filler" />

      <CrownCapper  position={[C.cap,  0, ZC]} status={statuses.crown}    onClick={() => onMachineClick('crown',    'Crown Capper',  'C')} />
      <Label position={[C.cap,  0.1, ZC - 1.8]} text="Crown Capper" />

      <EBIInspector position={[C.ebi,  0, ZC]} status={statuses.ebi}      onClick={() => onMachineClick('ebi',      'EBI Inspector', 'C')} />
      <Label position={[C.ebi,  0.1, ZC - 1.0]} text="EBI Inspector" />

      <CheckWeigher position={[C.cw,   0, ZC]} status={statuses.cwGlass}  onClick={() => onMachineClick('cwGlass',  'Check Weigher', 'C')} />
      <Label position={[C.cw,   0.1, ZC - 1.0]} text="Check Weigher" />

      <ChainConveyor start={C.wash + 3.4} end={C.fill - 2.2} z={ZC} />
      <ChainConveyor start={C.fill + 2.2} end={C.cap  - 1.2} z={ZC} />
      <ChainConveyor start={C.cap  + 1.2} end={C.ebi  - 1.1} z={ZC} />
      <ChainConveyor start={C.ebi  + 1.1} end={C.cw   - 1.1} z={ZC} />
    </group>
  )
}
