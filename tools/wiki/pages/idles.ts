import { behaviourOf, MIGRATED } from '../../../src/animals/catalogue.ts';
import { statesOf } from '../../../src/animals/types.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, SERIES, table } from '../page.ts';
import { lineChart, samples } from '../svg.ts';

const channel = (key: string, state: string, seconds: number, at: 0 | 1 | 2 | 3) => (since: number): number => {
  const pose = behaviourOf(key)!.hooks.pose!({ state, phase: 0, going: false, since, left: seconds - since, pitch: 0 });
  return pose[at];
};

const sitChart = (): string =>
  lineChart({
    width: 560,
    height: 300,
    x: { label: 'seconds into the idle', domain: [0, 12], ticks: [0, 2, 4, 6, 8, 10, 12] },
    y: { label: 'pose channel', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] },
    series: [
      { name: 'hind legs fold (channel 1)', colour: SERIES.blue, points: samples(0, 12, 240, channel('panda', 'sit', 12, 1)) },
      { name: 'body upright (channel 2)', colour: SERIES.gold, points: samples(0, 12, 240, channel('panda', 'sit', 12, 2)) },
    ],
    legend: true,
    label: 'The panda sitting down, sitting, and getting up',
  });

const grazeChart = (): string =>
  lineChart({
    width: 560,
    height: 300,
    x: { label: 'seconds into the idle', domain: [0, 14], ticks: [0, 2, 4, 6, 8, 10, 12, 14] },
    y: { label: 'pose channel', domain: [-1, 0.5], ticks: [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5] },
    series: [
      { name: 'graze, head pitch (channel 2)', colour: SERIES.green, points: samples(0, 14, 280, channel('reddeer', 'graze', 14, 2)) },
      { name: 'sniff, head pitch (channel 2)', colour: SERIES.violet, points: samples(0, 14, 280, channel('reddeer', 'sniff', 14, 2)) },
      { name: 'sniff, head turn (channel 3)', colour: SERIES.red, points: samples(0, 14, 280, channel('reddeer', 'sniff', 14, 3)) },
    ],
    legend: true,
    label: 'A red deer grazing and sniffing',
  });

const idleRows = (): string[][] =>
  [...MIGRATED]
    .sort()
    .flatMap((key) => (behaviourOf(key)?.idle ?? []).map((habit) => [key, habit.state, habit.needs ?? '-', `${habit.seconds[0]} to ${habit.seconds[1]} s`, String(habit.weight)]));

export const LINK: PageLink = {
  slug: 'idles',
  title: 'Idles',
  summary: 'What a standing animal does when nothing is asking it to move: stand up, graze, sniff, sit, dig, scratch. How an idle is chosen and how its pose is scripted.',
};

export function build(): Page {
  const states = [...MIGRATED].filter((key) => (behaviourOf(key)?.idle ?? []).length > 0).map((key) => `${key}: ${statesOf(behaviourOf(key)!).slice(2).join(', ')}`);
  return {
    ...LINK,
    lede: 'An idle is a short thing an animal does while it stands still: a brown bear rising on its hind legs, a deer lowering its head to graze, a panda sitting down, an aardvark digging, a moose rubbing its antlers on a tree. It is data in the animal\'s behaviour file, chosen by the sim, and posed by a function of time.',
    code: ['src/animals/archetypes/behaviours.ts', 'src/sim/animals/animals.ts', 'src/animals/archetypes/deer.ts', 'tools/animalSheet.ts'],
    sections: [
      {
        id: 'model',
        title: 'How an idle works',
        html: `${flow([
          { title: 'List', text: 'The behaviour file names its idles: <code>idler([{ state, weight, seconds, needs }])</code>. The state is one of the animal\'s own states.' },
          { title: 'Choice', text: 'When a standing, awake animal\'s own timer runs out it draws one by weight, among those whose need is met, and holds it for a random time within its seconds.' },
          { title: 'Time', text: 'The store carries the state, the seconds since it started and the seconds left.' },
          { title: 'Pose', text: 'A script per idle turns those two numbers into the four pose channels. The model decides which parts follow which channel.' },
        ])}
<p><b>Needs.</b> <code>grass</code> means the tile under the animal has a herb layer, <code>tree</code> means a tree stands within 12 tiles. For a tree the animal walks to a spot 1.3 m from the trunk at 0.7 of its pace, turns to face it, and then starts the idle; only the leader of a group does this.</p>
${callout('<p><b>Not saved, not shown yet in the 3D panel.</b> The idle is picked again from the sim\'s random stream after a load, and the zoo\'s 3D panel does not play idles. <code>npm run animal -- &lt;key&gt; --state &lt;idle&gt; --seconds 8 --gif f.gif</code> plays one at its real speed.</p>')}`,
      },
      {
        id: 'channels',
        title: 'Pose channels',
        html: `<p>A pose is four numbers. A model part says what each does with a <code>tilt</code> (rotate about a pivot by the channel times a maximum angle, <code>axis: 'yaw'</code> to turn about the vertical) or a point's <code>flex</code>. Channel 3 above 0.6 fades the animal out as a burrow sink, so a yaw keeps below that. Four more pieces of machinery came with the idles:</p>
<ul>
<li><b>Several tilts on one part</b> (a list, applied in order): the deer's head nods against its neck, and the whole front drops by a second tilt about the hind feet, so the shoulders go down with the neck.</li>
<li><b>Parts that belong to some states</b> (<code>only</code>) and <b>parts that hold still in some states</b> (<code>still</code>, so the aardvark's hind legs stay put while its front legs dig).</li>
<li><b>A driven leg cycle</b> (<code>driven</code>): in a state, one channel is the phase of the walking cycle and another how much of it, so a time script can make the legs scoop without the animal travelling.</li>
<li><b>A drop</b> (<code>drop</code>): a channel lowers the whole animal, so a sitting panda is on the ground and not hovering at hip height.</li>
</ul>`,
      },
      {
        id: 'scripts',
        title: 'Scripts for the first idles',
        html: `${figure(sitChart(), '<b>The panda sitting.</b> The hind legs fold first and the rump lowers (accelerating, like weight dropping), then the body comes upright and settles. Getting up is the reverse with effort: it leans forward over its paws, pushes the rump up slowly, and the body comes up last.', true)}
${figure(grazeChart(), '<b>A red deer.</b> Grazing lowers the head to the ground (negative pitch) and lifts it every seven seconds to look about; sniffing lifts the head a little and turns it slowly from side to side. The neck pitches steeply, the head is turned back up against it so the muzzle is flat to the ground, and the shoulders and front legs drop with it.', true)}`,
      },
      {
        id: 'table',
        title: 'Every idle so far',
        html: `${table(['Animal', 'Idle', 'Needs', 'Lasts', 'Weight'], idleRows())}
<p>The brown bear <b>stands</b> on its hind legs, arms hanging and head looking forward. All deer and the moose <b>graze</b> and <b>sniff</b>; the moose also <b>scratches</b> its antlers on a tree with its head lowered, sweeping to one side. The panda <b>sits</b> and breathes. The aardvark <b>digs</b>. The rabbit is next. States per animal: ${states.join('; ')}.</p>`,
      },
    ],
  };
}
