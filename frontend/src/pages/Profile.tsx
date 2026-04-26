import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft, Save } from "lucide-react";
import type { User } from "@/types";

interface ProfileData {
  user: User | null;
  preferred_style: string;
  therapy_goals: string;
  address_form: string;
  gender: string;
  pop_score: number;
}

const STYLES = [
  { id: "direct", label: "Прямой", desc: "Чёткие шаги и конкретные техники" },
  { id: "gentle", label: "Мягкий", desc: "Больше эмпатии, меньше директив" },
  { id: "balanced", label: "Сбалансированный", desc: "Золотая середина" },
];

const GENDERS = [
  { id: "female", label: "Она / её" },
  { id: "male", label: "Он / его" },
  { id: "other", label: "Не указывать" },
];

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData>({
    user: null,
    preferred_style: "balanced",
    therapy_goals: "",
    address_form: "ты",
    gender: "",
    pop_score: 0,
  });
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/user/me").then(({ data }) => {
      setProfile({
        user: data,
        preferred_style: data.profile?.preferred_style || "balanced",
        therapy_goals: data.profile?.therapy_goals || "",
        address_form: data.profile?.address_form || "ты",
        gender: data.profile?.gender || "",
        pop_score: data.profile?.pop_score || 0,
      });
    });
  }, []);

  const handleSave = async () => {
    try {
      await api.patch("/user/me", {
        preferred_style: profile.preferred_style,
        therapy_goals: profile.therapy_goals,
        address_form: profile.address_form,
        gender: profile.gender || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/chat")}
          className="mb-6 flex items-center gap-2 text-sm text-[#8A7A6A] hover:text-[#5A5048]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <h1 className="mb-8 text-2xl font-bold text-[#5A5048]">Профиль</h1>

        {profile.user && (
          <div className="mb-6 rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#B8785A] text-lg font-bold text-white">
                {(profile.user.name || profile.user.email)?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-semibold text-[#5A5048]">{profile.user.name || "Имя не указано"}</p>
                <p className="text-sm text-[#8A7A6A]">{profile.user.email}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#5A5048]">Форма обращения</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["ты", "вы"] as const).map((form) => (
                <button
                  key={form}
                  onClick={() => setProfile((p) => ({ ...p, address_form: form }))}
                  className={`rounded-xl border py-3 text-center text-sm font-medium transition-all ${
                    profile.address_form === form
                      ? "border-[#B8785A] bg-[#FAF0E8] text-[#B8785A]"
                      : "border-[#E8DDD0] bg-white text-[#5A5048] hover:border-[#D8CDC0]"
                  }`}
                >
                  На «{form}»
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-[#5A5048]">Местоимения</h2>
            <p className="mb-4 text-sm text-[#8A7A6A]">Помогает Нике правильно использовать окончания</p>
            <div className="space-y-2">
              {GENDERS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setProfile((p) => ({ ...p, gender: g.id }))}
                  className={`w-full rounded-xl border px-5 py-3 text-left text-sm transition-all ${
                    profile.gender === g.id
                      ? "border-[#B8785A] bg-[#FAF0E8] font-medium text-[#B8785A]"
                      : "border-[#E8DDD0] bg-white text-[#5A5048] hover:border-[#D8CDC0]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#5A5048]">Стиль общения</h2>
            <div className="space-y-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setProfile((p) => ({ ...p, preferred_style: s.id }))}
                  className={`w-full rounded-xl border px-5 py-3 text-left transition-all ${
                    profile.preferred_style === s.id
                      ? "border-[#B8785A] bg-[#FAF0E8]"
                      : "border-[#E8DDD0] bg-white hover:border-[#D8CDC0]"
                  }`}
                >
                  <p className="font-medium text-[#5A5048]">{s.label}</p>
                  <p className="text-sm text-[#8A7A6A]">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#5A5048]">Цели терапии</h2>
            <textarea
              value={profile.therapy_goals}
              onChange={(e) => setProfile((p) => ({ ...p, therapy_goals: e.target.value }))}
              placeholder="Опиши, что бы ты хотел(а) изменить или понять..."
              className="input-field min-h-[100px] resize-none"
            />
          </div>

          {profile.pop_score > 0 && (
            <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold text-[#5A5048]">Поп-ит</h2>
              <p className="text-sm text-[#8A7A6A]">Всего лопнуто пузырей</p>
              <p className="mt-2 text-3xl font-bold text-[#B8785A]">{profile.pop_score}</p>
            </div>
          )}

          <button onClick={handleSave} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Сохранено!" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
