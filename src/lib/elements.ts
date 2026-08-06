export type ElementState = 'solid' | 'liquid' | 'gas' | 'vacuum' | 'special'

export interface FluidMaterialStyle {
  gradientTop: string
  gradientBottom: string
  usesCaustics: boolean
  glows: boolean
  opaque: boolean
  flowSpeed: number
}

export interface ElementDefinition {
  hash: number
  name: string
  state: ElementState
  color: string
  texture?: string
  worldUvScale?: number
  /** Relative solid-material order used by ONI's shared GroundMasks layers. */
  terrainOrder?: number
  fluidMaterial?: FluidMaterialStyle
}

export interface ElementDefaultValues {
  temperature: number
  mass: number
}

export const ELEMENTS: ElementDefinition[] = [
  { hash: 0xbf75, name: '真空 Vacuum', state: 'vacuum', color: '#13191b' },
  { hash: 0x0b34, name: '虚空 Void', state: 'special', color: '#0c1011' },
  { hash: 0x6520, name: '藻类 Algae', state: 'solid', color: '#6e8d6c', texture: '/assets/elements/algae.png', worldUvScale: 8, terrainOrder: -1870043872 },
  { hash: 0xe826, name: '珍珠 Pearl', state: 'solid', color: '#d4d7c6', texture: '/assets/elements/pearl.png', worldUvScale: 8 },
  { hash: 0x4200, name: '铝 Aluminum', state: 'solid', color: '#afb9b8', texture: '/assets/elements/aluminum.png', worldUvScale: 8, terrainOrder: 2108244480 },
  { hash: 0x1362, name: '铝矿 Aluminum Ore', state: 'solid', color: '#9faeb1', texture: '/assets/elements/aluminum_ore.png', worldUvScale: 8, terrainOrder: 167973730 },
  { hash: 0xe963, name: '琥珀 Amber', state: 'solid', color: '#bd8450', texture: '/assets/elements/amber.png', worldUvScale: 8, terrainOrder: -1130501789 },
  { hash: 0x572e, name: '沥青 Bitumen', state: 'solid', color: '#4c4642', worldUvScale: 8 },
  { hash: 0xc39a, name: '漂白石 Bleach Stone', state: 'solid', color: '#a8b49a', texture: '/assets/elements/bleach_stone.png', worldUvScale: 8, terrainOrder: -839728230 },
  { hash: 0x9aed, name: '煤炭 Coal', state: 'solid', color: '#4e5050', texture: '/assets/elements/carbon.png', worldUvScale: 7, terrainOrder: 947100397 },
  { hash: 0x71e5, name: '碳纤维 Carbon Fiber', state: 'solid', color: '#3f4547', texture: '/assets/elements/carbon.png', worldUvScale: 7, terrainOrder: 118518245 },
  { hash: 0xb4b6, name: '陶瓷 Ceramic', state: 'solid', color: '#b7a18a', texture: '/assets/elements/ceramic.png', worldUvScale: 8, terrainOrder: -1467370314 },
  { hash: 0x5ca1, name: '粘土 Clay', state: 'solid', color: '#aa8068', texture: '/assets/elements/clay.png', worldUvScale: 8, terrainOrder: 867327137 },
  { hash: 0xb0d3, name: '钴 Cobalt', state: 'solid', color: '#718b9a', texture: '/assets/elements/cobalt_refined.png', worldUvScale: 8, terrainOrder: 108179667 },
  { hash: 0xd647, name: '钴矿 Cobalt Ore', state: 'solid', color: '#708c98', texture: '/assets/elements/cobalt_ore.png', worldUvScale: 8, terrainOrder: -1411918265 },
  { hash: 0x0219, name: '铜 Copper', state: 'solid', color: '#b8795b', texture: '/assets/elements/copper.png', worldUvScale: 8, terrainOrder: -1725038055 },
  { hash: 0x1751, name: '碎冰 Crushed Ice', state: 'solid', color: '#9cbabb', texture: '/assets/elements/crushed_ice.png', worldUvScale: 8, terrainOrder: -2123557039 },
  { hash: 0xcd9f, name: '碎岩 Crushed Rock', state: 'solid', color: '#807a70', texture: '/assets/elements/crushed_rock.png', worldUvScale: 8, terrainOrder: -1714565729 },
  { hash: 0xac06, name: '铜矿 Copper Ore', state: 'solid', color: '#a56751', texture: '/assets/elements/cuprite.png', worldUvScale: 8, terrainOrder: -1736594426 },
  { hash: 0xda4c, name: '贫铀 Depleted Uranium', state: 'solid', color: '#6f8176', texture: '/assets/elements/depleted_uranium.png', worldUvScale: 8, terrainOrder: 1064294988 },
  { hash: 0xc254, name: '钻石 Diamond', state: 'solid', color: '#a2c8c8', texture: '/assets/elements/diamond.png', worldUvScale: 8, terrainOrder: -2079931820 },
  { hash: 0x0307, name: '泥土 Dirt', state: 'solid', color: '#8e7661', texture: '/assets/elements/dirt.png', worldUvScale: 8, terrainOrder: 1624244999 },
  { hash: 0x6e42, name: '花岗岩 Granite', state: 'solid', color: '#777b79', texture: '/assets/elements/granite.png', worldUvScale: 10, terrainOrder: -105943486 },
  { hash: 0x4441, name: '砂岩 Sandstone', state: 'solid', color: '#b79b78', texture: '/assets/elements/sand_stone.png', worldUvScale: 10, terrainOrder: 493438017 },
  { hash: 0x85fd, name: '火成岩 Igneous Rock', state: 'solid', color: '#72736e', texture: '/assets/elements/igneous_rock.png', worldUvScale: 6.9, terrainOrder: -355957251 },
  { hash: 0x9778, name: '沉积岩 Sedimentary Rock', state: 'solid', color: '#8d806e', texture: '/assets/elements/sedimentary_rock.png', worldUvScale: 8, terrainOrder: 183408504 },
  { hash: 0x75e5, name: '页岩 Shale', state: 'solid', color: '#6e7776', texture: '/assets/elements/shale.png', worldUvScale: 8, terrainOrder: -1708952091 },
  { hash: 0xae31, name: '镁铁质岩 Mafic Rock', state: 'solid', color: '#70736b', texture: '/assets/elements/mafic_rock.png', worldUvScale: 8, terrainOrder: 1282846257 },
  { hash: 0xc124, name: '沙子 Sand', state: 'solid', color: '#c4ad7e', texture: '/assets/elements/sand.png', worldUvScale: 8, terrainOrder: 381796644 },
  { hash: 0xc0b6, name: '盐 Salt', state: 'solid', color: '#c5c3b4', texture: '/assets/elements/salt.png', worldUvScale: 8, terrainOrder: 381665462 },
  { hash: 0xc262, name: '菌泥 Slime', state: 'solid', color: '#839370', texture: '/assets/elements/slime_mold.png', worldUvScale: 8, terrainOrder: -1153056158 },
  { hash: 0x8b03, name: '雪 Snow', state: 'solid', color: '#c9d7d6', texture: '/assets/elements/snow.png', worldUvScale: 8, terrainOrder: 489261827 },
  { hash: 0x74ab, name: '冰 Ice', state: 'solid', color: '#a6c5c6', texture: '/assets/elements/ice.png', worldUvScale: 9, terrainOrder: 873952427 },
  { hash: 0xbaf9, name: '污染冰 Polluted Ice', state: 'solid', color: '#a8ad8e', texture: '/assets/elements/dirty_ice.png', worldUvScale: 9, terrainOrder: 1664334585 },
  { hash: 0x753b, name: '银金矿 Electrum', state: 'solid', color: '#c7a461', texture: '/assets/elements/electrum.png', worldUvScale: 8, terrainOrder: 28407099 },
  { hash: 0x8fd3, name: '浓缩铀 Enriched Uranium', state: 'solid', color: '#73896e', texture: '/assets/elements/enriched_uranium.png', worldUvScale: 8, terrainOrder: -348942381 },
  { hash: 0xa762, name: '肥料 Fertilizer', state: 'solid', color: '#8a795b', texture: '/assets/elements/fertilizer.png', worldUvScale: 8, terrainOrder: -1396791454 },
  { hash: 0xb4ed, name: '黄铁矿 Pyrite', state: 'solid', color: '#b59658', texture: '/assets/elements/fools_gold.png', worldUvScale: 8, terrainOrder: 2059777261 },
  { hash: 0xc78c, name: '化石 Fossil', state: 'solid', color: '#9b8e77', texture: '/assets/elements/fossil.png', worldUvScale: 8, terrainOrder: 1757792140 },
  { hash: 0x3f80, name: '富勒烯 Fullerene', state: 'solid', color: '#596164', texture: '/assets/elements/fullerene.png', worldUvScale: 8, terrainOrder: 245514112 },
  { hash: 0xd0c0, name: '金 Gold', state: 'solid', color: '#d6ad4f', texture: '/assets/elements/gold.png', worldUvScale: 8, terrainOrder: -279785280 },
  { hash: 0xab1c, name: '金汞齐 Gold Amalgam', state: 'solid', color: '#c9a95e', texture: '/assets/elements/gold_amalgam.png', worldUvScale: 8, terrainOrder: 361868060 },
  { hash: 0xa188, name: '铁 Iron', state: 'solid', color: '#8b817b', texture: '/assets/elements/iron.png', worldUvScale: 8, terrainOrder: 1306370440 },
  { hash: 0xd9da, name: '铁矿 Iron Ore', state: 'solid', color: '#8d7770', texture: '/assets/elements/hematite.png', worldUvScale: 8, terrainOrder: 1608833498 },
  { hash: 0xf0a0, name: '异构树液 Isosap', state: 'solid', color: '#a87877', texture: '/assets/elements/isoresin.png', worldUvScale: 8, terrainOrder: -2008682336 },
  { hash: 0x146e, name: '深渊晶石 Abyssalite', state: 'solid', color: '#7f8e9a', texture: '/assets/elements/katairite.png', worldUvScale: 8, terrainOrder: 1071649902 },
  { hash: 0x46bc, name: '铅 Lead', state: 'solid', color: '#5e6670', texture: '/assets/elements/lead.png', worldUvScale: 8, terrainOrder: -755153220 },
  { hash: 0xf1f3, name: '铌 Niobium', state: 'solid', color: '#827f83', texture: '/assets/elements/niobium.png', worldUvScale: 8, terrainOrder: -1779895821 },
  { hash: 0x04bb, name: '黑曜石 Obsidian', state: 'solid', color: '#343d43', texture: '/assets/elements/obsidian.png', worldUvScale: 8, terrainOrder: -474151749 },
  { hash: 0xadb5, name: '氧石 Oxylite', state: 'solid', color: '#819d88', texture: '/assets/elements/oxyrocks.png', worldUvScale: 8, terrainOrder: 1262005685 },
  { hash: 0x89c8, name: '泥炭 Peat', state: 'solid', color: '#62594e', texture: '/assets/elements/peat.png', worldUvScale: 8, terrainOrder: -1927771704 },
  { hash: 0x578a, name: '磷酸盐结晶 Phosphate Nodules', state: 'solid', color: '#a28d65', texture: '/assets/elements/phosphate_nodules.png', worldUvScale: 8, terrainOrder: -1901832310 },
  { hash: 0x86a3, name: '磷矿 Phosphorite', state: 'solid', color: '#9d9a6e', texture: '/assets/elements/phosphorite.png', worldUvScale: 8, terrainOrder: -877427037 },
  { hash: 0x0d35, name: '精炼磷 Refined Phosphorus', state: 'solid', color: '#d1c36b', texture: '/assets/elements/phosphorus.png', worldUvScale: 8, terrainOrder: -220394187 },
  { hash: 0x512c, name: '镭 Radium', state: 'solid', color: '#7e9b77', texture: '/assets/elements/radium.png', worldUvScale: 8, terrainOrder: -47820500 },
  { hash: 0x1b2c, name: '浮土 Regolith', state: 'solid', color: '#9e856b', texture: '/assets/elements/regolith.png', worldUvScale: 8, terrainOrder: 1362238252 },
  { hash: 0x7b2b, name: '钢 Steel', state: 'solid', color: '#727d83', texture: '/assets/elements/steel.png', worldUvScale: 8, terrainOrder: -899253461 },
  { hash: 0x75f9, name: '硫 Sulfur', state: 'solid', color: '#c0a64f', texture: '/assets/elements/sulfur.png', worldUvScale: 8, terrainOrder: -729385479 },
  { hash: 0x1180, name: '隔热质 Insulite', state: 'solid', color: '#756e66', texture: '/assets/elements/super_insulator.png', worldUvScale: 8, terrainOrder: -1713958528 },
  { hash: 0x581b, name: '污染土 Polluted Dirt', state: 'solid', color: '#777d5d', texture: '/assets/elements/polluted_dirt.png', worldUvScale: 8, terrainOrder: 869554203 },
  { hash: 0x7384, name: '钨 Tungsten', state: 'solid', color: '#71797d', texture: '/assets/elements/tungsten.png', worldUvScale: 8, terrainOrder: -1058835580 },
  { hash: 0x3d0b, name: '铀矿 Uranium Ore', state: 'solid', color: '#768c6f', texture: '/assets/elements/uranium.png', worldUvScale: 8, terrainOrder: 134298891 },
  { hash: 0x594e, name: '黑钨矿 Wolframite', state: 'solid', color: '#6b7373', texture: '/assets/elements/wolframite.png', worldUvScale: 8, terrainOrder: -1208854194 },
  { hash: 0x690c, name: '石墨 Graphite', state: 'solid', color: '#4d5354', texture: '/assets/elements/graphite.png', worldUvScale: 8, terrainOrder: 878995724 },
  { hash: 0x4b58, name: '朱砂矿 Cinnabar Ore', state: 'solid', color: '#a45b51', texture: '/assets/elements/cinnabar.png', worldUvScale: 8, terrainOrder: 1875790680 },
  { hash: 0x6a77, name: '木材 Wood', state: 'solid', color: '#927052', texture: '/assets/elements/wood.png', worldUvScale: 8, terrainOrder: 16214647 },
  { hash: 0xa2c4, name: '胶合板 Plywood', state: 'solid', color: '#9a7655', texture: '/assets/elements/wood.png', worldUvScale: 8, terrainOrder: 663200452 },
  { hash: 0xce58, name: '镍矿 Nickel Ore', state: 'solid', color: '#8c8880', texture: '/assets/elements/nickel_ore.png', worldUvScale: 8, terrainOrder: 1387581016 },
  { hash: 0x0e8a, name: '镍 Nickel', state: 'solid', color: '#8f9999', texture: '/assets/elements/nickel.png', worldUvScale: 8, terrainOrder: -1774383478 },
  { hash: 0x1c1d, name: '铱 Iridium', state: 'solid', color: '#777a7e', texture: '/assets/elements/iridium.png', worldUvScale: 8, terrainOrder: -198894563 },
  { hash: 0x2bda, name: '固态树液 Solid Sap', state: 'solid', color: '#a8795e', texture: '/assets/elements/resin_solid.png', worldUvScale: 8, terrainOrder: 1376267226 },
  { hash: 0xcd23, name: '固态树脂 Solid Resin', state: 'solid', color: '#a8795e', texture: '/assets/elements/resin_solid.png', worldUvScale: 8, terrainOrder: 1254083875 },
  { hash: 0x458d, name: '固态粘性凝胶 Solid Visco-Gel', state: 'solid', color: '#8eb7b4', texture: '/assets/elements/viscogel.png', worldUvScale: 8, terrainOrder: -1495120499 },
  { hash: 0x87c4, name: '固态二氧化碳 Solid Carbon Dioxide', state: 'solid', color: '#acb6b7', texture: '/assets/elements/solid_carbon_dioxide.png', worldUvScale: 8, terrainOrder: 83003332 },
  { hash: 0x84a1, name: '固态氯 Solid Chlorine', state: 'solid', color: '#a3ad79', texture: '/assets/elements/solid_chlorine.png', worldUvScale: 8, terrainOrder: -690060127 },
  { hash: 0x538b, name: '固态氢 Solid Hydrogen', state: 'solid', color: '#bfd0d4', texture: '/assets/elements/solid_hydrogen.png', worldUvScale: 8, terrainOrder: -858172533 },
  { hash: 0x7be8, name: '固态汞 Mercury', state: 'solid', color: '#85898e', texture: '/assets/elements/solid_mercury.png', worldUvScale: 8, terrainOrder: -537625624 },
  { hash: 0x1681, name: '固态甲烷 Solid Methane', state: 'solid', color: '#a8a7a1', texture: '/assets/elements/solid_methane.png', worldUvScale: 8, terrainOrder: 1183979137 },
  { hash: 0x77ab, name: '固态氧 Solid Oxygen', state: 'solid', color: '#8baabd', texture: '/assets/elements/solid_oxygen.png', worldUvScale: 8, terrainOrder: 973502379 },
  { hash: 0x7d2a, name: '固态丙烷 Solid Propane', state: 'solid', color: '#adb2ad', texture: '/assets/elements/solid_propane.png', worldUvScale: 8, terrainOrder: 166493482 },
  { hash: 0xc821, name: '红砖 Brick', state: 'solid', color: '#9f7764', texture: '/assets/elements/ceramic.png', worldUvScale: 8, terrainOrder: -325269471 },
  { hash: 0xc5db, name: '浓盐冰 Brine Ice', state: 'solid', color: '#9eafb0', texture: '/assets/elements/frozen_brine.png', worldUvScale: 9, terrainOrder: -1561279013 },
  { hash: 0x87b5, name: '石灰 Lime', state: 'solid', color: '#b7b5a6', texture: '/assets/elements/limestone.png', worldUvScale: 8, terrainOrder: -721320011 },
  { hash: 0x27c4, name: '铁锈 Rust', state: 'solid', color: '#946b57', texture: '/assets/elements/iron_oxide.png', worldUvScale: 8, terrainOrder: -233232444 },
  { hash: 0xb71c, name: '泥巴 Mud', state: 'solid', color: '#7c6d59', texture: '/assets/elements/sludge.png', worldUvScale: 8, terrainOrder: 908179228 },
  { hash: 0xf265, name: '污染泥 Polluted Mud', state: 'solid', color: '#777d5d', texture: '/assets/elements/polluted_sludge.png', worldUvScale: 8, terrainOrder: 900133477 },
  { hash: 0xd7bf, name: '固态核废料 Solid Nuclear Waste', state: 'solid', color: '#7d8d68', texture: '/assets/elements/uranium.png', worldUvScale: 8, terrainOrder: -497625153 },
  { hash: 0x67ae, name: '凝冻粘蛋白 Frozen Mucin', state: 'solid', color: '#78836d', texture: '/assets/elements/mucus.png', worldUvScale: 8, terrainOrder: -553490514 },
  { hash: 0x058c, name: '中子质 Neutronium', state: 'solid', color: '#8d9092', texture: '/assets/elements/neutronium.png', worldUvScale: 8, terrainOrder: 1838482828 },
  { hash: 0x344c, name: '壳灰岩 Coquina', state: 'solid', color: '#aea18a', texture: '/assets/elements/coquina.png', worldUvScale: 8, terrainOrder: -487705524 },
  { hash: 0x0927, name: '粉砂岩 Siltstone', state: 'solid', color: '#978777', texture: '/assets/elements/siltstone.png', worldUvScale: 8, terrainOrder: -328791769 },
  { hash: 0xfa35, name: '玄武岩 Basalt', state: 'solid', color: '#646967', texture: '/assets/elements/basalt.png', worldUvScale: 8, terrainOrder: 1347222069 },
  { hash: 0x469c, name: '玻璃 Glass', state: 'solid', color: '#b8d9d3', texture: '/assets/elements/diamond.png', worldUvScale: 8, terrainOrder: 623986332 },
  { hash: 0x3afb, name: '堆芯熔融物 Corium', state: 'solid', color: '#7a815f', texture: '/assets/elements/corium.png', worldUvScale: 8, terrainOrder: -220644613 },
  { hash: 0x13af, name: '塑料质 Plastium', state: 'solid', color: '#8c98a0', texture: '/assets/elements/hard_plastic.png', worldUvScale: 8, terrainOrder: 1220285359 },
  { hash: 0x41da, name: '塑料 Plastic', state: 'solid', color: '#84959b', texture: '/assets/elements/plastic.png', worldUvScale: 8, terrainOrder: -1142341158 },
  { hash: 0xe724, name: '精炼碳 Refined Carbon', state: 'solid', color: '#454b4e', texture: '/assets/elements/carbon.png', worldUvScale: 7, terrainOrder: -902240476 },
  { hash: 0x2e4b, name: '固态粘渣油 Solid Gunk', state: 'solid', color: '#6b4b77', texture: '/assets/elements/gunk.png', worldUvScale: 8, terrainOrder: -230085045 },
  { hash: 0x1dd0, name: '蔗糖 Sucrose', state: 'solid', color: '#d9e4ba', texture: '/assets/elements/sucrose.png', worldUvScale: 8, terrainOrder: -1960895024 },
  { hash: 0xc6b5, name: '动物油脂 Tallow', state: 'solid', color: '#d1b34d', texture: '/assets/elements/tallow.png', worldUvScale: 8, terrainOrder: -1624652107 },
  { hash: 0x7b98, name: '导热质 Thermium', state: 'solid', color: '#a4a9aa', texture: '/assets/elements/temp_conductor.png', worldUvScale: 8, terrainOrder: 1559722904 },
  { hash: 0xedfe, name: '锌矿 Zinc Ore', state: 'solid', color: '#738b91', texture: '/assets/elements/zinc_ore.png', worldUvScale: 8, terrainOrder: -1921520130 },
  { hash: 0xf264, name: '锌 Zinc', state: 'solid', color: '#8ca0a3', texture: '/assets/elements/zinc.png', worldUvScale: 8, terrainOrder: 1617031780 },
  { hash: 0x38a6, name: '珊瑚质 Corallium', state: 'solid', color: '#bb8873', texture: '/assets/elements/corallium.png', worldUvScale: 8, terrainOrder: -1705953114 },
  { hash: 0x79df, name: '粘胶木材 Gum Wood', state: 'solid', color: '#947454', texture: '/assets/elements/palmwood.png', worldUvScale: 8, terrainOrder: -1675462177 },
  { hash: 0xb702, name: '苔藓 Moss', state: 'solid', color: '#78936d', texture: '/assets/elements/moss.png', worldUvScale: 8, terrainOrder: 109229826 },
  { hash: 0x12f0, name: '石灰岩 Limestone', state: 'solid', color: '#aaa9a0', texture: '/assets/elements/limestone.png', worldUvScale: 8, terrainOrder: -1337715984 },
  { hash: 0xb2d3, name: '污染浓盐冰 Polluted Brine Ice', state: 'solid', color: '#8f9994', texture: '/assets/elements/frozen_brine.png', worldUvScale: 9, terrainOrder: 1291367123 },
  { hash: 0x69a6, name: '方铅矿 Galena', state: 'solid', color: '#697073', texture: '/assets/elements/galena.png', worldUvScale: 8, terrainOrder: 2071292326 },
  { hash: 0x0e7e, name: '紧压雪 Packed Snow', state: 'solid', color: '#c9d7d6', texture: '/assets/elements/snow.png', worldUvScale: 8, terrainOrder: 1542131326 },
  { hash: 0xe42d, name: '气凝胶 Aerogel', state: 'solid', color: '#9aa8a8', texture: '/assets/elements/algae.png', worldUvScale: 8 },
  { hash: 0x38b0, name: '凝冻咸乳 Frozen Brackene', state: 'solid', color: '#d6e2dc', texture: '/assets/elements/milk.png', worldUvScale: 8 },
  { hash: 0x55f8, name: '凝冻卵浆 Frozen Ovolene', state: 'solid', color: '#d6e2dc', texture: '/assets/elements/milk.png', worldUvScale: 8 },
  { hash: 0x3180, name: '水泥 Cement', state: 'solid', color: '#8d8c82', worldUvScale: 8 },
  { hash: 0xa2bc, name: '水泥混合料 Cement Mix', state: 'solid', color: '#948d7f', worldUvScale: 8 },
  { hash: 0xce56, name: '凝冻植物润滑油 Frozen Phyto Oil', state: 'solid', color: '#7f875d', texture: '/assets/elements/frozen_phyto_oil.png', worldUvScale: 8 },
  { hash: 0x4246, name: '凝冻鱿鱼墨汁 Frozen Squid Ink', state: 'solid', color: '#4e6468', texture: '/assets/elements/ink_frozen.png', worldUvScale: 8 },
  { hash: 0x09be, name: '咸乳蜡 Brackwax', state: 'solid', color: '#d0ae55', texture: '/assets/elements/milkfat.png', worldUvScale: 8 },
  { hash: 0xab50, name: '橡胶 Rubber', state: 'solid', color: '#494543', texture: '/assets/elements/rubber.png', worldUvScale: 8 },
  { hash: 0xfca4, name: '砂水泥 Sand Cement', state: 'solid', color: '#aaa08a', worldUvScale: 8 },
  { hash: 0xb679, name: '建筑板材 Building Slab', state: 'solid', color: '#85837b', worldUvScale: 8 },
  { hash: 0xedf6, name: '固态原油 Solid Crude Oil', state: 'solid', color: '#4d4841', texture: '/assets/elements/frozen_crude_oil.png', worldUvScale: 8 },
  { hash: 0x2917, name: '固态石脑油 Solid Naphtha', state: 'solid', color: '#5d5045', worldUvScale: 8 },
  { hash: 0x9a42, name: '固态石油 Solid Petroleum', state: 'solid', color: '#514846', worldUvScale: 8 },
  { hash: 0x084e, name: '固态超级冷却剂 Solid Super Coolant', state: 'solid', color: '#8caeb7', texture: '/assets/elements/super_coolant.png', worldUvScale: 8 },
  { hash: 0x696c, name: '黄饼 Yellowcake', state: 'solid', color: '#9d874f', worldUvScale: 8 },
  { hash: 0xf5b8, name: '固态乙醇 Solid Ethanol', state: 'solid', color: '#c2d1d0', texture: '/assets/elements/ethanol.png', worldUvScale: 8 },
  { hash: 0x627c, name: '固态合成气 Solid Synthesis Gas', state: 'solid', color: '#78817d', texture: '/assets/elements/solid_methane.png', worldUvScale: 8 },
  { hash: 0xb340, name: '氧气 Oxygen', state: 'gas', color: '#2ec0e7', fluidMaterial: { gradientTop: '#2ec0e7', gradientBottom: '#2ec0e7', usesCaustics: false, glows: false, opaque: false, flowSpeed: .42 } },
  { hash: 0xb1b5, name: '污染氧 Polluted Oxygen', state: 'gas', color: '#74712b', fluidMaterial: { gradientTop: '#74712b', gradientBottom: '#74712b', usesCaustics: false, glows: false, opaque: false, flowSpeed: .31 } },
  { hash: 0x00ef, name: '二氧化碳 Carbon Dioxide', state: 'gas', color: '#1e1e1e', fluidMaterial: { gradientTop: '#1e1e1e', gradientBottom: '#1e1e1e', usesCaustics: false, glows: false, opaque: false, flowSpeed: .24 } },
  { hash: 0xc02c, name: '天然气 Natural Gas', state: 'gas', color: '#ff6e0f', fluidMaterial: { gradientTop: '#ff6e0f', gradientBottom: '#ff6e0f', usesCaustics: false, glows: false, opaque: false, flowSpeed: .58 } },
  { hash: 0x14a0, name: '氢气 Hydrogen Gas', state: 'gas', color: '#e9638d', fluidMaterial: { gradientTop: '#e9638d', gradientBottom: '#e9638d', usesCaustics: false, glows: false, opaque: false, flowSpeed: .68 } },
  { hash: 0x3803, name: '氯气 Chlorine Gas', state: 'gas', color: '#95db5c', fluidMaterial: { gradientTop: '#95db5c', gradientBottom: '#95db5c', usesCaustics: false, glows: false, opaque: false, flowSpeed: .36 } },
  { hash: 0x7a30, name: '蒸汽 Steam', state: 'gas', color: '#85c8e2', fluidMaterial: { gradientTop: '#85c8e2', gradientBottom: '#85c8e2', usesCaustics: false, glows: false, opaque: false, flowSpeed: .76 } },
  { hash: 0x6197, name: '水 Water', state: 'liquid', color: '#55bed2', fluidMaterial: { gradientTop: '#3da4b4', gradientBottom: '#1d828d', usesCaustics: true, glows: false, opaque: false, flowSpeed: .8 } },
  { hash: 0x60e5, name: '污染水 Polluted Water', state: 'liquid', color: '#bfbc49', fluidMaterial: { gradientTop: '#ccc84b', gradientBottom: '#82a84a', usesCaustics: false, glows: false, opaque: false, flowSpeed: .56 } },
  { hash: 0xc461, name: '盐水 Salt Water', state: 'liquid', color: '#ced2ec', fluidMaterial: { gradientTop: '#3da4b4', gradientBottom: '#1d828d', usesCaustics: true, glows: false, opaque: false, flowSpeed: .72 } },
  { hash: 0xcad0, name: '浓盐水 Brine', state: 'liquid', color: '#ffffff', fluidMaterial: { gradientTop: '#edffff', gradientBottom: '#ffffff', usesCaustics: false, glows: false, opaque: false, flowSpeed: .46 } },
  { hash: 0x45b6, name: '液态氯 Liquid Chlorine', state: 'liquid', color: '#91e542', fluidMaterial: { gradientTop: '#aae542', gradientBottom: '#91e542', usesCaustics: true, glows: false, opaque: false, flowSpeed: .62 } },
  { hash: 0x4173, name: '液态二氧化碳 Liquid Carbon Dioxide', state: 'liquid', color: '#0d0d0d', fluidMaterial: { gradientTop: '#2d2d2d', gradientBottom: '#222222', usesCaustics: true, glows: false, opaque: false, flowSpeed: .28 } },
  { hash: 0xaf0b, name: '原油 Crude Oil', state: 'liquid', color: '#000000', fluidMaterial: { gradientTop: '#000b18', gradientBottom: '#000000', usesCaustics: true, glows: false, opaque: true, flowSpeed: .2 } },
  { hash: 0x1e6d, name: '石油 Petroleum', state: 'liquid', color: '#ffc325', fluidMaterial: { gradientTop: '#ffc93c', gradientBottom: '#ffc325', usesCaustics: true, glows: false, opaque: false, flowSpeed: .34 } },
  { hash: 0x63d4, name: '液态核废料 Liquid Nuclear Waste', state: 'liquid', color: '#91dd5b', fluidMaterial: { gradientTop: '#9dff25', gradientBottom: '#6bbf30', usesCaustics: false, glows: true, opaque: false, flowSpeed: .52 } },
  { hash: 0xe3e7, name: '岩浆 Magma', state: 'liquid', color: '#ff1a00', fluidMaterial: { gradientTop: '#ff5800', gradientBottom: '#ff1a00', usesCaustics: false, glows: true, opaque: true, flowSpeed: .44 } },
]

const ELEMENT_BY_HASH = new Map(ELEMENTS.map((element) => [element.hash, element]))

export function elementForHash(hash: number): ElementDefinition {
  return ELEMENT_BY_HASH.get(hash) ?? {
    hash,
    name: `未知元素 0x${hash.toString(16).padStart(4, '0')}`,
    state: 'special',
    color: `hsl(${(hash * 37) % 360} 24% 43%)`,
  }
}

export function elementOptions(currentHash?: number): ElementDefinition[] {
  if (currentHash === undefined || ELEMENT_BY_HASH.has(currentHash)) return ELEMENTS
  return [elementForHash(currentHash), ...ELEMENTS]
}

export function defaultElementValues(hash: number): ElementDefaultValues {
  const element = elementForHash(hash)
  if (element.state === 'vacuum' || element.state === 'special') return { temperature: 0, mass: 0 }
  return {
    temperature: 293.15,
    mass: element.state === 'gas' ? 1 : 1000,
  }
}

export function formatHash(hash: number): string {
  return `0x${hash.toString(16).padStart(4, '0')}`
}
