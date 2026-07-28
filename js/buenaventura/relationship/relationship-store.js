import { getSettings, remove, saveSettings } from '../../db.js';
import {
  RELATIONSHIP_SETTING_KEY,
  defaultRelationship,
  validateRelationship
} from './relationship-contracts.js';

export class RelationshipStore {
  constructor({
    readSettings = getSettings,
    writeSettings = saveSettings,
    removeSetting = key => remove('settings', key)
  } = {}) {
    this.readSettings = readSettings;
    this.writeSettings = writeSettings;
    this.removeSetting = removeSetting;
  }

  async load() {
    const stored = (await this.readSettings())[RELATIONSHIP_SETTING_KEY];
    return stored === undefined ? defaultRelationship() : validateRelationship(stored);
  }

  async save(value) {
    const validated = validateRelationship(value);
    await this.writeSettings({ [RELATIONSHIP_SETTING_KEY]: validated });
    return validated;
  }

  async clear() {
    await this.removeSetting(RELATIONSHIP_SETTING_KEY);
    return defaultRelationship();
  }
}
