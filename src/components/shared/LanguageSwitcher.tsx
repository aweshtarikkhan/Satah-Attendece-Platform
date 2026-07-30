import React, { useEffect, useState } from "react";

type Lang = "en" | "hi";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("satah-lang") as Lang) || "en");

  useEffect(() => {
    localStorage.setItem("satah-lang", lang);
    // Dispatch event so other components can re-render if needed
    window.dispatchEvent(new Event("language-change"));
  }, [lang]);

  return (
    <div className="flex items-center rounded-full border bg-muted/50 p-0.5 text-xs">
      <button
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-full transition ${lang === "en" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("hi")}
        className={`px-2.5 py-1 rounded-full transition ${lang === "hi" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
      >
        हिंदी
      </button>
    </div>
  );
}
