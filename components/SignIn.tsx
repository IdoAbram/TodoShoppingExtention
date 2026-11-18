import { CATEGORIES } from "@/lib/categories";
import { MicrosoftLogo } from "./icons";

const ERRORS: Record<string, string> = {
  not_configured: "האפליקציה עוד לא חוברה ל-Microsoft: חסרים MS_CLIENT_ID ו-MS_CLIENT_SECRET (ראו README).",
  denied: "ההתחברות בוטלה.",
  not_allowed: "החשבון הזה לא ברשימת המורשים (ALLOWED_EMAILS).",
  state: "ההתחברות פגה או נקטעה. נסו שוב.",
  oauth: "ההתחברות ל-Microsoft נכשלה. נסו שוב.",
};

export function SignIn({ error, demo }: { error?: string; demo?: boolean }) {
  const message = error ? (ERRORS[error] ?? ERRORS.oauth) : null;
  const preview = CATEGORIES.slice(0, 6);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={72} height={72} className="rounded-2xl shadow-card" />
        <h1 className="text-3xl font-bold text-text">רשימת קניות חכמה</h1>
        <p className="text-balance text-muted">
          מתחברת לרשימת הקניות שלכם ב-Microsoft To Do ומסדרת אותה לפי המחלקות בסופר. מה שמסמנים כאן מסומן גם ב-To Do.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2 text-sm" aria-label="דוגמה למחלקות">
        {preview.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-card">
            <span aria-hidden>{c.emoji}</span>
            <span className="truncate text-text">{c.name}</span>
          </li>
        ))}
      </ul>

      {message && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {message}
        </p>
      )}

      <a
        href="/api/auth/login"
        className="flex h-12 items-center justify-center gap-3 rounded-lg bg-accent px-6 font-medium text-on-accent shadow-card transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex rounded-sm bg-white p-0.5">
          <MicrosoftLogo />
        </span>
        התחברות עם חשבון Microsoft
      </a>
      <p className="text-center text-xs text-subtle">
        {demo
          ? "מצב הדגמה (DEMO_MODE): הכניסה פותחת רשימה לדוגמה, בלי חיבור אמיתי ל-Microsoft."
          : "כל אחד מבני המשפחה מתחבר עם החשבון שלו ובוחר את הרשימה המשותפת."}
      </p>
    </main>
  );
}
