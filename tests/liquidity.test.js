const ProductionLiquidity = require('../utils/liquidity');

jest.mock('../logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

describe('ProductionLiquidity - Input Validation', () => {
  let liquidity;

  beforeEach(() => {
    liquidity = new ProductionLiquidity();
  });

  test('handles null contract gracefully', async () => {
    const result = await liquidity.getReserveRatio(null);
    expect(result.status).toBe('INVALID_CONTRACT');
  });

  test('handles contract without getReserves method', async () => {
    const badContract = { someOtherMethod: jest.fn() };
    const result = await liquidity.getReserveRatio(badContract);
    expect(result.status).toBe('INVALID_CONTRACT');
  });
});

describe('ProductionLiquidity - Reserve Validation', () => {
  let liquidity;

  beforeEach(() => {
    liquidity = new ProductionLiquidity({ minReserves: 1000 });
  });

  test('validates correct reserves', () => {
    const valid = liquidity.validateReserves(10000, 5000);
    expect(valid.isValid).toBe(true);
    expect(valid.status).toBe('VALID');
  });

  test('rejects zero reserves', () => {
    const invalid = liquidity.validateReserves(0, 5000);
    expect(invalid.isValid).toBe(false);
    expect(invalid.status).toBe('ZERO_RESERVES');
  });

  test('rejects negative reserves', () => {
    const invalid = liquidity.validateReserves(-100, 200);
    expect(invalid.isValid).toBe(false);
    expect(invalid.status).toBe('ZERO_RESERVES');
  });

  test('rejects insufficient reserves', () => {
    const invalid = liquidity.validateReserves(500, 500);
    expect(invalid.isValid).toBe(false);
    expect(invalid.status).toBe('INSUFFICIENT_RESERVES');
  });
});

describe('ProductionLiquidity - Confidence Scoring', () => {
  let liquidity;

  beforeEach(() => {
    liquidity = new ProductionLiquidity();
  });

  test('high confidence for large USDT additions', () => {
    const data = {
      status: 'SUCCESS',
      reserve0Change: 0.1,
      reserve1Change: 0,
      liquidityRatio: 0.5
    };
    const conf = liquidity.getConfidence(data);

    expect(conf.confidence).toBe(0.9);
    expect(conf.reasoning).toContain('Large USDT added');
  });

  test('low confidence for large BNB additions', () => {
    const data = {
      status: 'SUCCESS',
      reserve0Change: 0,
      reserve1Change: 0.1,
      liquidityRatio: 0.5
    };
    const conf = liquidity.getConfidence(data);

    expect(conf.confidence).toBe(0.1);
    expect(conf.reasoning).toContain('Large BNB added');
  });

  test('reduces confidence for poor data', () => {
    const conf = liquidity.getConfidence({ status: 'ERROR' });
    expect(conf.confidence).toBe(0.5);
    expect(conf.status).toBe('DEGRADED');
  });
});
