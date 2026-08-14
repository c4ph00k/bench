interface MenuItem {
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

interface Props {
  at: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}

export default function Menu({ at, items, onClose }: Props) {
  return (
    <div className="menu-overlay" onMouseDown={onClose} onClick={(e) => e.stopPropagation()}>
      <div
        className="menu"
        role="menu"
        style={{ left: Math.min(at.x, window.innerWidth - 180), top: Math.min(at.y, window.innerHeight - items.length * 36 - 16) }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            role="menuitem"
            className={`menu-item${item.danger ? " danger" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
