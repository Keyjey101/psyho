interface AnswerOptionsProps {
  choices: string[];
  selectedIdx: number | null;
  disabled?: boolean;
  onSelect: (idx: number) => void;
}

export function AnswerOptions({ choices, selectedIdx, disabled, onSelect }: AnswerOptionsProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {choices.map((choice, idx) => {
        const isSelected = selectedIdx === idx;
        return (
          <button
            key={idx}
            onClick={() => !disabled && onSelect(idx)}
            disabled={disabled}
            style={{ minHeight: '56px' }}
            className={[
              'w-full text-left rounded-2xl px-5 py-4 text-sm font-medium transition-all duration-200',
              'border-2 focus:outline-none focus:ring-2 focus:ring-offset-2',
              isSelected
                ? 'bg-[#B8785A] border-[#B8785A] text-white shadow-md scale-[1.02]'
                : 'bg-white dark:bg-[#2A2420] border-[#E8DDD0] dark:border-[#4A4038] text-[#5A5048] dark:text-[#D8C8B8] hover:border-[#B8785A] hover:bg-[#FAF6F1] dark:hover:bg-[#3A3028]',
              disabled && !isSelected ? 'opacity-60 cursor-default' : 'cursor-pointer',
            ].join(' ')}
          >
            <span className="leading-snug">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}
