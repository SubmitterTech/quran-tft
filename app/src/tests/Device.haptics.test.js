const loadDeviceUtils = () => {
  jest.resetModules();

  jest.doMock('@capacitor/device', () => ({
    Device: {
      getInfo: jest.fn(),
      getLanguageCode: jest.fn()
    }
  }));

  jest.doMock('@capacitor/clipboard', () => ({
    Clipboard: {
      write: jest.fn().mockResolvedValue(undefined)
    }
  }));

  jest.doMock('@capacitor/status-bar', () => ({
    StatusBar: {
      getInfo: jest.fn(),
      setStyle: jest.fn(),
      setBackgroundColor: jest.fn()
    },
    Style: {
      Light: 'Light',
      Dark: 'Dark'
    }
  }));

  jest.doMock('@capacitor/screen-orientation', () => ({
    ScreenOrientation: {
      lock: jest.fn(),
      unlock: jest.fn()
    }
  }));

  jest.doMock('@capacitor/haptics', () => ({
    Haptics: {
      impact: jest.fn().mockResolvedValue(undefined)
    },
    ImpactStyle: {
      Light: 'LIGHT'
    }
  }));

  const { Device } = require('@capacitor/device');
  const { Haptics, ImpactStyle } = require('@capacitor/haptics');
  const utils = require('../utils/Device');

  return {
    Device,
    Haptics,
    ImpactStyle,
    ...utils
  };
};

describe('triggerActionHaptic', () => {
  test('returns false on web and does not call haptics', async () => {
    const { Device, Haptics, triggerActionHaptic } = loadDeviceUtils();
    Device.getInfo.mockResolvedValue({ platform: 'web' });

    const result = await triggerActionHaptic();

    expect(result).toBe(false);
    expect(Device.getInfo).toHaveBeenCalledTimes(1);
    expect(Haptics.impact).not.toHaveBeenCalled();
  });

  test('returns true on native and triggers light impact', async () => {
    const { Device, Haptics, ImpactStyle, triggerActionHaptic } = loadDeviceUtils();
    Device.getInfo.mockResolvedValue({ platform: 'android' });

    const result = await triggerActionHaptic();

    expect(result).toBe(true);
    expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
  });

  test('returns false when haptics impact throws on native', async () => {
    const { Device, Haptics, triggerActionHaptic } = loadDeviceUtils();
    Device.getInfo.mockResolvedValue({ platform: 'ios' });
    Haptics.impact.mockRejectedValue(new Error('haptics unavailable'));

    const result = await triggerActionHaptic();

    expect(result).toBe(false);
    expect(Haptics.impact).toHaveBeenCalledTimes(1);
  });

  test('returns false when platform detection fails', async () => {
    const { Device, Haptics, triggerActionHaptic } = loadDeviceUtils();
    Device.getInfo.mockRejectedValue(new Error('device info unavailable'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    try {
      const result = await triggerActionHaptic();
      expect(result).toBe(false);
      expect(Haptics.impact).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test('reuses platform init result across consecutive calls', async () => {
    const { Device, Haptics, triggerActionHaptic } = loadDeviceUtils();
    Device.getInfo.mockResolvedValue({ platform: 'android' });

    const first = await triggerActionHaptic();
    const second = await triggerActionHaptic();

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(Device.getInfo).toHaveBeenCalledTimes(1);
    expect(Haptics.impact).toHaveBeenCalledTimes(2);
  });
});

