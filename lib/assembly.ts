import { Resolved } from './catalog';
import type { sfx } from './sound';

export type SceneKey = 'case' | 'board' | 'cpu' | 'ram' | 'storage' | 'cooler' | 'gpu' | 'psu';
export type CableKey = 'atx24' | 'eps8' | 'pcie' | 'front' | 'fans';
export type SoundName = keyof typeof sfx;

/* ------------------------------------------------------------------ rig state */

// Every movable sub-part in the scene. Values ease toward their targets every frame.
// Convention: -1 = not in the scene yet, 0 = held just outside its spot, 1 = installed / closed / done.
// Mechanisms (lever, plate, latches) use 0 = closed, 1 = open.
export const RIG_KEYS = [
  'lever', 'plate', 'socketCover', 'cpu', 'cpuSpin', 'cpuFlip',
  'm2Sink', 'm2Film', 'm2Screw', 'm2',
  'ramLatch', 'ram',
  'bracket', 'paste', 'coolerFilm', 'cooler', 'coolerScrew',
  'glass', 'psu', 'psuSwitch', 'ioShield', 'board', 'boardScrews',
  'slotCovers', 'pcieLatch', 'gpu', 'gpuScrew',
  'atx24', 'eps8', 'pcie', 'front', 'fans', 'power',
] as const;
export type RigKey = (typeof RIG_KEYS)[number];
export type RigState = Record<RigKey, number>;

/** Fully built PC, used everywhere outside the assembly guide. */
export const RIG_BUILT: RigState = {
  lever: 0, plate: 0, socketCover: 0, cpu: 1, cpuSpin: 0, cpuFlip: 0,
  m2Sink: 0, m2Film: 0, m2Screw: 1, m2: 1,
  ramLatch: 0, ram: 1,
  bracket: 1, paste: 0, coolerFilm: 0, cooler: 1, coolerScrew: 1,
  glass: 1, psu: 1, psuSwitch: 1, ioShield: 1, board: 1, boardScrews: 1,
  slotCovers: 1, pcieLatch: 0, gpu: 1, gpuScrew: 1,
  atx24: 1, eps8: 1, pcie: 1, front: 1, fans: 1, power: 0,
};

/** Everything still in its box. The assembly guide folds each action's changes onto this. */
export const RIG_START: RigState = {
  lever: 0, plate: 0, socketCover: 1, cpu: -1, cpuSpin: 1, cpuFlip: 0,
  m2Sink: 0, m2Film: 1, m2Screw: 1, m2: -1,
  ramLatch: 0, ram: -1,
  bracket: 0, paste: 0, coolerFilm: 1, cooler: -1, coolerScrew: 0,
  glass: 1, psu: -1, psuSwitch: 0, ioShield: -1, board: 0, boardScrews: 0,
  slotCovers: 0, pcieLatch: 0, gpu: -1, gpuScrew: 0,
  atx24: -1, eps8: -1, pcie: -1, front: -1, fans: -1, power: 0,
};

/* ------------------------------------------------------------------ anchors & marks */

// Named points the camera can fly to and callouts can pin to. Board anchors move with the board.
export type Anchor =
  | 'boardCenter' | 'socket' | 'lever' | 'plate' | 'cpuAbove' | 'coolerBase' | 'cpuTri' | 'socketTri'
  | 'm2Slot' | 'm2Screw' | 'm2Sink' | 'm2Key' | 'ramA2' | 'ramB2' | 'ramLatch' | 'ramNotch' | 'ramSlots'
  | 'cs1' | 'cs2' | 'cs3' | 'cs4' | 'coolerTop' | 'cpuFan' | 'eps' | 'atx' | 'pcieSlot' | 'pcieLatch'
  | 'fpanel' | 'fpPwr' | 'fpRst' | 'fpHdd' | 'fpPled' | 'usb3' | 'audio' | 'sysFan' | 'cmos'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'case' | 'tray' | 'standoffs' | 'ioShield' | 'slotCovers' | 'psuBay' | 'psuSockets' | 'psuSwitch'
  | 'gpuPorts' | 'gpuPower' | 'gpuBracket' | 'glass' | 'radiator' | 'frontFans' | 'grommet' | 'topCutout';

export type Mark = {
  at: Anchor;
  text?: string;
  n?: number; // numbered order, e.g. screw sequence
  arrow?: [number, number, number]; // motion direction in the anchor's space
  tone?: 'info' | 'warn' | 'ok';
};

