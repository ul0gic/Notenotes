const DAY_MS = 24 * 60 * 60 * 1000;

export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Math.max(0, Date.now() - Number(timestamp));
  const minute = 60 * 1000;
  const hour = 60 * minute;
  if (diff < minute) return 'Just now';
  if (diff < hour) {
    const mins = Math.round(diff / minute);
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY_MS) {
    const hours = Math.round(diff / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(diff / DAY_MS);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function workspaceBackupStatus(project) {
  const settings = project?.settings || {};
  const lastEditAt = Number(settings.lastEditAt || project?.updatedAt || 0);
  const lastBackupAt = Number(settings.lastWorkspaceBackupAt || 0);

  if (!lastBackupAt) {
    return {
      state: 'danger',
      label: 'No workspace backup yet',
      shortLabel: 'No backup',
      advice: 'Browser storage is not a backup. Save a workspace backup outside the browser for anything important.'
    };
  }

  if (!lastEditAt || lastBackupAt >= lastEditAt) {
    return {
      state: 'ok',
      label: `Backed up ${formatRelativeTime(lastBackupAt)}`,
      shortLabel: 'Backed up',
      advice: 'Your latest tracked workspace edit has a workspace backup file outside browser storage.'
    };
  }

  const age = Date.now() - lastBackupAt;
  return {
    state: age > DAY_MS ? 'danger' : 'warning',
    label: `Edited since backup (${formatRelativeTime(lastBackupAt)})`,
    shortLabel: 'Backup due',
    advice: 'This workspace changed after the last backup. Save a fresh workspace backup to protect the latest work.'
  };
}
