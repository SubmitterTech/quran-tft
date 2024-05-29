import { Device } from '@capacitor/device';

export const getDeviceLanguage = async () => {
  const info = await Device.getLanguageCode();
  return info.value;
};

export const setInitialLanguage = async () => {
  const existingLang = localStorage.getItem("lang");
  if (existingLang) {
    return existingLang;
  }
  try {
    const langCode = await getDeviceLanguage();
    localStorage.setItem("lang", langCode);
    return langCode;
  } catch (error) {
    console.error("Failed to get device language", error);
    const fallbackLang = process.env.REACT_APP_DEFAULT_LANG || "en";
    localStorage.setItem("lang", fallbackLang);
    return fallbackLang;
  }
};
