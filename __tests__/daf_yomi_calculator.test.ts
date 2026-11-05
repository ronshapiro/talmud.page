import {
  MASECHTOT,
  TOTAL_DAYS,
  DEFAULT_KNOWN_PAIR,
  getDafIndex,
  getDafFromIndex,
  daysBetween,
  getLocalDateString,
  deduceTargetDaf,
  masechetMatches,
} from '../js/daf_yomi_calculator';

describe('daf_yomi_calculator', () => {
  test('total days in cycle sum to 2711', () => {
    const calculatedTotalDays = MASECHTOT.reduce(
      (accumulator, masechet) => accumulator + (masechet.end - masechet.start + 1),
      0,
    );
    expect(calculatedTotalDays).toBe(2711);
    expect(TOTAL_DAYS).toBe(2711);
  });

  test('masechet matching handles casing and aliases', () => {
    expect(masechetMatches('Berakhot', 'berakhot')).toBe(true);
    expect(masechetMatches('Rosh Hashanah', 'Rosh Hashana')).toBe(true);
    expect(masechetMatches('Rosh Hashana', 'Rosh Hashanah')).toBe(true);
    expect(masechetMatches('Bava Kamma', 'bava kamma')).toBe(true);
    expect(masechetMatches('Shekalim', 'Shabbat')).toBe(false);
  });

  test('getDafIndex returns expected indices for key milestones', () => {
    expect(getDafIndex('Berakhot', 2)).toBe(0);
    expect(getDafIndex('Berakhot', 64)).toBe(62);
    expect(getDafIndex('Shabbat', 2)).toBe(63);
    expect(getDafIndex('Bekhorot', 48)).toBe(2496);
    expect(getDafIndex('Niddah', 73)).toBe(2710);
    expect(getDafIndex('NonexistentTractate', 2)).toBe(-1);
  });

  test('getDafFromIndex returns correct masechet and daf for cycle positions', () => {
    expect(getDafFromIndex(0)).toEqual({ masechet: 'Berakhot', daf: 2 });
    expect(getDafFromIndex(62)).toEqual({ masechet: 'Berakhot', daf: 64 });
    expect(getDafFromIndex(63)).toEqual({ masechet: 'Shabbat', daf: 2 });
    expect(getDafFromIndex(2496)).toEqual({ masechet: 'Bekhorot', daf: 48 });
    expect(getDafFromIndex(2710)).toEqual({ masechet: 'Niddah', daf: 73 });
    // Cycle wrap around
    expect(getDafFromIndex(2711)).toEqual({ masechet: 'Berakhot', daf: 2 });
    expect(getDafFromIndex(2712)).toEqual({ masechet: 'Berakhot', daf: 3 });
  });

  test('daysBetween correctly calculates calendar day differences', () => {
    expect(daysBetween('2026-11-05', '2026-11-05')).toBe(0);
    expect(daysBetween('2026-11-05', '2026-11-06')).toBe(1);
    expect(daysBetween('2026-11-06', '2026-11-05')).toBe(-1);
    // Leap year handling
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    // Non-leap year handling
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
    // Known span between cycle 14 start and 2026-11-05
    expect(daysBetween('2020-01-05', '2026-11-05')).toBe(2496);
  });

  test('getLocalDateString formats dates as YYYY-MM-DD', () => {
    const testDate = new Date(2026, 10, 5); // November 5, 2026 (0-indexed month)
    expect(getLocalDateString(testDate)).toBe('2026-11-05');
  });

  test('deduceTargetDaf calculates correctly from last known pair', () => {
    const knownPair = {
      masechet: 'Bekhorot',
      daf: 48,
      dateString: '2026-11-05',
    };

    // Same day
    expect(deduceTargetDaf(knownPair, '2026-11-05')).toEqual({
      masechet: 'Bekhorot',
      daf: 48,
      dateString: '2026-11-05',
    });

    // Next day
    expect(deduceTargetDaf(knownPair, '2026-11-06')).toEqual({
      masechet: 'Bekhorot',
      daf: 49,
      dateString: '2026-11-06',
    });

    // End of Bekhorot (Bekhorot has 60 dapim, 2..61; 48 to 61 is 13 days later)
    expect(deduceTargetDaf(knownPair, '2026-11-18')).toEqual({
      masechet: 'Bekhorot',
      daf: 61,
      dateString: '2026-11-18',
    });

    // Start of next tractate Arakhin (14 days later)
    expect(deduceTargetDaf(knownPair, '2026-11-19')).toEqual({
      masechet: 'Arakhin',
      daf: 2,
      dateString: '2026-11-19',
    });

    // Backward deduction to start of Cycle 14
    expect(deduceTargetDaf(knownPair, '2020-01-05')).toEqual({
      masechet: 'Berakhot',
      daf: 2,
      dateString: '2020-01-05',
    });

    // End of Cycle 14
    expect(deduceTargetDaf(knownPair, '2027-06-07')).toEqual({
      masechet: 'Niddah',
      daf: 73,
      dateString: '2027-06-07',
    });

    // Beginning of Cycle 15
    expect(deduceTargetDaf(knownPair, '2027-06-08')).toEqual({
      masechet: 'Berakhot',
      daf: 2,
      dateString: '2027-06-08',
    });
  });

  test('deduceTargetDaf falls back gracefully if masechet is unknown', () => {
    const invalidPair = {
      masechet: 'UnknownMasechet',
      daf: 10,
      dateString: '2026-11-05',
    };
    const result = deduceTargetDaf(invalidPair, '2026-11-05');
    expect(result.masechet).toBe(DEFAULT_KNOWN_PAIR.masechet);
    expect(result.daf).toBe(DEFAULT_KNOWN_PAIR.daf);
  });
});
