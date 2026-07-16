# PTR2e Super Effective Announcer

Foundry VTT module for Pokemon Tabletop Reunited: Evolved.

This module plays a synchronized screen-space animation and sound when a PTR2e attack resolves with a super-effective type matchup.

## Installation

Paste this manifest URL into Foundry's **Install Module** dialog:

`https://raw.githubusercontent.com/Umbura/ptr2e-super-effective-announcer/main/module.json`

The module also requires Sequencer. Install Sequencer first if it is not already active:

- Foundry package page: https://foundryvtt.com/packages/sequencer
- Sequencer manifest: `https://github.com/fantasycalendar/FoundryVTT-Sequencer/releases/latest/download/module.json`

## Features

- Reads the effectiveness value already calculated by PTR2e.
- Plays one announcement per attack message, including multi-target attacks.
- Displays the animation in screen space above the Foundry interface.
- Detects every attack message the client receives, regardless of actor ownership or message author.
- Synchronizes the animation and global sound through Sequencer.
- Ignores old chat messages when a user joins or reloads the world.
- Prevents duplicate broadcasts with an automatic playback coordinator: active GM first, otherwise the first active user.
- Provides settings for volume, screen width, top offset, and sound playback.
- Exposes a small API for manual playback and parser testing.
- Does not alter actor data, item data, compendium data, or PTR2e system files.

## Compatibility

- Foundry VTT: 14+
- System: Pokemon Tabletop Reunited: Evolved (PTR2e) 1.7.5+
- Required module: Sequencer 4.2.0+

## Testing

Normal use requires no macro. A PTR2e attack with an effectiveness multiplier above x1 triggers the announcement automatically.


## Notes

- The module only reacts to PTR2e attack chat messages.
- CSS and data changes are not injected; playback is handled through Sequencer at runtime.
- Socket playback is coordinated so every connected client receives one synchronized announcement.

## Asset Notice

The bundled announcement audio and animation are converted game-resource derivatives intended for use with this module. They are not covered by a broad code license and should not be redistributed separately without permission from the applicable rights holder.
