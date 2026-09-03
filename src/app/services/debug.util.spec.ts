import {
  bootBannerText,
  deployedPackage,
  deployedView,
  ingestDebugQueryParam,
  resolveDebugState,
} from './debug.util';

const PROD = '/nde/custom/972TAU_INST-NDE';
const TEST = '/nde/custom/972TAU_INST-NDE_TEST';

describe('debug.util — deployed package and view', () => {
  it('reads the package id from the asset base', () => {
    expect(deployedPackage(PROD)).toBe('972TAU_INST-NDE');
    expect(deployedPackage(TEST)).toBe('972TAU_INST-NDE_TEST');
  });

  it('reads the view from the segment after the last dash', () => {
    expect(deployedView(PROD)).toBe('NDE');
    expect(deployedView(TEST)).toBe('NDE_TEST');
  });

  it('yields an empty view for a malformed asset base rather than throwing', () => {
    expect(deployedView('')).toBe('');
    expect(deployedView('/nde/custom/nodashhere')).toBe('');
  });
});

describe('debug.util — precedence', () => {
  describe('view default, with no explicit choice anywhere', () => {
    it('is on for NDE_TEST', () => {
      const state = resolveDebugState(undefined, null, 'NDE_TEST');
      expect(state.enabled).toBeTrue();
      expect(state.reason).toBe('view default');
    });

    it('is off for NDE', () => {
      expect(resolveDebugState(undefined, null, 'NDE').enabled).toBeFalse();
    });

    it('is off for a view nobody has allow-listed', () => {
      expect(resolveDebugState(undefined, null, 'NDE_SANDBOX').enabled).toBeFalse();
    });

    it('is off for a view that could not be parsed', () => {
      expect(resolveDebugState(undefined, null, '').enabled).toBeFalse();
    });
  });

  describe('a stored value beats the view default in both directions', () => {
    it('turns a silent production view on', () => {
      const state = resolveDebugState(undefined, '1', 'NDE');
      expect(state.enabled).toBeTrue();
      expect(state.reason).toBe('explicit choice');
    });

    it('turns a verbose test view off', () => {
      const state = resolveDebugState(undefined, '0', 'NDE_TEST');
      expect(state.enabled).toBeFalse();
      expect(state.reason).toBe('explicit choice');
    });

    it('accepts the documented truthy spellings, case-insensitively', () => {
      for (const value of ['1', 'true', 'TRUE', 'on', 'yes', ' yes ']) {
        expect(resolveDebugState(undefined, value, 'NDE').enabled)
          .withContext(`stored value ${JSON.stringify(value)}`)
          .toBeTrue();
      }
    });

    it('treats any other stored value as off', () => {
      for (const value of ['0', 'false', 'no', '', 'banana']) {
        expect(resolveDebugState(undefined, value, 'NDE_TEST').enabled)
          .withContext(`stored value ${JSON.stringify(value)}`)
          .toBeFalse();
      }
    });

    it('distinguishes an absent key from a key present and falsy', () => {
      // Absent → view default (on, in a verbose view). Present and falsy → off.
      expect(resolveDebugState(undefined, null, 'NDE_TEST').enabled).toBeTrue();
      expect(resolveDebugState(undefined, '0', 'NDE_TEST').enabled).toBeFalse();
    });
  });

  describe('the session override beats everything', () => {
    it('turns logging on against an opposing stored value', () => {
      const state = resolveDebugState(true, '0', 'NDE');
      expect(state.enabled).toBeTrue();
      expect(state.reason).toBe('session override');
    });

    it('turns logging off against an opposing stored value', () => {
      const state = resolveDebugState(false, '1', 'NDE_TEST');
      expect(state.enabled).toBeFalse();
      expect(state.reason).toBe('session override');
    });

    it('is ignored when it is neither true nor false', () => {
      expect(resolveDebugState(undefined, null, 'NDE_TEST').reason).toBe('view default');
    });
  });
});

describe('debug.util — query-parameter ingest', () => {
  afterEach(() => localStorage.removeItem('tauDebug'));

  it('stores the on value when the parameter says on', () => {
    expect(ingestDebugQueryParam('?tauDebug=1')).toBeTrue();
    expect(localStorage.getItem('tauDebug')).toBe('1');
  });

  it('stores the off value when the parameter says off', () => {
    expect(ingestDebugQueryParam('?tauDebug=0')).toBeTrue();
    expect(localStorage.getItem('tauDebug')).toBe('0');
  });

  it('normalises other truthy spellings to the stored on value', () => {
    expect(ingestDebugQueryParam('?tauDebug=true')).toBeTrue();
    expect(localStorage.getItem('tauDebug')).toBe('1');
  });

  it('finds the parameter alongside others', () => {
    expect(ingestDebugQueryParam('?vid=972TAU_INST:NDE&tauDebug=1&lang=he')).toBeTrue();
    expect(localStorage.getItem('tauDebug')).toBe('1');
  });

  it('is a no-op when the parameter is absent', () => {
    expect(ingestDebugQueryParam('?vid=972TAU_INST:NDE')).toBeFalse();
    expect(localStorage.getItem('tauDebug')).toBeNull();
  });

  it('leaves an existing stored value alone when the parameter is absent', () => {
    localStorage.setItem('tauDebug', '1');
    expect(ingestDebugQueryParam('?lang=he')).toBeFalse();
    expect(localStorage.getItem('tauDebug')).toBe('1');
  });
});

describe('debug.util — boot banner', () => {
  it('names the package and says logging is off, with the way to turn it on', () => {
    const text = bootBannerText({ enabled: false, reason: 'view default' }, '972TAU_INST-NDE');
    expect(text).toContain('972TAU_INST-NDE');
    expect(text).toContain('debug logging OFF');
    expect(text).toContain('view default');
    expect(text).toContain("localStorage.setItem('tauDebug','1')");
    expect(text).toContain('?tauDebug=1');
  });

  it('names the package and says logging is on, with the way to turn it off', () => {
    const text = bootBannerText({ enabled: true, reason: 'explicit choice' }, '972TAU_INST-NDE_TEST');
    expect(text).toContain('972TAU_INST-NDE_TEST');
    expect(text).toContain('debug logging ON');
    expect(text).toContain('explicit choice');
    expect(text).toContain("localStorage.setItem('tauDebug','0')");
  });

  it('states each reason it was given', () => {
    expect(bootBannerText({ enabled: true, reason: 'session override' }, 'p')).toContain(
      'session override'
    );
    expect(bootBannerText({ enabled: true, reason: 'view default' }, 'p')).toContain('view default');
  });

  it('degrades to a placeholder rather than an empty gap when the package is unknown', () => {
    expect(bootBannerText({ enabled: false, reason: 'view default' }, '')).toContain(
      'unknown package'
    );
  });
});
