export var GameMode;
(function (GameMode) {
    GameMode["FreeSki"] = "free_ski";
    GameMode["Slalom"] = "slalom";
    GameMode["TreeSlalom"] = "tree_slalom";
    GameMode["Jump"] = "jump";
})(GameMode || (GameMode = {}));
export const GAME_MODE_CONFIGS = {
    [GameMode.FreeSki]: {
        mode: GameMode.FreeSki,
        displayName: 'Free Ski',
        description: 'Go as far as you can. Watch out for the yeti.',
        yetiEnabled: true,
        yetiSpawnDistance: 1500,
    },
    [GameMode.Slalom]: {
        mode: GameMode.Slalom,
        displayName: 'Slalom',
        description: 'Pass through every gate. Miss one and it\'s over.',
        yetiEnabled: false,
        yetiSpawnDistance: 0,
        gateConfig: {
            gateSpacing: 400,
            timeLimitEnabled: false,
        },
    },
    [GameMode.TreeSlalom]: {
        mode: GameMode.TreeSlalom,
        displayName: 'Tree Slalom',
        description: 'Weave through trees arranged in a slalom course.',
        yetiEnabled: false,
        yetiSpawnDistance: 0,
        gateConfig: {
            gateSpacing: 350,
            timeLimitEnabled: false,
        },
    },
    [GameMode.Jump]: {
        mode: GameMode.Jump,
        displayName: 'Jump',
        description: 'Hit ramps and score big air. Distance plus hang-time wins.',
        yetiEnabled: true,
        yetiSpawnDistance: 2000,
        jumpConfig: {
            rampFrequency: 3,
            scoreMultiplier: 2.0,
        },
    },
};
