# The mind: discovery as a brain that grows

**Now: one idea in the middle.** The dark cells, their steps, the grown layout (`growth.ts`, removed) and dragging
fibres are replaced. One empty idea beats in the middle of the mind and the known neurons orbit it. A click picks a
neuron: if it and what is already in the idea still belong to some recipe whose parents are all known and whose result
is not, it floats in and connects; otherwise it withers, is crossed off for this idea and costs curiosity. When the idea
holds exactly one such recipe's parents it becomes work for the group and a fresh idea takes its place. A click on the
idea lets go of it. A formed idea is at once a `?` bubble in a closer orbit until someone has carried it out, and the `review` button shows everything worked out as a layered graph of what made what. Where the text below talks about cells, sockets per cell and attaching to a focused cell, read the
one idea; the rest (neurons earned by living, withering and weariness, the people carrying a whole idea out, recipes as
orders) stands.

Built (`sim/mind/`, `ui/MindPanel.tsx`, wiki page `mind`): neurons earned by living, one brain for the group, the grown
layout (`growth.ts`), dark cells with their three steps and sockets, focusing a cell, attaching parents one fibre at a time,
withering and the curiosity it costs, recipes of any number of parents, joins and hover focus, "a new idea is forming" on
the brain button, the most curious person carrying a whole cell out, recipes as orders, and `/research` as a growth
preview. Replaced: the pair guess, the `?` between two neurons, rings, sectors, the hand layout and the lesser results.

## Why

The discovery should be the player's: deciding that two flints, kindling and a branch might make fire is the fun. What
is not fun is the logistics in front of it, `pick up flint`, `bring flint here`, one item at a time, and `drop item here`
meaning nothing in particular once there are two people. **The player makes the guess; the people do the fetching.**

The first version let the player link any two neurons. The tree filled with lines crossing each other, a guess was a
shot into empty space, and the hand-placed rings and sectors fought every recipe that crossed from one field into
another. The redesign keeps the neurons and changes what a guess is: **the player can see that something is there to
find, and works out how to reach it**, the way the map in Potion Craft shows a target in the fog and leaves the route to
you.

## Neurons are earned by living

**A neuron is something a person has met.** Picking up a flint lights `flint` in that person. A tree burning after a
lightning strike lights `flame` in everyone who saw it. Nothing is in a mind that the world did not put there, so
exploring and watching are how the brain grows its roots.

There are two kinds: **things** (flint, branch, kindling, stone) and **happenings** (spark, ember, flame, sharp edge).
A discovery is a short chain, so fire is three small discoveries, each its own moment:

```
flint + flint     -> spark
spark + kindling  -> ember
ember + branch    -> flame
```

**A recipe has any number of parents**, not a pair: a list, in which the same parent may appear more than once
(`spark` is flint and flint). **Every recipe makes something that is used**: a result that leads nowhere and opens
nothing is noise, so the lesser results (`dull spark`, `smoke`) go.

## One brain, group knowledge

**Knowledge belongs to the group.** There is one flag per neuron: once anyone has met or worked something out, everyone
has it. The first person gets a `!` over their head and that is all the individual shows. Nobody has to be asked, walk
to someone or watch: tracking who knows what is bookkeeping the player would never act on, so it is not there. What stays
per person is curiosity, because it decides who takes a job. If bands ever have separate minds, the flag becomes one per
band.

## The brain grows

**A neuron has no place until it needs one, and then it keeps it.** There are no rings and no sectors. A root (a thing
met in the world) takes a place near the core when it is first met, in the widest free gap. Every other neuron takes its
place when it first becomes visible as a dormant cell (below): beside the parents that are known, pushed outward from the
core and away from its neighbours, with a little jitter from the seed. From then on it never moves, and it lights up in
that same place when it is discovered.

So **the brain is the history of how this group learned**. Two games on one seed grow different brains, because they met
things in a different order, and a field that draws on another (fire into food, flame and egg) grows a fibre across
between them, which is a thing to see rather than a crossing to hide. The places are part of the save.

The `/research` page stops being a layout editor: it grows a brain from a chosen order of discovery, to look at how a
set of recipes comes out. `layout.ts`, `angle` and `ring` on `NEURONS`, `RING_RADII` and `SECTORS` go.

## Dormant cells: hinting without telling

**What can be found next sits in the brain as a dormant cell**: a dark soma in the tissue round what is known, with no
icon, no name and no fibres. The player sees that something is there, never what it is and never what feeds it.

A dormant cell appears once someone knows **at least one** of its parents, so only the frontier shows and the fog moves
outward as the group learns. It has three steps:

1. **a glimmer**: one parent known; a faint shape in the dark.
2. **a shape**: more than one parent known, not all; the cell is clearer.
3. **a heartbeat**: every parent known by someone; the cell pulses slowly. The guess is now possible.

**A cell shows how many parents it needs**, as empty sockets round its body (dendrite ends with nothing attached), and
they fill one by one. It gives the count and nothing about which.

Where a dormant cell sits is a small hint of its own (a cell next to flint and kindling invites those two), and that is
meant: it is a deduction, not an answer.

When a cell reaches its heartbeat the HUD says **a new idea is forming**, and a click on it opens the brain focused on
that cell.

## Working on a cell

