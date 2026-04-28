import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import api from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { isTMA, getTelegramUser } from "@/utils/telegram";

const TOTAL_STEPS = 5;
const DRAFT_KEY = "onboarding_draft";

const GOALS = [
  { id: "anxiety", label: "Справиться с тревогой", emoji: "😰" },
  { id: "depression", label: "Преодолеть подавленность", emoji: "🌧️" },
  { id: "relationships", label: "Улучшить отношения", emoji: "💑" },
  { id: "self_esteem", label: "Повысить самооценку", emoji: "💪" },
  { id: "meaning", label: "Найти смысл и цель", emoji: "🌟" },
  { id: "stress", label: "Управлять стрессом", emoji: "🧘" },
  { id: "habits", label: "Изменить привычки", emoji: "🔄" },
  { id: "trauma", label: "Переработать травму", emoji: "🩹" },
];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8 flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-all duration-300"
          style={{ background: i < step ? "#B8785A" : "#E8DDD0" }}
        />
      ))}
    </div>
  );
}

const variants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
};

interface Draft {
  step: number;
  name: string;
  addressForm: string;
  selectedGoals: string[];
  style: string;
  gender: string;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveDraft(d: Draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const { refreshUser } = useAuthStore();

  const draft = loadDraft();
  const [step, setStep] = useState(draft?.step ?? 1);
  const [name, setName] = useState(draft?.name ?? "");
  const [addressForm, setAddressForm] = useState<"ты" | "вы">(draft?.addressForm as "ты" | "вы" ?? "ты");
  const [selectedGoals, setSelectedGoals] = useState<string[]>(draft?.selectedGoals ?? []);
  const [style, setStyle] = useState(draft?.style ?? "balanced");
  const [gender, setGender] = useState(draft?.gender ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saveDraft({ step, name, addressForm, selectedGoals, style, gender });
  }, [step, name, addressForm, selectedGoals, style, gender]);

