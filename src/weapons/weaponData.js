export const WEAPON_DATA = {
  carbine: {
    id: "carbine",
    label: "Carbine",
    slot: "Digit1",
    damage: 34,
    fireInterval: 0.12,
    magSize: 10,
    reserveAmmo: 50,
    reloadDuration: 2.2,
    recoil: {
      pitchStep: 0.018,
      yawJitter: 0.006,
    },
    audio: {
      reloadRate: 1,
      shootRate: 1,
    },
    viewModel: {
      holderPosition: [0.18, -0.22, -0.32],
      recoilStrength: 0.035,
      shootAnimationDuration: 0.22,
    },
  },
  handcannon: {
    id: "handcannon",
    label: "Handcannon",
    slot: "Digit2",
    damage: 61,
    fireInterval: 0.32,
    magSize: 6,
    reserveAmmo: 30,
    reloadDuration: 2.6,
    recoil: {
      pitchStep: 0.031,
      yawJitter: 0.011,
    },
    audio: {
      reloadRate: 0.92,
      shootRate: 0.84,
    },
    viewModel: {
      holderPosition: [0.22, -0.19, -0.28],
      recoilStrength: 0.058,
      shootAnimationDuration: 0.28,
    },
  },
};

export const WEAPON_ORDER = Object.values(WEAPON_DATA);
