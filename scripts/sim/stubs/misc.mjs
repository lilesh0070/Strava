export const defineTask = () => {};
export const notificationAsync = async () => {}; export const impactAsync = async () => {};
export const NotificationFeedbackType = { Success: 's', Warning: 'w' }; export const ImpactFeedbackStyle = { Medium: 'm' };
export const __said = []; export const speak = (t) => { __said.push(t); }; export const stop = () => {};
export const getItemAsync = async () => null; export const setItemAsync = async () => {}; export const deleteItemAsync = async () => {};
export const getDocumentAsync = async () => ({ canceled: true });
export class File {} export class Directory {} export const Paths = {};
export const shareAsync = async () => {}; export const isAvailableAsync = async () => true;
const appStateListeners = new Set();
export const AppState = {
  currentState: 'active',
  addEventListener: (_type, fn) => { appStateListeners.add(fn); return { remove() { appStateListeners.delete(fn); } }; },
};
/** Tests: the app goes to the background / comes back ('background' | 'active'). */
export const __setAppState = (st) => { AppState.currentState = st; appStateListeners.forEach((fn) => fn(st)); };
export const Platform = { OS: 'android' };
export const setAudioModeAsync = async () => {};
