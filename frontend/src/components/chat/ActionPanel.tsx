interface ActionPanelProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

const actions = [
  { id: "insight", label: "Получить инсайт", img: "/illustrations/action_insight.png", variant: "insight" as const },
  { id: "breathe", label: "Подышать", img: "/illustrations/action_breathe.png", variant: "secondary" as const },
  { id: "write", label: "Написать мысль", img: "/illustrations/action_journal.png", variant: "secondary" as const },
  { id: "exercise", label: "Упражнение", img: "/illustrations/action_exercise.png", variant: "secondary" as const },
];

export default function ActionPanel({ onAction, disabled }: ActionPanelProps) {
  return (
    <div className="overflow-x-auto px-4 pb-2 pt-1 lg:px-6">
      <div className="mx-auto flex max-w-3xl gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={disabled}
            className={
              (action.variant === "insight"
                ? "btn-insight"
                : "btn-secondary") +
              " shrink-0 text-xs disabled:opacity-50 disabled:pointer-events-none"
            }
          >
            <img src={action.img} alt="" className="h-4 w-4 object-contain" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
