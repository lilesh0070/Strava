import { useCallback, useEffect, useState } from 'react';
import { listActivities, onActivitiesChanged } from './storage';
import type { Activity } from './types';

export function useActivities() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const reload = useCallback(() => { listActivities().then(setItems); }, []);
  useEffect(() => {
    reload();
    return onActivitiesChanged(reload);
  }, [reload]);
  return { items, reload };
}
