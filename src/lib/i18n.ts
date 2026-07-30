import { useState, useEffect } from "react";

export type Lang = "en" | "hi";

export function useLanguage() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("satah-lang") as Lang) || "en");

  useEffect(() => {
    const handleLangChange = () => {
      setLang((localStorage.getItem("satah-lang") as Lang) || "en");
    };
    window.addEventListener("language-change", handleLangChange);
    return () => window.removeEventListener("language-change", handleLangChange);
  }, []);

  const t = (enString: string): string => {
    if (lang === "en") return enString;
    return dictionary[enString] || enString;
  };

  return { lang, t };
}

const dictionary: Record<string, string> = {
  // Sidebar
  "Dashboard": "डैशबोर्ड",
  "Sales": "बिक्री (Sales)",
  "Invoices": "चालान (Invoices)",
  "Estimates": "अनुमान (Estimates)",
  "Clients": "ग्राहक (Clients)",
  "Credit Notes": "क्रेडिट नोट्स",
  "Payments Received": "प्राप्त भुगतान",
  "Delivery Challans": "डिलीवरी चालान",
  "Recurring Invoices": "आवर्ती चालान",
  "Catalog": "सूची (Catalog)",
  "Items": "सामग्री (Items)",
  "Inventory": "माल-सूची (Inventory)",
  "Purchases": "खरीद (Purchases)",
  "Vendors": "विक्रेता (Vendors)",
  "Purchase Orders": "खरीद आदेश",
  "Bills": "बिल (Bills)",
  "Expenses": "खर्चे (Expenses)",
  "Accounting": "लेखांकन (Accounting)",
  "Chart of Accounts": "खातों का चार्ट",
  "Journal Entries": "जर्नल प्रविष्टियाँ",
  "Bank & Cash": "बैंक और नकद",
  "Cash Flow": "नकदी प्रवाह (Cash Flow)",
  "People": "लोग (People)",
  "Employees": "कर्मचारी (Employees)",
  "Attendance": "उपस्थिति (Attendance)",
  "Reports": "रिपोर्ट (Reports)",
  "Settings": "सेटिंग्स (Settings)",
  "System & Settings": "सिस्टम सेटिंग्स",
  "Admin Panel": "व्यवस्थापक पैनल",
  "Sign Out": "साइन आउट",
  
  // Dashboard
  "Welcome back": "वापसी पर स्वागत है",
  "Here's what's happening with your business today.": "आज आपके व्यवसाय में क्या हो रहा है।",
  "Export PDF": "PDF डाउनलोड करें",
  "New Invoice": "नया चालान",
  "New Client": "नया ग्राहक",
  "Total Revenue": "कुल आय",
  "Total Receivables": "कुल प्राप्य",
  "Total Invoices": "कुल चालान",
  "Total Clients": "कुल ग्राहक",
  "Overdue Amount": "अतिदेय राशि",
  "Quick Access — All Features": "त्वरित पहुँच — सभी सुविधाएँ",
  "Smart Insights": "स्मार्ट अंतर्दृष्टि",
  "Total Sales": "कुल बिक्री",
  "Total Receipts": "कुल प्राप्तियां",
  "Outstanding": "बकाया (Outstanding)",
  "Collection Rate": "संग्रह दर",
  "Avg Invoice": "औसत चालान",
  "Total Expenses": "कुल खर्चे",
};
