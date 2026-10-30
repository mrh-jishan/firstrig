import { Resolved } from './catalog';
import { CableKey, SceneKey } from './assembly';

export type Check = { text: string; focus?: SceneKey; cables?: CableKey[] };
export type Symptom = { id: string; label: string; checks: (r: Resolved) => Check[] };

export const SYMPTOMS: Symptom[] = [
  {
    id: 'dead', label: 'Nothing happens when I press power',
    checks: () => [
      { text: 'Is the switch on the back of the power supply set to I (on), and the wall outlet working?', focus: 'psu' },
      { text: 'Is the 24-pin cable clicked into the right edge of the motherboard, and into the PSU if it is modular?', cables: ['atx24'] },
      { text: 'Is the power switch wire on the correct two front-panel pins? Check the manual diagram.', cables: ['front'] },
      { text: 'Test: unplug the power switch wire and briefly touch the two PWR pins with a screwdriver tip. If it starts, the switch wire was on the wrong pins.', cables: ['front'] },
    ],
  },
  {
    id: 'nopic', label: 'Fans spin but there is no picture',
    checks: (r) => [
      { text: 'Wait a full 3 minutes. New DDR5 systems train memory on first boot and show nothing meanwhile.', focus: 'ram' },
      ...(r.gpu ? [{ text: 'Is the monitor cable plugged into the graphics card, not the motherboard?', focus: 'gpu' as SceneKey }] : []),
      { text: 'Look for small debug LEDs near the RAM slots (CPU / DRAM / VGA / BOOT). The one that stays lit names the problem.', focus: 'board' },
      { text: 'Reseat the RAM: open the clips, pull the sticks out and press them back in until both clips snap.', focus: 'ram' },
      { text: 'Is the CPU 8-pin power cable plugged in at the top-left of the board?', cables: ['eps8'] },
      ...(r.gpu ? [{ text: 'Is the graphics card power cable fully inserted and the card clicked into its slot?', focus: 'gpu' as SceneKey, cables: ['pcie'] as CableKey[] }] : []),
      { text: 'Try one RAM stick in slot A2 only. If it boots, test the other stick the same way.', focus: 'ram' },
    ],
  },
  {
    id: 'restart', label: 'It turns on, then off again (boot loop)',
    checks: () => [
      { text: 'Give it a few minutes; several restarts are normal during first-boot memory training.', focus: 'ram' },
      { text: 'Is the CPU fan plugged into CPU_FAN? Many boards shut down without a fan signal there.', focus: 'cooler', cables: ['fans'] },
      { text: 'Is the cooler tight on the CPU, with the plastic film removed?', focus: 'cooler' },
      { text: 'Clear CMOS: with power off, use the board\'s CLR_CMOS button or jumper (see manual) to reset BIOS settings.', focus: 'board' },
    ],
  },
  {
    id: 'nodrive', label: 'Windows installer cannot see my SSD',
    checks: () => [
      { text: 'Check the BIOS storage page. If the drive is missing there, reseat it and its screw.', focus: 'storage' },
      { text: 'Some M.2 slots share lanes with SATA ports. Use the slot nearest the CPU.', focus: 'storage' },
    ],
  },
  {
    id: 'hot', label: 'It is loud or getting hot',
    checks: (r) => [
      { text: 'Did you peel the plastic film off the cooler base? It is easy to miss and causes very high temperatures.', focus: 'cooler' },
      { text: 'Are front fans pulling air in and rear/top fans pushing it out? The arrows on the fan frame show direction.', cables: ['fans'] },
      { text: 'Set a fan curve in the BIOS ("Smart Fan" or "Q-Fan") so fans stay slow at idle.', focus: 'board' },
      ...(r.cooler?.kind === 'stock' ? [{ text: 'Stock coolers are loud by design. A $20 tower cooler is the easiest fix.', focus: 'cooler' as SceneKey }] : []),
    ],
  },
  {
    id: 'slowram', label: 'RAM shows less memory or a slower speed',
    checks: (r) => [
      { text: `Turn on ${r.board?.mem === 'DDR5' ? 'EXPO/XMP' : 'XMP/DOCP'} in the BIOS. Without it, RAM runs at a slow default speed.`, focus: 'board' },
      { text: 'If total memory is half of what you bought, one stick is not fully seated.', focus: 'ram' },
    ],
  },
];
