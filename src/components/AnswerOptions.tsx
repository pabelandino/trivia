interface AnswerOptionsProps {
  options: string[];
  selectedIndex: number | null;
  correctIndex?: number | null;
  disabled?: boolean;
  onSelect?: (index: number) => void;
  showResults?: boolean;
}

export function AnswerOptions({
  options,
  selectedIndex,
  correctIndex = null,
  disabled = false,
  onSelect,
  showResults = false,
}: AnswerOptionsProps) {
  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        const isSelected = selectedIndex === index;
        const isCorrect = showResults && correctIndex === index;
        const isWrong =
          showResults && isSelected && correctIndex !== null && correctIndex !== index;

        let classes =
          "w-full rounded-2xl border-2 px-5 py-4 text-left font-bold transition transform active:scale-[0.98] ";

        if (showResults) {
          if (isCorrect) {
            classes += "border-yellow-300 bg-yellow-300 text-indigo-950 shadow-lg";
          } else if (isWrong) {
            classes += "border-rose-400 bg-rose-500/20 text-white";
          } else {
            classes += "border-white/10 bg-white/5 text-white/70";
          }
        } else if (isSelected) {
          classes += "border-yellow-300 bg-yellow-300 text-indigo-950 shadow-lg";
        } else {
          classes += "border-white/20 bg-white text-indigo-900 hover:bg-white/95";
        }

        return (
          <button
            key={`${option}-${index}`}
            type="button"
            disabled={disabled || showResults}
            onClick={() => onSelect?.(index)}
            className={classes}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{option}</span>
              {showResults && isCorrect ? <span>✓</span> : null}
              {!showResults && isSelected ? <span>✓</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
