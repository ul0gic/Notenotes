/**
 * ProjectStore — IndexedDB persistence layer for Notenotes projects.
 * Handles CRUD, auto-save, and version history (5 snapshots).
 */

import { openDB } from 'idb';

const DB_NAME = 'notenotes';
const DB_VERSION = 2;

const STORE_PROJECTS = 'projects';
const STORE_VERSIONS = 'versions';
const STORE_MILESTONES = 'milestones';

/** Maximum number of version history snapshots per project */
const MAX_VERSIONS = 5;

/**
 * Create a new empty project with default values.
 * @param {string} [name]
 * @returns {object}
 */
export function createProject(name = 'Untitled Sketch') {
  return {
    id: crypto.randomUUID(),
    name,
    bpm: 120,
    timeSignature: { beats: 4, subdivision: 4 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tracks: [],
    snippets: [],
    settings: {
      quantize: 0,          // QuantizeGrid.OFF
      metronomeOn: false,
      metronomeVolume: 0.5,
      loopBars: 4,
      masterVolume: 0.8,
      pianoCount: 1,
      pianoKeys: 12,
      drumPads: 10,
      arpRate: '1/8',
      arpChordType: 'major',
      arpPattern: 'up',
      holdDuration: 3000,
      soundTraits: {},
      controllerToneAssignments: {
        leftTrigger: 'none',
        rightTrigger: 'none'
      }
    }
  };
}

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects store
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      // Version history store (keyed by auto-generated id)
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        const versionStore = db.createObjectStore(STORE_VERSIONS, {
          keyPath: 'versionId',
          autoIncrement: true
        });
        versionStore.createIndex('projectId', 'projectId', { unique: false });
        versionStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MILESTONES)) {
        const milestoneStore = db.createObjectStore(STORE_MILESTONES, {
          keyPath: 'milestoneId',
          autoIncrement: true
        });
        milestoneStore.createIndex('projectId', 'projectId', { unique: false });
        milestoneStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    }
  });
}

export class ProjectStore {
  constructor() {
    this._db = null;
    this._autoSaveTimer = null;
    this._autoSaveDelay = 2000; // 2 second debounce
    this._pendingSave = null;
  }

  /**
   * Initialize the store (opens DB connection).
   */
  async init() {
    this._db = await getDB();
  }

  /**
   * Save a project to IndexedDB.
   * @param {object} project
   */
  async save(project) {
    project.updatedAt = Date.now();
    await this._db.put(STORE_PROJECTS, project);
  }

  /**
   * Load a project by ID.
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async load(id) {
    return this._db.get(STORE_PROJECTS, id);
  }

  /**
   * List all projects (summary: id, name, updatedAt).
   * @returns {Promise<object[]>}
   */
  async listAll() {
    const all = await this._db.getAll(STORE_PROJECTS);
    return all
      .map(p => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, bpm: p.bpm }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Delete a project and its version history.
   * @param {string} id
   */
  async delete(id) {
    await this._db.delete(STORE_PROJECTS, id);
    // Delete associated versions
    const tx = this._db.transaction(STORE_VERSIONS, 'readwrite');
    const index = tx.store.index('projectId');
    let cursor = await index.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  async saveMilestone(project, name = '') {
    const snapshot = {
      projectId: project.id,
      timestamp: Date.now(),
      label: name.trim() || `Milestone ${new Date().toLocaleString()}`,
      data: JSON.parse(JSON.stringify(project))
    };
    return this._db.add(STORE_MILESTONES, snapshot);
  }

  async getMilestones(projectId) {
    const tx = this._db.transaction(STORE_MILESTONES, 'readonly');
    const index = tx.store.index('projectId');
    const milestones = await index.getAll(projectId);
    return milestones
      .map(m => ({
        milestoneId: m.milestoneId,
        timestamp: m.timestamp,
        label: m.label,
        name: m.data.name,
        bpm: m.data.bpm,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async restoreMilestone(milestoneId) {
    const milestone = await this._db.get(STORE_MILESTONES, milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found`);
    const project = milestone.data;
    project.updatedAt = Date.now();
    await this.save(project);
    return project;
  }

  /**
   * Save a version snapshot. Keeps only the last MAX_VERSIONS per project.
   * @param {object} project
   */
  async saveVersion(project) {
    const snapshot = {
      projectId: project.id,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(project)) // deep clone
    };
    await this._db.add(STORE_VERSIONS, snapshot);

    // Prune old versions beyond MAX_VERSIONS
    const tx = this._db.transaction(STORE_VERSIONS, 'readwrite');
    const index = tx.store.index('projectId');
    const versions = await index.getAll(project.id);
    if (versions.length > MAX_VERSIONS) {
      // Sort by timestamp ascending, delete oldest
      versions.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = versions.slice(0, versions.length - MAX_VERSIONS);
      for (const v of toDelete) {
        await tx.store.delete(v.versionId);
      }
    }
    await tx.done;
  }

  /**
   * Get version history for a project.
   * @param {string} projectId
   * @returns {Promise<object[]>} Sorted newest first
   */
  async getVersions(projectId) {
    const tx = this._db.transaction(STORE_VERSIONS, 'readonly');
    const index = tx.store.index('projectId');
    const versions = await index.getAll(projectId);
    return versions
      .map(v => ({
        versionId: v.versionId,
        timestamp: v.timestamp,
        name: v.data.name,
        bpm: v.data.bpm
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Restore a project from a version snapshot.
   * @param {number} versionId
   * @returns {Promise<object>} The restored project data
   */
  async restoreVersion(versionId) {
    const version = await this._db.get(STORE_VERSIONS, versionId);
    if (!version) throw new Error(`Version ${versionId} not found`);
    // Save the restored data as the current project
    const project = version.data;
    project.updatedAt = Date.now();
    await this.save(project);
    return project;
  }

  /**
   * Schedule a debounced auto-save. Saves a version snapshot too.
   * @param {object} project
   */
  scheduleAutoSave(project) {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
    }
    this._autoSaveTimer = setTimeout(async () => {
      await this.save(project);
      await this.saveVersion(project);
      console.log('[ProjectStore] Auto-saved:', project.name);
    }, this._autoSaveDelay);
  }
}
