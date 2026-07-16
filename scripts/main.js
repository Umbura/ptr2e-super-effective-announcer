const MODULE_ID = "ptr2e-super-effective-announcer";
const SYSTEM_ID = "ptr2e";
const ANIMATION_PATH = `modules/${MODULE_ID}/assets/super-effective-hon-capture.webm`;
const AUDIO_PATH = `modules/${MODULE_ID}/assets/super-effective-hon-capture.ogg`;
const ASSET_PATHS = [ANIMATION_PATH, AUDIO_PATH];

const processedMessageIds = new Set();
let moduleReadyAt = Number.POSITIVE_INFINITY;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enabled", {
    name: "PTR2ESEA.Settings.Enabled.Name",
    hint: "PTR2ESEA.Settings.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "playSound", {
    name: "PTR2ESEA.Settings.PlaySound.Name",
    hint: "PTR2ESEA.Settings.PlaySound.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "volume", {
    name: "PTR2ESEA.Settings.Volume.Name",
    hint: "PTR2ESEA.Settings.Volume.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.05
    },
    default: 0.8
  });

  game.settings.register(MODULE_ID, "screenWidth", {
    name: "PTR2ESEA.Settings.ScreenWidth.Name",
    hint: "PTR2ESEA.Settings.ScreenWidth.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0.35,
      max: 1,
      step: 0.05
    },
    default: 0.72
  });

  game.settings.register(MODULE_ID, "topOffset", {
    name: "PTR2ESEA.Settings.TopOffset.Name",
    hint: "PTR2ESEA.Settings.TopOffset.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0,
      max: 300,
      step: 10
    },
    default: 60
  });
});

Hooks.once("ready", async () => {
  if (game.system?.id !== SYSTEM_ID) return;

  moduleReadyAt = Date.now();

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({
      play: () => playAnnouncement(),
      getEffectiveness: getHighestEffectiveness
    });
  }

  game.socket?.on(`module.${MODULE_ID}`, handleSocketMessage);

  if (isActiveGM()) {
    await preloadAssets();
  }
});

Hooks.on("createChatMessage", (message) => handleChatMessage(message));
Hooks.on("updateChatMessage", (message) => handleChatMessage(message));
Hooks.on("renderChatMessage", (message) => handleChatMessage(message));
Hooks.on("renderChatMessageHTML", (message) => handleChatMessage(message));

async function handleChatMessage(message) {
  if (game.system?.id !== SYSTEM_ID) return;
  if (!game.settings.get(MODULE_ID, "enabled")) return;
  if (message.type !== "attack") return;
  if (!isFreshMessage(message)) return;
  if (processedMessageIds.has(message.id)) return;

  const effectiveness = getHighestEffectiveness(message);
  if (effectiveness <= 1) return;

  processedMessageIds.add(message.id);
  await requestAnnouncement(message.id);
}

function isActiveGM() {
  return Boolean(game.user?.isGM && game.users?.activeGM?.id === game.user.id);
}

function isFreshMessage(message) {
  const createdAt = Number(message?._stats?.createdTime ?? message?.timestamp ?? 0);
  return createdAt === 0 || createdAt >= moduleReadyAt - 2000;
}

function getHighestEffectiveness(message) {
  let highest = 1;

  for (const result of getCollectionValues(message?.system?.context?.results)) {
    highest = Math.max(highest, getEffectivenessFromResult(result));
  }

  for (const roll of getCollectionValues(message?.rolls)) {
    highest = Math.max(highest, getEffectivenessFromRollData(roll));
  }

  for (const roll of getCollectionValues(message?.system?.rolls)) {
    highest = Math.max(highest, getEffectivenessFromRollData(roll));
  }

  highest = Math.max(highest, getEffectivenessFromText(safeStringify(message?.system)));
  highest = Math.max(highest, getEffectivenessFromText(safeStringify(message?._source?.system)));

  return highest;
}

function getCollectionValues(collection) {
  if (!collection) return [];
  if (collection instanceof Map) return Array.from(collection.values());
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === "function") return Array.from(collection.values());
  if (typeof collection === "object") return Object.values(collection);
  return [];
}

function getEffectivenessFromResult(result) {
  let highest = 1;

  for (const candidate of [
    result,
    result?.context,
    result?.damageRoll,
    result?.damageRoll?.context,
    result?.damage,
    result?.roll,
    result?.roll?.context,
    result?.accuracy,
    result?.accuracyRoll
  ]) {
    highest = Math.max(highest, getEffectivenessFromRollData(candidate));
  }

  const rolls = Array.isArray(result?.rolls) ? result.rolls : [];
  for (const roll of rolls) {
    highest = Math.max(highest, getEffectivenessFromRollData(roll));
  }

  return highest;
}

