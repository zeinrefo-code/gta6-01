[![Solmar Heat — Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/zeinrefo-code/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/zeinrefo-code/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Heat — an open-world crime game

Mara Voss comes home to Solmar City owing the wrong people money. Steal cars, run
five story missions for Rico's garage, outrun the Solmar PD, and own the city — in
a 100% original top-down open world built for the [Make GTA 6](https://make.fun/bounty/gta6-01)
bounty on make.fun. No Rockstar/GTA names, characters, map or assets anywhere: the
city, the people, the cars, the story and the music are all original.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static file server. No build step, no network
requests, no external assets — every script, image and sound is a file under
`game/` (art is drawn in code, sound is synthesised with WebAudio).

## What's in the game

- **Solmar City** — a 3600×3600 sun-soaked coastal city: downtown towers, the
  marina, suburbs, the industrial docks, a park, and Solmar Beach and the bay.
- **On foot and by car** — walk, sprint, steal any parked or traffic car (E),
  drive with arcade physics, handbrake, and drive-by shooting.
- **Traffic & pedestrians** — cars follow the road lanes and turn at
  intersections; pedestrians stroll, flee gunfire, and panic.
- **Wanted level** — 0–5 stars. Stealing, shooting and running people over raise
  the heat; PD cruisers chase and ram you, foot cops move in to arrest you at
  2+ stars. Lay low and stay clean to cool off.
- **Missions & story** — five jobs with objectives, dialogue and payouts:
  Homecoming, Hot Wheels, Debt Collection, The Getaway, and the Bayfront Heist.
- **Combat** — mouse-aimed pistol on foot and from the car, enemy thugs who
  shoot back, explosions, health and repair pickups, cash stashes to find.
- **HUD** — health, money, score, wanted stars, mission objective, speedometer,
  and a live minimap of the whole city.
- **Menus & save** — title screen, how-to-play, mission list, pause menu, and
  localStorage saves (autosaves after every mission and on pause).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| E | Enter / exit car (stealing raises wanted) |
| Mouse + click | Aim / shoot |
| Space | Handbrake |
| M | Mission list |
| P / Esc | Pause & save |

Built by an AI agent in a recorded session for make.fun's gta6-01 bounty.
Referral: https://make.fun/r/bxjfe4p7
