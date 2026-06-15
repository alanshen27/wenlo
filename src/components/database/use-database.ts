"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/components/library/main-header";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  getApiErrorMessage,
  isCanceledError,
  isNotFoundError,
} from "@/lib/client/api";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import type {
  CellValue,
  DatabaseProperty,
  DatabaseRowData,
  DatabaseScene,
  DatabaseView,
  PropertyType,
  SelectOption,
  ViewConfig,
  ViewType,
} from "@/lib/databases/database-schema";

const CELL_SAVE_DEBOUNCE_MS = 600;

export type DatabaseController = {
  scene: DatabaseScene | null;
  saveStatus: SaveStatus;
  readOnly: boolean;
  notFound: boolean;
  /** Transient load failure (network/server); null when none. */
  loadError: string | null;
  /** Re-attempt the initial load after a transient failure. */
  reload: () => void;
  activeViewId: string | null;
  setActiveViewId: (id: string) => void;
  setCell: (rowId: string, propertyId: string, value: CellValue) => void;
  addRow: (cells?: Record<string, CellValue>) => Promise<DatabaseRowData | null>;
  deleteRow: (rowId: string) => Promise<void>;
  addProperty: (type: PropertyType) => Promise<void>;
  updateProperty: (
    propertyId: string,
    patch: { name?: string; type?: PropertyType; options?: SelectOption[]; width?: number | null }
  ) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  addView: (type: ViewType) => Promise<void>;
  updateView: (viewId: string, patch: { name?: string; config?: ViewConfig }) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
};

