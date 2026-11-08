// Plain-language copy for the 3 demo steps, keyed by page. Presentation only; the routes come from app/lib/steps.ts.
export type StepCopy = {
  who: string;
  action: string;
  short: string;
  doIt: [string, string, string];
  signal: string;
  result: string;
};

export const STEP_COPY: Record<string, StepCopy> = {
  "/app/owner": {
    who: "You are the customer, at home with Wi-Fi.",
    action: "Lock $40 for your phone",
    short: "lock $40",
    doIt: ["Tap “Use a test wallet” and “Get $50” (free test money).", "Open Phone (step 2) in a second window, copy its code, paste it here.", "Tap “Lock $40 in a tab”."],
    signal: "Needs signal, once",
    result: "$40 is locked on Solana for your phone. Nobody can spend it twice.",
  },
  "/app/phone": {
    who: "You are the customer, at the market. No signal.",
    action: "Pay the shop with no signal",
    short: "pay offline",
    doIt: ["Tap “Find my tab”.", "Scan or paste the shop’s code, type $3.50.", "Show the QR code your phone makes to the shop."],
    signal: "No signal needed",
    result: "Your phone signs a $3.50 payment in a few milliseconds.",
  },
  "/app/shop": {
    who: "You are the shop owner, Amara.",
    action: "Check the payment, then collect",
    short: "check + collect",
    doIt: ["Scan or paste the customer’s QR code.", "See “Signature valid” and “Covered”. Tap Accept.", "When the signal is back, tap “Collect”."],
    signal: "Signal only to collect",
    result: "The money lands in your account on Solana in about a second.",
  },
};
