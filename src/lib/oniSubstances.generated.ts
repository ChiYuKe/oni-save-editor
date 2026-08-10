// Generated from the game's Resources/SubstanceHookup.asset, Unity materials, and StreamingAssets/elements YAML.
// Run: npm run generate:substances

export interface OniSubstanceMaterial {
  name: string
  substanceIndex: number
  elementId: number
  hash: number
  material: string
  texture: string
  textureUrl: string
  shineMask: string
  worldUvScale: number
  frequency: number
  colourTint: readonly [number, number, number, number]
  shineColour: readonly [number, number, number, number]
  colour: readonly [number, number, number, number]
  usesCaustics: boolean
  glows: boolean
  isOpaqueLiquid: boolean
  state: string
  lowTemp: number
  highTemp: number
}

export const ONI_SUBSTANCE_MATERIALS = [
  {
    "name": "Abyssalite",
    "substanceIndex": 0,
    "elementId": 1071649902,
    "hash": 5230,
    "material": "Material/matKatairite.mat",
    "texture": "Texture2D/katairite.png",
    "textureUrl": "/assets/elements/katairite.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      94,
      73,
      110,
      243
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 3695
  },
  {
    "name": "Aerogel",
    "substanceIndex": 1,
    "elementId": -2070223827,
    "hash": 58413,
    "material": "Material/matAerogel.mat",
    "texture": "Texture2D/algae.png",
    "textureUrl": "/assets/elements/algae.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 2,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      0,
      0,
      0,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Algae",
    "substanceIndex": 2,
    "elementId": -1870043872,
    "hash": 25888,
    "material": "Material/matAlgaeColony.mat",
    "texture": "Texture2D/algae.png",
    "textureUrl": "/assets/elements/algae.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 2,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      53,
      140,
      54,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 398.15
  },
  {
    "name": "Aluminum",
    "substanceIndex": 3,
    "elementId": 2108244480,
    "hash": 16896,
    "material": "Material/matAluminum.mat",
    "texture": "Texture2D/aluminum.png",
    "textureUrl": "/assets/elements/aluminum.png",
    "shineMask": "Texture2D/aluminum_mask.png",
    "worldUvScale": 10,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      0.7395957,
      0.58823526,
      0.303
    ],
    "colour": [
      149,
      163,
      171,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 933.45
  },
  {
    "name": "Aluminum Gas",
    "substanceIndex": 4,
    "elementId": 100766521,
    "hash": 37689,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      255,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 2743.15,
    "highTemp": 10000
  },
  {
    "name": "Aluminum Ore",
    "substanceIndex": 5,
    "elementId": 167973730,
    "hash": 4962,
    "material": "Material/matAluminumOre.mat",
    "texture": "Texture2D/aluminum_ore.png",
    "textureUrl": "/assets/elements/aluminum_ore.png",
    "shineMask": "Texture2D/aluminum_ore_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.7943205,
      0.71323526,
      1,
      0.278
    ],
    "colour": [
      122,
      73,
      62,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1357
  },
  {
    "name": "Amber",
    "substanceIndex": 6,
    "elementId": -1130501789,
    "hash": 59747,
    "material": "Material/matAmber.mat",
    "texture": "Texture2D/amber.png",
    "textureUrl": "/assets/elements/amber.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      208,
      88,
      27,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 368.15
  },
  {
    "name": "Basalt",
    "substanceIndex": 7,
    "elementId": 1347222069,
    "hash": 64053,
    "material": "Material/matBasalt.mat",
    "texture": "Texture2D/basalt.png",
    "textureUrl": "/assets/elements/basalt.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      30,
      30,
      38,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1530
  },
  {
    "name": "Biodiesel",
    "substanceIndex": 8,
    "elementId": -1121662089,
    "hash": 52087,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      225,
      203,
      105,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 263.15,
    "highTemp": 453.15
  },
  {
    "name": "Bitumen",
    "substanceIndex": 9,
    "elementId": 1433229102,
    "hash": 22318,
    "material": "Material/matCarbon.mat",
    "texture": "Texture2D/carbon.png",
    "textureUrl": "/assets/elements/carbon.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      60,
      55,
      55,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 812
  },
  {
    "name": "Bleach Stone",
    "substanceIndex": 10,
    "elementId": -839728230,
    "hash": 50074,
    "material": "Material/matBleachStone.mat",
    "texture": "Texture2D/bleach_stone.png",
    "textureUrl": "/assets/elements/bleach_stone.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      223,
      245,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 942
  },
  {
    "name": "Brackene",
    "substanceIndex": 11,
    "elementId": 59201595,
    "hash": 22587,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      134,
      255,
      164,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 256.65,
    "highTemp": 353.15
  },
  {
    "name": "Brackwax",
    "substanceIndex": 12,
    "elementId": -1792538178,
    "hash": 2494,
    "material": "Material/matMilkFat.mat",
    "texture": "Texture2D/milkfat.png",
    "textureUrl": "/assets/elements/milkfat.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      138,
      200,
      175,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 433
  },
  {
    "name": "Brick",
    "substanceIndex": 13,
    "elementId": -325269471,
    "hash": 51233,
    "material": "Material/matBrick.mat",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      161,
      73,
      52,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Brine",
    "substanceIndex": 14,
    "elementId": -324547888,
    "hash": 51920,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      255,
      255,
      255,
      87
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 250.65,
    "highTemp": 375.9
  },
  {
    "name": "Brine Ice",
    "substanceIndex": 15,
    "elementId": -1561279013,
    "hash": 50651,
    "material": "Material/matBrineIce.mat",
    "texture": "Texture2D/frozen_brine.png",
    "textureUrl": "/assets/elements/frozen_brine.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      255,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 256.65
  },
  {
    "name": "Building Slab",
    "substanceIndex": 16,
    "elementId": 1412740729,
    "hash": 46713,
    "material": "Material/matBrick.mat",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      83,
      90,
      106,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Carbon Dioxide",
    "substanceIndex": 17,
    "elementId": 1960575215,
    "hash": 239,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      30,
      30,
      30,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 225,
    "highTemp": 10000
  },
  {
    "name": "Carbon Fiber",
    "substanceIndex": 18,
    "elementId": 118518245,
    "hash": 29157,
    "material": "Material/matCarbonFibre.mat",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      48,
      48,
      48,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 5000
  },
  {
    "name": "Carbon Gas",
    "substanceIndex": 19,
    "elementId": -314016756,
    "hash": 31756,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      19,
      12,
      39,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 5100,
    "highTemp": 10000
  },
  {
    "name": "Cell Binder",
    "substanceIndex": 20,
    "elementId": -1350431554,
    "hash": 3262,
    "material": "Material/matViscoGel.mat",
    "texture": "Texture2D/viscogel.png",
    "textureUrl": "/assets/elements/viscogel.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      182,
      242,
      85,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Cement",
    "substanceIndex": 21,
    "elementId": 1627140480,
    "hash": 12672,
    "material": "Material/matCement.mat",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      202,
      202,
      202,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Cement Mix",
    "substanceIndex": 22,
    "elementId": 1668719292,
    "hash": 41660,
    "material": "Material/matCementMix.mat",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      200,
      200,
      200,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Ceramic",
    "substanceIndex": 23,
    "elementId": -1467370314,
    "hash": 46262,
    "material": "Material/matCeramic.mat",
    "texture": "Texture2D/ceramic.png",
    "textureUrl": "/assets/elements/ceramic.png",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      236,
      214,
      174,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2123
  },
  {
    "name": "Chlorine Gas",
    "substanceIndex": 24,
    "elementId": -1324664829,
    "hash": 14339,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      149,
      219,
      92,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 238.55,
    "highTemp": 10000
  },
  {
    "name": "Cinnabar Ore",
    "substanceIndex": 25,
    "elementId": 1875790680,
    "hash": 19288,
    "material": "Material/matCinnabar.mat",
    "texture": "Texture2D/cinnabar.png",
    "textureUrl": "/assets/elements/cinnabar.png",
    "shineMask": "Texture2D/cinnabar_mask.png",
    "worldUvScale": 6.5,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      255,
      78,
      31,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 856.65
  },
  {
    "name": "Clay",
    "substanceIndex": 26,
    "elementId": 867327137,
    "hash": 23713,
    "material": "Material/matClay.mat",
    "texture": "Texture2D/clay.png",
    "textureUrl": "/assets/elements/clay.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      159,
      168,
      83,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1200
  },
  {
    "name": "Coal",
    "substanceIndex": 27,
    "elementId": 947100397,
    "hash": 39661,
    "material": "Material/matCarbon.mat",
    "texture": "Texture2D/carbon.png",
    "textureUrl": "/assets/elements/carbon.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      128,
      115,
      130,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 550
  },
  {
    "name": "Cobalt",
    "substanceIndex": 28,
    "elementId": 108179667,
    "hash": 45267,
    "material": "Material/matCobalt.mat",
    "texture": "Texture2D/cobalt_refined.png",
    "textureUrl": "/assets/elements/cobalt_refined.png",
    "shineMask": "Texture2D/cobalt_refined_mask.png",
    "worldUvScale": 6.5,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.43867922,
      0.7144429,
      1,
      0.3372549
    ],
    "colour": [
      0,
      33,
      236,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1768
  },
  {
    "name": "Cobalt Gas",
    "substanceIndex": 29,
    "elementId": -1429687642,
    "hash": 45734,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      0,
      33,
      236,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 3200,
    "highTemp": 10000
  },
  {
    "name": "Cobalt Ore",
    "substanceIndex": 30,
    "elementId": -1411918265,
    "hash": 54855,
    "material": "Material/matCobaltite.mat",
    "texture": "Texture2D/cobalt_ore.png",
    "textureUrl": "/assets/elements/cobalt_ore.png",
    "shineMask": "Texture2D/cobalt_ore_mask.png",
    "worldUvScale": 6.5,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.43867922,
      0.7144429,
      1,
      0.3372549
    ],
    "colour": [
      0,
      33,
      236,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1768
  },
  {
    "name": "Composition",
    "substanceIndex": 31,
    "elementId": -1021084918,
    "hash": 31498,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      0,
      0,
      0,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Vacuum",
    "lowTemp": 0,
    "highTemp": 0
  },
  {
    "name": "Copper",
    "substanceIndex": 32,
    "elementId": -1725038055,
    "hash": 537,
    "material": "Material/matCopper.mat",
    "texture": "Texture2D/copper.png",
    "textureUrl": "/assets/elements/copper.png",
    "shineMask": "Texture2D/copper_mask.png",
    "worldUvScale": 6.5,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      219,
      84,
      40,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1357
  },
  {
    "name": "Copper Gas",
    "substanceIndex": 33,
    "elementId": 1966552544,
    "hash": 13792,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      219,
      84,
      40,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 2834,
    "highTemp": 10000
  },
  {
    "name": "Copper Ore",
    "substanceIndex": 34,
    "elementId": -1736594426,
    "hash": 44038,
    "material": "Material/matCuprite.mat",
    "texture": "Texture2D/cuprite.png",
    "textureUrl": "/assets/elements/cuprite.png",
    "shineMask": "Texture2D/cuprite_mask.png",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      169,
      94,
      99,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1357
  },
  {
    "name": "Coquina",
    "substanceIndex": 35,
    "elementId": -487705524,
    "hash": 13388,
    "material": "Material/matCoquina.mat",
    "texture": "Texture2D/coquina.png",
    "textureUrl": "/assets/elements/coquina.png",
    "shineMask": "",
    "worldUvScale": 5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      51,
      54,
      82,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1200
  },
  {
    "name": "Corallium",
    "substanceIndex": 36,
    "elementId": -1705953114,
    "hash": 14502,
    "material": "Material/matCorallium.mat",
    "texture": "Texture2D/corallium.png",
    "textureUrl": "/assets/elements/corallium.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      160,
      27,
      73,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 398.15
  },
  {
    "name": "Crude Oil",
    "substanceIndex": 37,
    "elementId": -1412059381,
    "hash": 44811,
    "material": "Material/matObsidian.mat",
    "texture": "Texture2D/obsidian.png",
    "textureUrl": "/assets/elements/obsidian.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      0,
      0,
      0,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 233,
    "highTemp": 673
  },
  {
    "name": "Crushed Ice",
    "substanceIndex": 38,
    "elementId": -2123557039,
    "hash": 5969,
    "material": "Material/matCrushedIce.mat",
    "texture": "Texture2D/crushed_ice.png",
    "textureUrl": "/assets/elements/crushed_ice.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      215,
      250,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 272.5
  },
  {
    "name": "Crushed Rock",
    "substanceIndex": 39,
    "elementId": -1714565729,
    "hash": 52639,
    "material": "Material/matCrushedRock.mat",
    "texture": "Texture2D/crushed_rock.png",
    "textureUrl": "/assets/elements/crushed_rock.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      178,
      178,
      178,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Diamond",
    "substanceIndex": 40,
    "elementId": -2079931820,
    "hash": 49748,
    "material": "Material/matDiamond.mat",
    "texture": "Texture2D/diamond.png",
    "textureUrl": "/assets/elements/diamond.png",
    "shineMask": "Texture2D/diamond_mask.png",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.60310334,
      0.6904493,
      0.71323526,
      0.347
    ],
    "colour": [
      203,
      197,
      233,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 4200
  },
  {
    "name": "Dirt",
    "substanceIndex": 41,
    "elementId": 1624244999,
    "hash": 775,
    "material": "Material/matDirt.mat",
    "texture": "Texture2D/dirt.png",
    "textureUrl": "/assets/elements/dirt.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      96,
      82,
      67,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 600
  },
  {
    "name": "Electrum",
    "substanceIndex": 42,
    "elementId": 28407099,
    "hash": 30011,
    "material": "Material/matElectrum.mat",
    "texture": "Texture2D/electrum.png",
    "textureUrl": "/assets/elements/electrum.png",
    "shineMask": "Texture2D/electrum_mask.png",
    "worldUvScale": 10,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.41911763,
      0.54330623,
      1,
      0.366
    ],
    "colour": [
      97,
      121,
      176,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1337
  },
  {
    "name": "Ethanol",
    "substanceIndex": 43,
    "elementId": -87974045,
    "hash": 40803,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      0,
      255,
      202,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 159.1,
    "highTemp": 351.5
  },
  {
    "name": "Ethanol Gas",
    "substanceIndex": 44,
    "elementId": -756961258,
    "hash": 45078,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      0,
      255,
      202,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 351.5,
    "highTemp": 10000
  },
  {
    "name": "Fertilizer",
    "substanceIndex": 45,
    "elementId": -1396791454,
    "hash": 42850,
    "material": "Material/matFertilizer.mat",
    "texture": "Texture2D/fertilizer.png",
    "textureUrl": "/assets/elements/fertilizer.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      61,
      104,
      122,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 398.15
  },
  {
    "name": "Fossil",
    "substanceIndex": 46,
    "elementId": 1757792140,
    "hash": 51084,
    "material": "Material/matFossil.mat",
    "texture": "Texture2D/fossil.png",
    "textureUrl": "/assets/elements/fossil.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      122,
      103,
      72,
      1
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1612
  },
  {
    "name": "Frozen Brackene",
    "substanceIndex": 47,
    "elementId": -1767622480,
    "hash": 14512,
    "material": "Material/matMilkIce.mat",
    "texture": "Texture2D/milk.png",
    "textureUrl": "/assets/elements/milk.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      134,
      255,
      164,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 256.65
  },
  {
    "name": "Frozen Mucin",
    "substanceIndex": 48,
    "elementId": -553490514,
    "hash": 26542,
    "material": "Material/matSolidMucus.mat",
    "texture": "Texture2D/mucus.png",
    "textureUrl": "/assets/elements/mucus.png",
    "shineMask": "",
    "worldUvScale": 5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      170,
      205,
      170,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 263.15
  },
  {
    "name": "Frozen Ovolene",
    "substanceIndex": 49,
    "elementId": 1205622264,
    "hash": 22008,
    "material": "Material/matMilkIce.mat",
    "texture": "Texture2D/milk.png",
    "textureUrl": "/assets/elements/milk.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      221,
      144,
      205,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 256.65
  },
  {
    "name": "Frozen Phyto Oil",
    "substanceIndex": 50,
    "elementId": -226111914,
    "hash": 52822,
    "material": "Material/matFrozenPhytoOil.mat",
    "texture": "Texture2D/frozen_phyto_oil.png",
    "textureUrl": "/assets/elements/frozen_phyto_oil.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      152,
      168,
      47,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 240
  },
  {
    "name": "Frozen Squid Ink",
    "substanceIndex": 51,
    "elementId": 641221190,
    "hash": 16966,
    "material": "Material/matFrozenInk.mat",
    "texture": "Texture2D/ink_frozen.png",
    "textureUrl": "/assets/elements/ink_frozen.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      51,
      46,
      82,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 252.5
  },
  {
    "name": "Fullerene",
    "substanceIndex": 52,
    "elementId": 245514112,
    "hash": 16256,
    "material": "Material/matFullerene.mat",
    "texture": "Texture2D/fullerene.png",
    "textureUrl": "/assets/elements/fullerene.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      112,
      102,
      113,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 4200
  },
  {
    "name": "Galena",
    "substanceIndex": 53,
    "elementId": 2071292326,
    "hash": 27046,
    "material": "Material/matGalena.mat",
    "texture": "Texture2D/galena.png",
    "textureUrl": "/assets/elements/galena.png",
    "shineMask": "Texture2D/galena_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.5882353,
      0.52156866,
      0.38431373,
      0.303
    ],
    "colour": [
      190,
      180,
      155,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1387.15
  },
  {
    "name": "Genetic Ooze",
    "substanceIndex": 54,
    "elementId": 976099455,
    "hash": 6271,
    "material": "Material/matAlgaeColony.mat",
    "texture": "Texture2D/algae.png",
    "textureUrl": "/assets/elements/algae.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 2,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      191,
      188,
      73,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Glass",
    "substanceIndex": 55,
    "elementId": 623986332,
    "hash": 18076,
    "material": "Material/matGlass.mat",
    "texture": "Texture2D/diamond.png",
    "textureUrl": "/assets/elements/diamond.png",
    "shineMask": "Texture2D/diamond_mask.png",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      0.6036846,
      0.9285155,
      0.9622642,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      223,
      255,
      254,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1700
  },
  {
    "name": "Gold",
    "substanceIndex": 56,
    "elementId": -279785280,
    "hash": 53440,
    "material": "Material/matGold.mat",
    "texture": "Texture2D/gold.png",
    "textureUrl": "/assets/elements/gold.png",
    "shineMask": "Texture2D/gold_mask.png",
    "worldUvScale": 7,
    "frequency": 0.06,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8602941,
      0.79188937,
      0.50605536,
      0.303
    ],
    "colour": [
      250,
      178,
      20,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1337
  },
  {
    "name": "Gold Amalgam",
    "substanceIndex": 57,
    "elementId": 361868060,
    "hash": 43804,
    "material": "Material/matGoldAmalgam.mat",
    "texture": "Texture2D/gold_amalgam.png",
    "textureUrl": "/assets/elements/gold_amalgam.png",
    "shineMask": "Texture2D/gold_amalgam_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      0.8849023,
      0.75735295,
      0.266
    ],
    "colour": [
      250,
      178,
      20,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1337
  },
  {
    "name": "Gold Gas",
    "substanceIndex": 58,
    "elementId": -805366663,
    "hash": 5241,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      217,
      167,
      17,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 3129,
    "highTemp": 10000
  },
  {
    "name": "Granite",
    "substanceIndex": 59,
    "elementId": -105943486,
    "hash": 28226,
    "material": "Material/matGranite.mat",
    "texture": "Texture2D/granite.png",
    "textureUrl": "/assets/elements/granite.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      147,
      154,
      159,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 942
  },
  {
    "name": "Graphite",
    "substanceIndex": 60,
    "elementId": 878995724,
    "hash": 26892,
    "material": "Material/matGraphite.mat",
    "texture": "Texture2D/graphite.png",
    "textureUrl": "/assets/elements/graphite.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      0,
      0,
      0,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 550
  },
  {
    "name": "Gum Wood",
    "substanceIndex": 61,
    "elementId": -1675462177,
    "hash": 31199,
    "material": "Material/matPalmWood.mat",
    "texture": "Texture2D/palmwood.png",
    "textureUrl": "/assets/elements/palmwood.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      188,
      129,
      114,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 873.15
  },
  {
    "name": "Gunk",
    "substanceIndex": 62,
    "elementId": -714505017,
    "hash": 33991,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      81,
      35,
      96,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 265,
    "highTemp": 721
  },
  {
    "name": "Helium",
    "substanceIndex": 63,
    "elementId": -1934139602,
    "hash": 24366,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      216,
      48,
      48,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 0,
    "highTemp": 4.22
  },
  {
    "name": "Helium",
    "substanceIndex": 64,
    "elementId": -1554872654,
    "hash": 34482,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      206,
      44,
      44,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 4.22,
    "highTemp": 10000
  },
  {
    "name": "Hydrogen Gas",
    "substanceIndex": 65,
    "elementId": -1046145888,
    "hash": 5280,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      233,
      99,
      141,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 21,
    "highTemp": 10000
  },
  {
    "name": "Ice",
    "substanceIndex": 66,
    "elementId": 873952427,
    "hash": 29867,
    "material": "Material/matIce.mat",
    "texture": "Texture2D/ice.png",
    "textureUrl": "/assets/elements/ice.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      255,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 272.5
  },
  {
    "name": "Igneous Rock",
    "substanceIndex": 67,
    "elementId": -355957251,
    "hash": 34301,
    "material": "Material/matIgneousRock.mat",
    "texture": "Texture2D/igneous_rock.png",
    "textureUrl": "/assets/elements/igneous_rock.png",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      107,
      113,
      128,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Insulite",
    "substanceIndex": 68,
    "elementId": -1713958528,
    "hash": 4480,
    "material": "Material/matSuperInsulator.mat",
    "texture": "Texture2D/super_insulator.png",
    "textureUrl": "/assets/elements/super_insulator.png",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      0,
      207,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 3895
  },
  {
    "name": "Iridium",
    "substanceIndex": 69,
    "elementId": -198894563,
    "hash": 7197,
    "material": "Material/matIridium.mat",
    "texture": "Texture2D/iridium.png",
    "textureUrl": "/assets/elements/iridium.png",
    "shineMask": "Texture2D/fools_gold_mask.png",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.65590715,
      0.6039216,
      0.7137255,
      0.347
    ],
    "colour": [
      176,
      160,
      186,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2719
  },
  {
    "name": "Iridium Gas",
    "substanceIndex": 70,
    "elementId": 1859051228,
    "hash": 57052,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      176,
      160,
      186,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 4403,
    "highTemp": 10000
  },
  {
    "name": "Iron",
    "substanceIndex": 71,
    "elementId": 1306370440,
    "hash": 41352,
    "material": "Material/matIron.mat",
    "texture": "Texture2D/iron.png",
    "textureUrl": "/assets/elements/iron.png",
    "shineMask": "Texture2D/electrum_mask.png",
    "worldUvScale": 10,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      0.7395957,
      0.58823526,
      0.303
    ],
    "colour": [
      137,
      45,
      11,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1808
  },
  {
    "name": "Iron Gas",
    "substanceIndex": 72,
    "elementId": 1541626289,
    "hash": 22961,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      122,
      73,
      62,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 3023,
    "highTemp": 10000
  },
  {
    "name": "Iron Ore",
    "substanceIndex": 73,
    "elementId": 1608833498,
    "hash": 55770,
    "material": "Material/matIronOre.mat",
    "texture": "Texture2D/hematite.png",
    "textureUrl": "/assets/elements/hematite.png",
    "shineMask": "Texture2D/copper_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.7943205,
      0.71323526,
      1,
      0.278
    ],
    "colour": [
      122,
      73,
      62,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1808
  },
  {
    "name": "Isosap",
    "substanceIndex": 74,
    "elementId": -2008682336,
    "hash": 61600,
    "material": "Material/matIsoresin.mat",
    "texture": "Texture2D/isoresin.png",
    "textureUrl": "/assets/elements/isoresin.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      163,
      0,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 473.15
  },
  {
    "name": "Latex",
    "substanceIndex": 75,
    "elementId": -2108601198,
    "hash": 19602,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      177,
      225,
      228,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 272.5,
    "highTemp": 372.5
  },
  {
    "name": "Lead",
    "substanceIndex": 76,
    "elementId": -755153220,
    "hash": 18108,
    "material": "Material/matLead.mat",
    "texture": "Texture2D/lead.png",
    "textureUrl": "/assets/elements/lead.png",
    "shineMask": "Texture2D/lead_mask.png",
    "worldUvScale": 7,
    "frequency": 0.06,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8602941,
      0.79188937,
      0.50605536,
      0.303
    ],
    "colour": [
      250,
      178,
      20,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 600.65
  },
  {
    "name": "Lead Gas",
    "substanceIndex": 77,
    "elementId": 905042813,
    "hash": 56189,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      217,
      167,
      17,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 2022.15,
    "highTemp": 10000
  },
  {
    "name": "Lime",
    "substanceIndex": 78,
    "elementId": -721320011,
    "hash": 34741,
    "material": "Material/matLime.mat",
    "texture": "Texture2D/limestone.png",
    "textureUrl": "/assets/elements/limestone.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      195,
      198,
      193,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1330
  },
  {
    "name": "Limestone",
    "substanceIndex": 79,
    "elementId": -1337715984,
    "hash": 4848,
    "material": "Material/matLimestone.mat",
    "texture": "Texture2D/calcium.png",
    "textureUrl": "/assets/elements/calcium.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      195,
      198,
      150,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Liquid Carbon",
    "substanceIndex": 80,
    "elementId": 505665536,
    "hash": 55296,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      55,
      34,
      40,
      255
    ],
    "usesCaustics": true,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 3825,
    "highTemp": 5100
  },
  {
    "name": "Liquid Carbon Dioxide",
    "substanceIndex": 81,
    "elementId": -1526513293,
    "hash": 16755,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      13,
      13,
      13,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 216.6,
    "highTemp": 225
  },
  {
    "name": "Liquid Chlorine",
    "substanceIndex": 82,
    "elementId": -878033482,
    "hash": 17846,
    "material": "Material/matSolidCarbonDioxide.mat",
    "texture": "Texture2D/solid_carbon_dioxide.png",
    "textureUrl": "/assets/elements/solid_carbon_dioxide.png",
    "shineMask": "",
    "worldUvScale": 7.5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      145,
      229,
      66,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 172.17,
    "highTemp": 238.55
  },
  {
    "name": "Liquid Hydrogen",
    "substanceIndex": 83,
    "elementId": -751997156,
    "hash": 28444,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      216,
      84,
      141,
      0
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 14,
    "highTemp": 21
  },
  {
    "name": "Liquid Methane",
    "substanceIndex": 84,
    "elementId": 371787440,
    "hash": 1712,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      110,
      15,
      0
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 90.55,
    "highTemp": 111.65
  },
  {
    "name": "Liquid Naphtha",
    "substanceIndex": 85,
    "elementId": 1157157570,
    "hash": 53954,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      0,
      0,
      0,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 223,
    "highTemp": 812
  },
  {
    "name": "Liquid Oxygen",
    "substanceIndex": 86,
    "elementId": -1908044868,
    "hash": 35772,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      146,
      222,
      255,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 54.36,
    "highTemp": 90.19
  },
  {
    "name": "Liquid Phosphorus",
    "substanceIndex": 87,
    "elementId": 1323821489,
    "hash": 59825,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      62,
      20,
      37,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 317.3,
    "highTemp": 553.6
  },
  {
    "name": "Liquid Propane",
    "substanceIndex": 88,
    "elementId": -645698215,
    "hash": 27993,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      41,
      60,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 85,
    "highTemp": 231
  },
  {
    "name": "Liquid Sucrose",
    "substanceIndex": 89,
    "elementId": 1318135165,
    "hash": 9597,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      135,
      104,
      36,
      0
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 459,
    "highTemp": 503.15
  },
  {
    "name": "Liquid Sulfur",
    "substanceIndex": 90,
    "elementId": -1108652427,
    "hash": 20085,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      255,
      0,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 388.35,
    "highTemp": 610.15
  },
  {
    "name": "Mafic Rock",
    "substanceIndex": 91,
    "elementId": 1282846257,
    "hash": 44593,
    "material": "Material/matMaficRock.mat",
    "texture": "Texture2D/mafic_rock.png",
    "textureUrl": "/assets/elements/mafic_rock.png",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      80,
      76,
      84,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Magma",
    "substanceIndex": 92,
    "elementId": -1075911705,
    "hash": 58343,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      26,
      0,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1683,
    "highTemp": 2630
  },
  {
    "name": "Mercury",
    "substanceIndex": 93,
    "elementId": -537625624,
    "hash": 31720,
    "material": "Material/matSolidMercury.mat",
    "texture": "Texture2D/solid_mercury.png",
    "textureUrl": "/assets/elements/solid_mercury.png",
    "shineMask": "Texture2D/solid_mercury_mask.png",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.42647058,
      0.69148076,
      1,
      0.316
    ],
    "colour": [
      87,
      101,
      153,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 234.3
  },
  {
    "name": "Mercury",
    "substanceIndex": 94,
    "elementId": 1732126099,
    "hash": 9619,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      105,
      139,
      180,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 234.3,
    "highTemp": 629.9
  },
  {
    "name": "Mercury Gas",
    "substanceIndex": 95,
    "elementId": -839856666,
    "hash": 52710,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      81,
      127,
      180,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 629.9,
    "highTemp": 10000
  },
  {
    "name": "MISSING.STRINGS.ELEMENTS.REFINEDLIPIDS.NAME",
    "substanceIndex": 96,
    "elementId": 1468338876,
    "hash": 4796,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      255,
      248,
      175,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Molten Aluminum",
    "substanceIndex": 97,
    "elementId": -1637472877,
    "hash": 9619,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      188,
      188,
      188,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 933.45,
    "highTemp": 2743.15
  },
  {
    "name": "Molten Cobalt",
    "substanceIndex": 98,
    "elementId": -333255194,
    "hash": 60902,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      0,
      29,
      206,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1768,
    "highTemp": 3200
  },
  {
    "name": "Molten Copper",
    "substanceIndex": 99,
    "elementId": 2128494380,
    "hash": 16172,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      224,
      57,
      14,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1357,
    "highTemp": 2834
  },
  {
    "name": "Molten Glass",
    "substanceIndex": 100,
    "elementId": -1312713527,
    "hash": 38089,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      182,
      255,
      250,
      0
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1400,
    "highTemp": 2630
  },
  {
    "name": "Molten Gold",
    "substanceIndex": 101,
    "elementId": -1083496621,
    "hash": 10067,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      101,
      0,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1337,
    "highTemp": 3129
  },
  {
    "name": "Molten Iridium",
    "substanceIndex": 102,
    "elementId": -1214831670,
    "hash": 9162,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      204,
      120,
      142,
      0
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 2719,
    "highTemp": 4403
  },
  {
    "name": "Molten Iron",
    "substanceIndex": 103,
    "elementId": 502659099,
    "hash": 63515,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      84,
      29,
      9,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1808,
    "highTemp": 3023
  },
  {
    "name": "Molten Lead",
    "substanceIndex": 104,
    "elementId": -1558864561,
    "hash": 40271,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      250,
      178,
      20,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 600.65,
    "highTemp": 2022.15
  },
  {
    "name": "Molten Nickel",
    "substanceIndex": 105,
    "elementId": 2079148957,
    "hash": 19357,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      191,
      217,
      204,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1728,
    "highTemp": 3003
  },
  {
    "name": "Molten Niobium",
    "substanceIndex": 106,
    "elementId": 1499134368,
    "hash": 63904,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      52,
      130,
      91,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 2750,
    "highTemp": 5017
  },
  {
    "name": "Molten Salt",
    "substanceIndex": 107,
    "elementId": -422045879,
    "hash": 5961,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      0,
      33,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1073,
    "highTemp": 1738
  },
  {
    "name": "Molten Steel",
    "substanceIndex": 108,
    "elementId": 1459013976,
    "hash": 51544,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      161,
      16,
      72,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 1357,
    "highTemp": 4100
  },
  {
    "name": "Molten Synthesis Gas",
    "substanceIndex": 109,
    "elementId": 660593444,
    "hash": 56100,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      112,
      69,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 14,
    "highTemp": 21
  },
  {
    "name": "Molten Tungsten",
    "substanceIndex": 110,
    "elementId": -509585641,
    "hash": 22295,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      192,
      44,
      41,
      255
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 3695,
    "highTemp": 6203
  },
  {
    "name": "Molten Zinc",
    "substanceIndex": 111,
    "elementId": 813320439,
    "hash": 18679,
    "material": "Resources/fonts & materials/Bangers SDF - Drop Shadow - 2 Pass.mat",
    "texture": "../../../../../../oni-save-editor",
    "textureUrl": "/assets/elements/",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      30,
      170,
      170,
      0
    ],
    "usesCaustics": false,
    "glows": true,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 692.88,
    "highTemp": 1180
  },
  {
    "name": "Moss",
    "substanceIndex": 112,
    "elementId": 109229826,
    "hash": 46850,
    "material": "Material/matMoss.mat",
    "texture": "Texture2D/moss.png",
    "textureUrl": "/assets/elements/moss.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      53,
      140,
      54,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Mucin",
    "substanceIndex": 113,
    "elementId": 1618409177,
    "hash": 63193,
    "material": "Material/matViscoGel.mat",
    "texture": "Texture2D/viscogel.png",
    "textureUrl": "/assets/elements/viscogel.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      170,
      205,
      170,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 263.15,
    "highTemp": 363.15
  },
  {
    "name": "Mud",
    "substanceIndex": 114,
    "elementId": 908179228,
    "hash": 46876,
    "material": "Material/matMud.mat",
    "texture": "Texture2D/sludge.png",
    "textureUrl": "/assets/elements/sludge.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      99,
      42,
      24,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 372.84
  },
  {
    "name": "Natural Gas",
    "substanceIndex": 115,
    "elementId": -841236436,
    "hash": 49196,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      110,
      15,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 111.65,
    "highTemp": 10000
  },
  {
    "name": "Nectar",
    "substanceIndex": 116,
    "elementId": 878488353,
    "hash": 43809,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      229,
      226,
      179,
      0
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 190.65,
    "highTemp": 433.15
  },
  {
    "name": "Neutronium",
    "substanceIndex": 117,
    "elementId": 1838482828,
    "hash": 1420,
    "material": "Material/matUnobtanium.mat",
    "texture": "Texture2D/neutronium.png",
    "textureUrl": "/assets/elements/neutronium.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      255,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Nickel",
    "substanceIndex": 118,
    "elementId": -1774383478,
    "hash": 3722,
    "material": "Material/matNickel.mat",
    "texture": "Texture2D/nickel.png",
    "textureUrl": "/assets/elements/nickel.png",
    "shineMask": "Texture2D/nickel_mask.png",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      1,
      0.9607843,
      0.303
    ],
    "colour": [
      191,
      217,
      204,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1728
  },
  {
    "name": "Nickel Gas",
    "substanceIndex": 119,
    "elementId": 1320373807,
    "hash": 20015,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      191,
      217,
      204,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 3003,
    "highTemp": 10000
  },
  {
    "name": "Nickel Ore",
    "substanceIndex": 120,
    "elementId": 1387581016,
    "hash": 52824,
    "material": "Material/matNickelOre.mat",
    "texture": "Texture2D/nickel_ore.png",
    "textureUrl": "/assets/elements/nickel_ore.png",
    "shineMask": "Texture2D/nickel_ore_mask.png",
    "worldUvScale": 9,
    "frequency": 0.77,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      1,
      0.96238685,
      0.303
    ],
    "colour": [
      191,
      217,
      204,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1728
  },
  {
    "name": "Niobium",
    "substanceIndex": 121,
    "elementId": -1779895821,
    "hash": 61939,
    "material": "Material/matNiobium.mat",
    "texture": "Texture2D/niobium.png",
    "textureUrl": "/assets/elements/niobium.png",
    "shineMask": "Texture2D/niobium_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      52,
      130,
      91,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2750
  },
  {
    "name": "Niobium Gas",
    "substanceIndex": 122,
    "elementId": -1616033402,
    "hash": 18822,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      52,
      130,
      91,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 5017,
    "highTemp": 10000
  },
  {
    "name": "Nitro",
    "substanceIndex": 123,
    "elementId": -1976640713,
    "hash": 56119,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      237,
      241,
      188,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Nutrient Serum",
    "substanceIndex": 124,
    "elementId": 1795542641,
    "hash": 52849,
    "material": "Material/matViscoGel.mat",
    "texture": "Texture2D/viscogel.png",
    "textureUrl": "/assets/elements/viscogel.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      104,
      234,
      104,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "",
    "lowTemp": 0,
    "highTemp": 10000
  },
  {
    "name": "Obsidian",
    "substanceIndex": 125,
    "elementId": -474151749,
    "hash": 1211,
    "material": "Material/matObsidian.mat",
    "texture": "Texture2D/obsidian.png",
    "textureUrl": "/assets/elements/obsidian.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      47,
      53,
      60,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 3000
  },
  {
    "name": "Ovolene",
    "substanceIndex": 126,
    "elementId": 1646675187,
    "hash": 17651,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      96,
      36,
      84,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 256.65,
    "highTemp": 353.15
  },
  {
    "name": "Oxygen",
    "substanceIndex": 127,
    "elementId": -1528777920,
    "hash": 45888,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      46,
      192,
      231,
      133
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 90.19,
    "highTemp": 10000
  },
  {
    "name": "Oxylite",
    "substanceIndex": 128,
    "elementId": 1262005685,
    "hash": 44469,
    "material": "Material/matOxyRock.mat",
    "texture": "Texture2D/oxyrocks.png",
    "textureUrl": "/assets/elements/oxyrocks.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      4,
      132,
      134,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Packed Snow",
    "substanceIndex": 129,
    "elementId": 1542131326,
    "hash": 3710,
    "material": "Material/matStableSnow.mat",
    "texture": "Texture2D/snow.png",
    "textureUrl": "/assets/elements/snow.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      218,
      245,
      250,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 272.5
  },
  {
    "name": "Pearl",
    "substanceIndex": 130,
    "elementId": 1120921638,
    "hash": 59430,
    "material": "Material/matPearl.mat",
    "texture": "Texture2D/pearl.png",
    "textureUrl": "/assets/elements/pearl.png",
    "shineMask": "Texture2D/pearl_mask.png",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      244,
      200,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1098
  },
  {
    "name": "Peat",
    "substanceIndex": 131,
    "elementId": -1927771704,
    "hash": 35272,
    "material": "Material/matPeat.mat",
    "texture": "Texture2D/peat.png",
    "textureUrl": "/assets/elements/peat.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      84,
      71,
      57,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 500
  },
  {
    "name": "Petroleum",
    "substanceIndex": 132,
    "elementId": -486269331,
    "hash": 7789,
    "material": "Material/matObsidian.mat",
    "texture": "Texture2D/obsidian.png",
    "textureUrl": "/assets/elements/obsidian.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      195,
      37,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 216,
    "highTemp": 812
  },
  {
    "name": "Phosphate Nodules",
    "substanceIndex": 133,
    "elementId": -1901832310,
    "hash": 22410,
    "material": "Material/matPhosphateNodules.mat",
    "texture": "Texture2D/phosphate_nodules.png",
    "textureUrl": "/assets/elements/phosphate_nodules.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      166,
      79,
      121,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 700
  },
  {
    "name": "Phosphorite",
    "substanceIndex": 134,
    "elementId": -877427037,
    "hash": 34467,
    "material": "Material/matPhosphorite.mat",
    "texture": "Texture2D/phosphorite.png",
    "textureUrl": "/assets/elements/phosphorite.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      166,
      79,
      121,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 517
  },
  {
    "name": "Phosphorus Gas",
    "substanceIndex": 135,
    "elementId": 1887387588,
    "hash": 16324,
    "material": "Material/matPhosphorus.mat",
    "texture": "Texture2D/phosphorus.png",
    "textureUrl": "/assets/elements/phosphorus.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      200,
      61,
      128,
      115
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 553.6,
    "highTemp": 10000
  },
  {
    "name": "Phyto Oil",
    "substanceIndex": 136,
    "elementId": -20315850,
    "hash": 310,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      152,
      168,
      47,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 240,
    "highTemp": 348.15
  },
  {
    "name": "Plastic",
    "substanceIndex": 137,
    "elementId": -1142341158,
    "hash": 16858,
    "material": "Material/matPlastic.mat",
    "texture": "Texture2D/plastic.png",
    "textureUrl": "/assets/elements/plastic.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      150,
      218,
      226,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 433
  },
  {
    "name": "Plastium",
    "substanceIndex": 138,
    "elementId": 1220285359,
    "hash": 5039,
    "material": "Material/matHardPlastic.mat",
    "texture": "Texture2D/hard_plastic.png",
    "textureUrl": "/assets/elements/hard_plastic.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      98,
      203,
      255,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2100
  },
  {
    "name": "Plywood",
    "substanceIndex": 139,
    "elementId": 663200452,
    "hash": 41668,
    "material": "Material/matManufacturedWood.mat",
    "texture": "Texture2D/wood.png",
    "textureUrl": "/assets/elements/wood.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      140,
      125,
      74,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 823.15
  },
  {
    "name": "Polluted Brine",
    "substanceIndex": 140,
    "elementId": -2044124200,
    "hash": 9176,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      54,
      67,
      62,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 247.65,
    "highTemp": 379.9
  },
  {
    "name": "Polluted Brine Ice",
    "substanceIndex": 141,
    "elementId": 1291367123,
    "hash": 45779,
    "material": "Material/matMurkyBrine.mat",
    "texture": "Texture2D/dirty_ice.png",
    "textureUrl": "/assets/elements/dirty_ice.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      87,
      99,
      95,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 247.65
  },
  {
    "name": "Polluted Dirt",
    "substanceIndex": 142,
    "elementId": 869554203,
    "hash": 22555,
    "material": "Material/matPollutedDirt.mat",
    "texture": "Texture2D/polluted_dirt.png",
    "textureUrl": "/assets/elements/polluted_dirt.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      255,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1986
  },
  {
    "name": "Polluted Ice",
    "substanceIndex": 143,
    "elementId": 1664334585,
    "hash": 47865,
    "material": "Material/matDirtyIce.mat",
    "texture": "Texture2D/dirty_ice.png",
    "textureUrl": "/assets/elements/dirty_ice.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      155,
      195,
      200,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 252.5
  },
  {
    "name": "Polluted Mud",
    "substanceIndex": 144,
    "elementId": 900133477,
    "hash": 62053,
    "material": "Material/matPollutedMud.mat",
    "texture": "Texture2D/polluted_sludge.png",
    "textureUrl": "/assets/elements/polluted_sludge.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      32,
      82,
      2,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 372.84
  },
  {
    "name": "Polluted Oxygen",
    "substanceIndex": 145,
    "elementId": 721531317,
    "hash": 45493,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      116,
      113,
      43,
      192
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 90.19,
    "highTemp": 10000
  },
  {
    "name": "Polluted Water",
    "substanceIndex": 146,
    "elementId": 1832607973,
    "hash": 24805,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      191,
      188,
      73,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 252.5,
    "highTemp": 392.5
  },
  {
    "name": "Propane Gas",
    "substanceIndex": 147,
    "elementId": -1858722091,
    "hash": 9941,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      39,
      94,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 231,
    "highTemp": 10000
  },
  {
    "name": "Pyrite",
    "substanceIndex": 148,
    "elementId": 2059777261,
    "hash": 46317,
    "material": "Material/matFoolsGold.mat",
    "texture": "Texture2D/fools_gold.png",
    "textureUrl": "/assets/elements/fools_gold.png",
    "shineMask": "Texture2D/fools_gold_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.99264705,
      0.9588206,
      0.6860943,
      0.272
    ],
    "colour": [
      167,
      142,
      52,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1357
  },
  {
    "name": "Refined Carbon",
    "substanceIndex": 149,
    "elementId": -902240476,
    "hash": 59172,
    "material": "Material/matCarbon.mat",
    "texture": "Texture2D/carbon.png",
    "textureUrl": "/assets/elements/carbon.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      89,
      89,
      89,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 4600
  },
  {
    "name": "Refined Phosphorus",
    "substanceIndex": 150,
    "elementId": -220394187,
    "hash": 3381,
    "material": "Material/matPhosphorus.mat",
    "texture": "Texture2D/phosphorus.png",
    "textureUrl": "/assets/elements/phosphorus.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      166,
      79,
      121,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 317.3
  },
  {
    "name": "Regolith",
    "substanceIndex": 151,
    "elementId": 1362238252,
    "hash": 6956,
    "material": "Material/matRegolith.mat",
    "texture": "Texture2D/regolith.png",
    "textureUrl": "/assets/elements/regolith.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      156,
      150,
      167,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Resin",
    "substanceIndex": 152,
    "elementId": 1244532348,
    "hash": 3708,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      204,
      139,
      24,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 293.15,
    "highTemp": 398.15
  },
  {
    "name": "Rock Gas",
    "substanceIndex": 153,
    "elementId": -432557516,
    "hash": 45620,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      140,
      127,
      126,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 2630,
    "highTemp": 10000
  },
  {
    "name": "Rubber",
    "substanceIndex": 154,
    "elementId": -351425712,
    "hash": 43856,
    "material": "Material/matRubber.mat",
    "texture": "Texture2D/rubber.png",
    "textureUrl": "/assets/elements/rubber.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      67,
      67,
      67,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 493.15
  },
  {
    "name": "Rust",
    "substanceIndex": 155,
    "elementId": -233232444,
    "hash": 10180,
    "material": "Material/matIronOxide.mat",
    "texture": "Texture2D/iron_oxide.png",
    "textureUrl": "/assets/elements/iron_oxide.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      122,
      73,
      62,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1808
  },
  {
    "name": "Salt",
    "substanceIndex": 156,
    "elementId": 381665462,
    "hash": 49334,
    "material": "Material/matSalt.mat",
    "texture": "Texture2D/salt.png",
    "textureUrl": "/assets/elements/salt.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      241,
      218,
      1
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1073
  },
  {
    "name": "Salt Gas",
    "substanceIndex": 157,
    "elementId": -1946026749,
    "hash": 64771,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      196,
      155,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 1738,
    "highTemp": 10000
  },
  {
    "name": "Salt Water",
    "substanceIndex": 158,
    "elementId": 1911997537,
    "hash": 50273,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      206,
      210,
      236,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 265.65,
    "highTemp": 372.84
  },
  {
    "name": "Sand",
    "substanceIndex": 159,
    "elementId": 381796644,
    "hash": 49444,
    "material": "Material/matSand.mat",
    "texture": "Texture2D/sand.png",
    "textureUrl": "/assets/elements/sand.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      214,
      181,
      148,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1986
  },
  {
    "name": "Sand Cement",
    "substanceIndex": 160,
    "elementId": -1038746460,
    "hash": 64676,
    "material": "Material/matSandCement.mat",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 6.9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      219,
      203,
      187,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1683
  },
  {
    "name": "Sandstone",
    "substanceIndex": 161,
    "elementId": 493438017,
    "hash": 17473,
    "material": "Material/matSandStone.mat",
    "texture": "Texture2D/sand_stone.png",
    "textureUrl": "/assets/elements/sand_stone.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      153,
      124,
      100,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1200
  },
  {
    "name": "Sap",
    "substanceIndex": 162,
    "elementId": -746800379,
    "hash": 47877,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      204,
      139,
      24,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 293.15,
    "highTemp": 398.15
  },
  {
    "name": "Sedimentary Rock",
    "substanceIndex": 163,
    "elementId": 183408504,
    "hash": 38776,
    "material": "Material/matSedimentaryRock.mat",
    "texture": "Texture2D/sedimentary_rock.png",
    "textureUrl": "/assets/elements/sedimentary_rock.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      109,
      119,
      140,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1200
  },
  {
    "name": "Shale",
    "substanceIndex": 164,
    "elementId": -1708952091,
    "hash": 30181,
    "material": "Material/matShale.mat",
    "texture": "Texture2D/shale.png",
    "textureUrl": "/assets/elements/shale.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      140,
      109,
      136,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1100
  },
  {
    "name": "Siltstone",
    "substanceIndex": 165,
    "elementId": -328791769,
    "hash": 2343,
    "material": "Material/matSiltStone.mat",
    "texture": "Texture2D/siltstone.png",
    "textureUrl": "/assets/elements/siltstone.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      173,
      152,
      110,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 1200
  },
  {
    "name": "Slime",
    "substanceIndex": 166,
    "elementId": -1153056158,
    "hash": 49762,
    "material": "Material/matSlimeMold.mat",
    "texture": "Texture2D/slime_mold.png",
    "textureUrl": "/assets/elements/slime_mold.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      86,
      113,
      40,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 398.15
  },
  {
    "name": "Snow",
    "substanceIndex": 167,
    "elementId": 489261827,
    "hash": 35587,
    "material": "Material/matSnow.mat",
    "texture": "Texture2D/snow.png",
    "textureUrl": "/assets/elements/snow.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      218,
      245,
      250,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 272.5
  },
  {
    "name": "Solid Carbon Dioxide",
    "substanceIndex": 168,
    "elementId": 83003332,
    "hash": 34756,
    "material": "Material/matSolidCarbonDioxide.mat",
    "texture": "Texture2D/solid_carbon_dioxide.png",
    "textureUrl": "/assets/elements/solid_carbon_dioxide.png",
    "shineMask": "",
    "worldUvScale": 7.5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      85,
      90,
      96,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 216.6
  },
  {
    "name": "Solid Chlorine",
    "substanceIndex": 169,
    "elementId": -690060127,
    "hash": 33953,
    "material": "Material/matSolidChlorine.mat",
    "texture": "Texture2D/solid_chlorine.png",
    "textureUrl": "/assets/elements/solid_chlorine.png",
    "shineMask": "",
    "worldUvScale": 5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      197,
      233,
      71,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 172.17
  },
  {
    "name": "Solid Crude Oil",
    "substanceIndex": 170,
    "elementId": -1224086026,
    "hash": 60918,
    "material": "Material/matFrozenCrudeOil.mat",
    "texture": "Texture2D/frozen_crude_oil.png",
    "textureUrl": "/assets/elements/frozen_crude_oil.png",
    "shineMask": "",
    "worldUvScale": 5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      19,
      19,
      19,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 233
  },
  {
    "name": "Solid Ethanol",
    "substanceIndex": 171,
    "elementId": 1937241528,
    "hash": 62904,
    "material": "Material/matSolidEthanol.mat",
    "texture": "Texture2D/ethanol.png",
    "textureUrl": "/assets/elements/ethanol.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      0,
      255,
      202,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 159.1
  },
  {
    "name": "Solid Gunk",
    "substanceIndex": 172,
    "elementId": -230085045,
    "hash": 11851,
    "material": "Material/matGunk.mat",
    "texture": "Texture2D/gunk.png",
    "textureUrl": "/assets/elements/gunk.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      81,
      35,
      96,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 265
  },
  {
    "name": "Solid Hydrogen",
    "substanceIndex": 173,
    "elementId": -858172533,
    "hash": 21387,
    "material": "Material/matSolidHydrogen.mat",
    "texture": "Texture2D/solid_hydrogen.png",
    "textureUrl": "/assets/elements/solid_hydrogen.png",
    "shineMask": "",
    "worldUvScale": 5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      161,
      56,
      132,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 14
  },
  {
    "name": "Solid Methane",
    "substanceIndex": 174,
    "elementId": 1183979137,
    "hash": 5761,
    "material": "Material/matSolidMethane.mat",
    "texture": "Texture2D/solid_methane.png",
    "textureUrl": "/assets/elements/solid_methane.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      227,
      154,
      68,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 90.55
  },
  {
    "name": "Solid Naphtha",
    "substanceIndex": 175,
    "elementId": -1112594153,
    "hash": 10519,
    "material": "Material/matWolframite.mat",
    "texture": "Texture2D/wolframite.png",
    "textureUrl": "/assets/elements/wolframite.png",
    "shineMask": "Texture2D/wolframite_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      204,
      204,
      204,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 223
  },
  {
    "name": "Solid Oxygen",
    "substanceIndex": 176,
    "elementId": 973502379,
    "hash": 30635,
    "material": "Material/matSolidOxygen.mat",
    "texture": "Texture2D/solid_oxygen.png",
    "textureUrl": "/assets/elements/solid_oxygen.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      120,
      200,
      195,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 54.36
  },
  {
    "name": "Solid Petroleum",
    "substanceIndex": 177,
    "elementId": -473261502,
    "hash": 39490,
    "material": "Material/matWolframite.mat",
    "texture": "Texture2D/wolframite.png",
    "textureUrl": "/assets/elements/wolframite.png",
    "shineMask": "Texture2D/wolframite_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      156,
      141,
      11,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 216
  },
  {
    "name": "Solid Propane",
    "substanceIndex": 178,
    "elementId": 166493482,
    "hash": 32042,
    "material": "Material/matSolidPropane.mat",
    "texture": "Texture2D/solid_propane.png",
    "textureUrl": "/assets/elements/solid_propane.png",
    "shineMask": "",
    "worldUvScale": 5,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      39,
      94,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 85
  },
  {
    "name": "Solid Resin",
    "substanceIndex": 179,
    "elementId": 1254083875,
    "hash": 52515,
    "material": "Material/matNaturalSolidResin.mat",
    "texture": "Texture2D/resin_solid.png",
    "textureUrl": "/assets/elements/resin_solid.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      156,
      95,
      18,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 293.15
  },
  {
    "name": "Solid Sap",
    "substanceIndex": 180,
    "elementId": 1376267226,
    "hash": 11226,
    "material": "Material/matSolidResin.mat",
    "texture": "Texture2D/resin_solid.png",
    "textureUrl": "/assets/elements/resin_solid.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      156,
      95,
      18,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 293.15
  },
  {
    "name": "Solid Super Coolant",
    "substanceIndex": 181,
    "elementId": -389019570,
    "hash": 2126,
    "material": "Material/matSolidSuperCoolant.mat",
    "texture": "Texture2D/super_coolant.png",
    "textureUrl": "/assets/elements/super_coolant.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      55,
      173,
      147,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2
  },
  {
    "name": "Solid Synthesis Gas",
    "substanceIndex": 182,
    "elementId": -690658692,
    "hash": 25212,
    "material": "Material/matSolidSyngas.mat",
    "texture": "Texture2D/solid_methane.png",
    "textureUrl": "/assets/elements/solid_methane.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9852941,
      0.87017655,
      0.7244809,
      0.272
    ],
    "colour": [
      255,
      112,
      69,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 14
  },
  {
    "name": "Solid Visco-Gel",
    "substanceIndex": 183,
    "elementId": -1495120499,
    "hash": 17805,
    "material": "Material/matSolidViscoGel.mat",
    "texture": "Texture2D/viscogel.png",
    "textureUrl": "/assets/elements/viscogel.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      79,
      16,
      183,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 242.5
  },
  {
    "name": "Sour Gas",
    "substanceIndex": 184,
    "elementId": -927923200,
    "hash": 1024,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      118,
      36,
      93,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 111.65,
    "highTemp": 10000
  },
  {
    "name": "Squid Ink",
    "substanceIndex": 185,
    "elementId": 874674022,
    "hash": 30566,
    "material": "Material/matInk.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      27,
      24,
      45,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": true,
    "state": "Liquid",
    "lowTemp": 252.5,
    "highTemp": 353.15
  },
  {
    "name": "Steam",
    "substanceIndex": 186,
    "elementId": -899515856,
    "hash": 31280,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      133,
      200,
      226,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 372.5,
    "highTemp": 10000
  },
  {
    "name": "Steel",
    "substanceIndex": 187,
    "elementId": -899253461,
    "hash": 31531,
    "material": "Material/matSteel.mat",
    "texture": "Texture2D/steel.png",
    "textureUrl": "/assets/elements/steel.png",
    "shineMask": "Texture2D/wolframite_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      91,
      121,
      143,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2700
  },
  {
    "name": "Steel Gas",
    "substanceIndex": 188,
    "elementId": -1406916018,
    "hash": 10830,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      56,
      33,
      25,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 4100,
    "highTemp": 10000
  },
  {
    "name": "Sucrose",
    "substanceIndex": 189,
    "elementId": -1960895024,
    "hash": 7632,
    "material": "Material/matSucrose.mat",
    "texture": "Texture2D/sucrose.png",
    "textureUrl": "/assets/elements/sucrose.png",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      229,
      255,
      218,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 459
  },
  {
    "name": "Sulfur",
    "substanceIndex": 190,
    "elementId": -729385479,
    "hash": 30201,
    "material": "Material/matSulfur.mat",
    "texture": "Texture2D/sulfur.png",
    "textureUrl": "/assets/elements/sulfur.png",
    "shineMask": "",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      255,
      0,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 388.35
  },
  {
    "name": "Sulfur Gas",
    "substanceIndex": 191,
    "elementId": -2120504832,
    "hash": 43520,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      255,
      0,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 610.15,
    "highTemp": 10000
  },
  {
    "name": "Super Coolant",
    "substanceIndex": 192,
    "elementId": -123825053,
    "hash": 37987,
    "material": "Material/matSuperCoolant.mat",
    "texture": "Texture2D/super_coolant.png",
    "textureUrl": "/assets/elements/super_coolant.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      55,
      173,
      147,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 2,
    "highTemp": 710
  },
  {
    "name": "Super Coolant Gas",
    "substanceIndex": 193,
    "elementId": -3376362,
    "hash": 31510,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      55,
      173,
      147,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 710,
    "highTemp": 10000
  },
  {
    "name": "Synthesis Gas",
    "substanceIndex": 194,
    "elementId": 1102028305,
    "hash": 40465,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      112,
      69,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 21,
    "highTemp": 10000
  },
  {
    "name": "Tallow",
    "substanceIndex": 195,
    "elementId": -1624652107,
    "hash": 50869,
    "material": "Material/matTallow.mat",
    "texture": "Texture2D/tallow.png",
    "textureUrl": "/assets/elements/tallow.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      255,
      227,
      0,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 353.15
  },
  {
    "name": "Thermium",
    "substanceIndex": 196,
    "elementId": 1559722904,
    "hash": 31640,
    "material": "Material/matTempConductor.mat",
    "texture": "Texture2D/temp_conductor.png",
    "textureUrl": "/assets/elements/temp_conductor.png",
    "shineMask": "Texture2D/temp_conductor_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      210,
      157,
      168,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 2950
  },
  {
    "name": "Tungsten",
    "substanceIndex": 197,
    "elementId": -1058835580,
    "hash": 29572,
    "material": "Material/matTungsten.mat",
    "texture": "Texture2D/tungsten.png",
    "textureUrl": "/assets/elements/tungsten.png",
    "shineMask": "Texture2D/fools_gold_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      123,
      126,
      132,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 3695
  },
  {
    "name": "Tungsten Gas",
    "substanceIndex": 198,
    "elementId": 431998133,
    "hash": 50357,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      56,
      33,
      25,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 6203,
    "highTemp": 10000
  },
  {
    "name": "Vacuum",
    "substanceIndex": 199,
    "elementId": 758759285,
    "hash": 49013,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      255,
      255,
      255,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Vacuum",
    "lowTemp": 0,
    "highTemp": 0
  },
  {
    "name": "Visco-Gel Fluid",
    "substanceIndex": 200,
    "elementId": -1683093854,
    "hash": 1698,
    "material": "Material/matViscoGel.mat",
    "texture": "Texture2D/viscogel.png",
    "textureUrl": "/assets/elements/viscogel.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      79,
      16,
      183,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 242.5,
    "highTemp": 753
  },
  {
    "name": "Void",
    "substanceIndex": 201,
    "elementId": -1456075980,
    "hash": 2868,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      225,
      220,
      139,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Vacuum",
    "lowTemp": 0,
    "highTemp": 0
  },
  {
    "name": "Water",
    "substanceIndex": 202,
    "elementId": 1836671383,
    "hash": 24983,
    "material": "Material/matWater.mat",
    "texture": "Texture2D/white.png",
    "textureUrl": "/assets/elements/white.png",
    "shineMask": "",
    "worldUvScale": 9,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.9485294,
      0.63107026,
      0.42544335,
      0.303
    ],
    "colour": [
      85,
      190,
      210,
      255
    ],
    "usesCaustics": true,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Liquid",
    "lowTemp": 272.5,
    "highTemp": 372.5
  },
  {
    "name": "Wolframite",
    "substanceIndex": 203,
    "elementId": -1208854194,
    "hash": 22862,
    "material": "Material/matWolframite.mat",
    "texture": "Texture2D/wolframite.png",
    "textureUrl": "/assets/elements/wolframite.png",
    "shineMask": "Texture2D/wolframite_mask.png",
    "worldUvScale": 7,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.8308824,
      0.83904666,
      1,
      0.303
    ],
    "colour": [
      164,
      182,
      186,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 3200
  },
  {
    "name": "Wood",
    "substanceIndex": 204,
    "elementId": 16214647,
    "hash": 27255,
    "material": "Material/matWood.mat",
    "texture": "Texture2D/wood.png",
    "textureUrl": "/assets/elements/wood.png",
    "shineMask": "",
    "worldUvScale": 10,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      1,
      1,
      1,
      1
    ],
    "colour": [
      140,
      107,
      74,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 873.15
  },
  {
    "name": "Zinc",
    "substanceIndex": 205,
    "elementId": 1617031780,
    "hash": 62052,
    "material": "Material/matZinc.mat",
    "texture": "Texture2D/zinc.png",
    "textureUrl": "/assets/elements/zinc.png",
    "shineMask": "Texture2D/zinc_mask.png",
    "worldUvScale": 6.5,
    "frequency": 0.05,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.5254902,
      1,
      0.7426625,
      0.272
    ],
    "colour": [
      30,
      170,
      170,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 692.65
  },
  {
    "name": "Zinc Gas",
    "substanceIndex": 206,
    "elementId": -1988727339,
    "hash": 28117,
    "material": "",
    "texture": "",
    "textureUrl": "",
    "shineMask": "",
    "worldUvScale": 8,
    "frequency": 0,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0,
      0,
      0,
      0
    ],
    "colour": [
      30,
      170,
      170,
      0
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Gas",
    "lowTemp": 1180,
    "highTemp": 10000
  },
  {
    "name": "Zinc Ore",
    "substanceIndex": 207,
    "elementId": -1921520130,
    "hash": 60926,
    "material": "Material/matZincOre.mat",
    "texture": "Texture2D/zinc_ore.png",
    "textureUrl": "/assets/elements/zinc_ore.png",
    "shineMask": "Texture2D/zinc_ore_spec.png",
    "worldUvScale": 7,
    "frequency": 1,
    "colourTint": [
      1,
      1,
      1,
      1
    ],
    "shineColour": [
      0.007843138,
      0.7254902,
      0.4627451,
      1
    ],
    "colour": [
      30,
      170,
      170,
      255
    ],
    "usesCaustics": false,
    "glows": false,
    "isOpaqueLiquid": false,
    "state": "Solid",
    "lowTemp": 0,
    "highTemp": 692.65
  }
] as const satisfies readonly OniSubstanceMaterial[]

export const ONI_SUBSTANCE_BY_HASH = new Map<number, OniSubstanceMaterial>(
  ONI_SUBSTANCE_MATERIALS.map((material) => [material.hash, material]),
)
