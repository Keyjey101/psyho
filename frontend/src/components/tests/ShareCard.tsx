import { useCallback, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { track, viralCode } from "@/lib/analytics";

const BOT_USERNAME = (import.meta.env.VITE_TG_BOT_USERNAME || "").replace(/^@/, "");

interface Props {
  testSlug: string;
  testTitle: string;
  emoji: string;
  accent: string;
  /** Suppressed entirely on heavy results — nothing to share from a crisis screen. */
  disabled?: boolean;
}

/**
 * "Поделиться результатом" — renders an invite card to a canvas and offers it
 * via the native share sheet, falling back to a download.
 *
 * What the card must NOT contain: the score, the severity band, any wording
 * that could read as a diagnosis, or anything else personal. Only the test
 * topic and an invitation — the person sharing has no idea who will see it.
 *
 * The link carries `viral_<slug>` so word-of-mouth reach never gets mixed into
 * the numbers for a channel we paid for.
 */
export default function ShareCard({
  testSlug,
  testTitle,
  emoji,
  accent,
  disabled,
}: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/test/${testSlug}?c=${viralCode(testSlug)}`;

  const buildImage = useCallback(async (): Promise<Blob | null> => {
    const width = 1080;
    const height = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#FAF6F1";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = accent + "1F";
    ctx.beginPath();
    ctx.arc(width / 2, 330, 150, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.font = "140px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(emoji, width / 2, 385);

    // Topic only — no score, no band, no personal detail of any kind.
    ctx.fillStyle = "#4A4038";
    ctx.font = "bold 62px Georgia, serif";
    wrapText(ctx, testTitle, width / 2, 590, 860, 76);

    ctx.fillStyle = "#8A7A6A";
    ctx.font = "40px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Я прошёл этот тест. Попробуй и ты —", width / 2, 800);
    ctx.fillText("занимает пару минут.", width / 2, 852);

    ctx.fillStyle = accent;
    ctx.font = "bold 38px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(
      BOT_USERNAME ? `@${BOT_USERNAME}` : window.location.host,
      width / 2,
      962,
    );

    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/png"),
    );
  }, [accent, emoji, testTitle]);

  const handleShare = async () => {
    track("test_shared", { test_slug: testSlug, share_target: "card" });

    const blob = await buildImage();
    const file = blob
      ? new File([blob], `test-${testSlug}.png`, { type: "image/png" })
      : null;

    // Native sheet when the browser can take the image, otherwise copy the link
    // and hand over the PNG as a download.
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          text: "Прошёл небольшой тест — попробуй тоже",
          url: shareUrl,
        });
        return;
      } catch {
        /* user dismissed the sheet — fall through */
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the download below still works */
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `test-${testSlug}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  if (disabled) return null;

  return (
    <button
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded-pill border border-[#D8CDC0] px-6 py-3 text-sm font-medium text-[#5A5048] transition-colors hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:text-[#E8DDD0] dark:hover:bg-[#4A4038]"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Ссылка скопирована
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" /> Поделиться результатом
        </>
      )}
      {!copied && <Download className="h-3.5 w-3.5 opacity-50" aria-hidden />}
    </button>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}
