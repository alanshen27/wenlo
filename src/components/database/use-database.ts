"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiDelete,
  apiPatch,
  apiPost,
} from "@/lib/client/api";
import { toastError } from "@/lib/client/toast";
import { readDbViewStorageKey } from "@/lib/client/storage-keys";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { useDebouncedFlush } from "@/hooks/use-debounced-persist";
import { useSaveStatus } from "@/hooks/use-save-status";
import { useDatabaseDocument } from "@/hooks/use-native-documents";
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
  saveStatus: ReturnType<typeof useSaveStatus>["saveStatus"];
  readOnly: boolean;
  loadError: string | null;
  isLoading: boolean;
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

export function useDatabase(
  databaseId: string,
  libraryId: string,
  readOnly: boolean
): DatabaseController {
  const {
    data: remoteScene,
    loadError,
    isLoading,
    reload,
  } = useDatabaseDocument(databaseId, libraryId);

  const [scene, setScene] = useState<DatabaseScene | null>(null);
  const { saveStatus, markSaving, markSaved, markError } = useSaveStatus();
  const [activeViewId, setActiveViewIdState] = usePersistentState<string | null>(
    readDbViewStorageKey(databaseId),
    null
  );

  const pendingCells = useRef<Map<string, Record<string, CellValue>>>(new Map());

  useEffect(() => {
    if (!remoteScene) return;
    setScene(remoteScene);
    setActiveViewIdState((prev) =>
      prev && remoteScene.views.some((v) => v.id === prev) ? prev : (remoteScene.views[0]?.id ?? null)
    );
  }, [remoteScene, setActiveViewIdState]);

  const flushCells = useCallback(() => {
    const pending = pendingCells.current;
    if (pending.size === 0) return;
    pendingCells.current = new Map();
    markSaving();
    const writes = Array.from(pending.entries()).map(([rowId, cells]) =>
      apiPatch(`/api/databases/${databaseId}/rows/${rowId}`, { cells })
    );
    void Promise.all(writes)
      .then(() => markSaved())
      .catch((error) => {
        markError();
        toastError(error, "Couldn't save changes");
      });
  }, [databaseId, markSaving, markSaved, markError]);

  const { schedule: scheduleCellSave } = useDebouncedFlush(flushCells, CELL_SAVE_DEBOUNCE_MS);

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
      scheduleCellSave();
    },
    [readOnly, scheduleCellSave]
  );

  const withSaving = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      markSaving();
      try {
        const result = await fn();
        markSaved();
        return result;
      } catch (error) {
        markError();
        toastError(error, "Couldn't save changes");
        throw error;
      }
    },
    [markSaving, markSaved, markError]
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
      try {
        await withSaving(() => apiDelete(`/api/databases/${databaseId}/rows/${rowId}`));
      } catch {
        /* toast from withSaving */
      }
    },
    [databaseId, readOnly, withSaving]
  );

  const addProperty = useCallback(
    async (type: PropertyType) => {
      if (readOnly) return;
      try {
        const property = await withSaving(() =>
          apiPost<DatabaseProperty>(`/api/databases/${databaseId}/properties`, { type })
        );
        setScene((prev) => (prev ? { ...prev, properties: [...prev.properties, property] } : prev));
      } catch {
        /* toast from withSaving */
      }
    },
    [databaseId, readOnly, withSaving]
  );

  const updateProperty = useCallback(
    async (
      propertyId: string,
      patch: { name?: string; type?: PropertyType; options?: SelectOption[]; width?: number | null }
    ) => {
      if (readOnly) return;
      try {
        const property = await withSaving(() =>
          apiPatch<DatabaseProperty>(`/api/databases/${databaseId}/properties/${propertyId}`, patch)
        );
        setScene((prev) =>
          prev
            ? {
                ...prev,
                properties: prev.properties.map((p) => (p.id === propertyId ? property : p)),
                rows: patch.type
                  ? prev.rows.map((r) => {
                      const { [propertyId]: _drop, ...rest } = r.cells;
                      return { ...r, cells: rest };
                    })
                  : prev.rows,
              }
            : prev
        );
      } catch {
        /* toast from withSaving */
      }
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
      try {
        await withSaving(() => apiDelete(`/api/databases/${databaseId}/properties/${propertyId}`));
      } catch {
        /* toast from withSaving */
      }
    },
    [databaseId, readOnly, withSaving]
  );

  const addView = useCallback(
    async (type: ViewType) => {
      if (readOnly) return;
      try {
        const view = await withSaving(() =>
          apiPost<DatabaseView>(`/api/databases/${databaseId}/views`, { type })
        );
        setScene((prev) => (prev ? { ...prev, views: [...prev.views, view] } : prev));
        setActiveViewIdState(view.id);
      } catch {
        /* toast from withSaving */
      }
    },
    [databaseId, readOnly, withSaving, setActiveViewIdState]
  );

  const updateView = useCallback(
    async (viewId: string, patch: { name?: string; config?: ViewConfig }) => {
      if (readOnly) return;
      try {
        const view = await withSaving(() =>
          apiPatch<DatabaseView>(`/api/databases/${databaseId}/views/${viewId}`, patch)
        );
        setScene((prev) =>
          prev ? { ...prev, views: prev.views.map((v) => (v.id === viewId ? view : v)) } : prev
        );
      } catch {
        /* toast from withSaving */
      }
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
      try {
        await withSaving(() => apiDelete(`/api/databases/${databaseId}/views/${viewId}`));
      } catch {
        /* toast from withSaving */
      }
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
    loadError,
    isLoading,
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