export type Action = {
  t: string; // the instruction
  why?: string; // the small detail that makes it make sense
  rig?: Partial<RigState>;
  marks?: Mark[];
  focus?: Anchor;
  zoom?: number; // camera distance in cm
  from?: [number, number, number]; // camera direction override
  sounds?: [number, SoundName][];
  active?: CableKey[];
  hold?: number; // seconds before autoplay advances
  bios?: boolean; // show the BIOS screen mock
};

export type Step = {
  id: string;
  title: string;
  minutes: number;
  hideCase?: boolean;
  actions: Action[];
  check: string[];
  watchOut?: string;
};

/* ------------------------------------------------------------------ steps */

export function assemblySteps(r: Resolved): Step[] {
  const sock = r.cpu?.socket ?? 'AM5';
  const am4 = sock === 'AM4';
  const lga = sock === 'LGA1700';
  const cooler = r.cooler;
  const gpu = r.gpu;
  const ddr5 = r.board?.mem === 'DDR5';
  const fpBoard = r.board?.name.startsWith('MSI') ? 'JFP1' : 'F_PANEL';
  const steps: Step[] = [];

  steps.push({
    id: 'prep', title: 'Set up your workspace', minutes: 10, hideCase: true,
    actions: [
      { t: 'Clear a large table and work on a hard surface, not carpet.', why: 'Carpet builds static; a table also stops screws vanishing.', focus: 'boardCenter', zoom: 70 },
      { t: 'Lay the motherboard flat on top of its own box.', why: 'The box is non-conductive and the right height. It is your workbench for the next four steps.', focus: 'boardCenter', zoom: 55, marks: [{ at: 'boardCenter', text: 'Board on its box' }], sounds: [[0, 'thunk']] },
      { t: 'Touch the bare metal of the case or a radiator to discharge static.', why: 'Do it again whenever you have walked around. A wrist strap is nice but optional.', focus: 'boardCenter', zoom: 70 },
      { t: 'Open the motherboard manual to the installation section and keep a Phillips #2 screwdriver handy.', focus: 'boardCenter', zoom: 55 },
    ],
    check: ['Board is on its box', 'Manual is open', 'Screwdriver ready'],
  });

  const cpuActions: Action[] = am4 ? [
    { t: 'Push the socket lever slightly out from the socket, then lift it straight up.', why: 'AM4 levers swing up about 90 degrees. Go all the way or the CPU will not drop in.', rig: { lever: 1 }, focus: 'socket', zoom: 20, marks: [{ at: 'lever', text: 'Lever', arrow: [1, 0, 0] }], sounds: [[0.2, 'click']] },
    { t: 'Take the CPU out of its tray and hold it by the edges only.', why: 'On AM4 the 1,331 pins are on the CPU itself. One bent pin can stop it working.', rig: { cpu: 0, cpuFlip: 1 }, focus: 'cpuAbove', zoom: 18, marks: [{ at: 'cpuAbove', text: 'Pins on the CPU: never touch them', tone: 'warn' }], sounds: [[0, 'whoosh']] },
    { t: 'Turn it so the small gold triangle on the corner matches the triangle printed on the socket.', why: 'This is the only orientation it fits. If it does not drop in, it is the wrong way around.', rig: { cpuFlip: 0, cpuSpin: 0 }, focus: 'socket', zoom: 28, marks: [{ at: 'cpuTri', text: 'Gold triangle' }, { at: 'socketTri', text: 'Socket triangle' }] },
    { t: 'Lower it so it hovers just above the socket, perfectly flat.', rig: { cpu: 0.5 }, focus: 'socket', zoom: 18, marks: [{ at: 'socket', arrow: [-1, 0, 0] }] },
    { t: 'Let it drop in under its own weight. Do not press.', why: 'Zero force. If you need to push, stop and check the triangle.', rig: { cpu: 1 }, focus: 'socket', zoom: 18, sounds: [[0.45, 'click']] },
    { t: 'Lower the lever back down until it clicks under its hook.', rig: { lever: 0 }, focus: 'socket', zoom: 20, marks: [{ at: 'lever', arrow: [-1, 0, 0] }], sounds: [[0.5, 'snap']] },
  ] : [
    { t: `Press the socket lever down and out from under its hook.`, why: 'It is spring-loaded and sits under a small metal hook on the side of the socket.', rig: { lever: 0.15 }, focus: 'socket', zoom: 22, marks: [{ at: 'lever', text: 'Lever', arrow: [0, 0, -1] }], sounds: [[0.15, 'click']] },
    { t: 'Swing the lever all the way up.', rig: { lever: 1 }, focus: 'socket', zoom: 22, marks: [{ at: 'lever', arrow: [1, 0, 0] }] },
    { t: 'Lift the metal load plate. Leave the plastic cover on it for now.', why: 'The cover protects the socket pins. It pops off by itself when you close the lever.', rig: { plate: 1 }, focus: 'socket', zoom: 22, marks: [{ at: 'plate', text: 'Load plate', arrow: [1, 0, 0] }], sounds: [[0.3, 'click']] },
    { t: 'Look into the socket, but do not touch it.', why: `The ${lga ? '1,700' : '1,718'} pins are inside the socket and bend at a touch. Bent socket pins are the most common way first-time builders kill a board.`, focus: 'socket', zoom: 14, marks: [{ at: 'socket', text: 'Pins live here: hands off', tone: 'warn' }] },
    { t: 'Pick up the CPU by its edges.', why: 'The underside is flat gold contact pads. Skin oil on them can cause bad contact.', rig: { cpu: 0, cpuFlip: 1 }, focus: 'cpuAbove', zoom: 20, marks: [{ at: 'cpuAbove', text: 'Gold pads: do not touch' }], sounds: [[0, 'whoosh']] },
    { t: `Turn it so the gold triangle on the corner lines up with the triangle on the socket${lga ? ', and the two side notches line up with the socket keys' : ''}.`, why: 'It only fits one way. The keys stop it from sitting flat if it is rotated.', rig: { cpuFlip: 0, cpuSpin: 0 }, focus: 'socket', zoom: 28, marks: [{ at: 'cpuTri', text: 'Gold triangle' }, { at: 'socketTri', text: 'Socket triangle' }] },
    { t: 'Hold it flat, just above the socket.', rig: { cpu: 0.5 }, focus: 'socket', zoom: 18, marks: [{ at: 'socket', arrow: [-1, 0, 0] }] },
    { t: 'Lower it straight down and let go. No sliding, no pressing.', rig: { cpu: 1 }, focus: 'socket', zoom: 18, sounds: [[0.45, 'click']] },
    { t: 'Close the load plate over the CPU.', rig: { plate: 0 }, focus: 'socket', zoom: 22, marks: [{ at: 'plate', arrow: [-1, 0, 0] }], sounds: [[0.45, 'click']] },
    { t: 'Push the lever down and hook it back under its latch.', why: 'It takes real force and can creak. That is normal. The plastic cover pops off: keep it, you need it for a warranty return.', rig: { lever: 0, socketCover: 0 }, focus: 'socket', zoom: 24, marks: [{ at: 'lever', arrow: [-1, 0, 0] }], sounds: [[0.5, 'snap']] },
  ];
  steps.push({
    id: 'cpu', title: 'Install the CPU', minutes: 5, hideCase: true, actions: cpuActions,
    check: ['Triangles lined up', 'CPU sits flat with no gap', 'Lever latched under its hook'],
    watchOut: am4 ? 'AM4 pins are on the CPU. Never set it pins-down on the table.' : 'Never touch the socket pins. One bent pin can mean a dead board.',
  });

  steps.push({
    id: 'm2', title: 'Install the NVMe SSD', minutes: 6, hideCase: true,
    actions: [
      { t: 'Unscrew the M.2 heatsink above the first M.2 slot and lift it off.', why: 'Use the slot closest to the CPU. It is the fastest one, wired straight to the processor.', rig: { m2Sink: 1 }, focus: 'm2Slot', zoom: 22, marks: [{ at: 'm2Sink', text: 'M.2 heatsink', arrow: [1, 0, 0] }], sounds: [[0, 'screw']] },
      { t: 'Peel the clear plastic film off the thermal pad on the heatsink.', why: 'Easy to miss. Left on, the drive runs hot and slows down.', rig: { m2Film: 0 }, focus: 'm2Sink', zoom: 18, marks: [{ at: 'm2Sink', text: 'Peel the film', tone: 'warn' }] },
      { t: 'Remove the tiny screw (or turn the tool-free latch) at the far end of the slot.', rig: { m2Screw: 0 }, focus: 'm2Screw', zoom: 14, marks: [{ at: 'm2Screw', arrow: [1, 0, 0] }], sounds: [[0, 'screw']] },
      { t: 'Hold the drive label-up and line its notch up with the key in the slot.', rig: { m2: 0 }, focus: 'm2Slot', zoom: 18, marks: [{ at: 'm2Key', text: 'Key matches notch' }], sounds: [[0, 'whoosh']] },
      { t: 'Slide it into the slot at about 30 degrees.', why: 'The gold contacts should almost disappear into the slot.', rig: { m2: 0.5 }, focus: 'm2Slot', zoom: 16, marks: [{ at: 'm2Slot', arrow: [0, 0, -1] }], sounds: [[0.5, 'plug']] },
      { t: 'Press the far end down flat and refit the screw.', why: 'It springs up at an angle when you let go. That is normal until the screw is in.', rig: { m2: 1, m2Screw: 1 }, focus: 'm2Screw', zoom: 16, marks: [{ at: 'm2Screw', arrow: [-1, 0, 0] }], sounds: [[0.4, 'screw']] },
      { t: 'Put the heatsink back on and screw it down.', rig: { m2Sink: 0 }, focus: 'm2Slot', zoom: 22, sounds: [[0.5, 'screw']] },
    ],
    check: ['Film removed from the heatsink pad', 'Drive sits flat and screwed down'],
  });

  steps.push({
    id: 'ram', title: 'Install the RAM', minutes: 5, hideCase: true,
    actions: [
      { t: 'Find slots A2 and B2: the 2nd and 4th slots counting from the CPU.', why: 'With two sticks these slots run in dual-channel at full speed. Your manual has the same diagram.', focus: 'ramSlots', zoom: 26, marks: [{ at: 'ramA2', text: 'A2', n: 1 }, { at: 'ramB2', text: 'B2', n: 2 }] },
      { t: 'Push the latches at the top end of those slots outward to open them.', rig: { ramLatch: 1 }, focus: 'ramLatch', zoom: 18, marks: [{ at: 'ramLatch', arrow: [0, 1, 0] }], sounds: [[0.1, 'click']] },
      { t: 'Line up the notch in the gold edge with the key inside the slot.', why: `The notch is off-centre${ddr5 ? ' (DDR5 notch sits near the middle)' : ''}, so the stick only goes in one way round.`, rig: { ram: 0 }, focus: 'ramSlots', zoom: 30, from: [0.9, 0.7, 0.5], marks: [{ at: 'ramNotch', text: 'Notch to key' }], sounds: [[0, 'whoosh']] },
      { t: 'Set each stick straight into its slot.', rig: { ram: 0.5 }, focus: 'ramSlots', zoom: 22, marks: [{ at: 'ramA2', arrow: [-1, 0, 0] }, { at: 'ramB2', arrow: [-1, 0, 0] }] },
      { t: 'Press firmly on both ends until the latch snaps shut. It takes more force than you think.', why: 'You should hear a clear click. A half-seated stick is the #1 reason a new PC shows no picture.', rig: { ram: 1, ramLatch: 0 }, focus: 'ramSlots', zoom: 22, marks: [{ at: 'ramLatch', text: 'Click!', tone: 'ok' }], sounds: [[0.45, 'snap'], [0.6, 'snap']] },
    ],
    check: ['Both latches closed', 'Both sticks sit at the same height'],
    watchOut: 'If one end sits higher than the other, it is not seated. Press again.',
  });

  const coolerActions: Action[] = cooler?.kind === 'stock' ? [
    { t: 'Do not wipe the grey paste on the bottom of the stock cooler.', why: 'It comes pre-applied in exactly the right amount.', rig: { cooler: 0, coolerFilm: 0 }, focus: 'cpuAbove', zoom: 34, marks: [{ at: 'cpuAbove', text: 'Pre-applied paste' }], sounds: [[0, 'whoosh']] },
    { t: 'Line the four screws up with the holes around the socket and set the cooler down flat.', rig: { cooler: 1 }, focus: 'socket', zoom: 28, sounds: [[0.5, 'thunk']] },
    { t: 'Tighten the screws in an X pattern: a few turns each, then go round again.', why: 'Even pressure spreads the paste evenly. Cranking one corner down first can leave a gap.', rig: { coolerScrew: 1 }, focus: 'socket', zoom: 28, marks: [{ at: 'cs1', n: 1 }, { at: 'cs2', n: 2 }, { at: 'cs3', n: 3 }, { at: 'cs4', n: 4 }], sounds: [[0.1, 'screw'], [0.6, 'screw'], [1.1, 'screw'], [1.6, 'screw']], hold: 4 },
    { t: 'Plug the cooler fan into the CPU_FAN header.', why: 'Many boards refuse to boot without a fan signal on CPU_FAN.', focus: 'cpuFan', zoom: 16, marks: [{ at: 'cpuFan', text: 'CPU_FAN' }], sounds: [[0, 'plug']] },
  ] : cooler?.kind === 'aio' ? [
    { t: `Fit the ${am4 || sock === 'AM5' ? 'AMD' : 'Intel'} mounting bracket from the cooler box around the socket.`, why: 'AIO coolers ship with brackets for every socket. Use the one your manual shows for yours.', rig: { bracket: 1 }, focus: 'socket', zoom: 26, sounds: [[0.2, 'screw']] },
    { t: 'Check the pump block for pre-applied paste. If it has none, add a pea-sized dot to the centre of the CPU.', rig: { paste: 1 }, focus: 'socket', zoom: 16, marks: [{ at: 'socket', text: 'Pea-sized dot' }] },
    { t: 'The pump and radiator go in after the board is in the case. Leave them in the box for now.', focus: 'boardCenter', zoom: 55 },
  ] : [
    { t: `Fit the ${am4 || sock === 'AM5' ? 'AMD' : 'Intel'} mounting bracket from the cooler box.`, why: `${am4 || sock === 'AM5' ? 'On AMD you remove the plastic clips and reuse the stock backplate.' : 'On Intel a backplate goes behind the board first.'} The cooler manual shows each socket separately.`, rig: { bracket: 1 }, focus: 'socket', zoom: 26, sounds: [[0.2, 'screw'], [0.7, 'screw']] },
    { t: 'Put a pea-sized dot of thermal paste in the centre of the CPU.', why: 'Mounting pressure spreads it. More is not better.', rig: { paste: 1 }, focus: 'socket', zoom: 14, marks: [{ at: 'socket', text: 'Pea-sized dot' }] },
    { t: 'Turn the cooler over: there is a clear plastic film on the base.', rig: { cooler: 0 }, focus: 'coolerBase', zoom: 42, from: [1, 0.15, 0.35], marks: [{ at: 'coolerBase', text: 'Protective film!', tone: 'warn' }], sounds: [[0, 'whoosh']] },
    { t: 'Peel the film off completely.', why: 'Forgetting it is the classic overheating mistake. Your CPU would hit 95 C and throttle.', rig: { coolerFilm: 0 }, focus: 'coolerBase', zoom: 42, from: [1, 0.15, 0.35] },
    { t: 'Lower the cooler straight down onto the CPU. Do not twist it once it touches.', rig: { cooler: 1 }, focus: 'socket', zoom: 52, marks: [{ at: 'socket', arrow: [-1, 0, 0] }], sounds: [[0.5, 'thunk']] },
    { t: 'Tighten the two spring screws a few turns at a time, alternating sides, until they stop.', rig: { coolerScrew: 1 }, focus: 'socket', zoom: 50, from: [0.8, 0.6, 0.5], marks: [{ at: 'cs1', n: 1 }, { at: 'cs2', n: 2 }], sounds: [[0.1, 'screw'], [0.7, 'screw'], [1.3, 'screw']], hold: 3.5 },
    { t: 'Plug the fan into CPU_FAN. Fan arrow should point toward the back of the case.', why: 'Air goes front to back. The arrow on the fan frame shows the airflow.', focus: 'cpuFan', zoom: 18, marks: [{ at: 'cpuFan', text: 'CPU_FAN' }], sounds: [[0, 'plug']] },
  ];
  steps.push({
    id: 'cooler', title: cooler?.kind === 'aio' ? 'Prepare the liquid cooler mount' : 'Install the CPU cooler', minutes: cooler?.kind === 'stock' ? 5 : 15, hideCase: true,
    actions: coolerActions,
    check: cooler?.kind === 'aio' ? ['Bracket fitted for your socket'] : ['Film removed from cooler base', 'Cooler does not wiggle', 'Fan on CPU_FAN'],
  });

  steps.push({
    id: 'psu', title: 'Prepare the case and install the PSU', minutes: 10,
    actions: [
      { t: 'Remove the glass side panel and put it somewhere soft, flat and out of the way.', why: 'Tempered glass is tough on its face but can shatter if an edge is knocked.', rig: { glass: 0 }, focus: 'case', zoom: 95, marks: [{ at: 'glass', arrow: [1, 0, 0] }], sounds: [[0, 'whoosh']] },
      { t: `${r.psu?.id === 'a650bn' ? 'This PSU has fixed cables, so they are already attached.' : 'Plug the 24-pin, CPU 8-pin and GPU cables into the PSU first.'}`, why: 'Much easier now than when it is inside the case.', rig: { psu: 0 }, focus: 'psuSockets', zoom: 36, marks: r.psu?.id === 'a650bn' ? [] : [{ at: 'psuSockets', text: 'Modular sockets' }], sounds: [[0, 'whoosh']] },
      { t: 'Slide it into the bottom bay with the fan facing down.', why: 'The case has a dust-filtered vent underneath so the PSU breathes its own cool air.', rig: { psu: 1 }, focus: 'psuBay', zoom: 45, marks: [{ at: 'psuBay', arrow: [-1, 0, 0] }], sounds: [[0.5, 'thunk']] },
      { t: 'Fix it from the back with the four PSU screws.', focus: 'psuSwitch', zoom: 40, from: [-0.5, 0.25, -1], sounds: [[0, 'screw'], [0.5, 'screw'], [1, 'screw'], [1.5, 'screw']], hold: 3 },
      { t: 'Set the switch on the back to O (off).', rig: { psuSwitch: 0 }, focus: 'psuSwitch', zoom: 30, from: [-0.5, 0.25, -1], marks: [{ at: 'psuSwitch', text: 'O = off' }], sounds: [[0.2, 'rocker']] },
    ],
    check: ['Fan faces down', 'Four screws in', 'Switch on O'],
  });

  steps.push({
    id: 'board', title: 'Mount the motherboard', minutes: 15,
    actions: [
      { t: 'Check the brass standoffs in the case line up with every hole in your board.', why: 'A standoff with no hole above it can short the back of the board. Remove any extras.', focus: 'standoffs', zoom: 60, marks: [{ at: 'standoffs', text: 'Standoffs' }] },
      { t: 'If your board came with a separate I/O shield, snap it into the rear cut-out from inside the case.', why: 'Do it now: forgetting it means taking the whole board back out.', rig: { ioShield: 0 }, focus: 'ioShield', zoom: 36, marks: [{ at: 'ioShield', arrow: [0, 0, -1] }], sounds: [[0, 'whoosh']] },
      { t: 'Press around its edges until every side clicks in.', rig: { ioShield: 1 }, focus: 'ioShield', zoom: 36, sounds: [[0.4, 'snap'], [0.6, 'snap']] },
      { t: 'Hold the board by the CPU cooler and the edges, tilt it ports-first and lower it into the case.', rig: { board: 1 }, focus: 'tray', zoom: 75, sounds: [[0, 'whoosh'], [1.2, 'thunk']], hold: 3 },
      { t: 'Start every screw loosely first, then tighten them all snug. Not hard.', why: 'Loose first lets you nudge the board until the rear ports line up.', rig: { boardScrews: 1 }, focus: 'boardCenter', zoom: 60, marks: [{ at: 'h1', n: 1 }, { at: 'h2', n: 2 }, { at: 'h3', n: 3 }, { at: 'h4', n: 4 }, { at: 'h5', n: 5 }, { at: 'h6', n: 6 }], sounds: [[0.1, 'screw'], [0.5, 'screw'], [0.9, 'screw'], [1.3, 'screw'], [1.7, 'screw'], [2.1, 'screw']], hold: 4 },
    ],
    check: ['Rear ports line up with the shield', 'Every hole has a screw'],
    watchOut: 'If the rear ports do not line up, loosen all screws and nudge the board toward the back.',
  });

  if (cooler?.kind === 'aio') steps.push({
    id: 'aio', title: 'Mount the liquid cooler', minutes: 15,
    actions: [
      { t: 'Screw the radiator under the top panel with the tubes toward the front.', why: 'Top mount keeps the pump below the radiator top, so air bubbles collect in the radiator, not the pump.', rig: { cooler: 0 }, focus: 'radiator', zoom: 55, sounds: [[0, 'whoosh']] },
      { t: 'Lower the pump onto the CPU and tighten its screws in an X pattern.', rig: { cooler: 1, coolerScrew: 1, coolerFilm: 0 }, focus: 'socket', zoom: 34, marks: [{ at: 'cs1', n: 1 }, { at: 'cs2', n: 2 }, { at: 'cs3', n: 3 }, { at: 'cs4', n: 4 }], sounds: [[0.6, 'thunk'], [1.0, 'screw'], [1.5, 'screw'], [2, 'screw'], [2.5, 'screw']], hold: 4 },
      { t: 'Plug the pump into AIO_PUMP (or CPU_FAN) and the radiator fans into CPU_FAN.', focus: 'cpuFan', zoom: 18, marks: [{ at: 'cpuFan', text: 'CPU_FAN / PUMP' }], sounds: [[0, 'plug']] },
    ],
    check: ['Radiator secured', 'Pump powered from a fan header'],
  });

  steps.push({
    id: 'power', title: 'Connect motherboard power', minutes: 10,
    actions: [
      { t: 'Take the CPU 8-pin cable behind the tray and up through the top-left cut-out.', why: 'Do this one first. Once the cooler and top fans are in, there is very little room up there.', rig: { eps8: 0.8 }, active: ['eps8'], focus: 'eps', zoom: 40, marks: [{ at: 'topCutout', text: 'Top cut-out' }] },
      { t: 'Plug it into CPU_PWR1 until the clip clicks.', why: 'Use the cable marked CPU. A PCIe (GPU) cable has the same shape but different wiring.', rig: { eps8: 1 }, active: ['eps8'], focus: 'eps', zoom: 22, marks: [{ at: 'eps', text: 'CPU_PWR1', arrow: [-1, 0, 0] }], sounds: [[0.8, 'plug']] },
      { t: 'Route the wide 24-pin cable through the grommet beside the board.', rig: { atx24: 0.85 }, active: ['atx24'], focus: 'atx', zoom: 40, marks: [{ at: 'grommet', text: 'Grommet' }] },
      { t: 'Push it in firmly until the side latch clicks over the tab.', why: 'It needs more force than you expect. Support the board from behind with your other hand.', rig: { atx24: 1 }, active: ['atx24'], focus: 'atx', zoom: 24, marks: [{ at: 'atx', text: '24-pin', arrow: [-1, 0, 0] }], sounds: [[0.8, 'plug']] },
    ],
    check: ['CPU 8-pin clicked in', '24-pin latch clicked'],
  });

  if (gpu) {
    const twelve = gpu.power.includes('12V');
    const slots = gpu.lengthMm >= 300 ? 3 : 2;
    steps.push({
      id: 'gpu', title: 'Install the graphics card', minutes: 10,
      actions: [
        { t: `Unscrew and remove the ${slots} slot covers level with the top long PCIe slot.`, why: `This card is ${slots === 3 ? 'triple' : 'dual'}-slot, so it needs ${slots} openings.`, rig: { slotCovers: 1 }, focus: 'slotCovers', zoom: 40, from: [-0.5, 0.2, -1], marks: [{ at: 'slotCovers', text: `${slots} covers`, arrow: [0, 0, -1] }], sounds: [[0, 'screw'], [0.6, 'screw']] },
        { t: 'Push the small latch at the end of the top PCIe x16 slot to open it.', rig: { pcieLatch: 1 }, focus: 'pcieLatch', zoom: 18, marks: [{ at: 'pcieLatch', text: 'Slot latch' }], sounds: [[0.1, 'click']] },
        { t: 'Hold the card level with its gold edge over the slot and its bracket toward the back.', rig: { gpu: 0.5 }, focus: 'pcieSlot', zoom: 50, marks: [{ at: 'pcieSlot', arrow: [-1, 0, 0] }], sounds: [[0, 'whoosh']] },
        { t: 'Press straight down until the latch clicks closed.', rig: { gpu: 1, pcieLatch: 0 }, focus: 'pcieSlot', zoom: 45, marks: [{ at: 'pcieLatch', text: 'Click!', tone: 'ok' }], sounds: [[0.5, 'snap']] },
        { t: 'Screw the card bracket to the case.', rig: { gpuScrew: 1 }, focus: 'gpuBracket', zoom: 30, from: [0.6, 0.3, -1], sounds: [[0.1, 'screw'], [0.6, 'screw']] },
        { t: `Plug in the power: ${gpu.power}.`, why: twelve ? 'The 12V-2x6 plug must go fully in. Look from the side: there should be no gap at all. A half-inserted plug can overheat.' : 'Use separate PCIe cables from the PSU where possible rather than one daisy-chained cable.', rig: { pcie: 1 }, active: ['pcie'], focus: 'gpuPower', zoom: 26, marks: [{ at: 'gpuPower', text: twelve ? 'Fully seated: no gap' : 'PCIe power', tone: twelve ? 'warn' : 'info', arrow: [-1, 0, 0] }], sounds: [[0.9, 'plug']], hold: 3 },
      ],
      check: ['Slot latch closed', 'Bracket screwed in', 'Power plug fully seated'],
    });
  }

  steps.push({
    id: 'front', title: 'Front panel, USB and fans', minutes: 15,
    actions: [
      { t: `Find the front-panel header (${fpBoard}) at the bottom-right corner of the board.`, focus: 'fpanel', zoom: 16, marks: [{ at: 'fpanel', text: fpBoard }] },
      { t: 'Plug the power-switch wires onto the two PWR pins.', why: 'Switches have no polarity: either way round works. This is the one that matters.', rig: { front: 0.6 }, active: ['front'], focus: 'fpanel', zoom: 12, marks: [{ at: 'fpPwr', text: 'PWR SW' }] },
      { t: 'Add reset, power LED and HDD LED wires. LEDs care about + and -.', why: 'The coloured wire is usually +. If an LED does not light, flip it round.', rig: { front: 1 }, active: ['front'], focus: 'fpanel', zoom: 12, marks: [{ at: 'fpRst', text: 'RESET' }, { at: 'fpPled', text: 'PLED +/-' }, { at: 'fpHdd', text: 'HDD LED +/-' }], sounds: [[0.8, 'plug']] },
      { t: 'Plug the chunky blue USB 3 cable and the HD Audio cable into their headers along the bottom edge.', why: 'The USB 3 plug has a key on one side. Line it up; it should not need force.', focus: 'usb3', zoom: 20, marks: [{ at: 'usb3', text: 'USB 3' }, { at: 'audio', text: 'HD Audio' }], sounds: [[0.3, 'plug'], [0.8, 'plug']] },
      { t: 'Connect the case fans to SYS_FAN headers.', rig: { fans: 1 }, active: ['fans'], focus: 'sysFan', zoom: 40, marks: [{ at: 'sysFan', text: 'SYS_FAN' }, { at: 'frontFans', text: 'Intake', arrow: [0, 0, -1] }], sounds: [[0.9, 'plug']] },
    ],
    check: ['Power switch on PWR pins', 'USB 3 and audio connected', 'Fans plugged in'],
  });

  steps.push({
    id: 'boot', title: 'First power on', minutes: 10,
    actions: [
      { t: gpu ? 'Plug your monitor into the graphics card, not the motherboard.' : 'Plug your monitor into the motherboard video port (you are using built-in graphics).', why: gpu ? 'The ports on the board only work without a graphics card. This trips up a lot of first-timers.' : undefined, focus: 'gpuPorts', zoom: 40, from: [-0.5, 0.25, -1], marks: [{ at: 'gpuPorts', text: gpu ? 'Monitor goes here' : 'Board video out' }] },
      { t: 'Flip the PSU switch to I.', rig: { psuSwitch: 1 }, focus: 'psuSwitch', zoom: 30, from: [-0.5, 0.25, -1], sounds: [[0.1, 'rocker']] },
      { t: 'Press the case power button. The first boot can show a black screen for 1-3 minutes.', why: ddr5 ? 'DDR5 systems train their memory on first boot. Do not panic and do not power off.' : 'Fans should spin straight away.', rig: { power: 1 }, focus: 'case', zoom: 95, sounds: [[2.6, 'post']], hold: 5 },
      { t: 'In the BIOS, check the CPU, the full amount of RAM, and your SSD are listed.', bios: true, focus: 'case', zoom: 95, hold: 5 },
      { t: `Turn on ${ddr5 ? 'EXPO (or XMP)' : 'XMP / DOCP'} so the RAM runs at its rated speed, then save and exit.`, why: `Without it the RAM runs at a slow default (${ddr5 ? 'DDR5-4800' : 'DDR4-2133'}).`, bios: true, focus: 'case', zoom: 95, hold: 5 },
      { t: 'Put the glass panel back on.', rig: { glass: 1 }, focus: 'case', zoom: 95, sounds: [[0, 'whoosh'], [0.8, 'thunk']] },
    ],
    check: ['Fans spin', 'BIOS shows CPU, RAM and SSD', `${ddr5 ? 'EXPO' : 'XMP'} enabled`],
    watchOut: 'No picture after 3 minutes? Open the troubleshooter.',
  });

  steps.push({
    id: 'os', title: 'Install Windows and drivers', minutes: 40,
    actions: [
      { t: 'On another computer, make a Windows USB stick with Microsoft\'s Media Creation Tool (8GB+ stick).', focus: 'case', zoom: 95, rig: { power: 1 } },
      { t: 'Boot from the stick and install Windows onto the NVMe SSD.', focus: 'case', zoom: 95 },
      ...(r.board?.wifi ? [] : [{ t: 'Your board has no Wi-Fi: connect an Ethernet cable before installing so Windows can update.', focus: 'case' as Anchor, zoom: 95 }]),
      { t: gpu ? `Install the latest ${gpu.name.includes('GeForce') ? 'NVIDIA' : gpu.name.includes('Radeon') ? 'AMD' : 'Intel'} graphics driver from the official site.` : 'Install the chipset and graphics drivers from the motherboard support page.', focus: 'case', zoom: 95 },
      { t: 'Run Windows Update until nothing is left. You built a PC.', focus: 'case', zoom: 95, sounds: [[0, 'success']] },
    ],
    check: ['Windows desktop loads', 'Graphics driver installed'],
  });

  return steps;
}

/** Rig targets at (step, action): RIG_START with every earlier action applied in order. */
export function rigAt(steps: Step[], s: number, a: number): RigState {
  const out = { ...RIG_START };
  for (let i = 0; i <= s; i++) {
    const acts = steps[i].actions;
    const last = i < s ? acts.length - 1 : a;
    for (let j = 0; j <= last; j++) Object.assign(out, acts[j].rig);
  }
  return out;
}
