# The mind: discovery as a tree of neurons

A design note, not built yet. It replaces the knapping floor experiment (`sim/discovery/`, `ui/closeUp.ts`) as the way the
player makes a discovery.

## Why

The discovery should be the player's: deciding that two flints, kindling and a branch might make fire is the fun. What
is not fun is the logistics in front of it, `pick up flint`, `bring flint here`, one item at a time, and `drop item here`
meaning nothing in particular once there are two people. **The player makes the guess; the people do the fetching.**

## Neurons are earned by living

**A neuron is something a person has met.** Picking up a flint lights `flint` in that person. Walking dry grass in summer
lights `dry`. A tree burning after a lightning strike lights `fire` and `smoke` in everyone who saw it. Nothing is in a
mind that the world did not put there, so exploring and watching are how the tree grows its roots.

There are two kinds: **things** (flint, branch, kindling, stone) and **happenings** (spark, smoke, ember, flame, sharp).
A discovery is a short chain, not one four-ingredient guess:

```
flint + flint     -> spark
spark + kindling  -> ember
ember + branch    -> flame
```

so fire is three small discoveries, each its own moment. `reactionBetween` in `sim/discovery/reactions.ts` already knows
what every pair does; its table becomes the edges of the graph.

## One tree, many holders

**Knowledge lives in people, but the player sees one tree for the whole group.** Each neuron records who holds it. Its
brightness is how many do: something everyone has seen is solid, something one person saw once flickers, labelled
`1 knows`. Selecting a person can highlight their own neurons in the same tree, which helps with two people and does no
harm with two hundred. The player never searches for the right person; the game finds them.

## A link grows a `?`

The player drags a link between any two neurons. **The link grows while the button is held** and pulls back if let go
early, so making it feels like a moment of thought. It ends in a new neuron with a `?` in it: a hypothesis, owned by the
group, and at the same time the work order.

A `?` resolves exactly once:

- **success** turns it into the real neuron (`spark`);
- **a lesser result** turns it into what actually happened (`weak spark`, from flint on stone), which hints that the
  right pair is close;
- **nothing** leaves a grey scar, so nobody tries it twice.

Once resolved it is never tried again. Others learn it by seeing or hearing, and a success becomes a recipe (below).

## Who tries: the most curious

**Every person has a curiosity**: a trait rolled at birth, so some are tinkerers and some never bother, scaled by how
they are now. Fed, rested and warm raises it; cold, hunger and exhaustion take it close to zero. A comfortable group
researches and a group in trouble survives first. It may also grow a little with each success and sink after a run of
failures.

For each open `?` the candidates are everyone who holds both parents, and everyone who holds one of them and can reach
someone who holds the other. **The most curious candidate with no critical need takes it**, not the nearest. If they
hold both, they gather what it needs and try it when they are next idle. If they hold one, they go to the holder of the
other (the most curious of those, so tinkerers end up working with tinkerers), talk, and then try it. The player never
orders the meeting: a hypothesis is reason enough for the two to want to meet.

Curiosity ranks after thirst, sleep and warmth, so nobody freezes over a flint. A tryer who becomes hungry or tired drops
the `?` and the next most curious picks it up later, the way a stalled plan is picked up again today. One tryer per `?`.

The gathering is the builders' fetch the campfire plan already does (`PLAN_NEEDS`, `deficit`, `nextBuildStep` in
`sim/people/`): the leaves of the chain are its needs.

## Showing beats telling

**Everyone who sees an experiment learns its result**, success or failure, fully and at once: within about 6 tiles and
in sight, and after dark only inside the firelight. Talking is slower and weaker: a told neuron arrives dim (`heard of`)
and turns solid only when the person has done or seen the thing. So knowledge spreads fastest where people work near each
other, and a group round a fire watching one of them strike sparks is the best school there is. Everyone in range shows a
small pulse when they learn.

People near each other, by the fire in the evening above all, also share neurons slowly on their own.

## After the discovery: recipes

**Only the first time is an experiment.** A chain that reaches a goal (`flame`) and has been proven in the world is a
recipe: from then on it is an order on the radial menu, carried out with the plan machinery as `Plan Campfire` is now, and
the milestone (`hasDiscoveredFire`, the coin) is earned by the first success.

This is the research and tech tree. It has no fixed order and no costs: what is found follows from what the world showed
the people, who is curious and who stands near whom, so two games on one seed can find fire by different roads.

## The brain button

A small icon tile with a brain beside the day dial and the time controls (`pixel/ui/icons.ts`, baked like the coins),
with a count of the `?` being worked on, which glows when a neuron is learned. It opens the tree, and above the tree a
list of what is being worked on, one line a `?`:

```
flint + flint     Eve           fetching flint
spark + kindling  Adam -> Eve   walking to talk
smoke + branch    nobody fit    waiting
```

A line moves the camera to its person. On the map a person carrying a `?` has a small `?` over their head, drawn like the
critical `!` (`drawAlert` in `ui/tileCursor.ts`), so the player can watch the guess walk into the world.

## The look and the sound

Each neuron is a 16 x 16 icon cell in the coin style. Dendrites are dithered pixel branches, a growing link a stepped line
whose pixels crawl, a firing pulse a bright pixel running along it. Senses sit at the bottom as roots and ideas grow up
the trunk, so the picture is literally a tree. Scars are grey, a `?` glows warm in the `FIRE` ramp.

Maybe: each neuron has a note from the game's synth; a pulse down a chain plays it as an arpeggio, a `?` holds an
unresolved interval while it waits and resolves into a chord when it succeeds. `ui/music.ts` stays the only door.

## What it replaces

The knapping floor, `Experiment` and the hauling to the floor go. The `Trial` close-up need not: it could become the
moment of the first real try (the person kneels and the spark is seen to catch) with nothing to carry and no pairs to try
by hand, or it is dropped. Undecided.

## Open

- Can a `?` be made from neurons nobody can bring together (no one holds either parent near anyone else)? It would wait,
  showing who would need to meet.
- How many `?` can be open at once: a queue, or one at a time so each guess is deliberate.
- How much a told neuron is worth against a seen one, and whether it fades unused.
- Saving: neurons and holders are per person, so `People.columns` (or a sparse table beside it) and the group's `?` list
  must be in the save.

## Later, not now

- **Behaviour mode**: needs (cold, thirst) as neurons in the trunk, and a recipe wired to a need becomes a habit, so a
  person builds a fire when cold without being told. With it the tree becomes a live readout of why people act, and could
  absorb the thoughts list.
- Separate trees per band once there are several, and two bands meeting to share.
