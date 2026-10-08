# Humans: inventory, a safe campfire, mining, crafting, guns and armour

Date: 2026-10-08. Approved in chat. Builds on the humans of
`2026-10-07-creatures-design.md` (`src/sim/humans.js`).

Everything here is the game's own. Gunpowder from Coal and Salt is the game's
existing in-game recipe, and the gun is a game abstraction: no real-world
synthesis or construction details, in code, hints or docs.

## 1. Inventory

The single carried pixel (`brain.carry`) becomes an inventory:

- **Slots:** one weapon, one tool, one armour.
- **Stacks:** up to 10 of each element (wood, coal, salt, metal, stone,
  gunpowder...).
- **Gunpowder:** whenever a human holds both Coal and Salt, 1 Coal and
  1 Salt become 2 Gunpowder (as the existing Coal + Salt reaction does),
  until gunpowder is at its cap of 10.
- **Fuel:**
  - A gatherer keeps picking up fuel until it holds 10, or no more is
    reachable, then goes to the pile.
  - For the first lighting it puts down enough to bring the pile to 6.
  - Once lit, whoever tends the fire adds one piece from its own stock each
    time the pile runs low, so one trip keeps the fire going for a long time.
- **Building:** hut builders gather up to 10 blocks per trip, then place them
  one by one.
- **Held item:** only one item is shown, the latest one or the one in use:
  - the pickaxe while mining;
  - the gun while aiming or shooting;
  - otherwise the last pixel picked up.
- **Armour:** worn armour shows as the shirt turning metal grey.
- **On death:** the stacks drop as pixels round the body; tool, weapon and
  armour are lost.

## 2. The Campfire element

Humans fled from their own fire: flames thrown 3-17 cells off the pile at
800 °C, hot ash (150-400 °C) and the grass it lit counted as danger, and the
step-back reflex fired about 80 times in 12,000 steps of the Wilderness.

- Lighting the pile turns its fuel into a new element, **Campfire**, not
  Fire.
