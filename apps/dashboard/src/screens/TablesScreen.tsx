import { useEffect, useRef, useState } from "react";
import type { RestaurantTable, TableComanda, TableStatus } from "@cardapio/shared";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { ApiError, api } from "../lib/api";
import { brl } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { PixPaymentModal } from "../components/pix/PixPaymentModal";

const STATUS_MAP: Record<TableStatus, { label: string; bg: string; fg: string; bd: string }> = {
  free: { label: "Livre", bg: "var(--surface2)", fg: "var(--ink3)", bd: "var(--line)" },
  occupied: { label: "Ocupada", bg: "var(--brandSoft)", fg: "var(--brandText)", bd: "var(--sec)" },
  awaiting_payment: { label: "Aguardando pagamento", bg: "color-mix(in srgb, var(--warn) 16%, transparent)", fg: "var(--warn)", bd: "var(--warn)" }
};

const GRID_SIZE_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 6); // 6..14
const cellId = (row: number, col: number) => `cell-${row}-${col}`;

export default function TablesScreen() {
  const { notify } = useDashboardState();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [gridSize, setGridSize] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  const [comanda, setComanda] = useState<TableComanda | null>(null);
  const [splitMode, setSplitMode] = useState<"pessoa" | "item" | null>(null);
  const [people, setPeople] = useState(2);
  const [transferTo, setTransferTo] = useState<number | "">("");
  const [pixTarget, setPixTarget] = useState<{ number: number; title: string; amount: number; itemsLabel: string } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ table: RestaurantTable; x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const loadTables = () => api.getSalonGrid().then((grid) => {
    setGridSize(grid.gridSize);
    setTables(grid.tables);
    if (selectedRef.current == null && grid.tables.length) setSelected(grid.tables[0].number);
  });

  const changeGridSize = async (size: number) => {
    try {
      const grid = await api.setGridSize(size);
      setGridSize(grid.gridSize);
      setTables(grid.tables);
      notify(`Grade do salão alterada para ${size}×${size}`);
    } catch {
      notify("Não foi possível alterar o tamanho da grade");
    }
  };

  const setTablePosition = async (number: number, gridRow: number | null, gridCol: number | null) => {
    try {
      const grid = await api.setTablePosition(number, gridRow, gridCol);
      setGridSize(grid.gridSize);
      setTables(grid.tables);
    } catch (err) {
      notify(err instanceof ApiError && err.status === 409 ? err.message : "Não foi possível mover a mesa");
    }
  };

  const renameTable = (table: RestaurantTable) => {
    setMenu(null);
    const raw = window.prompt(`Novo número para a Mesa ${String(table.number).padStart(2, "0")}`, String(table.number));
    if (raw == null) return;
    const next = parseInt(raw, 10);
    if (!Number.isInteger(next) || next <= 0) {
      notify("Número inválido");
      return;
    }
    if (next === table.number) return;
    api
      .renameTable(table.number, next)
      .then((grid) => {
        setGridSize(grid.gridSize);
        setTables(grid.tables);
        if (selected === table.number) setSelected(next);
        notify(`Mesa renomeada para ${String(next).padStart(2, "0")}`);
      })
      .catch((err) => notify(err instanceof ApiError ? err.message : "Não foi possível renomear a mesa"));
  };

  const deleteTable = (table: RestaurantTable) => {
    setMenu(null);
    if (!window.confirm(`Excluir a Mesa ${String(table.number).padStart(2, "0")}? Essa ação não pode ser desfeita.`)) return;
    api
      .deleteTable(table.number)
      .then((grid) => {
        setGridSize(grid.gridSize);
        setTables(grid.tables);
        if (selected === table.number) setSelected(grid.tables[0]?.number ?? null);
        notify(`Mesa ${String(table.number).padStart(2, "0")} excluída`);
      })
      .catch((err) => notify(err instanceof ApiError ? err.message : "Não foi possível excluir a mesa"));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragId(null);
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("cell-")) return;
    const [, rowStr, colStr] = overId.split("-");
    const row = Number(rowStr), col = Number(colStr);
    const table = tables.find((t) => t.id === String(active.id));
    if (!table || (table.gridRow === row && table.gridCol === col)) return;
    setTablePosition(table.number, row, col);
  };

  useEffect(() => {
    loadTables();
    const id = setInterval(loadTables, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected == null) return;
    setSplitMode(null);
    api.getComanda(selected).then(setComanda).catch(() => setComanda(null));
  }, [selected]);

  const selT = tables.find((t) => t.number === selected) || null;

  const doTransfer = async () => {
    if (selected == null || transferTo === "") return;
    try {
      await api.transferTable(selected, Number(transferTo));
      notify(`Itens transferidos para a Mesa ${String(transferTo).padStart(2, "0")}`);
      setTransferTo("");
      loadTables();
      api.getComanda(selected).then(setComanda).catch(() => setComanda(null));
    } catch {
      notify("Não foi possível transferir a mesa");
    }
  };

  const showQr = async () => {
    if (selected == null) return;
    try {
      const { tableCode } = await api.getTableQr(selected);
      const url = `${(import.meta.env.VITE_CUSTOMER_APP_URL as string) || "http://localhost:5173"}/t/${tableCode}`;
      try {
        await navigator.clipboard.writeText(url);
        notify(`Link copiado: ${url}`);
      } catch {
        notify(`Link da Mesa: ${url}`);
      }
    } catch {
      notify("Não foi possível gerar o QR code");
    }
  };

  const newTable = async () => {
    try {
      await api.createTable(4);
      notify("Nova mesa adicionada ao mapa");
      loadTables();
    } catch {
      notify("Não foi possível criar a mesa");
    }
  };

  const legend: TableStatus[] = ["free", "occupied", "awaiting_payment"];
  const freeTables = tables.filter((t) => t.status === "free" && t.number !== selected);
  const positioned = tables.filter((t) => t.gridRow != null && t.gridCol != null);
  const unpositioned = tables.filter((t) => t.gridRow == null || t.gridCol == null);
  const activeTable = activeDragId ? tables.find((t) => t.id === activeDragId) || null : null;

  const subtotal = comanda?.subtotal ?? 0;
  const service = comanda?.service ?? 0;
  const total = comanda?.total ?? 0;
  const splitRows =
    splitMode === "pessoa"
      ? Array.from({ length: people }, (_, i) => ({ k: `Pessoa ${i + 1}`, v: brl(Math.round((total / people) * 100) / 100) }))
      : splitMode === "item"
      ? (comanda?.lines || []).map((l) => ({ k: `${l.name} · ${l.quantity}`, v: brl(l.subtotal) }))
      : [];

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
      <section className="card" style={{ flex: 1, minWidth: 320, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Mapa do salão</div>
          <select value={gridSize} onChange={(e) => changeGridSize(Number(e.target.value))} className="field" style={{ width: "auto", padding: "7px 11px", fontSize: 12.5 }}>
            {GRID_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}×{n}
              </option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {legend.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink2)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_MAP[k].fg }} />
                {STATUS_MAP[k].label}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={newTable}>
            <i className="fa-solid fa-plus" style={{ fontSize: 16, lineHeight: 1 }} />
            Nova mesa
          </button>
        </div>

        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveDragId(String(active.id))} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: 6 }}>
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
              const row = Math.floor(i / gridSize);
              const col = i % gridSize;
              const t = positioned.find((x) => x.gridRow === row && x.gridCol === col) || null;
              return (
                <GridCell
                  key={cellId(row, col)}
                  row={row}
                  col={col}
                  table={t}
                  selected={t?.number === selected}
                  onSelect={setSelected}
                  onContextMenu={(tbl, x, y) => setMenu({ table: tbl, x, y })}
                />
              );
            })}
          </div>

          {unpositioned.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>
                Mesas sem posição · arraste pra grade
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {unpositioned.map((t) => (
                  <div key={t.id} style={{ width: 56, height: 56 }}>
                    <TableChip table={t} selected={t.number === selected} onSelect={setSelected} onContextMenu={(tbl, x, y) => setMenu({ table: tbl, x, y })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DragOverlay>{activeTable && <TableChip table={activeTable} selected={false} onSelect={() => {}} overlay />}</DragOverlay>
        </DndContext>
      </section>

      <aside className="card" style={{ width: 330, flex: "0 0 330px", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.015em", flex: 1 }}>{selT ? `Mesa ${String(selT.number).padStart(2, "0")}` : "Selecione uma mesa"}</div>
            {selT && (
              <span className="pill" style={{ background: STATUS_MAP[selT.status].bg, color: STATUS_MAP[selT.status].fg }}>
                {STATUS_MAP[selT.status].label}
              </span>
            )}
          </div>
          {selT && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{selT.seats} lugares{selT.openedAt ? ` · aberta às ${new Date(selT.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>}
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 2 }}>
            Comanda em tempo real
          </div>
          {(comanda?.lines || []).map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 13 }}>
              <span className="mono" style={{ color: "var(--ink2)" }}>
                {l.quantity}×
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{l.name}</span>
              <span className="mono" style={{ fontWeight: 500 }}>
                {brl(l.subtotal)}
              </span>
            </div>
          ))}
          {(!comanda || comanda.lines.length === 0) && <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Nenhum pedido em aberto nesta mesa.</div>}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", fontSize: 12.5, color: "var(--ink2)" }}>
            <span style={{ flex: 1 }}>Subtotal</span>
            <span className="mono">{brl(subtotal)}</span>
          </div>
          <div style={{ display: "flex", fontSize: 12.5, color: "var(--ink2)" }}>
            <span style={{ flex: 1 }}>Serviço {comanda ? comanda.servicePct : 10}%</span>
            <span className="mono">{brl(service)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>Total</span>
            <span className="mono" style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.03em" }}>
              {brl(total)}
            </span>
          </div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selT || selT.status === "free"}
            onClick={() =>
              selT &&
              setPixTarget({
                number: selT.number,
                title: `Mesa ${String(selT.number).padStart(2, "0")}`,
                amount: total,
                itemsLabel: `${(comanda?.lines || []).length} itens · serviço ${comanda ? comanda.servicePct : 10}% incluso`
              })
            }
          >
            Fechar conta
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setSplitMode(splitMode === "pessoa" ? null : "pessoa")}
              className="tap"
              style={{ flex: 1, border: "1px solid var(--line2)", borderRadius: 12, padding: 9, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: splitMode === "pessoa" ? "var(--brand)" : "var(--surface2)", color: splitMode === "pessoa" ? "var(--brandInk)" : "var(--ink2)" }}
            >
              Por pessoa
            </button>
            <button
              type="button"
              onClick={() => setSplitMode(splitMode === "item" ? null : "item")}
              className="tap"
              style={{ flex: 1, border: "1px solid var(--line2)", borderRadius: 12, padding: 9, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: splitMode === "item" ? "var(--brand)" : "var(--surface2)", color: splitMode === "item" ? "var(--brandInk)" : "var(--ink2)" }}
            >
              Por item
            </button>
          </div>
          {splitMode && (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: 11, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)", flex: 1 }}>{splitMode === "pessoa" ? "Dividir por pessoa" : "Dividir por item"}</div>
                {splitMode === "pessoa" && (
                  <input
                    type="number"
                    min={1}
                    value={people}
                    onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))}
                    style={{ width: 48, border: "1px solid var(--line)", borderRadius: 8, padding: "3px 6px", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit", fontSize: 12 }}
                  />
                )}
              </div>
              {splitRows.map((r, i) => (
                <div key={i} style={{ display: "flex", fontSize: 12.5 }}>
                  <span style={{ flex: 1, minWidth: 0, color: "var(--ink2)" }}>{r.k}</span>
                  <span className="mono" style={{ fontWeight: 500 }}>
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={showQr}>
              <i className="fa-solid fa-qrcode" style={{ fontSize: 16, lineHeight: 1 }} />
              QR code
            </button>
            <select value={transferTo} onChange={(e) => setTransferTo(e.target.value ? Number(e.target.value) : "")} className="field" style={{ flex: 1, padding: "9px 10px", fontSize: 12.5 }}>
              <option value="">Transferir p/…</option>
              {freeTables.map((t) => (
                <option key={t.id} value={t.number}>
                  Mesa {String(t.number).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          {transferTo !== "" && (
            <button type="button" className="btn btn-ghost" onClick={doTransfer}>
              <i className="fa-solid fa-right-left" style={{ fontSize: 16, lineHeight: 1 }} />
              Confirmar transferência
            </button>
          )}
        </div>
      </aside>

      <PixPaymentModal
        open={pixTarget != null}
        title={pixTarget?.title || ""}
        amount={pixTarget?.amount || 0}
        itemsLabel={pixTarget?.itemsLabel}
        onClose={() => setPixTarget(null)}
        onConfirmed={async () => {
          if (!pixTarget) return;
          const number = pixTarget.number;
          setPixTarget(null);
          try {
            await api.closeTable(number);
            notify(`Conta da Mesa ${String(number).padStart(2, "0")} fechada`);
            loadTables();
            if (selected === number) api.getComanda(number).then(setComanda).catch(() => setComanda(null));
          } catch {
            notify("Não foi possível fechar a conta");
          }
        }}
        onNotify={notify}
      />

      {menu && (
        <>
          <div
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: "fixed",
              top: menu.y,
              left: menu.x,
              zIndex: 41,
              minWidth: 180,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              boxShadow: "var(--shadow2)",
              overflow: "hidden"
            }}
          >
            <button
              type="button"
              onClick={() => renameTable(menu.table)}
              className="tap"
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "11px 14px", border: 0, background: "transparent", cursor: "pointer", font: "inherit", fontSize: 12.5, color: "var(--ink)", textAlign: "left" }}
            >
              <i className="fa-solid fa-pen" style={{ fontSize: 14, width: 14 }} />
              Editar número
            </button>
            <button
              type="button"
              onClick={() => deleteTable(menu.table)}
              className="tap"
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "11px 14px", border: 0, borderTop: "1px solid var(--line)", background: "transparent", cursor: "pointer", font: "inherit", fontSize: 12.5, color: "var(--alert)", textAlign: "left" }}
            >
              <i className="fa-solid fa-trash" style={{ fontSize: 14, width: 14 }} />
              Excluir mesa
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Draggable — used both inside a grid cell and in the unpositioned side list. */
function TableChip({
  table,
  selected,
  onSelect,
  onContextMenu,
  overlay
}: {
  table: RestaurantTable;
  selected: boolean;
  onSelect: (n: number) => void;
  onContextMenu?: (table: RestaurantTable, x: number, y: number) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: table.id });
  const st = STATUS_MAP[table.status];
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      type="button"
      {...(overlay ? {} : { ...listeners, ...attributes })}
      onClick={() => onSelect(table.number)}
      onContextMenu={
        onContextMenu
          ? (e) => {
              e.preventDefault();
              onContextMenu(table, e.clientX, e.clientY);
            }
          : undefined
      }
      className="tap"
      title={`Mesa ${String(table.number).padStart(2, "0")} · ${st.label} · ${table.seats} lug.`}
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        cursor: overlay ? "grabbing" : "grab",
        background: st.bg,
        border: `1.5px solid ${selected ? "var(--brand)" : st.bd}`,
        boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent)" : overlay ? "var(--shadow2)" : "none",
        opacity: isDragging ? 0.35 : 1,
        color: st.fg,
        fontFamily: "var(--mono)",
        fontWeight: 600,
        fontSize: 13
      }}
    >
      {String(table.number).padStart(2, "0")}
    </button>
  );
}

/** Droppable grid cell — empty (dashed placeholder) or occupied by one draggable TableChip. */
function GridCell({
  row,
  col,
  table,
  selected,
  onSelect,
  onContextMenu
}: {
  row: number;
  col: number;
  table: RestaurantTable | null;
  selected: boolean;
  onSelect: (n: number) => void;
  onContextMenu: (table: RestaurantTable, x: number, y: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(row, col) });
  return (
    <div
      ref={setNodeRef}
      style={{
        aspectRatio: "1",
        borderRadius: 10,
        border: `1px dashed ${isOver ? "var(--brand)" : "var(--line2)"}`,
        background: isOver ? "var(--brandSoft)" : "transparent",
        transition: "border-color .12s var(--ease-spring), background .12s var(--ease-spring)"
      }}
    >
      {table && <TableChip table={table} selected={selected} onSelect={onSelect} onContextMenu={onContextMenu} />}
    </div>
  );
}