**A guess starts by focusing a cell.** A click on a dormant cell brings it into focus: the rest of the brain dims, and the
known neurons that could still feed it stay lit. Neurons that already withered on this cell are filtered out, so the
choice shrinks as the player learns.

**Fibres are attached one at a time, and each is judged at once.** The player drags from a known neuron to the focused
cell (the fibre grows while the button is held, as now). A real parent attaches: the fibre fills a socket and stays, and
the progress is saved. **Anything else withers on the spot**: a brown fibre that droops and falls away, and that neuron
is crossed off for that cell. Stone or kindling dragged to the cell that is spark withers at once. A parent that appears
twice is attached twice.

**A wrong fibre costs curiosity.** Each wither drains the group's curiosity a step, and it recovers over time while
people are fed, rested and warm. While nobody's curiosity is above `MIN_CURIOUS` no fibre can be drawn ("nobody has the
mind for it"), so guessing every neuron in turn is possible but slow, and a group in trouble cannot think at all, which
is already true of trying.

**When the last socket fills, the people carry it out.** The thinking is the player's and the doing is the group's: the
most curious person who holds every parent, or can reach the holders of the rest, takes it, fetches the leaves of the
chain, kneels and strikes as now, and the cell lights up when it succeeds. It cannot fail at this point; the guessing was
the attaching.

## Reading the brain

**A recipe is drawn as one join**: each parent sends a thin fibre to a synapse set back from the result toward its
parents, and one axon runs on from the synapse into the result and ends in a short fan. The fibres converge like
dendrites on a soma, any number of parents fit, and the brain carries one axon per recipe instead of a line per parent.

**Hovering a neuron focuses its lineage**: what it was made from, what it leads to and the partners each of those steps
needs stay lit, and everything else eases to a ghost. A dormant cell is never lit by it and its fibres never shown, so
hover focus can not give a recipe away.

## Who tries: the most curious

**Every person has a curiosity**: a trait rolled at birth, so some are tinkerers and some never bother, scaled by how
they are now. Fed, rested and warm raises it; cold, hunger and exhaustion take it close to zero, and a wither spends it.
A comfortable group researches and a group in trouble survives first.

Curiosity ranks after thirst, sleep and warmth, so nobody freezes over a flint. A tryer who becomes hungry or tired drops
the work and the next most curious picks it up later, the way a stalled plan is picked up again today. One tryer per
cell. The gathering is the builders' fetch the campfire plan already does (`PLAN_NEEDS`, `deficit`, `nextBuildStep` in
`sim/people/`): the leaves of the chain are its needs.

## After the discovery: recipes

**Only the first time is an experiment.** A proven cell with a goal (`flame`, `tool`) is a recipe: from then on it is an
order on the radial menu, carried out with the plan machinery as `Plan Campfire` is now, and the milestone is earned by
the first success. It has no fixed order and no costs beyond curiosity: what is found follows from what the world showed
the people, who is curious.

## The brain button

A small icon tile with a brain beside the day dial and the time controls, with a count of the cells being worked on,
which glows when a neuron is learned and carries **a new idea is forming** when a cell reaches its heartbeat. It opens
the brain, and above it a list of what is being worked on, one line a cell; a line moves the camera to its person. On
the map a person carrying the work has a small `?` over their head.

## The look and the sound

Everything is plotted a pixel at a time in the blue `MIND` palette: a neuron is a round cell body with a dithered halo, a
nucleus holding the item coin and branching dendrites; a dormant cell is the same body unlit, with empty sockets; a
fibre meanders and carries a pulse; a wither is brown, broken and drooping.

Maybe: each neuron has a note from the game's synth; a pulse down a chain plays it as an arpeggio, a heartbeat cell holds
an unresolved interval and resolves into a chord when it lights. `ui/music.ts` stays the only door.

## Decided while building

- **The curiosity cost is the group's.** A wither adds `WITHER_COST` 0.2 to one `weariness` for the group, every
  person's curiosity is multiplied by `1 - weariness`, and it falls at `WEARY_RECOVERY` 0.012 a second times the group's
  mean comfort, so about 17 s of game time a wither for a comfortable group and never for one in trouble. About five
  withers in a row stop a group of ordinary curiosity.
- **A dark cell's place** is the middle of its placed parents, `GROWTH_STEP` 52 further out, with seeded jitter. If that
  spot is crowded the search turns round the core in 12 pixel steps either way, then tries 16 pixels further out, and
  takes the roomiest spot if nothing has `SPACING` 44 free. Neighbours are never pushed. A root with no placed parent goes
  in the widest angular gap among everything placed.
- **Knowledge is one flag per neuron for the group**; there is no heard of, no talking and no sharing.
- **No cap on cells waiting.** Any number of cells can be whole and waiting for a tryer; each is one job, taken one at a
  time by the most curious.
- **Saved**: knowledge, places, the attached and withered parents of every cell, weariness and the open jobs. The save
  format is not kept compatible while the game is pre alpha.

## Open

- Whether a withered fibre should ever be forgiven (today a neuron crossed off a cell stays crossed off).
- The numbers above are first guesses and want playing.

## Later, not now

- **Behaviour mode**: needs (cold, thirst) as neurons in the trunk, and a recipe wired to a need becomes a habit, so a
  person builds a fire when cold without being told.
- Separate brains per band once there are several, and two bands meeting to share.
- The knapping floor `Trial` close-up could become the moment of the first real try, or be dropped.