- **Heat:** it holds 45 °C (about 8 °C above a human's body), so it is never
  danger and never triggers the step-back reflex.
- **Look:** it flickers in fire colours and gives off a wisp of Smoke now and
  then.
- **Burning:**
  - Each pixel burns for a while (coal longer than wood), then becomes cool
    Ash.
  - It throws no flames and lights nothing (not grass, trees or gunpowder).
  - It catches only fuel pixels touching it, slowly, so wood added to the
    pile catches.
- **Water** puts it out (it becomes Ash).
- The player can paint it. Real Fire is unchanged and humans still flee it.
  The fire-pit clearing, the step-back reflex and "don't walk through the
  fire" stay, for real fire.
- The camp counts a burning pile by Campfire (and Fire, if something else lit
  it).

## 3. When crafting starts, and in what order

- Each camp counts its lightings (`camp.lightings`). Crafting starts once
  the fire has been lit twice and the hut is finished.
- Each human crafts for itself. One human still keeps the fire fed; the
  others work through the steps.
- **The steps, in order:**
  1. **Pickaxe:** 3 wood make a wooden pickaxe (the tool). Digging
     strength goes from 30 to 150: stone, granite, coal and most metals,
     including Metal, but not Steel, Tungsten or Diamond.
  2. **Coal:** mine 5.
  3. **Salt:** mine 5. The inventory turns them into 10 gunpowder, kept as
     ammunition.
  4. **Metal:** mine metal. Any solid in the Metal or Alloy groups counts.
  5. **Gun:** 5 metal and 1 wood make the gun (the weapon).
  6. **Armour:** 8 more metal make armour.
- **Ammunition:** after the steps, a human with under 4 gunpowder goes back
  to mining coal and salt.
- **Missing resources:** a resource with none in reach is given up on for a
  while (as targets are now), and the human moves on to the next step,
  coming back to it later. A gun without gunpowder is held but not fired.

## 4. Mining and deposits

- **Finding deposits:**
  - A human knows the nearest wanted pixel (coal, salt or metal) within 120
    cells of its camp, even buried.
  - It never counts one a human put there, nor one it has given up on.
- **Digging towards it:**
  - It digs level, up a staircase, or down a staircase (new: it digs out the
    step ahead and below it, then drops into it).
  - Without a pickaxe it digs strength up to 30; with one, up to 150.
  - Once within reach it mines the pixel into its inventory, then the
    nearest pixel of the same kind, until it has enough.
- **On the way:** useful pixels it digs through (fuel, salt, metal, building
  stone) go into its inventory if there's room; anything else is destroyed,
  as now.
- **Deposits in the Wilderness:**
  - 2 coal seams, a salt bed, and 2 metal veins (Metal and Copper).
  - 15-40 cells underground, within reach of where the humans settle.
  - The Starting area gets none.

## 5. Guns, armour and fighting

- **A shot (a shotgun):**
  - 4 pellets in a tight spread, each travelling in a straight line from the
    gun, up to 48 cells, through air, gases and liquids.
  - Each pellet stops at the first solid, powder or creature. A creature
    loses the pixel it hits; the ground is not damaged.
  - It aims at a random pixel of the target, so some pellets miss.
  - One shot every 40 steps. Each shot uses 1 gunpowder; with none, it can't
    fire.
  - The muzzle gives a puff of Smoke, and a tracer line shows each pellet's
    path for a few frames. No real fire is made.
- **Holding fire:** it never fires when the first creature in the line is not
  the target (a camp member, say), and it needs a clear line of sight to the
  target.
- **Threats:** Spiders and Phoenixes within 40 cells of the human or its
  camp are shot.
- **Hunting:**
  - When idle (resting by the fire) with at least 4 gunpowder, it hunts
    animals within 40 cells: birds, frogs, snails, fish near the surface and
    the like.
  - At most one hunt per human every 2,000 steps.
  - An animal killed by gunfire leaves Meat.
- **Rival camps:**
  - Humans of different camps are rivals (camps closer than 60 cells are
    one camp).
  - An armed human with gunpowder shoots rivals on sight.
  - An unarmed rival, or one with no gunpowder, flees from an armed one, as
    from any danger.
  - Members of the same camp never fight.
- **Armour:**
  - Each pellet or blast hit on an armoured human is absorbed half the
    time.
  - After absorbing 10 hits the armour breaks. The human makes another once
    it has 8 metal again.
- **Priority:**
  1. flee real danger;
  2. fight (a threat or rival in range, while armed with gunpowder);
  3. shelter;
  4. work;
  5. hunt when idle.

## 6. Display and tests

- **Renderer:**
  - The held item is drawn at the hand: a pickaxe (brown handle, grey head),
    a gun (a short dark-grey barrel pointing the way it faces), or the last
    pixel picked up.
  - Armour turns the shirt metal grey.
  - Pellet tracers are drawn for a few frames.
- **Inspect line:** the inventory, for example "wood 7, coal 3, gunpowder 10;
  pickaxe, gun, armour".
- **Unit tests:**
  - **Inventory:** caps (10 per element, one per slot); Coal + Salt to
    Gunpowder; each recipe.
  - **Campfire:** holds 45 °C; doesn't spread to grass; becomes Ash; water
    puts it out; humans don't flee it.
  - **Shots:** 4 pellets per shot; 1 gunpowder per shot; no shot without
    gunpowder.
- **Situations** (several seeds each):
  - **Long runs:**
    - the whole chain (fires, hut, pickaxe, coal, salt, gunpowder, metal,
      gun, armour) in a world with deposits, nobody dying;
    - the existing reliability situations, now with the Campfire.
  - **Mining:**
    - mining down a staircase to a buried seam;
    - 10 wood fetched in one trip, and the fire fed from the stock.
  - **Fighting:**
    - a Phoenix near camp is shot;
    - hunting leaves Meat;
    - an armed rival against an unarmed one (it flees);
    - an armoured human against an unarmoured one (armour absorbs hits).
- **Suite time:** expected to grow to about 80-90 seconds.
- **Docs:** README and HANDOFF describe the inventory, Campfire, crafting
  chain, mining, guns and armour.
