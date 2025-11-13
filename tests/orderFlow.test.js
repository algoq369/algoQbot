const ProductionOrderFlow = require('../utils/orderFlow');

jest.mock('../logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

describe('ProductionOrderFlow - Input Validation', () => {
  let orderFlow;

  beforeEach(() => {
    orderFlow = new ProductionOrderFlow({ minSwapsForSignal: 2 });
  });

  test('handles null swap events gracefully', () => {
    const result = orderFlow.calculateDelta(null);
    expect(result.status).toBe('INVALID_INPUT');
    expect(result.confidence).toBe(0.5);
  });

  test('handles undefined swap events gracefully', () => {
    const result = orderFlow.calculateDelta(undefined);
    expect(result.status).toBe('INVALID_INPUT');
  });

  test('handles empty array gracefully', () => {
    const result = orderFlow.calculateDelta([]);
    expect(result.status).toBe('EMPTY_DATA');
  });

  test('handles malformed swap objects', () => {
    const malformed = [
      { invalid: 'data' },
      { random: 'fields' },
      { amount0Out: 'not a number' },
      { amount0In: NaN }
    ];
    const result = orderFlow.calculateDelta(malformed);
    expect(result.malformedSwaps).toBeGreaterThan(0);
  });

  test('handles mixed valid and invalid swaps', () => {
    const mixed = [
      { amount0Out: '1000', amount0In: '0' },
      null,
      { invalid: 'data' },
      { amount0Out: '500', amount0In: '0' }
    ];
    const result = orderFlow.calculateDelta(mixed);
    expect(result.validSwaps).toBe(2);
    expect(result.malformedSwaps).toBe(2);
  });

  test('handles insufficient valid swaps', () => {
    const few = [
      { amount0Out: '100', amount0In: '0' },
      { amount0Out: '200', amount0In: '0' }
    ];
    const result = orderFlow.calculateDelta(few);
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });

  test('handles negative values gracefully', () => {
    const negative = [
      { amount0Out: '-1000', amount0In: '0' },
      { amount0Out: '0', amount0In: '-500' }
    ];
    const result = orderFlow.calculateDelta(negative);
    expect(result.validSwaps).toBe(0);
  });

  test('handles string numbers correctly', () => {
    const stringNums = Array(10).fill({ amount0Out: '1000', amount0In: '0' });
    const result = orderFlow.calculateDelta(stringNums);
    expect(result.validSwaps).toBeGreaterThan(0);
    expect(result.status).toBe('SUCCESS');
  });
});

describe('ProductionOrderFlow - Delta Calculation', () => {
  let orderFlow;

  beforeEach(() => {
    orderFlow = new ProductionOrderFlow({ minSwapsForSignal: 2 });
  });

  test('calculates pure buy pressure correctly', () => {
    const buySwaps = Array(10).fill({ amount0Out: '1000', amount0In: '0' });
    const result = orderFlow.calculateDelta(buySwaps);

    expect(result.buyVolume).toBe(10000);
    expect(result.sellVolume).toBe(0);
    expect(result.delta).toBe(10000);
    expect(result.deltaPercent).toBe(1.0);
    expect(result.status).toBe('SUCCESS');
  });

  test('calculates pure sell pressure correctly', () => {
    const sellSwaps = Array(10).fill({ amount0Out: '0', amount0In: '1000' });
    const result = orderFlow.calculateDelta(sellSwaps);

    expect(result.buyVolume).toBe(0);
    expect(result.sellVolume).toBe(10000);
    expect(result.delta).toBe(-10000);
    expect(result.deltaPercent).toBe(-1.0);
  });

  test('calculates balanced pressure correctly', () => {
    const balanced = [
      ...Array(5).fill({ amount0Out: '1000', amount0In: '0' }),
      ...Array(5).fill({ amount0Out: '0', amount0In: '1000' })
    ];
    const result = orderFlow.calculateDelta(balanced);

    expect(result.buyVolume).toBe(5000);
    expect(result.sellVolume).toBe(5000);
    expect(result.delta).toBe(0);
    expect(result.deltaPercent).toBeCloseTo(0);
  });

  test('calculates 60/40 buy pressure correctly', () => {
    const buyBiased = [
      ...Array(6).fill({ amount0Out: '1000', amount0In: '0' }),
      ...Array(4).fill({ amount0Out: '0', amount0In: '1000' })
    ];
    const result = orderFlow.calculateDelta(buyBiased);
    expect(result.deltaPercent).toBeCloseTo(0.2);
  });
});

describe('ProductionOrderFlow - Confidence Scoring', () => {
  let orderFlow;

  beforeEach(() => {
    orderFlow = new ProductionOrderFlow();
  });

  test('assigns strong buy confidence for >15% delta', () => {
    const conf = orderFlow.getConfidence(0.20);
    expect(conf.confidence).toBe(0.9);
    expect(conf.status).toBe('SUCCESS');
  });

  test('assigns moderate buy confidence for 5-15% delta', () => {
    const conf = orderFlow.getConfidence(0.10);
    expect(conf.confidence).toBe(0.7);
  });

  test('assigns neutral confidence for small delta', () => {
    const conf = orderFlow.getConfidence(0.02);
    expect(conf.confidence).toBe(0.5);
  });

  test('assigns moderate sell confidence for -5 to -15% delta', () => {
    const conf = orderFlow.getConfidence(-0.10);
    expect(conf.confidence).toBe(0.3);
  });

  test('assigns strong sell confidence for <-15% delta', () => {
    const conf = orderFlow.getConfidence(-0.20);
    expect(conf.confidence).toBe(0.1);
  });

  test('handles invalid delta gracefully', () => {
    const conf = orderFlow.getConfidence(NaN);
    expect(conf.confidence).toBe(0.5);
    expect(conf.status).toBe('ERROR');
  });

  test('reduces confidence for poor data quality', () => {
    const conf = orderFlow.getConfidence(0.20, 'POOR_QUALITY');
    expect(conf.confidence).toBe(0.5);
    expect(conf.status).toBe('DEGRADED');
  });
});

describe('ProductionOrderFlow - Integration', () => {
  let orderFlow;

  beforeEach(() => {
    orderFlow = new ProductionOrderFlow({ minSwapsForSignal: 2 });
  });

  test('getOrderFlowSignal returns complete signal object', async () => {
    const swaps = Array(10).fill({ amount0Out: '1000', amount0In: '0' });
    const signal = await orderFlow.getOrderFlowSignal(swaps);

    expect(signal).toHaveProperty('confidence');
    expect(signal).toHaveProperty('data');
    expect(signal).toHaveProperty('weight');
    expect(signal).toHaveProperty('reasoning');
    expect(signal).toHaveProperty('status');
    expect(signal.weight).toBe(0.20);
  });

  test('getOrderFlowSignal handles errors gracefully', async () => {
    const signal = await orderFlow.getOrderFlowSignal(null);

    expect(signal.status).toBe('DEGRADED');
    expect(signal.confidence).toBe(0.5);
    expect(signal.weight).toBe(0.20);
  });
});
