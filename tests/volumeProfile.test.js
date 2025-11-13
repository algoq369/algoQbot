const ProductionVolumeProfile = require('../utils/volumeProfile');

jest.mock('../logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

describe('ProductionVolumeProfile - Input Validation', () => {
  let volumeProfile;

  beforeEach(() => {
    volumeProfile = new ProductionVolumeProfile({ minSwapsForProfile: 2 });
  });

  test('handles null swaps gracefully', () => {
    const result = volumeProfile.buildProfile(null);
    expect(result.status).toBe('INVALID_INPUT');
  });

  test('handles undefined swaps gracefully', () => {
    const result = volumeProfile.buildProfile(undefined);
    expect(result.status).toBe('INVALID_INPUT');
  });

  test('handles empty array gracefully', () => {
    const result = volumeProfile.buildProfile([]);
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });

  test('handles insufficient swaps', () => {
    const fewSwaps = [
      { amount0In: '100', amount1Out: '0.5' },
      { amount0In: '200', amount1Out: '1.0' }
    ];
    const result = volumeProfile.buildProfile(fewSwaps);
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });

  test('handles malformed swap data', () => {
    const malformed = [
      { invalid: 'data' },
      { amount0In: 'not a number', amount1Out: '0.5' },
      { amount0In: '100', amount1Out: '0' }
    ];
    const result = volumeProfile.buildProfile(malformed);
    expect(result.status).toBe('NO_VALID_DATA');
  });
});

describe('ProductionVolumeProfile - Price Calculation', () => {
  let volumeProfile;

  beforeEach(() => {
    volumeProfile = new ProductionVolumeProfile({ minSwapsForProfile: 3 });
  });

  test('calculates price correctly from valid swaps', () => {
    const swaps = [
      { amount0In: '100', amount1Out: '0.5' },
      { amount0In: '200', amount1Out: '1.0' },
      { amount0In: '300', amount1Out: '1.5' }
    ];

    const result = volumeProfile.buildProfile(swaps);
    expect(result.status).toBe('SUCCESS');
    expect(result.poc).toBe(200);
    expect(result.totalLevels).toBe(1);
  });

  test('identifies correct Point of Control', () => {
    const swaps = [
      { amount0In: '100', amount1Out: '0.5' },
      { amount0In: '200', amount1Out: '0.5' },
      { amount0In: '150', amount1Out: '0.5' },
      { amount0In: '200', amount1Out: '0.5' }
    ];

    const result = volumeProfile.buildProfile(swaps);
    expect(result.poc).toBe(400);
    expect(result.maxVolume).toBe(400);
  });
});

describe('ProductionVolumeProfile - Confidence Scoring', () => {
  let volumeProfile;

  beforeEach(() => {
    volumeProfile = new ProductionVolumeProfile();
  });

  test('high confidence when price near POC', () => {
    const profileData = { status: 'SUCCESS', poc: 100 };
    const conf = volumeProfile.getConfidence(101, profileData);

    expect(conf.confidence).toBe(0.8);
    expect(conf.status).toBe('SUCCESS');
  });

  test('low confidence when price far from POC', () => {
    const profileData = { status: 'SUCCESS', poc: 100 };
    const conf = volumeProfile.getConfidence(110, profileData);

    expect(conf.confidence).toBe(0.3);
  });

  test('handles invalid profile data', () => {
    const conf = volumeProfile.getConfidence(100, { status: 'ERROR' });
    expect(conf.confidence).toBe(0.5);
    expect(conf.status).toBe('DEGRADED');
  });
});