  useEffect(() => {
    if (!name && isTMA()) {
      const tgUser = getTelegramUser();
      if (tgUser?.first_name) {
        setName(tgUser.first_name);
      }
    }
  }, []);

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.patch("/user/me", {
        name: name.trim() || undefined,
        address_form: addressForm,
        therapy_goals: selectedGoals.length
          ? selectedGoals.map((id) => GOALS.find((g) => g.id === id)?.label).filter(Boolean).join(", ")
          : undefined,
        preferred_style: style,
        gender: gender || undefined,
      });
      clearDraft();
      await refreshUser();
      navigate("/chat", { replace: true });
    } catch {
      navigate("/chat", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FAF6F1] px-6 py-12">
      <div className="w-full max-w-sm">
        <ProgressBar step={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            {step === 1 && (
              <StepName name={name} setName={setName} onNext={handleNext} canNext={canProceed()} />
            )}
            {step === 2 && (
              <StepAddress addressForm={addressForm} setAddressForm={setAddressForm} onNext={handleNext} onBack={handleBack} />
            )}
            {step === 3 && (
              <StepGoals selected={selectedGoals} toggle={toggleGoal} onNext={handleNext} onSkip={handleSkip} onBack={handleBack} />
            )}
            {step === 4 && (
              <StepStyle style={style} setStyle={setStyle} onNext={handleNext} onSkip={handleSkip} onBack={handleBack} />
            )}
            {step === 5 && (
              <StepGender gender={gender} setGender={setGender} onFinish={handleFinish} onSkip={handleFinish} saving={saving} onBack={handleBack} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-3 flex items-center gap-1 text-[13px] text-[#B8A898] hover:text-[#8A7A6A]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Назад
    </button>
  );
}

function StepName({ name, setName, onNext, canNext }: {
  name: string; setName: (v: string) => void; onNext: () => void; canNext: boolean;
}) {
  return (
    <div>
      <img src="/illustrations/opt/ai_avatar.webp" alt="" className="mb-1 mx-auto h-10 w-10 object-contain" />
      <h2 className="mb-2 text-center font-serif text-[22px] font-bold text-[#4A4038]">
        Как тебя зовут?
      </h2>
      <p className="mb-8 text-center text-[13px] text-[#8A7A6A]">
        Ника будет обращаться к тебе по имени
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && canNext && onNext()}
        className="input-field mb-4"
        placeholder="Твоё имя"
        autoFocus
        maxLength={50}
      />
      <button
        onClick={onNext}
        disabled={!canNext}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        Продолжить
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepAddress({ addressForm, setAddressForm, onNext, onBack }: {
  addressForm: "ты" | "вы"; setAddressForm: (v: "ты" | "вы") => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <p className="mb-1 text-center text-[32px]">🤝</p>
      <h2 className="mb-2 text-center font-serif text-[22px] font-bold text-[#4A4038]">
        Как тебе комфортнее?
      </h2>
      <p className="mb-8 text-center text-[13px] text-[#8A7A6A]">
        Ника будет обращаться так, как тебе удобно
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {(["ты", "вы"] as const).map((form) => (
          <button
            key={form}
            onClick={() => setAddressForm(form)}
            className={`rounded-[16px] py-4 text-[15px] font-medium transition-all ${
              addressForm === form
                ? "bg-[#B8785A] text-white shadow-sm"
                : "bg-white text-[#5A5048] border border-[#E8DDD0] hover:border-[#B8785A]"
            }`}
          >
            {form === "ты" ? "На «ты»" : "На «вы»"}
          </button>
        ))}
      </div>
      <p className="mb-6 text-center text-[12px] text-[#B8A898]">
        {addressForm === "ты"
          ? "Неформально и тепло — для большинства удобнее"
          : "Вежливо и с дистанцией — как на приёме у специалиста"}
      </p>
      <button onClick={onNext} className="btn-primary w-full flex items-center justify-center gap-2">
        Продолжить
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepGoals({ selected, toggle, onNext, onSkip, onBack }: {
  selected: string[]; toggle: (id: string) => void; onNext: () => void; onSkip: () => void; onBack: () => void;
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <p className="mb-1 text-center text-[32px]">🎯</p>
      <h2 className="mb-2 text-center font-serif text-[22px] font-bold text-[#4A4038]">
        Что хочешь проработать?
      </h2>
      <p className="mb-6 text-center text-[13px] text-[#8A7A6A]">
        Можно выбрать несколько
      </p>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {GOALS.map((g) => {
          const active = selected.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={`relative flex flex-col items-start rounded-[14px] p-3 text-left text-[13px] transition-all ${
                active
                  ? "bg-[#FAF0E8] border border-[#B8785A] text-[#5A5048]"
                  : "bg-white border border-[#E8DDD0] text-[#5A5048] hover:border-[#B8A898]"
              }`}
            >
              {active && (
                <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#B8785A]">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <span className="mb-1 text-[18px]">{g.emoji}</span>
              <span className="leading-tight">{g.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={selected.length > 0 ? onNext : onSkip}
        className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
      >
        {selected.length > 0 ? "Продолжить" : "Пропустить"}
        <ArrowRight className="h-4 w-4" />
      </button>
      {selected.length > 0 && (
        <button onClick={onSkip} className="w-full text-center text-[13px] text-[#B8A898] hover:text-[#8A7A6A]">
          Пропустить
        </button>
      )}
    </div>
  );
}

const STYLES = [
  { id: "gentle", label: "Мягкий", desc: "Тепло, поддержка, без давления" },
  { id: "balanced", label: "Сбалансированный", desc: "Между теплотой и структурой" },
  { id: "direct", label: "Прямой", desc: "Конкретно, структурно, по делу" },
];

function StepStyle({ style, setStyle, onNext, onSkip, onBack }: {
  style: string; setStyle: (v: string) => void; onNext: () => void; onSkip: () => void; onBack: () => void;
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <p className="mb-1 text-center text-[32px]">💬</p>
      <h2 className="mb-2 text-center font-serif text-[22px] font-bold text-[#4A4038]">
        Как говорить с тобой?
      </h2>
      <p className="mb-6 text-center text-[13px] text-[#8A7A6A]">
        Как Нике лучше с тобой общаться
      </p>
      <div className="mb-6 space-y-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={`w-full rounded-[14px] p-4 text-left transition-all ${
              style === s.id
                ? "bg-[#FAF0E8] border border-[#B8785A]"
                : "bg-white border border-[#E8DDD0] hover:border-[#B8A898]"
            }`}
          >
            <div className="font-medium text-[#4A4038]">{s.label}</div>
            <div className="text-[12px] text-[#8A7A6A]">{s.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={onNext} className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
        Продолжить
        <ArrowRight className="h-4 w-4" />
      </button>
      <button onClick={onSkip} className="w-full text-center text-[13px] text-[#B8A898] hover:text-[#8A7A6A]">
        Пропустить
      </button>
    </div>
  );
}

const GENDERS = [
  { id: "female", label: "Она / её" },
  { id: "male", label: "Он / его" },
  { id: "other", label: "Предпочитаю не указывать" },
];

function StepGender({ gender, setGender, onFinish, onSkip, saving, onBack }: {
  gender: string; setGender: (v: string) => void; onFinish: () => void; onSkip: () => void; saving: boolean; onBack: () => void;
}) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <img src="/illustrations/icons/icon_crystal.webp" alt="" className="mb-1 mx-auto h-10 w-10 object-contain" />
      <h2 className="mb-2 text-center font-serif text-[22px] font-bold text-[#4A4038]">
        Как к тебе обращаться?
      </h2>
      <p className="mb-6 text-center text-[13px] text-[#8A7A6A]">
        Помогает Нике правильно использовать окончания слов
      </p>
      <div className="mb-6 space-y-2">
        {GENDERS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGender(g.id)}
            className={`w-full rounded-[14px] p-4 text-left text-[14px] transition-all ${
              gender === g.id
                ? "bg-[#FAF0E8] border border-[#B8785A] font-medium text-[#4A4038]"
                : "bg-white border border-[#E8DDD0] text-[#5A5048] hover:border-[#B8A898]"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <button
        onClick={onFinish}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
      >
        {saving ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <>Начать <ArrowRight className="h-4 w-4" /></>
        )}
      </button>
      <button onClick={onSkip} disabled={saving} className="w-full text-center text-[13px] text-[#B8A898] hover:text-[#8A7A6A]">
        Пропустить
      </button>
    </div>
  );
}
