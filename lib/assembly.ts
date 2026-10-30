import { Resolved } from './catalog';

export type SceneKey = 'case' | 'board' | 'cpu' | 'ram' | 'storage' | 'cooler' | 'gpu' | 'psu';
export type CableKey = 'atx24' | 'eps8' | 'pcie' | 'front' | 'fans';

export type Step = {
  id: string;
  title: string;
  minutes: number;
  show: SceneKey[]; // already installed
  active?: SceneKey; // animates into place this step
  cables?: CableKey[];
  activeCables?: CableKey[];
  hideCase?: boolean;
  doThis: string[];
  check: string[];
  watchOut?: string;
};

// Steps tailored to the chosen parts. Order follows the common "build the board outside the case" flow.
export function assemblySteps(r: Resolved): Step[] {
  const cpu = r.cpu;
  const cooler = r.cooler;
  const gpu = r.gpu;
  const pinsOnCpu = cpu?.socket === 'AM4';
  const lga = cpu?.socket === 'LGA1700';
  const onBoard: SceneKey[] = ['board'];
  const steps: Step[] = [];

  steps.push({
    id: 'prep', title: 'Set up your workspace', minutes: 10, show: [], hideCase: true,
    doThis: [
      'Clear a large table. Work on a hard surface, not carpet.',
      'Touch something metal (like the unpainted case frame) now and then to discharge static.',
      'Unbox the motherboard and lay it flat on top of its own box. That box is your workbench.',
      'Keep a Phillips #2 screwdriver and the small bag of screws from each box nearby.',
    ],
    check: ['All parts are here and undamaged', 'Motherboard manual is open to the "Installation" page'],
  });

  steps.push({
    id: 'cpu', title: 'Install the CPU', minutes: 5, show: onBoard, active: 'cpu', hideCase: true,
    doThis: lga ? [
      'Press the socket lever down and out, then lift it and the metal frame.',
      'Find the notches on the CPU edges and line them up with the bumps in the socket.',
      'Lower the CPU straight down. Do not slide it.',
      'Close the frame and press the lever back under its hook. The plastic cover pops off; keep it.',
    ] : [
      'Lift the socket lever all the way up.',
      'Find the small gold triangle on one corner of the CPU and the matching triangle on the socket.',
      'Lower the CPU straight down. It should drop in with zero force.',
      'Lower the lever back down until it clicks under its hook.',
    ],
    check: ['Triangle / notches line up', 'CPU sits flat with no gap', 'Lever is latched'],
    watchOut: pinsOnCpu
      ? 'On AM4 the pins are on the bottom of the CPU. Hold it by the edges and never set it pin-side down.'
      : 'The pins are inside the socket. One bent pin can kill the board, so never touch the socket and do not drop anything in.',
  });

  steps.push({
    id: 'm2', title: 'Install the NVMe SSD', minutes: 5, show: [...onBoard, 'cpu'], active: 'storage', hideCase: true,
    doThis: [
      'Find the M.2 slot closest to the CPU (often under a metal heatsink). Unscrew the heatsink if there is one.',
      'Peel the plastic film off the heatsink thermal pad.',
      'Slide the SSD into the slot at about a 30 degree angle, then press it flat.',
      'Secure it with the small screw or tool-free latch, then replace the heatsink.',
    ],
    check: ['Drive is fully seated in the slot (gold contacts barely visible)', 'Film removed from thermal pad'],
  });

  steps.push({
    id: 'ram', title: 'Install the RAM', minutes: 5, show: [...onBoard, 'cpu', 'storage'], active: 'ram', hideCase: true,
    doThis: [
      'With 2 sticks, use slots A2 and B2: usually the 2nd and 4th slots counting from the CPU. Your manual confirms this.',
      'Open the clips at the ends of those slots.',
      'Line up the notch on the stick with the bump in the slot. It only goes in one way.',
      'Press firmly on both ends until the clips snap closed. It takes more force than you expect.',
    ],
    check: ['Both clips closed on each stick', 'Sticks sit at the same height'],
    watchOut: 'Half-seated RAM is the #1 cause of a first build that will not show a picture.',
  });

  steps.push({
    id: 'cooler', title: cooler?.kind === 'aio' ? 'Mount the liquid cooler bracket' : 'Install the CPU cooler', minutes: cooler?.kind === 'stock' ? 5 : 15,
    show: [...onBoard, 'cpu', 'storage', 'ram'], active: 'cooler', hideCase: cooler?.kind !== 'aio',
    doThis: cooler?.kind === 'stock' ? [
      'The stock cooler already has thermal paste on its base. Do not touch it or wipe it off.',
      'Line it up over the CPU, then tighten the screws in an X pattern, a few turns each.',
    ] : cooler?.kind === 'aio' ? [
      'Attach the mounting bracket to the board as the cooler manual shows (AMD and Intel use different brackets).',
      'The radiator goes in the case later; for now just prep the bracket and pump block.',
      'Check whether the pump block has paste pre-applied. If not, add a pea-sized dot in the middle of the CPU.',
    ] : [
      'Install the mounting bracket for your socket (the manual has an AMD and an Intel section).',
      'Put a pea-sized dot of thermal paste in the middle of the CPU, unless the cooler has it pre-applied.',
      'Peel the plastic film off the bottom of the cooler!',
      'Set the cooler on the CPU and tighten the screws in an X pattern, a few turns each.',
      'Clip the fan on with its airflow arrow pointing toward the back of the case.',
    ],
    check: ['Protective film removed from cooler base', 'Cooler does not wiggle', 'Fan cable can reach the CPU_FAN header'],
  });

  steps.push({
    id: 'psu', title: 'Install the power supply', minutes: 10, show: [...onBoard, 'cpu', 'storage', 'ram', 'cooler', 'case'], active: 'psu',
    doThis: [
      'Remove both side panels from the case and set the glass panel somewhere safe.',
      'Slide the PSU into the bottom-rear bay with its fan facing down toward the dust filter.',
      'Screw it in from the back with the 4 PSU screws.',
      'If it is modular, plug in the 24-pin, CPU 8-pin and GPU power cables now. It is much harder later.',
      'Make sure the switch on the back is set to off (O).',
    ],
    check: ['Fan faces down (case has a vent there)', 'Power switch off'],
  });

  steps.push({
    id: 'board', title: 'Mount the motherboard in the case', minutes: 15, show: ['case', 'psu', 'cpu', 'storage', 'ram', 'cooler'], active: 'board',
    doThis: [
      'Check that the brass standoffs in the case match the holes in your board. Remove any extras; a stray standoff can short the board.',
      'If your board has a separate I/O shield, snap it into the back of the case first, from the inside.',
      'Tilt the board in, ports first, and line them up with the rear cut-out.',
      'Start all screws loosely, then tighten them snugly. Do not over-tighten.',
    ],
    check: ['Rear ports line up with the cut-out', 'Every hole has a screw, no standoff without a hole'],
    watchOut: 'Forgetting the I/O shield is the classic first-build mistake. If you do, you have to take the board back out.',
  });

  steps.push({
    id: 'power', title: 'Connect motherboard power', minutes: 10, show: ['case', 'psu', 'board', 'cpu', 'storage', 'ram', 'cooler'],
    cables: [], activeCables: ['atx24', 'eps8'],
    doThis: [
      'Route the CPU 8-pin (EPS) cable behind the motherboard tray and up through the top-left opening first. It is the hardest one to reach.',
      'Plug it into the 8-pin socket at the top-left of the board, labeled CPU or ATX12V.',
      'Route the wide 24-pin cable through the right-side grommet and plug it into the right edge of the board.',
      'Squeeze each plug in until its clip clicks.',
    ],
    check: ['24-pin clip clicked', 'CPU 8-pin clicked (do not use a PCIe GPU cable here; they look similar but are wired differently)'],
  });

  if (gpu) steps.push({
    id: 'gpu', title: 'Install the graphics card', minutes: 10,
    show: ['case', 'psu', 'board', 'cpu', 'storage', 'ram', 'cooler'], active: 'gpu', cables: ['atx24', 'eps8'], activeCables: ['pcie'],
    doThis: [
      'Remove the 2-3 metal slot covers on the back of the case next to the top long PCIe slot.',
      'Open the clip at the end of the top PCIe x16 slot.',
      'Line the card up and press straight down until the clip clicks.',
      'Screw the card bracket to the case.',
      `Plug in the power: ${gpu.power}.`,
    ],
    check: ['Slot clip closed', 'Bracket screwed in', 'Power plug pushed fully in with no gap'],
    watchOut: gpu.power.includes('12V-2x6')
      ? 'The 12V-2x6 plug must go all the way in. A partly inserted plug can overheat. Look from the side: no visible gap.'
      : undefined,
  });

  const base: SceneKey[] = ['case', 'psu', 'board', 'cpu', 'storage', 'ram', 'cooler', ...(gpu ? (['gpu'] as SceneKey[]) : [])];
  const baseCables: CableKey[] = ['atx24', 'eps8', ...(gpu ? (['pcie'] as CableKey[]) : [])];

  steps.push({
    id: 'front', title: 'Connect front panel, USB and fans', minutes: 15, show: base, cables: baseCables, activeCables: ['front', 'fans'],
    doThis: [
      'Find the front panel header at the bottom-right of the board (often labeled JFP1 or F_PANEL).',
      'Plug in the tiny power switch, reset switch and LED wires using the diagram in your manual. Power switch is the important one.',
      'Plug the front USB 3 cable (the chunky blue one) and the HD Audio cable into their headers along the bottom edge.',
      'Plug the case fans into SYS_FAN headers and the CPU cooler fan into CPU_FAN.',
      ...(r.cooler?.kind === 'aio' ? ['Mount the radiator in the top or front of the case and plug the pump into the AIO_PUMP or CPU_FAN header.'] : []),
    ],
    check: ['Power switch wires on the right pins', 'CPU fan on CPU_FAN (the PC may refuse to boot otherwise)'],
    watchOut: 'Front panel pins are tiny. Use a phone flashlight and the manual diagram; plus (+) and minus (-) only matter for LEDs.',
  });

  steps.push({
    id: 'boot', title: 'First power on', minutes: 10, show: base, cables: [...baseCables, 'front', 'fans'],
    doThis: [
      gpu ? 'Plug the monitor into the graphics card, not the motherboard. This trips up a lot of first-timers.' : 'Plug the monitor into the motherboard video port (you are using built-in graphics).',
      'Plug in keyboard, mouse and power cable, then flip the PSU switch to on (I).',
      'Press the case power button. The first boot can sit on a black screen for 1-3 minutes while memory trains. Be patient.',
      'When the BIOS appears, check that it shows your CPU, full RAM amount and SSD.',
      `Turn on ${r.board?.mem === 'DDR5' ? 'EXPO/XMP' : 'XMP/DOCP'} in the BIOS so your RAM runs at its rated speed.`,
    ],
    check: ['Fans spin', 'BIOS screen appears', 'All RAM detected', 'SSD listed'],
    watchOut: 'No picture after 3 minutes? Open the troubleshooter from the menu.',
  });

  steps.push({
    id: 'os', title: 'Install Windows and drivers', minutes: 40, show: base, cables: [...baseCables, 'front', 'fans'],
    doThis: [
      'On another computer, use Microsoft\'s Media Creation Tool to make a Windows USB stick (8GB+).',
      'Plug it into the new PC, boot, and follow the installer. Pick the NVMe SSD as the install location.',
      ...(r.board?.wifi ? [] : ['No Wi-Fi on this board: connect an Ethernet cable before installing so Windows can update.']),
      gpu ? `Install the latest ${gpu.name.includes('GeForce') ? 'NVIDIA' : gpu.name.includes('Radeon') ? 'AMD' : 'Intel'} graphics driver from the official site.` : 'Install the motherboard chipset and graphics driver from the board maker\'s support page.',
      'Run Windows Update until nothing is left.',
      'Put the side panels back on. You built a PC.',
    ],
    check: ['Windows desktop loads', 'Graphics driver installed', 'Side panels on'],
  });

  return steps;
}
