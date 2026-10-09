# Humans dig lined tunnels, kept as a shared network

Date: 2026-10-08. Approved in chat. Builds on
`2026-10-08-human-crafting-design.md`, and replaces its staircase mining.

**Why:** mining by digging a staircase through dirt lets loose dirt slide
in from above and from the sides. Humans then dig that out too, so they eat
away the landscape to reach a seam.

## 1. Tunnel shape and walls

- **Spots:** a tunnel is a straight run of standing spots (where a human's
  feet go) in one of 8 directions, at 45° steps relative to the way down it
  was dug with:
  - level;
  - diagonal (stairs);
  - straight up or down (a shaft).
- **Inside:** every cell of the 3×6 box a body covers at each spot. A
  diagonal is a staircase band; a shaft is 3 wide.
- **Walls (lining):**
  - A loose cell gets wood if it could fall into the tunnel: a powder with
    the inside directly below it, or diagonally below it.
  - That covers the ceilings of level runs, both sides of shafts, and the
    upper edge of each stair step. Floors under level runs and anything
    solid (rock, metal) get none.
  - Lining wood counts as placed by a human, so it is never dug for other
    reasons. Its cells are kept in the network's lining set.
- **Digging order:** it digs and lines one spot at a time.
  1. The spot's lining goes in first. The loose cell is swapped for wood,
     so it never has an open face to pour from.
  2. Then it digs the spot's new inside cells from the top down.
- **The face:** the face ahead gets lined like any other wall. When the
  next spot is dug, that lining is taken back into the pack. Only the
  tunnel's last face stays lined.
- **Undiggable:** anything it can't dig (Section 3) stops the tunnel there.

## 2. The network

- **Storage:** one network for the whole world, `world.tunnels`.
  - Nodes `{ id, x, y, kind }` at feet positions. The kinds:
    - `entrance`: on the surface;
    - `junction`: 3 or more edges meet;
    - `bend`: 2 edges in different directions;
    - `end`: a dead end.
  - Edges `{ id, a, b, dx, dy, len }`: straight runs between nodes, with
    `dx, dy` the unit step.
  - The way down the network was dug with. Humans use it only while
    gravity points that way.
- **Splitting:** a run can be split at any spot along it, which makes a
  junction there.
- **Pathfinding:**
  - Shortest path over the nodes, where an edge costs its length, and climbing
    a shaft costs 1.5 times.
  - From the surface, a human walks to the nearest entrance first.

## 3. Digging to a target

This replaces the staircase mining.

- **Planning:**
  - For a target cell it plans the cheapest route: travel through the network to
    some point (a node, or a spot partway along an edge), plus a new tunnel
    from there.
  - The new tunnel is two legs: diagonal first, then straight.
  - New tunnel counts as 4 times the cost of existing tunnel.
  - If nothing in the network helps, it starts a new entrance on the surface
    beside its camp, on the side towards the target.
- **Mining:** mining is tunnelling.
  - Wanted pixels it digs through go into its pack.
  - At the target, it carries on along the seam (a bend each time it changes
    direction) until it has enough.
- **Wood:**
  - Lining takes wood from its pack. With too little for the next spot, it
    walks out through the network, gathers up to 10 wood, paths back to the
    tunnel's end and carries on.
  - If no wood is in reach, it skips that deposit for a while.
- **Undiggable:** anything stronger than it can dig (stone without a
  pickaxe, steel) ends the tunnel there, and the deposit is skipped for a
  while.

## 4. Moving through tunnels

- **Pace:** it steps from spot to spot along edges: one every 4 steps on
  level runs and stairs, one every 6 climbing a shaft (up or down).
- **Holding on:** while travelling a shaft or stairs it holds on and doesn't
  fall. Off a level run's end it drops as usual.
- **Danger:** fleeing, drowning and swimming work as before. A human that
  stops travelling in a shaft drops to the bottom.

## 5. Repairs

- **Walls:** moving along a run while carrying wood, it puts back missing
  lining beside it.
- **Blockages:** a blocked stretch (sand poured in, a cave-in) is dug clear
  and re-lined.
- **Can't clear it:** if the blockage can't be dug (steel, or stone without
  a pickaxe), that edge, and any nodes left cut off, are dropped from the
  network. Humans plan around it.

## 6. Tests and docs

- **Shape:** for each of the 8 directions, where the inside goes and where
  the walls go; a tunnel through stone uses no wood.
- **Network:**
  - splitting an edge makes a junction;
  - shortest path;
  - dropping a stretch drops the nodes it cuts off.
- **Situations (several seeds):**
  - **Mining:** a human tunnels to coal 22 cells under dirt and gets 5. It
    destroys no more dirt than the tunnel's inside, the lining it swapped,
    and a small margin. Its nodes come out as entrance, bend and end.
  - **Branching:** a second deposit is reached by branching off the first
    tunnel, which makes a junction.
  - **Climbing:** a human goes up and down a shaft without falling.
  - **Wood:** a human that runs out of wood fetches more and finishes.
  - **Repairs:** sand poured into a tunnel is dug out and re-lined; steel
    poured in gets the stretch dropped.
  - **Regression:** the crafting chain still finishes.
- **Docs:** README and HANDOFF describe tunnels and the network.
