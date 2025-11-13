const ProductionOrderFlow = require('../utils/orderFlow');
const ProductionVolumeProfile = require('../utils/volumeProfile');
const ProductionLiquidity = require('../utils/liquidity');

jest.mock('../logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

describe('Integration Tests', () => {
  test('all modules can be imported', () => {
    expect(ProductionOrderFlow).toBeDefined();
    expect(ProductionVolumeProfile).toBeDefined();
    expect(ProductionLiquidity).toBeDefined();
  });

  test('all modules can be instantiated', () => {
    const orderFlow = new ProductionOrderFlow();
    const volumeProfile = new ProductionVolumeProfile();
    const liquidity = new ProductionLiquidity();

    expect(orderFlow).toBeInstanceOf(ProductionOrderFlow);
    expect(volumeProfile).toBeInstanceOf(ProductionVolumeProfile);
    expect(liquidity).toBeInstanceOf(ProductionLiquidity);
  });

  test('all modules work together', async () => {
    const orderFlow = new ProductionOrderFlow();
    const volumeProfile = new ProductionVolumeProfile();

    const swaps = Array(10).fill({
      amount0Out: '1000',
      amount0In: '0',
      amount1Out: '0.5'
    });

    const flowSignal = await orderFlow.getOrderFlowSignal(swaps);
    const profileSignal = await volumeProfile.getVolumeProfileSignal(200, swaps);

    expect(flowSignal.confidence).toBeGreaterThan(0);
    expect(profileSignal.confidence).toBeGreaterThan(0);
    expect(flowSignal.weight).toBe(0.20);
    expect(profileSignal.weight).toBe(0.18);
  });

  test('correct weight distribution', async () => {
    const orderFlow = new ProductionOrderFlow();
    const volumeProfile = new ProductionVolumeProfile();
    const liquidity = new ProductionLiquidity();

    const swaps = Array(10).fill({ amount0Out: '1000', amount0In: '0' });

    const flowSignal = await orderFlow.getOrderFlowSignal(swaps);
    const profileSignal = await volumeProfile.getVolumeProfileSignal(200, swaps);

    const totalWeight = flowSignal.weight + profileSignal.weight;

    // These 2 tools should be 38% (20% + 18%)
    expect(totalWeight).toBeCloseTo(0.38);
  });
});
