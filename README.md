# Solmar Heat — an open-world crime story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/zeinrefo-code/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/zeinrefo-code/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Heat** is a complete open-world crime game set in the original
sunset city of Solmar. You play **Mara Voss**, back in town and working for
**Rico**, who runs a garage. Steal cars, outrun the Solmar PD, fight armed
thugs, and run five story missions — from a homecoming drive to a
four-star bank heist.

## Play it

Serve `game/` with any static file server and open `game/index.html` in
desktop Chrome. No build step, no network requests, no libraries — plain
JavaScript, canvas 2D, and synthesised WebAudio sound.

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

## What's in the game

- **Open world** — Solmar City (3600×3600): downtown, marina, suburbs,
  docks, Palm Park, and Solmar Beach, with a road grid, traffic, parked
  cars, pedestrians, and named landmarks (Rico's Garage, The Neon Palms
  Club, Solmar General Hospital, Bayview Pier, the docks, Bayfront Bank).
- **Driving** — 7 car types (Vortex GT sports car, sedan, taxi, hatchback,
  van, truck, PD cruiser) with arcade physics, traffic AI, and drive-by
  shooting.
- **Wanted system** — 0–5 stars. Stealing cars, hitting pedestrians, and
  taking down cops raise the heat; PD cruisers chase and ram, foot cops
  arrest at 2+ stars, and heat cools off when you lay low. BUSTED and
  WASTED screens respawn you at the hospital.
- **Story** — 5 missions with dialogue, objectives, map markers, timers,
  cash rewards, and autosave: Homecoming, Hot Wheels, Debt Collection,
  The Getaway, and the Bayfront Heist. Then free roam.
- **Combat** — mouse-aimed pistol shooting on foot and from a car, enemy
  thugs who shoot back, car explosions, particles, health/cash/ammo
  pickups.
- **HUD & menus** — health, money, score, wanted stars, mission tracker
  with timer, live minimap, speedometer and car HP, title screen, pause
  menu, how-to-play, and mission list. Saves to localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse + click | Aim / shoot |
| E | Enter / exit car |
| Shift | Run |
| P | Pause & autosave |
| M | Mute |

## Structure

```
game/
  index.html        entry page
  src/
    util.js         math + random helpers
    city.js         Solmar City, roads, buildings, landmarks
    vehicles.js     car types, driving physics, traffic AI
    people.js       pedestrians, thugs, foot cops
    police.js       wanted system, chases, arrests
    missions.js     5-mission story chain
    combat.js       shooting, bullets, explosions, pickups
    render.js       camera, world drawing, minimap, HUD, menus
    audio.js        synthesised SFX + synthwave music
    save.js         localStorage saves
    input.js        keyboard + mouse
    main.js         game loop + state machine
```

A 100% original game. Not affiliated with Rockstar Games or Grand Theft Auto.

MIT licensed — see `LICENSE`.
