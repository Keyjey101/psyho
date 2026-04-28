import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { ArrowLeft, Save, Send } from "lucide-react";
import type { User } from "@/types";
import { isTMA, getInitData, TG_TOKEN_KEY, TG_REFRESH_KEY } from "@/utils/telegram";
import { useAuthStore } from "@/store/auth";
import Achievements from "@/components/Achievements";

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
  const { checkAuth } = useAuthStore();
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

  const [tgLinkLoading, setTgLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");

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

  const handleLinkTelegram = async () => {
    if (!isTMA()) return;
    setTgLinkLoading(true);
    setLinkError("");
    try {
      const initData = getInitData();
      const { data: linkData } = await api.post("/auth/link-telegram", { init_data: initData });
      const { data: userData } = await api.get("/user/me");
      setProfile((p) => ({ ...p, user: userData }));
      setLinkSuccess(linkData.merged ? "Аккаунты объединены! История из Telegram теперь в отдельных сессиях." : "Telegram привязан!");
      setTimeout(() => setLinkSuccess(""), 4000);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setLinkError(apiErr?.response?.data?.detail || "Ошибка привязки");
    } finally {
      setTgLinkLoading(false);
    }
  };

  const hasRealEmail = profile.user?.has_real_email ?? true;
  const tgUsername = profile.user?.telegram_username;

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
                {(profile.user.name || (hasRealEmail ? profile.user.email : undefined))?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-semibold text-[#5A5048]">{profile.user.name || "Имя не указано"}</p>
                {hasRealEmail
                  ? <p className="text-sm text-[#8A7A6A]">{profile.user.email}</p>
                  : tgUsername
                    ? <p className="text-sm text-[#8A7A6A]">@{tgUsername} · Telegram</p>
                    : null
                }
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-[#5A5048]">Связанные аккаунты</h2>
            <p className="mb-4 text-sm text-[#8A7A6A]">Управляй способами входа</p>

            {linkSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {linkSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#E8DDD0] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Send className="h-4 w-4 text-[#8A7A6A]" />
                  <div>
                    <p className="text-sm font-medium text-[#5A5048]">Telegram</p>
                    {tgUsername ? (
                      <p className="text-xs text-[#8A7A6A]">@{tgUsername}</p>
                    ) : (
                      <p className="text-xs text-[#B8A898]">не привязан</p>
                    )}
                  </div>
                </div>
                {!tgUsername && (
                  <>
                    {isTMA() ? (
                      <button
                        onClick={handleLinkTelegram}
                        disabled={tgLinkLoading}
                        className="text-xs font-medium text-[#B8785A] hover:text-[#9A6248] disabled:opacity-50"
                      >
                        {tgLinkLoading ? "Привязка..." : "Привязать"}
                      </button>
                    ) : (
                      <span className="text-xs text-[#B8A898]">Откройте через Telegram-бота</span>
                    )}
                  </>
                )}
              </div>

              {linkError && (
                <div className="rounded-lg border border-[#C4786A] bg-[#FDF5F3] px-3 py-2 text-xs text-[#C4786A]">
                  {linkError}
                </div>
              )}
            </div>
          </div>

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

          <Achievements />

          <button onClick={handleSave} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Сохранено!" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