export function useDatabase(databaseId: string, readOnly: boolean): DatabaseController {
  const [scene, setScene] = useState<DatabaseScene | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeViewId, setActiveViewIdState] = usePersistentState<string | null>(
    `recalls:db-view:${databaseId}`,
    null
  );

  const pendingCells = useRef<Map<string, Record<string, CellValue>>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setScene(null);
    setNotFound(false);
    setLoadError(null);
    void (async () => {
      try {
        const data = await apiGet<DatabaseScene>(`/api/databases/${databaseId}`);
        if (cancelled) return;
        setScene(data);
        setActiveViewIdState((prev) =>
          prev && data.views.some((v) => v.id === prev) ? prev : (data.views[0]?.id ?? null)
        );
      } catch (err) {
        if (cancelled || isCanceledError(err)) return;
        // Missing/forbidden → let the view redirect home; otherwise surface a
        // retryable error instead of bouncing the user out on a network blip.
        if (isNotFoundError(err)) setNotFound(true);
        else setLoadError(getApiErrorMessage(err, "We couldn't load this database."));
      }
    })();
    return () => {
      cancelled = true;
    };
    // setActiveViewIdState is stable from usePersistentState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
  }, []);

  const flushCells = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingCells.current;
    if (pending.size === 0) return;
    pendingCells.current = new Map();
    setSaveStatus("saving");
    const writes = Array.from(pending.entries()).map(([rowId, cells]) =>
      apiPatch(`/api/databases/${databaseId}/rows/${rowId}`, { cells })
    );
    void Promise.all(writes)
      .then(markSaved)
      .catch(() => setSaveStatus("error"));
  }, [databaseId, markSaved]);

  // Flush pending cell edits on unmount / tab close.
  useEffect(() => {
    const onBeforeUnload = () => flushCells();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushCells();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [flushCells]);

  const setCell = useCallback(
    (rowId: string, propertyId: string, value: CellValue) => {
      if (readOnly) return;
      setScene((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) =>
                r.id === rowId ? { ...r, cells: { ...r.cells, [propertyId]: value } } : r
              ),
            }
          : prev
      );
      const rowPending = pendingCells.current.get(rowId) ?? {};
      rowPending[propertyId] = value;
      pendingCells.current.set(rowId, rowPending);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushCells, CELL_SAVE_DEBOUNCE_MS);
    },
    [readOnly, flushCells]
  );

  const withSaving = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setSaveStatus("saving");
      try {
        const result = await fn();
        markSaved();
        return result;
      } catch (error) {
        setSaveStatus("error");
        throw error;
      }
    },
    [markSaved]
  );

  const addRow = useCallback(
    async (cells?: Record<string, CellValue>) => {
      if (readOnly) return null;
      try {
        const row = await withSaving(() =>
          apiPost<DatabaseRowData>(`/api/databases/${databaseId}/rows`, { cells: cells ?? {} })
        );
        setScene((prev) => (prev ? { ...prev, rows: [...prev.rows, row] } : prev));
        return row;
      } catch {
        return null;
      }
    },
    [databaseId, readOnly, withSaving]
  );

  const deleteRow = useCallback(
    async (rowId: string) => {
      if (readOnly) return;
      setScene((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== rowId) } : prev));
      await withSaving(() => apiDelete(`/api/databases/${databaseId}/rows/${rowId}`)).catch(() => {});
    },
    [databaseId, readOnly, withSaving]
  );

  const addProperty = useCallback(
    async (type: PropertyType) => {
      if (readOnly) return;
      const property = await withSaving(() =>
        apiPost<DatabaseProperty>(`/api/databases/${databaseId}/properties`, { type })
      );
      setScene((prev) => (prev ? { ...prev, properties: [...prev.properties, property] } : prev));
    },
    [databaseId, readOnly, withSaving]
  );

  const updateProperty = useCallback(
    async (
      propertyId: string,
      patch: { name?: string; type?: PropertyType; options?: SelectOption[]; width?: number | null }
    ) => {
      if (readOnly) return;
      const property = await withSaving(() =>
        apiPatch<DatabaseProperty>(`/api/databases/${databaseId}/properties/${propertyId}`, patch)
      );
      setScene((prev) =>
        prev
          ? {
              ...prev,
              properties: prev.properties.map((p) => (p.id === propertyId ? property : p)),
              // A type change clears the column's values server-side.
              rows: patch.type
                ? prev.rows.map((r) => {
                    const { [propertyId]: _drop, ...rest } = r.cells;
                    return { ...r, cells: rest };
                  })
                : prev.rows,
            }
          : prev
      );
    },
    [databaseId, readOnly, withSaving]
  );

  const deleteProperty = useCallback(
    async (propertyId: string) => {
      if (readOnly) return;
      setScene((prev) =>
        prev
          ? {
              ...prev,
              properties: prev.properties.filter((p) => p.id !== propertyId),
              rows: prev.rows.map((r) => {
                const { [propertyId]: _drop, ...rest } = r.cells;
                return { ...r, cells: rest };
              }),
              views: prev.views.map((v) => ({
                ...v,
                config: {
                  groupPropertyId:
                    v.config.groupPropertyId === propertyId ? null : v.config.groupPropertyId,
                  datePropertyId:
                    v.config.datePropertyId === propertyId ? null : v.config.datePropertyId,
                },
              })),
            }
          : prev
      );
      await withSaving(() =>
        apiDelete(`/api/databases/${databaseId}/properties/${propertyId}`)
      ).catch(() => {});
    },
    [databaseId, readOnly, withSaving]
  );

  const addView = useCallback(
    async (type: ViewType) => {
      if (readOnly) return;
      const view = await withSaving(() =>
        apiPost<DatabaseView>(`/api/databases/${databaseId}/views`, { type })
      );
      setScene((prev) => (prev ? { ...prev, views: [...prev.views, view] } : prev));
      setActiveViewIdState(view.id);
    },
    [databaseId, readOnly, withSaving, setActiveViewIdState]
  );

  const updateView = useCallback(
    async (viewId: string, patch: { name?: string; config?: ViewConfig }) => {
      if (readOnly) return;
      const view = await withSaving(() =>
        apiPatch<DatabaseView>(`/api/databases/${databaseId}/views/${viewId}`, patch)
      );
      setScene((prev) =>
        prev ? { ...prev, views: prev.views.map((v) => (v.id === viewId ? view : v)) } : prev
      );
    },
    [databaseId, readOnly, withSaving]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      if (readOnly) return;
      let nextActive: string | null = null;
      setScene((prev) => {
        if (!prev) return prev;
        const views = prev.views.filter((v) => v.id !== viewId);
        nextActive = views[0]?.id ?? null;
        return { ...prev, views };
      });
      setActiveViewIdState((prev) => (prev === viewId ? nextActive : prev));
      await withSaving(() => apiDelete(`/api/databases/${databaseId}/views/${viewId}`)).catch(
        () => {}
      );
    },
    [databaseId, readOnly, withSaving, setActiveViewIdState]
  );

  const setActiveViewId = useCallback(
    (id: string) => setActiveViewIdState(id),
    [setActiveViewIdState]
  );

  return {
    scene,
    saveStatus,
    readOnly,
    notFound,
    loadError,
    reload,
    activeViewId,
    setActiveViewId,
    setCell,
    addRow,
    deleteRow,
    addProperty,
    updateProperty,
    deleteProperty,
    addView,
    updateView,
    deleteView,
  };
}
