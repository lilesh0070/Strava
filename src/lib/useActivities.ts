import { useCallback, useEffect, useState } from 'react';
import { listActivities, onActivitiesChanged } from './storage';
import type { Activity } from './types';

/** Activity summaries plus the time they were (re)loaded, so screens can anchor "this week" without calling Date.now() during render. */
export function useActivities() {
  const [state, setState] = useState<{ items: Activity[] | null; loadedAt: number }>(() => ({ items: null, loadedAt: Date.now() }));
  const reload = useCallback(() => {
    listActivities().then((items) => setState({ items, loadedAt: Date.now() }));
  }, []);
  useEffect(() => {
    reload();
    return onActivitiesChanged(reload);
  }, [reload]);
  return { items: state.items, loadedAt: state.loadedAt, reload };
}
