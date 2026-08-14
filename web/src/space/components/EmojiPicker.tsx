const EMOJIS = [
  "📄",
  "📝",
  "📚",
  "📖",
  "🗂️",
  "📁",
  "✅",
  "📌",
  "🎯",
  "🚀",
  "💡",
  "🧠",
  "🏠",
  "🗺️",
  "✈️",
  "🧳",
  "🗾",
  "🍜",
  "🍝",
  "🍳",
  "🥗",
  "☕",
  "🎨",
  "🎵",
  "🎮",
  "🏃",
  "💪",
  "🧘",
  "🌱",
  "🌞",
  "🌙",
  "⭐",
  "🔥",
  "❄️",
  "💧",
  "🌊",
  "🐛",
  "🔧",
  "🖥️",
  "📦",
  "🔑",
  "💰",
  "📊",
  "📈",
  "🗓️",
  "⏰",
  "✉️",
  "🎁",
  "❤️",
  "🎉",
];

interface Props {
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onPick, onClose }: Props) {
  return (
    <div className="menu-overlay" onMouseDown={onClose}>
      <div
        className="emoji-picker"
        role="dialog"
        aria-label="Pick an icon"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className="emoji-cell"
              onClick={() => onPick(e)}
              aria-label={`Icon ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <button className="btn btn-subtle" onClick={() => onPick(null)}>
          Remove icon
        </button>
      </div>
    </div>
  );
}