function getEffectivenessFromRollData(data) {
  if (!data) return 1;

  let rollData = data;
  if (typeof rollData === "string") {
    try {
      rollData = JSON.parse(rollData);
    } catch {
      return getEffectivenessFromText(rollData);
    }
  }

  let highest = 1;
  for (const value of [
    rollData?.type,
    rollData?.effectiveness,
    rollData?.context?.type,
    rollData?.context?.effectiveness,
    rollData?.options?.type,
    rollData?.options?.effectiveness
  ]) {
    highest = Math.max(highest, getNumericEffectiveness(value));
  }

  for (const options of [
    rollData?.options,
    rollData?.options?.options,
    rollData?.context?.options,
    rollData?.context?.rollOptions
  ]) {
    highest = Math.max(highest, getEffectivenessFromOptions(options));
  }

  return highest;
}

function getNumericEffectiveness(value) {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) ? multiplier : 1;
}

function getEffectivenessFromOptions(options) {
  if (!options || typeof options[Symbol.iterator] !== "function") return 1;

  let highest = 1;
  for (const option of options) {
    if (typeof option !== "string") continue;

    const match = option.match(/^effectiveness:(-?\d+(?:\.\d+)?)$/);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
      continue;
    }

    if (option === "effectiveness:super") {
      highest = Math.max(highest, 2);
    }
  }
  return highest;
}

function getEffectivenessFromText(text) {
  if (!text) return 1;

  let highest = 1;
  for (const match of String(text).matchAll(/effectiveness:(-?\d+(?:\.\d+)?|super)/g)) {
    highest = Math.max(highest, match[1] === "super" ? 2 : Number(match[1]));
  }
  return highest;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

async function preloadAssets() {
  if (!globalThis.Sequencer?.Preloader) return;

  try {
    await Sequencer.Preloader.preloadForClients(ASSET_PATHS);
  } catch (error) {
    console.warn(`${MODULE_ID} | Unable to preload announcement assets.`, error);
  }
}

async function handleSocketMessage(data) {
  if (data?.type !== "play") return;
  if (!isPlaybackCoordinator()) return;
  if (!data.messageId || processedMessageIds.has(data.messageId)) return;

  processedMessageIds.add(data.messageId);
  await playAnnouncement();
}

async function requestAnnouncement(messageId) {
  if (isPlaybackCoordinator()) {
    await playAnnouncement();
    return;
  }

  game.socket?.emit(`module.${MODULE_ID}`, {
    type: "play",
    messageId,
    userId: game.user?.id
  });
}

function isPlaybackCoordinator() {
  if (isActiveGM()) return true;
  if (game.users?.activeGM) return false;

  const activeUsers = getActiveUsers();
  return activeUsers.length > 0 && activeUsers[0].id === game.user?.id;
}

function getActiveUsers() {
  const users = getCollectionValues(game.users);
  return users
    .filter((user) => user?.active !== false)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

async function playAnnouncement() {
  if (!globalThis.Sequence) {
    ui.notifications.error(game.i18n.localize("PTR2ESEA.Errors.SequencerUnavailable"));
    return false;
  }

  await preloadAssets();

  const screenWidth = game.settings.get(MODULE_ID, "screenWidth");
  const topOffset = game.settings.get(MODULE_ID, "topOffset");
  const playSound = game.settings.get(MODULE_ID, "playSound");
  const volume = game.settings.get(MODULE_ID, "volume");

  const sequence = new Sequence({ inModuleName: MODULE_ID })
    .effect()
      .file(ANIMATION_PATH)
      .screenSpace()
      .screenSpaceAboveUI()
      .anchor({ x: 0.5, y: 0 })
      .screenSpaceAnchor({ x: 0.5, y: 0 })
      .screenSpacePosition({ x: 0, y: topOffset })
      .screenSpaceScale({
        x: screenWidth,
        y: 1,
        fitX: true,
        fitY: false,
        ratioX: false,
        ratioY: true
      })
      .fadeIn(100)
      .fadeOut(250)
      .zIndex(1000);

  if (playSound) {
    sequence
      .sound()
        .file(AUDIO_PATH)
        .globalSound()
        .volume(volume);
  }

  await sequence.play();
  return true;
}
